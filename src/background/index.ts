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
  handleAIScanAll,
} from './handlers/ai-handlers';
import {
  handleAddTechnicalInjectToScenario,
  type AddTechnicalInjectPayload,
} from './handlers/scenario-handlers';
import {
  handleScanPage,
  handleScanOAEV,
  handleScanAll,
} from './handlers/scan-handlers';
import { handleCreateContainer } from './handlers/container-handlers';
import {
  handleGetEntityDetails,
  type GetEntityDetailsPayload,
} from './handlers/entity-handlers';
import {
  tryOpenSidePanel,
  getSidePanelTarget,
} from './handlers/misc-handlers';
import type {
  ContainerDescriptionRequest,
  ScenarioGenerationRequest,
  AtomicTestRequest,
  EntityDiscoveryRequest,
  RelationshipResolutionRequest,
  FullScenarioGenerationRequest,
  EmailGenerationRequest,
} from '../shared/api/ai/types';
import type { CreateContainerPayload, ExtensionMessage, ScanResultPayload } from '../shared/types/messages';
import { DetectionEngine } from '../shared/detection/detector';
import { refangIndicator } from '../shared/detection/patterns';
import { loggers } from '../shared/utils/logger';
import {
  type PlatformType,
} from '../shared/platform/registry';
import {
  CONNECTION_TIMEOUT_MS,
  SEARCH_TIMEOUT_MS,
  CONTAINER_FETCH_TIMEOUT_MS,
} from '../shared/constants';
import { successResponse, errorResponse } from '../shared/types/common';
import { searchAcrossPlatforms } from './handlers/platform-utils';
import {
  startOCTICacheRefresh,
  startOAEVCacheRefresh,
  refreshOCTICache,
  refreshOAEVCache,
  getCacheRefreshStatus,
  setOpenCTIClientGetter as setCacheManagerOCTIClientGetter,
  setOpenAEVClientGetter as setCacheManagerOAEVClientGetter,
} from './services/cache-manager';
import {
  setOpenCTIClientGetter as setClientManagerOCTIClientGetter,
  setOpenAEVClientGetter as setClientManagerOAEVClientGetter,
  setPrimaryOpenCTIClientGetter,
} from './services/client-manager';
import { dispatchMessage, hasHandler } from './services/message-dispatcher';

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
  // Cross-browser session storage
  sessionStorage,
} from '../shared/utils/storage';
import type { ExtensionSettings } from '../shared/types/settings';
import type {
  OCTILabel,
  OCTIMarkingDefinition,
} from '../shared/types/opencti';

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

/**
 * Check if a URL is a PDF file
 * Detects PDF URLs by extension or common PDF viewer patterns
 */
function isPdfUrl(url: string): boolean {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // Check file extension
  if (lowerUrl.endsWith('.pdf')) return true;
  
  // Check for .pdf with query params
  if (lowerUrl.includes('.pdf?') || lowerUrl.includes('.pdf#')) return true;
  
  // Check for common PDF viewer URLs (Chrome's built-in viewer)
  // Chrome PDF viewer URLs look like: chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/...
  if (lowerUrl.includes('mhjfbmdgcfjbbpaeojofohoefgiehjai')) return true;
  
  // Check for blob URLs with PDF content (common for dynamically loaded PDFs)
  if (lowerUrl.startsWith('blob:') && lowerUrl.includes('.pdf')) return true;
  
  // Check for file:// URLs with .pdf
  if (lowerUrl.startsWith('file://') && lowerUrl.includes('.pdf')) return true;
  
  return false;
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
            id: platform.id,
            name: platform.name,
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
  
  // Create detection engine with ALL OpenCTI and OpenAEV clients for multi-platform search
  if (openCTIClients.size > 0) {
    detectionEngine = new DetectionEngine(openCTIClients, openAEVClients);
  } else {
    detectionEngine = null;
  }
  
  // Also set OpenAEV clients on existing detection engine if any
  if (detectionEngine && openAEVClients.size > 0) {
    detectionEngine.setOAEVClients(openAEVClients);
  }
  
  // Set up side panel (Chrome/Edge)
  // Note: Panel title comes from the HTML <title> tag in panel/index.html
  if (chrome.sidePanel) {
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'panel/index.html',
    });
  }
  
  isInitialized = true;
  
  // Configure cache manager with client getters
  // This allows the cache manager to access the actual client instances
  setCacheManagerOCTIClientGetter(() => openCTIClients);
  setCacheManagerOAEVClientGetter(() => openAEVClients);
  
  // Configure client manager with client getters
  // This allows message handlers to access the actual client instances
  setClientManagerOCTIClientGetter(() => openCTIClients);
  setClientManagerOAEVClientGetter(() => openAEVClients);
  setPrimaryOpenCTIClientGetter(() => openCTIClient);
  
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
    title: 'Search across platforms',
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

