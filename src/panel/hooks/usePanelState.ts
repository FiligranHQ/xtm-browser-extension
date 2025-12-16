/**
 * Panel State Hook
 * 
 * Manages all panel state in a centralized hook.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type {
  PanelMode,
  EntityData,
  ContainerData,
  SearchResult,
  PlatformInfo,
  ScanResultEntity,
  ImportResults,
  ContainerFormState,
  ContainerSpecificFields,
  AISettingsState,
  ScenarioOverviewData,
  SelectedInject,
  ScenarioEmail,
  AIGeneratedScenario,
  ResolvedRelationship,
  InvestigationEntity,
  AtomicTestingTarget,
  LabelOption,
  MarkingOption,
  VocabularyOption,
  AuthorOption,
  MultiPlatformResult,
  UnifiedSearchResult,
} from '../types';

export interface PanelStateReturn {
  // Theme
  mode: 'dark' | 'light';
  setMode: (mode: 'dark' | 'light') => void;
  
  // Panel Mode
  panelMode: PanelMode;
  setPanelMode: (mode: PanelMode) => void;
  
  // Entity State
  entity: EntityData | null;
  setEntity: (entity: EntityData | null) => void;
  
  // Search State
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;
  searching: boolean;
  setSearching: (searching: boolean) => void;
  
  // Unified Search State
  unifiedSearchQuery: string;
  setUnifiedSearchQuery: (query: string) => void;
  unifiedSearchResults: UnifiedSearchResult[];
  setUnifiedSearchResults: (results: UnifiedSearchResult[]) => void;
  unifiedSearching: boolean;
  setUnifiedSearching: (searching: boolean) => void;
  unifiedSearchPlatformFilter: 'all' | 'opencti' | 'openaev';
  setUnifiedSearchPlatformFilter: (filter: 'all' | 'opencti' | 'openaev') => void;
  
  // Add Selection State
  addSelectionText: string;
  setAddSelectionText: (text: string) => void;
  
  // Container State
  containerType: string;
  setContainerType: (type: string) => void;
  containerForm: ContainerFormState;
  setContainerForm: (form: ContainerFormState | ((prev: ContainerFormState) => ContainerFormState)) => void;
  entityContainers: ContainerData[];
  setEntityContainers: (containers: ContainerData[]) => void;
  loadingContainers: boolean;
  setLoadingContainers: (loading: boolean) => void;
  
  // Labels & Markings
  selectedLabels: LabelOption[];
  setSelectedLabels: (labels: LabelOption[]) => void;
  selectedMarkings: MarkingOption[];
  setSelectedMarkings: (markings: MarkingOption[]) => void;
  availableLabels: LabelOption[];
  setAvailableLabels: (labels: LabelOption[]) => void;
  availableMarkings: MarkingOption[];
  setAvailableMarkings: (markings: MarkingOption[]) => void;
  
  // Entities to Add
  entitiesToAdd: EntityData[];
  setEntitiesToAdd: (entities: EntityData[] | ((prev: EntityData[]) => EntityData[])) => void;
  
  // Form State
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  
  // Platform State
  platformUrl: string;
  setPlatformUrl: (url: string) => void;
  availablePlatforms: PlatformInfo[];
  setAvailablePlatforms: (platforms: PlatformInfo[] | ((prev: PlatformInfo[]) => PlatformInfo[])) => void;
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  availablePlatformsRef: React.MutableRefObject<PlatformInfo[]>;
  
  // OpenCTI Platforms (computed)
  openctiPlatforms: PlatformInfo[];
  openctiPlatformsRef: React.MutableRefObject<PlatformInfo[]>;
  
  // Multi-platform Results
  multiPlatformResults: MultiPlatformResult[];
  setMultiPlatformResults: (results: MultiPlatformResult[] | ((prev: MultiPlatformResult[]) => MultiPlatformResult[])) => void;
  currentPlatformIndex: number;
  setCurrentPlatformIndex: (index: number) => void;
  multiPlatformResultsRef: React.MutableRefObject<MultiPlatformResult[]>;
  currentPlatformIndexRef: React.MutableRefObject<number>;
  
  // Container Workflow
  containerWorkflowOrigin: 'preview' | 'direct' | 'import' | null;
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  
  // Search Mode Tracking
  entityFromSearchMode: 'search' | 'unified-search' | null;
  setEntityFromSearchMode: (mode: 'search' | 'unified-search' | null) => void;
  entityFromScanResults: boolean;
  setEntityFromScanResults: (from: boolean) => void;
  
  // Scan Results
  scanResultsEntities: ScanResultEntity[];
  setScanResultsEntities: (entities: ScanResultEntity[] | ((prev: ScanResultEntity[]) => ScanResultEntity[])) => void;
  scanResultsEntitiesRef: React.MutableRefObject<ScanResultEntity[]>;
  scanResultsTypeFilter: string;
  setScanResultsTypeFilter: (filter: string) => void;
  scanResultsFoundFilter: 'all' | 'found' | 'not-found' | 'ai-discovered';
  setScanResultsFoundFilter: (filter: 'all' | 'found' | 'not-found' | 'ai-discovered') => void;
  selectedScanItems: Set<string>;
  setSelectedScanItems: (items: Set<string>) => void;
  
  // Container Options
  createIndicators: boolean;
  setCreateIndicators: (create: boolean) => void;
  attachPdf: boolean;
  setAttachPdf: (attach: boolean) => void;
  generatingPdf: boolean;
  setGeneratingPdf: (generating: boolean) => void;
  createAsDraft: boolean;
  setCreateAsDraft: (draft: boolean) => void;
  
  // Page Info
  currentPageUrl: string;
  setCurrentPageUrl: (url: string) => void;
  currentPageTitle: string;
  setCurrentPageTitle: (title: string) => void;
  
  // Existing Containers
  existingContainers: ContainerData[];
  setExistingContainers: (containers: ContainerData[]) => void;
  checkingExisting: boolean;
  setCheckingExisting: (checking: boolean) => void;
  
  // Container Update Mode
  updatingContainerId: string | null;
  setUpdatingContainerId: (id: string | null) => void;
  updatingContainerDates: { published?: string; created?: string } | null;
  setUpdatingContainerDates: (dates: { published?: string; created?: string } | null) => void;
  
  // Import Results
  importResults: ImportResults | null;
  setImportResults: (results: ImportResults | null) => void;
  
  // Container Specific Fields
  containerSpecificFields: ContainerSpecificFields;
  setContainerSpecificFields: (fields: ContainerSpecificFields | ((prev: ContainerSpecificFields) => ContainerSpecificFields)) => void;
  
  // Available Options
  availableReportTypes: VocabularyOption[];
  setAvailableReportTypes: (types: VocabularyOption[]) => void;
  availableContexts: VocabularyOption[];
  setAvailableContexts: (contexts: VocabularyOption[]) => void;
  availableSeverities: VocabularyOption[];
  setAvailableSeverities: (severities: VocabularyOption[]) => void;
  availablePriorities: VocabularyOption[];
  setAvailablePriorities: (priorities: VocabularyOption[]) => void;
  availableResponseTypes: VocabularyOption[];
  setAvailableResponseTypes: (types: VocabularyOption[]) => void;
  availableAuthors: AuthorOption[];
  setAvailableAuthors: (authors: AuthorOption[]) => void;
  
  // AI State
  aiSettings: AISettingsState;
  setAiSettings: (settings: AISettingsState) => void;
  aiGeneratingDescription: boolean;
  setAiGeneratingDescription: (generating: boolean) => void;
  aiSelectingInjects: boolean;
  setAiSelectingInjects: (selecting: boolean) => void;
  aiFillingEmails: boolean;
  setAiFillingEmails: (filling: boolean) => void;
  aiDiscoveringEntities: boolean;
  setAiDiscoveringEntities: (discovering: boolean) => void;
  scanPageContent: string;
  setScanPageContent: (content: string) => void;
  
  // AI Relationships
  aiResolvingRelationships: boolean;
  setAiResolvingRelationships: (resolving: boolean) => void;
  resolvedRelationships: ResolvedRelationship[];
  setResolvedRelationships: (relationships: ResolvedRelationship[]) => void;
  
  // Scenario State
  scenarioOverviewData: ScenarioOverviewData | null;
  setScenarioOverviewData: (data: ScenarioOverviewData | null) => void;
  scenarioForm: { name: string; description: string; subtitle: string; category: string };
  setScenarioForm: (form: { name: string; description: string; subtitle: string; category: string }) => void;
  selectedInjects: SelectedInject[];
  setSelectedInjects: (injects: SelectedInject[]) => void;
  scenarioEmails: ScenarioEmail[];
  setScenarioEmails: (emails: ScenarioEmail[]) => void;
  scenarioLoading: boolean;
  setScenarioLoading: (loading: boolean) => void;
  scenarioStep: 0 | 1 | 2;
  setScenarioStep: (step: 0 | 1 | 2) => void;
  scenarioTypeAffinity: 'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP';
  setScenarioTypeAffinity: (type: 'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP') => void;
  scenarioPlatformsAffinity: string[];
  setScenarioPlatformsAffinity: (platforms: string[]) => void;
  scenarioInjectSpacing: number;
  setScenarioInjectSpacing: (spacing: number) => void;
  scenarioPlatformSelected: boolean;
  setScenarioPlatformSelected: (selected: boolean) => void;
  scenarioPlatformId: string | null;
  setScenarioPlatformId: (id: string | null) => void;
  scenarioRawAttackPatterns: Array<{
    id: string;
    entityId: string;
    name: string;
    externalId?: string;
    description?: string;
    killChainPhases?: string[];
    platformId?: string;
  }>;
  setScenarioRawAttackPatterns: (patterns: Array<{
    id: string;
    entityId: string;
    name: string;
    externalId?: string;
    description?: string;
    killChainPhases?: string[];
    platformId?: string;
  }>) => void;
  scenarioTargetType: 'asset' | 'asset_group';
  setScenarioTargetType: (type: 'asset' | 'asset_group') => void;
  scenarioAssets: unknown[];
  setScenarioAssets: (assets: unknown[]) => void;
  scenarioAssetGroups: unknown[];
  setScenarioAssetGroups: (groups: unknown[]) => void;
  scenarioTeams: unknown[];
  setScenarioTeams: (teams: unknown[]) => void;
  scenarioSelectedAsset: string | null;
  setScenarioSelectedAsset: (id: string | null) => void;
  scenarioSelectedAssetGroup: string | null;
  setScenarioSelectedAssetGroup: (id: string | null) => void;
  scenarioSelectedTeam: string | null;
  setScenarioSelectedTeam: (id: string | null) => void;
  
  // AI Scenario Generation
  scenarioCreating: boolean;
  setScenarioCreating: (creating: boolean) => void;
  scenarioAIMode: boolean;
  setScenarioAIMode: (mode: boolean) => void;
  scenarioAIGenerating: boolean;
  setScenarioAIGenerating: (generating: boolean) => void;
  scenarioAINumberOfInjects: number;
  setScenarioAINumberOfInjects: (num: number) => void;
  scenarioAIPayloadAffinity: string;
  setScenarioAIPayloadAffinity: (affinity: string) => void;
  scenarioAITableTopDuration: number;
  setScenarioAITableTopDuration: (duration: number) => void;
  scenarioAIEmailLanguage: string;
  setScenarioAIEmailLanguage: (lang: string) => void;
  scenarioAIContext: string;
  setScenarioAIContext: (context: string) => void;
  scenarioAIGeneratedScenario: AIGeneratedScenario | null;
  setScenarioAIGeneratedScenario: (scenario: AIGeneratedScenario | null) => void;
  
  // Investigation State
  investigationEntities: InvestigationEntity[];
  setInvestigationEntities: (entities: InvestigationEntity[] | ((prev: InvestigationEntity[]) => InvestigationEntity[])) => void;
  investigationTypeFilter: string;
  setInvestigationTypeFilter: (filter: string) => void;
  investigationScanning: boolean;
  setInvestigationScanning: (scanning: boolean) => void;
  investigationPlatformSelected: boolean;
  setInvestigationPlatformSelected: (selected: boolean) => void;
  investigationPlatformId: string | null;
  setInvestigationPlatformId: (id: string | null) => void;
  
  // Atomic Testing State
  atomicTestingTargets: AtomicTestingTarget[];
  setAtomicTestingTargets: (targets: AtomicTestingTarget[]) => void;
  selectedAtomicTarget: AtomicTestingTarget | null;
  setSelectedAtomicTarget: (target: AtomicTestingTarget | null) => void;
  atomicTestingPlatformSelected: boolean;
  setAtomicTestingPlatformSelected: (selected: boolean) => void;
  atomicTestingPlatformId: string | null;
  setAtomicTestingPlatformId: (id: string | null) => void;
  atomicTestingAssets: unknown[];
  setAtomicTestingAssets: (assets: unknown[]) => void;
  atomicTestingAssetGroups: unknown[];
  setAtomicTestingAssetGroups: (groups: unknown[]) => void;
  atomicTestingInjectorContracts: unknown[];
  setAtomicTestingInjectorContracts: (contracts: unknown[]) => void;
  atomicTestingSelectedAsset: string | null;
  setAtomicTestingSelectedAsset: (id: string | null) => void;
  atomicTestingSelectedAssetGroup: string | null;
  setAtomicTestingSelectedAssetGroup: (id: string | null) => void;
  atomicTestingSelectedContract: string | null;
  setAtomicTestingSelectedContract: (id: string | null) => void;
  atomicTestingTitle: string;
  setAtomicTestingTitle: (title: string) => void;
  atomicTestingShowList: boolean;
  setAtomicTestingShowList: (show: boolean) => void;
  atomicTestingTypeFilter: string;
  setAtomicTestingTypeFilter: (filter: string) => void;
  
  // Lazy Loading Flags
  labelsLoaded: boolean;
  setLabelsLoaded: (loaded: boolean) => void;
  markingsLoaded: boolean;
  setMarkingsLoaded: (loaded: boolean) => void;
  
  // Context Menu Tracking
  addSelectionFromContextMenu: boolean;
  setAddSelectionFromContextMenu: (from: boolean) => void;
  
  // Toast Helper
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => void;
}

/**
 * Custom hook for managing all panel state
 */
