/**
 * Panel Message Handlers
 * 
 * Handles processing of panel messages from the content script.
 */

import { loggers } from '../../shared/utils/logger';
import { cleanHtmlContent, generateDescription } from '../utils';
import { SCENARIO_DEFAULT_VALUES, type OAEVAsset, type OAEVAssetGroup, type OAEVTeam, type OAEVInjectorContract, type PlatformConfig } from '../../shared/types';
import { parsePrefixedType } from '../../shared/platform';
import { processScanResults } from './scan-results-handler';
import type { 
  EntityData, 
  PlatformInfo, 
  PanelMode, 
  ContainerData,
  ScanResultEntity,
  UnifiedSearchResult,
  AtomicTestingTarget,
  InvestigationEntity,
  ScenarioOverviewData,
  ScenarioFormData,
  SelectedInject,
  AIGeneratedScenario,
} from '../types';
import type { MultiPlatformResult } from '../hooks/useEntityState';

const log = loggers.panel;

/** Attack pattern data from scan results */
interface AttackPatternData {
  id?: string;
  entityId?: string;
  name?: string;
  externalId?: string;
  description?: string;
  killChainPhases?: string[];
  platformId?: string;
}

/** Payload for showing preview */
interface ShowPreviewPayload {
  entities?: EntityData[];
  pageUrl?: string;
  pageTitle?: string;
  pageDescription?: string;
  pageContent?: string;
  pageHtmlContent?: string;
}

/** Payload for showing entity */
interface ShowEntityPayload extends EntityData {
  entityData?: EntityData;
  entityId?: string;
  platformMatches?: Array<{
    platformId: string;
    platformType?: string;
    entityId: string;
    entityData?: EntityData;
    type?: string;
  }>;
}

/** Payload for atomic testing select */
interface AtomicTestingSelectPayload extends AtomicTestingTarget {
  entityId?: string;
}

/** Payload for scenario */
interface ScenarioPayload {
  attackPatterns?: AttackPatternData[];
  pageTitle?: string;
  pageUrl?: string;
  pageDescription?: string;
  theme?: 'dark' | 'light';
}

/** Settings response from background */
interface SettingsResponse {
  success: boolean;
  data?: {
    openctiPlatforms?: PlatformConfig[];
    openaevPlatforms?: PlatformConfig[];
  };
}

/** Chrome message response */
interface ChromeMessageResponse<T = unknown> {
  success: boolean;
  data?: T;
}

export interface MessageHandlerContext {
  // Mode and theme
  mode: 'dark' | 'light';
  setMode: (mode: 'dark' | 'light') => void;
  setPanelMode: (mode: PanelMode) => void;
  
  // Entity state
  setEntity: React.Dispatch<React.SetStateAction<EntityData | null>>;
  setEntityContainers: (containers: ContainerData[]) => void;
  setEntityFromSearchMode: (mode: 'unified-search' | null) => void;
  setEntityFromScanResults: (from: boolean) => void;
  clearEntityState: () => void;
  
  // Multi-platform
  availablePlatforms: PlatformInfo[];
  availablePlatformsRef: React.MutableRefObject<PlatformInfo[]>;
  setMultiPlatformResults: React.Dispatch<React.SetStateAction<MultiPlatformResult[]>>;
  updateMultiPlatformResultsRef: (results: MultiPlatformResult[]) => void;
  setCurrentPlatformIndex: React.Dispatch<React.SetStateAction<number>>;
  updateCurrentPlatformIndexRef: (index: number) => void;
  currentPlatformIndexRef: React.MutableRefObject<number>;
  multiPlatformResultsRef: React.MutableRefObject<MultiPlatformResult[]>;
  sortPlatformResults: (results: MultiPlatformResult[], platforms: PlatformInfo[]) => MultiPlatformResult[];
  
  // Platform selection
  setPlatformUrl: (url: string) => void;
  setSelectedPlatformId: (id: string) => void;
  openctiPlatforms: PlatformInfo[];
  openctiPlatformsRef: React.MutableRefObject<PlatformInfo[]>;
  setAvailablePlatforms: React.Dispatch<React.SetStateAction<PlatformInfo[]>>;
  
