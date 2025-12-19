/**
 * Content Script
 * 
 * Injected into web pages to scan for observables and provide highlighting.
 * 
 * This is the main entry point that coordinates all content script functionality.
 */

// Immediate logging to verify content script is loading
console.log('[XTM] [CONTENT-DEBUG] Content script file starting to load...', window.location.href);

import { loggers } from '../shared/utils/logger';
import type { DetectedObservable } from '../shared/types/observables';
import type { DetectedOCTIEntity } from '../shared/types/opencti';
import type { ScanResultPayload } from '../shared/types/messages';
import { getTextNodes } from '../shared/detection/text-utils';
import { 
  getPlatformFromEntity, 
  getDisplayType, 
  getPlatformName,
  inferPlatformTypeFromEntityType,
  prefixEntityType,
} from '../shared/platform/registry';

// Module imports
import { HIGHLIGHT_STYLES } from './styles';
import { showToast, hideToast } from './toast';
import { 
  extractArticleContent, 
  extractFirstParagraph, 
  generateArticlePDF, 
  getPageContentForScanning,
} from './extraction';
import { 
  getComprehensivePageContent, 
  detectDomainsAndHostnamesForAtomicTesting,
  generateCleanDescription,
} from './page-content';
import {
  clearHighlights,
  highlightResults,
  highlightResultsForInvestigation,
  highlightForAtomicTesting,
  highlightScenarioAttackPatterns,
  highlightAIEntities,
  scrollToFirstHighlight,
  scrollToHighlightByValue,
  buildNodeMap,
} from './highlighting';
import {
  sendPanelMessage,
  flushPanelMessageQueue,
  ensurePanelElements,
  showPanelElements,
  hidePanel,
  isPanelHidden,
  showPanel,
  showAddPanel,
  showPreviewPanel,
  showContainerPanel,
  showInvestigationPanel,
  showSearchPanel,
  showUnifiedSearchPanel,
  showAddSelectionPanel,
  getCurrentTheme,
  setIsPanelReady,
  setHighlightClickInProgress,
  initializeSplitScreenMode,
  refreshSplitScreenMode,
  getSplitScreenMode,
  openPanel,
} from './panel';

const log = loggers.content;

// ============================================================================
// Global State
// ============================================================================

let scanResults: ScanResultPayload | null = null;
const selectedForImport: Set<string> = new Set();
let currentScanMode: 'scan' | 'atomic' | 'scenario' | 'investigation' | null = null;
let lastScanData: ScanResultPayload | null = null;

// ============================================================================
// Initialization
// ============================================================================

function injectStyles(): boolean {
  if (!document.head) {
    log.debug(' Not a valid HTML page, skipping initialization');
    return false;
  }
  
  const style = document.createElement('style');
  style.id = 'xtm-styles';
  style.textContent = HIGHLIGHT_STYLES;
  document.head.appendChild(style);
  return true;
}

// Store reference to shadow root for tooltip
let tooltipShadowRoot: ShadowRoot | null = null;

