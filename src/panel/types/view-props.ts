/**
 * Panel View Props
 * 
 * Common prop interfaces shared across panel views.
 * This allows views to be extracted into separate components while maintaining
 * type safety and consistent state management.
 */

import type {
  PanelMode,
  EntityData,
  ContainerData,
  PlatformInfo,
  ScanResultEntity,
  ImportResults,
  ContainerFormState,
  ContainerSpecificFields,
  AISettings,
  ScenarioOverviewData,
  SelectedInject,
  ScenarioEmail,
  ResolvedRelationship,
  MultiPlatformResult,
  UnifiedSearchResult,
} from '../types';

/**
 * Label option for autocomplete
 */
export interface LabelOption {
  id: string;
  value: string;
  color: string;
}

/**
 * Marking option for autocomplete
 */
export interface MarkingOption {
  id: string;
  definition: string;
}

/**
 * Vocabulary option for dropdowns
 */
export interface VocabularyOption {
  id: string;
  name: string;
}

/**
 * Author option for autocomplete
 */
export interface AuthorOption {
  id: string;
  name: string;
  entity_type: string;
}

/**
 * Common props shared by most views
 */
export interface BaseViewProps {
  /** Current theme mode */
  mode: 'dark' | 'light';
  /** Callback to close the panel */
  handleClose: () => void;
  /** Show toast notification */
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => void;
}

/**
 * Props for platform-related functionality
 */
export interface PlatformViewProps {
  /** All available platforms */
  availablePlatforms: PlatformInfo[];
  /** OpenCTI platforms only */
  openctiPlatforms: PlatformInfo[];
  /** OpenAEV platforms only */
  openaevPlatforms: PlatformInfo[];
  /** Currently selected platform ID */
  selectedPlatformId: string;
  /** Set selected platform ID */
  setSelectedPlatformId: (id: string) => void;
  /** Current platform URL */
  platformUrl: string;
  /** Set platform URL */
  setPlatformUrl: (url: string) => void;
}

/**
 * Props for entity display views
 */
export interface EntityViewProps extends BaseViewProps, PlatformViewProps {
  /** Current entity being displayed */
  entity: EntityData | null;
  /** Set current entity */
  setEntity: (entity: EntityData | null) => void;
  /** Multi-platform results for the current entity */
  multiPlatformResults: MultiPlatformResult[];
  /** Set multi-platform results */
  setMultiPlatformResults: (results: MultiPlatformResult[]) => void;
  /** Current platform index in multi-platform navigation */
  currentPlatformIndex: number;
  /** Set current platform index */
  setCurrentPlatformIndex: (index: number) => void;
  /** Ref for current platform index */
  currentPlatformIndexRef: React.MutableRefObject<number>;
  /** Ref for multi-platform results */
  multiPlatformResultsRef: React.MutableRefObject<MultiPlatformResult[]>;
  /** Whether entity view came from search */
  entityFromSearchMode: 'unified-search' | null;
  /** Set search mode origin */
  setEntityFromSearchMode: (mode: 'unified-search' | null) => void;
  /** Whether entity view came from scan results */
  entityFromScanResults: boolean;
  /** Set scan results origin */
  setEntityFromScanResults: (fromScan: boolean) => void;
  /** Set panel mode */
  setPanelMode: (mode: PanelMode) => void;
  /** Logo suffix based on theme */
  logoSuffix: string;
  /** Entity containers */
  entityContainers: ContainerData[];
  /** Loading containers state */
  loadingContainers: boolean;
  /** Fetch containers for entity */
  fetchEntityContainers: (entityId: string, platformId?: string) => void;
}

/**
 * Props for scan results view
 */
export interface ScanResultsViewProps extends BaseViewProps, PlatformViewProps {
  /** Scanned entities */
  scanResultsEntities: ScanResultEntity[];
  /** Set scanned entities */
  setScanResultsEntities: (entities: ScanResultEntity[] | ((prev: ScanResultEntity[]) => ScanResultEntity[])) => void;
  /** Ref for scan results */
  scanResultsEntitiesRef: React.MutableRefObject<ScanResultEntity[]>;
  /** Type filter for scan results */
  scanResultsTypeFilter: string;
  /** Set type filter */
  setScanResultsTypeFilter: (filter: string) => void;
  /** Found/not-found filter */
  scanResultsFoundFilter: 'all' | 'found' | 'not-found' | 'ai-discovered';
  /** Set found filter */
  setScanResultsFoundFilter: (filter: 'all' | 'found' | 'not-found' | 'ai-discovered') => void;
  /** Selected items for import */
  selectedScanItems: Set<string>;
  /** Set selected items */
  setSelectedScanItems: (items: Set<string>) => void;
  /** Set panel mode */
  setPanelMode: (mode: PanelMode) => void;
  /** Entities to add to container */
  entitiesToAdd: EntityData[];
  /** Set entities to add */
  setEntitiesToAdd: (entities: EntityData[] | ((prev: EntityData[]) => EntityData[])) => void;
  /** Container workflow origin */
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  /** Set entity for viewing */
  setEntity: (entity: EntityData | null) => void;
  /** Set multi-platform results */
  setMultiPlatformResults: (results: MultiPlatformResult[]) => void;
  /** Set current platform index */
  setCurrentPlatformIndex: (index: number) => void;
  /** Set entity from scan results flag */
  setEntityFromScanResults: (fromScan: boolean) => void;
  /** Refs for platform index */
  currentPlatformIndexRef: React.MutableRefObject<number>;
  multiPlatformResultsRef: React.MutableRefObject<MultiPlatformResult[]>;
  /** AI settings */
  aiSettings: AISettings;
  /** AI discovering entities state */
  aiDiscoveringEntities: boolean;
  /** Set AI discovering entities */
  setAiDiscoveringEntities: (discovering: boolean) => void;
  /** Scan page content for AI */
  scanPageContent: string;
}

