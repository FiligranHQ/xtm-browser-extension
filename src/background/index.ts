/**
 * Background Service Worker
 * 
 * Handles extension lifecycle, message passing, and API coordination.
 */

import { OpenCTIClient, resetOpenCTIClient } from '../shared/api/opencti-client';
import { OpenAEVClient } from '../shared/api/openaev-client';
import { AIClient, isAIAvailable, parseAIJsonResponse } from '../shared/api/ai-client';
import type { ContainerDescriptionRequest, ScenarioGenerationRequest, AtomicTestRequest } from '../shared/api/ai-client';
import { DetectionEngine } from '../shared/detection/detector';
import { refangIndicator } from '../shared/detection/patterns';
import { loggers } from '../shared/utils/logger';
import {
  PLATFORM_REGISTRY,
  createPrefixedType,
  getPlatformDefinition,
  type PlatformType,
} from '../shared/platform';
import {
  CONNECTION_TIMEOUT_MS,
  ENTITY_FETCH_TIMEOUT_MS,
  SEARCH_TIMEOUT_MS,
  CONTAINER_FETCH_TIMEOUT_MS,
  CACHE_REFRESH_TIMEOUT_MS,
  OPERATION_DELAY_MS,
  RETRY_DELAY_MS,
} from '../shared/constants';
import { successResponse, errorResponse } from '../shared/utils/messaging';

const log = loggers.background;
import {
  getSettings,
  saveSettings,
  getCachedTheme,
  cachePlatformTheme,
  getSDOCache,
  saveSDOCache,
  shouldRefreshSDOCache,
  createEmptySDOCache,
  getSDOCacheStats,
  getMultiPlatformSDOCache,
  clearSDOCacheForPlatform,
  clearAllSDOCaches,
  cleanupOrphanedCaches,
  // OpenAEV cache
  saveOAEVCache,
  shouldRefreshOAEVCache,
  createEmptyOAEVCache,
  getOAEVCacheStats,
  getMultiPlatformOAEVCache,
  clearOAEVCacheForPlatform,
  clearAllOAEVCaches,
  cleanupOrphanedOAEVCaches,
  type SDOCache,
  type CachedEntity,
  type OAEVCache,
  type CachedOAEVEntity,
} from '../shared/utils/storage';
import type {
  ExtensionMessage,
  ExtensionSettings,
  ScanResultPayload,
  AddObservablePayload,
  CreateContainerPayload,
  PlatformConfig,
  ContainerType,
} from '../shared/types';

// ============================================================================
// Global State - Multi-Platform Architecture
// ============================================================================
// Platform clients are stored in Maps keyed by platform instance ID
// Each platform type (opencti, openaev, opengrc, etc.) has its own client map
// When adding a new platform, add a new client map and initialization logic
// ============================================================================

/**
 * Platform client registry - stores client instances by platform type
 * Key: Platform type from PLATFORM_REGISTRY (e.g., 'opencti', 'openaev')
 * Value: Map of platform instance ID to client instance
 */
type PlatformClientRegistry = {
  opencti: Map<string, OpenCTIClient>;
  openaev: Map<string, OpenAEVClient>;
  // Add new platform client maps here as they are integrated
  // opengrc: Map<string, OpenGRCClient>;
};

// Platform clients - each platform type has its own client map
const platformClients: PlatformClientRegistry = {
  opencti: new Map(),
  openaev: new Map(),
};

// Platform client registries
let openCTIClients: Map<string, OpenCTIClient> = platformClients.opencti;
let openAEVClients: Map<string, OpenAEVClient> = platformClients.openaev;
// Primary OpenCTI client (first configured)
let openCTIClient: OpenCTIClient | null = null;
let detectionEngine: DetectionEngine | null = null;
let isInitialized = false;
let cacheRefreshInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get all configured platforms of a specific type
 */
function getPlatformsOfType(settings: ExtensionSettings, platformType: PlatformType): PlatformConfig[] {
  const platformDef = PLATFORM_REGISTRY[platformType];
  const settingsKey = platformDef.settingsKey as keyof ExtensionSettings;
  return (settings[settingsKey] as PlatformConfig[] | undefined) || [];
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize all platform clients (can be called multiple times safely)
 */
async function initializeClient(): Promise<void> {
  log.info('Initializing platform clients...');
  
  const settings = await getSettings();
  log.debug('Settings loaded:', {
    hasOpenctiPlatforms: !!settings.openctiPlatforms,
    openctiPlatformsCount: settings.openctiPlatforms?.length || 0,
  });
  
  // Initialize OpenCTI clients
  openCTIClients.clear();
  openCTIClient = null;
  
  // Multi-platform support
  const openctiPlatforms = settings.openctiPlatforms || [];
  if (openctiPlatforms.length > 0) {
    log.debug('Processing multi-platform settings:', openctiPlatforms.map(p => ({ id: p.id, name: p.name, hasUrl: !!p.url, hasToken: !!p.apiToken, enabled: p.enabled })));
    for (const platform of openctiPlatforms) {
      if (platform.url && platform.apiToken && platform.enabled !== false) {
        try {
          const client = new OpenCTIClient({
            url: platform.url,
            apiToken: platform.apiToken,
          });
          openCTIClients.set(platform.id, client);
          // First enabled client becomes primary
          if (!openCTIClient) {
            openCTIClient = client;
          }
          log.info(`OpenCTI client initialized: ${platform.name} (${platform.id})`);
        } catch (error) {
          log.error(`Failed to initialize OpenCTI client ${platform.name}:`, error);
        }
      } else {
        log.debug(`Skipping platform ${platform.name}: url=${!!platform.url}, token=${!!platform.apiToken}, enabled=${platform.enabled}`);
      }
    }
  } else {
    log.debug('No OpenCTI platforms configured');
  }
  
  log.debug(`Total OpenCTI clients: ${openCTIClients.size}, Primary client: ${openCTIClient ? 'yes' : 'no'}`);
  
  // Initialize OpenAEV clients
  openAEVClients.clear();
  const openaevPlatforms = settings.openaevPlatforms || [];
  for (const platform of openaevPlatforms) {
    if (platform.url && platform.apiToken && platform.enabled !== false) {
      try {
        const client = new OpenAEVClient(platform);
        openAEVClients.set(platform.id, client);
        log.info(`OpenAEV client initialized: ${platform.name}`);
      } catch (error) {
        log.error(`Failed to initialize OpenAEV client ${platform.name}:`, error);
      }
    }
  }
  
  // Create detection engine with ALL OpenCTI clients for multi-platform search
  if (openCTIClients.size > 0) {
    detectionEngine = new DetectionEngine(openCTIClients);
  } else {
    detectionEngine = null;
  }
  
  // Set up side panel (Chrome/Edge)
  if (chrome.sidePanel) {
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'panel/index.html',
    });
  }
  
  isInitialized = true;
  
  // Start cache refresh for OpenCTI clients
  if (openCTIClients.size > 0) {
    startSDOCacheRefresh();
  }
  
  // Start cache refresh for OpenAEV clients
  if (openAEVClients.size > 0) {
    log.debug('Triggering initial OpenAEV cache refresh...');
    checkAndRefreshAllOAEVCaches();
  }
}

// ============================================================================
// SDO Cache Management (Multi-Platform)
// ============================================================================

const CACHE_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
let isCacheRefreshing = false;

/**
 * Start periodic SDO cache refresh for all platforms
 */
function startSDOCacheRefresh(): void {
  log.info('Starting SDO cache refresh system...');
  
  // Clear existing interval if any
  if (cacheRefreshInterval) {
    clearInterval(cacheRefreshInterval);
  }
  
  // Initial refresh check - force immediate refresh on startup
  log.debug('Triggering initial cache check...');
  checkAndRefreshAllSDOCaches();
  
  // Set up periodic refresh
  cacheRefreshInterval = setInterval(() => {
    checkAndRefreshAllSDOCaches();
  }, CACHE_REFRESH_INTERVAL);
  
  log.info('SDO cache refresh scheduled (every 30 minutes)');
}

/**
 * Check and refresh caches for ALL configured OpenCTI platforms
 * @param forceRefresh - If true, refresh all caches regardless of age (also bypasses in-progress check)
 */
async function checkAndRefreshAllSDOCaches(forceRefresh: boolean = false): Promise<void> {
  if (openCTIClients.size === 0) {
    log.debug('No OpenCTI clients configured, skipping cache refresh');
    return;
  }
  
  // When force refresh is requested, wait for existing refresh to complete or skip the check
  if (isCacheRefreshing && !forceRefresh) {
    log.debug('Cache refresh already in progress, skipping');
    return;
  }
  
  // If force refresh while already refreshing, log but continue
  if (isCacheRefreshing && forceRefresh) {
    log.debug('Force refresh requested while refresh in progress, will proceed after current refresh');
    // Wait a bit for the current refresh to complete
    let waitAttempts = 0;
    while (isCacheRefreshing && waitAttempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitAttempts++;
    }
    if (isCacheRefreshing) {
      log.warn('Current refresh taking too long, proceeding anyway');
    }
  }
  
  isCacheRefreshing = true;
  log.debug(`${forceRefresh ? 'Force refreshing' : 'Checking'} cache for ${openCTIClients.size} OpenCTI platform(s)...`);
  
  try {
    for (const [platformId, client] of openCTIClients) {
      const needsRefresh = forceRefresh || await shouldRefreshSDOCache(platformId);
      if (needsRefresh) {
        log.debug(`SDO cache for platform ${platformId} ${forceRefresh ? 'force' : 'needs'} refresh, starting...`);
        await refreshSDOCacheForPlatform(platformId, client);
      } else {
        log.debug(`SDO cache for platform ${platformId} is fresh`);
      }
    }
  } finally {
    isCacheRefreshing = false;
  }
}

/**
 * Refresh the SDO cache for a specific platform
 */