function createTooltip(): HTMLElement | null {
  if (!document.body) {
    return null;
  }
  
  // Create a host element for the shadow DOM
  const host = document.createElement('div');
  host.id = 'xtm-tooltip-host';
  host.style.cssText = 'position: fixed; z-index: 2147483647; pointer-events: none;';
  document.body.appendChild(host);
  
  // Attach shadow root to protect from page interference
  tooltipShadowRoot = host.attachShadow({ mode: 'closed' });
  
  // Add styles inside shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    .xtm-tooltip {
      position: fixed;
      background: #070d19;
      color: rgba(255, 255, 255, 0.9);
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483647;
      pointer-events: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      max-width: 320px;
      min-width: 150px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }
    .xtm-tooltip.visible {
      opacity: 1;
      visibility: visible;
    }
    .xtm-tooltip-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .xtm-tooltip-type {
      color: #0fbcff;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
      background: rgba(15, 188, 255, 0.15);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .xtm-tooltip-value {
      word-break: break-all;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .xtm-tooltip-status {
      font-size: 12px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .xtm-tooltip-status.found {
      color: #00c853;
    }
    .xtm-tooltip-status.not-found {
      color: #ffa726;
    }
  `;
  tooltipShadowRoot.appendChild(style);
  
  // Create the actual tooltip element inside shadow DOM
  const tooltip = document.createElement('div');
  tooltip.className = 'xtm-tooltip';
  tooltip.id = 'xtm-tooltip-inner';
  tooltipShadowRoot.appendChild(tooltip);
  
  return tooltip;
}

function getTooltipElement(): HTMLElement | null {
  if (tooltipShadowRoot) {
    return tooltipShadowRoot.getElementById('xtm-tooltip-inner');
  }
  // Fallback to regular DOM
  return document.getElementById('xtm-tooltip');
}

async function initialize(): Promise<void> {
  console.log('[XTM] [CONTENT-DEBUG] initialize() called');
  console.log('[XTM] [CONTENT-DEBUG] document.head exists:', !!document.head);
  console.log('[XTM] [CONTENT-DEBUG] document.body exists:', !!document.body);
  console.log('[XTM] [CONTENT-DEBUG] URL:', window.location.href);
  
  if (!document.head || !document.body) {
    console.log('[XTM] [CONTENT-DEBUG] Not a valid HTML page, skipping initialization');
    return;
  }
  
  if (document.getElementById('xtm-styles')) {
    console.log('[XTM] [CONTENT-DEBUG] Already initialized (xtm-styles exists)');
    return;
  }
  
  console.log('[XTM] [CONTENT-DEBUG] Injecting styles...');
  if (!injectStyles()) {
    console.log('[XTM] [CONTENT-DEBUG] Failed to inject styles');
    return;
  }
  console.log('[XTM] [CONTENT-DEBUG] Styles injected successfully');
  
  createTooltip();
  console.log('[XTM] [CONTENT-DEBUG] Tooltip created');
  
  // Initialize split screen mode early (before any panel operations)
  console.log('[XTM] [CONTENT-DEBUG] Initializing split screen mode...');
  const isSplitScreen = await initializeSplitScreenMode();
  console.log('[XTM] [CONTENT-DEBUG] Split screen mode:', isSplitScreen);
  
  // Listen for messages from the panel iframe
  window.addEventListener('message', handlePanelMessage);
  
  console.log('[XTM] [CONTENT-DEBUG] Content script fully initialized');
}

// ============================================================================
// Panel Message Handling
// ============================================================================

async function handlePanelMessage(event: MessageEvent): Promise<void> {
  if (event.data?.type === 'XTM_PANEL_READY') {
    log.debug(' Panel signaled ready, flushing message queue');
    setIsPanelReady(true);
    flushPanelMessageQueue();
  } else if (event.data?.type === 'XTM_CLOSE_PANEL') {
    if (currentScanMode !== 'scan') {
      clearHighlights();
      currentScanMode = null;
    }
    hidePanel();
  } else if (event.data?.type === 'XTM_CLEAR_HIGHLIGHTS') {
    clearHighlights();
    currentScanMode = null;
    lastScanData = null;
    // Notify panel to clear scan results and reset to empty state
    sendPanelMessage('CLEAR_SCAN_RESULTS');
  } else if (event.data?.type === 'XTM_ADD_AI_ENTITIES') {
    // Update lastScanData with AI-discovered entities so they persist when panel re-opens
    const aiEntities = event.data.payload?.entities;
    if (lastScanData && Array.isArray(aiEntities)) {
      lastScanData = {
        ...lastScanData,
        aiDiscoveredEntities: [
          ...(lastScanData.aiDiscoveredEntities || []),
          ...aiEntities,
        ],
      };
      log.debug(' Updated lastScanData with AI entities:', aiEntities.length);
    }
  } else if (event.data?.type === 'XTM_SCROLL_TO_FIRST') {
    scrollToFirstHighlight();
  } else if (event.data?.type === 'XTM_SCROLL_TO_HIGHLIGHT') {
    const value = event.data.payload?.value;
    if (value) {
      scrollToHighlightByValue(value);
    }
  } else if (event.data?.type === 'XTM_SHOW_TOAST') {
    const { type, message, action, persistent, duration } = event.data.payload || {};
    showToast({
      type: type || 'info',
      message: message || '',
      action: action ? {
        label: action.label,
        onClick: () => {
          if (action.type === 'scroll_to_first') {
            scrollToFirstHighlight();
          } else if (action.type === 'close_panel') {
            hidePanel();
          }
        }
      } : undefined,
      persistent: persistent || false,
      duration: duration,
    });
  } else if (event.data?.type === 'XTM_HIDE_TOAST') {
    hideToast();
  } else if (event.data?.type === 'XTM_COPY_TO_CLIPBOARD' && event.data.payload) {
    await handleClipboardCopy(event.data.payload);
  } else if (event.data?.type === 'XTM_TOGGLE_SELECTION' && event.data.value) {
    handleToggleSelection(event.data.value);
  } else if (event.data?.type === 'XTM_SELECT_ALL' && event.data.values) {
    handleSelectAll(event.data.values as string[]);
  } else if (event.data?.type === 'XTM_DESELECT_ALL') {
    handleDeselectAll();
  } else if (event.data?.type === 'XTM_DESELECT_ITEM' && event.data.value) {
    handleDeselectItem(event.data.value);
  } else if (event.data?.type === 'XTM_HIGHLIGHT_AI_ENTITIES' && event.data.entities) {
    handleHighlightAIEntities(event.data.entities);
  }
}

async function handleClipboardCopy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

function handleToggleSelection(value: string): void {
  const highlightEl = document.querySelector(`.xtm-highlight[data-value="${CSS.escape(value)}"]`) as HTMLElement;
  if (highlightEl) {
    toggleSelection(highlightEl, value);
  } else {
    if (selectedForImport.has(value)) {
      selectedForImport.delete(value);
    } else {
      selectedForImport.add(value);
    }
    sendPanelMessage('SELECTION_UPDATED', {
      selectedCount: selectedForImport.size,
      selectedItems: Array.from(selectedForImport),
    });
  }
}

function handleSelectAll(values: string[]): void {
  values.forEach(value => {
    if (!selectedForImport.has(value)) {
      selectedForImport.add(value);
      document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
        el.classList.add('xtm-selected');
      });
    }
  });
  sendPanelMessage('SELECTION_UPDATED', {
    selectedCount: selectedForImport.size,
    selectedItems: Array.from(selectedForImport),
  });
}

function handleDeselectAll(): void {
  selectedForImport.forEach(value => {
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.remove('xtm-selected');
    });
  });
  selectedForImport.clear();
  sendPanelMessage('SELECTION_UPDATED', {
    selectedCount: 0,
    selectedItems: [],
  });
}

function handleDeselectItem(value: string): void {
  selectedForImport.delete(value);
  document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
    el.classList.remove('xtm-selected');
  });
  sendPanelMessage('SELECTION_UPDATED', {
    selectedCount: selectedForImport.size,
    selectedItems: Array.from(selectedForImport),
  });
}

interface HighlightAIEntitiesResult {
  highlightedCount: number;
  highlightedEntities: Array<{ type: string; value: string; name: string }>;
  failedEntities: Array<{ type: string; value: string; name: string }>;
}

function handleHighlightAIEntities(entities: Array<{ type: string; value: string; name: string }>): HighlightAIEntitiesResult {
  log.debug(' Highlighting AI-discovered entities:', entities.length);
  
  const result = highlightAIEntities(
    entities,
    (highlight, searchValue) => {
      toggleSelection(highlight, searchValue);
    },
    async () => {
      // Re-open panel with AI filter if it's hidden
      if (isPanelHidden() && lastScanData) {
        // openPanel() handles both split screen (native) and floating (iframe) modes
        await openPanel();
        // Send scan results with AI filter
        sendPanelMessage('SCAN_RESULTS_WITH_FILTER', {
          ...lastScanData,
          initialFilter: 'ai-discovered',
        });
        sendPanelMessage('SELECTION_UPDATED', {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        });
      }
    }
  );
  
  if (result.failedEntities.length > 0) {
    log.debug(` ${result.failedEntities.length} AI entities could not be highlighted (not found in visible DOM):`, 
      result.failedEntities.map(e => e.value || e.name));
  }
  
  log.info(` AI entity highlighting complete: ${result.highlightedCount} highlights created, ${result.highlightedEntities.length}/${entities.length} entities found in DOM`);
  
  return result;
}

// ============================================================================
// Selection Management
// ============================================================================

function toggleSelection(_element: HTMLElement, value: string): void {
  if (selectedForImport.has(value)) {
    selectedForImport.delete(value);
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.remove('xtm-selected');
    });
  } else {
    selectedForImport.add(value);
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.add('xtm-selected');
    });
  }
  
  sendPanelMessage('SELECTION_UPDATED', {
    selectedCount: selectedForImport.size,
    selectedItems: Array.from(selectedForImport),
  });
  
  chrome.runtime.sendMessage({
    type: 'SELECTION_CHANGED',
    payload: {
      selectedCount: selectedForImport.size,
      selectedItems: Array.from(selectedForImport),
    },
  });
}

// ============================================================================
// Tooltip Handling
// ============================================================================

function handleHighlightHover(event: MouseEvent): void {
  // Find the highlight element - try multiple approaches for Edge compatibility
  let target: HTMLElement | null = null;
  
  // First try currentTarget (the element the listener is attached to)
  if (event.currentTarget instanceof HTMLElement) {
    target = event.currentTarget;
  }
  
  // Fallback: walk up from event.target to find the highlight
  if (!target || !target.getAttribute('data-type')) {
    let el = event.target as Node;
    while (el && el !== document.body) {
      if (el instanceof HTMLElement && el.classList.contains('xtm-highlight')) {
        target = el;
        break;
      }
      el = el.parentNode as Node;
    }
  }
  
  const tooltip = getTooltipElement();
  if (!tooltip || !target) return;
  
  // Use getAttribute for more reliable data access in Edge
  const rawType = target.getAttribute('data-type') || 'Unknown';
  const value = target.getAttribute('data-value') || '';
  const found = target.getAttribute('data-found') === 'true';
  
  try {
    const isEntityNotAddable = target.classList.contains('xtm-entity-not-addable');
    const isMixedState = target.getAttribute('data-mixed-state') === 'true';
    const isMultiPlatform = target.getAttribute('data-multi-platform') === 'true';
    const platformEntitiesJson = target.getAttribute('data-platform-entities') || '[]';
    
    const platformDef = getPlatformFromEntity(rawType);
    const platformName = platformDef.name;
    const displayType = getDisplayType(rawType);
  
    // Determine status text based on entity state
    let statusText: string;
    
    if (isMixedState) {
      try {
        const platformEntities = JSON.parse(platformEntitiesJson);
        const platformNames = platformEntities.map((p: { type: string; platformType?: string }) => {
          if (p.platformType) {
            return getPlatformName(p.platformType);
          }
          const def = getPlatformFromEntity(p.type);
          return def.name;
        }).filter((n: string, i: number, arr: string[]) => arr.indexOf(n) === i);
        
        const foundPlatformText = platformNames.length > 0 ? platformNames.join(', ') : 'other platform';
        statusText = `Not in ${platformName}, but found in ${foundPlatformText}`;
      } catch {
        statusText = 'Not in platform';
      }
    } else if (found) {
      if (isMultiPlatform) {
        try {
          const otherPlatformEntities = JSON.parse(platformEntitiesJson);
          const otherPlatformNames = otherPlatformEntities.map((p: { type: string; platformType?: string }) => {
            if (p.platformType) {
              return getPlatformName(p.platformType);
            }
            const def = getPlatformFromEntity(p.type);
            return def.name;
          }).filter((n: string, i: number, arr: string[]) => arr.indexOf(n) === i);
          
          const allPlatformNames = [platformName, ...otherPlatformNames];
          const uniquePlatformNames = [...new Set(allPlatformNames)];
          statusText = `Found in ${uniquePlatformNames.join(' and ')}`;
        } catch {
          statusText = `Found in ${platformName}`;
        }
      } else {
        statusText = `Found in ${platformName}`;
      }
    } else if (isEntityNotAddable) {
      statusText = `Not in ${platformName}`;
    } else {
      statusText = `Not in ${platformName}`;
    }
    
    // Clear existing content first
    while (tooltip.firstChild) {
      tooltip.removeChild(tooltip.firstChild);
    }
    
    // Create elements using DOM API instead of innerHTML (more reliable in Edge)
    const header = document.createElement('div');
    header.className = 'xtm-tooltip-header';
    const typeSpan = document.createElement('span');
    typeSpan.className = 'xtm-tooltip-type';
    typeSpan.textContent = displayType;
    header.appendChild(typeSpan);
    
    const valueDiv = document.createElement('div');
    valueDiv.className = 'xtm-tooltip-value';
    valueDiv.textContent = value;
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `xtm-tooltip-status ${found ? 'found' : 'not-found'}`;
    // Use text symbols instead of SVG for Edge compatibility
    const statusSymbol = found ? '✓ ' : '⚠ ';
    statusDiv.textContent = statusSymbol + statusText;
    
    tooltip.appendChild(header);
    tooltip.appendChild(valueDiv);
    tooltip.appendChild(statusDiv);
    
    const rect = target.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';
    tooltip.classList.add('visible');
  } catch (error) {
    log.error('Error in handleHighlightHover:', error);
  }
}

function handleHighlightLeave(): void {
  const tooltip = getTooltipElement();
  if (tooltip) {
    tooltip.classList.remove('visible');
    // Also reset inline styles for Edge compatibility
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
  }
}

// ============================================================================
// Highlight Click Handling
// ============================================================================

function handleHighlightClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  setHighlightClickInProgress(true);
  setTimeout(() => setHighlightClickInProgress(false), 500);
  
  if (event.returnValue !== undefined) {
    event.returnValue = false;
  }
  
  // Find the highlight element - try multiple approaches for Edge compatibility
  let target: HTMLElement | null = null;
  
  // First try currentTarget (the element the listener is attached to)
  if (event.currentTarget instanceof HTMLElement) {
    target = event.currentTarget;
  }
  
  // Fallback: walk up from event.target to find the highlight
  if (!target || !target.getAttribute('data-type')) {
    let el = event.target as Node;
    while (el && el !== document.body) {
      if (el instanceof HTMLElement && el.classList.contains('xtm-highlight')) {
        target = el;
        break;
      }
      el = el.parentNode as Node;
    }
  }
  
  if (!target) return;
  
  const isFoundEntity = target.getAttribute('data-found') === 'true';
  
  // Re-open panel if in scan mode and panel is closed
  // For found entities, showPanel() will handle opening the panel and sending SHOW_ENTITY
  // For new entities (not found), we need to show scan results for selection
  if (currentScanMode === 'scan' && lastScanData && !isFoundEntity) {
    if (getSplitScreenMode()) {
      // In split screen mode, request background to open native side panel immediately
      // Use OPEN_SIDE_PANEL_IMMEDIATE to preserve user gesture context for Edge
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL_IMMEDIATE' }).then(() => {
        // Give the panel time to open before sending data
        setTimeout(() => {
          sendPanelMessage('SCAN_RESULTS', lastScanData);
          sendPanelMessage('SELECTION_UPDATED', {
            selectedCount: selectedForImport.size,
            selectedItems: Array.from(selectedForImport),
          });
        }, 100);
      }).catch(() => {
        // Fallback: just send the message
        sendPanelMessage('SCAN_RESULTS', lastScanData);
        sendPanelMessage('SELECTION_UPDATED', {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        });
      });
    } else if (isPanelHidden()) {
      // Floating mode - show the iframe panel
      ensurePanelElements();
      showPanelElements();
      sendPanelMessage('SCAN_RESULTS', lastScanData);
      sendPanelMessage('SELECTION_UPDATED', {
        selectedCount: selectedForImport.size,
        selectedItems: Array.from(selectedForImport),
      });
    }
  }
  
  // Block parent anchor navigation
  let parent: HTMLElement | null = target.parentElement;
  while (parent && parent !== document.body) {
    if (parent.tagName === 'A') {
      const href = parent.getAttribute('href');
      const anchorElement = parent;
      anchorElement.removeAttribute('href');
      setTimeout(() => {
        if (href) anchorElement.setAttribute('href', href);
      }, 0);
      break;
    }
    parent = parent.parentElement;
  }
  
  const entityData = target.getAttribute('data-entity');
  const value = target.getAttribute('data-value') || '';
  const isEntityNotAddable = target.classList.contains('xtm-entity-not-addable');
  const isMixedState = target.getAttribute('data-mixed-state') === 'true';
  const isMultiPlatform = target.getAttribute('data-multi-platform') === 'true';
  const highlightType = target.getAttribute('data-type') || '';
  
  // Handle mixed state - click on green badge area
  if (isMixedState) {
    const rect = target.getBoundingClientRect();
    const clickX = event.clientX;
    const rightAreaStart = rect.right - 45;
    
    if (clickX >= rightAreaStart) {
      handleMixedStatePlatformClick(target, value);
      return;
    }
  }
  
  if (entityData) {
    try {
      const entity = JSON.parse(entityData);
      
      if (highlightType) {
        entity.type = highlightType;
      }
      
      if (isFoundEntity) {
        handleFoundEntityClick(event, target, entity, value, isMultiPlatform);
      } else if (isEntityNotAddable) {
        return;
      } else {
        toggleSelection(target, value);
      }
    } catch (e) {
      log.error(' Failed to parse entity data:', e);
    }
  }
}

async function handleFoundEntityClick(
  event: MouseEvent,
  target: HTMLElement,
  entity: DetectedObservable | DetectedOCTIEntity,
  value: string,
  isMultiPlatform: boolean
): Promise<void> {
  const rect = target.getBoundingClientRect();
  const clickX = event.clientX;
  const leftAreaEnd = rect.left + 30;
  
  const isSelectableType = !entity.type?.startsWith('oaev-');
  
  if (clickX <= leftAreaEnd && isSelectableType) {
    toggleSelection(target, value);
    return;
  }
  
  let platformMatches: Array<{ platformId: string; platformType: string; entityId: string; type: string; entityData?: unknown }> | undefined;
  
  if (isMultiPlatform) {
    platformMatches = buildPlatformMatches(target, entity);
  }
  
  // Pass fromScanResults flag and scan results to restore panel state when reopened
  // showPanel() handles all messaging including FORWARD_TO_PANEL for split screen mode
  const hasScanResults = lastScanData !== null;
  const scanResultsToRestore = hasScanResults ? {
    observables: lastScanData!.observables,
    openctiEntities: lastScanData!.openctiEntities,
  } : null;
  await showPanel(entity, platformMatches, hasScanResults, scanResultsToRestore);
}

async function handleMixedStatePlatformClick(target: HTMLElement, value: string): Promise<void> {
  try {
    const platformEntities = JSON.parse(target.getAttribute('data-platform-entities') || '[]');
    if (platformEntities.length > 0) {
      const platformEntity = platformEntities[0];
      const rawData = platformEntity.data || {};
      const entityType = rawData.type || platformEntity.type || 'Unknown';
      const platformType = rawData.platformType || platformEntity.platformType || 'openaev';
      
      // Prefix entity type if not already prefixed
      const prefixedType = entityType.startsWith('oaev-') || entityType.startsWith('ogrc-') 
        ? entityType 
        : prefixEntityType(entityType, platformType);
      const platformId = rawData.platformId || rawData.platformId || '';
      
      const cacheData = rawData.entityData || {};
      const entityId = rawData.entityId || rawData.id || cacheData.id || '';
      const entityName = rawData.name || cacheData.name || value;
      
      const entity = {
        ...rawData,
        ...cacheData,
        id: entityId,
        entityId: entityId,
        name: entityName,
        type: prefixedType,
        entity_type: prefixedType,
        value: value,
        existsInPlatform: true,
        found: true,
        platformId: platformId,
        platformType: platformType,
        isNonDefaultPlatform: true,
        entityData: cacheData,
      };
      
      const seenPlatformIds = new Set<string>();
      const platformMatches = platformEntities
        .map((pe: { type?: string; data?: Record<string, unknown> }) => {
          const peData = pe.data || {};
          const peCacheData = (peData.entityData || {}) as Record<string, unknown>;
          const peType = pe.type || (peData.type as string) || (peCacheData.type as string) || '';
          const peCleanType = peType.replace(/^(oaev|ogrc)-/, '');
          const pePlatformType = inferPlatformTypeFromEntityType(peType);
          const peId = (peData.entityId as string) || (peData.id as string) || (peCacheData.id as string) || '';
          const pePlatformId = (peData.platformId as string) || (peCacheData.platformId as string) || '';
          return {
            platformId: pePlatformId,
            platformType: pePlatformType,
            entityId: peId,
            type: peType,
            entityData: {
              ...peCacheData,
              type: peType,
              entity_type: peCleanType,
            },
          };
        })
        .filter((match: { platformId: string }) => {
          if (seenPlatformIds.has(match.platformId)) return false;
          seenPlatformIds.add(match.platformId);
          return true;
        });
      
      // Pass fromScanResults flag and scan results to restore panel state when reopened
      // showPanel() handles all messaging including FORWARD_TO_PANEL for split screen mode
      const hasScanResults = lastScanData !== null;
      const scanResultsToRestore = hasScanResults ? {
        observables: lastScanData!.observables,
        openctiEntities: lastScanData!.openctiEntities,
      } : null;
      await showPanel(entity, platformMatches, hasScanResults, scanResultsToRestore);
    }
  } catch (e) {
    log.error(' Failed to parse platform entities for mixed state:', e);
  }
}

function buildPlatformMatches(
  target: HTMLElement,
  entity: DetectedObservable | DetectedOCTIEntity
): Array<{ platformId: string; platformType: string; entityId: string; type: string; entityData?: unknown }> {
  try {
    const otherPlatformEntities = JSON.parse(target.getAttribute('data-platform-entities') || '[]');
    const primaryPlatformType = inferPlatformTypeFromEntityType(entity.type);
    const primaryType = entity.type || '';
    const primaryCleanType = primaryType.replace(/^(oaev|ogrc)-/, '');
    const primaryPlatformId = entity.platformId || 'primary';
    
    const seenPlatformIds = new Set<string>();
    seenPlatformIds.add(primaryPlatformId);
    
    const platformMatches = [
      {
        platformId: primaryPlatformId,
        platformType: primaryPlatformType,
        entityId: entity.entityId || (entity as { id?: string }).id || '',
        type: primaryType,
        entityData: {
          ...(entity.entityData || entity),
          entity_type: primaryCleanType,
        },
      },
    ];
    
    for (const p of otherPlatformEntities) {
      const pData = p.data || {};
      const pType = p.type || pData.type || '';
      const cleanType = pType.replace(/^(oaev|ogrc)-/, '');
      const pPlatformType = inferPlatformTypeFromEntityType(pType);
      const pPlatformId = pData.platformId || 'unknown';
      
      if (seenPlatformIds.has(pPlatformId)) continue;
      seenPlatformIds.add(pPlatformId);
      
      let pEntityId = pData.entityId || pData.id;
      if (!pEntityId && cleanType) {
        const typeToIdField: Record<string, string> = {
          'AttackPattern': 'attack_pattern_id',
          'Attack-Pattern': 'attack_pattern_id',
          'Finding': 'finding_id',
          'Asset': 'endpoint_id',
          'AssetGroup': 'asset_group_id',
          'Team': 'team_id',
          'Player': 'user_id',
          'User': 'user_id',
          'Scenario': 'scenario_id',
          'Exercise': 'exercise_id',
          'Organization': 'organization_id',
        };
        const idField = typeToIdField[cleanType];
        if (idField && pData[idField]) {
          pEntityId = pData[idField];
        }
      }
      
      platformMatches.push({
        platformId: pPlatformId,
        platformType: pPlatformType,
        entityId: pEntityId || '',
        type: pType,
        entityData: {
          ...pData,
          type: pType,
          entity_type: cleanType,
        },
      });
    }
    
    return platformMatches;
  } catch {
    return [];
  }
}

function handleHighlightRightClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  
  // Find the highlight element - try multiple approaches for Edge compatibility
  let target: HTMLElement | null = null;
  
  // First try currentTarget (the element the listener is attached to)
  if (event.currentTarget instanceof HTMLElement) {
    target = event.currentTarget;
  }
  
  // Fallback: walk up from event.target to find the highlight
  if (!target || !target.getAttribute('data-type')) {
    let el = event.target as Node;
    while (el && el !== document.body) {
      if (el instanceof HTMLElement && el.classList.contains('xtm-highlight')) {
        target = el;
        break;
      }
      el = el.parentNode as Node;
    }
  }
  
  if (!target) return;
  
  const entityData = target.getAttribute('data-entity');
  const found = target.getAttribute('data-found') === 'true';
  const isEntityNotAddable = target.classList.contains('xtm-entity-not-addable');
  
  if (entityData && !found && !isEntityNotAddable) {
    try {
      const entity = JSON.parse(entityData);
      showAddPanel(entity);
    } catch (e) {
      log.error(' Failed to parse entity data:', e);
    }
  }
}

function handleHighlightMouseDown(e: MouseEvent): void {
  e.stopPropagation();
  setHighlightClickInProgress(true);
  setTimeout(() => setHighlightClickInProgress(false), 500);
}

function handleHighlightMouseUp(e: MouseEvent): void {
  e.stopPropagation();
}

// ============================================================================
// Scanning Functions
// ============================================================================

async function scanPage(): Promise<void> {
  currentScanMode = 'scan';
  
  showToast({ type: 'info', message: 'Scanning page for entities...', showSpinner: true, persistent: true });
  
  try {
    clearHighlights();
    selectedForImport.clear();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const content = getComprehensivePageContent();
    const url = window.location.href;
    
    log.debug(` Scan content length: ${content.length} chars`);
    
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_PAGE',
      payload: { content, url },
    });
    
    if (response.success && response.data) {
      const data = response.data;
      scanResults = data;
      // Include page content in lastScanData for AI features when panel is re-opened
      lastScanData = { ...data, pageContent: content, pageTitle: document.title, pageUrl: url };
      
      highlightResults(data, {
        onHover: handleHighlightHover,
        onLeave: handleHighlightLeave,
        onClick: handleHighlightClick,
        onRightClick: handleHighlightRightClick,
        onMouseDown: handleHighlightMouseDown,
        onMouseUp: handleHighlightMouseUp,
      });
      
      const totalFound = [
        ...data.observables.filter((o: DetectedObservable) => o.found),
        ...data.openctiEntities.filter((s: DetectedOCTIEntity) => s.found),
        ...(data.cves || []).filter((c: DetectedOCTIEntity) => c.found),
        ...(data.openaevEntities || []).filter((e: { found?: boolean }) => e.found),
      ].length;
      const totalDetected = data.observables.length + data.openctiEntities.length + (data.cves?.length || 0) + (data.openaevEntities?.length || 0);
      
      if (totalDetected === 0) {
        showToast({ type: 'info', message: 'No entities detected on this page. Use search or AI to find more.' });
      } else {
        const message = totalFound > 0 
          ? `Found ${totalDetected} entit${totalDetected === 1 ? 'y' : 'ies'} (${totalFound} in platform)`
          : `Found ${totalDetected} entit${totalDetected === 1 ? 'y' : 'ies'}`;
        showToast({ 
          type: 'success', 
          message,
          action: { label: 'Scroll to first', onClick: scrollToFirstHighlight }
        });
      }
      
      // Always open panel (even with no results) so users can use search/AI features
      // openPanel() handles both split screen (native) and floating (iframe) modes
      await openPanel();
      
      // Include page content in scan results for AI features (relationship resolution, etc.)
      sendPanelMessage('SCAN_RESULTS', { ...data, pageContent: content, pageTitle: document.title, pageUrl: url });
      sendPanelMessage('SELECTION_UPDATED', {
        selectedCount: selectedForImport.size,
        selectedItems: Array.from(selectedForImport),
      });
    } else {
      showToast({ type: 'error', message: 'Scan failed: ' + response.error });
    }
  } catch (error) {
    log.error(' Scan error:', error);
    showToast({ type: 'error', message: 'Scan failed' });
  }
}

async function scanPageForOAEV(): Promise<void> {
  showToast({ type: 'info', message: 'Scanning page for assets...', showSpinner: true, persistent: true });
  
  try {
    clearHighlights();
    selectedForImport.clear();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const content = getComprehensivePageContent();
    const url = window.location.href;
    
    log.debug(' Starting OpenAEV scan...');
    
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content, url },
    });
    
    if (response.success && response.data) {
      const data = response.data;
      const entities = data.openaevEntities || [];
      
      scanResults = {
        observables: [],
        openctiEntities: [],
        cves: [],
        openaevEntities: entities,
        scanTime: data.scanTime || 0,
        url: data.url || url,
      };
      
      if (entities.length > 0) {
        highlightResults(scanResults, {
          onHover: handleHighlightHover,
          onLeave: handleHighlightLeave,
          onClick: handleHighlightClick,
          onRightClick: handleHighlightRightClick,
          onMouseDown: handleHighlightMouseDown,
          onMouseUp: handleHighlightMouseUp,
        });
      }
      
      if (entities.length === 0) {
        showToast({ type: 'info', message: 'No assets found on this page. Use search or AI to find more.' });
      } else {
        showToast({ 
          type: 'success', 
          message: `Found ${entities.length} asset${entities.length === 1 ? '' : 's'}`,
          action: { label: 'Scroll to first', onClick: scrollToFirstHighlight }
        });
      }
      
      // Always open panel (even with no results) so users can use search/AI features
      // openPanel() handles both split screen (native) and floating (iframe) modes
      await openPanel();
      
      // Include page content in scan results for AI features
      sendPanelMessage('SCAN_RESULTS', { ...scanResults, pageContent: content, pageTitle: document.title, pageUrl: url });
      sendPanelMessage('SELECTION_UPDATED', {
        selectedCount: selectedForImport.size,
        selectedItems: Array.from(selectedForImport),
      });
    } else {
      showToast({ type: 'error', message: 'OpenAEV scan failed: ' + (response?.error || 'Unknown error') });
    }
  } catch (error) {
    log.error(' SCAN_OAEV exception:', error);
    showToast({ type: 'error', message: 'OpenAEV scan error: ' + (error instanceof Error ? error.message : 'Unknown') });
  }
}

async function scanAllPlatforms(): Promise<void> {
  currentScanMode = 'scan';
  
  // Notify panel that scanning has started
  sendPanelMessage('SCAN_STARTED');
  
  showToast({ type: 'info', message: 'Scanning page across all platforms...', showSpinner: true, persistent: true });
  
  try {
    clearHighlights();
    selectedForImport.clear();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const content = getComprehensivePageContent();
    const url = window.location.href;
    
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_ALL',
      payload: { content, url },
    });
    
    if (response.success && response.data) {
      const data = response.data;
      scanResults = data;
      // Include page content in lastScanData for AI features when panel is re-opened
      lastScanData = { ...data, pageContent: content, pageTitle: document.title, pageUrl: url };
      
      highlightResults(data, {
        onHover: handleHighlightHover,
        onLeave: handleHighlightLeave,
        onClick: handleHighlightClick,
        onRightClick: handleHighlightRightClick,
        onMouseDown: handleHighlightMouseDown,
        onMouseUp: handleHighlightMouseUp,
      });
      
      // Count found entities per platform (CVEs can be found in both platforms via platformMatches)
      const cves = data.cves || [];
      const cveOctiCount = cves.filter((c: { found?: boolean; platformMatches?: Array<{ platformType?: string }> }) => 
        c.found && c.platformMatches?.some(pm => pm.platformType === 'opencti')
      ).length;
      const cveOaevCount = cves.filter((c: { found?: boolean; platformMatches?: Array<{ platformType?: string }> }) => 
        c.found && c.platformMatches?.some(pm => pm.platformType === 'openaev')
      ).length;
      
      const octiFound = [
        ...data.observables.filter((o: { found?: boolean }) => o.found),
        ...data.openctiEntities.filter((s: { found?: boolean }) => s.found),
      ].length + cveOctiCount;
      
      const oaevFound = (data.openaevEntities?.filter((e: { found?: boolean }) => e.found)?.length || 0) + cveOaevCount;
      
      const totalDetected = data.observables.length + data.openctiEntities.length + cves.length + (data.openaevEntities?.length || 0);
      
      if (totalDetected === 0) {
        showToast({ type: 'info', message: 'No entities found on this page. Use search or AI to find more.' });
      } else {
        const parts: string[] = [];
        if (octiFound > 0) parts.push(`${octiFound} in OpenCTI`);
        if (oaevFound > 0) parts.push(`${oaevFound} in OpenAEV`);
        const message = `Found ${totalDetected} entit${totalDetected === 1 ? 'y' : 'ies'}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
        showToast({ 
          type: 'success', 
          message,
          action: { label: 'Scroll to first', onClick: scrollToFirstHighlight }
        });
      }
      
      // Always open panel (even with no results) so users can use search/AI features
      // openPanel() handles both split screen (native) and floating (iframe) modes
      await openPanel();
      
      // Include page content in scan results for AI features
      sendPanelMessage('SCAN_RESULTS', { ...data, pageContent: content, pageTitle: document.title, pageUrl: url });
      sendPanelMessage('SELECTION_UPDATED', {
        selectedCount: selectedForImport.size,
        selectedItems: Array.from(selectedForImport),
      });
    } else {
      showToast({ type: 'error', message: 'Scan failed: ' + (response?.error || 'Unknown error') });
    }
  } catch (error) {
    log.error(' SCAN_ALL exception:', error);
    showToast({ type: 'error', message: 'Scan error: ' + (error instanceof Error ? error.message : 'Unknown') });
  }
}