/**
 * Props for search view (unified - searches both OpenCTI and OpenAEV)
 */
export interface UnifiedSearchViewProps extends BaseViewProps, PlatformViewProps {
  /** Search query */
  unifiedSearchQuery: string;
  /** Set search query */
  setUnifiedSearchQuery: (query: string) => void;
  /** Search results */
  unifiedSearchResults: UnifiedSearchResult[];
  /** Set search results */
  setUnifiedSearchResults: (results: UnifiedSearchResult[]) => void;
  /** Searching state */
  unifiedSearching: boolean;
  /** Set searching state */
  setUnifiedSearching: (searching: boolean) => void;
  /** Platform filter for search */
  unifiedSearchPlatformFilter: 'all' | 'opencti' | 'openaev';
  /** Set platform filter */
  setUnifiedSearchPlatformFilter: (filter: 'all' | 'opencti' | 'openaev') => void;
  /** Set panel mode */
  setPanelMode: (mode: PanelMode) => void;
  /** Set entity for viewing */
  setEntity: (entity: EntityData | null) => void;
  /** Set entity from search mode */
  setEntityFromSearchMode: (mode: 'unified-search' | null) => void;
  /** Set multi-platform results */
  setMultiPlatformResults: (results: MultiPlatformResult[]) => void;
  /** Set current platform index */
  setCurrentPlatformIndex: (index: number) => void;
  /** Refs */
  currentPlatformIndexRef: React.MutableRefObject<number>;
  multiPlatformResultsRef: React.MutableRefObject<MultiPlatformResult[]>;
}

/**
 * Props for container form view
 */
export interface ContainerFormViewProps extends BaseViewProps, PlatformViewProps {
  /** Container type being created */
  containerType: string;
  /** Set container type */
  setContainerType: (type: string) => void;
  /** Container form data */
  containerForm: ContainerFormState;
  /** Set container form data */
  setContainerForm: (form: ContainerFormState | ((prev: ContainerFormState) => ContainerFormState)) => void;
  /** Selected labels */
  selectedLabels: LabelOption[];
  /** Set selected labels */
  setSelectedLabels: (labels: LabelOption[]) => void;
  /** Selected markings */
  selectedMarkings: MarkingOption[];
  /** Set selected markings */
  setSelectedMarkings: (markings: MarkingOption[]) => void;
  /** Available labels */
  availableLabels: LabelOption[];
  /** Available markings */
  availableMarkings: MarkingOption[];
  /** Entities to add to container */
  entitiesToAdd: EntityData[];
  /** Submitting state */
  submitting: boolean;
  /** Set submitting state */
  setSubmitting: (submitting: boolean) => void;
  /** Set panel mode */
  setPanelMode: (mode: PanelMode) => void;
  /** Container specific fields */
  containerSpecificFields: ContainerSpecificFields;
  /** Set container specific fields */
  setContainerSpecificFields: (fields: ContainerSpecificFields | ((prev: ContainerSpecificFields) => ContainerSpecificFields)) => void;
  /** Available vocabulary options */
  availableReportTypes: VocabularyOption[];
  availableContexts: VocabularyOption[];
  availableSeverities: VocabularyOption[];
  availablePriorities: VocabularyOption[];
  availableResponseTypes: VocabularyOption[];
  availableAuthors: AuthorOption[];
  /** PDF options */
  attachPdf: boolean;
  setAttachPdf: (attach: boolean) => void;
  generatingPdf: boolean;
  setGeneratingPdf: (generating: boolean) => void;
  /** Draft option */
  createAsDraft: boolean;
  setCreateAsDraft: (draft: boolean) => void;
  /** Create indicators option */
  createIndicators: boolean;
  setCreateIndicators: (create: boolean) => void;
  /** Page info */
  currentPageUrl: string;
  currentPageTitle: string;
  /** Update mode */
  updatingContainerId: string | null;
  updatingContainerDates: { published?: string; created?: string } | null;
  /** AI settings */
  aiSettings: AISettings;
  aiGeneratingDescription: boolean;
  setAiGeneratingDescription: (generating: boolean) => void;
  /** Relationships */
  resolvedRelationships: ResolvedRelationship[];
  setResolvedRelationships: (relationships: ResolvedRelationship[]) => void;
  /** Import results */
  setImportResults: (results: ImportResults | null) => void;
  /** Container steps for stepper */
  containerSteps: string[];
}