async function refreshSDOCacheForPlatform(platformId: string, client: OpenCTIClient): Promise<void> {
  log.debug(`Refreshing SDO cache for platform ${platformId}...`);
  
  const cache: SDOCache = createEmptySDOCache(platformId);
  
  try {
    // Fetch each entity type in parallel for speed with better error logging
    const fetchWithLog = async (name: string, fetcher: () => Promise<any[]>) => {
      try {
        const result = await fetcher();
        log.debug(`[${platformId}] Fetched ${result.length} ${name}`);
        return result;
      } catch (error) {
        log.error(`[${platformId}] Failed to fetch ${name}:`, error);
        return [];
      }
    };

    // Note: Vulnerabilities (CVEs) are NOT cached - they are too numerous and are searched in real-time
    const [
      threatActorGroups,
      threatActorIndividuals,
      intrusionSets,
      campaigns,
      incidents,
      malware,
      attackPatterns,
      sectors,
      organizations,
      individuals,
      events,
      countries,
      regions,
      cities,
      administrativeAreas,
      positions,
    ] = await Promise.all([
      fetchWithLog('Threat-Actor-Group', () => client.fetchThreatActorGroups()),
      fetchWithLog('Threat-Actor-Individual', () => client.fetchThreatActorIndividuals()),
      fetchWithLog('Intrusion-Set', () => client.fetchIntrusionSets()),
      fetchWithLog('Campaign', () => client.fetchCampaigns()),
      fetchWithLog('Incident', () => client.fetchIncidents()),
      fetchWithLog('Malware', () => client.fetchMalware()),
      fetchWithLog('Attack-Pattern', () => client.fetchAttackPatterns()),
      fetchWithLog('Sector', () => client.fetchSectors()),
      fetchWithLog('Organization', () => client.fetchOrganizations()),
      fetchWithLog('Individual', () => client.fetchIndividuals()),
      fetchWithLog('Event', () => client.fetchEvents()),
      fetchWithLog('Country', () => client.fetchCountries()),
      fetchWithLog('Region', () => client.fetchRegions()),
      fetchWithLog('City', () => client.fetchCities()),
      fetchWithLog('Administrative-Area', () => client.fetchAdministrativeAreas()),
      fetchWithLog('Position', () => client.fetchPositions()),
    ]);
    
    // Map to CachedEntity format (minimal data: id, name, aliases, type)
    const mapToCachedEntity = (
      entities: Array<{ id: string; name: string; aliases?: string[] }>,
      type: string
    ): CachedEntity[] => entities.map(e => ({
      id: e.id,
      name: e.name,
      aliases: e.aliases,
      type,
      platformId,
    }));
    
    cache.entities['Threat-Actor-Group'] = mapToCachedEntity(threatActorGroups, 'Threat-Actor-Group');
    cache.entities['Threat-Actor-Individual'] = mapToCachedEntity(threatActorIndividuals, 'Threat-Actor-Individual');
    cache.entities['Intrusion-Set'] = mapToCachedEntity(intrusionSets, 'Intrusion-Set');
    cache.entities['Campaign'] = mapToCachedEntity(campaigns, 'Campaign');
    cache.entities['Incident'] = mapToCachedEntity(incidents, 'Incident');
    cache.entities['Malware'] = mapToCachedEntity(malware, 'Malware');
    cache.entities['Attack-Pattern'] = mapToCachedEntity(attackPatterns, 'Attack-Pattern');
    // Note: Vulnerabilities are NOT cached - searched in real-time via CVE detection
    cache.entities['Sector'] = mapToCachedEntity(sectors, 'Sector');
    cache.entities['Organization'] = mapToCachedEntity(organizations, 'Organization');
    cache.entities['Individual'] = mapToCachedEntity(individuals, 'Individual');
    cache.entities['Event'] = mapToCachedEntity(events, 'Event');
    cache.entities['Country'] = mapToCachedEntity(countries, 'Country');
    cache.entities['Region'] = mapToCachedEntity(regions, 'Region');
    cache.entities['City'] = mapToCachedEntity(cities, 'City');
    cache.entities['Administrative-Area'] = mapToCachedEntity(administrativeAreas, 'Administrative-Area');
    cache.entities['Position'] = mapToCachedEntity(positions, 'Position');
    
    // Calculate totals
    let total = 0;
    for (const entities of Object.values(cache.entities)) {
      total += entities.length;
    }
    
    await saveSDOCache(cache, platformId);
    log.info(`[${platformId}] SDO cache refreshed: ${total} entities cached`);
  } catch (error) {
    log.error(`[${platformId}] Failed to refresh SDO cache:`, error);
  }
}

/**
 * Force refresh the SDO cache for all platforms
 */
async function refreshSDOCache(): Promise<void> {
  await checkAndRefreshAllSDOCaches(true);
}

// ============================================================================
// OpenAEV Cache Management
// ============================================================================

let isOAEVCacheRefreshing = false;

/**
 * Check and refresh OpenAEV cache for all platforms
 */
async function checkAndRefreshAllOAEVCaches(forceRefresh: boolean = false): Promise<void> {
  if (openAEVClients.size === 0) {
    log.debug('No OpenAEV clients configured, skipping cache refresh');
    return;
  }

  if (isOAEVCacheRefreshing && !forceRefresh) {
    log.debug('OpenAEV cache refresh already in progress, skipping');
    return;
  }

  // If forced refresh while another is in progress, wait
  if (forceRefresh && isOAEVCacheRefreshing) {
    log.debug('Forced OpenAEV cache refresh requested, waiting for previous to finish...');
    const startTime = Date.now();
    while (isOAEVCacheRefreshing && (Date.now() - startTime < CACHE_REFRESH_TIMEOUT_MS)) {
      await new Promise(resolve => setTimeout(resolve, OPERATION_DELAY_MS));
    }
  }

  isOAEVCacheRefreshing = true;
  log.debug(`${forceRefresh ? 'Force refreshing' : 'Checking'} OpenAEV cache for ${openAEVClients.size} platform(s)...`);

  try {
    for (const [platformId, client] of openAEVClients) {
      const needsRefresh = forceRefresh || await shouldRefreshOAEVCache(platformId);
      if (needsRefresh) {
        log.debug(`OpenAEV cache for platform ${platformId} ${forceRefresh ? 'force' : 'needs'} refresh, starting...`);
        await refreshOAEVCacheForPlatform(platformId, client);
      } else {
        log.debug(`OpenAEV cache for platform ${platformId} is fresh`);
      }
    }
  } finally {
    isOAEVCacheRefreshing = false;
  }
}

/**
 * Refresh the OpenAEV cache for a specific platform
 */
async function refreshOAEVCacheForPlatform(platformId: string, client: OpenAEVClient): Promise<void> {
  log.debug(`Refreshing OpenAEV cache for platform ${platformId}...`);
  
  const cache: OAEVCache = createEmptyOAEVCache(platformId);
  
  try {
    // Fetch all entities including attack patterns and findings
    const [{ assets, assetGroups, teams, players }, attackPatterns, findings] = await Promise.all([
      client.fetchAllEntitiesForCache(),
      client.getAllAttackPatterns(),
      client.getAllFindings(),
    ]);
    
    log.info(`[${platformId}] Fetched ${assets.length} Assets, ${assetGroups.length} AssetGroups, ${teams.length} Teams, ${players.length} Players, ${attackPatterns.length} AttackPatterns, ${findings.length} Findings`);
    
    // Debug: Log first few raw assets to see field names
    if (assets.length > 0) {
      log.debug(`[${platformId}] First raw asset:`, assets[0]);
    }
    
    // Map assets (endpoints) - match on NAME, HOSTNAME, IPs, or MAC addresses (exact match)
    // Note: API may return endpoint_name OR asset_name - use whichever is available
    cache.entities['Asset'] = assets.map(a => {
      // Primary name: prefer endpoint_name, fall back to asset_name
      const primaryName = a.endpoint_name || a.asset_name;
      const hostname = a.endpoint_hostname || a.asset_hostname;
      const ips = a.endpoint_ips || a.asset_ips || [];
      const aliases: string[] = [];
      
      // Add the alternate name field as alias if different
      if (a.asset_name && a.endpoint_name && a.asset_name.toLowerCase() !== a.endpoint_name.toLowerCase()) {
        aliases.push(a.asset_name);
      }
      
      // Add hostname as alias if different from name
      if (hostname && hostname.toLowerCase() !== primaryName?.toLowerCase()) {
        aliases.push(hostname);
      }
      
      // Add all IP addresses as aliases
      for (const ip of ips) {
        if (ip && ip.length >= 7) { // Minimum valid IP length (e.g., "1.1.1.1")
          aliases.push(ip);
        }
      }
      
      // Add MAC address if available (from endpoint data)
      const macAddress = (a as any).endpoint_mac_addresses?.[0] || (a as any).asset_mac_address;
      if (macAddress && macAddress.length >= 12) {
        aliases.push(macAddress);
      }
      
      const assetId = a.endpoint_id || a.asset_id;
      
      log.debug(`[${platformId}] Caching asset: name="${primaryName}", id="${assetId}", aliases=${JSON.stringify(aliases)}`);
      
      return {
        id: assetId,
        name: primaryName,
        aliases: aliases.length > 0 ? aliases : undefined,
        type: 'Asset' as const,
        platformId,
      };
    });
    
    // Map asset groups - match on NAME only
    cache.entities['AssetGroup'] = assetGroups.map(g => ({
      id: g.asset_group_id,
      name: g.asset_group_name,
      type: 'AssetGroup' as const,
      platformId,
    }));
    
    // Map teams - match on NAME only (exact match)
    cache.entities['Team'] = teams.map(t => ({
      id: t.team_id,
      name: t.team_name,
      type: 'Team' as const,
      platformId,
    }));
    
    // Map players - match on NAME or EMAIL only (exact match)
    // No phone numbers - they would cause false positives
    cache.entities['Player'] = players.map(p => {
      const fullName = `${p.user_firstname || ''} ${p.user_lastname || ''}`.trim();
      const name = fullName || p.user_email;
      const aliases: string[] = [];
      // Add email as alias if we have a name and it's different from the email
      if (fullName && p.user_email && p.user_email.toLowerCase() !== fullName.toLowerCase()) {
        aliases.push(p.user_email);
      }
      return {
        id: p.user_id,
        name,
        aliases: aliases.length > 0 ? aliases : undefined,
        type: 'Player' as const,
        platformId,
      };
    });
    
    // Map attack patterns - match on NAME or EXTERNAL_ID (e.g., T1059) (exact match)
    cache.entities['AttackPattern'] = attackPatterns.map(ap => ({
      id: ap.attack_pattern_id,
      name: ap.attack_pattern_name,
      aliases: ap.attack_pattern_external_id ? [ap.attack_pattern_external_id] : undefined,
      type: 'AttackPattern' as const,
      platformId,
    }));
    
    // Map findings - match on finding_value (the main attribute for matching)
    cache.entities['Finding'] = findings.map(f => ({
      id: f.finding_id,
      name: f.finding_value, // Match on the finding value
      type: 'Finding' as const,
      platformId,
    }));
    
    // Calculate totals
    let total = 0;
    for (const entities of Object.values(cache.entities)) {
      total += entities.length;
    }
    
    await saveOAEVCache(cache, platformId);
    log.info(`[${platformId}] OpenAEV cache refreshed: ${total} entities cached`);
  } catch (error) {
    log.error(`[${platformId}] Failed to refresh OpenAEV cache:`, error);
  }
}

/**
 * Force refresh the OpenAEV cache for all platforms
 */
async function refreshOAEVCache(): Promise<void> {
  await checkAndRefreshAllOAEVCaches(true);
}

/**
 * Set up context menu items (only called on install)
 */
function setupContextMenu(): void {
  log.debug('Setting up context menus...');
  
  // Create all context menu items
  chrome.contextMenus.create({
    id: 'xtm-scan-page',
    title: 'Scan page for threats',
    contexts: ['page'],
  });
  
  chrome.contextMenus.create({
    id: 'xtm-scan-selection',
    title: 'Search in OpenCTI',
    contexts: ['selection'],
  });
  
  chrome.contextMenus.create({
    id: 'xtm-add-selection',
    title: 'Add to OpenCTI',
    contexts: ['selection'],
  });
  
  chrome.contextMenus.create({
    id: 'xtm-create-container',
    title: 'Create container from page',
    contexts: ['page'],
  });
  
  chrome.contextMenus.create({
    id: 'xtm-create-investigation',
    title: 'Start investigation from page',
    contexts: ['page'],
  });
  
  log.debug('Context menus created');
}

// ============================================================================
// Event Listeners
// ============================================================================

// Initialize context menus ONLY on install (they persist across sessions)
chrome.runtime.onInstalled.addListener(async (details) => {
  log.info('Extension installed:', details.reason);
  
  // Remove any existing menus and recreate (handles updates)
  await chrome.contextMenus.removeAll();
  setupContextMenu();
  
  // Initialize client
  await initializeClient();
});

// Initialize client on startup (menus already exist)
chrome.runtime.onStartup.addListener(async () => {
  log.info('Extension starting...');
  await initializeClient();
});

