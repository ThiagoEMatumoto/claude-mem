/**
 * Observation mutation functions (delete, update)
 * Extracted for modular organization following observations/ pattern
 */

import { Database } from 'bun:sqlite';
import { logger } from '../../../utils/logger.js';
import { computeObservationContentHash } from './store.js';
import { getObservationById } from './get.js';
import type { UpdateObservationInput } from './types.js';
import type { ObservationRecord } from '../../../types/database.js';

/**
 * Delete an observation by ID
 * Returns true if a row was actually deleted
 */
export function deleteObservation(db: Database, id: number): boolean {
  const stmt = db.prepare('DELETE FROM observations WHERE id = ?');
  const result = stmt.run(id);
  const deleted = result.changes > 0;

  if (deleted) {
    logger.info('DB', `Deleted observation #${id}`);
  } else {
    logger.debug('DB', `No observation found with id=${id} to delete`);
  }

  return deleted;
}

/**
 * Update an observation by ID with partial fields
 * Recomputes content_hash if title or narrative changed
 * Returns the updated record, or null if not found
 */
export function updateObservation(
  db: Database,
  id: number,
  fields: UpdateObservationInput
): ObservationRecord | null {
  const existing = getObservationById(db, id);
  if (!existing) return null;

  const setClauses: string[] = [];
  const params: any[] = [];

  if (fields.title !== undefined) {
    setClauses.push('title = ?');
    params.push(fields.title);
  }
  if (fields.narrative !== undefined) {
    setClauses.push('narrative = ?');
    params.push(fields.narrative);
  }
  if (fields.facts !== undefined) {
    setClauses.push('facts = ?');
    params.push(JSON.stringify(fields.facts));
  }
  if (fields.concepts !== undefined) {
    setClauses.push('concepts = ?');
    params.push(JSON.stringify(fields.concepts));
  }
  if (fields.type !== undefined) {
    setClauses.push('type = ?');
    params.push(fields.type);
  }
  if (fields.subtitle !== undefined) {
    setClauses.push('subtitle = ?');
    params.push(fields.subtitle);
  }
  if (fields.project !== undefined) {
    setClauses.push('project = ?');
    params.push(fields.project);
  }

  if (setClauses.length === 0) {
    return existing;
  }

  // Recompute content_hash if title or narrative changed
  if (fields.title !== undefined || fields.narrative !== undefined) {
    const newTitle = fields.title !== undefined ? fields.title : (existing as any).title;
    const newNarrative = fields.narrative !== undefined ? fields.narrative : (existing as any).narrative;
    const contentHash = computeObservationContentHash(
      existing.memory_session_id,
      newTitle,
      newNarrative
    );
    setClauses.push('content_hash = ?');
    params.push(contentHash);
  }

  params.push(id);

  const stmt = db.prepare(
    `UPDATE observations SET ${setClauses.join(', ')} WHERE id = ?`
  );
  stmt.run(...params);

  logger.info('DB', `Updated observation #${id}`, { fields: Object.keys(fields) });

  return getObservationById(db, id);
}