/**
 * Props for scenario views
 */
export interface ScenarioViewProps extends BaseViewProps, PlatformViewProps {
  /** Scenario overview data */
  scenarioOverviewData: ScenarioOverviewData | null;
  /** Set scenario overview data */
  setScenarioOverviewData: (data: ScenarioOverviewData | null) => void;
  /** Scenario form data */
  scenarioForm: { name: string; description: string; subtitle: string; category: string };
  /** Set scenario form data */
  setScenarioForm: (form: { name: string; description: string; subtitle: string; category: string } | ((prev: { name: string; description: string; subtitle: string; category: string }) => { name: string; description: string; subtitle: string; category: string })) => void;
  /** Selected injects */
  selectedInjects: SelectedInject[];
  /** Set selected injects */
  setSelectedInjects: (injects: SelectedInject[]) => void;
  /** Scenario emails */
  scenarioEmails: ScenarioEmail[];
  /** Set scenario emails */
  setScenarioEmails: (emails: ScenarioEmail[]) => void;
  /** Scenario step */
  scenarioStep: 0 | 1 | 2;
  /** Set scenario step */
  setScenarioStep: (step: 0 | 1 | 2) => void;
  /** Scenario type affinity */
  scenarioTypeAffinity: 'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP';
  /** Set scenario type affinity */
  setScenarioTypeAffinity: (type: 'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP') => void;
  /** Scenario platforms affinity */
  scenarioPlatformsAffinity: string[];
  /** Set scenario platforms affinity */
  setScenarioPlatformsAffinity: (platforms: string[]) => void;
  /** Submitting state */
  submitting: boolean;
  /** Set submitting state */
  setSubmitting: (submitting: boolean) => void;
  /** Set panel mode */
  setPanelMode: (mode: PanelMode) => void;
  /** AI settings */
  aiSettings: AISettings;
  /** AI filling emails state */
  aiFillingEmails: boolean;
  /** Set AI filling emails */
  setAiFillingEmails: (filling: boolean) => void;
  /** AI selecting injects state */
  aiSelectingInjects: boolean;
  /** Set AI selecting injects */
  setAiSelectingInjects: (selecting: boolean) => void;
  /** Page info */
  currentPageUrl: string;
  currentPageTitle: string;
  /** Scenario creation state */
  scenarioCreating: boolean;
  setScenarioCreating: (creating: boolean) => void;
  /** Inject spacing */
  scenarioInjectSpacing: number;
  setScenarioInjectSpacing: (spacing: number) => void;
  /** Platform selection */
  scenarioPlatformSelected: boolean;
  setScenarioPlatformSelected: (selected: boolean) => void;
  scenarioPlatformId: string | null;
  setScenarioPlatformId: (id: string | null) => void;
  /** Target selection */
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
  /** AI email language */
  scenarioAIEmailLanguage: string;
  setScenarioAIEmailLanguage: (language: string) => void;
}

/**
 * Props for preview view (import selection)
 */
export interface PreviewViewProps extends BaseViewProps, PlatformViewProps {
  /** Entities to add */
  entitiesToAdd: EntityData[];
  /** Set entities to add */
  setEntitiesToAdd: (entities: EntityData[] | ((prev: EntityData[]) => EntityData[])) => void;
  /** Set panel mode */
  setPanelMode: (mode: PanelMode) => void;
  /** Set container workflow origin */
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  /** Create indicators option */
  createIndicators: boolean;
  /** Set create indicators */
  setCreateIndicators: (create: boolean) => void;
  /** AI settings */
  aiSettings: AISettings;
  /** AI resolving relationships */
  aiResolvingRelationships: boolean;
  /** Set AI resolving relationships */
  setAiResolvingRelationships: (resolving: boolean) => void;
  /** Resolved relationships */
  resolvedRelationships: ResolvedRelationship[];
  /** Set resolved relationships */
  setResolvedRelationships: (relationships: ResolvedRelationship[]) => void;
  /** Scan page content for AI */
  scanPageContent: string;
  /** Page info */
  currentPageUrl: string;
  currentPageTitle: string;
  /** Set selected scan items */
  setSelectedScanItems: (items: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  /** Import results */
  setImportResults: (results: ImportResults | null) => void;
  /** Submitting state */
  submitting: boolean;
  /** Set submitting state */
  setSubmitting: (submitting: boolean) => void;
}

