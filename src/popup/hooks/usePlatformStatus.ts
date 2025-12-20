/**
 * usePlatformStatus - Hook for managing platform connection status
 */

import { useState, useEffect, useCallback } from 'react';
import { loggers } from '../../shared/utils/logger';
import type { ConnectionStatus, PlatformStatus } from '../types';

const log = loggers.popup;

interface UsePlatformStatusReturn {
  status: ConnectionStatus;
  setStatus: React.Dispatch<React.SetStateAction<ConnectionStatus>>;
  mode: 'dark' | 'light';
  setMode: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
  aiConfigured: boolean;
  splitScreenMode: boolean;
  hasOpenCTI: boolean;
  hasOpenAEV: boolean;
  hasAnyOpenCTIConfigured: boolean;
  hasAnyOpenAEVConfigured: boolean;
  hasAnyPlatformConfigured: boolean;
  hasEnterprise: boolean;
}

export const usePlatformStatus = (): UsePlatformStatusReturn => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [status, setStatus] = useState<ConnectionStatus>({ 
    opencti: [], 
    openaev: [] 
  });
  const [aiConfigured, setAiConfigured] = useState(false);
  const [splitScreenMode, setSplitScreenMode] = useState(false);

  useEffect(() => {
    // Check if we're running in an extension context
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      // Outside extension context - use default dark theme
      setMode('dark');
      return;
    }

    // Get theme setting - strictly from configuration
    chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        setMode(response.data === 'light' ? 'light' : 'dark');
      }
    });

    // Get settings and platform status
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, async (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        const settings = response.data;
        const openctiPlatforms = settings.openctiPlatforms || [];
        const openaevPlatforms = settings.openaevPlatforms || [];
        
        // Check AI configuration
        const aiSettings = settings.aiSettings;
        setAiConfigured(!!(aiSettings?.enabled && aiSettings?.provider && aiSettings?.apiKey));
        
        // Check split screen mode
        setSplitScreenMode(!!settings.splitScreenMode);

        // Build initial platform lists - include isEnterprise from saved settings
        const openctiList: PlatformStatus[] = openctiPlatforms.map((p: any) => ({
          id: p.id || 'default',
          name: p.name || p.platformName || 'OpenCTI',
          url: p.url || '',
          connected: false,
          version: undefined,
          userName: undefined,
          isEnterprise: p.isEnterprise,
        }));
        
        const openaevList: PlatformStatus[] = openaevPlatforms.map((p: any) => ({
          id: p.id || 'default',
          name: p.name || p.platformName || 'OpenAEV',
          url: p.url || '',
          connected: false,
          userName: undefined,
          isEnterprise: p.isEnterprise,
        }));

        // Set initial status first (all disconnected) - UI shows immediately
        setStatus({ opencti: openctiList, openaev: openaevList });

        // Test platforms PROGRESSIVELY - update UI as each responds
        log.debug('Testing', openctiPlatforms.length, 'OpenCTI and', openaevPlatforms.length, 'OpenAEV platforms');
        
        // Test OpenCTI platforms
        testPlatforms(openctiPlatforms, 'opencti');
        
        // Test OpenAEV platforms
        testPlatforms(openaevPlatforms, 'openaev');
      }
    });
    
    // Listen for storage changes to keep status in sync
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          syncStatusFromSettings(newSettings);
        }
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const testPlatforms = useCallback((platforms: any[], platformType: 'opencti' | 'openaev') => {
    platforms
      .filter((platform: any) => platform?.url && platform?.apiToken)
      .forEach((platform: any) => {
        const platformId = platform.id;
        log.debug(`Testing ${platformType} platform:`, platformId, platform.name);
        
        // Add timeout wrapper for unresponsive platforms
        const timeoutId = setTimeout(() => {
          log.warn(`${platformType} platform ${platformId} timeout`);
        }, 10000);
        
        chrome.runtime.sendMessage(
          { type: 'TEST_PLATFORM_CONNECTION', payload: { platformId, platformType } },
          (testResponse) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              log.error('Connection test error for', platformId, chrome.runtime.lastError);
              return;
            }
            
            if (testResponse?.success) {
              log.debug(`Connection test SUCCESS for ${platformId}:`, testResponse.data?.version);
              setStatus(prev => ({
                ...prev,
                [platformType]: prev[platformType].map(p => 
                  p.id === platformId 
                    ? { 
                        ...p, 
                        connected: true, 
                        version: testResponse.data?.version, 
                        userName: platformType === 'opencti'
                          ? (testResponse.data?.me?.name || testResponse.data?.me?.user_email)
                          : testResponse.data?.user?.user_email,
                        isEnterprise: testResponse.data?.enterprise_edition,
                      }
                    : p
                ),
              }));
            } else {
              log.error('Connection test failed for', platformId, testResponse?.error);
            }
          }
        );
      });
  }, []);

  const syncStatusFromSettings = useCallback((newSettings: any) => {
    const openctiPlatforms = newSettings.openctiPlatforms || [];
    const openaevPlatforms = newSettings.openaevPlatforms || [];
    
    setStatus(prev => {
      const newOpencti = openctiPlatforms.map((p: any) => {
        const existing = prev.opencti.find(e => e.id === p.id);
        if (existing) {
          return { ...existing, isEnterprise: p.isEnterprise };
        }
        const anyConnected = prev.opencti.find(e => e.connected && e.url === p.url);
        return {
          id: p.id || 'default',
          name: p.name || p.platformName || 'OpenCTI',
          url: p.url || '',
          connected: anyConnected?.connected || false,
          version: anyConnected?.version,
          userName: anyConnected?.userName,
          isEnterprise: p.isEnterprise ?? anyConnected?.isEnterprise,
        };
      });
      
      const newOpenaev = openaevPlatforms.map((p: any) => {
        const existing = prev.openaev.find(e => e.id === p.id);
        if (existing) {
          return { ...existing, isEnterprise: p.isEnterprise };
        }
        const anyConnected = prev.openaev.find(e => e.connected && e.url === p.url);
        return {
          id: p.id || 'default',
          name: p.name || p.platformName || 'OpenAEV',
          url: p.url || '',
          connected: anyConnected?.connected || false,
          version: anyConnected?.version,
          userName: anyConnected?.userName,
          isEnterprise: p.isEnterprise ?? anyConnected?.isEnterprise,
        };
      });
      
      return { opencti: newOpencti, openaev: newOpenaev };
    });
  }, []);

  // Computed values
  const hasOpenCTI = status.opencti.some(p => p.connected);
  const hasOpenAEV = status.openaev.some(p => p.connected);
  const hasAnyOpenCTIConfigured = status.opencti.length > 0;
  const hasAnyOpenAEVConfigured = status.openaev.length > 0;
  const hasAnyPlatformConfigured = hasAnyOpenCTIConfigured || hasAnyOpenAEVConfigured;
  const hasEnterprise = status.opencti.some(p => p.isEnterprise) || status.openaev.some(p => p.isEnterprise);

  return {
    status,
    setStatus,
    mode,
    setMode,
    aiConfigured,
    splitScreenMode,
    hasOpenCTI,
    hasOpenAEV,
    hasAnyOpenCTIConfigured,
    hasAnyOpenAEVConfigured,
    hasAnyPlatformConfigured,
    hasEnterprise,
  };
};

export default usePlatformStatus;