async function scanPageForAtomicTesting(): Promise<void> {
  currentScanMode = 'atomic';
  
  showToast({ type: 'info', message: 'Scanning page for atomic testing targets...', showSpinner: true, persistent: true });
  
  try {
    clearHighlights();
    selectedForImport.clear();
    
    const content = getPageContentForScanning();
    const url = window.location.href;
    const pageTitle = document.title;
    
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content, url, includeAttackPatterns: true },
    });
    
    const atomicTargets: Array<{
      type: 'attack-pattern' | 'Domain-Name' | 'Hostname';
      value: string;
      name: string;
      entityId?: string;
      platformId?: string;
      data: unknown;
    }> = [];
    
    if (response?.success && response?.data?.platformEntities) {
      const attackPatterns = (response.data.openaevEntities || [])
        .filter((e: { type: string }) => e.type === 'AttackPattern');
      
      for (const ap of attackPatterns) {
        atomicTargets.push({
          type: 'attack-pattern',
          value: ap.name,
          name: ap.name,
          entityId: ap.entityId || ap.attack_pattern_id,
          platformId: ap.platformId,
          data: ap,
        });
      }
    }
    
    const domainMatches = detectDomainsAndHostnamesForAtomicTesting(content);
    for (const match of domainMatches) {
      atomicTargets.push({
        type: match.type as 'Domain-Name' | 'Hostname',
        value: match.value,
        name: match.value,
        data: { type: match.type, value: match.value },
      });
    }
    
    const textNodes = getTextNodes(document.body);
    const { nodeMap, fullText } = buildNodeMap(textNodes);
    
    for (const target of atomicTargets) {
      highlightForAtomicTesting(fullText, target.value, nodeMap, target);
      const externalId = (target.data as { attack_pattern_external_id?: string; externalId?: string })?.attack_pattern_external_id || 
                         (target.data as { externalId?: string })?.externalId;
      if (target.type === 'attack-pattern' && externalId && externalId !== target.value) {
        highlightForAtomicTesting(fullText, externalId, nodeMap, target);
      }
    }
    
    if (atomicTargets.length === 0) {
      showToast({ type: 'info', message: 'No attack patterns or domains found' });
    } else {
      showToast({ 
        type: 'success', 
        message: `Found ${atomicTargets.length} atomic testing target${atomicTargets.length === 1 ? '' : 's'}`,
        action: atomicTargets.length > 0 ? { label: 'Scroll to first', onClick: scrollToFirstHighlight } : undefined
      });
    }
    
    // openPanel() handles both split screen (native) and floating (iframe) modes
    await openPanel();
    
    const theme = await getCurrentTheme();
    
    sendPanelMessage('ATOMIC_TESTING_SCAN_RESULTS', {
      targets: atomicTargets,
      pageTitle,
      pageUrl: url,
      theme,
    });
  } catch (error) {
    log.error(' Atomic testing scan error:', error);
    showToast({ type: 'error', message: 'Atomic testing scan error: ' + (error instanceof Error ? error.message : 'Unknown') });
  }
}

