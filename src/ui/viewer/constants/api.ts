/**
 * API endpoint paths
 * Centralized to avoid magic strings scattered throughout the codebase
 */
export const API_ENDPOINTS = {
  OBSERVATIONS: '/api/observations',
  OBSERVATION: '/api/observation',
  SUMMARIES: '/api/summaries',
  PROMPTS: '/api/prompts',
  PROJECTS: '/api/projects',
  SETTINGS: '/api/settings',
  STATS: '/api/stats',
  PROCESSING_STATUS: '/api/processing-status',
  STREAM: '/stream',
  MEMORY_SAVE: '/api/memory/save',
  SEARCH: '/api/search',
} as const;