  // Scan results
  scanResultsEntitiesRef: React.MutableRefObject<ScanResultEntity[]>;
  setScanResultsEntities: React.Dispatch<React.SetStateAction<ScanResultEntity[]>>;
  setScanResultsTypeFilter: (filter: string) => void;
  setScanResultsFoundFilter: (filter: 'all' | 'found' | 'not-found' | 'ai-discovered') => void;
  setSelectedScanItems: React.Dispatch<React.SetStateAction<Set<string>>>;
  setScanPageContent: (content: string) => void;
  setCurrentPageUrl: (url: string) => void;
  setCurrentPageTitle: (title: string) => void;
  currentPageUrl: string;
  currentPageTitle: string;
  
  // Container state
  setEntitiesToAdd: React.Dispatch<React.SetStateAction<EntityData[]>>;
  setContainerForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; content: string }>>;
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  setExistingContainers: (containers: ContainerData[]) => void;
  setCheckingExisting: (checking: boolean) => void;
  
  // Search
  setUnifiedSearchQuery: (query: string) => void;
  setUnifiedSearchResults: (results: UnifiedSearchResult[]) => void;
  doUnifiedSearch: (query?: string) => Promise<void>;
  
  // Add selection
  setAddSelectionText: (text: string) => void;
  setAddSelectionFromContextMenu: (from: boolean) => void;
  
  // Investigation
  setInvestigationEntities: React.Dispatch<React.SetStateAction<InvestigationEntity[]>>;
  setInvestigationTypeFilter: (filter: string) => void;
  setInvestigationPlatformSelected: (selected: boolean) => void;
  setInvestigationPlatformId: (id: string | null) => void;
  setInvestigationScanning: (scanning: boolean) => void;
  handleInvestigationScan: (platformId?: string) => Promise<void>;
  
  // Atomic testing
  setAtomicTestingTargets: (targets: AtomicTestingTarget[]) => void;
  setSelectedAtomicTarget: (target: AtomicTestingTarget | null) => void;
  setAtomicTestingShowList: (show: boolean) => void;
  setAtomicTestingPlatformSelected: (selected: boolean) => void;
  setAtomicTestingPlatformId: (id: string | null) => void;
  setAtomicTestingAssets: (assets: OAEVAsset[]) => void;
  setAtomicTestingAssetGroups: (groups: OAEVAssetGroup[]) => void;
  setAtomicTestingInjectorContracts: (contracts: OAEVInjectorContract[]) => void;
  setAtomicTestingSelectedAsset: (asset: OAEVAsset | null) => void;
  setAtomicTestingSelectedAssetGroup: (group: OAEVAssetGroup | null) => void;
  setAtomicTestingSelectedContract: (contract: OAEVInjectorContract | null) => void;
  setAtomicTestingTitle: (title: string) => void;
  setAtomicTestingTypeFilter: (filter: string) => void;
  atomicTestingPlatformId: string | null;
  
  // Scenario
  setScenarioOverviewData: (data: ScenarioOverviewData | null) => void;
  setScenarioForm: (form: ScenarioFormData) => void;
  setSelectedInjects: (injects: SelectedInject[]) => void;
  setScenarioLoading: (loading: boolean) => void;
  setScenarioStep: (step: number) => void;
  setScenarioTypeAffinity: (affinity: string) => void;
  setScenarioPlatformsAffinity: (affinities: string[]) => void;
  setScenarioPlatformSelected: (selected: boolean) => void;
  setScenarioPlatformId: (id: string | null) => void;
  setScenarioRawAttackPatterns: (patterns: AttackPatternData[]) => void;
  setScenarioAssets: (assets: OAEVAsset[]) => void;
  setScenarioAssetGroups: (groups: OAEVAssetGroup[]) => void;
  setScenarioTeams: (teams: OAEVTeam[]) => void;
  setScenarioSelectedAsset: (asset: OAEVAsset | null) => void;
  setScenarioSelectedAssetGroup: (group: OAEVAssetGroup | null) => void;
  setScenarioSelectedTeam: (team: OAEVTeam | null) => void;
  setScenarioAIMode: (mode: boolean) => void;
  setScenarioAIGenerating: (generating: boolean) => void;
  setScenarioAINumberOfInjects: (count: number) => void;
  setScenarioAIPayloadAffinity: (affinity: string) => void;
  setScenarioAITableTopDuration: (duration: number) => void;
  setScenarioAIEmailLanguage: (language: string) => void;
  setScenarioAIContext: (context: string) => void;
  setScenarioAIGeneratedScenario: (scenario: AIGeneratedScenario | null) => void;
  
  // Entity containers
  fetchEntityContainers: (entityId: string, platformId?: string) => Promise<void>;
}