async function scanPageForScenario(): Promise<void> {
  currentScanMode = 'scenario';
  
  showToast({ type: 'info', message: 'Scanning page for attack patterns...', showSpinner: true, persistent: true });
  
  try {
    clearHighlights();
    selectedForImport.clear();
    
    const content = getPageContentForScanning();
    const url = window.location.href;
    const pageTitle = document.title;
    
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content, url, includeAttackPatterns: true },
    });
    
    const attackPatterns: Array<{
      id: string;
      entityId: string;
      name: string;
      externalId?: string;
      description?: string;
      killChainPhases?: string[];
      platformId?: string;
    }> = [];
    
    if (response?.success && response?.data?.platformEntities) {
      const foundPatterns = (response.data.openaevEntities || [])
        .filter((e: { type: string }) => e.type === 'AttackPattern');
      
      for (const ap of foundPatterns) {
        const entityData = ap.entityData || {};
        const aliases = entityData.aliases || [];
        
        attackPatterns.push({
          id: ap.entityId || ap.id,
          entityId: ap.entityId || ap.id,
          name: ap.name,
          externalId: aliases[0],
          platformId: ap.platformId,
        });
      }
    }
    
    const pageDescription = generateCleanDescription(content);
    
    if (attackPatterns.length > 0) {
      highlightScenarioAttackPatterns(attackPatterns);
    }
    
    if (attackPatterns.length === 0) {
      showToast({ type: 'info', message: 'No attack patterns found - create empty scenario' });
    } else {
      showToast({ 
        type: 'success', 
        message: `Found ${attackPatterns.length} attack pattern${attackPatterns.length === 1 ? '' : 's'} for scenario`,
        action: { label: 'Scroll to first', onClick: scrollToFirstHighlight }
      });
    }
    
    // openPanel() handles both split screen (native) and floating (iframe) modes
    await openPanel();
    
    const theme = await getCurrentTheme();
    
    sendPanelMessage('SHOW_SCENARIO_PANEL', {
      attackPatterns,
      pageTitle,
      pageUrl: url,
      pageDescription,
      platformId: attackPatterns[0]?.platformId,
      theme,
    });
  } catch (error) {
    log.error(' Scenario scan error:', error);
    showToast({ type: 'error', message: 'Scenario scan error: ' + (error instanceof Error ? error.message : 'Unknown') });
  }
}

