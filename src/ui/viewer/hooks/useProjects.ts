import { useState, useEffect, useCallback } from 'react';
import { ProjectStats } from '../types';
import { API_ENDPOINTS } from '../constants/api';

export function useProjects() {
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.PROJECTS}?stats=true`);
      const data = await res.json();
      setProjectStats(data.projects || []);
    } catch (err) {
      console.error('[useProjects] Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projectStats, isLoading, refresh: fetchProjects };
}
