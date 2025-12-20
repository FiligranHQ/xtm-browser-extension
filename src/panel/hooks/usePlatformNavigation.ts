/**
 * Platform Navigation Hook
 * 
 * Shared hook for navigating between multiple platform results in entity views.
 * Eliminates duplication between OCTIEntityView and OAEVEntityView.
 */

import { useCallback } from 'react';
import type { EntityData, MultiPlatformResult, PlatformInfo, PanelMode } from '../types/panel-types';

export interface PlatformNavigationState {
  multiPlatformResults: MultiPlatformResult[];
  currentPlatformIndex: number;
  currentPlatformIndexRef: React.RefObject<number>;
  multiPlatformResultsRef: React.RefObject<MultiPlatformResult[]>;
}

export interface PlatformNavigationSetters {
  setMultiPlatformResults: (results: MultiPlatformResult[]) => void;
  setCurrentPlatformIndex: (index: number) => void;
  setEntity: (entity: EntityData | null) => void;
  setSelectedPlatformId: (id: string) => void;
  setPlatformUrl: (url: string) => void;
}

export interface UsePlatformNavigationProps {
  state: PlatformNavigationState;
  setters: PlatformNavigationSetters;
  availablePlatforms: PlatformInfo[];
  fetchEntityDetailsInBackground: (
    entity: EntityData,
    platformId: string,
    index: number
  ) => void;
}

export interface PlatformNavigationResult {
  /** Navigate to previous platform result */
  handlePreviousPlatform: () => void;
  /** Navigate to next platform result */
  handleNextPlatform: () => void;
  /** Check if can navigate to previous */
  canNavigatePrevious: boolean;
  /** Check if can navigate to next */
  canNavigateNext: boolean;
  /** Current platform result */
  currentResult: MultiPlatformResult | undefined;
  /** Current platform info */
  currentPlatform: PlatformInfo | undefined;
  /** Whether there are multiple platform results */
  hasMultiplePlatforms: boolean;
}

/**
 * Hook for platform navigation in entity views
 * 
 * Provides navigation handlers and computed state for moving between
 * multi-platform entity search results.
 */
export function usePlatformNavigation({
  state,
  setters,
  availablePlatforms,
  fetchEntityDetailsInBackground,
}: UsePlatformNavigationProps): PlatformNavigationResult {
  const {
    multiPlatformResults,
    currentPlatformIndex,
    currentPlatformIndexRef,
    multiPlatformResultsRef,
  } = state;

  const {
    setCurrentPlatformIndex,
    setEntity,
    setSelectedPlatformId,
    setPlatformUrl,
  } = setters;

  // Navigate to a specific platform index
  const navigateToIndex = useCallback((newIdx: number) => {
    const results = multiPlatformResultsRef.current;
    if (newIdx < 0 || newIdx >= results.length) return;

    const target = results[newIdx];
    const platform = availablePlatforms.find(p => p.id === target.platformId);

    // Update refs first for sync state
    currentPlatformIndexRef.current = newIdx;

    // Update state
    setCurrentPlatformIndex(newIdx);
    setEntity(target.entity);
    setSelectedPlatformId(target.platformId);
    if (platform) setPlatformUrl(platform.url);

    // Fetch fresh data
    fetchEntityDetailsInBackground(target.entity, target.platformId, newIdx);
  }, [
    availablePlatforms,
    currentPlatformIndexRef,
    multiPlatformResultsRef,
    setCurrentPlatformIndex,
    setEntity,
    setSelectedPlatformId,
    setPlatformUrl,
    fetchEntityDetailsInBackground,
  ]);

  const handlePreviousPlatform = useCallback(() => {
    const idx = currentPlatformIndexRef.current;
    const results = multiPlatformResultsRef.current;
    if (idx > 0 && results.length > 1) {
      navigateToIndex(idx - 1);
    }
  }, [currentPlatformIndexRef, multiPlatformResultsRef, navigateToIndex]);

  const handleNextPlatform = useCallback(() => {
    const idx = currentPlatformIndexRef.current;
    const results = multiPlatformResultsRef.current;
    if (idx < results.length - 1) {
      navigateToIndex(idx + 1);
    }
  }, [currentPlatformIndexRef, multiPlatformResultsRef, navigateToIndex]);

  // Computed values
  const currentResult = multiPlatformResults[currentPlatformIndex];
  const currentPlatform = availablePlatforms.find(p => p.id === currentResult?.platformId);
  const hasMultiplePlatforms = multiPlatformResults.length > 1;
  const canNavigatePrevious = currentPlatformIndex > 0 && hasMultiplePlatforms;
  const canNavigateNext = currentPlatformIndex < multiPlatformResults.length - 1;

  return {
    handlePreviousPlatform,
    handleNextPlatform,
    canNavigatePrevious,
    canNavigateNext,
    currentResult,
    currentPlatform,
    hasMultiplePlatforms,
  };
}

/**
 * Create back navigation handler for entity views
 * 
 * Handles returning to scan results or search mode.
 */
export function useBackNavigation({
  entityFromScanResults,
  setEntityFromScanResults,
  entityFromSearchMode,
  setEntityFromSearchMode,
  setMultiPlatformResults,
  setPanelMode,
}: {
  entityFromScanResults: boolean;
  setEntityFromScanResults: (value: boolean) => void;
  entityFromSearchMode: 'unified-search' | null;
  setEntityFromSearchMode: (mode: 'unified-search' | null) => void;
  setMultiPlatformResults: (results: MultiPlatformResult[]) => void;
  setPanelMode: (mode: PanelMode) => void;
}) {
  return useCallback(() => {
    if (entityFromScanResults) {
      setEntityFromScanResults(false);
      setMultiPlatformResults([]);
      setPanelMode('scan-results');
    } else if (entityFromSearchMode) {
      setMultiPlatformResults([]);
      setPanelMode(entityFromSearchMode);
      setEntityFromSearchMode(null);
    }
  }, [
    entityFromScanResults,
    setEntityFromScanResults,
    entityFromSearchMode,
    setEntityFromSearchMode,
    setMultiPlatformResults,
    setPanelMode,
  ]);
}