/**
 * Open the side panel if split screen mode is enabled
 * Returns true if side panel was opened, false otherwise
 * 
 * On MacOS Chrome/Edge, the sidePanel API may require windowId instead of tabId
 */
async function openSidePanelIfEnabled(tabId: number): Promise<boolean> {
  try {
    const settings = await getSettings();
    if (settings.splitScreenMode && chrome.sidePanel) {
      // Try with tabId first (works best on Windows Chrome)
      try {
        await chrome.sidePanel.open({ tabId });
        return true;
      } catch {
        // Fallback: try with windowId (works better on MacOS Chrome/Edge)
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
            return true;
          }
        } catch (e) {
          log.debug('Side panel open failed with both tabId and windowId:', e);
        }
      }
    }
  } catch (error) {
    log.debug('Side panel open failed or not supported:', error);
  }
  return false;
}

/**
 * Ensure content script is loaded and send message to it.
 * If content script is not loaded, inject it first.
 */
async function ensureContentScriptAndSendMessage(
  tabId: number, 
  message: { type: string; payload?: unknown }
): Promise<void> {
  try {
    // First try to send the message directly
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Content script not loaded - inject it first
    log.debug('Content script not loaded, injecting...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/index.js'],
      });
      // Wait a bit for the script to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Retry sending the message
      await chrome.tabs.sendMessage(tabId, message);
    } catch (injectError) {
      log.error('Failed to inject content script:', injectError);
    }
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  
  // Open side panel if split screen mode is enabled
  await openSidePanelIfEnabled(tab.id);
  
  switch (info.menuItemId) {
    case 'xtm-scan-page':
      await ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_PAGE' });
      break;
      
    case 'xtm-scan-selection':
      if (info.selectionText) {
        await ensureContentScriptAndSendMessage(tab.id, {
          type: 'SEARCH_SELECTION',
          payload: { text: info.selectionText },
        });
      }
      break;
      
    case 'xtm-add-selection':
      if (info.selectionText) {
        await ensureContentScriptAndSendMessage(tab.id, {
          type: 'ADD_SELECTION',
          payload: { text: info.selectionText },
        });
      }
      break;
      
    case 'xtm-create-container':
      await ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_CONTAINER_FROM_PAGE' });
      break;
      
    case 'xtm-create-investigation':
      await ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_INVESTIGATION' });
      break;
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sendResponse, sender);
  return true; // Keep channel open for async response
});

// ============================================================================
// Message Handlers
// ============================================================================

