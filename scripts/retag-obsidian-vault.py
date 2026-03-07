#!/usr/bin/env python3
"""
Re-tag obsidian-vault observations to their correct projects based on:
1. File paths in files_read/files_modified
2. Content keywords from .claude-mem-hub.json content_keywords config
3. Title/text/facts analysis

Usage:
  python3 scripts/retag-obsidian-vault.py --dry-run          # Preview changes
  python3 scripts/retag-obsidian-vault.py                     # Apply changes
  python3 scripts/retag-obsidian-vault.py --hub-config PATH   # Custom hub config
"""

import sqlite3
import json
import sys
import os
from collections import defaultdict

DB_PATH = os.path.expanduser("~/.claude-mem/claude-mem.db")
DEFAULT_HUB_CONFIG = os.path.expanduser("~/Documentos/Obsidian/.claude-mem-hub.json")

# File path substring -> project mapping (derived from hub config patterns)
FILE_PATH_PROJECT_MAP = {
    "prognosticos": "prognosticos",
    "legal-core": "legal-core",
    "admin-console": "admin-console",
    "claude-mem": "claude-mem",
    "data-lake": "data-lake",
    "infrastructure": "infrastructure",
    "lexter-diligence": "lexter-diligence",
    "lexter-imobiliario": "lexter-imobiliario",
    "documents-pipeline": "documents-pipeline",
    "plant-disease-classifier": "plant-disease-classifier",
    "claude-monitor": "claude-monitor",
    "claude-tray": "claude-monitor",
    "ops-hub": "ops-hub",
    "legal-ui": "legal-ui",
    "lexter-copilot": "lexter-copilot-api",
    "/tmp/claude-tray": "claude-monitor",
    "crawlers/domain": "prognosticos",
    "crawlers/services": "prognosticos",
    "crawlers/useCases": "prognosticos",
    "pje_extraction": "prognosticos",
    "pje-prognosticos": "admin-console",
    "etl_prognosticos": "data-lake",
    ".terraform/etl_prognosticos": "data-lake",
}

# Vault content indicators (observations correctly tagged as obsidian-vault)
VAULT_INDICATORS = [
    "vault", "Obsidian", "STATUS.md", "CLAUDE.md", "BACKLOG.md",
    "thread note", "Thread note", "daily note", "Daily Note",
    "Dataview", "frontmatter", "wikilink",
    "slash command", "/evolve", "/start-day", "/end-day",
    "second brain", "knowledge base",
    "symlink", "Symlink", "Symlinked",
    "Repository Inventory", "Repository Symlinks",
    "Areas Directory", "Directory Comparison",
    "Knowledge Base Structure",
    "thread files", "Thread Files",
    "thread titles", "Thread Titles",
    "Regenerate", "regenerate",
    "hub configuration",
]

VAULT_FILE_PREFIXES = [
    "Threads/", "Areas/", "Knowledge/", "Dashboard/",
    "Templates/", "evolution/", "Diario/", "Archive/",
    "CLAUDE.md", "STATUS.md", "BACKLOG.md",
]


def load_content_keywords(hub_config_path: str) -> dict[str, str]:
    """Load content_keywords from hub config file."""
    try:
        with open(hub_config_path) as f:
            config = json.load(f)
        return config.get("content_keywords", {})
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not load hub config from {hub_config_path}: {e}")
        return {}


def resolve_from_files(files_json: str) -> str | None:
    """Try to resolve project from file paths."""
    if not files_json or files_json == "[]":
        return None
    try:
        files = json.loads(files_json)
    except (json.JSONDecodeError, TypeError):
        return None

    for f in files:
        for pattern, project in sorted(
            FILE_PATH_PROJECT_MAP.items(), key=lambda x: len(x[0]), reverse=True
        ):
            if pattern in f:
                return project
    return None