async function scanPageForInvestigation(platformId?: string): Promise<void> {
  currentScanMode = 'investigation';
  
  showToast({ type: 'info', message: 'Scanning page for existing entities...', showSpinner: true, persistent: true });
  
  try {
    clearHighlights();
    selectedForImport.clear();
    
    const content = getPageContentForScanning();
    const url = window.location.href;
    
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_PAGE',
      payload: { content, url },
    });
    
    if (response.success && response.data) {
      const data = response.data;
      
      // Investigation mode requires a specific OpenCTI platform
      // All entities must be found AND belong to the targeted platform
      
      const foundObservables = (data.observables || []).filter((o: DetectedObservable & { platformType?: string }) => {
        // Must be found in a platform
        if (!o.found) return false;
        // Must be from an OpenCTI platform (not OpenAEV)
        if (o.platformType && o.platformType !== 'opencti') return false;
        // Must match the targeted platform ID
        const entityPlatformId = o.platformId || (o as { platformId?: string }).platformId;
        if (platformId) {
          return entityPlatformId === platformId;
        }
        // If no platformId specified, still require entity to have a valid OpenCTI platform
        return !!entityPlatformId;
      });
      
      const foundOCTIEntities = (data.openctiEntities || []).filter((e: DetectedOCTIEntity & { platformType?: string }) => {
        // Must be found in a platform
        if (!e.found) return false;
        // Must be from an OpenCTI platform
        if (e.platformType && e.platformType !== 'opencti') return false;
        // Must match the targeted platform ID
        const entityPlatformId = e.platformId || (e as { platformId?: string }).platformId;
        if (platformId) {
          return entityPlatformId === platformId;
        }
        // If no platformId specified, still require entity to have a valid OpenCTI platform
        return !!entityPlatformId;
      });
      
      // Include CVEs that are found in the targeted OpenCTI platform
      // CVEs are detected via regex and enriched from OpenCTI API
      const foundCVEs = (data.cves || []).filter((cve: { found?: boolean; platformId?: string; platformType?: string }) => {
        // Must be found in a platform
        if (!cve.found) return false;
        // Must be from an OpenCTI platform (not OpenAEV)
        if (cve.platformType && cve.platformType !== 'opencti') return false;
        // Must match the targeted platform ID
        if (platformId) {
          return cve.platformId === platformId;
        }
        // If no platformId specified, still require CVE to have a valid OpenCTI platform
        return !!cve.platformId;
      });
      
      // Investigation mode is OpenCTI-only - no OpenAEV entities
      const investigationResults: ScanResultPayload = {
        observables: foundObservables,
        openctiEntities: foundOCTIEntities,
        cves: foundCVEs,
        openaevEntities: [], // Investigation is OpenCTI-only
        scanTime: data.scanTime,
        url: data.url,
      };
      
      highlightResultsForInvestigation(investigationResults, async (highlight) => {
        setHighlightClickInProgress(true);
        setTimeout(() => setHighlightClickInProgress(false), 500);
        
        if (isPanelHidden()) {
          // openPanel() handles both split screen (native) and floating (iframe) modes
          await openPanel();
        }
        
        const isNowSelected = !highlight.classList.contains('xtm-selected');
        highlight.classList.toggle('xtm-selected');
        
        sendPanelMessage('INVESTIGATION_TOGGLE_ENTITY', { 
          entityId: highlight.dataset.entityId,
          selected: isNowSelected,
        });
      });
      
      // Investigation mode is OpenCTI-only: observables, OCTI entities, and CVEs
      const allFoundEntities = [
        ...foundObservables.map((o: DetectedObservable) => ({
          id: o.entityId,
          type: o.type,
          name: o.value,
          value: o.value,
          platformId: o.platformId || (o as { platformId?: string }).platformId,
        })),
        ...foundOCTIEntities.map((e: DetectedOCTIEntity) => ({
          id: e.entityId,
          type: e.type,
          name: e.name,
          value: e.name,
          platformId: e.platformId || (e as { platformId?: string }).platformId,
        })),
        // Include CVEs (Vulnerability entities) detected via regex and found in OpenCTI
        ...foundCVEs.map((cve: { entityId?: string; type?: string; name?: string; platformId?: string }) => ({
          id: cve.entityId,
          type: cve.type || 'Vulnerability',
          name: cve.name,
          value: cve.name,
          platformId: cve.platformId,
        })),
      ].filter(e => e.id);
      
      const totalFound = allFoundEntities.length;
      if (totalFound === 0) {
        showToast({ type: 'info', message: 'No existing entities found on this page' });
      } else {
        showToast({ 
          type: 'success', 
          message: `Found ${totalFound} existing entit${totalFound === 1 ? 'y' : 'ies'} for investigation`,
          action: { label: 'Scroll to first', onClick: scrollToFirstHighlight }
        });
      }
      
      sendPanelMessage('INVESTIGATION_SCAN_RESULTS', { entities: allFoundEntities });
    } else {
      showToast({ type: 'error', message: 'Scan failed: ' + response.error });
      sendPanelMessage('INVESTIGATION_SCAN_RESULTS', { entities: [] });
    }
  } catch (error) {
    log.error(' Investigation scan error:', error);
    showToast({ type: 'error', message: 'Scan failed' });
    sendPanelMessage('INVESTIGATION_SCAN_RESULTS', { entities: [] });
  }
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[XTM] [CONTENT-DEBUG] Received message:', message.type);
  
  switch (message.type) {
    case 'PING':
      console.log('[XTM] [CONTENT-DEBUG] Responding to PING');
      sendResponse({ success: true, loaded: true });
      break;
      
    case 'SCAN_PAGE':
    case 'AUTO_SCAN_PAGE':
      console.log('[XTM] [CONTENT-DEBUG] Starting SCAN_PAGE...');
      scanPage().then(() => {
        console.log('[XTM] [CONTENT-DEBUG] SCAN_PAGE completed');
        sendResponse({ success: true });
      });
      return true;
    
    case 'SCAN_OAEV':
      console.log('[XTM] [CONTENT-DEBUG] Starting SCAN_OAEV...');
      scanPageForOAEV().then(() => {
        console.log('[XTM] [CONTENT-DEBUG] SCAN_OAEV completed');
        sendResponse({ success: true });
      });
      return true;
    
    case 'SCAN_ALL':
      console.log('[XTM] [CONTENT-DEBUG] Starting SCAN_ALL...');
      scanAllPlatforms().then(() => {
        console.log('[XTM] [CONTENT-DEBUG] SCAN_ALL completed');
        sendResponse({ success: true });
      });
      return true;
    
    case 'SCAN_ATOMIC_TESTING':
      scanPageForAtomicTesting().then(() => sendResponse({ success: true }));
      return true;
    
    case 'CREATE_SCENARIO_FROM_PAGE':
      scanPageForScenario().then(() => sendResponse({ success: true }));
      return true;
      
    case 'CLEAR_HIGHLIGHTS':
      clearHighlights();
      selectedForImport.clear();
      currentScanMode = null;
      lastScanData = null;
      // Notify panel to clear scan results and reset to empty state
      sendPanelMessage('CLEAR_SCAN_RESULTS');
      sendResponse({ success: true });
      break;
      
    case 'SCAN_FOR_INVESTIGATION': {
      const { platformId } = message.payload || {};
      scanPageForInvestigation(platformId).then(() => sendResponse({ success: true }));
      return true;
    }
      
    case 'INVESTIGATION_SYNC_SELECTION': {
      const { entityId, selected } = message.payload || {};
      if (entityId) {
        const highlight = document.querySelector(`.xtm-highlight.xtm-investigation[data-entity-id="${entityId}"]`);
        if (highlight) {
          if (selected) {
            highlight.classList.add('xtm-selected');
          } else {
            highlight.classList.remove('xtm-selected');
          }
        }
      }
      sendResponse({ success: true });
      break;
    }
    
    case 'INVESTIGATION_SYNC_ALL': {
      const { entityIds, selected } = message.payload || {};
      if (entityIds && Array.isArray(entityIds)) {
        for (const entityId of entityIds) {
          const highlight = document.querySelector(`.xtm-highlight.xtm-investigation[data-entity-id="${entityId}"]`);
          if (highlight) {
            if (selected) {
              highlight.classList.add('xtm-selected');
            } else {
              highlight.classList.remove('xtm-selected');
            }
          }
        }
      }
      sendResponse({ success: true });
      break;
    }
    
    case 'XTM_HIGHLIGHT_AI_ENTITIES': {
      const { entities } = message.payload || {};
      if (entities && Array.isArray(entities)) {
        const result = handleHighlightAIEntities(entities);
        // Return which entities were successfully highlighted so panel can filter
        sendResponse({ 
          success: true, 
          highlightedEntities: result.highlightedEntities,
          failedEntities: result.failedEntities,
        });
      } else {
        sendResponse({ success: true, highlightedEntities: [], failedEntities: [] });
      }
      break;
    }
      
    case 'HIDE_PANEL':
      hidePanel();
      sendResponse({ success: true });
      break;
    
    case 'XTM_SCROLL_TO_FIRST':
      scrollToFirstHighlight();
      sendResponse({ success: true });
      break;
    
    case 'XTM_SCROLL_TO_HIGHLIGHT': {
      // Value can be a string or array of strings (entity name + matched strings)
      const scrollValue = message.payload?.value;
      if (scrollValue && (typeof scrollValue === 'string' || (Array.isArray(scrollValue) && scrollValue.length > 0))) {
        const found = scrollToHighlightByValue(scrollValue);
        sendResponse({ success: true, found });
      } else {
        sendResponse({ success: false, error: 'No value provided' });
      }
      break;
    }
    
    case 'SPLIT_SCREEN_MODE_CHANGED': {
      // Refresh split screen mode cache when settings change
      // This allows the floating iframe to work again after disabling split screen mode
      refreshSplitScreenMode();
      // Re-initialize to update the cached value
      initializeSplitScreenMode().then((enabled) => {
        log.debug(' Split screen mode changed, new value:', enabled);
      });
      sendResponse({ success: true });
      break;
    }
      
    case 'GET_PAGE_CONTENT': {
      const articleData = extractArticleContent();
      const description = extractFirstParagraph(articleData.textContent);
      
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: articleData.title,
          content: articleData.textContent,
          html: articleData.content,
          description: description,
          excerpt: articleData.excerpt,
          byline: articleData.byline,
        },
      });
      break;
    }
    
    case 'GET_ARTICLE_CONTENT': {
      const article = extractArticleContent();
      const firstParagraph = extractFirstParagraph(article.textContent);
      
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: article.title,
          textContent: article.textContent,
          htmlContent: article.content,
          description: firstParagraph,
          excerpt: article.excerpt,
          byline: article.byline,
        },
      });
      break;
    }
      
    case 'CREATE_CONTAINER_FROM_PAGE':
      showContainerPanel();
      sendResponse({ success: true });
      break;
      
    case 'PREVIEW_SELECTION': {
      const entities: Array<DetectedObservable | DetectedOCTIEntity> = [];
      selectedForImport.forEach(value => {
        const highlight = document.querySelector(`.xtm-highlight[data-value="${CSS.escape(value)}"]`);
        if (highlight) {
          const entityData = (highlight as HTMLElement).dataset.entity;
          if (entityData) {
            try {
              entities.push(JSON.parse(entityData));
            } catch { /* skip */ }
          }
        }
      });
      showPreviewPanel(entities);
      sendResponse({ success: true });
      break;
    }
      
    case 'CREATE_INVESTIGATION':
      showInvestigationPanel();
      sendResponse({ success: true });
      break;
    
    case 'OPEN_SEARCH_PANEL':
      showSearchPanel();
      sendResponse({ success: true });
      break;
    
    case 'OPEN_UNIFIED_SEARCH_PANEL':
      showUnifiedSearchPanel();
      sendResponse({ success: true });
      break;
    
    case 'SEARCH_SELECTION':
      if (message.payload?.text) {
        showUnifiedSearchPanel(message.payload.text);
      }
      sendResponse({ success: true });
      break;
    
    case 'ADD_SELECTION':
      if (message.payload?.text) {
        showAddSelectionPanel(message.payload.text);
      }
      sendResponse({ success: true });
      break;
    
    case 'GENERATE_PDF':
      generateArticlePDF().then(result => {
        if (result) {
          sendResponse({ success: true, data: result });
        } else {
          sendResponse({ success: false, error: 'Failed to generate PDF' });
        }
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
      
    case 'GET_SELECTION':
      sendResponse({
        success: true,
        data: {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        },
      });
      break;
      
    case 'CLEAR_SELECTION':
      selectedForImport.clear();
      document.querySelectorAll('.xtm-highlight.xtm-selected').forEach(el => {
        el.classList.remove('xtm-selected');
      });
      sendResponse({ success: true });
      break;
      
    case 'ENTITY_ADDED': {
      const value = message.payload?.value;
      if (value) {
        document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
          el.classList.remove('xtm-not-found', 'xtm-selected');
          el.classList.add('xtm-found');
          (el as HTMLElement).dataset.found = 'true';
        });
        selectedForImport.delete(value);
      }
      sendResponse({ success: true });
      break;
    }
  }
});

// ============================================================================
// Initialize
// ============================================================================

console.log('[XTM] [CONTENT-DEBUG] About to call initialize()...');
initialize().then(() => {
  console.log('[XTM] [CONTENT-DEBUG] initialize() completed');
}).catch((err) => {
  console.error('[XTM] [CONTENT-DEBUG] initialize() failed:', err);
});
console.log('[XTM] [CONTENT-DEBUG] Content script module fully loaded');
