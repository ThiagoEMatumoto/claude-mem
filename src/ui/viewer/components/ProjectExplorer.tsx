import React, { useState } from 'react';
import { ProjectStats, ProjectObservationPreview } from '../types';
import { useProjects } from '../hooks/useProjects';

interface ProjectExplorerProps {
  onSelectProject: (project: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  discovery: '#58a6ff',
  bugfix: '#f85149',
  feature: '#3fb950',
  decision: '#d2a8ff',
  change: '#f0883e',
  refactor: '#79c0ff',
};

const TYPE_ICONS: Record<string, string> = {
  discovery: '\u{1F50D}',
  bugfix: '\u{1F41B}',
  feature: '\u{2728}',
  decision: '\u{2696}',
  change: '\u{2705}',
  refactor: '\u{1F504}',
};

function formatRelativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function ProjectRow({ project, onSelectProject }: { project: ProjectStats; onSelectProject: (name: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const topTypes = Object.entries(project.types)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <div className="project-row">
      <div className="project-row-header" onClick={() => setExpanded(!expanded)}>
        <div className="project-row-left">
          <span className={`project-row-chevron ${expanded ? 'expanded' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
          <span className="project-row-name">{project.name}</span>
          <span className="project-row-count">{project.count}</span>
          <span className="project-row-activity">{formatRelativeTime(project.lastActivity)}</span>
        </div>
        <div className="project-row-types">
          {topTypes.map(([type, count]) => (
            <span
              key={type}
              className="project-type-badge"
              style={{ backgroundColor: TYPE_COLORS[type] || '#8b949e' }}
            >
              {count} {type}
            </span>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="project-row-details">
          <div className="project-recent-list">
            {(project.recentObservations || []).map((obs: ProjectObservationPreview) => (
              <div key={obs.id} className="project-recent-item">
                <span className={`project-recent-type type-${obs.type}`}>
                  {TYPE_ICONS[obs.type] || '\u{25CF}'} {obs.type}
                </span>
                <span className="project-recent-title">{obs.title || 'Untitled'}</span>
                <span className="project-recent-time">{formatRelativeTime(obs.created_at_epoch)}</span>
              </div>
            ))}
          </div>
          <button
            className="project-view-all-btn"
            onClick={(e) => { e.stopPropagation(); onSelectProject(project.name); }}
          >
            View all {project.count} observations &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

export function ProjectExplorer({ onSelectProject }: ProjectExplorerProps) {
  const { projectStats, isLoading } = useProjects();

  if (isLoading && projectStats.length === 0) {
    return (
      <div className="project-explorer">
        <div className="project-explorer-loading">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="project-explorer">
      <div className="project-explorer-header">
        <h2>{projectStats.length} Projects</h2>
        <span className="project-explorer-total">
          {projectStats.reduce((sum, p) => sum + p.count, 0)} total observations
        </span>
      </div>
      <div className="project-list">
        {projectStats.map((project: ProjectStats) => (
          <ProjectRow
            key={project.name}
            project={project}
            onSelectProject={onSelectProject}
          />
        ))}
      </div>
      {projectStats.length === 0 && !isLoading && (
        <div className="project-explorer-empty">No projects found</div>
      )}
    </div>
  );
}
