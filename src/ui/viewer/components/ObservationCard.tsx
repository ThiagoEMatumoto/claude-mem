import React, { useState } from 'react';
import { Observation } from '../types';
import { API_ENDPOINTS } from '../constants/api';
import { formatDate } from '../utils/formatters';

interface ObservationCardProps {
  observation: Observation;
  onDeleted?: (id: number) => void;
  onUpdated?: (observation: Observation) => void;
}

const OBSERVATION_TYPES = ['discovery', 'bugfix', 'feature', 'decision', 'change', 'refactor'];

// Helper to strip project root from file paths
function stripProjectRoot(filePath: string): string {
  // Try to extract relative path by finding common project markers
  const markers = ['/Scripts/', '/src/', '/plugin/', '/docs/'];

  for (const marker of markers) {
    const index = filePath.indexOf(marker);
    if (index !== -1) {
      // Keep the marker and everything after it
      return filePath.substring(index + 1);
    }
  }

  // Fallback: if path contains project name, strip everything before it
  const projectIndex = filePath.indexOf('claude-mem/');
  if (projectIndex !== -1) {
    return filePath.substring(projectIndex + 'claude-mem/'.length);
  }

  // If no markers found, return basename or original path
  const parts = filePath.split('/');
  return parts.length > 3 ? parts.slice(-3).join('/') : filePath;
}

export function ObservationCard({ observation, onDeleted, onUpdated }: ObservationCardProps) {
  const [showFacts, setShowFacts] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(observation.title || '');
  const [editNarrative, setEditNarrative] = useState(observation.narrative || '');
  const [editType, setEditType] = useState(observation.type);
  const [isSaving, setIsSaving] = useState(false);
  const date = formatDate(observation.created_at_epoch);

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.OBSERVATION}/${observation.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        onDeleted?.(observation.id);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsSaving(false);
      setConfirmDelete(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.OBSERVATION}/${observation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          narrative: editNarrative,
          type: editType,
        }),
      });
      const data = await res.json();
      if (data.success && data.observation) {
        onUpdated?.(data.observation);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditTitle(observation.title || '');
    setEditNarrative(observation.narrative || '');
    setEditType(observation.type);
    setIsEditing(false);
  };

  // Parse JSON fields
  const facts = observation.facts ? JSON.parse(observation.facts) : [];
  const concepts = observation.concepts ? JSON.parse(observation.concepts) : [];
  const filesRead = observation.files_read ? JSON.parse(observation.files_read).map(stripProjectRoot) : [];
  const filesModified = observation.files_modified ? JSON.parse(observation.files_modified).map(stripProjectRoot) : [];

  // Show facts toggle if there are facts, concepts, or files
  const hasFactsContent = facts.length > 0 || concepts.length > 0 || filesRead.length > 0 || filesModified.length > 0;

  return (
    <div className="card">
      {/* Header with toggle buttons in top right */}
      <div className="card-header">
        <div className="card-header-left">
          <span className={`card-type type-${observation.type}`}>
            {observation.type}
          </span>
          <span className="card-project">{observation.project}</span>
        </div>
        <div className="view-mode-toggles">
          {hasFactsContent && (
            <button
              className={`view-mode-toggle ${showFacts ? 'active' : ''}`}
              onClick={() => {
                setShowFacts(!showFacts);
                if (!showFacts) setShowNarrative(false);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              <span>facts</span>
            </button>
          )}
          {observation.narrative && (
            <button
              className={`view-mode-toggle ${showNarrative ? 'active' : ''}`}
              onClick={() => {
                setShowNarrative(!showNarrative);
                if (!showNarrative) setShowFacts(false);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>narrative</span>
            </button>
          )}
          <button
            className="view-mode-toggle card-action-btn"
            onClick={() => setIsEditing(true)}
            title="Edit"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button
            className="view-mode-toggle card-action-btn card-action-delete"
            onClick={() => setConfirmDelete(true)}
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="card-confirm-bar">
          <span>Delete this observation?</span>
          <button className="btn-danger-sm" onClick={handleDelete} disabled={isSaving}>
            {isSaving ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button className="btn-secondary-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}

      {/* Edit mode */}
      {isEditing ? (
        <div className="card-edit-form">
          <input
            className="card-edit-input"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Title"
          />
          <textarea
            className="card-edit-textarea"
            value={editNarrative}
            onChange={e => setEditNarrative(e.target.value)}
            placeholder="Narrative"
            rows={4}
          />
          <div className="card-edit-row">
            <select
              className="card-edit-select"
              value={editType}
              onChange={e => setEditType(e.target.value)}
            >
              {OBSERVATION_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="card-edit-actions">
              <button className="btn-primary-sm" onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-secondary-sm" onClick={handleCancelEdit}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Title */}
          <div className="card-title">{observation.title || 'Untitled'}</div>

          {/* Content based on toggle state */}
          <div className="view-mode-content">
            {!showFacts && !showNarrative && observation.subtitle && (
              <div className="card-subtitle">{observation.subtitle}</div>
            )}
            {showFacts && facts.length > 0 && (
              <ul className="facts-list">
                {facts.map((fact: string, i: number) => (
                  <li key={i}>{fact}</li>
                ))}
              </ul>
            )}
            {showNarrative && observation.narrative && (
              <div className="narrative">
                {observation.narrative}
              </div>
            )}
          </div>
        </>
      )}

      {/* Metadata footer - id, date, and conditionally concepts/files when facts toggle is on */}
      <div className="card-meta">
        <span className="meta-date">#{observation.id} • {date}</span>
        {showFacts && (concepts.length > 0 || filesRead.length > 0 || filesModified.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {concepts.map((concept: string, i: number) => (
              <span key={i} style={{
                padding: '2px 8px',
                background: 'var(--color-type-badge-bg)',
                color: 'var(--color-type-badge-text)',
                borderRadius: '3px',
                fontWeight: '500',
                fontSize: '10px'
              }}>
                {concept}
              </span>
            ))}
            {filesRead.length > 0 && (
              <span className="meta-files">
                <span className="file-label">read:</span> {filesRead.join(', ')}
              </span>
            )}
            {filesModified.length > 0 && (
              <span className="meta-files">
                <span className="file-label">modified:</span> {filesModified.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