async function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: unknown) => void,
  sender?: chrome.runtime.MessageSender
): Promise<void> {
  try {
    // First, try to dispatch to handler registry (for refactored handlers)
    if (hasHandler(message.type)) {
      const handled = await dispatchMessage(message, sendResponse as (response: { success: boolean; data?: unknown; error?: string }) => void);
      if (handled) return;
    }
    
    // Fall back to switch statement for handlers not yet migrated
    switch (message.type) {
      case 'GET_SETTINGS': {
        const settings = await getSettings();
        // Debug: Log platform EE status when settings are requested
        log.debug('GET_SETTINGS: OpenCTI platforms EE status:', 
          settings.openctiPlatforms?.map(p => ({ id: p.id, name: p.name, isEnterprise: p.isEnterprise })));
        // Note: Firefox uses browser.sidebarAction instead of chrome.sidePanel
        // Both Chrome/Edge (sidePanel) and Firefox (sidebarAction) support split screen mode
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
      
      case 'BROADCAST_SPLIT_SCREEN_MODE_CHANGE': {
        // Broadcast split screen mode change to all tabs
        const { enabled } = message.payload as { enabled: boolean };
        
        try {
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id) {
              try {
                await chrome.tabs.sendMessage(tab.id, {
                  type: 'SPLIT_SCREEN_MODE_CHANGED',
                  payload: { enabled },
                });
              } catch {
                // Tab might not have content script loaded
              }
            }
          }
          log.debug(`Broadcast split screen mode change (enabled=${enabled}) to ${tabs.length} tabs`);
        } catch (error) {
          log.debug('Failed to broadcast split screen mode change:', error);
        }
        
        sendResponse(successResponse(null));
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
      
      // ============================================================================
      // Scan Handlers
      // ============================================================================
      // These handlers require dependency injection (getDetectionEngine) so they
      // are handled in the switch statement rather than the message dispatcher.
      
      case 'SCAN_PAGE': {
        const scanDeps = {
          getDetectionEngine: () => detectionEngine,
          getOpenAEVClients: () => openAEVClients,
        };
        await handleScanPage(
          message.payload as { content: string; url: string },
          sendResponse as (response: { success: boolean; data?: unknown; error?: string }) => void,
          scanDeps
        );
        break;
      }
      
      case 'SCAN_OAEV':
      case 'SCAN_PLATFORM': {
        await handleScanOAEV(
          message.payload as { content: string; url: string; includeAttackPatterns?: boolean },
          sendResponse as (response: { success: boolean; data?: unknown; error?: string }) => void
        );
        break;
      }
      
      case 'SCAN_ALL': {
        const scanAllDeps = {
          getDetectionEngine: () => detectionEngine,
          getOpenAEVClients: () => openAEVClients,
        };
        await handleScanAll(
          message.payload as { content: string; url: string },
          sendResponse as (response: { success: boolean; data?: unknown; error?: string }) => void,
          scanAllDeps
        );
        break;
      }
      
      // ============================================================================
      // Scenario Handlers (remaining handlers not in openaevHandlers)
      // ============================================================================
      
      case 'ADD_TECHNICAL_INJECT_TO_SCENARIO':
        await handleAddTechnicalInjectToScenario(message.payload as AddTechnicalInjectPayload, sendResponse, getOpenAEVClient);
        break;
      
      case 'GET_ENTITY_DETAILS': {
        // Unified entity details handler for all platforms
        await handleGetEntityDetails(
          message.payload as GetEntityDetailsPayload,
          sendResponse,
          {
            getOpenCTIClients: () => openCTIClients,
            getOpenAEVClients: () => openAEVClients,
          }
        );
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
              
              // Search across all OpenCTI platforms using shared utility
              const allResults = await searchAcrossPlatforms(
                openCTIClients,
                platformId,
                (client) => client.globalSearch(cleanSearchTerm, types, limit),
                SEARCH_TIMEOUT_MS,
                'Global search'
              );
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
                        platformId: pId,
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
          // Create a basic scenario from page content
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
      
      case 'OPEN_SIDE_PANEL': {
        // Open the native side panel (Chrome/Edge only)
        // NOTE: Firefox sidebar must be opened from popup (requires user gesture context)
        try {
          const settings = await getSettings();
          
          if (settings.splitScreenMode && chrome.sidePanel) {
            const { tabId, windowId } = await getSidePanelTarget(sender?.tab);
            
            if (tabId || windowId) {
              const result = await tryOpenSidePanel(tabId, windowId, false);
              sendResponse(successResponse({ opened: result.opened }));
            } else {
              sendResponse(successResponse({ opened: false, reason: 'No tab found' }));
            }
          } else {
            sendResponse(successResponse({ opened: false, reason: 'Not applicable' }));
          }
        } catch (error) {
          log.error('Failed to open side panel:', error);
          sendResponse(successResponse({ opened: false, reason: 'Failed to open' }));
        }
        break;
      }
      
      case 'OPEN_SIDE_PANEL_IMMEDIATE': {
        // Open the native side panel immediately without checking settings
        // Content script should only send this when split screen mode is confirmed
        // This preserves the user gesture context for Edge compatibility
        try {
          if (chrome.sidePanel) {
            const { tabId, windowId } = await getSidePanelTarget(sender?.tab);
            
            if (tabId || windowId) {
              const result = await tryOpenSidePanel(tabId, windowId, true);
              
              if (result.opened) {
                sendResponse(successResponse({ opened: true }));
              } else {
                // Check if error is about user gesture - this is expected when popup already opened the panel
                const errorMessage = result.lastError instanceof Error ? result.lastError.message : String(result.lastError);
                const isUserGestureError = errorMessage.includes('user gesture');
                if (isUserGestureError) {
                  log.debug('Side panel requires user gesture (likely already opened by popup)');
                } else {
                  log.warn('Failed to open side panel with all strategies. Last error:', result.lastError);
                }
                sendResponse(successResponse({ opened: false, reason: isUserGestureError ? 'User gesture required (panel may already be open)' : 'Failed to open with all strategies' }));
              }
            } else {
              log.warn('No tab or window found for side panel');
              sendResponse(successResponse({ opened: false, reason: 'No tab or window found' }));
            }
          } else {
            // Firefox: sidebarAction.open() can only be called from popup (user gesture context)
            // The popup already opened the sidebar before sending messages, so we just return success
            // Messages are forwarded via FORWARD_TO_PANEL and will be received by the open sidebar
            log.debug('Firefox sidebar - popup handles opening, background just forwards messages');
            sendResponse(successResponse({ opened: true, reason: 'firefox_popup_handles' }));
          }
        } catch (error) {
          log.error('Failed to open side panel (outer catch):', error);
          sendResponse(successResponse({ opened: false, reason: 'Failed to open' }));
        }
        break;
      }
      
      case 'FORWARD_TO_PANEL': {
        // Forward messages to the native side panel in split screen mode
        const panelMessage = message.payload as { type: string; payload?: unknown };
        if (panelMessage) {
          // Add timestamp to help panel distinguish newer messages from stale ones
          const messageWithTimestamp = { ...panelMessage, timestamp: Date.now() };
          await sessionStorage.set('pendingPanelState', messageWithTimestamp);
          // Broadcast to any open extension pages (including the side panel)
          chrome.runtime.sendMessage({ 
            type: 'PANEL_MESSAGE_BROADCAST', 
            payload: messageWithTimestamp 
          }).catch(() => {
            // Ignore - no listeners (panel might not be open yet)
          });
        }
        sendResponse(successResponse(null));
        break;
      }
      
      case 'GET_LABELS_AND_MARKINGS': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('Not configured'));
          break;
        }
        
        try {
          // Aggregate labels and markings from all platforms
          const allOCTILabels: (OCTILabel & { platformId: string })[] = [];
          const allMarkings: (Partial<OCTIMarkingDefinition> & { id: string; platformId: string })[] = [];
          const seenOCTILabelIds = new Set<string>();
          const seenMarkingIds = new Set<string>();
          
          for (const [pId, client] of openCTIClients) {
            try {
              const [labels, markings] = await Promise.all([
                client.fetchLabels(),
                client.fetchMarkingDefinitions(),
              ]);
              // Deduplicate by ID
              for (const label of labels) {
                if (!seenOCTILabelIds.has(label.id)) {
                  seenOCTILabelIds.add(label.id);
                  allOCTILabels.push({ ...label, platformId: pId });
                }
              }
              for (const marking of markings) {
                if (!seenMarkingIds.has(marking.id)) {
                  seenMarkingIds.add(marking.id);
                  allMarkings.push({ ...marking, platformId: pId });
                }
              }
            } catch (e) {
              log.warn(`Failed to fetch labels/markings from platform ${pId}:`, e);
            }
          }
          
          sendResponse({ success: true, data: { labels: allOCTILabels, markings: allMarkings } });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch labels/markings',
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
              platformId: targetPlatformId,
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
              return { platformId: pId, containers: containers.map((c) => ({ ...c, platformId: pId })) };
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
              return { platformId: pId, containers: containers.map((c) => ({ ...c, platformId: pId })) };
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
        await handleAIGenerateFullScenario(message.payload as FullScenarioGenerationRequest, sendResponse);
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
      
      case 'AI_SCAN_ALL':
        await handleAIScanAll(message.payload as EntityDiscoveryRequest, sendResponse);
        break;
      
      // Note: GENERATE_NATIVE_PDF and FETCH_IMAGE_AS_DATA_URL are handled by dispatcher (misc-handlers.ts)
      
      // ============================================================================
      // PDF Scanner Handlers
      // ============================================================================
      
      case 'CHECK_IF_PDF': {
        // Check if the current active tab is viewing a PDF
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.url) {
            sendResponse(successResponse({ isPdf: false }));
            break;
          }
          
          const isPdf = isPdfUrl(tab.url);
          log.debug(`CHECK_IF_PDF: ${tab.url} -> ${isPdf}`);
          sendResponse(successResponse({ isPdf, url: tab.url }));
        } catch (error) {
          log.error('CHECK_IF_PDF error:', error);
          sendResponse(errorResponse('Failed to check if PDF'));
        }
        break;
      }
      
      // Note: OPEN_PDF_SCANNER is handled by message dispatcher (pdf-handlers.ts)
      
      case 'SCAN_PDF_CONTENT': {
        // Scan PDF text content for entities (reuses existing detection logic - same as SCAN_PAGE)
        const { content, url } = message.payload as { content: string; url: string };
        
        if (!content) {
          sendResponse(errorResponse('No content provided'));
          break;
        }
        
        try {
          log.debug(`Scanning PDF content, length: ${content.length}`);
          
          if (!detectionEngine) {
            sendResponse(errorResponse('Detection engine not initialized'));
            break;
          }
          
          // Get detection settings to respect user preferences
          const settings = await getSettings();
          const disabledObservableTypes = settings.detection?.disabledObservableTypes || [];
          const disabledOpenCTITypes = settings.detection?.disabledOpenCTITypes || [];
          
          // Determine vulnerability/CVE detection settings per platform
          const vulnSettings = {
            enabledForOpenCTI: !disabledOpenCTITypes.includes('Vulnerability'),
            enabledForOpenAEV: !(settings.detection?.disabledOpenAEVTypes || []).includes('Vulnerability'),
          };
          
          // Use the same scan method as SCAN_PAGE
          const result = await detectionEngine.scan(content, [], vulnSettings);
          
          // Filter observables - exclude disabled types
          const filteredObservables = result.observables.filter(obs => 
            !disabledObservableTypes.includes(obs.type)
          );
          
          // Filter OpenCTI entities - exclude disabled types
          const filteredOpenctiEntities = result.openctiEntities.filter(entity => 
            !disabledOpenCTITypes.includes(entity.type)
          );
          
          const scanResult: ScanResultPayload = {
            observables: filteredObservables,
            openctiEntities: filteredOpenctiEntities,
            cves: result.cves,
            openaevEntities: [],
            scanTime: result.scanTime,
            url,
          };
          
          log.debug(`PDF scan complete: ${filteredObservables.length} observables, ${filteredOpenctiEntities.length} entities`);
          sendResponse(successResponse(scanResult));
        } catch (error) {
          log.error('SCAN_PDF_CONTENT error:', error);
          sendResponse(errorResponse('Failed to scan PDF content'));
        }
        break;
      }
      
      // Note: OPEN_PDF_SCANNER_PANEL, PDF_SCANNER_RESCAN, FORWARD_TO_PDF_SCANNER,
      // and GET_PDF_CONTENT_FROM_PDF_SCANNER are handled by message dispatcher (pdf-handlers.ts)
      
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

