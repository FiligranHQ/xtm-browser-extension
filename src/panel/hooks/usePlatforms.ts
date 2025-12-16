/**
 * Platforms Hook
 * 
 * Hook for managing platform state and operations.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loggers } from '../../shared/utils/logger';

const log = loggers.panel;

/**
 * Platform info
 */
export interface PlatformInfo {
  id: string;
  name: string;
  url: string;
  version?: string;
  isEnterprise?: boolean;
  type?: 'opencti' | 'openaev';
}

/**
 * Hook for managing platform state
 */
export function usePlatforms() {
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformInfo[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  const [platformUrl, setPlatformUrl] = useState('');
  
  // Ref to track latest platforms (for use in event handlers that may have stale closures)
  const availablePlatformsRef = useRef<PlatformInfo[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    availablePlatformsRef.current = availablePlatforms;
  }, [availablePlatforms]);
  
  // Helper to get only OpenCTI platforms (for container creation and investigation)
  const openctiPlatforms = useMemo(() => 
    availablePlatforms.filter(p => p.type === 'opencti'), 
    [availablePlatforms]
  );
  
  // Helper to get only OpenAEV platforms
  const openaevPlatforms = useMemo(() => 
    availablePlatforms.filter(p => p.type === 'openaev'), 
    [availablePlatforms]
  );
  
  // Load platforms from settings
  const loadPlatforms = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return;
    }
    
    try {
      const response = await new Promise<{ success: boolean; data?: any }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false });
          } else {
            resolve(res);
          }
        });
      });
      
      if (response?.success && response.data) {
        const settings = response.data;
        
        // Get all enabled OpenCTI platforms
        const openctiPlatforms = settings.openctiPlatforms || [];
        const enabledOpenCTI = openctiPlatforms
          .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
          .map((p: any) => ({ 
            id: p.id, 
            name: p.name || 'OpenCTI', 
            url: p.url, 
            type: 'opencti' as const,
            isEnterprise: p.isEnterprise,
          }));
        
        // Get all enabled OpenAEV platforms
        const oaevPlatforms = settings.openaevPlatforms || [];
        const enabledOAEV = oaevPlatforms
          .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
          .map((p: any) => ({ 
            id: p.id, 
            name: p.name || 'OpenAEV', 
            url: p.url, 
            type: 'openaev' as const,
            isEnterprise: p.isEnterprise,
          }));
        
        setAvailablePlatforms([...enabledOpenCTI, ...enabledOAEV]);
        
        // Set first OpenCTI platform as default
        if (enabledOpenCTI.length > 0) {
          setPlatformUrl(enabledOpenCTI[0].url);
          setSelectedPlatformId(enabledOpenCTI[0].id);
        } else if (enabledOAEV.length > 0) {
          setPlatformUrl(enabledOAEV[0].url);
          setSelectedPlatformId(enabledOAEV[0].id);
        }
      }
    } catch (error) {
      log.error('Failed to load platforms:', error);
    }
  }, []);
  
  // Select a platform
  const selectPlatform = useCallback((platformId: string) => {
    const platform = availablePlatforms.find(p => p.id === platformId);
    if (platform) {
      setSelectedPlatformId(platformId);
      setPlatformUrl(platform.url);
    }
  }, [availablePlatforms]);
  
  // Get platform by ID
  const getPlatform = useCallback((platformId: string) => {
    return availablePlatforms.find(p => p.id === platformId);
  }, [availablePlatforms]);
  
  // Get selected platform
  const selectedPlatform = useMemo(() => {
    return availablePlatforms.find(p => p.id === selectedPlatformId);
  }, [availablePlatforms, selectedPlatformId]);
  
  return {
    availablePlatforms,
    setAvailablePlatforms,
    availablePlatformsRef,
    selectedPlatformId,
    setSelectedPlatformId,
    platformUrl,
    setPlatformUrl,
    openctiPlatforms,
    openaevPlatforms,
    selectedPlatform,
    loadPlatforms,
    selectPlatform,
    getPlatform,
  };
}

