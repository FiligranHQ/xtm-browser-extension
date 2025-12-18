/**
 * Background Service Worker
 * 
 * Handles extension lifecycle, message passing, and API coordination.
 */

import { OpenCTIClient, resetOpenCTIClient } from '../shared/api/opencti-client';
import { OpenAEVClient } from '../shared/api/openaev-client';
import {
  handleAICheckStatus,
  handleAITestAndFetchModels,
  handleAIGenerateDescription,
  handleAIGenerateScenario,
  handleAIGenerateFullScenario,
  handleAIGenerateAtomicTest,
  handleAIGenerateEmails,
  handleAIDiscoverEntities,
  handleAIResolveRelationships,
  type FullScenarioRequest,
  type EmailGenerationRequest,
} from './handlers/ai-handlers';
import {
  handleCreateScenario,
  handleAddInjectToScenario,
  handleAddEmailInjectToScenario,
  handleAddTechnicalInjectToScenario,
  type CreateScenarioPayload,
  type AddInjectPayload,
  type AddEmailInjectPayload,
  type AddTechnicalInjectPayload,
} from './handlers/scenario-handlers';
import {
  handleCreateContainer,
  type CreateContainerPayload,
} from './handlers/container-handlers';
import type {
  ContainerDescriptionRequest,
  ScenarioGenerationRequest,
  AtomicTestRequest,
  EntityDiscoveryRequest,
  RelationshipResolutionRequest,
} from '../shared/api/ai-client';
import { DetectionEngine } from '../shared/detection/detector';
import { refangIndicator } from '../shared/detection/patterns';
import { loggers } from '../shared/utils/logger';
import {
  type PlatformType,
} from '../shared/platform';
import {
  CONNECTION_TIMEOUT_MS,
  ENTITY_FETCH_TIMEOUT_MS,
  SEARCH_TIMEOUT_MS,
  CONTAINER_FETCH_TIMEOUT_MS,
} from '../shared/constants';
import { successResponse, errorResponse } from '../shared/utils/messaging';
import { generateNativePDF, isNativePDFAvailable } from '../shared/extraction';
import {
  startOCTICacheRefresh,
  startOAEVCacheRefresh,
  refreshOCTICache,
  refreshOAEVCache,
  getCacheRefreshStatus,
} from './services/cache-manager';

const log = loggers.background;
import {
  getSettings,
  saveSettings,
  // OpenCTI cache
  getOCTICacheStats,
  getMultiPlatformOCTICache,
  clearOCTICacheForPlatform,
  clearAllOCTICaches,
  cleanupOrphanedOCTICaches,
  addEntityToOCTICache,
  // OpenAEV cache
  getMultiPlatformOAEVCache,
  clearOAEVCacheForPlatform,
  clearAllOAEVCaches,
  cleanupOrphanedOAEVCaches,
  type CachedOCTIEntity,
} from '../shared/utils/storage';
import type {
  ExtensionMessage,
  ExtensionSettings,
  ScanResultPayload,
  AddObservablePayload,
  DetectedObservable,
  DetectedOCTIEntity,
  OAEVKillChainPhase,
  OAEVInjectorContract,
  Label,
  MarkingDefinition,
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
const openCTIClients: Map<string, OpenCTIClient> = platformClients.opencti;
const openAEVClients: Map<string, OpenAEVClient> = platformClients.openaev;
// Primary OpenCTI client (first configured)
let openCTIClient: OpenCTIClient | null = null;
let detectionEngine: DetectionEngine | null = null;
let isInitialized = false;

/**
 * Helper to get OpenAEV client by platform ID or first available
 */
function getOpenAEVClient(platformId?: string): OpenAEVClient | undefined {
  return platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
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
    startOCTICacheRefresh();
  }
  
  // Start cache refresh for OpenAEV clients
  if (openAEVClients.size > 0) {
    startOAEVCacheRefresh();
  }
}

// ============================================================================
// Context Menu Setup
// ============================================================================

