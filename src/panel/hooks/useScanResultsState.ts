/**
 * Scan Results State Hook
 * 
 * Manages all scan results-related state for the panel.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ScanResultEntity, EntityData } from '../types';

export interface ScanResultsStateReturn {
  // Scan results entities
  scanResultsEntities: ScanResultEntity[];
  setScanResultsEntities: React.Dispatch<React.SetStateAction<ScanResultEntity[]>>;
  scanResultsEntitiesRef: React.MutableRefObject<ScanResultEntity[]>;
  
  // Filters
  scanResultsTypeFilter: string;
  setScanResultsTypeFilter: (filter: string) => void;
  scanResultsFoundFilter: 'all' | 'found' | 'not-found' | 'ai-discovered';
  setScanResultsFoundFilter: (filter: 'all' | 'found' | 'not-found' | 'ai-discovered') => void;
  
  // Selection
  selectedScanItems: Set<string>;
  setSelectedScanItems: React.Dispatch<React.SetStateAction<Set<string>>>;
  
  // Page content for AI features
  scanPageContent: string;
  setScanPageContent: (content: string) => void;
  
  // Page info
  currentPageUrl: string;
  setCurrentPageUrl: (url: string) => void;
  currentPageTitle: string;
  setCurrentPageTitle: (title: string) => void;
  
  // Navigation tracking
  entityFromScanResults: boolean;
  setEntityFromScanResults: (from: boolean) => void;
  
  // Helpers
  checkSelectable: (entity: ScanResultEntity) => boolean;
  checkFoundInOpenCTI: (entity: ScanResultEntity) => boolean;
  getSelectedEntitiesForPreview: () => EntityData[];
  clearScanResults: () => void;
}

/**
 * Hook for managing scan results state
 */
export function useScanResultsState(): ScanResultsStateReturn {
  // Scan results entities
  const [scanResultsEntities, setScanResultsEntities] = useState<ScanResultEntity[]>([]);
  const scanResultsEntitiesRef = useRef<ScanResultEntity[]>([]);
  
  // Filters
  const [scanResultsTypeFilter, setScanResultsTypeFilter] = useState<string>('all');
  const [scanResultsFoundFilter, setScanResultsFoundFilter] = useState<'all' | 'found' | 'not-found' | 'ai-discovered'>('all');
  
  // Selection
  const [selectedScanItems, setSelectedScanItems] = useState<Set<string>>(new Set());
  
  // Page content for AI features
  const [scanPageContent, setScanPageContent] = useState<string>('');
  
  // Page info
  const [currentPageUrl, setCurrentPageUrl] = useState<string>('');
  const [currentPageTitle, setCurrentPageTitle] = useState<string>('');
  
  // Navigation tracking
  const [entityFromScanResults, setEntityFromScanResults] = useState<boolean>(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    scanResultsEntitiesRef.current = scanResultsEntities;
  }, [scanResultsEntities]);
  
  // Helper function to check if entity is selectable for OpenCTI
  const checkSelectable = useCallback((entity: ScanResultEntity): boolean => {
    // OpenAEV-specific types can't be added to OpenCTI containers
    if (entity.type.startsWith('oaev-')) return false;
    return true;
  }, []);
  
  // Helper function to check if entity already exists in OpenCTI
  const checkFoundInOpenCTI = useCallback((entity: ScanResultEntity): boolean => {
    const octiCount = entity.platformMatches?.filter(pm => pm.platformType === 'opencti').length || 0;
    return octiCount > 0;
  }, []);
  
  // Get selected entities converted to the format expected for preview/import
  const getSelectedEntitiesForPreview = useCallback((): EntityData[] => {
    const selectedEntities = scanResultsEntitiesRef.current.filter(entity => {
      const entityValue = entity.value || entity.name;
      return entityValue && selectedScanItems.has(entityValue) && checkSelectable(entity);
    });
    
    return selectedEntities.map(entity => {
      const octiMatch = entity.platformMatches?.find(pm => pm.platformType === 'opencti');
      const octiEntityId = octiMatch?.entityId;
      return {
        type: entity.type,
        value: entity.value,
        name: entity.name || entity.value,
        existsInPlatform: checkFoundInOpenCTI(entity),
        discoveredByAI: entity.discoveredByAI,
        id: octiEntityId,
        octiEntityId: octiEntityId,
      };
    });
  }, [selectedScanItems, checkSelectable, checkFoundInOpenCTI]);
  
  // Clear scan results
  const clearScanResults = useCallback(() => {
    setScanResultsEntities([]);
    setScanResultsTypeFilter('all');
    setScanResultsFoundFilter('all');
    setSelectedScanItems(new Set());
    setScanPageContent('');
    setEntityFromScanResults(false);
  }, []);
  
  return {
    scanResultsEntities,
    setScanResultsEntities,
    scanResultsEntitiesRef,
    scanResultsTypeFilter,
    setScanResultsTypeFilter,
    scanResultsFoundFilter,
    setScanResultsFoundFilter,
    selectedScanItems,
    setSelectedScanItems,
    scanPageContent,
    setScanPageContent,
    currentPageUrl,
    setCurrentPageUrl,
    currentPageTitle,
    setCurrentPageTitle,
    entityFromScanResults,
    setEntityFromScanResults,
    checkSelectable,
    checkFoundInOpenCTI,
    getSelectedEntitiesForPreview,
    clearScanResults,
  };
}
