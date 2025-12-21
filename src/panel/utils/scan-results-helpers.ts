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
 * For PDF scanner, also returns the PDF filename for container naming and external reference
 */
export const getPageContent = async (
  scanPageContent: string | undefined,
  currentPageTitle: string,
  currentPageUrl: string,
): Promise<{ content: string; title: string; url: string; pdfFileName?: string; isPdfSource?: boolean }> => {
  let pageContent = scanPageContent || '';
  let pageTitle = currentPageTitle || '';
  let pageUrl = currentPageUrl || '';
  let pdfFileName: string | undefined;
  let isPdfSource = false;

  if (!pageContent && typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url) {
        const extensionId = chrome.runtime.id;
        const isPdfScannerPage = tab.url.startsWith(`chrome-extension://${extensionId}/pdf-scanner/`) ||
                                tab.url.startsWith(`moz-extension://${extensionId}/pdf-scanner/`);
        
        if (isPdfScannerPage) {
          isPdfSource = true;
          // Check if we're in iframe mode (panel embedded in PDF scanner) or native side panel mode
          const isIframeMode = window !== window.parent;
          
          if (isIframeMode) {
            // For iframe mode: request content via postMessage to parent (PDF scanner)
            try {
              const pdfContentResponse = await new Promise<{ success: boolean; data?: { content: string; title: string; url: string; filename?: string } }>((resolve) => {
                const timeout = setTimeout(() => resolve({ success: false }), 10000); // 10 second timeout for large PDFs
                
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
                pdfFileName = pdfContentResponse.data?.filename;
              }
            } catch {
              // PDF scanner might not respond
            }
          } else {
            // For native side panel mode: use chrome.runtime.sendMessage to background
            // which will forward to PDF scanner via chrome.tabs.sendMessage
            try {
              const pdfContentResponse = await chrome.runtime.sendMessage({ 
                type: 'GET_PDF_CONTENT_FROM_PDF_SCANNER' 
              });
              if (pdfContentResponse?.success) {
                pageContent = pdfContentResponse.data?.content || '';
                pageTitle = pdfContentResponse.data?.title || pageTitle;
                pageUrl = pdfContentResponse.data?.url || pageUrl;
                pdfFileName = pdfContentResponse.data?.filename;
              }
            } catch {
              // PDF scanner might not respond
            }
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

  return { content: pageContent, title: pageTitle, url: pageUrl, pdfFileName, isPdfSource };
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