// Initialize client when service worker wakes up (if not already done)
if (!isInitialized) {
  initializeClient().catch((err) => log.error('Failed to initialize client:', err));
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  
  switch (info.menuItemId) {
    case 'xtm-scan-page':
      chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' });
      break;
      
    case 'xtm-scan-selection':
      if (info.selectionText) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SEARCH_SELECTION',
          payload: { text: info.selectionText },
        });
      }
      break;
      
    case 'xtm-add-selection':
      if (info.selectionText) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'ADD_SELECTION',
          payload: { text: info.selectionText },
        });
      }
      break;
      
    case 'xtm-create-container':
      chrome.tabs.sendMessage(tab.id, { type: 'CREATE_CONTAINER_FROM_PAGE' });
      break;
      
    case 'xtm-create-investigation':
      chrome.tabs.sendMessage(tab.id, { type: 'CREATE_INVESTIGATION' });
      break;
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep channel open for async response
});

// ============================================================================
// Message Handlers
// ============================================================================

async function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    switch (message.type) {
      case 'GET_SETTINGS': {
        const settings = await getSettings();
        sendResponse(successResponse(settings));
        break;
      }
      
      case 'SAVE_SETTINGS': {
        const settings = message.payload as ExtensionSettings;
        await saveSettings(settings);
        
        // Clean up orphaned caches for OpenCTI
        const validOpenCTIPlatformIds = (settings.openctiPlatforms || [])
          .filter(p => p.url && p.apiToken)
          .map(p => p.id);
        await cleanupOrphanedCaches(validOpenCTIPlatformIds);
        
        // Clean up orphaned caches for OpenAEV
        const validOpenAEVPlatformIds = (settings.openaevPlatforms || [])
          .filter(p => p.url && p.apiToken)
          .map(p => p.id);
        await cleanupOrphanedOAEVCaches(validOpenAEVPlatformIds);
        
        // Reinitialize all clients with new settings
        resetOpenCTIClient();
        await initializeClient();
        
        log.debug(`SAVE_SETTINGS: After initializeClient - OpenCTI clients: ${openCTIClients.size}, OpenAEV clients: ${openAEVClients.size}`);
        
        // Force cache refresh if we have any OpenCTI clients
        if (openCTIClients.size > 0) {
          log.debug('Forcing SDO cache refresh after settings save...');
          refreshSDOCache().catch(err => {
            log.error('SDO cache refresh failed:', err);
          });
        }
        
        // Force OpenAEV cache refresh if we have any OpenAEV clients
        if (openAEVClients.size > 0) {
          log.info(`Forcing OpenAEV cache refresh after settings save (${openAEVClients.size} clients)...`);
          refreshOAEVCache().catch(err => {
            log.error('OpenAEV cache refresh failed:', err);
          });
        } else {
          log.debug('SAVE_SETTINGS: No OpenAEV clients to refresh cache for');
        }
        
        sendResponse(successResponse(null));
        break;
      }
      
      case 'INJECT_CONTENT_SCRIPT': {
        // Inject content script into a specific tab if not already present
        const { tabId } = (message.payload as { tabId: number }) || {};
        
        if (!tabId) {
          sendResponse(errorResponse('No tab ID provided'));
          break;
        }
        
        try {
          // First try to ping the content script to see if it's already loaded
          try {
            await chrome.tabs.sendMessage(tabId, { type: 'PING' });
            // Content script is already loaded
            log.debug(`Content script already loaded in tab ${tabId}`);
            sendResponse({ success: true, alreadyLoaded: true });
          } catch {
            // Content script not loaded, inject it
            log.debug(`Injecting content script into tab ${tabId}`);
            
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content/index.js'],
            });
            
            // Also inject the CSS if needed
            try {
              await chrome.scripting.insertCSS({
                target: { tabId },
                files: ['assets/content.css'],
              });
            } catch {
              // CSS might not exist or already be injected, ignore
            }
            
            log.debug(`Content script injected successfully into tab ${tabId}`);
            sendResponse({ success: true, injected: true });
          }
        } catch (error) {
          log.error(`Failed to inject content script into tab ${tabId}:`, error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to inject content script' 
          });
        }
        break;
      }
      
      case 'INJECT_ALL_TABS': {
        // Inject content script into all tabs - useful after first configuration
        try {
          const tabs = await chrome.tabs.query({});
          let injectedCount = 0;
          let alreadyLoadedCount = 0;
          let failedCount = 0;
          
          for (const tab of tabs) {
            if (!tab.id || !tab.url) continue;
            
            // Skip chrome:// and extension pages
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('chrome-extension://') ||
                tab.url.startsWith('about:') ||
                tab.url.startsWith('edge://') ||
                tab.url.startsWith('moz-extension://')) {
              continue;
            }
            
            try {
              // Try to ping first
              try {
                await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
                alreadyLoadedCount++;
              } catch {
                // Inject content script
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content/index.js'],
                });
                
                try {
                  await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['assets/content.css'],
                  });
                } catch {
                  // Ignore CSS errors
                }
                
                injectedCount++;
              }
            } catch {
              failedCount++;
            }
          }
          
          log.debug(`Content script injection complete: ${injectedCount} injected, ${alreadyLoadedCount} already loaded, ${failedCount} failed`);
          sendResponse({ success: true, injectedCount, alreadyLoadedCount, failedCount });
        } catch (error) {
          log.error('Failed to inject content scripts into all tabs:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to inject content scripts' 
          });
        }
        break;
      }
      
      case 'TEST_OPENAEV_CONNECTION': {
        const { platformId } = (message.payload as { platformId?: string }) || {};
        
        // Find the client to test
        let clientToTest: OpenAEVClient | undefined;
        
        if (platformId) {
          clientToTest = openAEVClients.get(platformId);
        } else {
          // Test first available client
          const firstEntry = openAEVClients.entries().next().value;
          if (firstEntry) {
            clientToTest = firstEntry[1];
          }
        }
        
        if (!clientToTest) {
          sendResponse(errorResponse('OpenAEV client not configured'));
          break;
        }
        
        try {
          const result = await clientToTest.testConnection();
          if (result.success) {
            sendResponse({ success: true, data: { user: result.user } });
          } else {
            sendResponse(errorResponse('Connection test failed'));
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
          });
        }
        break;
      }
      
      case 'TEST_CONNECTION': {
        if (!openCTIClient) {
          sendResponse(errorResponse('Client not configured'));
          break;
        }
        
        try {
          const info = await openCTIClient.testConnection();
          
          // Cache the theme
          if (info.settings?.platform_theme) {
            await cachePlatformTheme(
              info.settings.platform_theme === 'dark' ? 'dark' : 'light'
            );
          }
          
          sendResponse(successResponse(info));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
          });
        }
        break;
      }
      
      case 'TEST_PLATFORM_CONNECTION': {
        // Multi-platform connection test handler
        // To add a new platform: add a case in the switch below
        const { platformId, platformType } = message.payload as { 
          platformId: string; 
          platformType: PlatformType;
        };
        
        try {
          const currentSettings = await getSettings();
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
          );
          
          // Platform-specific connection test
          switch (platformType) {
            case 'opencti': {
              let client = openCTIClients.get(platformId);
              if (!client) {
                const platformConfig = currentSettings.openctiPlatforms?.find(p => p.id === platformId);
                if (platformConfig?.url && platformConfig?.apiToken) {
                  client = new OpenCTIClient({
                    url: platformConfig.url,
                    apiToken: platformConfig.apiToken,
                  });
                  openCTIClients.set(platformId, client);
                }
              }
              if (!client) {
                sendResponse(errorResponse('Platform not configured'));
                break;
              }
              const info = await Promise.race([client.testConnection(), timeoutPromise]);
              sendResponse(successResponse(info));
              break;
            }
            
            case 'openaev': {
              let client = openAEVClients.get(platformId);
              if (!client) {
                const platformConfig = currentSettings.openaevPlatforms?.find(p => p.id === platformId);
                if (platformConfig?.url && platformConfig?.apiToken) {
                  client = new OpenAEVClient(platformConfig);
                  openAEVClients.set(platformId, client);
                }
              }
              if (!client) {
                sendResponse(errorResponse('Platform not configured'));
                break;
              }
              const info = await Promise.race([client.testConnection(), timeoutPromise]);
              sendResponse(successResponse(info));
              break;
            }
            
            // Add new platform cases here:
            // case 'opengrc': {
            //   // Similar pattern for OpenGRC
            //   break;
            // }
            
            default:
              sendResponse({ success: false, error: `Unsupported platform type: ${platformType}` });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
          });
        }
        break;
      }
      
      case 'TEST_PLATFORM_CONNECTION_TEMP': {
        // Test connection without saving - creates a temporary client
        // To add a new platform: add a case in the switch below
        const { platformType, url, apiToken } = message.payload as { 
          platformType: PlatformType;
          url: string;
          apiToken: string;
        };
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
        );
        
        try {
          switch (platformType) {
            case 'opencti': {
              const tempClient = new OpenCTIClient({ url, apiToken });
              const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
              sendResponse(successResponse(info));
              break;
            }
            
            case 'openaev': {
              const tempClient = new OpenAEVClient({ 
                id: 'temp', 
                name: 'temp', 
                url, 
                apiToken,
                enabled: true,
              });
              const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
              sendResponse(successResponse(info));
              break;
            }
            
            // Add new platform cases here:
            // case 'opengrc': {
            //   const tempClient = new OpenGRCClient({ ... });
            //   const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
            //   sendResponse(successResponse(info));
            //   break;
            // }
            
            default:
              sendResponse({ success: false, error: `Unsupported platform type: ${platformType}` });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
          });
        }
        break;
      }
      
      case 'SCAN_PAGE': {
        // SCAN_PAGE scans for OpenCTI entities only (observables, SDOs, CVEs)
        // For global scanning across all platforms, use SCAN_ALL instead
        const payload = message.payload as { content: string; url: string };
        try {
          if (detectionEngine) {
            const result = await detectionEngine.scan(payload.content);
            // Return OpenCTI results - platformEntities from other platforms are handled by SCAN_ALL
            const scanResult: ScanResultPayload = {
              observables: result.observables,
              sdos: result.sdos,
              cves: result.cves,
              platformEntities: [], // OpenCTI entities are in observables/sdos/cves, not platformEntities
              scanTime: result.scanTime,
              url: payload.url,
            };
            sendResponse(successResponse(scanResult));
          } else {
            sendResponse(errorResponse('OpenCTI not configured'));
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Scan failed',
          });
        }
        break;
      }
      
      // SCAN_OAEV scans for OpenAEV entities only (assets, teams, players, etc.)
      // For global scanning across all platforms, use SCAN_ALL instead
      // If includeAttackPatterns is true, also includes attack patterns (for atomic testing)
      case 'SCAN_OAEV': {
        const payload = message.payload as { content: string; url: string; includeAttackPatterns?: boolean };
        try {
          const { getAllCachedOAEVEntityNamesForMatching, getMultiPlatformOAEVCache } = await import('../shared/utils/storage');
          const oaevEntityMap = await getAllCachedOAEVEntityNamesForMatching();
          
          // Debug: Log cache contents
          const oaevCache = await getMultiPlatformOAEVCache();
          log.debug('SCAN_OAEV: OpenAEV cache platforms:', Object.keys(oaevCache.platforms));
          for (const [platformId, cache] of Object.entries(oaevCache.platforms)) {
            log.debug(`SCAN_OAEV: Platform ${platformId} has:`, {
              Assets: cache.entities['Asset']?.length || 0,
              AssetGroups: cache.entities['AssetGroup']?.length || 0,
              Teams: cache.entities['Team']?.length || 0,
              Players: cache.entities['Player']?.length || 0,
              AttackPatterns: cache.entities['AttackPattern']?.length || 0,
            });
            // Debug: Log first few asset names to verify cache content
            if (cache.entities['Asset']?.length > 0) {
              log.debug(`SCAN_OAEV: First 5 Asset names in ${platformId}:`, 
                cache.entities['Asset'].slice(0, 5).map(a => ({ name: a.name, aliases: a.aliases })));
            }
          }
          
          const includeAttackPatterns = payload.includeAttackPatterns === true;
          log.debug(`SCAN_OAEV: Searching for ${oaevEntityMap.size} cached OpenAEV entities (includeAttackPatterns: ${includeAttackPatterns})`);
          
          const platformEntities: ScanResultPayload['platformEntities'] = [];
          const originalText = payload.content;
          const textLower = originalText.toLowerCase();
          const seenEntities = new Set<string>();
          const seenRanges = new Set<string>();
          
          // Sort by name length (longest first) to match longer names before substrings
          const sortedEntities = Array.from(oaevEntityMap.entries()).sort((a, b) => b[0].length - a[0].length);
          
          for (const [nameLower, entity] of sortedEntities) {
            // Skip AttackPatterns unless explicitly requested (for atomic testing)
            if (entity.type === 'AttackPattern' && !includeAttackPatterns) continue;
            // For regular asset scan, skip attack patterns
            if (!includeAttackPatterns && entity.type === 'AttackPattern') continue;
            
            // Skip short names and already seen entities
            if (nameLower.length < 4 || seenEntities.has(entity.id)) continue;
            
            // Use indexOf for simple, reliable matching (case-insensitive)
            // This handles names with hyphens, underscores, dots etc. properly
            let searchStart = 0;
            let matchIndex = textLower.indexOf(nameLower, searchStart);
            
            while (matchIndex !== -1) {
              const endIndex = matchIndex + nameLower.length;
              
              // Check character boundaries to ensure exact word match
              // (not part of a larger word)
              const charBefore = matchIndex > 0 ? originalText[matchIndex - 1] : ' ';
              const charAfter = endIndex < originalText.length ? originalText[endIndex] : ' ';
              
              // Valid boundary: whitespace, punctuation, or start/end of string
              const isValidBoundary = (c: string) => 
                /[\s,;:!?()[\]"'<>\/\\@#$%^&*+=|`~\n\r\t]/.test(c) || c === '';
              
              // For names with hyphens/underscores, also check if the boundary char is NOT alphanumeric
              const beforeOk = isValidBoundary(charBefore) || !/[a-zA-Z0-9]/.test(charBefore);
              const afterOk = isValidBoundary(charAfter) || !/[a-zA-Z0-9]/.test(charAfter);
              
              if (beforeOk && afterOk) {
                // Check for overlapping ranges (longer matches win)
                const rangeKey = `${matchIndex}-${endIndex}`;
                let hasOverlap = false;
                for (const existingRange of seenRanges) {
                  const [existStart, existEnd] = existingRange.split('-').map(Number);
                  if (!(endIndex <= existStart || matchIndex >= existEnd)) {
                    hasOverlap = true;
                    break;
                  }
                }
                
                if (!hasOverlap) {
                  const matchedText = originalText.substring(matchIndex, endIndex);
                  log.debug(`SCAN_OAEV: Found "${entity.name}" (${entity.type}) at position ${matchIndex}`);
                  platformEntities.push({
                    platformType: 'openaev',
                    type: entity.type as 'Asset' | 'AssetGroup' | 'Team' | 'Player' | 'AttackPattern',
                    name: entity.name,
                    value: matchedText,
                    startIndex: matchIndex,
                    endIndex: endIndex,
                    found: true,
                    entityId: entity.id,
                    platformId: entity.platformId,
                    entityData: entity,
                  });
                  seenEntities.add(entity.id);
                  seenRanges.add(rangeKey);
                  break; // Only first match per entity
                }
              }
              
              // Continue searching from after this position
              searchStart = matchIndex + 1;
              matchIndex = textLower.indexOf(nameLower, searchStart);
            }
          }
          
          const attackPatternCount = platformEntities.filter(e => e.type === 'AttackPattern').length;
          const assetCount = platformEntities.length - attackPatternCount;
          log.debug(`SCAN_OAEV: Found ${assetCount} assets and ${attackPatternCount} attack patterns`);
          
          const scanResult = {
            platformEntities,
            scanTime: 0,
            url: payload.url,
          };
          sendResponse(successResponse(scanResult));
        } catch (error) {
          log.error('SCAN_OAEV error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'OpenAEV scan failed',
          });
        }
        break;
      }
      
      // SCAN_ALL - Global unified scan across ALL configured platforms
      // This is the main scan action used from the popup
      // Results include OpenCTI entities (observables/sdos/cves) and other platform entities (platformEntities)
      // Each result includes platform information so the UI can differentiate where entities come from
      case 'SCAN_ALL': {
        const payload = message.payload as { content: string; url: string };
        try {
          // Count configured platforms for logging
          const octiPlatformCount = openCTIClients.size;
          const oaevPlatformCount = openAEVClients.size;
          log.info(`SCAN_ALL: Starting unified scan across ALL configured platforms (${octiPlatformCount} OpenCTI, ${oaevPlatformCount} OpenAEV)...`);
          
          // Initialize results
          let openctiResult: { observables: any[]; sdos: any[]; cves: any[] } = {
            observables: [],
            sdos: [],
            cves: [],
          };
          const platformEntities: ScanResultPayload['platformEntities'] = [];
          
          // 1. Scan OpenCTI (detection engine scans ALL OpenCTI platforms' caches)
          if (detectionEngine) {
            try {
              log.debug(`SCAN_ALL: Scanning ${octiPlatformCount} OpenCTI platform(s) for observables, SDOs, and CVEs...`);
              const octiResult = await detectionEngine.scan(payload.content);
              openctiResult = {
                observables: octiResult.observables || [],
                sdos: octiResult.sdos || [],
                cves: octiResult.cves || [],
              };
              log.debug(`SCAN_ALL: OpenCTI found ${openctiResult.observables.length} observables, ${openctiResult.sdos.length} SDOs, ${openctiResult.cves.length} CVEs across ${octiPlatformCount} platform(s)`);
            } catch (octiError) {
              log.warn('SCAN_ALL: OpenCTI scan failed:', octiError);
            }
          } else {
            log.debug('SCAN_ALL: No OpenCTI detection engine available (0 platforms configured)');
          }
          
          // 2. Scan OpenAEV (from ALL OpenAEV platforms' caches)
          try {
            log.debug(`SCAN_ALL: Scanning ${oaevPlatformCount} OpenAEV platform(s) for assets, teams, findings, etc...`);
            const { getAllCachedOAEVEntityNamesForMatching } = await import('../shared/utils/storage');
            const oaevEntityMap = await getAllCachedOAEVEntityNamesForMatching();
            
            if (oaevEntityMap.size > 0) {
              const originalText = payload.content;
              const textLower = originalText.toLowerCase();
              const seenEntities = new Set<string>();
              const seenRanges = new Set<string>();
              
              // Sort by name length (longest first)
              const sortedEntities = Array.from(oaevEntityMap.entries()).sort((a, b) => b[0].length - a[0].length);
              
              for (const [nameLower, entity] of sortedEntities) {
                // Skip short names and already seen entities
                if (nameLower.length < 4 || seenEntities.has(entity.id)) continue;
                
                let searchStart = 0;
                let matchIndex = textLower.indexOf(nameLower, searchStart);
                
                while (matchIndex !== -1) {
                  const endIndex = matchIndex + nameLower.length;
                  
                  const charBefore = matchIndex > 0 ? originalText[matchIndex - 1] : ' ';
                  const charAfter = endIndex < originalText.length ? originalText[endIndex] : ' ';
                  
                  const isValidBoundary = (c: string) => 
                    /[\s,;:!?()[\]"'<>\/\\@#$%^&*+=|`~\n\r\t]/.test(c) || c === '';
                  
                  const beforeOk = isValidBoundary(charBefore) || !/[a-zA-Z0-9]/.test(charBefore);
                  const afterOk = isValidBoundary(charAfter) || !/[a-zA-Z0-9]/.test(charAfter);
                  
                  if (beforeOk && afterOk) {
                    const rangeKey = `${matchIndex}-${endIndex}`;
                    let hasOverlap = false;
                    for (const existingRange of seenRanges) {
                      const [existStart, existEnd] = existingRange.split('-').map(Number);
                      if (!(endIndex <= existStart || matchIndex >= existEnd)) {
                        hasOverlap = true;
                        break;
                      }
                    }
                    
                    if (!hasOverlap) {
                      const matchedText = originalText.substring(matchIndex, endIndex);
                      platformEntities.push({
                        platformType: 'openaev',
                        type: entity.type as 'Asset' | 'AssetGroup' | 'Team' | 'Player' | 'AttackPattern' | 'Finding',
                        name: entity.name,
                        value: matchedText,
                        startIndex: matchIndex,
                        endIndex: endIndex,
                        found: true,
                        entityId: entity.id,
                        platformId: entity.platformId,
                        entityData: entity,
                      });
                      seenEntities.add(entity.id);
                      seenRanges.add(rangeKey);
                      break;
                    }
                  }
                  
                  searchStart = matchIndex + 1;
                  matchIndex = textLower.indexOf(nameLower, searchStart);
                }
              }
              log.debug(`SCAN_ALL: OpenAEV found ${platformEntities.length} entities across ${oaevPlatformCount} platform(s)`);
            } else {
              log.debug(`SCAN_ALL: No OpenAEV entities in cache (scanned ${oaevPlatformCount} platform(s))`);
            }
          } catch (oaevError) {
            log.warn('SCAN_ALL: OpenAEV scan failed:', oaevError);
          }
          
          // Combine results
          const scanResult: ScanResultPayload = {
            observables: openctiResult.observables,
            sdos: openctiResult.sdos,
            cves: openctiResult.cves,
            platformEntities,
            scanTime: 0,
            url: payload.url,
          };
          
          const totalFound = 
            scanResult.observables.filter(o => o.found).length +
            scanResult.sdos.filter(s => s.found).length +
            (scanResult.platformEntities?.length || 0);
          log.info(`SCAN_ALL: Unified scan complete across ${octiPlatformCount + oaevPlatformCount} total platforms. Found: ${totalFound} entities`);
          
          sendResponse(successResponse(scanResult));
        } catch (error) {
          log.error('SCAN_ALL error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unified scan failed',
          });
        }
        break;
      }
      
      // ============================================================================
      // Atomic Testing (OpenAEV)
      // ============================================================================
      
      case 'FETCH_INJECTOR_CONTRACTS': {
        const { attackPatternId, platformId } = message.payload as {
          attackPatternId?: string;
          platformId?: string;
        };
        
        log.debug('[Background] FETCH_INJECTOR_CONTRACTS:', { attackPatternId, platformId });
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            log.error('[Background] OpenAEV client not configured for platformId:', platformId);
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          log.debug('[Background] Searching injector contracts for attack pattern:', attackPatternId);
          const contracts = await client.searchInjectorContracts(attackPatternId);
          log.debug('[Background] Found', contracts.length, 'injector contracts');
          log.debug('[Background] Contracts sample:', contracts.slice(0, 3));
          
          sendResponse(successResponse(contracts));
        } catch (error) {
          log.error('[Background] Failed to fetch injector contracts:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch injector contracts',
          });
        }
        break;
      }
      
      case 'FETCH_OAEV_ASSETS': {
        const { platformId } = message.payload as { platformId?: string };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const assets = await client.getAllAssets();
          sendResponse(successResponse(assets));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch assets',
          });
        }
        break;
      }
      
      case 'FETCH_OAEV_ASSET_GROUPS': {
        const { platformId } = message.payload as { platformId?: string };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const groups = await client.getAllAssetGroups();
          sendResponse(successResponse(groups));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch asset groups',
          });
        }
        break;
      }
      
      case 'FIND_DNS_RESOLUTION_PAYLOAD': {
        const { hostname, platformId } = message.payload as {
          hostname: string;
          platformId?: string;
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const existingPayload = await client.findDnsResolutionPayloadByHostname(hostname);
          if (existingPayload) {
            sendResponse(successResponse(existingPayload));
          } else {
            sendResponse({ success: true, data: null }); // No existing payload found
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to search for DNS resolution payload',
          });
        }
        break;
      }
      
      case 'CREATE_OAEV_PAYLOAD': {
        // Support both legacy DNS resolution format AND generic payload format
        const { hostname, name, platforms, attackPatternIds, platformId, payload: payloadData } = message.payload as {
          hostname?: string;
          name?: string;
          platforms?: string[];
          attackPatternIds?: string[];
          platformId?: string;
          payload?: {
            payload_type: 'Command' | 'Executable' | 'FileDrop' | 'DnsResolution' | 'NetworkTraffic';
            payload_name: string;
            payload_description?: string;
            payload_platforms: string[];
            payload_source?: string;
            payload_status?: string;
            payload_execution_arch?: string;
            payload_expectations?: string[];
            payload_attack_patterns?: string[];
            command_executor?: string;
            command_content?: string;
            payload_cleanup_executor?: string | null;
            payload_cleanup_command?: string | null;
            dns_resolution_hostname?: string;
          };
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          let createdPayload;
          
          // Check if generic payload format is provided
          if (payloadData) {
            // Use the new generic createPayload method
            createdPayload = await client.createPayload(payloadData);
          } else if (hostname && name && platforms) {
            // Legacy DNS resolution format
            createdPayload = await client.createDnsResolutionPayload({
              hostname,
              name,
              platforms,
              attackPatternIds,
            });
          } else {
            sendResponse(errorResponse('Invalid payload data: missing required fields'));
            break;
          }
          
          sendResponse(successResponse(createdPayload));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create payload',
          });
        }
        break;
      }
      
      case 'FETCH_OAEV_PAYLOAD': {
        const { payloadId, platformId } = message.payload as {
          payloadId: string;
          platformId?: string;
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const payload = await client.getPayload(payloadId);
          sendResponse(successResponse(payload));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch payload',
          });
        }
        break;
      }
      
      case 'FIND_INJECTOR_CONTRACT_BY_PAYLOAD': {
        const { payloadId, platformId } = message.payload as {
          payloadId: string;
          platformId?: string;
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const contract = await client.findInjectorContractByPayloadId(payloadId);
          if (contract) {
            sendResponse(successResponse(contract));
          } else {
            sendResponse({
              success: false,
              error: 'No injector contract found for this payload',
            });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to find injector contract',
          });
        }
        break;
      }
      
      case 'CREATE_ATOMIC_TESTING': {
        const { title, description, injectorContractId, content, assetIds, assetGroupIds, platformId } = message.payload as {
          title: string;
          description?: string;
          injectorContractId: string;
          content?: Record<string, any>;
          assetIds?: string[];
          assetGroupIds?: string[];
          platformId?: string;
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const atomicTesting = await client.createAtomicTesting({
            title,
            description,
            injectorContractId,
            content,
            assetIds,
            assetGroupIds,
          });
          
          // Return with URL
          const url = client.getAtomicTestingUrl(atomicTesting.inject_id);
          sendResponse({ success: true, data: { ...atomicTesting, url } });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create atomic testing',
          });
        }
        break;
      }
      
      // ============================================================================
      // Scenario Creation (OpenAEV)
      // ============================================================================
      
      case 'FETCH_KILL_CHAIN_PHASES': {
        const { platformId } = message.payload as { platformId?: string } || {};
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const phases = await client.getKillChainPhases();
          sendResponse(successResponse(phases));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch kill chain phases',
          });
        }
        break;
      }
      
      case 'FETCH_INJECTOR_CONTRACTS_FOR_ATTACK_PATTERNS': {
        const { attackPatternIds, platformId } = message.payload as {
          attackPatternIds: string[];
          platformId?: string;
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const contractsMap = await client.getInjectorContractsForAttackPatterns(attackPatternIds);
          // Convert Map to plain object for serialization
          const contractsObj: Record<string, any[]> = {};
          contractsMap.forEach((contracts, apId) => {
            contractsObj[apId] = contracts;
          });
          sendResponse(successResponse(contractsObj));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch injector contracts',
          });
        }
        break;
      }
      
      case 'FETCH_SCENARIO_OVERVIEW': {
        // Fetch attack patterns with their kill chain phases and available inject contracts
        const { attackPatternIds, platformId } = message.payload as {
          attackPatternIds: string[];
          platformId?: string;
        };
        
        log.debug('[FETCH_SCENARIO_OVERVIEW] Attack pattern IDs:', attackPatternIds);
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          // First, fetch all contracts once (more efficient)
          const allContracts = await client.searchInjectorContracts();
          log.debug('[FETCH_SCENARIO_OVERVIEW] Total contracts fetched:', allContracts.length);
          
          // Log sample contract structure to understand the data
          if (allContracts.length > 0) {
            log.debug('[FETCH_SCENARIO_OVERVIEW] Sample contract:', {
              id: allContracts[0].injector_contract_id,
              label: allContracts[0].injector_contract_labels?.en,
              attackPatterns: allContracts[0].injector_contract_attack_patterns,
            });
          }
          
          // Fetch attack patterns with full details
          const attackPatterns = await Promise.all(
            attackPatternIds.map(async (id) => {
              log.debug('[FETCH_SCENARIO_OVERVIEW] Fetching attack pattern:', id);
              const ap = await client.getAttackPattern(id);
              log.debug('[FETCH_SCENARIO_OVERVIEW] Attack pattern data:', ap);
              
              // Get the actual attack pattern UUID (in case a different ID was passed)
              const attackPatternUuid = ap?.attack_pattern_id || id;
              
              // Filter contracts that have this attack pattern
              // NOTE: injector_contract_attack_patterns is a List<String> of UUIDs, NOT objects!
              const contracts = allContracts.filter((contract: any) => {
                const contractApIds: string[] = contract.injector_contract_attack_patterns || [];
                // Each item in the array is a UUID string, not an object
                // Match by UUID directly
                return contractApIds.includes(attackPatternUuid) || contractApIds.includes(id);
              });
              
              log.debug('[FETCH_SCENARIO_OVERVIEW] Contracts for', ap?.attack_pattern_name || id, 
                '(uuid:', attackPatternUuid, '):', contracts.length,
                'Sample contract APs:', allContracts.slice(0, 2).map((c: any) => c.injector_contract_attack_patterns));
              
              return {
                id: attackPatternUuid,
                name: ap?.attack_pattern_name || 'Unknown',
                externalId: ap?.attack_pattern_external_id || '',
                description: ap?.attack_pattern_description || '',
                killChainPhases: ap?.attack_pattern_kill_chain_phases || [],
                contracts,
              };
            })
          );
          
          // Get all kill chain phases for reference
          const killChainPhases = await client.getKillChainPhases();
          
          log.debug('[FETCH_SCENARIO_OVERVIEW] Final attack patterns with contracts:', 
            attackPatterns.map(ap => ({ name: ap.name, contractCount: ap.contracts.length })));
          
          sendResponse(successResponse({
            attackPatterns,
            killChainPhases,
          }));
        } catch (error) {
          log.error('[FETCH_SCENARIO_OVERVIEW] Error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch scenario overview',
          });
        }
        break;
      }
      
      case 'CREATE_SCENARIO': {
        const { name, description, subtitle, category, platformId } = message.payload as {
          name: string;
          description?: string;
          subtitle?: string;
          category?: string;
          platformId?: string;
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const scenario = await client.createScenario({
            scenario_name: name,
            scenario_description: description,
            scenario_subtitle: subtitle,
            scenario_category: category,
          });
          
          // Return with URL
          const url = client.getScenarioUrl(scenario.scenario_id);
          sendResponse({ success: true, data: { ...scenario, url } });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create scenario',
          });
        }
        break;
      }
      
      case 'ADD_INJECT_TO_SCENARIO': {
        const { scenarioId, inject, platformId } = message.payload as {
          scenarioId: string;
          inject: {
            inject_title: string;
            inject_description?: string;
            inject_injector_contract: string;
            inject_content?: Record<string, any>;
            inject_depends_duration?: number;
            inject_depends_on?: string;
          };
          platformId?: string;
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const result = await client.addInjectToScenario(scenarioId, inject);
          sendResponse(successResponse(result));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add inject to scenario',
          });
        }
        break;
      }
      
      case 'GET_ENTITY_DETAILS': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { id, entityType, platformId: specificPlatformId } = message.payload as {
          id: string;
          entityType: string;
          platformId?: string;
        };
        
        try {
          // If a specific platform is requested, use that
          // Otherwise, search all platforms in PARALLEL with timeout
          if (specificPlatformId) {
            // Single platform request with timeout
            const client = openCTIClients.get(specificPlatformId);
            if (!client) {
              sendResponse(errorResponse('Platform not found'));
              break;
            }
            
            const timeoutPromise = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), ENTITY_FETCH_TIMEOUT_MS)
            );
            
            try {
              let entityPromise;
              if (
                entityType.includes('Addr') ||
                entityType.includes('Domain') ||
                entityType.includes('Url') ||
                entityType.includes('File') ||
                entityType.includes('Email') ||
                entityType.includes('Mac') ||
                entityType.includes('Observable')
              ) {
                entityPromise = client.getObservableById(id);
              } else {
                entityPromise = client.getSDOById(id);
              }
              
              const entity = await Promise.race([entityPromise, timeoutPromise]);
              if (entity) {
                sendResponse({ success: true, data: { ...entity, _platformId: specificPlatformId } });
              } else {
                sendResponse(errorResponse('Entity not found'));
              }
            } catch (e) {
              log.debug(`Entity ${id} not found/timeout in platform ${specificPlatformId}`);
              sendResponse(errorResponse('Entity not found or timeout'));
            }
          } else {
            // Search all platforms in PARALLEL
            const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
              const timeoutPromise = new Promise<null>((resolve) => 
                setTimeout(() => resolve(null), ENTITY_FETCH_TIMEOUT_MS)
              );
              
              try {
                let entityPromise;
                if (
                  entityType.includes('Addr') ||
                  entityType.includes('Domain') ||
                  entityType.includes('Url') ||
                  entityType.includes('File') ||
                  entityType.includes('Email') ||
                  entityType.includes('Mac') ||
                  entityType.includes('Observable')
                ) {
                  entityPromise = client.getObservableById(id);
                } else {
                  entityPromise = client.getSDOById(id);
                }
                
                const entity = await Promise.race([entityPromise, timeoutPromise]);
                return { platformId: pId, entity };
              } catch (e) {
                return { platformId: pId, entity: null };
              }
            });
            
            const results = await Promise.all(fetchPromises);
            const found = results.find(r => r.entity !== null);
            
            if (found && found.entity) {
              sendResponse({ success: true, data: { ...found.entity, _platformId: found.platformId } });
            } else {
              sendResponse(errorResponse('Entity not found in any platform'));
            }
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get entity',
          });
        }
        break;
      }
      
      case 'ADD_OBSERVABLE': {
        if (!openCTIClient) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const obsPayload = message.payload as AddObservablePayload;
        try {
          // Refang the value before creating (OpenCTI stores clean values)
          const cleanValue = refangIndicator(obsPayload.value);
          const created = await openCTIClient.createObservable({
            type: obsPayload.type,
            value: cleanValue,
            hashType: obsPayload.hashType,
            createIndicator: obsPayload.createIndicator,
          });
          sendResponse(successResponse(created));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create observable',
          });
        }
        break;
      }
      
      case 'CREATE_CONTAINER': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const containerPayload = message.payload as {
          type: string;
          name: string;
          description?: string;
          content?: string;
          labels?: string[];
          markings?: string[];
          entities?: string[];
          entitiesToCreate?: Array<{ type: string; value: string }>;
          platformId?: string;
          pdfAttachment?: { data: string; filename: string } | null;
          pageUrl?: string;
          pageTitle?: string;
          // Type-specific fields
          report_types?: string[];
          context?: string;
          severity?: string;
          priority?: string;
          response_types?: string[];
          createdBy?: string;
        };
        
        try {
          // Use specified platform or first available
          const platformId = containerPayload.platformId || openCTIClients.keys().next().value as string | undefined;
          
          if (!platformId) {
            sendResponse(errorResponse('No platform available'));
            break;
          }
          
          const client = openCTIClients.get(platformId);
          
          if (!client) {
            sendResponse(errorResponse('Platform not found'));
            break;
          }
          
          // Step 0: Create any entities that don't exist yet
          const allEntityIds: string[] = [...(containerPayload.entities || [])];
          
          if (containerPayload.entitiesToCreate && containerPayload.entitiesToCreate.length > 0) {
            log.info(`Creating ${containerPayload.entitiesToCreate.length} new entities for container...`);
            
            for (const entityToCreate of containerPayload.entitiesToCreate) {
              try {
                // Refang the value before creating (OpenCTI stores clean values)
                const cleanValue = refangIndicator(entityToCreate.value);
                const created = await client.createObservable({
                  type: entityToCreate.type as any,
                  value: cleanValue,
                });
                
                if (created?.id) {
                  allEntityIds.push(created.id);
                  log.debug(`Created observable: ${entityToCreate.type} = ${cleanValue} -> ${created.id}`);
                }
              } catch (entityError) {
                log.warn(`Failed to create entity ${entityToCreate.type}:${entityToCreate.value}:`, entityError);
                // Continue with other entities
              }
            }
            
            log.info(`Created entities. Total entity IDs for container: ${allEntityIds.length}`);
          }
          
          // Step 1: Create external reference first if page URL is provided
          let externalReferenceId: string | undefined;
          if (containerPayload.pageUrl) {
            try {
              const extRef = await client.createExternalReference({
                source_name: 'Web Article',
                description: containerPayload.pageTitle || 'Source article',
                url: containerPayload.pageUrl,
              });
              externalReferenceId = extRef.id;
              log.debug(`Created external reference: ${externalReferenceId}`);
            } catch (extRefError) {
              log.warn('Failed to create external reference:', extRefError);
              // Continue without external reference
            }
          }
          
          // Step 2: Create the container with all entity IDs (existing + newly created)
          const container = await client.createContainer({
            type: containerPayload.type as ContainerType,
            name: containerPayload.name,
            description: containerPayload.description,
            content: containerPayload.content,
            objects: allEntityIds,
            objectLabel: containerPayload.labels || [],
            objectMarking: containerPayload.markings || [],
            // Type-specific fields
            report_types: containerPayload.report_types,
            context: containerPayload.context,
            severity: containerPayload.severity,
            priority: containerPayload.priority,
            response_types: containerPayload.response_types,
            createdBy: containerPayload.createdBy,
          });
          
          // Step 3: Attach external reference to the container
          if (externalReferenceId && container.id) {
            try {
              await client.addExternalReferenceToEntity(container.id, externalReferenceId);
              log.debug('Attached external reference to container');
            } catch (attachError) {
              log.warn('Failed to attach external reference to container:', attachError);
              // Continue - container was created successfully
            }
          }
          
          // Step 4: Upload PDF attachment if provided
          if (containerPayload.pdfAttachment && container.id) {
            try {
              // Convert base64 to ArrayBuffer
              const binaryString = atob(containerPayload.pdfAttachment.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              await client.uploadFileToEntity(container.id, {
                name: containerPayload.pdfAttachment.filename,
                data: bytes.buffer,
                mimeType: 'application/pdf',
              });
              log.debug(`PDF attached to container: ${containerPayload.pdfAttachment.filename}`);
            } catch (pdfError) {
              log.error('Failed to attach PDF to container:', pdfError);
              // Don't fail the whole operation, container was created successfully
            }
          }
          
          sendResponse({ success: true, data: { ...container, _platformId: platformId } });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create container',
          });
        }
        break;
      }
      
      case 'GET_PLATFORM_THEME': {
        // Get user's theme setting
        const themeSettings = await getSettings();
        let themeMode: 'dark' | 'light';
        
        if (themeSettings.theme === 'auto') {
          // Use browser/system preference - we can't detect this in service worker
          // so we'll return 'auto' and let the content/panel handle it
          sendResponse({ success: true, data: 'auto' });
          break;
        } else if (themeSettings.theme === 'light' || themeSettings.theme === 'dark') {
          themeMode = themeSettings.theme;
        } else {
          themeMode = 'dark'; // Default
        }
        
        sendResponse(successResponse(themeMode));
        break;
      }
      
      case 'GET_PLATFORM_SETTINGS': {
        if (!openCTIClient) {
          sendResponse(errorResponse('Not connected to OpenCTI'));
          break;
        }
        
        try {
          const settings = await openCTIClient.getPlatformSettings();
          sendResponse(successResponse(settings));
        } catch (error) {
          sendResponse({ success: false, error: String(error) });
        }
        break;
      }
      
      case 'SEARCH_ENTITIES': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { searchTerm, types, limit, platformId } = message.payload as {
          searchTerm: string;
          types?: string[];
          limit?: number;
          platformId?: string;
        };
        
        try {
          // Refang search term in case user searches for defanged indicator
          const cleanSearchTerm = refangIndicator(searchTerm);
          
          // Search across all OpenCTI platforms in PARALLEL with timeout
          const clientsToSearch = platformId 
            ? [[platformId, openCTIClients.get(platformId)] as const].filter(([_, c]) => c)
            : Array.from(openCTIClients.entries());
          
          const searchPromises = clientsToSearch.map(async ([pId, client]) => {
            if (!client) return { platformId: pId, results: [] };
            
            try {
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), SEARCH_TIMEOUT_MS)
              );
              const results = await Promise.race([client.globalSearch(cleanSearchTerm, types, limit), timeoutPromise]);
              return { platformId: pId, results: results.map((r: any) => ({ ...r, _platformId: pId })) };
            } catch (e) {
              log.warn(`Search timeout/error for platform ${pId}:`, e);
              return { platformId: pId, results: [] };
            }
          });
          
          const searchResults = await Promise.all(searchPromises);
          const allResults = searchResults.flatMap(r => r.results);
          
          sendResponse(successResponse(allResults));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
          });
        }
        break;
      }
      
      case 'SEARCH_ASSETS': {
        const { searchTerm, platformId } = message.payload as {
          searchTerm: string;
          platformId?: string;
        };
        
        try {
          const results: any[] = [];
          
          // Search across all OpenAEV platforms or specific one
          const clientsToSearch = platformId 
            ? [openAEVClients.get(platformId)].filter(Boolean)
            : Array.from(openAEVClients.values());
          
          for (const client of clientsToSearch) {
            if (client) {
              const [assets, groups] = await Promise.all([
                client.searchAssets(searchTerm),
                client.searchAssetGroups(searchTerm),
              ]);
              
              const platformInfo = client.getPlatformInfo();
              
              results.push(
                ...assets.map(a => ({ ...a, _platform: platformInfo, _type: 'Asset' })),
                ...groups.map(g => ({ ...g, _platform: platformInfo, _type: 'AssetGroup' }))
              );
            }
          }
          
          sendResponse(successResponse(results));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Asset search failed',
          });
        }
        break;
      }
      
      case 'SEARCH_OAEV': {
        if (openAEVClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { searchTerm, platformId } = message.payload as {
          searchTerm: string;
          platformId?: string;
        };
        
        try {
          // Search across all OpenAEV platforms in PARALLEL with timeout
          const clientsToSearch = platformId 
            ? [[platformId, openAEVClients.get(platformId)] as const].filter(([_, c]) => c)
            : Array.from(openAEVClients.entries());
          
          const searchPromises = clientsToSearch.map(async ([pId, client]) => {
            if (!client) return { platformId: pId, results: [] };
            
            try {
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), SEARCH_TIMEOUT_MS)
              );
              const searchResult = await Promise.race([
                client.fullTextSearch(searchTerm),
                timeoutPromise
              ]);
              
              // Transform the result into a list of entities
              const results: any[] = [];
              const platformInfo = client.getPlatformInfo();
              
              for (const [className, data] of Object.entries(searchResult)) {
                if (data && (data as any).count > 0) {
                  // Fetch actual results for this class
                  const classResults = await client.fullTextSearchByClass(className, {
                    textSearch: searchTerm,
                    page: 0,
                    size: 20,
                  });
                  
                  results.push(...classResults.content.map((r: any) => ({
                    ...r,
                    _platformId: pId,
                    _platform: platformInfo,
                    _entityClass: className,
                  })));
                }
              }
              
              return { platformId: pId, results };
            } catch (e) {
              log.warn(`OAEV Search timeout/error for platform ${pId}:`, e);
              return { platformId: pId, results: [] };
            }
          });
          
          const searchResults = await Promise.all(searchPromises);
          const allResults = searchResults.flatMap(r => r.results);
          
          sendResponse(successResponse(allResults));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'OAEV Search failed',
          });
        }
        break;
      }

      case 'GET_OAEV_ENTITY_DETAILS': {
        // Fetch full entity details from OpenAEV by ID and type
        const { entityId, entityType, platformId: requestedPlatformId } = message.payload as {
          entityId: string;
          entityType: string;
          platformId: string;
        };
        
        const client = openAEVClients.get(requestedPlatformId);
        if (!client) {
          sendResponse(errorResponse('OpenAEV platform not found'));
          break;
        }
        
        try {
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), ENTITY_FETCH_TIMEOUT_MS)
          );
          
          // Ensure tags are cached for resolution
          await client.ensureTagsCached();
          
          const entity = await Promise.race([
            client.getEntityById(entityId, entityType),
            timeoutPromise
          ]);
          
          if (entity) {
            // Resolve tags if present (convert IDs to labels)
            if (entity.asset_tags && Array.isArray(entity.asset_tags)) {
              entity.asset_tags_resolved = client.resolveTagIds(entity.asset_tags);
            }
            if (entity.endpoint_tags && Array.isArray(entity.endpoint_tags)) {
              entity.endpoint_tags_resolved = client.resolveTagIds(entity.endpoint_tags);
            }
            if (entity.team_tags && Array.isArray(entity.team_tags)) {
              entity.team_tags_resolved = client.resolveTagIds(entity.team_tags);
            }
            if (entity.asset_group_tags && Array.isArray(entity.asset_group_tags)) {
              entity.asset_group_tags_resolved = client.resolveTagIds(entity.asset_group_tags);
            }
            if (entity.scenario_tags && Array.isArray(entity.scenario_tags)) {
              entity.scenario_tags_resolved = client.resolveTagIds(entity.scenario_tags);
            }
            if (entity.exercise_tags && Array.isArray(entity.exercise_tags)) {
              entity.exercise_tags_resolved = client.resolveTagIds(entity.exercise_tags);
            }
            
            sendResponse({ 
              success: true, 
              data: {
                ...entity,
                _platformId: requestedPlatformId,
                _platformType: 'openaev',
                _entityType: entityType,
              }
            });
          } else {
            sendResponse(errorResponse('Entity not found'));
          }
        } catch (error) {
          log.error(`Failed to fetch OpenAEV entity ${entityId}:`, error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch entity',
          });
        }
        break;
      }
      
      case 'GENERATE_SCENARIO': {
        const { pageTitle, pageContent, pageUrl, platformId } = message.payload as {
          pageTitle: string;
          pageContent: string;
          pageUrl: string;
          platformId?: string;
        };
        
        // Find client to use
        let clientToUse: OpenAEVClient | undefined;
        if (platformId) {
          clientToUse = openAEVClients.get(platformId);
        } else {
          const firstEntry = openAEVClients.entries().next().value;
          if (firstEntry) {
            clientToUse = firstEntry[1];
          }
        }
        
        if (!clientToUse) {
          sendResponse(errorResponse('OpenAEV client not configured'));
          break;
        }
        
        try {
          // Placeholder: Create a basic scenario from page content
          // AI integration will be added later
          const scenario = await clientToUse.createScenario({
            scenario_name: `Scenario from: ${pageTitle}`,
            scenario_description: `Auto-generated scenario from web page: ${pageUrl}\n\nContent summary will be processed by AI.`,
            scenario_subtitle: `Generated by XTM Browser Extension`,
            scenario_category: 'web-threat',
          });
          
          sendResponse(successResponse(scenario));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Scenario generation failed',
          });
        }
        break;
      }
      
      case 'REFRESH_SDO_CACHE': {
        if (openCTIClients.size === 0 && openAEVClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        try {
          // Refresh both OpenCTI and OpenAEV caches
          const refreshPromises: Promise<void>[] = [];
          if (openCTIClients.size > 0) {
            refreshPromises.push(refreshSDOCache());
          }
          if (openAEVClients.size > 0) {
            refreshPromises.push(refreshOAEVCache());
          }
          await Promise.all(refreshPromises);
          
          const stats = await getSDOCacheStats();
          sendResponse(successResponse(stats));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Cache refresh failed',
          });
        }
        break;
      }
      
      case 'GET_SDO_CACHE_STATS': {
        try {
          const multiCache = await getMultiPlatformSDOCache();
          const oaevMultiCache = await getMultiPlatformOAEVCache();
          
          // Build per-platform stats for OpenCTI
          const openctiPlatformStats: Array<{
            platformId: string;
            platformName: string;
            total: number;
            timestamp: number;
            age: number;
          }> = [];
          
          // Build per-platform stats for OpenAEV
          const oaevPlatformStats: Array<{
            platformId: string;
            platformName: string;
            total: number;
            timestamp: number;
            age: number;
          }> = [];
          
          // Get platform names from settings
          const currentSettings = await getSettings();
          const openctiPlatformNameMap = new Map<string, string>();
          for (const p of currentSettings.openctiPlatforms || []) {
            openctiPlatformNameMap.set(p.id, p.name);
          }
          const oaevPlatformNameMap = new Map<string, string>();
          for (const p of currentSettings.openaevPlatforms || []) {
            oaevPlatformNameMap.set(p.id, p.name);
          }
          
          let grandTotal = 0;
          let oldestTimestamp = Date.now();
          
          // OpenCTI stats - include all configured platforms (even if not yet cached)
          const processedOpenctiPlatforms = new Set<string>();
          for (const [platformId, cache] of Object.entries(multiCache.platforms)) {
            let platformTotal = 0;
            for (const entities of Object.values(cache.entities)) {
              platformTotal += entities.length;
            }
            grandTotal += platformTotal;
            if (cache.timestamp < oldestTimestamp) {
              oldestTimestamp = cache.timestamp;
            }
            
            openctiPlatformStats.push({
              platformId,
              platformName: openctiPlatformNameMap.get(platformId) || platformId,
              total: platformTotal,
              timestamp: cache.timestamp,
              age: Date.now() - cache.timestamp,
            });
            processedOpenctiPlatforms.add(platformId);
          }
          
          // Add platforms from settings that don't have cache entries yet
          for (const p of currentSettings.openctiPlatforms || []) {
            if (p.url && p.apiToken && !processedOpenctiPlatforms.has(p.id)) {
              openctiPlatformStats.push({
                platformId: p.id,
                platformName: p.name,
                total: 0,
                timestamp: 0,
                age: 0,
              });
            }
          }
          
          // OpenAEV stats - include all configured platforms (even if not yet cached)
          const processedOaevPlatforms = new Set<string>();
          let oaevGrandTotal = 0;
          for (const [platformId, cache] of Object.entries(oaevMultiCache.platforms)) {
            let platformTotal = 0;
            for (const entities of Object.values(cache.entities)) {
              platformTotal += entities.length;
            }
            oaevGrandTotal += platformTotal;
            grandTotal += platformTotal;
            if (cache.timestamp < oldestTimestamp) {
              oldestTimestamp = cache.timestamp;
            }
            
            oaevPlatformStats.push({
              platformId,
              platformName: oaevPlatformNameMap.get(platformId) || platformId,
              total: platformTotal,
              timestamp: cache.timestamp,
              age: Date.now() - cache.timestamp,
            });
            processedOaevPlatforms.add(platformId);
          }
          
          // Add OpenAEV platforms from settings that don't have cache entries yet
          for (const p of currentSettings.openaevPlatforms || []) {
            if (p.url && p.apiToken && !processedOaevPlatforms.has(p.id)) {
              oaevPlatformStats.push({
                platformId: p.id,
                platformName: p.name,
                total: 0,
                timestamp: 0,
                age: 0,
              });
            }
          }
          
          sendResponse({
            success: true,
            data: {
              total: grandTotal,
              byPlatform: openctiPlatformStats,
              oaevByPlatform: oaevPlatformStats,
              oaevTotal: oaevGrandTotal,
              age: grandTotal > 0 ? Date.now() - oldestTimestamp : 0,
              isRefreshing: isCacheRefreshing || isOAEVCacheRefreshing,
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get cache stats',
          });
        }
        break;
      }
      
      case 'GET_CACHE_REFRESH_STATUS': {
        sendResponse({ success: true, data: { isRefreshing: isCacheRefreshing } });
        break;
      }
      
      case 'CLEAR_SDO_CACHE': {
        const { platformId } = (message.payload as { platformId?: string }) || {};
        try {
          if (platformId) {
            await clearSDOCacheForPlatform(platformId);
            log.debug(`Cleared SDO cache for platform ${platformId}`);
          } else {
            await clearAllSDOCaches();
            log.debug('Cleared all SDO caches');
          }
          sendResponse(successResponse(null));
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to clear cache' 
          });
        }
        break;
      }
      
      case 'CLEAR_OAEV_CACHE': {
        const { platformId } = (message.payload as { platformId?: string }) || {};
        try {
          if (platformId) {
            await clearOAEVCacheForPlatform(platformId);
            log.debug(`Cleared OpenAEV cache for platform ${platformId}`);
          } else {
            await clearAllOAEVCaches();
            log.debug('Cleared all OpenAEV caches');
          }
          sendResponse(successResponse(null));
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to clear OpenAEV cache' 
          });
        }
        break;
      }
      
      // Panel state management - store and forward to side panel
      case 'SHOW_CONTAINER_PANEL':
      case 'SHOW_SEARCH_PANEL':
      case 'SHOW_ENTITY_PANEL':
      case 'SHOW_INVESTIGATION_PANEL':
      case 'SHOW_BULK_IMPORT_PANEL': {
        // Store in session storage for panel to retrieve
        await chrome.storage.session.set({ 
          pendingPanelState: {
            type: message.type,
            payload: message.payload,
            timestamp: Date.now(),
          }
        });
        sendResponse(successResponse(null));
        break;
      }
      
      case 'GET_PANEL_STATE': {
        const result = await chrome.storage.session.get('pendingPanelState');
        if (result.pendingPanelState) {
          // Clear after retrieving
          await chrome.storage.session.remove('pendingPanelState');
          sendResponse({ success: true, data: result.pendingPanelState });
        } else {
          sendResponse({ success: true, data: null });
        }
        break;
      }
      
      case 'GET_LABELS_AND_MARKINGS': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        try {
          // Aggregate labels and markings from all platforms
          const allLabels: any[] = [];
          const allMarkings: any[] = [];
          const seenLabelIds = new Set<string>();
          const seenMarkingIds = new Set<string>();
          
          for (const [pId, client] of openCTIClients) {
            try {
              const [labels, markings] = await Promise.all([
                client.fetchLabels(),
                client.fetchMarkingDefinitions(),
              ]);
              // Deduplicate by ID
              for (const label of labels) {
                if (!seenLabelIds.has(label.id)) {
                  seenLabelIds.add(label.id);
                  allLabels.push({ ...label, _platformId: pId });
                }
              }
              for (const marking of markings) {
                if (!seenMarkingIds.has(marking.id)) {
                  seenMarkingIds.add(marking.id);
                  allMarkings.push({ ...marking, _platformId: pId });
                }
              }
            } catch (e) {
              log.warn(`Failed to fetch labels/markings from platform ${pId}:`, e);
            }
          }
          
          sendResponse({ success: true, data: { labels: allLabels, markings: allMarkings } });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch labels/markings',
          });
        }
        break;
      }
      
      case 'FETCH_LABELS': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { platformId: labelsPlatformId } = (message.payload || {}) as { platformId?: string };
        
        try {
          // If a specific platform is requested, fetch only from that platform
          if (labelsPlatformId) {
            const client = openCTIClients.get(labelsPlatformId);
            if (!client) {
              sendResponse(errorResponse('Platform not found'));
              break;
            }
            
            const labels = await client.fetchLabels();
            sendResponse({ success: true, data: labels.map(l => ({ ...l, _platformId: labelsPlatformId })) });
          } else {
            // Fetch from all platforms in parallel with timeout
            const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
              try {
                const timeoutPromise = new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), CONTAINER_FETCH_TIMEOUT_MS)
                );
                const labels = await Promise.race([client.fetchLabels(), timeoutPromise]);
                return { platformId: pId, labels, error: null };
              } catch (e) {
                log.warn(`Failed to fetch labels from platform ${pId}:`, e);
                return { platformId: pId, labels: [], error: e };
              }
            });
            
            const results = await Promise.all(fetchPromises);
            
            const allLabels: any[] = [];
            const seenIds = new Set<string>();
            for (const result of results) {
              for (const label of result.labels) {
                if (!seenIds.has(label.id)) {
                  seenIds.add(label.id);
                  allLabels.push({ ...label, _platformId: result.platformId });
                }
              }
            }
            
            sendResponse({ success: true, data: allLabels });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch labels',
          });
        }
        break;
      }
      
      case 'FETCH_MARKINGS': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { platformId: markingsPlatformId } = (message.payload || {}) as { platformId?: string };
        
        try {
          // If a specific platform is requested, fetch only from that platform
          if (markingsPlatformId) {
            const client = openCTIClients.get(markingsPlatformId);
            if (!client) {
              sendResponse(errorResponse('Platform not found'));
              break;
            }
            
            const markings = await client.fetchMarkingDefinitions();
            sendResponse({ success: true, data: markings.map(m => ({ ...m, _platformId: markingsPlatformId })) });
          } else {
            // Fetch from all platforms in parallel with timeout
            const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
              try {
                const timeoutPromise = new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), CONTAINER_FETCH_TIMEOUT_MS)
                );
                const markings = await Promise.race([client.fetchMarkingDefinitions(), timeoutPromise]);
                return { platformId: pId, markings, error: null };
              } catch (e) {
                log.warn(`Failed to fetch markings from platform ${pId}:`, e);
                return { platformId: pId, markings: [], error: e };
              }
            });
            
            const results = await Promise.all(fetchPromises);
            
            const allMarkings: any[] = [];
            const seenIds = new Set<string>();
            for (const result of results) {
              for (const marking of result.markings) {
                if (!seenIds.has(marking.id)) {
                  seenIds.add(marking.id);
                  allMarkings.push({ ...marking, _platformId: result.platformId });
                }
              }
            }
            
            sendResponse({ success: true, data: allMarkings });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch markings',
          });
        }
        break;
      }
      
      case 'FETCH_VOCABULARY': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { category, platformId: vocabPlatformId } = message.payload as { category: string; platformId?: string };
        
        try {
          // Use specified platform or first available
          const targetPlatformId = vocabPlatformId || openCTIClients.keys().next().value as string;
          const client = openCTIClients.get(targetPlatformId);
          
          if (!client) {
            sendResponse(errorResponse('Platform not found'));
            break;
          }
          
          const vocabulary = await client.fetchVocabulary(category);
          sendResponse(successResponse(vocabulary));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch vocabulary',
          });
        }
        break;
      }
      
      case 'FETCH_IDENTITIES': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { platformId: identityPlatformId } = (message.payload || {}) as { platformId?: string };
        
        try {
          // Fetch from specified platform or first available
          const targetPlatformId = identityPlatformId || openCTIClients.keys().next().value as string;
          const client = openCTIClients.get(targetPlatformId);
          
          if (!client) {
            sendResponse(errorResponse('Platform not found'));
            break;
          }
          
          const identities = await client.fetchIdentities();
          sendResponse(successResponse(identities));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch identities',
          });
        }
        break;
      }
      
      case 'CREATE_OBSERVABLES_BULK': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { entities, platformId } = message.payload as { 
          entities: Array<{ type: string; value: string }>;
          platformId?: string;
        };
        
        // Use specified platform or first available
        const client = platformId ? openCTIClients.get(platformId) : openCTIClient;
        if (!client) {
          sendResponse(errorResponse('Platform not found'));
          break;
        }
        
        try {
          const results = await Promise.all(
            // Refang values before creating (OpenCTI stores clean values)
            entities.map(e => client.createObservable({ 
              type: e.type as any, 
              value: refangIndicator(e.value) 
            }))
          );
          sendResponse(successResponse(results));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create observables',
          });
        }
        break;
      }
      
      case 'CREATE_INVESTIGATION_WITH_ENTITIES': {
        if (!openCTIClient) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { entities: investigationEntities } = message.payload as { 
          entities: Array<{ id?: string; type: string; value?: string; name?: string }> 
        };
        
        try {
          // Create any entities that don't exist
          const entityIds: string[] = [];
          for (const entity of investigationEntities) {
            if (entity.id) {
              entityIds.push(entity.id);
            } else if (entity.value) {
              const created = await openCTIClient.createObservable({ type: entity.type as any, value: entity.value });
              if (created?.id) {
                entityIds.push(created.id);
              }
            }
          }
          
          // Create investigation
          const investigation = await openCTIClient.createInvestigation({
            name: `Investigation - ${new Date().toLocaleString()}`,
            description: `Investigation created from XTM Browser Extension with ${entityIds.length} entities`,
            investigated_entities_ids: entityIds,
          });
          
          sendResponse(successResponse(investigation));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create investigation',
          });
        }
        break;
      }
      
      case 'CREATE_WORKBENCH': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { name, description, entityIds, platformId } = message.payload as { 
          name: string;
          description?: string;
          entityIds: string[];
          platformId?: string;
        };
        
        try {
          // Use specified platform or first available
          const targetPlatformId = platformId || openCTIClients.keys().next().value as string;
          const client = openCTIClients.get(targetPlatformId);
          
          if (!client) {
            sendResponse(errorResponse('Platform not found'));
            break;
          }
          
          // Create the workbench/investigation
          const investigation = await client.createInvestigation({
            name,
            description: description || `Investigation created from XTM Browser Extension with ${entityIds.length} entities`,
            investigated_entities_ids: entityIds,
          });
          
          // Get the URL to open
          const url = client.getInvestigationUrl(investigation.id);
          
          sendResponse({ 
            success: true, 
            data: { 
              ...investigation, 
              url,
              _platformId: targetPlatformId,
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create workbench',
          });
        }
        break;
      }
      
      case 'FETCH_ENTITY_CONTAINERS': {
        log.debug(' FETCH_ENTITY_CONTAINERS received:', message.payload);
        
        if (openCTIClients.size === 0) {
          log.warn(' FETCH_ENTITY_CONTAINERS: No OpenCTI clients configured');
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { entityId, limit, platformId: specificPlatformId } = message.payload as { 
          entityId: string; 
          limit?: number;
          platformId?: string;
        };
        
        if (!entityId) {
          log.warn(' FETCH_ENTITY_CONTAINERS: No entityId provided');
          sendResponse(errorResponse('No entityId provided'));
          break;
        }
        
        try {
          // Search across platforms in PARALLEL with timeout
          const clientsToSearch = specificPlatformId 
            ? [[specificPlatformId, openCTIClients.get(specificPlatformId)] as const].filter(([_, c]) => c)
            : Array.from(openCTIClients.entries());
          
          log.debug(' FETCH_ENTITY_CONTAINERS: Searching', clientsToSearch.length, 'platforms for entity', entityId);
          
          const fetchPromises = clientsToSearch.map(async ([pId, client]) => {
            if (!client) return { platformId: pId, containers: [] };
            
            try {
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), CONTAINER_FETCH_TIMEOUT_MS)
              );
              const containers = await Promise.race([client.fetchContainersForEntity(entityId, limit), timeoutPromise]);
              log.debug(` FETCH_ENTITY_CONTAINERS: Found ${containers.length} containers for ${entityId} in platform ${pId}`);
              return { platformId: pId, containers: containers.map((c: any) => ({ ...c, _platformId: pId })) };
            } catch (e) {
              // Entity might not exist or timeout
              log.debug(`No containers/timeout for ${entityId} in platform ${pId}:`, e);
              return { platformId: pId, containers: [] };
            }
          });
          
          const results = await Promise.all(fetchPromises);
          const allContainers = results.flatMap(r => r.containers);
          
          log.debug(' FETCH_ENTITY_CONTAINERS: Total containers found:', allContainers.length);
          sendResponse(successResponse(allContainers));
        } catch (error) {
          log.error(' FETCH_ENTITY_CONTAINERS error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch containers',
          });
        }
        break;
      }
      
      case 'FIND_CONTAINERS_BY_URL': {
        if (openCTIClients.size === 0) {
          sendResponse(successResponse([])); // No error, just no containers
          break;
        }
        
        const { url } = message.payload as { url: string };
        
        try {
          // Search across all platforms in parallel with timeout
          const searchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
            try {
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), CONTAINER_FETCH_TIMEOUT_MS)
              );
              const containers = await Promise.race([
                client.findContainersByExternalReferenceUrl(url),
                timeoutPromise
              ]);
              return { platformId: pId, containers: containers.map((c: any) => ({ ...c, _platformId: pId })) };
            } catch (e) {
              log.debug(`No containers found/timeout for URL in platform ${pId}`);
              return { platformId: pId, containers: [] };
            }
          });
          
          const results = await Promise.all(searchPromises);
          const allContainers = results.flatMap(r => r.containers);
          
          sendResponse(successResponse(allContainers));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to search containers',
          });
        }
        break;
      }
      
      // ========================================================================
      // AI Feature Handlers
      // ========================================================================
      
      case 'AI_CHECK_STATUS': {
        const settings = await getSettings();
        const available = isAIAvailable(settings.ai);
        sendResponse({ 
          success: true, 
          data: { 
            available,
            provider: settings.ai?.provider,
            enabled: settings.ai?.enabled,
          } 
        });
        break;
      }
      
      case 'AI_TEST_AND_FETCH_MODELS': {
        // Test AI connection and fetch available models from provider
        const { provider, apiKey } = message.payload as { provider: string; apiKey: string };
        
        try {
          const aiClient = new AIClient({
            enabled: true,
            provider: provider as 'openai' | 'anthropic' | 'gemini',
            apiKey,
          });
          
          const result = await aiClient.testConnectionAndFetchModels();
          
          if (result.success) {
            sendResponse({ 
              success: true, 
              data: { 
                models: result.models,
              } 
            });
          } else {
            sendResponse({ success: false, error: result.error });
          }
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to test AI connection',
          });
        }
        break;
      }
      
      case 'AI_GENERATE_DESCRIPTION': {
        const settings = await getSettings();
        if (!isAIAvailable(settings.ai)) {
          sendResponse(errorResponse('AI not configured'));
          break;
        }
        
        try {
          const aiClient = new AIClient(settings.ai!);
          const request = message.payload as ContainerDescriptionRequest;
          const response = await aiClient.generateContainerDescription(request);
          sendResponse({ success: response.success, data: response.content, error: response.error });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'AI generation failed' 
          });
        }
        break;
      }
      
      case 'AI_GENERATE_SCENARIO': {
        const settings = await getSettings();
        if (!isAIAvailable(settings.ai)) {
          sendResponse(errorResponse('AI not configured'));
          break;
        }
        
        try {
          const aiClient = new AIClient(settings.ai!);
          const request = message.payload as ScenarioGenerationRequest;
          const response = await aiClient.generateScenario(request);
          
          if (response.success && response.content) {
            const scenario = parseAIJsonResponse(response.content);
            sendResponse(successResponse(scenario));
          } else {
            sendResponse({ success: false, error: response.error || 'Failed to parse scenario' });
          }
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'AI generation failed' 
          });
        }
        break;
      }
      
      case 'AI_GENERATE_ATOMIC_TEST': {
        const settings = await getSettings();
        if (!isAIAvailable(settings.ai)) {
          sendResponse(errorResponse('AI not configured'));
          break;
        }
        
        try {
          const aiClient = new AIClient(settings.ai!);
          const request = message.payload as AtomicTestRequest;
          const response = await aiClient.generateAtomicTest(request);
          
          if (response.success && response.content) {
            const atomicTest = parseAIJsonResponse(response.content);
            sendResponse({ success: true, data: atomicTest });
          } else {
            sendResponse({ success: false, error: response.error || 'Failed to parse atomic test' });
          }
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'AI generation failed' 
          });
        }
        break;
      }
      
      default:
        sendResponse(errorResponse('Unknown message type'));
    }
  } catch (error) {
    log.error('Message handler error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Auto-Scan on Page Load
// ============================================================================

/**
 * Listen for tab updates to trigger auto-scan when enabled
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only trigger when page finishes loading
  if (changeInfo.status !== 'complete') return;
  
  // Skip chrome:// and extension pages
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Check if auto-scan is enabled
  const settings = await getSettings();
  if (!settings.autoScan && !settings.scanOnLoad) {
    return;
  }
  
  // Check if we have a valid detection engine with clients
  if (!detectionEngine || openCTIClients.size === 0) {
    return;
  }
  
  log.debug(`Auto-scanning page: ${tab.url}`);
  
  // Send scan message to content script
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'AUTO_SCAN_PAGE' });
  } catch (error) {
    // Content script might not be loaded yet, ignore
    log.debug('Could not trigger auto-scan:', error);
  }
});

