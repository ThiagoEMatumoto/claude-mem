import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header, ViewMode } from './components/Header';
import { Feed } from './components/Feed';
import { ProjectExplorer } from './components/ProjectExplorer';
import { SearchBar } from './components/SearchBar';
import { AddObservationModal } from './components/AddObservationModal';
import { ContextSettingsModal } from './components/ContextSettingsModal';
import { LogsDrawer } from './components/LogsModal';
import { useSSE } from './hooks/useSSE';
import { useSettings } from './hooks/useSettings';
import { useStats } from './hooks/useStats';
import { usePagination } from './hooks/usePagination';
import { useTheme } from './hooks/useTheme';
import { Observation, Summary, UserPrompt } from './types';
import { mergeAndDeduplicateByProject } from './utils/data';

export function App() {
  const [currentFilter, setCurrentFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Observation[] | null>(null);
  const [contextPreviewOpen, setContextPreviewOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [paginatedObservations, setPaginatedObservations] = useState<Observation[]>([]);
  const [paginatedSummaries, setPaginatedSummaries] = useState<Summary[]>([]);
  const [paginatedPrompts, setPaginatedPrompts] = useState<UserPrompt[]>([]);

  const { observations, summaries, prompts, projects, isProcessing, queueDepth, isConnected } = useSSE();
  const { settings, saveSettings, isSaving, saveStatus } = useSettings();
  const { stats, refreshStats } = useStats();
  const { preference, resolvedTheme, setThemePreference } = useTheme();
  const pagination = usePagination(currentFilter);

  // When filtering by project: ONLY use paginated data (API-filtered)
  // When showing all projects: merge SSE live data with paginated data
  const allObservations = useMemo(() => {
    if (currentFilter) {
      // Project filter active: API handles filtering, ignore SSE items
      return paginatedObservations;
    }
    // No filter: merge SSE + paginated, deduplicate by ID
    return mergeAndDeduplicateByProject(observations, paginatedObservations);
  }, [observations, paginatedObservations, currentFilter]);

  const allSummaries = useMemo(() => {
    if (currentFilter) {
      return paginatedSummaries;
    }
    return mergeAndDeduplicateByProject(summaries, paginatedSummaries);
  }, [summaries, paginatedSummaries, currentFilter]);

  const allPrompts = useMemo(() => {
    if (currentFilter) {
      return paginatedPrompts;
    }
    return mergeAndDeduplicateByProject(prompts, paginatedPrompts);
  }, [prompts, paginatedPrompts, currentFilter]);

  // Handle search results (null = clear search, show normal feed)
  const handleSearchResults = useCallback((results: Observation[] | null) => {
    setSearchResults(results);
  }, []);

  // Handle observation delete/update from cards
  const handleObservationDeleted = useCallback((id: number) => {
    setPaginatedObservations(prev => prev.filter(o => o.id !== id));
  }, []);

  const handleObservationUpdated = useCallback((updated: Observation) => {
    setPaginatedObservations(prev => prev.map(o => o.id === updated.id ? updated : o));
  }, []);

  // Handle project selection from ProjectExplorer
  const handleSelectProject = useCallback((project: string) => {
    setCurrentFilter(project);
    setViewMode('feed');
  }, []);

  // Toggle add observation modal
  const toggleAddModal = useCallback(() => {
    setAddModalOpen(prev => !prev);
  }, []);

  // Toggle context preview modal
  const toggleContextPreview = useCallback(() => {
    setContextPreviewOpen(prev => !prev);
  }, []);

  // Toggle logs modal
  const toggleLogsModal = useCallback(() => {
    setLogsModalOpen(prev => !prev);
  }, []);

  // Handle loading more data
  const handleLoadMore = useCallback(async () => {
    try {
      const [newObservations, newSummaries, newPrompts] = await Promise.all([
        pagination.observations.loadMore(),
        pagination.summaries.loadMore(),
        pagination.prompts.loadMore()
      ]);

      if (newObservations.length > 0) {
        setPaginatedObservations(prev => [...prev, ...newObservations]);
      }
      if (newSummaries.length > 0) {
        setPaginatedSummaries(prev => [...prev, ...newSummaries]);
      }
      if (newPrompts.length > 0) {
        setPaginatedPrompts(prev => [...prev, ...newPrompts]);
      }
    } catch (error) {
      console.error('Failed to load more data:', error);
    }
  }, [currentFilter, pagination.observations, pagination.summaries, pagination.prompts]);

  // Reset paginated data and load first page when filter changes
  useEffect(() => {
    setPaginatedObservations([]);
    setPaginatedSummaries([]);
    setPaginatedPrompts([]);
    handleLoadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilter]);

  return (
    <>
      <Header
        isConnected={isConnected}
        projects={projects}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        isProcessing={isProcessing}
        queueDepth={queueDepth}
        themePreference={preference}
        onThemeChange={setThemePreference}
        onContextPreviewToggle={toggleContextPreview}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddObservation={toggleAddModal}
      />

      {viewMode === 'feed' && (
        <SearchBar currentFilter={currentFilter} onSearchResults={handleSearchResults} />
      )}

      {viewMode === 'feed' ? (
        <Feed
          observations={searchResults !== null ? searchResults : allObservations}
          summaries={searchResults !== null ? [] : allSummaries}
          prompts={searchResults !== null ? [] : allPrompts}
          onLoadMore={handleLoadMore}
          isLoading={searchResults === null && (pagination.observations.isLoading || pagination.summaries.isLoading || pagination.prompts.isLoading)}
          hasMore={searchResults === null && (pagination.observations.hasMore || pagination.summaries.hasMore || pagination.prompts.hasMore)}
          onObservationDeleted={handleObservationDeleted}
          onObservationUpdated={handleObservationUpdated}
        />
      ) : (
        <ProjectExplorer onSelectProject={handleSelectProject} />
      )}

      <ContextSettingsModal
        isOpen={contextPreviewOpen}
        onClose={toggleContextPreview}
        settings={settings}
        onSave={saveSettings}
        isSaving={isSaving}
        saveStatus={saveStatus}
      />

      <button
        className="console-toggle-btn"
        onClick={toggleLogsModal}
        title="Toggle Console"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      </button>

      <LogsDrawer
        isOpen={logsModalOpen}
        onClose={toggleLogsModal}
      />

      <AddObservationModal
        isOpen={addModalOpen}
        onClose={toggleAddModal}
        projects={projects}
      />
    </>
  );
}
