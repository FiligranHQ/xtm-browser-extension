/**
 * Platform Connection and Injection Handlers
 * 
 * Handles platform connection tests and content script injection.
 */

import { OpenCTIClient } from '../../shared/api/opencti-client';
import { OpenAEVClient } from '../../shared/api/openaev-client';
import { loggers } from '../../shared/utils/logger';
import { getSettings } from '../../shared/utils/storage';
import { successResponse, errorResponse } from '../../shared/utils/messaging';
import { CONNECTION_TIMEOUT_MS } from '../../shared/constants';
import type { PlatformType } from '../../shared/platform';
import type { SendResponseFn } from './types';

const log = loggers.background;

/**
 * Dependencies for platform handlers
 */
export interface PlatformHandlerDependencies {
  getOpenCTIClients: () => Map<string, OpenCTIClient>;
  getOpenAEVClients: () => Map<string, OpenAEVClient>;
}

/**
 * Test platform connection payload
 */
export interface TestConnectionPayload {
  platformId?: string;
  platformType: PlatformType;
  url?: string;
  apiToken?: string;
  temporary?: boolean;
}

/**
 * Handle TEST_PLATFORM_CONNECTION
 */
export async function handleTestPlatformConnection(
  payload: TestConnectionPayload,
  sendResponse: SendResponseFn,
  deps: PlatformHandlerDependencies
): Promise<void> {
  const { platformId, platformType, url, apiToken, temporary } = payload;
  
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
  );
  
  try {
    switch (platformType) {
      case 'opencti': {
        if (temporary && url && apiToken) {
          const tempClient = new OpenCTIClient({ url, apiToken });
          const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
          sendResponse(successResponse(info));
        } else if (platformId) {
          const currentSettings = await getSettings();
          const openCTIClients = deps.getOpenCTIClients();
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
        } else {
          sendResponse(errorResponse('Missing platformId or temporary credentials'));
        }
        break;
      }
      
      case 'openaev': {
        if (temporary && url && apiToken) {
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
          const currentSettings = await getSettings();
          const openAEVClients = deps.getOpenAEVClients();
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
        } else {
          sendResponse(errorResponse('Missing platformId or temporary credentials'));
        }
        break;
      }
      
      default:
        sendResponse(errorResponse(`Unsupported platform type: ${platformType}`));
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

/**
 * Handle INJECT_CONTENT_SCRIPT - inject into single tab
 */
export async function handleInjectContentScript(
  payload: { tabId: number },
  sendResponse: SendResponseFn
): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: payload.tabId },
      files: ['content/index.js'],
    });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to inject content script' 
    });
  }
}

/**
 * Handle INJECT_ALL_TABS - inject content script into all valid tabs
 */
export async function handleInjectAllTabs(
  sendResponse: SendResponseFn
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    let injectedCount = 0;
    let alreadyLoadedCount = 0;
    let failedCount = 0;
    
    for (const tab of tabs) {
      // Skip invalid tabs
      if (!tab.id || !tab.url) continue;
      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:') ||
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
    sendResponse(successResponse({ injectedCount, alreadyLoadedCount, failedCount }));
  } catch (error) {
    log.error('Failed to inject content scripts into all tabs:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to inject content scripts' 
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
  sendResponse(successResponse({ theme: settings.theme }));
}

/**
 * Registry of platform handlers
 */
export const platformHandlers = {
  TEST_PLATFORM_CONNECTION: handleTestPlatformConnection,
  INJECT_CONTENT_SCRIPT: handleInjectContentScript,
  INJECT_ALL_TABS: handleInjectAllTabs,
  GET_PLATFORM_THEME: handleGetPlatformTheme,
};
