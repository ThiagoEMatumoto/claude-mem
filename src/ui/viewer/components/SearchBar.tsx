import React, { useState, useCallback, useRef } from 'react';
import { Observation } from '../types';
import { API_ENDPOINTS } from '../constants/api';

interface SearchBarProps {
  currentFilter: string;
  onSearchResults: (results: Observation[] | null) => void;
}

export function SearchBar({ currentFilter, onSearchResults }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      onSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({ query: searchQuery.trim(), type: 'observations' });
      if (currentFilter) params.set('project', currentFilter);

      const res = await fetch(`${API_ENDPOINTS.SEARCH}?${params}`);
      const data = await res.json();
      onSearchResults(data.observations || []);
    } catch (err) {
      console.error('[Search] Failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [currentFilter, onSearchResults]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [performSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearchResults(null);
  }, [onSearchResults]);

  return (
    <div className="search-bar">
      <div className="search-bar-inner">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search observations..."
          className="search-input"
        />
        {isSearching && <div className="search-spinner"></div>}
        {query && !isSearching && (
          <button className="search-clear-btn" onClick={handleClear}>&times;</button>
        )}
      </div>
    </div>
  );
}