export function handleShowPreview(ctx: MessageHandlerContext, payload: ShowPreviewPayload | undefined) {
  ctx.setEntitiesToAdd(payload?.entities || []);
  ctx.setCurrentPageUrl(payload?.pageUrl || '');
  ctx.setCurrentPageTitle(payload?.pageTitle || '');
  const previewDescription = payload?.pageDescription || generateDescription(payload?.pageContent || '');
  const previewContent = payload?.pageHtmlContent || payload?.pageContent || '';
  ctx.setContainerForm({ name: payload?.pageTitle || '', description: previewDescription, content: cleanHtmlContent(previewContent) });
  ctx.setPanelMode('preview');
}

export async function handleShowContainer(ctx: MessageHandlerContext, payload: ShowPreviewPayload | undefined) {
  const pageContent = payload?.pageContent || '';
  const pageHtmlContent = payload?.pageHtmlContent || pageContent;
  const pageUrl = payload?.pageUrl || '';
  const pageTitle = payload?.pageTitle || '';
  const containerDescription = payload?.pageDescription || generateDescription(pageContent);
  
  ctx.setContainerForm({ name: pageTitle, description: containerDescription, content: cleanHtmlContent(pageHtmlContent) });
  ctx.setEntitiesToAdd(payload?.entities || []);
  ctx.setCurrentPageUrl(pageUrl);
  ctx.setCurrentPageTitle(pageTitle);
  ctx.setContainerWorkflowOrigin('direct');
  ctx.setExistingContainers([]);
  
  const goToNextStep = () => {
    const platforms = ctx.openctiPlatformsRef.current;
    if (platforms.length > 1) {
      ctx.setPanelMode('platform-select');
    } else {
      if (platforms.length === 1) {
        ctx.setSelectedPlatformId(platforms[0].id);
        ctx.setPlatformUrl(platforms[0].url);
      }
      ctx.setPanelMode('container-type');
    }
  };
  
  if (pageUrl && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    ctx.setCheckingExisting(true);
    ctx.setPanelMode('loading');
    
    chrome.runtime.sendMessage({ type: 'FIND_CONTAINERS_BY_URL', payload: { url: pageUrl } }, (response) => {
      ctx.setCheckingExisting(false);
      if (chrome.runtime.lastError) { goToNextStep(); return; }
      if (response?.success && response.data?.length > 0) {
        ctx.setExistingContainers(response.data);
        ctx.setPanelMode('existing-containers');
      } else {
        goToNextStep();
      }
    });
  } else {
    goToNextStep();
  }
}

export function handleShowInvestigation(ctx: MessageHandlerContext) {
  ctx.setInvestigationEntities([]);
  ctx.setInvestigationTypeFilter('all');
  const platforms = ctx.openctiPlatformsRef.current;
  if (platforms.length <= 1) {
    const singlePlatformId = platforms[0]?.id || null;
    ctx.setInvestigationPlatformSelected(true);
    ctx.setInvestigationPlatformId(singlePlatformId);
    ctx.setInvestigationScanning(true);
    ctx.setPanelMode('investigation');
    setTimeout(() => ctx.handleInvestigationScan(singlePlatformId || undefined), 100);
  } else {
    ctx.setInvestigationPlatformSelected(false);
    ctx.setInvestigationPlatformId(null);
    ctx.setInvestigationScanning(false);
    ctx.setPanelMode('investigation');
  }
}

