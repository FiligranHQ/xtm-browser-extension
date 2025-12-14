/**
 * Background Service Worker
 * 
 * Handles extension lifecycle, message passing, and API coordination.
 */

import { OpenCTIClient, resetOpenCTIClient } from '../shared/api/opencti-client';
import { OpenAEVClient } from '../shared/api/openaev-client';
import { DetectionEngine } from '../shared/detection/detector';
import { loggers } from '../shared/utils/logger';

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
// Global State
// ============================================================================

// Multi-platform clients
let openCTIClients: Map<string, OpenCTIClient> = new Map();
let openAEVClients: Map<string, OpenAEVClient> = new Map();
// Primary client for backward compatibility
let openCTIClient: OpenCTIClient | null = null;
let detectionEngine: DetectionEngine | null = null;
let isInitialized = false;
let cacheRefreshInterval: ReturnType<typeof setInterval> | null = null;

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
    hasLegacyOpencti: !!(settings.opencti?.url && settings.opencti?.apiToken),
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
  } else if (settings.opencti?.url && settings.opencti?.apiToken) {
    // Legacy single platform support
    log.info('Using legacy single platform settings');
    try {
      openCTIClient = new OpenCTIClient({
        url: settings.opencti.url,
        apiToken: settings.opencti.apiToken,
      });
      openCTIClients.set('default', openCTIClient);
      log.info('OpenCTI client initialized (legacy)');
    } catch (error) {
      log.error('Failed to initialize OpenCTI client:', error);
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
    while (isOAEVCacheRefreshing && (Date.now() - startTime < 30000)) {
      await new Promise(resolve => setTimeout(resolve, 500));
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
    // Fetch all entities including attack patterns
    const [{ assets, assetGroups, teams, players }, attackPatterns] = await Promise.all([
      client.fetchAllEntitiesForCache(),
      client.getAllAttackPatterns(),
    ]);
    
    log.debug(`[${platformId}] Fetched ${assets.length} Assets, ${assetGroups.length} AssetGroups, ${teams.length} Teams, ${players.length} Players, ${attackPatterns.length} AttackPatterns`);
    
    // Debug: Log first few raw assets to see field names
    if (assets.length > 0) {
      log.debug(`[${platformId}] First raw asset:`, assets[0]);
    }
    
    // Map assets (endpoints) - match on NAME, HOSTNAME, IPs, or MAC addresses (exact match)
    cache.entities['Asset'] = assets.map(a => {
      const hostname = a.endpoint_hostname || a.asset_hostname;
      const ips = a.endpoint_ips || a.asset_ips || [];
      const aliases: string[] = [];
      
      // Add hostname as alias if different from name
      if (hostname && hostname.toLowerCase() !== a.asset_name?.toLowerCase()) {
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
      
      return {
        id: a.asset_id,
        name: a.asset_name,
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
        sendResponse({ success: true, data: settings });
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
        
        // Force cache refresh if we have any OpenCTI clients
        if (openCTIClients.size > 0) {
          log.debug('Forcing SDO cache refresh after settings save...');
          refreshSDOCache().catch(err => {
            log.error('SDO cache refresh failed:', err);
          });
        }
        
        // Force OpenAEV cache refresh if we have any OpenAEV clients
        if (openAEVClients.size > 0) {
          log.debug('Forcing OpenAEV cache refresh after settings save...');
          refreshOAEVCache().catch(err => {
            log.error('OpenAEV cache refresh failed:', err);
          });
        }
        
        sendResponse({ success: true });
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
          sendResponse({ success: false, error: 'OpenAEV client not configured' });
          break;
        }
        
        try {
          const result = await clientToTest.testConnection();
          if (result.success) {
            sendResponse({ success: true, data: { user: result.user } });
          } else {
            sendResponse({ success: false, error: 'Connection test failed' });
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
          sendResponse({ success: false, error: 'Client not configured' });
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
          
          sendResponse({ success: true, data: info });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
          });
        }
        break;
      }
      
      case 'TEST_PLATFORM_CONNECTION': {
        const { platformId, platformType } = message.payload as { platformId: string; platformType: 'opencti' | 'openaev' };
        const TIMEOUT_MS = 8000; // 8 second timeout for connection tests
        
        try {
          // Get settings to find the platform configuration
          const currentSettings = await getSettings();
          
          // Create timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), TIMEOUT_MS)
          );
          
          if (platformType === 'opencti') {
            // First try the cached client
            let client = openCTIClients.get(platformId);
            
            // If no cached client, create one from settings
            if (!client) {
              const platformConfig = currentSettings.openctiPlatforms?.find(p => p.id === platformId);
              if (platformConfig?.url && platformConfig?.apiToken) {
                client = new OpenCTIClient({
                  url: platformConfig.url,
                  apiToken: platformConfig.apiToken,
                });
                // Cache it for future use
                openCTIClients.set(platformId, client);
              }
            }
            
            if (!client) {
              sendResponse({ success: false, error: 'Platform not configured' });
              break;
            }
            // Race between connection test and timeout
            const info = await Promise.race([client.testConnection(), timeoutPromise]);
            sendResponse({ success: true, data: info });
          } else if (platformType === 'openaev') {
            // First try the cached client
            let client = openAEVClients.get(platformId);
            
            // If no cached client, create one from settings
            if (!client) {
              const platformConfig = currentSettings.openaevPlatforms?.find(p => p.id === platformId);
              if (platformConfig?.url && platformConfig?.apiToken) {
                client = new OpenAEVClient(platformConfig);
                // Cache it for future use
                openAEVClients.set(platformId, client);
              }
            }
            
            if (!client) {
              sendResponse({ success: false, error: 'Platform not configured' });
              break;
            }
            // Race between connection test and timeout
            const info = await Promise.race([client.testConnection(), timeoutPromise]);
            sendResponse({ success: true, data: info });
          } else {
            sendResponse({ success: false, error: 'Invalid platform type' });
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
        const { platformType, url, apiToken } = message.payload as { 
          platformType: 'opencti' | 'openaev';
          url: string;
          apiToken: string;
        };
        
        const TIMEOUT_MS = 8000; // 8 second timeout for connection tests
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), TIMEOUT_MS)
        );
        
        try {
          if (platformType === 'opencti') {
            const tempClient = new OpenCTIClient({ url, apiToken });
            const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
            sendResponse({ success: true, data: info });
          } else if (platformType === 'openaev') {
            const tempClient = new OpenAEVClient({ 
              id: 'temp', 
              name: 'temp', 
              url, 
              apiToken,
              enabled: true,
            });
            const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
            sendResponse({ success: true, data: info });
          } else {
            sendResponse({ success: false, error: 'Invalid platform type' });
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
        // SCAN_PAGE is for OpenCTI ONLY - does NOT include OpenAEV entities
        const payload = message.payload as { content: string; url: string };
        try {
          // Detection engine is required for OpenCTI scans
          if (detectionEngine) {
            const result = await detectionEngine.scan(payload.content);
            // Explicitly exclude OpenAEV entities from OpenCTI scan results
            const scanResult: ScanResultPayload = {
              observables: result.observables,
              sdos: result.sdos,
              cves: result.cves,
              oaevEntities: [], // DO NOT include OpenAEV entities in OpenCTI scans
              scanTime: result.scanTime,
              url: payload.url,
            };
            sendResponse({ success: true, data: scanResult });
          } else {
            // No OpenCTI detection engine - return empty results
            sendResponse({ success: false, error: 'OpenCTI not configured' });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Scan failed',
          });
        }
        break;
      }
      
      // OpenAEV-ONLY scanning for Assets (does not scan OpenCTI at all)
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
          }
          
          const includeAttackPatterns = payload.includeAttackPatterns === true;
          log.debug(`SCAN_OAEV: Searching for ${oaevEntityMap.size} cached OpenAEV entities (includeAttackPatterns: ${includeAttackPatterns})`);
          
          const oaevEntities: ScanResultPayload['oaevEntities'] = [];
          const originalText = payload.content;
          const seenEntities = new Set<string>();
          
          // Sort by name length (longest first) to match longer names before substrings
          const sortedEntities = Array.from(oaevEntityMap.entries()).sort((a, b) => b[0].length - a[0].length);
          
          for (const [nameLower, entity] of sortedEntities) {
            // Skip AttackPatterns unless explicitly requested (for atomic testing)
            if (entity.type === 'AttackPattern' && !includeAttackPatterns) continue;
            // For regular asset scan, skip attack patterns
            if (!includeAttackPatterns && entity.type === 'AttackPattern') continue;
            
            // Skip short names and already seen entities
            if (nameLower.length < 4 || seenEntities.has(entity.id)) continue;
            
            // Escape special regex characters in the name
            const escapedName = nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Use strict word boundary matching for ALL entity types
            // This ensures exact matches only (no partial matches)
            const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
            
            const match = regex.exec(originalText);
            if (match) {
              log.debug(`SCAN_OAEV: Found "${entity.name}" (${entity.type}) at position ${match.index}`);
              oaevEntities.push({
                type: entity.type as 'Asset' | 'AssetGroup' | 'Team' | 'Player' | 'AttackPattern',
                name: entity.name,
                value: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length,
                found: true,
                entityId: entity.id,
                platformId: entity.platformId,
              });
              seenEntities.add(entity.id);
            }
          }
          
          const attackPatternCount = oaevEntities.filter(e => e.type === 'AttackPattern').length;
          const assetCount = oaevEntities.length - attackPatternCount;
          log.debug(`SCAN_OAEV: Found ${assetCount} assets and ${attackPatternCount} attack patterns`);
          
          const scanResult = {
            oaevEntities,
            scanTime: 0,
            url: payload.url,
          };
          sendResponse({ success: true, data: scanResult });
        } catch (error) {
          log.error('SCAN_OAEV error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'OpenAEV scan failed',
          });
        }
        break;
      }
      
      // Get OpenAEV entity details
      case 'GET_OAEV_ENTITY_DETAILS': {
        const { entityId, entityType, platformId } = message.payload as {
          entityId: string;
          entityType: string;
          platformId?: string;
        };
        
        try {
          // Find the OpenAEV client
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse({ success: false, error: 'OpenAEV not configured' });
            break;
          }
          
          // Fetch entity details based on type
          let entity = null;
          switch (entityType) {
            case 'Asset':
              entity = await client.getAsset(entityId);
              break;
            case 'AssetGroup':
              entity = await client.getAssetGroup(entityId);
              break;
            case 'Player':
              entity = await client.getPlayer(entityId);
              break;
            case 'Team':
              entity = await client.getTeam(entityId);
              break;
          }
          
          if (entity) {
            sendResponse({ success: true, data: { ...entity, _platformId: platformId } });
          } else {
            sendResponse({ success: false, error: 'Entity not found' });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch entity',
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
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse({ success: false, error: 'OpenAEV not configured' });
            break;
          }
          
          const contracts = await client.searchInjectorContracts(attackPatternId);
          sendResponse({ success: true, data: contracts });
        } catch (error) {
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
            sendResponse({ success: false, error: 'OpenAEV not configured' });
            break;
          }
          
          const assets = await client.getAllAssets();
          sendResponse({ success: true, data: assets });
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
            sendResponse({ success: false, error: 'OpenAEV not configured' });
            break;
          }
          
          const groups = await client.getAllAssetGroups();
          sendResponse({ success: true, data: groups });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch asset groups',
          });
        }
        break;
      }
      
      case 'CREATE_OAEV_PAYLOAD': {
        const { hostname, name, platforms, attackPatternIds, platformId } = message.payload as {
          hostname: string;
          name: string;
          platforms: string[];
          attackPatternIds?: string[];
          platformId?: string;
        };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse({ success: false, error: 'OpenAEV not configured' });
            break;
          }
          
          const payload = await client.createDnsResolutionPayload({
            hostname,
            name,
            platforms,
            attackPatternIds,
          });
          sendResponse({ success: true, data: payload });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create payload',
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
            sendResponse({ success: false, error: 'OpenAEV not configured' });
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
      
      case 'GET_ENTITY_DETAILS': {
        if (openCTIClients.size === 0) {
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const { id, entityType, platformId: specificPlatformId } = message.payload as {
          id: string;
          entityType: string;
          platformId?: string;
        };
        
        const TIMEOUT_MS = 8000; // 8 second timeout for entity details
        
        try {
          // If a specific platform is requested, use that
          // Otherwise, search all platforms in PARALLEL with timeout
          if (specificPlatformId) {
            // Single platform request with timeout
            const client = openCTIClients.get(specificPlatformId);
            if (!client) {
              sendResponse({ success: false, error: 'Platform not found' });
              break;
            }
            
            const timeoutPromise = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
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
                sendResponse({ success: false, error: 'Entity not found' });
              }
            } catch (e) {
              log.debug(`Entity ${id} not found/timeout in platform ${specificPlatformId}`);
              sendResponse({ success: false, error: 'Entity not found or timeout' });
            }
          } else {
            // Search all platforms in PARALLEL
            const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
              const timeoutPromise = new Promise<null>((resolve) => 
                setTimeout(() => resolve(null), TIMEOUT_MS)
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
              sendResponse({ success: false, error: 'Entity not found in any platform' });
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
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const obsPayload = message.payload as AddObservablePayload;
        try {
          const created = await openCTIClient.createObservable({
            type: obsPayload.type,
            value: obsPayload.value,
            hashType: obsPayload.hashType,
            createIndicator: obsPayload.createIndicator,
          });
          sendResponse({ success: true, data: created });
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
          sendResponse({ success: false, error: 'Not configured' });
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
            sendResponse({ success: false, error: 'No platform available' });
            break;
          }
          
          const client = openCTIClients.get(platformId);
          
          if (!client) {
            sendResponse({ success: false, error: 'Platform not found' });
            break;
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
          
          // Step 2: Create the container (without externalReferences - will attach separately)
          const container = await client.createContainer({
            type: containerPayload.type as ContainerType,
            name: containerPayload.name,
            description: containerPayload.description,
            content: containerPayload.content,
            objects: containerPayload.entities || [],
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
        
        sendResponse({ success: true, data: themeMode });
        break;
      }
      
      case 'GET_PLATFORM_SETTINGS': {
        if (!openCTIClient) {
          sendResponse({ success: false, error: 'Not connected to OpenCTI' });
          break;
        }
        
        try {
          const settings = await openCTIClient.getPlatformSettings();
          sendResponse({ success: true, data: settings });
        } catch (error) {
          sendResponse({ success: false, error: String(error) });
        }
        break;
      }
      
      case 'SEARCH_ENTITIES': {
        if (openCTIClients.size === 0) {
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const { searchTerm, types, limit, platformId } = message.payload as {
          searchTerm: string;
          types?: string[];
          limit?: number;
          platformId?: string;
        };
        
        const TIMEOUT_MS = 8000; // 8 second timeout for search
        
        try {
          // Search across all OpenCTI platforms in PARALLEL with timeout
          const clientsToSearch = platformId 
            ? [[platformId, openCTIClients.get(platformId)] as const].filter(([_, c]) => c)
            : Array.from(openCTIClients.entries());
          
          const searchPromises = clientsToSearch.map(async ([pId, client]) => {
            if (!client) return { platformId: pId, results: [] };
            
            try {
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
              );
              const results = await Promise.race([client.globalSearch(searchTerm, types, limit), timeoutPromise]);
              return { platformId: pId, results: results.map((r: any) => ({ ...r, _platformId: pId })) };
            } catch (e) {
              log.warn(`Search timeout/error for platform ${pId}:`, e);
              return { platformId: pId, results: [] };
            }
          });
          
          const searchResults = await Promise.all(searchPromises);
          const allResults = searchResults.flatMap(r => r.results);
          
          sendResponse({ success: true, data: allResults });
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
          
          sendResponse({ success: true, data: results });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Asset search failed',
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
          sendResponse({ success: false, error: 'OpenAEV client not configured' });
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
          
          sendResponse({ success: true, data: scenario });
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
          sendResponse({ success: false, error: 'Not configured' });
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
          sendResponse({ success: true, data: stats });
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
          
          // OpenCTI stats
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
          }
          
          // OpenAEV stats
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
          sendResponse({ success: true });
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
          sendResponse({ success: true });
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
        sendResponse({ success: true });
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
          sendResponse({ success: false, error: 'Not configured' });
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
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const { platformId: labelsPlatformId } = (message.payload || {}) as { platformId?: string };
        
        try {
          // If a specific platform is requested, fetch only from that platform
          if (labelsPlatformId) {
            const client = openCTIClients.get(labelsPlatformId);
            if (!client) {
              sendResponse({ success: false, error: 'Platform not found' });
              break;
            }
            
            const labels = await client.fetchLabels();
            sendResponse({ success: true, data: labels.map(l => ({ ...l, _platformId: labelsPlatformId })) });
          } else {
            // Fetch from all platforms in PARALLEL with timeout (legacy behavior)
            const TIMEOUT_MS = 5000;
            const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
              try {
                const timeoutPromise = new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
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
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const { platformId: markingsPlatformId } = (message.payload || {}) as { platformId?: string };
        
        try {
          // If a specific platform is requested, fetch only from that platform
          if (markingsPlatformId) {
            const client = openCTIClients.get(markingsPlatformId);
            if (!client) {
              sendResponse({ success: false, error: 'Platform not found' });
              break;
            }
            
            const markings = await client.fetchMarkingDefinitions();
            sendResponse({ success: true, data: markings.map(m => ({ ...m, _platformId: markingsPlatformId })) });
          } else {
            // Fetch from all platforms in PARALLEL with timeout (legacy behavior)
            const TIMEOUT_MS = 5000;
            const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
              try {
                const timeoutPromise = new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
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
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const { category, platformId: vocabPlatformId } = message.payload as { category: string; platformId?: string };
        
        try {
          // Use specified platform or first available
          const targetPlatformId = vocabPlatformId || openCTIClients.keys().next().value as string;
          const client = openCTIClients.get(targetPlatformId);
          
          if (!client) {
            sendResponse({ success: false, error: 'Platform not found' });
            break;
          }
          
          const vocabulary = await client.fetchVocabulary(category);
          sendResponse({ success: true, data: vocabulary });
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
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const { platformId: identityPlatformId } = (message.payload || {}) as { platformId?: string };
        
        try {
          // Fetch from specified platform or first available
          const targetPlatformId = identityPlatformId || openCTIClients.keys().next().value as string;
          const client = openCTIClients.get(targetPlatformId);
          
          if (!client) {
            sendResponse({ success: false, error: 'Platform not found' });
            break;
          }
          
          const identities = await client.fetchIdentities();
          sendResponse({ success: true, data: identities });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch identities',
          });
        }
        break;
      }
      
      case 'CREATE_OBSERVABLES_BULK': {
        if (!openCTIClient) {
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const { entities } = message.payload as { entities: Array<{ type: string; value: string }> };
        
        try {
          const results = await Promise.all(
            entities.map(e => openCTIClient!.createObservable({ type: e.type as any, value: e.value }))
          );
          sendResponse({ success: true, data: results });
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
          sendResponse({ success: false, error: 'Not configured' });
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
          
          sendResponse({ success: true, data: investigation });
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
          sendResponse({ success: false, error: 'Not configured' });
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
            sendResponse({ success: false, error: 'Platform not found' });
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
        if (openCTIClients.size === 0) {
          sendResponse({ success: false, error: 'Not configured' });
          break;
        }
        
        const { entityId, limit, platformId: specificPlatformId } = message.payload as { 
          entityId: string; 
          limit?: number;
          platformId?: string;
        };
        
        const TIMEOUT_MS = 5000; // 5 second timeout for container fetch
        
        try {
          // Search across platforms in PARALLEL with timeout
          const clientsToSearch = specificPlatformId 
            ? [[specificPlatformId, openCTIClients.get(specificPlatformId)] as const].filter(([_, c]) => c)
            : Array.from(openCTIClients.entries());
          
          const fetchPromises = clientsToSearch.map(async ([pId, client]) => {
            if (!client) return { platformId: pId, containers: [] };
            
            try {
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
              );
              const containers = await Promise.race([client.fetchContainersForEntity(entityId, limit), timeoutPromise]);
              return { platformId: pId, containers: containers.map((c: any) => ({ ...c, _platformId: pId })) };
            } catch (e) {
              // Entity might not exist or timeout
              log.debug(`No containers/timeout for ${entityId} in platform ${pId}`);
              return { platformId: pId, containers: [] };
            }
          });
          
          const results = await Promise.all(fetchPromises);
          const allContainers = results.flatMap(r => r.containers);
          
          sendResponse({ success: true, data: allContainers });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch containers',
          });
        }
        break;
      }
      
      case 'FIND_CONTAINERS_BY_URL': {
        if (openCTIClients.size === 0) {
          sendResponse({ success: true, data: [] }); // No error, just no containers
          break;
        }
        
        const { url } = message.payload as { url: string };
        const TIMEOUT_MS = 5000;
        
        try {
          // Search across all platforms in parallel with timeout
          const searchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
            try {
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
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
          
          sendResponse({ success: true, data: allContainers });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to search containers',
          });
        }
        break;
      }
      
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
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

