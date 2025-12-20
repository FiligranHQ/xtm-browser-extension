/**
 * AI Entity Helpers
 * 
 * Shared utilities for handling AI-discovered entities in the panel.
 * Eliminates duplication across CommonScanResultsView and other views.
 */

import type { ScanResultEntity } from '../../shared/types/scan';

/**
 * AI entity payload for messaging
 */
export interface AIEntityPayload {
  id: string;
  type: string;
  name: string;
  value: string;
  aiReason?: string;
  aiConfidence?: number;
}

/**
 * Create AI entity payload from scan result entities
 * Used for both content script messaging and PDF scanner forwarding
 */
export function createAIEntityPayload(entities: ScanResultEntity[]): AIEntityPayload[] {
  return entities.map(e => ({
    id: e.id,
    type: e.type,
    name: e.name,
    value: e.value,
    aiReason: e.aiReason,
    aiConfidence: e.aiConfidence,
  }));
}

/**
 * Send AI entities to content script and PDF scanner
 * Consolidates the duplicated messaging logic
 */
export function broadcastAIEntities(entities: ScanResultEntity[]): void {
  const aiEntityPayload = createAIEntityPayload(entities);
  
  // Send to content script to persist in lastScanData
  window.parent.postMessage({
    type: 'XTM_ADD_AI_ENTITIES',
    payload: { entities: aiEntityPayload },
  }, '*');
  
  // Send to PDF scanner (if active) via runtime message
  chrome.runtime.sendMessage({
    type: 'FORWARD_TO_PDF_SCANNER',
    payload: {
      type: 'ADD_AI_ENTITIES_TO_PDF',
      payload: aiEntityPayload,
    },
  });
}

/**
 * Format entity count message for toast
 */
export function formatEntityCountMessage(count: number, prefix = 'AI discovered'): string {
  return `${prefix} ${count} additional entit${count === 1 ? 'y' : 'ies'}`;
}

/**
 * Handle adding AI entities with optional highlighting verification
 * Returns true if highlighting verification was attempted
 */
export async function addAIEntitiesWithHighlighting(
  newEntities: ScanResultEntity[],
  setScanResultsEntities: (updater: (prev: ScanResultEntity[]) => ScanResultEntity[]) => void,
  showToast: (options: { type: 'success' | 'info' | 'warning' | 'error'; message: string }) => void,
  activeTabId?: number
): Promise<boolean> {
  if (!activeTabId) {
    // No tab - add all entities at TOP (can't verify highlighting)
    setScanResultsEntities((prev: ScanResultEntity[]) => [...newEntities, ...prev]);
    broadcastAIEntities(newEntities);
    showToast({ type: 'success', message: formatEntityCountMessage(newEntities.length) });
    return false;
  }

  try {
    // Try to highlight and verify on the page
    const highlightResponse = await new Promise<{
      success: boolean;
      data?: { highlightedIds?: string[] };
    }>((resolve) => {
      chrome.tabs.sendMessage(
        activeTabId,
        { type: 'HIGHLIGHT_AI_ENTITIES', payload: { entities: newEntities } },
        (response) => resolve(response || { success: false })
      );
    });

    if (highlightResponse?.success && highlightResponse.data?.highlightedIds) {
      // Some entities were highlighted - add only those at TOP, rest at bottom
      const highlightedSet = new Set(highlightResponse.data.highlightedIds);
      const highlightedEntities = newEntities.filter(e => highlightedSet.has(e.id));
      const nonHighlightedEntities = newEntities.filter(e => !highlightedSet.has(e.id));
      
      setScanResultsEntities((prev: ScanResultEntity[]) => [
        ...highlightedEntities,
        ...prev,
        ...nonHighlightedEntities.map(e => ({ ...e, aiNotOnPage: true })),
      ]);
      broadcastAIEntities(newEntities);
      showToast({ type: 'success', message: formatEntityCountMessage(newEntities.length) });
      return true;
    } else {
      // Highlighting failed or no entities highlighted - add all at TOP
      setScanResultsEntities((prev: ScanResultEntity[]) => [...newEntities, ...prev]);
      broadcastAIEntities(newEntities);
      showToast({ type: 'success', message: formatEntityCountMessage(newEntities.length) });
      return false;
    }
  } catch {
    // On error, add all entities at TOP (fallback)
    setScanResultsEntities((prev: ScanResultEntity[]) => [...newEntities, ...prev]);
    broadcastAIEntities(newEntities);
    showToast({ type: 'success', message: formatEntityCountMessage(newEntities.length) });
    return false;
  }
}