export function handleShowAtomicTesting(ctx: MessageHandlerContext, payload: { theme?: 'dark' | 'light'; targets?: AtomicTestingTarget[] } | undefined) {
  ctx.clearEntityState();
  ctx.setEntityContainers([]);
  if (payload?.theme && (payload.theme === 'dark' || payload.theme === 'light')) ctx.setMode(payload.theme);
  
  ctx.setAtomicTestingTargets(payload?.targets || []);
  ctx.setSelectedAtomicTarget(null);
  ctx.setAtomicTestingPlatformSelected(false);
  ctx.setAtomicTestingPlatformId(null);
  ctx.setAtomicTestingAssets([]);
  ctx.setAtomicTestingAssetGroups([]);
  ctx.setAtomicTestingInjectorContracts([]);
  ctx.setAtomicTestingSelectedAsset(null);
  ctx.setAtomicTestingSelectedAssetGroup(null);
  ctx.setAtomicTestingSelectedContract(null);
  ctx.setAtomicTestingTitle('');
  ctx.setAtomicTestingShowList(true);
  ctx.setAtomicTestingTypeFilter('all');
  ctx.setPanelMode('atomic-testing');
}

export function handleAtomicTestingSelect(ctx: MessageHandlerContext, payload: AtomicTestingSelectPayload | null) {
  ctx.setSelectedAtomicTarget(payload);
  ctx.setAtomicTestingTitle(`Atomic Test - ${payload?.name || ''}`);
  ctx.setAtomicTestingShowList(false);
  ctx.setAtomicTestingInjectorContracts([]);
  ctx.setAtomicTestingSelectedContract(null);
  
  const entityId = payload?.entityId || payload?.data?.entityId || payload?.data?.attack_pattern_id || payload?.data?.id;
  if (payload?.type === 'attack-pattern' && entityId && ctx.atomicTestingPlatformId) {
    chrome.runtime.sendMessage({
      type: 'FETCH_INJECTOR_CONTRACTS',
      payload: { attackPatternId: entityId, platformId: ctx.atomicTestingPlatformId },
    }).then((res: ChromeMessageResponse<OAEVInjectorContract[]>) => {
      if (res?.success) ctx.setAtomicTestingInjectorContracts(res.data || []);
    });
  }
}

interface InvestigationResultEntity {
  entityId?: string;
  id?: string;
  type?: string;
  entity_type?: string;
  name?: string;
  value?: string;
  platformId?: string;
  _platformId?: string;
}

export function handleInvestigationResults(ctx: MessageHandlerContext, payload: { entities?: InvestigationResultEntity[] } | undefined) {
  ctx.clearEntityState();
  ctx.setEntityContainers([]);
  const entities = payload?.entities || [];
  ctx.setInvestigationEntities(entities.map((e) => ({
    id: e.entityId || e.id || '',
    type: e.type || e.entity_type || '',
    name: e.name || e.value,
    value: e.value,
    platformId: e.platformId || e._platformId,
    selected: false,
  })));
  ctx.setInvestigationScanning(false);
  ctx.setInvestigationTypeFilter('all');
}

export function handleScanResults(ctx: MessageHandlerContext, payload: Record<string, unknown> | undefined) {
  ctx.clearEntityState();
  ctx.setEntityContainers([]);
  ctx.setEntityFromSearchMode(null);
  
  const { entities, pageContent, pageTitle, pageUrl } = processScanResults(payload || {});
  ctx.setScanResultsEntities(entities);
  ctx.setScanResultsTypeFilter('all');
  ctx.setScanResultsFoundFilter('all');
  if (pageContent) ctx.setScanPageContent(pageContent);
  if (pageTitle) ctx.setCurrentPageTitle(pageTitle);
  if (pageUrl) ctx.setCurrentPageUrl(pageUrl);
  ctx.setEntityFromScanResults(false);
  ctx.setPanelMode('scan-results');
}

export function handleInvestigationToggle(ctx: MessageHandlerContext, payload: { entityId?: string; selected?: boolean } | undefined) {
  const { entityId, selected } = payload || {};
  if (entityId) {
    ctx.setInvestigationEntities(prev => prev.map(e => e.id === entityId ? { ...e, selected: selected ?? false } : e));
  }
}

export function handleShowUnifiedSearch(ctx: MessageHandlerContext, payload: { initialQuery?: string } | undefined) {
  const initialQuery = payload?.initialQuery || '';
  ctx.setUnifiedSearchQuery(initialQuery);
  ctx.setUnifiedSearchResults([]);
  ctx.setPanelMode('unified-search');
  if (initialQuery.trim()) {
    setTimeout(() => ctx.doUnifiedSearch(initialQuery), 100);
  }
}