// NOTE: All cache management code has been moved to services/cache-manager.ts


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
        // Debug: Log platform EE status when settings are requested
        log.debug('GET_SETTINGS: OpenCTI platforms EE status:', 
          settings.openctiPlatforms?.map(p => ({ id: p.id, name: p.name, isEnterprise: p.isEnterprise })));
        sendResponse(successResponse(settings));
        break;
      }
      
      case 'SAVE_SETTINGS': {
        const settings = message.payload as ExtensionSettings;
        
        // Debug: Log platform EE status before saving
        log.debug('SAVE_SETTINGS: OpenCTI platforms EE status:', 
          settings.openctiPlatforms?.map(p => ({ id: p.id, name: p.name, isEnterprise: p.isEnterprise })));
        log.debug('SAVE_SETTINGS: OpenAEV platforms EE status:', 
          settings.openaevPlatforms?.map(p => ({ id: p.id, name: p.name, isEnterprise: p.isEnterprise })));
        
        await saveSettings(settings);
        
        // Clean up orphaned caches for OpenCTI
        const validOpenCTIPlatformIds = (settings.openctiPlatforms || [])
          .filter(p => p.url && p.apiToken)
          .map(p => p.id);
        await cleanupOrphanedOCTICaches(validOpenCTIPlatformIds);
        
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
          log.debug('Forcing OpenCTI cache refresh after settings save...');
          refreshOCTICache().catch(err => {
            log.error('OpenCTI cache refresh failed:', err);
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
      
      case 'TEST_PLATFORM_CONNECTION': {
        // Unified platform connection test handler
        // Supports both saved platforms (by platformId) and temporary connections (url + apiToken)
        // To add a new platform: add a case in the switch below
        const { platformId, platformType, url, apiToken, temporary } = message.payload as { 
          platformId?: string; 
          platformType: PlatformType;
          url?: string;
          apiToken?: string;
          temporary?: boolean;
        };
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
        );
        
        try {
          // Platform-specific connection test
          switch (platformType) {
            case 'opencti': {
              if (temporary && url && apiToken) {
                // Test with temporary credentials
                const tempClient = new OpenCTIClient({ url, apiToken });
                const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
                sendResponse(successResponse(info));
              } else if (platformId) {
                // Test saved platform
                const currentSettings = await getSettings();
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
              } else {
                sendResponse(errorResponse('Missing platformId or temporary credentials'));
              }
              break;
            }
            
            case 'openaev': {
              if (temporary && url && apiToken) {
                // Test with temporary credentials
                const tempClient = new OpenAEVClient({ 
                  id: 'temp', 
                  name: 'temp', 
                  url, 
                  apiToken,
                  enabled: true,
                });
                const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
                sendResponse(successResponse(info));
              } else if (platformId) {
                // Test saved platform
                const currentSettings = await getSettings();
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
              } else {
                sendResponse(errorResponse('Missing platformId or temporary credentials'));
              }
              break;
            }
            
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
        // Applies detection settings filtering (unlike atomic testing/scenario)
        const payload = message.payload as { content: string; url: string };
        try {
          if (detectionEngine) {
            const result = await detectionEngine.scan(payload.content);
            
            // Get detection settings to filter results (using disabled arrays)
            const settings = await getSettings();
            const disabledObservableTypes = settings.detection?.disabledObservableTypes || [];
            const disabledOpenCTITypes = settings.detection?.disabledOpenCTITypes || [];
            
            // Filter observables - exclude disabled types (empty = all enabled)
            const filteredObservables = result.observables.filter(obs => 
              !disabledObservableTypes.includes(obs.type)
            );
            
            // Filter OpenCTI entities - exclude disabled types (empty = all enabled)
            const filteredOpenctiEntities = result.openctiEntities.filter(entity => 
              !disabledOpenCTITypes.includes(entity.type)
            );
            
            // Return OpenCTI results - openaevEntities from other platforms are handled by SCAN_ALL
            const scanResult: ScanResultPayload = {
              observables: filteredObservables,
              openctiEntities: filteredOpenctiEntities,
              cves: result.cves, // CVEs are always included
              openaevEntities: [], // OpenCTI entities are in observables/openctiEntities/cves
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
      
      // SCAN_PLATFORM / SCAN_OAEV scans for platform-specific entities
      // For global scanning across all platforms, use SCAN_ALL instead
      // If includeAttackPatterns is true, also includes attack patterns (for atomic testing)
      // Currently only supports 'openaev' platformType (future: can be extended for other platforms)
      case 'SCAN_OAEV':
      case 'SCAN_PLATFORM': {
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
          
          const openaevEntitiesResult: ScanResultPayload['openaevEntities'] = [];
          const originalText = payload.content;
          // Also create a refanged version of the text for searching
          // This allows finding defanged indicators like honey[.]scanme[.]sh when cache has honey.scanme.sh
          const refangedText = refangIndicator(originalText);
          const textLower = originalText.toLowerCase();
          const refangedTextLower = refangedText.toLowerCase();
          const seenEntities = new Set<string>();
          const seenRanges = new Set<string>();
          
          // Sort by name length (longest first) to match longer names before substrings
          const sortedEntities = Array.from(oaevEntityMap.entries()).sort((a, b) => b[0].length - a[0].length);
          
          for (const [nameLower, entities] of sortedEntities) {
            // Skip short names
            if (nameLower.length < 4) continue;
            
            // Search in both original text and refanged text
            // This allows finding both "honey.scanme.sh" and "honey[.]scanme[.]sh"
            const searchTargets = [
              { text: textLower, originalText: originalText, isRefanged: false },
              { text: refangedTextLower, originalText: refangedText, isRefanged: true },
            ];
            
            let foundMatch = false;
            for (const target of searchTargets) {
              if (foundMatch) break;
              
              let searchStart = 0;
              let matchIndex = target.text.indexOf(nameLower, searchStart);
              
              while (matchIndex !== -1) {
                const endIndex = matchIndex + nameLower.length;
                
                // Check character boundaries to ensure exact word match
                const charBefore = matchIndex > 0 ? target.originalText[matchIndex - 1] : ' ';
                const charAfter = endIndex < target.originalText.length ? target.originalText[endIndex] : ' ';
                
                // Valid boundary: whitespace, punctuation, or start/end of string
                const isValidBoundary = (c: string) => 
                  /[\s,;:!?()[\]"'<>/\\@#$%^&*+=|`~\n\r\t]/.test(c) || c === '';
                
                // For names with hyphens/underscores, also check if the boundary char is NOT alphanumeric
                const beforeOk = isValidBoundary(charBefore) || !/[a-zA-Z0-9]/.test(charBefore);
                const afterOk = isValidBoundary(charAfter) || !/[a-zA-Z0-9]/.test(charAfter);
                
                if (beforeOk && afterOk) {
                  // For parent MITRE techniques (e.g., T1566), skip if followed by a dot
                  const isParentMitreId = /^t[as]?\d{4}$/i.test(nameLower);
                  if (isParentMitreId && charAfter === '.') {
                    searchStart = matchIndex + 1;
                    matchIndex = target.text.indexOf(nameLower, searchStart);
                    continue;
                  }
                  
                  // For refanged text matches, we need to map back to original text position
                  // This is approximate - we use the refanged position but display the original value
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
                    const matchedText = target.originalText.substring(matchIndex, endIndex);
                    
                    // Add ALL entities with this name (supports multiple types)
                    for (const entity of entities) {
                      // Skip AttackPatterns unless explicitly requested (for atomic testing)
                      if (entity.type === 'AttackPattern' && !includeAttackPatterns) continue;
                      // Skip already seen entities
                      if (seenEntities.has(entity.id)) continue;
                      
                      log.debug(`SCAN_OAEV: Found "${entity.name}" (${entity.type}) at position ${matchIndex}${target.isRefanged ? ' (refanged search)' : ''}`);
                      openaevEntitiesResult.push({
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
                    }
                    
                    seenRanges.add(rangeKey);
                    foundMatch = true;
                    break;
                  }
                }
                
                searchStart = matchIndex + 1;
                matchIndex = target.text.indexOf(nameLower, searchStart);
              }
            }
          }
          
          const attackPatternCount = openaevEntitiesResult.filter(e => e.type === 'AttackPattern').length;
          const assetCount = openaevEntitiesResult.length - attackPatternCount;
          log.debug(`SCAN_OAEV: Found ${assetCount} assets and ${attackPatternCount} attack patterns`);
          
          const scanResult = {
            openaevEntities: openaevEntitiesResult,
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
      // Results include: observables, openctiEntities, cves, openaevEntities
      // Each result includes platform information so the UI can differentiate where entities come from
      case 'SCAN_ALL': {
        const payload = message.payload as { content: string; url: string };
        try {
          // Count configured platforms for logging
          const octiPlatformCount = openCTIClients.size;
          const oaevPlatformCount = openAEVClients.size;
          log.info(`SCAN_ALL: Starting unified scan across ALL configured platforms (${octiPlatformCount} OpenCTI, ${oaevPlatformCount} OpenAEV)...`);
          
          // Initialize results
          let openctiResult: { observables: DetectedObservable[]; openctiEntities: DetectedOCTIEntity[]; cves: DetectedOCTIEntity[] } = {
            observables: [],
            openctiEntities: [],
            cves: [],
          };
          const openaevEntities: ScanResultPayload['openaevEntities'] = [];
          
          // 1. Scan OpenCTI (detection engine scans ALL OpenCTI platforms' caches)
          if (detectionEngine) {
            try {
              log.debug(`SCAN_ALL: Scanning ${octiPlatformCount} OpenCTI platform(s) for observables, OpenCTI entities, and CVEs...`);
              const octiResult = await detectionEngine.scan(payload.content);
              openctiResult = {
                observables: octiResult.observables || [],
                openctiEntities: octiResult.openctiEntities || [],
                cves: octiResult.cves || [],
              };
              log.debug(`SCAN_ALL: OpenCTI found ${openctiResult.observables.length} observables, ${openctiResult.openctiEntities.length} OpenCTI entities, ${openctiResult.cves.length} CVEs across ${octiPlatformCount} platform(s)`);
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
              
              for (const [nameLower, entities] of sortedEntities) {
                // Skip short names
                if (nameLower.length < 4) continue;
                
                let searchStart = 0;
                let matchIndex = textLower.indexOf(nameLower, searchStart);
                
                while (matchIndex !== -1) {
                  const endIndex = matchIndex + nameLower.length;
                  
                  const charBefore = matchIndex > 0 ? originalText[matchIndex - 1] : ' ';
                  const charAfter = endIndex < originalText.length ? originalText[endIndex] : ' ';
                  
                  const isValidBoundary = (c: string) => 
                    /[\s,;:!?()[\]"'<>/\\@#$%^&*+=|`~\n\r\t]/.test(c) || c === '';
                  
                  const beforeOk = isValidBoundary(charBefore) || !/[a-zA-Z0-9]/.test(charBefore);
                  const afterOk = isValidBoundary(charAfter) || !/[a-zA-Z0-9]/.test(charAfter);
                  
                  if (beforeOk && afterOk) {
                    // For parent MITRE techniques (e.g., T1566), skip if followed by a dot
                    // This avoids detecting "T1566" when the text is "T1566.001" (sub-technique)
                    const isParentMitreId = /^t[as]?\d{4}$/i.test(nameLower);
                    if (isParentMitreId && charAfter === '.') {
                      // This parent technique is followed by a dot, likely part of a sub-technique
                      searchStart = matchIndex + 1;
                      matchIndex = textLower.indexOf(nameLower, searchStart);
                      continue;
                    }
                    
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
                      
                      // Add ALL entities with this name (supports multiple types)
                      for (const entity of entities) {
                        // Skip already seen entities
                        if (seenEntities.has(entity.id)) continue;
                        
                        openaevEntities.push({
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
                      }
                      
                      seenRanges.add(rangeKey);
                      break;
                    }
                  }
                  
                  searchStart = matchIndex + 1;
                  matchIndex = textLower.indexOf(nameLower, searchStart);
                }
              }
              log.debug(`SCAN_ALL: OpenAEV found ${openaevEntities.length} entities across ${oaevPlatformCount} platform(s)`);
            } else {
              log.debug(`SCAN_ALL: No OpenAEV entities in cache (scanned ${oaevPlatformCount} platform(s))`);
            }
          } catch (oaevError) {
            log.warn('SCAN_ALL: OpenAEV scan failed:', oaevError);
          }
          
          // Get detection settings to filter results (using disabled arrays)
          // Note: Detection settings only affect global scan, NOT atomic testing or scenario generation
          const settings = await getSettings();
          const disabledObservableTypes = settings.detection?.disabledObservableTypes || [];
          const disabledOpenCTITypes = settings.detection?.disabledOpenCTITypes || [];
          const disabledOpenAEVTypes = settings.detection?.disabledOpenAEVTypes || [];
          
          // Filter OpenCTI results - exclude disabled types (empty = all enabled)
          const filteredObservables = openctiResult.observables.filter(obs => 
            !disabledObservableTypes.includes(obs.type)
          );
          const filteredOpenctiEntities = openctiResult.openctiEntities.filter(entity => 
            !disabledOpenCTITypes.includes(entity.type)
          );
          
          // Filter OpenAEV entities - exclude disabled types (empty = all enabled)
          const filteredOpenaevEntities = openaevEntities.filter(entity => 
            !disabledOpenAEVTypes.includes(entity.type)
          );
          
          // Combine filtered results
          const scanResult: ScanResultPayload = {
            observables: filteredObservables,
            openctiEntities: filteredOpenctiEntities,
            cves: openctiResult.cves, // CVEs are always included
            openaevEntities: filteredOpenaevEntities,
            scanTime: 0,
            url: payload.url,
          };
          
          const totalFound = 
            scanResult.observables.filter(o => o.found).length +
            scanResult.openctiEntities.filter(s => s.found).length +
            (scanResult.openaevEntities?.length || 0);
          log.info(`SCAN_ALL: Unified scan complete across ${octiPlatformCount + oaevPlatformCount} total platforms. Found: ${totalFound} entities (after detection settings filter)`);
          
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
      
      case 'FETCH_OAEV_TEAMS': {
        const { platformId } = message.payload as { platformId?: string };
        
        try {
          const client = platformId ? openAEVClients.get(platformId) : openAEVClients.values().next().value;
          if (!client) {
            sendResponse(errorResponse('OpenAEV not configured'));
            break;
          }
          
          const teams = await client.getAllTeams();
          sendResponse(successResponse(teams));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch teams',
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
        // Supports both simple DNS resolution format AND generic payload format
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
            // Simple DNS resolution format (shorthand)
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
          
          // Get all kill chain phases first for reference (needed to resolve phase IDs to names)
          const killChainPhases = await client.getKillChainPhases();
          
          // Create a map of phase ID to phase info for quick lookups
          const phaseIdToInfo: Map<string, { name: string; killChainName: string; order: number }> = new Map();
          killChainPhases.forEach((phase: OAEVKillChainPhase) => {
            if (phase.phase_id) {
              phaseIdToInfo.set(phase.phase_id, {
                name: phase.phase_name,
                killChainName: phase.phase_kill_chain_name,
                order: phase.phase_order,
              });
            }
          });
          
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
              const contracts = allContracts.filter((contract: OAEVInjectorContract) => {
                const contractApIds: string[] = contract.injector_contract_attack_patterns || [];
                // Each item in the array is a UUID string, not an object
                // Match by UUID directly
                return contractApIds.includes(attackPatternUuid) || contractApIds.includes(id);
              });
              
              log.debug('[FETCH_SCENARIO_OVERVIEW] Contracts for', ap?.attack_pattern_name || id, 
                '(uuid:', attackPatternUuid, '):', contracts.length,
                'Sample contract APs:', allContracts.slice(0, 2).map((c: OAEVInjectorContract) => c.injector_contract_attack_patterns));
              
              // Resolve kill chain phase IDs to phase names
              const rawKillChainPhases: string[] = ap?.attack_pattern_kill_chain_phases || [];
              const resolvedKillChainPhases = rawKillChainPhases.map(phaseId => {
                const phaseInfo = phaseIdToInfo.get(phaseId);
                // Return the phase name if found, otherwise the original ID
                return phaseInfo?.name || phaseId;
              }).filter(name => name && name.length > 0);
              
              return {
                id: attackPatternUuid,
                name: ap?.attack_pattern_name || 'Unknown',
                externalId: ap?.attack_pattern_external_id || '',
                description: ap?.attack_pattern_description || '',
                killChainPhases: resolvedKillChainPhases,
                contracts,
              };
            })
          );
          
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
      
      case 'CREATE_SCENARIO':
        await handleCreateScenario(message.payload as CreateScenarioPayload, sendResponse, getOpenAEVClient);
        break;
      
      case 'ADD_INJECT_TO_SCENARIO':
        await handleAddInjectToScenario(message.payload as AddInjectPayload, sendResponse, getOpenAEVClient);
        break;
      
      case 'ADD_EMAIL_INJECT_TO_SCENARIO':
        await handleAddEmailInjectToScenario(message.payload as AddEmailInjectPayload, sendResponse, getOpenAEVClient);
        break;
      
      case 'ADD_TECHNICAL_INJECT_TO_SCENARIO':
        await handleAddTechnicalInjectToScenario(message.payload as AddTechnicalInjectPayload, sendResponse, getOpenAEVClient);
        break;
      
      case 'GET_ENTITY_DETAILS': {
        // Unified entity details handler for all platforms
        // platformType determines which platform type to query
        // To add a new platform: add a case in the switch below
        const { id, entityType, platformId: specificPlatformId, platformType } = message.payload as {
          id: string;
          entityType: string;
          platformId?: string;
          platformType?: PlatformType;
        };
        
        const targetPlatformType = platformType || 'opencti';
        
        try {
          switch (targetPlatformType) {
            case 'opencti': {
              if (openCTIClients.size === 0) {
                sendResponse(errorResponse('OpenCTI not configured'));
                break;
              }
              
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
                    sendResponse({ success: true, data: { ...entity, _platformId: specificPlatformId, _platformType: 'opencti' } });
                  } else {
                    sendResponse(errorResponse('Entity not found'));
                  }
                } catch (e) {
                  sendResponse(errorResponse('Entity not found or timeout'));
                }
              } else {
                // Search all OpenCTI platforms in PARALLEL
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
                  sendResponse({ success: true, data: { ...found.entity, _platformId: found.platformId, _platformType: 'opencti' } });
                } else {
                  sendResponse(errorResponse('Entity not found in any OpenCTI platform'));
                }
              }
              break;
            }
            
            case 'openaev': {
              if (!specificPlatformId) {
                sendResponse(errorResponse('platformId is required for OpenAEV'));
                break;
              }
              
              const oaevClient = openAEVClients.get(specificPlatformId);
              if (!oaevClient) {
                sendResponse(errorResponse('OpenAEV platform not found'));
                break;
              }
              
              const oaevTimeoutPromise = new Promise<null>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), ENTITY_FETCH_TIMEOUT_MS)
              );
              
              // Ensure caches are populated for resolution
              await oaevClient.ensureTagsCached();
              
              // For AttackPattern entities, also cache kill chain phases and attack patterns
              const normalizedEntityType = entityType.replace(/^oaev-/, '');
              if (normalizedEntityType === 'AttackPattern') {
                await Promise.all([
                  oaevClient.ensureKillChainPhasesCached(),
                  oaevClient.ensureAttackPatternsCached(),
                ]);
              }
              
              const oaevEntity = await Promise.race([
                oaevClient.getEntityById(id, entityType),
                oaevTimeoutPromise
              ]);
              
              if (oaevEntity) {
                // Resolve tags if present (convert IDs to labels)
                if (oaevEntity.asset_tags && Array.isArray(oaevEntity.asset_tags)) {
                  oaevEntity.asset_tags_resolved = oaevClient.resolveTagIds(oaevEntity.asset_tags);
                }
                if (oaevEntity.endpoint_tags && Array.isArray(oaevEntity.endpoint_tags)) {
                  oaevEntity.endpoint_tags_resolved = oaevClient.resolveTagIds(oaevEntity.endpoint_tags);
                }
                if (oaevEntity.team_tags && Array.isArray(oaevEntity.team_tags)) {
                  oaevEntity.team_tags_resolved = oaevClient.resolveTagIds(oaevEntity.team_tags);
                }
                if (oaevEntity.asset_group_tags && Array.isArray(oaevEntity.asset_group_tags)) {
                  oaevEntity.asset_group_tags_resolved = oaevClient.resolveTagIds(oaevEntity.asset_group_tags);
                }
                if (oaevEntity.scenario_tags && Array.isArray(oaevEntity.scenario_tags)) {
                  oaevEntity.scenario_tags_resolved = oaevClient.resolveTagIds(oaevEntity.scenario_tags);
                }
                if (oaevEntity.exercise_tags && Array.isArray(oaevEntity.exercise_tags)) {
                  oaevEntity.exercise_tags_resolved = oaevClient.resolveTagIds(oaevEntity.exercise_tags);
                }
                
                // For AttackPattern: resolve kill chain phase IDs and parent technique ID
                if (normalizedEntityType === 'AttackPattern') {
                  if (oaevEntity.attack_pattern_kill_chain_phases && Array.isArray(oaevEntity.attack_pattern_kill_chain_phases)) {
                    oaevEntity.attack_pattern_kill_chain_phases_resolved = oaevClient.resolveKillChainPhaseIds(oaevEntity.attack_pattern_kill_chain_phases);
                  }
                  if (oaevEntity.attack_pattern_parent) {
                    oaevEntity.attack_pattern_parent_resolved = oaevClient.resolveAttackPatternId(oaevEntity.attack_pattern_parent);
                  }
                }
                
                sendResponse({ 
                  success: true, 
                  data: {
                    ...oaevEntity,
                    _platformId: specificPlatformId,
                    _platformType: 'openaev',
                    _entityType: entityType,
                  }
                });
              } else {
                sendResponse(errorResponse('Entity not found'));
              }
              break;
            }
            
            default:
              sendResponse({ success: false, error: `Unsupported platform type: ${targetPlatformType}` });
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

      case 'CREATE_ENTITY': {
        // Create any entity type (SDO or SCO) - used by context menu "Add to OpenCTI"
        const entityPayload = message.payload as {
          type: string;
          value: string;
          name?: string;
          platformId?: string;
        };

        // Get client for specified platform or default
        const targetPlatformId = entityPayload.platformId || openCTIClients.keys().next().value as string | undefined;
        const targetClient = targetPlatformId ? openCTIClients.get(targetPlatformId) : openCTIClient;

        if (!targetClient) {
          sendResponse(errorResponse('No OpenCTI platform configured'));
          break;
        }

        try {
          // Refang the value before creating (OpenCTI stores clean values)
          const cleanValue = refangIndicator(entityPayload.value);
          // Use createEntity which handles both SDOs and SCOs
          const created = await targetClient.createEntity({
            type: entityPayload.type,
            value: cleanValue,
            name: entityPayload.name || cleanValue,
          });
          sendResponse(successResponse(created));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create entity',
          });
        }
        break;
      }
      
      case 'CREATE_CONTAINER':
        await handleCreateContainer(message.payload as CreateContainerPayload, sendResponse, openCTIClients);
        break;
      
      case 'GET_PLATFORM_THEME': {
        // Get user's theme setting - strictly from configuration
        const themeSettings = await getSettings();
        // Theme is strictly from settings - default to dark
        const themeMode: 'dark' | 'light' = themeSettings.theme === 'light' ? 'light' : 'dark';
        sendResponse(successResponse(themeMode));
        break;
      }
      
      case 'SEARCH_PLATFORM': {
        // Unified search handler for all platforms
        // platformType determines which platform(s) to search
        // To add a new platform: add a case in the switch below
        const { searchTerm, types, limit, platformId, platformType } = message.payload as {
          searchTerm: string;
          types?: string[];
          limit?: number;
          platformId?: string;
          platformType?: PlatformType; // If not provided, searches OpenCTI by default
        };
        
        const targetPlatformType = platformType || 'opencti';
        
        try {
          switch (targetPlatformType) {
            case 'opencti': {
              if (openCTIClients.size === 0) {
                sendResponse(errorResponse('OpenCTI not configured'));
                break;
              }
              
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
                  return { platformId: pId, results: results.map((r) => ({ ...r, _platformId: pId })) };
                } catch (e) {
                  log.warn(`Search timeout/error for platform ${pId}:`, e);
                  return { platformId: pId, results: [] };
                }
              });
              
              const searchResults = await Promise.all(searchPromises);
              const allResults = searchResults.flatMap(r => r.results);
              sendResponse(successResponse(allResults));
              break;
            }
            
            case 'openaev': {
              if (openAEVClients.size === 0) {
                sendResponse(errorResponse('OpenAEV not configured'));
                break;
              }
              
              // Search across all OpenAEV platforms in PARALLEL with timeout
              const oaevClientsToSearch = platformId 
                ? [[platformId, openAEVClients.get(platformId)] as const].filter(([_, c]) => c)
                : Array.from(openAEVClients.entries());
              
              const oaevSearchPromises = oaevClientsToSearch.map(async ([pId, client]) => {
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
                  const results: Record<string, unknown>[] = [];
                  const platformInfo = client.getPlatformInfo();
                  
                  for (const [className, data] of Object.entries(searchResult)) {
                    if (data && (data as { count: number }).count > 0) {
                      // Fetch actual results for this class
                      const classResults = await client.fullTextSearchByClass(className, {
                        textSearch: searchTerm,
                        page: 0,
                        size: 20,
                      });
                      
                      results.push(...classResults.content.map((r: Record<string, unknown>) => ({
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
              
              const oaevSearchResults = await Promise.all(oaevSearchPromises);
              const allOaevResults = oaevSearchResults.flatMap(r => r.results);
              sendResponse(successResponse(allOaevResults));
              break;
            }
            
            default:
              sendResponse({ success: false, error: `Unsupported platform type: ${targetPlatformType}` });
          }
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
          const results: Record<string, unknown>[] = [];
          
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
      
      case 'GENERATE_SCENARIO': {
        const { pageTitle, pageContent: _pageContent, pageUrl, platformId } = message.payload as {
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
            // Note: scenario_tags expects tag IDs (UUIDs), not names
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
      
      case 'REFRESH_CACHE': {
        if (openCTIClients.size === 0 && openAEVClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        try {
          // Refresh both OpenCTI and OpenAEV caches
          const refreshPromises: Promise<void>[] = [];
          if (openCTIClients.size > 0) {
            refreshPromises.push(refreshOCTICache());
          }
          if (openAEVClients.size > 0) {
            refreshPromises.push(refreshOAEVCache());
          }
          await Promise.all(refreshPromises);
          
          const stats = await getOCTICacheStats();
          sendResponse(successResponse(stats));
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Cache refresh failed',
          });
        }
        break;
      }
      
      case 'GET_CACHE_STATS': {
        try {
          const multiCache = await getMultiPlatformOCTICache();
          const oaevMultiCache = await getMultiPlatformOAEVCache();
          
          // Build per-platform stats for OpenCTI
          const openctiPlatformStats: Array<{
            platformId: string;
            platformName: string;
            total: number;
            timestamp: number;
            age: number;
            byType: Record<string, number>;
          }> = [];
          
          // Build per-platform stats for OpenAEV
          const oaevPlatformStats: Array<{
            platformId: string;
            platformName: string;
            total: number;
            timestamp: number;
            age: number;
            byType: Record<string, number>;
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
            const byType: Record<string, number> = {};
            for (const [type, entities] of Object.entries(cache.entities)) {
              const count = entities.length;
              if (count > 0) {
                byType[type] = count;
              }
              platformTotal += count;
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
              byType,
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
                byType: {},
              });
            }
          }
          
          // OpenAEV stats - include all configured platforms (even if not yet cached)
          const processedOaevPlatforms = new Set<string>();
          let oaevGrandTotal = 0;
          for (const [platformId, cache] of Object.entries(oaevMultiCache.platforms)) {
            let platformTotal = 0;
            const byType: Record<string, number> = {};
            for (const [type, entities] of Object.entries(cache.entities)) {
              const count = entities.length;
              if (count > 0) {
                byType[type] = count;
              }
              platformTotal += count;
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
              byType,
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
                byType: {},
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
              isRefreshing: getCacheRefreshStatus().octi || getCacheRefreshStatus().oaev,
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
        // Return combined refresh status for both OpenCTI and OpenAEV caches
        const cacheStatus = getCacheRefreshStatus();
        sendResponse({ success: true, data: { isRefreshing: cacheStatus.octi || cacheStatus.oaev } });
        break;
      }
      
      case 'CLEAR_PLATFORM_CACHE': {
        // Unified cache clearing handler for all platforms
        // To add a new platform: add a case in the switch below
        const { platformId, platformType } = (message.payload as { 
          platformId?: string;
          platformType?: PlatformType;
        }) || {};
        
        const targetPlatformType = platformType || 'opencti';
        
        try {
          switch (targetPlatformType) {
            case 'opencti':
              if (platformId) {
                await clearOCTICacheForPlatform(platformId);
              } else {
                await clearAllOCTICaches();
              }
              break;
            case 'openaev':
              if (platformId) {
                await clearOAEVCacheForPlatform(platformId);
              } else {
                await clearAllOAEVCaches();
              }
              break;
            default:
              sendResponse({ success: false, error: `Unsupported platform type: ${targetPlatformType}` });
              break;
          }
          if (targetPlatformType === 'opencti' || targetPlatformType === 'openaev') {
            sendResponse(successResponse(null));
          }
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to clear cache' 
          });
        }
        break;
      }
      
      // Panel state management - store and forward to side panel
      case 'SHOW_CONTAINER_PANEL':
      case 'SHOW_UNIFIED_SEARCH_PANEL':
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
          const allLabels: (Label & { _platformId: string })[] = [];
          const allMarkings: (Partial<MarkingDefinition> & { id: string; _platformId: string })[] = [];
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
            
            const allLabels: (Label & { _platformId: string })[] = [];
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
            
            const allMarkings: (Partial<MarkingDefinition> & { id: string; _platformId: string })[] = [];
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
        
        const { entities, platformId, createIndicator: _createIndicator } = message.payload as { 
          entities: Array<{ type: string; value?: string; name?: string }>;
          platformId?: string;
          createIndicator?: boolean;
        };
        
        // Use specified platform or first available
        const targetPlatformId = platformId || (openCTIClients.keys().next().value as string);
        const client = openCTIClients.get(targetPlatformId);
        if (!client) {
          sendResponse(errorResponse('Platform not found'));
          break;
        }
        
        try {
          const results = await Promise.all(
            entities.map(async (e) => {
              // Refang values before creating (OpenCTI stores clean values)
              const value = e.value ? refangIndicator(e.value) : undefined;
              const name = e.name || e.value;
              
              // Use the unified createEntity method that handles both SDOs and SCOs
              const created = await client.createEntity({
                type: e.type,
                value,
                name,
              });
              
              // Add created OpenCTI entities to cache (not observables)
              // Entity types that are cached: Threat-Actor-Group, Threat-Actor-Individual, Intrusion-Set, etc.
              if (created?.id && created?.entity_type) {
                const openctiEntityTypes = [
                  'Threat-Actor-Group', 'Threat-Actor-Individual', 'Intrusion-Set',
                  'Campaign', 'Incident', 'Malware', 'Attack-Pattern', 'Sector',
                  'Organization', 'Individual', 'Event', 'Country', 'Region',
                  'City', 'Administrative-Area', 'Position'
                ];
                
                if (openctiEntityTypes.includes(created.entity_type)) {
                  const cachedEntity: CachedOCTIEntity = {
                    id: created.id,
                    name: created.name || name || '',
                    aliases: created.aliases,
                    x_mitre_id: created.x_mitre_id,
                    type: created.entity_type,
                    platformId: targetPlatformId,
                  };
                  
                  await addEntityToOCTICache(cachedEntity, targetPlatformId);
                  log.debug(`Added ${created.entity_type} "${cachedEntity.name}" to cache for platform ${targetPlatformId}`);
                }
              }
              
              return created;
            })
          );
          sendResponse(successResponse(results));
        } catch (error) {
          log.error('[CREATE_OBSERVABLES_BULK] Error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create entities',
          });
        }
        break;
      }
      
      case 'CREATE_INVESTIGATION_WITH_ENTITIES': {
        if (!openCTIClient || openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        const { entities: investigationEntities } = message.payload as { 
          entities: Array<{ id?: string; type: string; value?: string; name?: string }> 
        };
        
        // Get the platform ID for the default client
        const defaultPlatformId = openCTIClients.keys().next().value as string;
        
        try {
          // Create any entities that don't exist
          const entityIds: string[] = [];
          for (const entity of investigationEntities) {
            if (entity.id) {
              entityIds.push(entity.id);
            } else if (entity.value || entity.name) {
              // Use the unified createEntity method that handles both SDOs and SCOs
              const created = await openCTIClient.createEntity({ 
                type: entity.type, 
                value: entity.value,
                name: entity.name,
              });
              if (created?.id) {
                entityIds.push(created.id);
                
                // Add created SDO entities to cache
                if (created?.entity_type) {
                  const sdoTypes = [
                    'Threat-Actor-Group', 'Threat-Actor-Individual', 'Intrusion-Set',
                    'Campaign', 'Incident', 'Malware', 'Attack-Pattern', 'Sector',
                    'Organization', 'Individual', 'Event', 'Country', 'Region',
                    'City', 'Administrative-Area', 'Position'
                  ];
                  
                  if (sdoTypes.includes(created.entity_type)) {
                    const cachedEntity: CachedOCTIEntity = {
                      id: created.id,
                      name: created.name || entity.name || entity.value || '',
                      aliases: created.aliases,
                      x_mitre_id: created.x_mitre_id,
                      type: created.entity_type,
                      platformId: defaultPlatformId,
                    };
                    
                    await addEntityToOCTICache(cachedEntity, defaultPlatformId);
                    log.debug(`Added ${created.entity_type} "${cachedEntity.name}" to cache for platform ${defaultPlatformId}`);
                  }
                }
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
          log.error('[CREATE_INVESTIGATION_WITH_ENTITIES] Error:', error);
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
              return { platformId: pId, containers: containers.map((c) => ({ ...c, _platformId: pId })) };
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
              return { platformId: pId, containers: containers.map((c) => ({ ...c, _platformId: pId })) };
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
      // AI Feature Handlers (extracted to handlers/ai-handlers.ts)
      // ========================================================================
      
      case 'AI_CHECK_STATUS':
        await handleAICheckStatus(sendResponse);
        break;
      
      case 'AI_TEST_AND_FETCH_MODELS':
        await handleAITestAndFetchModels(message.payload as { provider: string; apiKey: string }, sendResponse);
        break;
      
      case 'AI_GENERATE_DESCRIPTION':
        await handleAIGenerateDescription(message.payload as ContainerDescriptionRequest, sendResponse);
        break;
      
      case 'AI_GENERATE_SCENARIO':
        await handleAIGenerateScenario(message.payload as ScenarioGenerationRequest, sendResponse);
        break;
      
      case 'AI_GENERATE_FULL_SCENARIO':
        await handleAIGenerateFullScenario(message.payload as FullScenarioRequest, sendResponse);
        break;
      
      case 'AI_GENERATE_ATOMIC_TEST':
        await handleAIGenerateAtomicTest(message.payload as AtomicTestRequest, sendResponse);
        break;
      
      case 'AI_GENERATE_EMAILS':
        await handleAIGenerateEmails(message.payload as EmailGenerationRequest, sendResponse);
        break;
      
      case 'AI_DISCOVER_ENTITIES':
        await handleAIDiscoverEntities(message.payload as EntityDiscoveryRequest, sendResponse);
        break;
      
      case 'AI_RESOLVE_RELATIONSHIPS':
        await handleAIResolveRelationships(message.payload as RelationshipResolutionRequest, sendResponse);
        break;
      
      case 'GENERATE_NATIVE_PDF': {
        // Generate PDF using Chrome's native print-to-PDF via Debugger API
        const { tabId } = message.payload as { tabId: number };
        
        if (!isNativePDFAvailable()) {
          log.warn('Native PDF generation not available (debugger API not present)');
          sendResponse({ success: false, error: 'Native PDF generation not available' });
          break;
        }
        
        try {
          log.debug(`Generating native PDF for tab ${tabId}`);
          const pdfData = await generateNativePDF(tabId, {
            displayHeaderFooter: true,
            printBackground: true,
            paperWidth: 8.27, // A4
            paperHeight: 11.69,
            marginTop: 0.5,
            marginBottom: 0.5,
            marginLeft: 0.5,
            marginRight: 0.5,
          });
          
          if (pdfData) {
            log.debug('Native PDF generated successfully, size:', pdfData.length);
            sendResponse({ success: true, data: pdfData });
          } else {
            log.warn('Native PDF generation returned no data');
            sendResponse({ success: false, error: 'PDF generation failed' });
          }
        } catch (error) {
          log.error('Native PDF generation error:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'PDF generation failed' 
          });
        }
        break;
      }
      
      case 'FETCH_IMAGE_AS_DATA_URL': {
        // Fetch image bypassing CORS (background script has elevated permissions)
        const { url } = message.payload as { url: string };
        
        if (!url) {
          sendResponse({ success: false, error: 'No URL provided' });
          break;
        }
        
        try {
          log.debug(`Fetching image: ${url}`);
          const response = await fetch(url, {
            mode: 'cors',
            credentials: 'omit',
            headers: {
              'Accept': 'image/*,*/*;q=0.8',
            },
          });
          
          if (!response.ok) {
            log.warn(`Image fetch failed: ${response.status} ${response.statusText}`);
            sendResponse({ success: false, error: `HTTP ${response.status}` });
            break;
          }
          
          const blob = await response.blob();
          
          // Convert blob to base64 data URL
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
          });
          
          log.debug(`Image fetched successfully: ${url.substring(0, 50)}...`);
          sendResponse({ success: true, dataUrl });
        } catch (error) {
          log.warn('Image fetch error:', url, error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Fetch failed' 
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
  if (!settings.autoScan) {
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

