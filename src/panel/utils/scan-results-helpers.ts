/**
 * Scan Results Helpers
 * 
 * Utility functions for scan results view.
 */

import type { ScanResultEntity } from '../../shared/types/scan';
import { getCanonicalTypeName, getUniqueCanonicalTypes } from '../../shared/platform/registry';

/**
 * Check if entity is selectable for OpenCTI import (not oaev-* type)
 */
export const isSelectableForOpenCTI = (entity: ScanResultEntity): boolean => {
  return !entity.type.startsWith('oaev-');
};

/**
 * Check if entity is found in OpenCTI
 */
export const isFoundInOpenCTI = (entity: ScanResultEntity): boolean => {
  if (entity.found) {
    if (entity.platformMatches && entity.platformMatches.length > 0) {
      return entity.platformMatches.some(pm => pm.platformType === 'opencti');
    }
    return entity.platformType === 'opencti' || !entity.platformType;
  }
  return false;
};

/**
 * Get unique types from platform matches for multi-type display
 * Uses cross-platform type mapping to deduplicate equivalent types
 */
export const getUniqueTypesFromMatches = (entity: ScanResultEntity): { types: string[]; hasMultipleTypes: boolean } => {
  if (!entity.platformMatches || entity.platformMatches.length === 0) {
    return { types: [getCanonicalTypeName(entity.type)], hasMultipleTypes: false };
  }
  const allTypes = entity.platformMatches.map(pm => pm.type);
  const uniqueCanonicalTypes = getUniqueCanonicalTypes(allTypes);
  return { types: uniqueCanonicalTypes, hasMultipleTypes: uniqueCanonicalTypes.length > 1 };
};

/**
 * Format type name for display
 */
export const formatTypeName = (type: string): string => {
  return getCanonicalTypeName(type);
};

/**
 * Get page content from either PDF scanner or regular web page
 */
export const getPageContent = async (
  scanPageContent: string | undefined,
  currentPageTitle: string,
  currentPageUrl: string,
): Promise<{ content: string; title: string; url: string }> => {
  let pageContent = scanPageContent || '';
  let pageTitle = currentPageTitle || '';
  let pageUrl = currentPageUrl || '';

  if (!pageContent && typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url) {
        const extensionId = chrome.runtime.id;
        const isPdfScannerPage = tab.url.startsWith(`chrome-extension://${extensionId}/pdf-scanner/`) ||
                                tab.url.startsWith(`moz-extension://${extensionId}/pdf-scanner/`);
        
        if (isPdfScannerPage) {
          // For PDF scanner, request content via postMessage
          try {
            const pdfContentResponse = await new Promise<{ success: boolean; data?: { content: string; title: string; url: string } }>((resolve) => {
              const timeout = setTimeout(() => resolve({ success: false }), 3000);
              
              const handleResponse = (event: MessageEvent) => {
                if (event.data?.type === 'XTM_PDF_CONTENT_RESPONSE') {
                  clearTimeout(timeout);
                  window.removeEventListener('message', handleResponse);
                  resolve(event.data.payload || { success: false });
                }
              };
              window.addEventListener('message', handleResponse);
              
              window.parent.postMessage({ type: 'XTM_GET_PDF_CONTENT' }, '*');
            });
            if (pdfContentResponse?.success) {
              pageContent = pdfContentResponse.data?.content || '';
              pageTitle = pdfContentResponse.data?.title || pageTitle;
              pageUrl = pdfContentResponse.data?.url || pageUrl;
            }
          } catch {
            // PDF scanner might not respond
          }
        } else {
          const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
          if (contentResponse?.success) {
            pageContent = contentResponse.data?.content || '';
            pageTitle = contentResponse.data?.title || pageTitle;
            pageUrl = contentResponse.data?.url || tab.url || pageUrl;
          }
        }
      }
    } catch {
      // Silently handle page content retrieval errors
    }
  }

  return { content: pageContent, title: pageTitle, url: pageUrl };
};

/**
 * Build entities array for AI analysis from scan results
 */
export const buildEntitiesForAI = (scanResultsEntities: ScanResultEntity[]): Array<{
  type: string;
  value: string | undefined;
  name: string | undefined;
  aliases: string[] | undefined;
  externalId: string | undefined;
}> => {
  // Filter out OpenAEV-only entities as relationships are only for OpenCTI
  const octiEntities = scanResultsEntities.filter(e => !e.type.startsWith('oaev-'));
  
  return octiEntities.map(e => {
    const entityData = e.entityData as Record<string, unknown> | undefined;
    return {
      type: e.type,
      value: e.value || e.name,
      name: e.name || e.value,
      aliases: entityData?.aliases as string[] | undefined 
        || entityData?.x_opencti_aliases as string[] | undefined,
      externalId: entityData?.x_mitre_id as string | undefined
        || entityData?.external_id as string | undefined
        || (entityData?.externalReferences as Array<{ external_id?: string }> | undefined)?.[0]?.external_id,
    };
  });
};

/**
 * Filter entities based on filters
 */
export const filterEntities = (
  entities: ScanResultEntity[],
  foundFilter: string,
  typeFilter: string,
  searchQuery: string,
): ScanResultEntity[] => {
  let filtered = entities;
  
  // Apply found/not-found/AI filter
  if (foundFilter === 'found') {
    filtered = filtered.filter(e => e.found && !e.discoveredByAI);
  } else if (foundFilter === 'not-found') {
    filtered = filtered.filter(e => !e.found && !e.discoveredByAI);
  } else if (foundFilter === 'ai-discovered') {
    filtered = filtered.filter(e => e.discoveredByAI);
  }
  
  // Apply type filter
  if (typeFilter !== 'all') {
    filtered = filtered.filter(e => e.type === typeFilter);
  }
  
  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(e => {
      const name = (e.name || '').toLowerCase();
      const value = (e.value || '').toLowerCase();
      const type = (e.type || '').toLowerCase().replace(/-/g, ' ');
      return name.includes(query) || value.includes(query) || type.includes(query);
    });
  }
  
  return filtered;
};