export async function handleShowScenario(ctx: MessageHandlerContext, payload: ScenarioPayload | undefined) {
  const { attackPatterns, pageTitle, pageUrl, pageDescription, theme: themeFromPayload } = payload || {};
  if (themeFromPayload && (themeFromPayload === 'dark' || themeFromPayload === 'light')) ctx.setMode(themeFromPayload);
  
  ctx.setCurrentPageUrl(pageUrl || '');
  ctx.setCurrentPageTitle(pageTitle || '');
  ctx.setScenarioForm({
    name: pageTitle || 'New Scenario', description: pageDescription || '', subtitle: '',
    category: SCENARIO_DEFAULT_VALUES.category, mainFocus: SCENARIO_DEFAULT_VALUES.mainFocus, severity: SCENARIO_DEFAULT_VALUES.severity,
  });
  ctx.setSelectedInjects([]);
  ctx.setScenarioStep(0);
  ctx.setScenarioTypeAffinity('ENDPOINT');
  ctx.setScenarioPlatformsAffinity(['windows', 'linux', 'macos']);
  ctx.setScenarioOverviewData(null);
  ctx.setScenarioAIMode(false);
  ctx.setScenarioAIGenerating(false);
  ctx.setScenarioAINumberOfInjects(5);
  ctx.setScenarioAIPayloadAffinity('powershell');
  ctx.setScenarioAITableTopDuration(60);
  ctx.setScenarioAIEmailLanguage('english');
  ctx.setScenarioAIContext('');
  ctx.setScenarioAIGeneratedScenario(null);
  ctx.setScenarioRawAttackPatterns(attackPatterns || []);
  
  let currentPlatforms = ctx.availablePlatformsRef.current;
  if (currentPlatforms.length === 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const settingsResponse = await new Promise<SettingsResponse>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
      });
      if (settingsResponse?.success && settingsResponse.data) {
        const platforms = settingsResponse.data?.openctiPlatforms || [];
        const enabledPlatforms = platforms
          .filter((p) => p.enabled !== false && p.url && p.apiToken)
          .map((p) => ({ id: p.id, name: p.name || 'OpenCTI', url: p.url, type: 'opencti' as const, isEnterprise: p.isEnterprise }));
        const oaevPlatformsFromSettings = settingsResponse.data?.openaevPlatforms || [];
        const enabledOAEVPlatforms = oaevPlatformsFromSettings
          .filter((p) => p.enabled !== false && p.url && p.apiToken)
          .map((p) => ({ id: p.id, name: p.name || 'OpenAEV', url: p.url, type: 'openaev' as const, isEnterprise: p.isEnterprise }));
        currentPlatforms = [...enabledPlatforms, ...enabledOAEVPlatforms];
        ctx.setAvailablePlatforms(currentPlatforms);
        ctx.availablePlatformsRef.current = currentPlatforms;
      }
    } catch (error) {
      log.warn('Failed to fetch platforms:', error);
    }
  }
  
  const oaevPlatformsList = currentPlatforms.filter(p => p.type === 'openaev');
  if (oaevPlatformsList.length > 1) {
    ctx.setScenarioPlatformSelected(false);
    ctx.setScenarioPlatformId(null);
    ctx.setScenarioLoading(false);
    ctx.setPanelMode('scenario-overview');
  } else if (oaevPlatformsList.length === 1) {
    const singlePlatformId = oaevPlatformsList[0].id;
    ctx.setScenarioPlatformSelected(true);
    ctx.setScenarioPlatformId(singlePlatformId);
    ctx.setSelectedPlatformId(singlePlatformId);
    ctx.setPlatformUrl(oaevPlatformsList[0].url);
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      Promise.all([
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId: singlePlatformId } }) as Promise<ChromeMessageResponse<OAEVAsset[]>>,
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId: singlePlatformId } }) as Promise<ChromeMessageResponse<OAEVAssetGroup[]>>,
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_TEAMS', payload: { platformId: singlePlatformId } }) as Promise<ChromeMessageResponse<OAEVTeam[]>>,
      ]).then(([assetsRes, assetGroupsRes, teamsRes]) => {
        if (assetsRes?.success) ctx.setScenarioAssets(assetsRes.data || []);
        if (assetGroupsRes?.success) ctx.setScenarioAssetGroups(assetGroupsRes.data || []);
        if (teamsRes?.success) ctx.setScenarioTeams(teamsRes.data || []);
      }).catch((error) => log.error('Failed to fetch scenario targets:', error));
    }
    
    ctx.setScenarioSelectedAsset(null);
    ctx.setScenarioSelectedAssetGroup(null);
    ctx.setScenarioSelectedTeam(null);
    
    const filteredPatterns = (attackPatterns || []).filter((ap) => !ap.platformId || ap.platformId === singlePlatformId);
    if (filteredPatterns.length > 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      ctx.setScenarioLoading(true);
      ctx.setPanelMode('scenario-overview');
      const attackPatternIds = filteredPatterns.map((ap) => ap.id || ap.entityId);
      chrome.runtime.sendMessage({
        type: 'FETCH_SCENARIO_OVERVIEW',
        payload: { attackPatternIds, platformId: singlePlatformId },
      }, (response: ChromeMessageResponse<ScenarioOverviewData>) => {
        ctx.setScenarioLoading(false);
        if (response?.success && response.data) {
          ctx.setScenarioOverviewData({ ...response.data, pageTitle: pageTitle || '', pageUrl: pageUrl || '', pageDescription: pageDescription || '' });
          ctx.setSelectedInjects([]);
        }
      });
    } else {
      ctx.setScenarioOverviewData({ attackPatterns: [], killChainPhases: [], pageTitle: pageTitle || '', pageUrl: pageUrl || '', pageDescription: pageDescription || '' });
      ctx.setScenarioLoading(false);
      ctx.setPanelMode('scenario-overview');
    }
  } else {
    ctx.setScenarioPlatformSelected(false);
    ctx.setScenarioPlatformId(null);
    const rawPatternsForDisplay = (attackPatterns || []).map((ap) => ({
      id: ap.id || ap.entityId || '', name: ap.name || '', externalId: ap.externalId || '', description: ap.description,
      killChainPhases: ap.killChainPhases || [], contracts: [],
    }));
    ctx.setScenarioOverviewData({ attackPatterns: rawPatternsForDisplay, killChainPhases: [], pageTitle: pageTitle || '', pageUrl: pageUrl || '', pageDescription: pageDescription || '' });
    ctx.setScenarioLoading(false);
    ctx.setPanelMode('scenario-overview');
  }
}

