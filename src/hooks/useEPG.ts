/**
 * useEPG Hook
 *
 * React hook for managing Electronic Program Guide data,
 * including loading, searching, and filtering programs.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  EPGStorage,
  type EPGProgram,
  type EPGChannelData,
} from "../utils/epgStorage";

export interface UseEPGResult {
  // Data
  channels: EPGChannelData[];
  currentPrograms: EPGProgram[];
  allGenres: string[];

  // Search/Filter state
  searchQuery: string;
  selectedGenre: string | null;
  searchResults: EPGProgram[];

  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedGenre: (genre: string | null) => void;
  refreshEPG: () => void;
  clearEPG: () => void;

  // Status
  isLoading: boolean;
}

/**
 * Hook for EPG data management
 *
 * @returns EPG state and actions
 */
export function useEPG(): UseEPGResult {
  const [channels, setChannels] = useState<EPGChannelData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load EPG data on mount
  const loadEPGData = useCallback(() => {
    setIsLoading(true);
    try {
      const data = EPGStorage.getAllEPGData();
      setChannels(data);
    } catch (error) {
      console.error("Error loading EPG data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEPGData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadEPGData is stable and does not need to be a dependency
  }, []);

  // Get current programs - update periodically as time changes
  const [currentPrograms, setCurrentPrograms] = useState<EPGProgram[]>(() =>
    EPGStorage.getCurrentPrograms(),
  );

  useEffect(() => {
    // Update immediately when channels change
    setCurrentPrograms(EPGStorage.getCurrentPrograms());

    // Set up interval to update current programs every 30 seconds
    const interval = setInterval((): void => {
      setCurrentPrograms(EPGStorage.getCurrentPrograms());
    }, 30000);

    return (): void => clearInterval(interval);
  }, [channels]);

  // Get all genres
  const allGenres = useMemo(() => {
    return EPGStorage.getAllGenres();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Trigger re-computation when channels change in localStorage
  }, [channels]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery && !selectedGenre) {
      return [];
    }

    let results: EPGProgram[] = [];

    // Apply search query
    if (searchQuery) {
      results = EPGStorage.searchPrograms(searchQuery);
    } else if (selectedGenre) {
      results = EPGStorage.filterByGenre(selectedGenre);
    }

    // Apply genre filter if both are set
    if (searchQuery && selectedGenre) {
      results = results.filter((program) =>
        program.genres.includes(selectedGenre),
      );
    }

    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Trigger re-computation when channels change in localStorage
  }, [searchQuery, selectedGenre, channels]);

  // Refresh EPG data
  const refreshEPG = useCallback(() => {
    loadEPGData();
  }, [loadEPGData]);

  // Clear EPG data
  const clearEPG = useCallback(() => {
    EPGStorage.clearEPGData();
    setChannels([]);
    setSearchQuery("");
    setSelectedGenre(null);
  }, []);

  return {
    channels,
    currentPrograms,
    allGenres,
    searchQuery,
    selectedGenre,
    searchResults,
    setSearchQuery,
    setSelectedGenre,
    refreshEPG,
    clearEPG,
    isLoading,
  };
}
