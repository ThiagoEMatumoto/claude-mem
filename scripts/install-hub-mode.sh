#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# install-hub-mode.sh — Install claude-mem hub mode fork
#
# Hub mode enables file-path-based project detection for vaults that manage
# multiple repositories (e.g., Obsidian vaults with repos/ symlinks).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ThiagoEMatumoto/claude-mem/feature/hub-mode/scripts/install-hub-mode.sh | bash
#
# Or clone and run:
#   git clone https://github.com/ThiagoEMatumoto/claude-mem.git
#   cd claude-mem && git checkout feature/hub-mode
#   bash scripts/install-hub-mode.sh
# ============================================================================

REPO_URL="https://github.com/ThiagoEMatumoto/claude-mem.git"
BRANCH="feature/hub-mode"
PLUGIN_CACHE="$HOME/.claude/plugins/cache/thedotmack/claude-mem"
CLONE_DIR="${CLAUDE_MEM_SRC:-$HOME/claude-mem}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---- Pre-flight checks ----

command -v bun >/dev/null 2>&1 || error "bun is required. Install: https://bun.sh"
command -v git >/dev/null 2>&1 || error "git is required."

# Detect installed plugin version
if [ ! -d "$PLUGIN_CACHE" ]; then
    error "claude-mem plugin not found at $PLUGIN_CACHE. Install it from the Claude Code marketplace first."
fi

INSTALLED_VERSION=$(ls -1 "$PLUGIN_CACHE" | grep -E '^[0-9]+\.' | sort -V | tail -1)
if [ -z "$INSTALLED_VERSION" ]; then
    error "Could not detect installed claude-mem version in $PLUGIN_CACHE"
fi

PLUGIN_DIR="$PLUGIN_CACHE/$INSTALLED_VERSION"
info "Detected claude-mem version: $INSTALLED_VERSION"

# ---- Clone or update ----

if [ -d "$CLONE_DIR/.git" ]; then
    info "Updating existing clone at $CLONE_DIR..."
    cd "$CLONE_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    info "Cloning claude-mem fork..."
    git clone -b "$BRANCH" "$REPO_URL" "$CLONE_DIR"
    cd "$CLONE_DIR"
fi

ok "Source ready at $CLONE_DIR"

# ---- Build ----

info "Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install

info "Building..."
bun run build

ok "Build complete"

# ---- Backup ----

BACKUP_DIR="$PLUGIN_DIR.bak"
if [ ! -d "$BACKUP_DIR" ]; then
    info "Creating backup at $BACKUP_DIR..."
    cp -r "$PLUGIN_DIR" "$BACKUP_DIR"
    ok "Backup created"
else
    info "Backup already exists at $BACKUP_DIR"
fi

# ---- Deploy ----

info "Deploying scripts to $PLUGIN_DIR/scripts/..."
\cp -f plugin/scripts/*.cjs "$PLUGIN_DIR/scripts/"

info "Deploying skills..."
for skill_dir in plugin/skills/*/; do
    skill_name=$(basename "$skill_dir")
    mkdir -p "$PLUGIN_DIR/skills/$skill_name"
    \cp -f "$skill_dir"* "$PLUGIN_DIR/skills/$skill_name/"
done

ok "Deployed to $PLUGIN_DIR"

# ---- Restart worker ----

WORKER_PORT="${CLAUDE_MEM_WORKER_PORT:-37777}"
if curl -sf "http://127.0.0.1:$WORKER_PORT/api/stats" >/dev/null 2>&1; then
    info "Restarting worker..."
    curl -sf -X POST "http://127.0.0.1:$WORKER_PORT/api/admin/restart" >/dev/null 2>&1 || true
    ok "Worker restart requested"
else
    warn "Worker not running. It will start automatically on next Claude Code session."
fi

# ---- Auto-allow MCP tools ----

CLAUDE_JSON="$HOME/.claude.json"
if [ -f "$CLAUDE_JSON" ] && command -v python3 >/dev/null 2>&1; then
    info "Configuring MCP tool permissions..."

    python3 -c "
import json, sys

claude_json_path = '$CLAUDE_JSON'
try:
    with open(claude_json_path) as f:
        data = json.load(f)
except (json.JSONDecodeError, FileNotFoundError):
    print('Could not read .claude.json, skipping MCP permissions')
    sys.exit(0)

MCP_TOOLS = [
    'mcp__plugin_claude-mem_mcp-search__search',
    'mcp__plugin_claude-mem_mcp-search__timeline',
    'mcp__plugin_claude-mem_mcp-search__get_observations',
]

projects = data.get('projects', {})
changed = False

for project_path, project_config in projects.items():
    allowed = project_config.get('allowedTools', [])
    added = []
    for tool in MCP_TOOLS:
        if tool not in allowed:
            allowed.append(tool)
            added.append(tool.split('__')[-1])
    if added:
        project_config['allowedTools'] = allowed
        changed = True
        print(f'  Added {len(added)} tools to {project_path}: {", ".join(added)}')

if changed:
    with open(claude_json_path, 'w') as f:
        json.dump(data, f, indent=2)
    print('  MCP permissions configured.')
else:
    print('  MCP permissions already configured.')
" 2>/dev/null && ok "MCP tool permissions updated" || warn "Could not auto-configure MCP permissions (see manual step below)"
else
    warn "Could not auto-configure MCP permissions (python3 or .claude.json not found)"
fi

# ---- Hub config setup ----

echo ""
echo -e "${GREEN}=== Installation complete ===${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Create .claude-mem-hub.json in your vault root:"
echo ""
echo '     {'
echo '       "hub_mode": true,'
echo '       "default_project": "my-vault",'
echo '       "project_patterns": {'
echo '         "repos/api/my-service": "my-service",'
echo '         "repos/web/my-frontend": "my-frontend"'
echo '       }'
echo '     }'
echo ""
echo "  2. (Optional) Migrate existing observations:"
echo "     python3 $CLONE_DIR/scripts/migrate-hub-projects.py /path/to/vault --dry-run"
echo "     python3 $CLONE_DIR/scripts/migrate-hub-projects.py /path/to/vault"
echo ""
echo "  3. Start a new Claude Code session in your vault."
echo "     You should see a hub projects table in the context."
echo "     Use /focus <project> to load a specific project's context."
echo ""
echo -e "${YELLOW}Note:${NC} Marketplace updates will overwrite this fork."
echo "  Re-install with: cd $CLONE_DIR && git pull && bash scripts/install-hub-mode.sh"