def resolve_from_keywords(
    title: str, text: str, facts: str, content_keywords: dict[str, str]
) -> str | None:
    """Try to resolve project from content keywords (longest match first)."""
    content = f"{title or ''} {text or ''} {facts or ''}"

    for keyword, project in sorted(
        content_keywords.items(), key=lambda x: len(x[0]), reverse=True
    ):
        if keyword in content:
            return project
    return None


def is_vault_content(title: str, files_read: str, files_modified: str) -> bool:
    """Check if observation is genuinely about vault operations."""
    content = f"{title or ''} {files_read or ''} {files_modified or ''}"

    for indicator in VAULT_INDICATORS:
        if indicator in content:
            return True

    all_files = []
    for fj in [files_read, files_modified]:
        if fj and fj != "[]":
            try:
                all_files.extend(json.loads(fj))
            except (json.JSONDecodeError, TypeError):
                pass

    if all_files:
        all_vault = all(
            any(
                f.startswith(prefix) or f.endswith(prefix.rstrip("/"))
                for prefix in VAULT_FILE_PREFIXES
            )
            or f.startswith("~/.claude/")
            or f.startswith("/home/lexter/.claude/")
            for f in all_files
        )
        if all_vault:
            return True

    return False


def main():
    dry_run = "--dry-run" in sys.argv

    # Load hub config for content keywords
    hub_config_path = DEFAULT_HUB_CONFIG
    for i, arg in enumerate(sys.argv):
        if arg == "--hub-config" and i + 1 < len(sys.argv):
            hub_config_path = sys.argv[i + 1]

    content_keywords = load_content_keywords(hub_config_path)
    print(f"Loaded {len(content_keywords)} content keywords from {hub_config_path}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    rows = cursor.execute(
        "SELECT id, title, text, facts, files_read, files_modified "
        "FROM observations WHERE project = 'obsidian-vault'"
    ).fetchall()

    print(f"Total obsidian-vault observations: {len(rows)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'APPLY'}\n")

    retag_counts: dict[str, int] = defaultdict(int)
    kept_count = 0
    ambiguous_count = 0
    retag_details: list[tuple[int, str, str]] = []

    for row in rows:
        obs_id = row["id"]
        title = row["title"] or ""
        text = row["text"] or ""
        facts = row["facts"] or ""
        files_read = row["files_read"] or "[]"
        files_modified = row["files_modified"] or "[]"

        # Priority 1: If it's vault content (thread management, vault setup, etc.), keep it
        if is_vault_content(title, files_read, files_modified):
            kept_count += 1
            continue

        # Priority 2: File paths (most reliable signal for actual project work)
        new_project = resolve_from_files(files_read) or resolve_from_files(
            files_modified
        )

        # Priority 3: Content keywords from hub config
        if not new_project:
            new_project = resolve_from_keywords(title, text, facts, content_keywords)

        if not new_project:
            ambiguous_count += 1
            continue

        if new_project == "obsidian-vault":
            kept_count += 1
            continue

        retag_counts[new_project] += 1
        retag_details.append((obs_id, new_project, title[:80]))

        if not dry_run:
            cursor.execute(
                "UPDATE observations SET project = ? WHERE id = ?",
                (new_project, obs_id),
            )

    if not dry_run:
        conn.commit()

    # Report
    print("=== Re-tag summary ===")
    for project, count in sorted(
        retag_counts.items(), key=lambda x: x[1], reverse=True
    ):
        print(f"  -> {project}: {count}")
    print(f"\nRe-tagged: {sum(retag_counts.values())}")
    print(f"Kept as obsidian-vault: {kept_count}")
    print(f"Ambiguous (kept as-is): {ambiguous_count}")

    if dry_run and retag_details:
        print(f"\n=== Sample re-tags (first 30) ===")
        for obs_id, project, title in retag_details[:30]:
            print(f"  #{obs_id} -> {project}: {title}")

    conn.close()


if __name__ == "__main__":
    main()
