/**
 * Entity State Hook
 * 
 * Manages entity view state for the panel.
 */

import { useState, useRef, useCallback } from 'react';
import type { EntityData, PlatformInfo, MultiPlatformResult } from '../types/panel-types';

export interface EntityStateReturn {
  // Current entity
  entity: EntityData | null;
  setEntity: React.Dispatch<React.SetStateAction<EntityData | null>>;
  
  // Multi-platform results for navigation
  multiPlatformResults: MultiPlatformResult[];
  setMultiPlatformResults: React.Dispatch<React.SetStateAction<MultiPlatformResult[]>>;
  multiPlatformResultsRef: React.RefObject<MultiPlatformResult[]>;
  
  // Current platform index for navigation
  currentPlatformIndex: number;
  setCurrentPlatformIndex: React.Dispatch<React.SetStateAction<number>>;
  currentPlatformIndexRef: React.RefObject<number>;
  
  // Navigation tracking
  entityFromSearchMode: 'unified-search' | null;
  setEntityFromSearchMode: (mode: 'unified-search' | null) => void;
  
  // Loading state for entity details
  entityDetailsLoading: boolean;
  setEntityDetailsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Helper functions
  sortPlatformResults: <T extends { platformId: string }>(results: T[], availablePlatforms: PlatformInfo[]) => T[];
  clearEntityState: () => void;
  
  // Update refs synchronously (for use after state updates)
  updateMultiPlatformResultsRef: (results: MultiPlatformResult[]) => void;
  updateCurrentPlatformIndexRef: (index: number) => void;
}

/**
 * Hook for managing entity state
 */
export function useEntityState(): EntityStateReturn {
  // Current entity
  const [entity, setEntity] = useState<EntityData | null>(null);
  
  // Multi-platform results
  const [multiPlatformResults, setMultiPlatformResults] = useState<MultiPlatformResult[]>([]);
  const multiPlatformResultsRef = useRef<MultiPlatformResult[]>([]);
  
  // Current platform index
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState<number>(0);
  const currentPlatformIndexRef = useRef<number>(0);
  
  // Navigation tracking
  const [entityFromSearchMode, setEntityFromSearchMode] = useState<'unified-search' | null>(null);
  
  // Loading state for entity details
  const [entityDetailsLoading, setEntityDetailsLoading] = useState<boolean>(false);
  
  // Helper function to sort multi-platform results with OpenCTI platforms first
  // OpenCTI is the knowledge base reference, so it should always be displayed first
  const sortPlatformResults = useCallback(<T extends { platformId: string }>(results: T[], availablePlatforms: PlatformInfo[]): T[] => {
    return [...results].sort((a, b) => {
      const platformA = availablePlatforms.find(p => p.id === a.platformId);
      const platformB = availablePlatforms.find(p => p.id === b.platformId);
      const typeA = platformA?.type || 'opencti';
      const typeB = platformB?.type || 'opencti';
      
      // OpenCTI platforms should come before OpenAEV (and other platforms)
      if (typeA === 'opencti' && typeB !== 'opencti') return -1;
      if (typeA !== 'opencti' && typeB === 'opencti') return 1;
      
      // Within the same platform type, maintain original order (stable sort)
      return 0;
    });
  }, []);
  
  // Update refs synchronously
  const updateMultiPlatformResultsRef = useCallback((results: MultiPlatformResult[]) => {
    multiPlatformResultsRef.current = results;
  }, []);
  
  const updateCurrentPlatformIndexRef = useCallback((index: number) => {
    currentPlatformIndexRef.current = index;
  }, []);
  
  // Clear all entity state
  const clearEntityState = useCallback(() => {
    setEntity(null);
    setMultiPlatformResults([]);
    multiPlatformResultsRef.current = [];
    setCurrentPlatformIndex(0);
    currentPlatformIndexRef.current = 0;
    setEntityFromSearchMode(null);
    setEntityDetailsLoading(false);
  }, []);
  
  return {
    entity,
    setEntity,
    multiPlatformResults,
    setMultiPlatformResults,
    multiPlatformResultsRef,
    currentPlatformIndex,
    setCurrentPlatformIndex,
    currentPlatformIndexRef,
    entityFromSearchMode,
    setEntityFromSearchMode,
    entityDetailsLoading,
    setEntityDetailsLoading,
    sortPlatformResults,
    clearEntityState,
    updateMultiPlatformResultsRef,
    updateCurrentPlatformIndexRef,
  };
}
