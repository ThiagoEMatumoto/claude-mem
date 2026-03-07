import React, { useState } from 'react';
import { API_ENDPOINTS } from '../constants/api';

interface AddObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: string[];
}

const OBSERVATION_TYPES = ['discovery', 'bugfix', 'feature', 'decision', 'change', 'refactor'];

export function AddObservationModal({ isOpen, onClose, projects }: AddObservationModalProps) {
  const [title, setTitle] = useState('');
  const [narrative, setNarrative] = useState('');
  const [type, setType] = useState('discovery');
  const [project, setProject] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!narrative.trim()) {
      setError('Text content is required');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const res = await fetch(API_ENDPOINTS.MEMORY_SAVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: narrative.trim(),
          title: title.trim() || undefined,
          project: project || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTitle('');
        setNarrative('');
        setType('discovery');
        setProject('');
        onClose();
      } else {
        setError(data.message || 'Failed to save');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="add-observation-modal">
        <div className="modal-header">
          <h2>Add Observation</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brief title (auto-generated if empty)"
            />
          </div>
          <div className="form-group">
            <label>Content *</label>
            <textarea
              value={narrative}
              onChange={e => setNarrative(e.target.value)}
              placeholder="What did you learn, decide, or discover?"
              rows={5}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                {OBSERVATION_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Project</label>
              <select value={project} onChange={e => setProject(e.target.value)}>
                <option value="">Default</option>
                {projects.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
