/**
 * App Context
 * 
 * Provides shared state and handlers to all panel view components.
 * This allows us to extract view components without prop drilling.
 */

import React, { createContext, useContext } from 'react';
import type {
  PanelMode,
  EntityData,
  ContainerData,
  PlatformInfo,
  ScanResultEntity,
  ImportResults,
  UnifiedSearchResult,
} from '../types';

export interface AppContextValue {
  // Theme
  mode: 'dark' | 'light';
  setMode: (mode: 'dark' | 'light') => void;
  
  // Panel mode
  panelMode: PanelMode;
  setPanelMode: (mode: PanelMode) => void;
  
  // Entity state
  entity: EntityData | null;
  setEntity: (entity: EntityData | null) => void;
  
  // Platform state
  platformUrl: string;
  setPlatformUrl: (url: string) => void;
  availablePlatforms: PlatformInfo[];
  setAvailablePlatforms: (platforms: PlatformInfo[]) => void;
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  openctiPlatforms: PlatformInfo[];
  
  // Multi-platform
  multiPlatformResults: Array<{ platformId: string; platformName: string; entity: EntityData }>;
  setMultiPlatformResults: (results: Array<{ platformId: string; platformName: string; entity: EntityData }>) => void;
  currentPlatformIndex: number;
  setCurrentPlatformIndex: (index: number) => void;
  multiPlatformResultsRef: React.MutableRefObject<Array<{ platformId: string; platformName: string; entity: EntityData }>>;
  currentPlatformIndexRef: React.MutableRefObject<number>;
  
  // Search state (unified - searches both platforms)
  unifiedSearchQuery: string;
  setUnifiedSearchQuery: (query: string) => void;
  unifiedSearchResults: UnifiedSearchResult[];
  setUnifiedSearchResults: (results: UnifiedSearchResult[]) => void;
  unifiedSearching: boolean;
  setUnifiedSearching: (searching: boolean) => void;
  unifiedSearchPlatformFilter: 'all' | 'opencti' | 'openaev';
  setUnifiedSearchPlatformFilter: (filter: 'all' | 'opencti' | 'openaev') => void;
  
  // Scan results
  scanResultsEntities: ScanResultEntity[];
  setScanResultsEntities: React.Dispatch<React.SetStateAction<ScanResultEntity[]>>;
  scanResultsEntitiesRef: React.MutableRefObject<ScanResultEntity[]>;
  scanResultsTypeFilter: string;
  setScanResultsTypeFilter: (filter: string) => void;
  scanResultsFoundFilter: 'all' | 'found' | 'not-found' | 'ai-discovered';
  setScanResultsFoundFilter: (filter: 'all' | 'found' | 'not-found' | 'ai-discovered') => void;
  selectedScanItems: Set<string>;
  setSelectedScanItems: (items: Set<string>) => void;
  entityFromScanResults: boolean;
  setEntityFromScanResults: (fromScan: boolean) => void;
  
  // Container state
  containerType: string;
  setOCTIContainerType: (type: string) => void;
  containerForm: { name: string; description: string; content: string };
  setContainerForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; content: string }>>;
  entityContainers: ContainerData[];
  setEntityContainers: (containers: ContainerData[]) => void;
  loadingContainers: boolean;
  setLoadingContainers: (loading: boolean) => void;
  entitiesToAdd: EntityData[];
  setEntitiesToAdd: React.Dispatch<React.SetStateAction<EntityData[]>>;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  containerWorkflowOrigin: 'preview' | 'direct' | 'import' | null;
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  
  // Import results
  importResults: ImportResults | null;
  setImportResults: (results: ImportResults | null) => void;
  
  // Page info
  currentPageUrl: string;
  setCurrentPageUrl: (url: string) => void;
  currentPageTitle: string;
  setCurrentPageTitle: (title: string) => void;
  
  // Entity navigation
  entityFromSearchMode: 'unified-search' | null;
  setEntityFromSearchMode: (mode: 'unified-search' | null) => void;
  
  // PDF and indicators
  createIndicators: boolean;
  setCreateIndicators: (create: boolean) => void;
  attachPdf: boolean;
  setAttachPdf: (attach: boolean) => void;
  
  // AI settings
  aiSettings: { enabled: boolean; provider?: string; available: boolean };
  setAiSettings: React.Dispatch<React.SetStateAction<{ enabled: boolean; provider?: string; available: boolean }>>;
  aiDiscoveringEntities: boolean;
  setAiDiscoveringEntities: (discovering: boolean) => void;
  aiGeneratingDescription: boolean;
  setAiGeneratingDescription: (generating: boolean) => void;
  
  // Handlers
  handleClose: () => void;
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => void;
  handleSearch: (query?: string) => void;
  handleUnifiedSearch: (query?: string) => void;
  fetchEntityContainers: (entityId: string, platformId?: string) => void;
  loadLabelsAndMarkings: (platformId?: string) => void;
  generateDescription: (pageTitle: string, pageUrl: string, existingContent?: string) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppContextProvider = AppContext.Provider;

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
}