export function usePanelState(): PanelStateReturn {
  // Theme
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  
  // Panel Mode
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');
  
  // Entity State
  const [entity, setEntity] = useState<EntityData | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Unified Search State
  const [unifiedSearchQuery, setUnifiedSearchQuery] = useState('');
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<UnifiedSearchResult[]>([]);
  const [unifiedSearching, setUnifiedSearching] = useState(false);
  const [unifiedSearchPlatformFilter, setUnifiedSearchPlatformFilter] = useState<'all' | 'opencti' | 'openaev'>('all');
  
  // Add Selection State
  const [addSelectionText, setAddSelectionText] = useState('');
  
  // Container State
  const [containerType, setContainerType] = useState<string>('');
  const [containerForm, setContainerForm] = useState<ContainerFormState>({
    name: '',
    description: '',
    content: '',
  });
  const [entityContainers, setEntityContainers] = useState<ContainerData[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  
  // Labels & Markings
  const [selectedLabels, setSelectedLabels] = useState<LabelOption[]>([]);
  const [selectedMarkings, setSelectedMarkings] = useState<MarkingOption[]>([]);
  const [availableLabels, setAvailableLabels] = useState<LabelOption[]>([]);
  const [availableMarkings, setAvailableMarkings] = useState<MarkingOption[]>([]);
  
  // Entities to Add
  const [entitiesToAdd, setEntitiesToAdd] = useState<EntityData[]>([]);
  
  // Form State
  const [submitting, setSubmitting] = useState(false);
  
  // Platform State
  const [platformUrl, setPlatformUrl] = useState('');
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformInfo[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  const availablePlatformsRef = useRef<PlatformInfo[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    availablePlatformsRef.current = availablePlatforms;
  }, [availablePlatforms]);
  
  // OpenCTI Platforms (computed)
  const openctiPlatforms = useMemo(() => 
    availablePlatforms.filter(p => p.type === 'opencti'), 
    [availablePlatforms]
  );
  const openctiPlatformsRef = useRef<PlatformInfo[]>([]);
  useEffect(() => {
    openctiPlatformsRef.current = openctiPlatforms;
  }, [openctiPlatforms]);
  
  // Multi-platform Results
  const [multiPlatformResults, setMultiPlatformResults] = useState<MultiPlatformResult[]>([]);
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0);
  const multiPlatformResultsRef = useRef<MultiPlatformResult[]>([]);
  const currentPlatformIndexRef = useRef(0);
  
  // Container Workflow
  const [containerWorkflowOrigin, setContainerWorkflowOrigin] = useState<'preview' | 'direct' | 'import' | null>(null);
  
  // Search Mode Tracking
  const [entityFromSearchMode, setEntityFromSearchMode] = useState<'search' | 'unified-search' | null>(null);
  const [entityFromScanResults, setEntityFromScanResults] = useState(false);
  
  // Scan Results
  const [scanResultsEntities, setScanResultsEntities] = useState<ScanResultEntity[]>([]);
  const scanResultsEntitiesRef = useRef<ScanResultEntity[]>([]);
  useEffect(() => {
    scanResultsEntitiesRef.current = scanResultsEntities;
  }, [scanResultsEntities]);
  const [scanResultsTypeFilter, setScanResultsTypeFilter] = useState<string>('all');
  const [scanResultsFoundFilter, setScanResultsFoundFilter] = useState<'all' | 'found' | 'not-found' | 'ai-discovered'>('all');
  const [selectedScanItems, setSelectedScanItems] = useState<Set<string>>(new Set());
  
  // Container Options
  const [createIndicators, setCreateIndicators] = useState(true);
  const [attachPdf, setAttachPdf] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [createAsDraft, setCreateAsDraft] = useState(false);
  
  // Page Info
  const [currentPageUrl, setCurrentPageUrl] = useState('');
  const [currentPageTitle, setCurrentPageTitle] = useState('');
  
  // Existing Containers
  const [existingContainers, setExistingContainers] = useState<ContainerData[]>([]);
  const [checkingExisting, setCheckingExisting] = useState(false);
  
  // Container Update Mode
  const [updatingContainerId, setUpdatingContainerId] = useState<string | null>(null);
  const [updatingContainerDates, setUpdatingContainerDates] = useState<{
    published?: string;
    created?: string;
  } | null>(null);
  
  // Import Results
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  
  // Container Specific Fields
  const [containerSpecificFields, setContainerSpecificFields] = useState<ContainerSpecificFields>({
    report_types: [],
    context: '',
    severity: '',
    priority: '',
    response_types: [],
    createdBy: '',
  });
  
  // Available Options
  const [availableReportTypes, setAvailableReportTypes] = useState<VocabularyOption[]>([]);
  const [availableContexts, setAvailableContexts] = useState<VocabularyOption[]>([]);
  const [availableSeverities, setAvailableSeverities] = useState<VocabularyOption[]>([]);
  const [availablePriorities, setAvailablePriorities] = useState<VocabularyOption[]>([]);
  const [availableResponseTypes, setAvailableResponseTypes] = useState<VocabularyOption[]>([]);
  const [availableAuthors, setAvailableAuthors] = useState<AuthorOption[]>([]);
  
  // AI State
  const [aiSettings, setAiSettings] = useState<AISettingsState>({ enabled: false, available: false });
  const [aiGeneratingDescription, setAiGeneratingDescription] = useState(false);
  const [aiSelectingInjects, setAiSelectingInjects] = useState(false);
  const [aiFillingEmails, setAiFillingEmails] = useState(false);
  const [aiDiscoveringEntities, setAiDiscoveringEntities] = useState(false);
  const [scanPageContent, setScanPageContent] = useState<string>('');
  
  // AI Relationships
  const [aiResolvingRelationships, setAiResolvingRelationships] = useState(false);
  const [resolvedRelationships, setResolvedRelationships] = useState<ResolvedRelationship[]>([]);
  
  // Scenario State
  const [scenarioOverviewData, setScenarioOverviewData] = useState<ScenarioOverviewData | null>(null);
  const [scenarioForm, setScenarioForm] = useState({
    name: '',
    description: '',
    subtitle: '',
    category: 'attack-scenario',
  });
  const [selectedInjects, setSelectedInjects] = useState<SelectedInject[]>([]);
  const [scenarioEmails, setScenarioEmails] = useState<ScenarioEmail[]>([]);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioStep, setScenarioStep] = useState<0 | 1 | 2>(0);
  const [scenarioTypeAffinity, setScenarioTypeAffinity] = useState<'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP'>('ENDPOINT');
  const [scenarioPlatformsAffinity, setScenarioPlatformsAffinity] = useState<string[]>(['windows', 'linux', 'macos']);
  const [scenarioInjectSpacing, setScenarioInjectSpacing] = useState<number>(1);
  const [scenarioPlatformSelected, setScenarioPlatformSelected] = useState(false);
  const [scenarioPlatformId, setScenarioPlatformId] = useState<string | null>(null);
  const [scenarioRawAttackPatterns, setScenarioRawAttackPatterns] = useState<Array<{
    id: string;
    entityId: string;
    name: string;
    externalId?: string;
    description?: string;
    killChainPhases?: string[];
    platformId?: string;
  }>>([]);
  const [scenarioTargetType, setScenarioTargetType] = useState<'asset' | 'asset_group'>('asset');
  const [scenarioAssets, setScenarioAssets] = useState<unknown[]>([]);
  const [scenarioAssetGroups, setScenarioAssetGroups] = useState<unknown[]>([]);
  const [scenarioTeams, setScenarioTeams] = useState<unknown[]>([]);
  const [scenarioSelectedAsset, setScenarioSelectedAsset] = useState<string | null>(null);
  const [scenarioSelectedAssetGroup, setScenarioSelectedAssetGroup] = useState<string | null>(null);
  const [scenarioSelectedTeam, setScenarioSelectedTeam] = useState<string | null>(null);
  
  // AI Scenario Generation
  const [scenarioCreating, setScenarioCreating] = useState(false);
  const [scenarioAIMode, setScenarioAIMode] = useState(false);
  const [scenarioAIGenerating, setScenarioAIGenerating] = useState(false);
  const [scenarioAINumberOfInjects, setScenarioAINumberOfInjects] = useState<number>(5);
  const [scenarioAIPayloadAffinity, setScenarioAIPayloadAffinity] = useState<string>('powershell');
  const [scenarioAITableTopDuration, setScenarioAITableTopDuration] = useState<number>(60);
  const [scenarioAIEmailLanguage, setScenarioAIEmailLanguage] = useState<string>('english');
  const [scenarioAIContext, setScenarioAIContext] = useState<string>('');
  const [scenarioAIGeneratedScenario, setScenarioAIGeneratedScenario] = useState<AIGeneratedScenario | null>(null);
  
  // Investigation State
  const [investigationEntities, setInvestigationEntities] = useState<InvestigationEntity[]>([]);
  const [investigationTypeFilter, setInvestigationTypeFilter] = useState<string>('all');
  const [investigationScanning, setInvestigationScanning] = useState(false);
  const [investigationPlatformSelected, setInvestigationPlatformSelected] = useState(false);
  const [investigationPlatformId, setInvestigationPlatformId] = useState<string | null>(null);
  
  // Atomic Testing State
  const [atomicTestingTargets, setAtomicTestingTargets] = useState<AtomicTestingTarget[]>([]);
  const [selectedAtomicTarget, setSelectedAtomicTarget] = useState<AtomicTestingTarget | null>(null);
  const [atomicTestingPlatformSelected, setAtomicTestingPlatformSelected] = useState(false);
  const [atomicTestingPlatformId, setAtomicTestingPlatformId] = useState<string | null>(null);
  const [atomicTestingAssets, setAtomicTestingAssets] = useState<unknown[]>([]);
  const [atomicTestingAssetGroups, setAtomicTestingAssetGroups] = useState<unknown[]>([]);
  const [atomicTestingInjectorContracts, setAtomicTestingInjectorContracts] = useState<unknown[]>([]);
  const [atomicTestingSelectedAsset, setAtomicTestingSelectedAsset] = useState<string | null>(null);
  const [atomicTestingSelectedAssetGroup, setAtomicTestingSelectedAssetGroup] = useState<string | null>(null);
  const [atomicTestingSelectedContract, setAtomicTestingSelectedContract] = useState<string | null>(null);
  const [atomicTestingTitle, setAtomicTestingTitle] = useState<string>('');
  const [atomicTestingShowList, setAtomicTestingShowList] = useState<boolean>(true);
  const [atomicTestingTypeFilter, setAtomicTestingTypeFilter] = useState<string>('all');
  
  // Lazy Loading Flags
  const [labelsLoaded, setLabelsLoaded] = useState(false);
  const [markingsLoaded, setMarkingsLoaded] = useState(false);
  
  // Context Menu Tracking
  const [addSelectionFromContextMenu, setAddSelectionFromContextMenu] = useState(false);
  
  // Toast Helper
  const showToast = useCallback((options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => {
    window.parent.postMessage({ type: 'XTM_SHOW_TOAST', payload: options }, '*');
  }, []);

  return {
    // Theme
    mode,
    setMode,
    
    // Panel Mode
    panelMode,
    setPanelMode,
    
    // Entity State
    entity,
    setEntity,
    
    // Search State
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searching,
    setSearching,
    
    // Unified Search
    unifiedSearchQuery,
    setUnifiedSearchQuery,
    unifiedSearchResults,
    setUnifiedSearchResults,
    unifiedSearching,
    setUnifiedSearching,
    unifiedSearchPlatformFilter,
    setUnifiedSearchPlatformFilter,
    
    // Add Selection
    addSelectionText,
    setAddSelectionText,
    
    // Container
    containerType,
    setContainerType,
    containerForm,
    setContainerForm,
    entityContainers,
    setEntityContainers,
    loadingContainers,
    setLoadingContainers,
    
    // Labels & Markings
    selectedLabels,
    setSelectedLabels,
    selectedMarkings,
    setSelectedMarkings,
    availableLabels,
    setAvailableLabels,
    availableMarkings,
    setAvailableMarkings,
    
    // Entities to Add
    entitiesToAdd,
    setEntitiesToAdd,
    
    // Form State
    submitting,
    setSubmitting,
    
    // Platform State
    platformUrl,
    setPlatformUrl,
    availablePlatforms,
    setAvailablePlatforms,
    selectedPlatformId,
    setSelectedPlatformId,
    availablePlatformsRef,
    
    // OpenCTI Platforms
    openctiPlatforms,
    openctiPlatformsRef,
    
    // Multi-platform Results
    multiPlatformResults,
    setMultiPlatformResults,
    currentPlatformIndex,
    setCurrentPlatformIndex,
    multiPlatformResultsRef,
    currentPlatformIndexRef,
    
    // Container Workflow
    containerWorkflowOrigin,
    setContainerWorkflowOrigin,
    
    // Search Mode Tracking
    entityFromSearchMode,
    setEntityFromSearchMode,
    entityFromScanResults,
    setEntityFromScanResults,
    
    // Scan Results
    scanResultsEntities,
    setScanResultsEntities,
    scanResultsEntitiesRef,
    scanResultsTypeFilter,
    setScanResultsTypeFilter,
    scanResultsFoundFilter,
    setScanResultsFoundFilter,
    selectedScanItems,
    setSelectedScanItems,
    
    // Container Options
    createIndicators,
    setCreateIndicators,
    attachPdf,
    setAttachPdf,
    generatingPdf,
    setGeneratingPdf,
    createAsDraft,
    setCreateAsDraft,
    
    // Page Info
    currentPageUrl,
    setCurrentPageUrl,
    currentPageTitle,
    setCurrentPageTitle,
    
    // Existing Containers
    existingContainers,
    setExistingContainers,
    checkingExisting,
    setCheckingExisting,
    
    // Container Update Mode
    updatingContainerId,
    setUpdatingContainerId,
    updatingContainerDates,
    setUpdatingContainerDates,
    
    // Import Results
    importResults,
    setImportResults,
    
    // Container Specific Fields
    containerSpecificFields,
    setContainerSpecificFields,
    
    // Available Options
    availableReportTypes,
    setAvailableReportTypes,
    availableContexts,
    setAvailableContexts,
    availableSeverities,
    setAvailableSeverities,
    availablePriorities,
    setAvailablePriorities,
    availableResponseTypes,
    setAvailableResponseTypes,
    availableAuthors,
    setAvailableAuthors,
    
    // AI State
    aiSettings,
    setAiSettings,
    aiGeneratingDescription,
    setAiGeneratingDescription,
    aiSelectingInjects,
    setAiSelectingInjects,
    aiFillingEmails,
    setAiFillingEmails,
    aiDiscoveringEntities,
    setAiDiscoveringEntities,
    scanPageContent,
    setScanPageContent,
    
    // AI Relationships
    aiResolvingRelationships,
    setAiResolvingRelationships,
    resolvedRelationships,
    setResolvedRelationships,
    
    // Scenario State
    scenarioOverviewData,
    setScenarioOverviewData,
    scenarioForm,
    setScenarioForm,
    selectedInjects,
    setSelectedInjects,
    scenarioEmails,
    setScenarioEmails,
    scenarioLoading,
    setScenarioLoading,
    scenarioStep,
    setScenarioStep,
    scenarioTypeAffinity,
    setScenarioTypeAffinity,
    scenarioPlatformsAffinity,
    setScenarioPlatformsAffinity,
    scenarioInjectSpacing,
    setScenarioInjectSpacing,
    scenarioPlatformSelected,
    setScenarioPlatformSelected,
    scenarioPlatformId,
    setScenarioPlatformId,
    scenarioRawAttackPatterns,
    setScenarioRawAttackPatterns,
    scenarioTargetType,
    setScenarioTargetType,
    scenarioAssets,
    setScenarioAssets,
    scenarioAssetGroups,
    setScenarioAssetGroups,
    scenarioTeams,
    setScenarioTeams,
    scenarioSelectedAsset,
    setScenarioSelectedAsset,
    scenarioSelectedAssetGroup,
    setScenarioSelectedAssetGroup,
    scenarioSelectedTeam,
    setScenarioSelectedTeam,
    
    // AI Scenario Generation
    scenarioCreating,
    setScenarioCreating,
    scenarioAIMode,
    setScenarioAIMode,
    scenarioAIGenerating,
    setScenarioAIGenerating,
    scenarioAINumberOfInjects,
    setScenarioAINumberOfInjects,
    scenarioAIPayloadAffinity,
    setScenarioAIPayloadAffinity,
    scenarioAITableTopDuration,
    setScenarioAITableTopDuration,
    scenarioAIEmailLanguage,
    setScenarioAIEmailLanguage,
    scenarioAIContext,
    setScenarioAIContext,
    scenarioAIGeneratedScenario,
    setScenarioAIGeneratedScenario,
    
    // Investigation State
    investigationEntities,
    setInvestigationEntities,
    investigationTypeFilter,
    setInvestigationTypeFilter,
    investigationScanning,
    setInvestigationScanning,
    investigationPlatformSelected,
    setInvestigationPlatformSelected,
    investigationPlatformId,
    setInvestigationPlatformId,
    
    // Atomic Testing State
    atomicTestingTargets,
    setAtomicTestingTargets,
    selectedAtomicTarget,
    setSelectedAtomicTarget,
    atomicTestingPlatformSelected,
    setAtomicTestingPlatformSelected,
    atomicTestingPlatformId,
    setAtomicTestingPlatformId,
    atomicTestingAssets,
    setAtomicTestingAssets,
    atomicTestingAssetGroups,
    setAtomicTestingAssetGroups,
    atomicTestingInjectorContracts,
    setAtomicTestingInjectorContracts,
    atomicTestingSelectedAsset,
    setAtomicTestingSelectedAsset,
    atomicTestingSelectedAssetGroup,
    setAtomicTestingSelectedAssetGroup,
    atomicTestingSelectedContract,
    setAtomicTestingSelectedContract,
    atomicTestingTitle,
    setAtomicTestingTitle,
    atomicTestingShowList,
    setAtomicTestingShowList,
    atomicTestingTypeFilter,
    setAtomicTestingTypeFilter,
    
    // Lazy Loading Flags
    labelsLoaded,
    setLabelsLoaded,
    markingsLoaded,
    setMarkingsLoaded,
    
    // Context Menu Tracking
    addSelectionFromContextMenu,
    setAddSelectionFromContextMenu,
    
    // Toast Helper
    showToast,
  };
}

