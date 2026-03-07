/**
 * MistaggedObservationFixer: Self-healing for hub mode mis-tagged observations
 *
 * On worker startup, scans recent observations tagged with the default project
 * and re-resolves their project from files_read/files_modified paths.
 * This catches any bugs in the hook→enqueue→process pipeline that cause
 * observations to be tagged with the wrong project.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { logger } from "../../../utils/logger.js";
import {
	findHubConfigRoot,
	loadHubConfig,
	resolveProjectFromFilePath,
} from "../../../utils/project-name.js";
import type { Database } from "../../sqlite/sqlite-compat.js";

interface ObservationRow {
	id: number;
	project: string;
	files_read: string | null;
	files_modified: string | null;
}

/**
 * Fix recent observations mis-tagged as the default project.
 * Scans the last 24h of observations and re-resolves from file paths.
 *
 * @param db - SQLite database handle
 * @param hubRootHint - Optional hint for hub config root (e.g. from CWD)
 * @returns Number of observations re-tagged
 */
export function fixMistaggedObservations(
	db: Database,
	hubRootHint?: string,
): number {
	// Find hub config root
	const hubRoot = hubRootHint
		? findHubConfigRoot(hubRootHint)
		: findHubConfigFromKnownPaths();

	if (!hubRoot) {
		logger.debug(
			"RETAG",
			"No hub config found, skipping mis-tag fix",
		);
		return 0;
	}

	const hubConfig = loadHubConfig(hubRoot);
	if (!hubConfig) return 0;

	const defaultProject = hubConfig.default_project;
	const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24h ago

	// Find observations tagged as default_project that have file paths
	const rows = db
		.prepare(
			`SELECT id, project, files_read, files_modified
       FROM observations
       WHERE project = ? AND created_at_epoch > ?
         AND (files_read IS NOT NULL OR files_modified IS NOT NULL)
       ORDER BY id DESC`,
		)
		.all(defaultProject, cutoff) as ObservationRow[];

	if (rows.length === 0) return 0;

	let retagged = 0;
	const updateStmt = db.prepare(
		"UPDATE observations SET project = ? WHERE id = ?",
	);

	for (const row of rows) {
		const filesRead = row.files_read ? safeJsonParse(row.files_read) : [];
		const filesModified = row.files_modified
			? safeJsonParse(row.files_modified)
			: [];
		const allPaths = [...filesRead, ...filesModified];

		for (const fp of allPaths) {
			const resolved = resolveProjectFromFilePath(fp, hubRoot, hubConfig);
			if (resolved !== defaultProject) {
				updateStmt.run(resolved, row.id);
				retagged++;
				logger.debug("RETAG", `Re-tagged observation #${row.id}: ${defaultProject} → ${resolved}`, {
					filePath: fp,
				});
				break;
			}
		}
	}

	if (retagged > 0) {
		logger.info(
			"RETAG",
			`Self-healed ${retagged}/${rows.length} mis-tagged observations (${defaultProject} → correct project)`,
		);
	}

	return retagged;
}

function safeJsonParse(json: string): string[] {
	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/**
 * Try to find hub config from common paths when no hint is available.
 * Checks the worker process CWD and common vault locations.
 */
function findHubConfigFromKnownPaths(): string | null {
	// Try the CWD first (worker process CWD)
	const cwdResult = findHubConfigRoot(process.cwd());
	if (cwdResult) return cwdResult;

	// Try home directory common locations
	const candidates = [
		path.join(os.homedir(), "Documentos", "Obsidian"),
		path.join(os.homedir(), "Documents", "Obsidian"),
		path.join(os.homedir(), "Obsidian"),
	];

	for (const candidate of candidates) {
		try {
			fs.accessSync(path.join(candidate, ".claude-mem-hub.json"), fs.constants.R_OK);
			return candidate;
		} catch {
			// Not found, try next
		}
	}

	return null;
}
