/**
 * Content-based project resolution fallback.
 *
 * When file-path-based resolution fails (no files, or all files are vault content),
 * this module infers the project from observation titles and content using keyword matching.
 *
 * The keyword map is loaded from .claude-mem-hub.json `content_keywords` field.
 * If not configured, no content-based resolution is performed.
 */

import type { HubConfig } from './project-name.js';

/**
 * Resolve project from observation content using keyword scoring.
 * Returns the project with the most keyword matches, or null if no match.
 *
 * Scoring approach prevents false positives when content mentions keywords
 * from multiple projects (e.g. security research mentioning "watermark"
 * alongside "TRF2" and "Crawler" should resolve to the project with more hits).
 *
 * Each keyword match adds its length as weight, so longer/more-specific
 * keywords contribute more to the score than short generic ones.
 */
export function resolveProjectFromContent(
  content: string,
  hubConfig: HubConfig,
): string | null {
  if (!content) return null;

  const keywords = hubConfig.content_keywords;
  if (!keywords || Object.keys(keywords).length === 0) return null;

  // Score each project by summing matched keyword lengths
  const scores = new Map<string, number>();

  for (const [keyword, project] of Object.entries(keywords)) {
    if (project === hubConfig.default_project) continue;
    if (content.includes(keyword)) {
      scores.set(project, (scores.get(project) ?? 0) + keyword.length);
    }
  }

  if (scores.size === 0) return null;

  // Return project with highest score
  let bestProject: string | null = null;
  let bestScore = 0;
  for (const [project, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestProject = project;
    }
  }

  return bestProject;
}