export async function handleShowEntity(ctx: MessageHandlerContext, payload: ShowEntityPayload | undefined) {
  ctx.setEntityContainers([]);
  ctx.setEntityFromSearchMode(null);
  ctx.setEntityFromScanResults(ctx.scanResultsEntitiesRef.current.length > 0);
  
  const entityId = payload?.entityData?.id || payload?.entityId || payload?.id;
  const entityType = payload?.entityData?.entity_type || payload?.type || payload?.entity_type;
  const platformId = payload?.platformId || payload?._platformId;
  const platformMatches = payload?.platformMatches || (payload?.entityData as ShowEntityPayload)?.platformMatches;
  
  // Handle multi-platform results
  if (platformMatches && platformMatches.length > 0) {
    const multiResults: MultiPlatformResult[] = platformMatches.map((match) => {
      const platform = ctx.availablePlatforms.find(p => p.id === match.platformId);
      const matchPlatformType = match.platformType || platform?.type || 'opencti';
      const matchType = match.type || (match.entityData as EntityData)?.entity_type || payload?.type || entityType || '';
      const cleanType = matchType.replace(/^oaev-/, '');
      const displayType = matchPlatformType === 'openaev' && !matchType.startsWith('oaev-') ? `oaev-${cleanType}` : matchType;
      
      return {
        platformId: match.platformId,
        platformName: platform?.name || match.platformId,
        entity: {
          ...payload, id: match.entityId, entityId: match.entityId, type: displayType, entity_type: cleanType,
          name: payload?.name || payload?.value || (match.entityData as EntityData)?.name, value: payload?.value || payload?.name,
          existsInPlatform: true, platformId: match.platformId, _platformId: match.platformId, _platformType: matchPlatformType,
          _isNonDefaultPlatform: matchPlatformType !== 'opencti',
          entityData: { ...(match.entityData || payload?.entityData || {}), entity_type: cleanType },
        } as EntityData,
      };
    });
    const sorted = ctx.sortPlatformResults(multiResults, ctx.availablePlatforms);
    ctx.setMultiPlatformResults(sorted);
    ctx.updateMultiPlatformResultsRef(sorted);
    ctx.setCurrentPlatformIndex(0);
    ctx.updateCurrentPlatformIndexRef(0);
  } else if (platformId) {
    const platform = ctx.availablePlatforms.find(p => p.id === platformId);
    const singleResult: MultiPlatformResult[] = [{ platformId, platformName: platform?.name || platformId, entity: { ...payload, _platformId: platformId } as EntityData }];
    ctx.setMultiPlatformResults(singleResult);
    ctx.updateMultiPlatformResultsRef(singleResult);
    ctx.setCurrentPlatformIndex(0);
    ctx.updateCurrentPlatformIndexRef(0);
  } else {
    ctx.setMultiPlatformResults([]);
    ctx.updateMultiPlatformResultsRef([]);
    ctx.setCurrentPlatformIndex(0);
    ctx.updateCurrentPlatformIndexRef(0);
  }
  
  if (platformId && ctx.availablePlatforms.length > 0) {
    const platform = ctx.availablePlatforms.find(p => p.id === platformId);
    if (platform) { ctx.setPlatformUrl(platform.url); ctx.setSelectedPlatformId(platform.id); }
  }
  
  const parsedType = entityType ? parsePrefixedType(entityType) : null;
  const isNonDefaultPlatform = parsedType !== null;
  const actualEntityType = parsedType ? parsedType.entityType : entityType;
  const entityPlatformType = parsedType?.platformType || 'opencti';
  
  const entityData = payload?.entityData as Record<string, unknown> | undefined;
  const isMinimalData = entityId && payload?.existsInPlatform && (
    entityPlatformType === 'openaev' 
      ? (!entityData?.finding_type && !entityData?.finding_created_at && !entityData?.endpoint_name)
      : (!entityData?.description && !entityData?.objectLabel && !payload?.description)
  );
  
  if (isMinimalData && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    ctx.setEntity({ ...payload, _platformId: platformId, _platformType: entityPlatformType, _isNonDefaultPlatform: isNonDefaultPlatform });
    ctx.setPanelMode('entity');
    
    const fetchStartIndex = ctx.currentPlatformIndexRef.current;
    chrome.runtime.sendMessage({
      type: 'GET_ENTITY_DETAILS',
      payload: { id: entityId, entityType: actualEntityType, platformId, platformType: entityPlatformType },
    }, (response: ChromeMessageResponse<EntityData>) => {
      if (chrome.runtime.lastError) return;
      if (ctx.currentPlatformIndexRef.current !== fetchStartIndex) return;
      
      if (response?.success && response.data) {
        const fullEntity = { 
          ...payload, ...response.data, entityData: response.data, existsInPlatform: true,
          _platformId: platformId, _platformType: entityPlatformType, _isNonDefaultPlatform: isNonDefaultPlatform,
        };
        ctx.setEntity(fullEntity);
        ctx.setMultiPlatformResults(prev => prev.map((r, i) => 
          i === fetchStartIndex ? { ...r, entity: { ...r.entity, ...response.data, entityData: response.data } } : r
        ));
        ctx.multiPlatformResultsRef.current = ctx.multiPlatformResultsRef.current.map((r, i) =>
          i === fetchStartIndex ? { ...r, entity: { ...r.entity, ...response.data, entityData: response.data } as EntityData } : r
        );
        if (!isNonDefaultPlatform && entityId) ctx.fetchEntityContainers(entityId, platformId);
      }
    });
  } else {
    ctx.setEntity({ ...payload, _platformType: entityPlatformType, _isNonDefaultPlatform: isNonDefaultPlatform });
    ctx.setPanelMode(payload?.existsInPlatform ? 'entity' : 'not-found');
    if (payload?.existsInPlatform && entityId && !isNonDefaultPlatform) ctx.fetchEntityContainers(entityId, platformId);
  }
}
