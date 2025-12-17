/**
 * Settings Message Handlers
 * 
 * Handles settings-related messages (get/save settings, test connections).
 */

import { loggers } from '../../shared/utils/logger';
import { OpenCTIClient, resetOpenCTIClient } from '../../shared/api/opencti-client';
import { OpenAEVClient } from '../../shared/api/openaev-client';
import { 
  getSettings, 
  saveSettings, 
  cleanupOrphanedCaches,
  cleanupOrphanedOAEVCaches,
} from '../../shared/utils/storage';
import { successResponse, errorResponse } from '../../shared/utils/messaging';
import { CONNECTION_TIMEOUT_MS } from '../../shared/constants';
import type { ExtensionSettings } from '../../shared/types';
import type { PlatformType } from '../../shared/platform';
import type { SendResponseFn } from './types';

const log = loggers.background;

/**
 * Dependency container for settings handlers
 */
export interface SettingsHandlerDependencies {
  getOpenCTIClients: () => Map<string, OpenCTIClient>;
  getOpenAEVClients: () => Map<string, OpenAEVClient>;
  getPrimaryOpenCTIClient: () => OpenCTIClient | null;
  initializeClient: () => Promise<void>;
  refreshSDOCache: () => Promise<void>;
  refreshOAEVCache: () => Promise<void>;
}

/**
 * Handle GET_SETTINGS
 */
export async function handleGetSettings(
  sendResponse: SendResponseFn
): Promise<void> {
  const settings = await getSettings();
  log.debug('GET_SETTINGS: OpenCTI platforms EE status:', 
    settings.openctiPlatforms?.map(p => ({ id: p.id, name: p.name, isEnterprise: p.isEnterprise })));
  sendResponse(successResponse(settings));
}

/**
 * Handle SAVE_SETTINGS
 */
export async function handleSaveSettings(
  payload: ExtensionSettings,
  sendResponse: SendResponseFn,
  deps: SettingsHandlerDependencies
): Promise<void> {
  log.debug('SAVE_SETTINGS: OpenCTI platforms EE status:', 
    payload.openctiPlatforms?.map(p => ({ id: p.id, name: p.name, isEnterprise: p.isEnterprise })));
  log.debug('SAVE_SETTINGS: OpenAEV platforms EE status:', 
    payload.openaevPlatforms?.map(p => ({ id: p.id, name: p.name, isEnterprise: p.isEnterprise })));
  
  await saveSettings(payload);
  
  // Clean up orphaned caches for OpenCTI
  const validOpenCTIPlatformIds = (payload.openctiPlatforms || [])
    .filter(p => p.url && p.apiToken)
    .map(p => p.id);
  await cleanupOrphanedCaches(validOpenCTIPlatformIds);
  
  // Clean up orphaned caches for OpenAEV
  const validOpenAEVPlatformIds = (payload.openaevPlatforms || [])
    .filter(p => p.url && p.apiToken)
    .map(p => p.id);
  await cleanupOrphanedOAEVCaches(validOpenAEVPlatformIds);
  
  // Reinitialize all clients with new settings
  resetOpenCTIClient();
  await deps.initializeClient();
  
  const openCTIClients = deps.getOpenCTIClients();
  const openAEVClients = deps.getOpenAEVClients();
  
  log.debug(`SAVE_SETTINGS: After initializeClient - OpenCTI clients: ${openCTIClients.size}, OpenAEV clients: ${openAEVClients.size}`);
  
  // Force cache refresh if we have any OpenCTI clients
  if (openCTIClients.size > 0) {
    log.debug('Forcing SDO cache refresh after settings save...');
    deps.refreshSDOCache().catch(err => {
      log.error('SDO cache refresh failed:', err);
    });
  }
  
  // Force OpenAEV cache refresh if we have any OpenAEV clients
  if (openAEVClients.size > 0) {
    log.info(`Forcing OpenAEV cache refresh after settings save (${openAEVClients.size} clients)...`);
    deps.refreshOAEVCache().catch(err => {
      log.error('OpenAEV cache refresh failed:', err);
    });
  } else {
    log.debug('SAVE_SETTINGS: No OpenAEV clients to refresh cache for');
  }
  
  sendResponse(successResponse(null));
}

/**
 * Handle TEST_CONNECTION - Primary OpenCTI only
 */
export async function handleTestConnection(
  sendResponse: SendResponseFn,
  deps: SettingsHandlerDependencies
): Promise<void> {
  const openCTIClient = deps.getPrimaryOpenCTIClient();
  
  if (!openCTIClient) {
    sendResponse(errorResponse('Client not configured'));
    return;
  }
  
  try {
    const info = await openCTIClient.testConnection();
    sendResponse(successResponse(info));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

/**
 * Handle TEST_PLATFORM_CONNECTION - Multi-platform support
 */
export async function handleTestPlatformConnection(
  payload: { platformId: string; platformType: PlatformType },
  sendResponse: SendResponseFn,
  deps: SettingsHandlerDependencies
): Promise<void> {
  const { platformId, platformType } = payload;
  const openCTIClients = deps.getOpenCTIClients();
  const openAEVClients = deps.getOpenAEVClients();
  
  try {
    const currentSettings = await getSettings();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
    );
    
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
          return;
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
          return;
        }
        const info = await Promise.race([client.testConnection(), timeoutPromise]);
        sendResponse(successResponse(info));
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
}

/**
 * Handle TEST_PLATFORM_CONNECTION_TEMP - Test with temporary credentials
 */
export async function handleTestPlatformConnectionTemp(
  payload: { platformType: PlatformType; url: string; apiToken: string },
  sendResponse: SendResponseFn
): Promise<void> {
  const { platformType, url, apiToken } = payload;
  
  try {
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
    );
    
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
          name: 'Temp', 
          url, 
          apiToken,
          enabled: true,
        });
        const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
        sendResponse(successResponse(info));
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
}

/**
 * Handle GET_PLATFORM_THEME
 */
export async function handleGetPlatformTheme(
  sendResponse: SendResponseFn
): Promise<void> {
  const settings = await getSettings();
  const theme = settings.theme || 'dark';
  sendResponse(successResponse(theme));
}

/**
 * Registry of settings handlers
 */
export const settingsHandlers = {
  GET_SETTINGS: handleGetSettings,
  SAVE_SETTINGS: handleSaveSettings,
  TEST_CONNECTION: handleTestConnection,
  TEST_PLATFORM_CONNECTION: handleTestPlatformConnection,
  TEST_PLATFORM_CONNECTION_TEMP: handleTestPlatformConnectionTemp,
  GET_PLATFORM_THEME: handleGetPlatformTheme,
};

