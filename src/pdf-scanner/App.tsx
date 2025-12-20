/**
 * PDF Scanner App
 * 
 * Renders a PDF using PDF.js with vertical scrolling and entity highlighting.
 * Communicates with the side panel for scan results display (same behavior as page scanning).
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import ThemeDark from '../shared/theme/ThemeDark';
import ThemeLight from '../shared/theme/ThemeLight';
import { HIGHLIGHT_FOUND, HIGHLIGHT_NOT_FOUND, HIGHLIGHT_AI_DISCOVERED } from '../shared/constants';
import type { ScanResultPayload } from '../shared/types/messages';
import RelationshipLinesOverlay from './RelationshipLinesOverlay';

interface RelationshipData {
  fromValue: string;
  toValue: string;
  relationshipType: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface HighlightPosition {
  entityValue: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// PDF.js imports
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - MUST be embedded in the extension for Chrome Web Store compliance
if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf-scanner/pdf.worker.min.mjs');
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

// Entity from scan results - includes all properties from DetectedObservable/DetectedOCTIEntity
// Using index signature to allow any additional properties from the original entity types
interface ScanEntity {
  value?: string;
  name?: string;
  type: string;
  found: boolean;
  id?: string;
  /** Entity ID in the platform */
  entityId?: string;
  /** Full entity data from platform */
  entityData?: unknown;
  /** Platform ID this entity belongs to */
  platformId?: string;
  /** Platform type (opencti, openaev, etc.) */
  platformType?: string;
  /** Multi-platform matches */
  platformMatches?: unknown[];
  /** Whether this entity was discovered by AI */
  discoveredByAI?: boolean;
  /** AI confidence level */
  aiConfidence?: 'high' | 'medium' | 'low';
  /** AI reason for discovery */
  aiReason?: string;
  /** Allow any additional properties from original entity types */
  [key: string]: unknown;
}

// Highlight region for click detection
interface HighlightRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  entityKey: string;
  entity: ScanEntity;
}

// Page component - renders a single PDF page with highlights
function PageRenderer({ 
  pdfDocument,
  pageNumber, 
  scale, 
  scanResults,
  numPages,
  selectedEntities,
  onEntityClick,
  onEntityHover,
  onHighlightPositions,
}: { 
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  scanResults: ScanResultPayload | null;
  numPages: number;
  selectedEntities: Set<string>;
  onEntityClick: (entityKey: string, entity: ScanEntity, isCheckboxClick: boolean) => void;
  onEntityHover: (entity: ScanEntity | null, x: number, y: number) => void;
  onHighlightPositions?: (pageNumber: number, positions: Array<{ entityValue: string; x: number; y: number; width: number; height: number }>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const isRenderingRef = useRef(false);
  const highlightRegionsRef = useRef<HighlightRegion[]>([]);

  // Store scanResults in ref for use in render effect without causing re-renders
  const scanResultsRef = useRef(scanResults);
  useEffect(() => {
    scanResultsRef.current = scanResults;
  }, [scanResults]);

  // Render page effect
  useEffect(() => {
    const canvas = canvasRef.current;
    const highlightCanvas = highlightCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !highlightCanvas || !container) return;

    // Cancel any ongoing render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    // Skip if already rendering
    if (isRenderingRef.current) return;

    const renderPageAsync = async () => {
      isRenderingRef.current = true;
      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        
        // Set canvas dimensions to match PDF page
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        highlightCanvas.width = viewport.width;
        highlightCanvas.height = viewport.height;
        
        // Set container dimensions to match canvas (ensures proper sizing)
        container.style.width = `${viewport.width}px`;
        container.style.height = `${viewport.height}px`;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        // Create render task
        const renderTask = page.render({
          canvasContext: context,
          viewport,
        } as Parameters<typeof page.render>[0]);
        
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
        renderTaskRef.current = null;

        // Render highlights after page is rendered (use ref to avoid dependency)
        highlightRegionsRef.current = await renderHighlightsOnCanvas(
          page, viewport, highlightCanvas, scanResultsRef.current, selectedEntities
        );
      } catch (err) {
        // Ignore cancellation errors
        if (err instanceof Error && err.message.includes('Rendering cancelled')) {
          return;
        }
        console.error(`Failed to render page ${pageNumber}:`, err);
      } finally {
        isRenderingRef.current = false;
      }
    };

    renderPageAsync();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDocument, pageNumber, scale, selectedEntities]);

  // Re-render highlights when scan results or selection changes
  useEffect(() => {
    const highlightCanvas = highlightCanvasRef.current;
    if (!highlightCanvas || isRenderingRef.current) return;

    const renderHighlightsAsync = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        highlightRegionsRef.current = await renderHighlightsOnCanvas(
          page, viewport, highlightCanvas, scanResults, selectedEntities
        );
      } catch (err) {
        console.error(`Failed to render highlights for page ${pageNumber}:`, err);
      }
    };

    renderHighlightsAsync();
  }, [pdfDocument, pageNumber, scale, scanResults, selectedEntities]);

  // Handle clicks on highlights
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = highlightCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find clicked highlight
    for (const region of highlightRegionsRef.current) {
      if (x >= region.x && x <= region.x + region.width &&
          y >= region.y && y <= region.y + region.height) {
        // Check if click was on the checkbox area (left ~30px of highlight)
        const checkboxAreaWidth = 30;
        const isCheckboxClick = x < region.x + checkboxAreaWidth;
        onEntityClick(region.entityKey, region.entity, isCheckboxClick);
        break;
      }
    }
  }, [onEntityClick]);

  // Handle mouse move for hover effects
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = highlightCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find hovered highlight
    let foundEntity: ScanEntity | null = null;
    for (const region of highlightRegionsRef.current) {
      if (x >= region.x && x <= region.x + region.width &&
          y >= region.y && y <= region.y + region.height) {
        foundEntity = region.entity;
        break;
      }
    }

    // Change cursor
    canvas.style.cursor = foundEntity ? 'pointer' : 'default';
    onEntityHover(foundEntity, e.clientX, e.clientY);
  }, [onEntityHover]);

  const handleCanvasMouseLeave = useCallback(() => {
    onEntityHover(null, 0, 0);
  }, [onEntityHover]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        mb: 3,
        boxShadow: 4,
        bgcolor: 'white',
        borderRadius: 1,
        overflow: 'visible',
        flexShrink: 0,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <canvas
        ref={highlightCanvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          bgcolor: 'rgba(0,0,0,0.6)',
          color: 'white',
          px: 1.5,
          py: 0.5,
          borderRadius: 1,
          fontSize: 12,
          pointerEvents: 'none',
        }}
      >
        {pageNumber} / {numPages}
      </Box>
    </Box>
  );
}

// Helper function to get unique entity key
function getEntityKey(entity: ScanEntity): string {
  const value = 'value' in entity && entity.value ? entity.value : 'name' in entity && entity.name ? entity.name : '';
  return `${entity.type}-${value}`.toLowerCase();
}

// Helper function to render highlights with checkboxes and icons
async function renderHighlightsOnCanvas(
  page: pdfjsLib.PDFPageProxy,
  viewport: { width: number; height: number; scale: number },
  canvas: HTMLCanvasElement,
  scanResults: ScanResultPayload | null,
  selectedEntities: Set<string>
): Promise<HighlightRegion[]> {
  const context = canvas.getContext('2d');
  const regions: HighlightRegion[] = [];
  
  if (!context) return regions;
  
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!scanResults) return regions;

  const textContent = await page.getTextContent();
  const allEntities: ScanEntity[] = [
    ...scanResults.observables.map(o => ({ ...o, type: o.type })),
    ...scanResults.openctiEntities.map(e => ({ ...e, name: e.name, type: e.type || 'entity' })),
    ...(scanResults.cves || []).map(c => ({ ...c, type: c.type || 'cve' })),
    // Include OpenAEV entities
    ...(scanResults.openaevEntities || []).map(e => ({
      ...e,
      name: e.name,
      type: e.type ? `oaev-${e.type}` : 'oaev-entity',
      found: e.found ?? true,
    })),
    // Include AI-discovered entities
    ...(scanResults.aiDiscoveredEntities || []).map(e => ({
      ...e,
      name: e.name,
      value: e.value,
      type: e.type || 'entity',
      found: false,
      discoveredByAI: true,
      aiReason: e.aiReason,
      aiConfidence: e.aiConfidence,
    })),
  ];

  // Track which entity occurrences have been drawn to avoid duplicate highlights at same position
  const drawnPositions = new Set<string>();

  textContent.items.forEach((item) => {
    const textItem = item as TextItem;
    const textStr = textItem.str;
    const textLower = textStr.toLowerCase();
    
    allEntities.forEach((entity) => {
      const entityValue = 'value' in entity && entity.value ? entity.value : 'name' in entity && entity.name ? entity.name : '';
      const searchValue = entityValue.toLowerCase();
      if (!searchValue || searchValue.length < 2) return;
      
      // Find all occurrences of the entity in this text item (word boundary matching)
      let searchIndex = 0;
      while (searchIndex < textLower.length) {
        const matchIndex = textLower.indexOf(searchValue, searchIndex);
        if (matchIndex === -1) break;
        
        // Check word boundaries - entity should be a complete word/token
        const charBefore = matchIndex > 0 ? textLower[matchIndex - 1] : ' ';
        const charAfter = matchIndex + searchValue.length < textLower.length 
          ? textLower[matchIndex + searchValue.length] 
          : ' ';
        
        // Simple word boundary check: non-alphanumeric or start/end of string
        const isWordBoundaryBefore = !/[a-z0-9]/.test(charBefore);
        const isWordBoundaryAfter = !/[a-z0-9]/.test(charAfter);
        
        if (isWordBoundaryBefore && isWordBoundaryAfter) {
          const entityKey = getEntityKey(entity);
          
          const [, , , fontHeight, x, y] = textItem.transform;
          const baseHeight = fontHeight * viewport.scale;
          // Keep height close to text size - minimal expansion
          const height = Math.max(baseHeight * 1.05, 12);
          
          // Calculate the position of this specific match within the text item
          // Use character ratio to estimate position (PDF.js doesn't give per-char positions)
          const fullTextWidth = textItem.width;
          const charWidth = textStr.length > 0 ? fullTextWidth / textStr.length : 0;
          const matchOffset = matchIndex * charWidth;
          const matchWidth = searchValue.length * charWidth;
          
          const scaledX = (x + matchOffset) * viewport.scale;
          const scaledY = canvas.height - (y * viewport.scale) - baseHeight - (height - baseHeight) / 2;
          const textWidth = matchWidth * viewport.scale;
          
          // Create unique position key to avoid overlapping highlights
          const positionKey = `${Math.round(scaledX)}-${Math.round(scaledY)}-${entityKey}`;
          if (drawnPositions.has(positionKey)) {
            searchIndex = matchIndex + 1;
            continue;
          }
          drawnPositions.add(positionKey);
          
          // Determine if entity is OpenAEV-only (not selectable for OpenCTI import)
          // OpenAEV entities have type starting with 'oaev-'
          const isOpenAEVOnly = entity.type?.startsWith('oaev-') || false;
          // Show checkbox only for entities that can be imported to OpenCTI
          // (not found entities that aren't OpenAEV-only, OR found entities that aren't OpenAEV-only for dual state)
          const showCheckbox = !isOpenAEVOnly || !entity.found;
          
          // Compact padding for checkbox (left) and icon (right)
          const checkboxSize = Math.min(height * 0.7, 10);
          const iconSize = Math.min(height * 0.7, 10);
          const padding = 2;
          const leftPadding = showCheckbox ? checkboxSize + padding * 2 : padding;
          const rightPadding = iconSize + padding * 2;
          const totalWidth = textWidth + leftPadding + rightPadding;
        
        const isSelected = selectedEntities.has(entityKey);
        const isAIDiscovered = entity.discoveredByAI === true;
        
        // Get colors based on found state - selection doesn't change background color
        // (matches webpage highlight behavior where selection only affects checkbox)
        let bgColor: string;
        let outlineColor: string;
        
        if (isAIDiscovered) {
          // AI-discovered entities use purple color
          bgColor = isSelected ? HIGHLIGHT_AI_DISCOVERED.backgroundHover : HIGHLIGHT_AI_DISCOVERED.background;
          outlineColor = HIGHLIGHT_AI_DISCOVERED.outline;
        } else if (entity.found) {
          // Found entities use green - slightly darker when selected
          bgColor = isSelected ? HIGHLIGHT_FOUND.backgroundHover : HIGHLIGHT_FOUND.background;
          outlineColor = HIGHLIGHT_FOUND.outline;
        } else {
          // Not found entities use orange - slightly darker when selected
          bgColor = isSelected ? HIGHLIGHT_NOT_FOUND.backgroundHover : HIGHLIGHT_NOT_FOUND.background;
          outlineColor = HIGHLIGHT_NOT_FOUND.outline;
        }
        
        const highlightX = scaledX - leftPadding;
        const highlightY = scaledY - padding;
        const highlightWidth = totalWidth;
        const highlightHeight = height + padding * 2;
        
        // Draw background
        context.fillStyle = bgColor;
        context.beginPath();
        context.roundRect(highlightX, highlightY, highlightWidth, highlightHeight, 2);
        context.fill();
        
        // Draw outline
        context.strokeStyle = outlineColor;
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(highlightX, highlightY, highlightWidth, highlightHeight, 2);
        context.stroke();
        
        // Draw checkbox on the left (only for entities that can be imported to OpenCTI)
        if (showCheckbox) {
          const checkboxX = highlightX + padding;
          const checkboxY = highlightY + (highlightHeight - checkboxSize) / 2;
          
          context.strokeStyle = outlineColor;
          context.lineWidth = 1;
          context.beginPath();
          context.roundRect(checkboxX, checkboxY, checkboxSize, checkboxSize, 1);
          context.stroke();
          
          if (isSelected) {
            // Fill checkbox
            context.fillStyle = outlineColor;
            context.beginPath();
            context.roundRect(checkboxX, checkboxY, checkboxSize, checkboxSize, 1);
            context.fill();
            
            // Draw checkmark
            context.strokeStyle = 'white';
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(checkboxX + checkboxSize * 0.2, checkboxY + checkboxSize * 0.5);
            context.lineTo(checkboxX + checkboxSize * 0.4, checkboxY + checkboxSize * 0.7);
            context.lineTo(checkboxX + checkboxSize * 0.8, checkboxY + checkboxSize * 0.3);
            context.stroke();
          }
        }
        
        // Draw status icon on the right
        const iconX = highlightX + highlightWidth - iconSize - padding;
        const iconY = highlightY + (highlightHeight - iconSize) / 2;
        
        if (isAIDiscovered) {
          // Draw AI sparkle/star icon for AI-discovered entities
          const cx = iconX + iconSize / 2;
          const cy = iconY + iconSize / 2;
          const r = iconSize / 2 - 1;
          
          context.fillStyle = HIGHLIGHT_AI_DISCOVERED.outline;
          context.beginPath();
          // Draw a simple 4-point star (sparkle)
          for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) - Math.PI / 2;
            const outerX = cx + Math.cos(angle) * r;
            const outerY = cy + Math.sin(angle) * r;
            const innerAngle = angle + Math.PI / 4;
            const innerX = cx + Math.cos(innerAngle) * (r * 0.4);
            const innerY = cy + Math.sin(innerAngle) * (r * 0.4);
            
            if (i === 0) {
              context.moveTo(outerX, outerY);
            } else {
              context.lineTo(outerX, outerY);
            }
            context.lineTo(innerX, innerY);
          }
          context.closePath();
          context.fill();
        } else if (entity.found) {
          // Draw checkmark icon for found
          context.strokeStyle = HIGHLIGHT_FOUND.outline;
          context.lineWidth = 1.5;
          context.beginPath();
          context.moveTo(iconX + iconSize * 0.15, iconY + iconSize * 0.5);
          context.lineTo(iconX + iconSize * 0.4, iconY + iconSize * 0.75);
          context.lineTo(iconX + iconSize * 0.85, iconY + iconSize * 0.25);
          context.stroke();
        } else {
          // Draw info circle icon for not found
          context.strokeStyle = HIGHLIGHT_NOT_FOUND.outline;
          context.lineWidth = 1;
          context.beginPath();
          context.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2 - 1, 0, Math.PI * 2);
          context.stroke();
          
          // Draw "i" in the circle
          context.fillStyle = HIGHLIGHT_NOT_FOUND.outline;
          context.font = `bold ${iconSize * 0.6}px sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText('i', iconX + iconSize / 2, iconY + iconSize / 2 + 1);
        }
        
          // Store region for click detection
          regions.push({
            x: highlightX,
            y: highlightY,
            width: highlightWidth,
            height: highlightHeight,
            entityKey,
            entity,
          });
        }
        
        // Move to next potential match
        searchIndex = matchIndex + searchValue.length;
      }
    });
  });
  
  return regions;
}

export default function App() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResultPayload | null>(null);
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [hoveredEntity, setHoveredEntity] = useState<{ entity: ScanEntity; x: number; y: number } | null>(null);
  const [splitScreenMode, setSplitScreenMode] = useState(false);
  const [relationships, setRelationships] = useState<RelationshipData[]>([]);
  const [highlightPositions, setHighlightPositions] = useState<Map<string, HighlightPosition[]>>(new Map());
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const panelIframeRef = useRef<HTMLIFrameElement | null>(null);
  
  // Store refs for stable references in message handlers
  const scanAndShowPanelRef = useRef<((content: string) => Promise<void>) | undefined>(undefined);
  const pageTextsRef = useRef<string[]>([]);
  
  useEffect(() => {
    pageTextsRef.current = pageTexts;
  }, [pageTexts]);

  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? ThemeDark() : ThemeLight();
    return createTheme(themeOptions);
  }, [mode]);

  // Create or get the panel iframe (for iframe mode only)
  const ensurePanelIframe = useCallback(() => {
    // Only use iframe in non-split-screen mode
    if (splitScreenMode) return null;
    
    let iframe = panelIframeRef.current;
    if (!iframe || !document.body.contains(iframe)) {
      // Create new iframe
      iframe = document.createElement('iframe');
      iframe.id = 'xtm-pdf-panel-iframe';
      iframe.src = chrome.runtime.getURL('panel/index.html');
      iframe.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 420px;
        height: 100vh;
        border: none;
        z-index: 2147483647;
        background: transparent;
        box-shadow: -2px 0 10px rgba(0,0,0,0.2);
        transition: transform 0.3s ease;
        transform: translateX(100%);
      `;
      document.body.appendChild(iframe);
      panelIframeRef.current = iframe;
    }
    return iframe;
  }, [splitScreenMode]);

  // Close the iframe panel
  const closeIframePanel = useCallback(() => {
    const iframe = panelIframeRef.current;
    if (iframe) {
      iframe.style.transform = 'translateX(100%)';
    }
  }, []);

  // Check if iframe panel is open
  const isIframePanelOpen = useCallback(() => {
    const iframe = panelIframeRef.current;
    return iframe && iframe.style.transform === 'translateX(0)';
  }, []);

  // Open the panel - behavior depends on mode and context
  // In iframe mode: Opens iframe panel (can be called programmatically)
  // In split screen mode: Opens native side panel (only works from direct user gesture like button click)
  const openPanel = useCallback(async (fromUserGesture = false) => {
    if (splitScreenMode) {
      // Native side panel mode - only works from direct user gesture
      if (fromUserGesture && typeof chrome !== 'undefined' && chrome.sidePanel?.open) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
          }
        } catch (e) {
          console.log('Failed to open native side panel:', e);
        }
      }
      // In split screen mode without user gesture, we can't open the panel
      // User will need to click the button
    } else {
      // Iframe mode - can open programmatically
      const iframe = ensurePanelIframe();
      if (iframe) {
        iframe.style.transform = 'translateX(0)';
      }
    }
  }, [splitScreenMode, ensurePanelIframe]);

  // Send message to panel (handles both iframe and native panel)
  const sendToPanel = useCallback((message: { type: string; payload?: unknown }) => {
    // Always forward to background for native side panel
    chrome.runtime.sendMessage({
      type: 'FORWARD_TO_PANEL',
      payload: message,
    }).catch(() => {});
    
    // Also post to iframe if it exists (same format as content/panel.ts)
    const iframe = panelIframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({
        type: message.type,
        payload: message.payload,
      }, '*');
    }
  }, []);

  // Handle entity click - toggle selection or open entity details
  const handleEntityClick = useCallback(async (entityKey: string, entity: ScanEntity, isCheckboxClick: boolean) => {
    // Determine if entity is OpenAEV-only (not selectable for OpenCTI import)
    const isOpenAEVOnly = entity.type?.startsWith('oaev-') || false;
    
    // Helper to build platformMatches for found entities
    const buildEntityPlatformMatches = (e: ScanEntity) => {
      // If entity already has platformMatches, use them
      if (e.platformMatches && e.platformMatches.length > 0) {
        return e.platformMatches;
      }
      // Otherwise, build a single-platform match from entity data
      const entityType = e.type || '';
      const cleanType = entityType.replace(/^(oaev|ogrc)-/, '');
      const platformType = entityType.startsWith('oaev-') ? 'openaev' : 'opencti';
      const entityId = e.entityId || (e as unknown as { id?: string }).id || '';
      const platformId = e.platformId || '';
      
      return [{
        platformId,
        platformType,
        entityId,
        type: entityType,
        entityData: {
          ...(e.entityData || {}),
          entity_type: cleanType,
        },
      }];
    };
    
    // For OpenAEV-only found entities, clicking anywhere opens entity details (no checkbox)
    if (isOpenAEVOnly && entity.found) {
      // Open panel with entity details
      const entityValue = 'value' in entity && entity.value ? entity.value : 
                         'name' in entity && entity.name ? entity.name : '';
      // Build platform matches for proper entity display
      const platformMatches = buildEntityPlatformMatches(entity);
      // Open panel first (this is a user gesture - click on highlight)
      await openPanel(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      // Spread entity directly into payload (same format as web page highlighting)
      sendToPanel({
        type: 'SHOW_ENTITY',
        payload: {
          ...entity,
          value: entityValue,
          name: entityValue,
          existsInPlatform: entity.found,
          fromScanResults: true,
          platformMatches,
          scanResults: scanResults ? {
            observables: scanResults.observables,
            openctiEntities: scanResults.openctiEntities,
          } : null,
        },
      });
      return;
    }
    
    // For non-OpenAEV-only entities:
    // - Checkbox click or not-found entity → toggle selection
    // - Main area click on found entity → open entity details
    if (!entity.found || isCheckboxClick) {
      setSelectedEntities(prev => {
        const next = new Set(prev);
        if (next.has(entityKey)) {
          next.delete(entityKey);
        } else {
          next.add(entityKey);
        }
        return next;
      });
      return;
    }
    
    // For found entities (not checkbox click), open panel with entity details
    const entityValue = 'value' in entity && entity.value ? entity.value : 
                       'name' in entity && entity.name ? entity.name : '';
    // Build platform matches for proper entity display
    const platformMatches = buildEntityPlatformMatches(entity);
    // Open panel first (this is a user gesture - click on highlight)
    await openPanel(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    // Spread entity directly into payload (same format as web page highlighting)
    sendToPanel({
      type: 'SHOW_ENTITY',
      payload: {
        ...entity,
        value: entityValue,
        name: entityValue,
        existsInPlatform: entity.found,
        fromScanResults: true,
        platformMatches,
        scanResults: scanResults ? {
          observables: scanResults.observables,
          openctiEntities: scanResults.openctiEntities,
        } : null,
      },
    });
  }, [scanResults, openPanel, sendToPanel]);

  // Handle entity hover
  const handleEntityHover = useCallback((entity: ScanEntity | null, x: number, y: number) => {
    if (entity) {
      setHoveredEntity({ entity, x, y });
    } else {
      setHoveredEntity(null);
    }
  }, []);

  // Send scan results to the panel
  // In iframe mode: opens panel automatically
  // In split screen mode: only sends results (user must click button to open)
  const sendResultsToPanel = useCallback(async (results: ScanResultPayload, pageContent: string, currentPdfUrl: string, autoOpen = true) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

    try {
      const payload = {
        ...results,
        pageContent,
        pageTitle: document.title || 'PDF Document',
        pageUrl: currentPdfUrl,
      };
      
      // In iframe mode, auto-open the panel
      // In split screen mode, we can't auto-open (requires user gesture)
      if (autoOpen && !splitScreenMode) {
        await openPanel();
        // Small delay to ensure panel is ready
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Send results to panel (both iframe and native)
      sendToPanel({
        type: 'SCAN_RESULTS',
        payload,
      });
    } catch (err) {
      console.error('Failed to send results to panel:', err);
    }
  }, [splitScreenMode, openPanel, sendToPanel]);

  // Scan PDF content and open side panel
  const scanAndShowPanel = async (content: string, currentPdfUrl: string) => {
    if (!currentPdfUrl) return;
    
    setScanning(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SCAN_PDF_CONTENT',
        payload: { content, url: currentPdfUrl },
      });

      if (response?.success && response.data) {
        setScanResults(response.data);
        // Open panel with results immediately after scan
        await sendResultsToPanel(response.data, content, currentPdfUrl);
      } else {
        console.error('Scan failed:', response?.error);
      }
    } catch (err) {
      console.error('Failed to scan PDF:', err);
    } finally {
      setScanning(false);
    }
  };

  // Keep ref in sync for message handlers - runs on every render to capture latest function
  useEffect(() => {
    scanAndShowPanelRef.current = (content: string) => scanAndShowPanel(content, pdfUrl || '');
  }); // No deps - always update ref with latest closure

  // Open panel (called from button click - user gesture)
  const togglePanel = async () => {
    if (!scanResults || !pdfUrl) return;
    
    // This is called from a button click, so it's a user gesture
    // In both modes, we can open the panel
    await openPanel(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Send results to panel (don't auto-open again)
    const fullText = pageTexts.join('\n');
    await sendResultsToPanel(scanResults, fullText, pdfUrl, false);
  };

  // Parse PDF URL and setup message listeners
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    if (url) {
      setPdfUrl(decodeURIComponent(url));
    } else {
      setError('No PDF URL provided');
      setLoading(false);
    }

    // Get theme and split screen mode from settings
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.success && response.data) {
          if (response.data.theme) {
            setMode(response.data.theme === 'light' ? 'light' : 'dark');
          }
          if (response.data.splitScreenMode !== undefined) {
            setSplitScreenMode(response.data.splitScreenMode);
          }
        }
      });
    }

    // Listen for messages from popup/panel
    const handleMessage = (
      message: { type: string; payload?: unknown },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (message.type === 'PDF_SCANNER_RESCAN_TRIGGER') {
        // Clear highlights first before rescanning
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        
        // Trigger rescan after clearing
        const fullText = pageTextsRef.current.join('\n');
        if (fullText && scanAndShowPanelRef.current) {
          scanAndShowPanelRef.current(fullText);
        }
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_HIGHLIGHTS' || message.type === 'PDF_SCANNER_CLEAR_HIGHLIGHTS') {
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        setRelationships([]);
        setHighlightPositions(new Map());
        chrome.runtime.sendMessage({
          type: 'FORWARD_TO_PANEL',
          payload: { type: 'CLEAR_SCAN_RESULTS' },
        });
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_HIGHLIGHTS_ONLY') {
        // Clear highlights only - don't send CLEAR_SCAN_RESULTS (user stays on scan results view)
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        setRelationships([]);
        setHighlightPositions(new Map());
        sendResponse({ success: true });
      } else if (message.type === 'ADD_AI_ENTITIES_TO_PDF') {
        // Add AI-discovered entities from panel to scanResults
        const aiEntities = message.payload as Array<{
          id: string;
          type: string;
          name: string;
          value: string;
          aiReason?: string;
          aiConfidence?: 'high' | 'medium' | 'low';
        }>;
        
        if (aiEntities && aiEntities.length > 0) {
          setScanResults(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              aiDiscoveredEntities: [
                ...(prev.aiDiscoveredEntities || []),
                ...aiEntities,
              ],
            };
          });
        }
        sendResponse({ success: true });
      } else if (message.type === 'GET_PDF_CONTENT') {
        // Return the extracted PDF text content for AI discovery
        const fullText = pageTextsRef.current.join('\n');
        sendResponse({
          success: true,
          data: {
            content: fullText,
            title: document.title || 'PDF Document',
            url: pdfUrl || '',
          },
        });
      } else if (message.type === 'DRAW_RELATIONSHIP_LINES') {
        // Draw relationship lines between highlighted entities
        const rels = message.payload?.relationships || [];
        setRelationships(rels);
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_RELATIONSHIP_LINES') {
        setRelationships([]);
        sendResponse({ success: true });
      }
      return true;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Listen for postMessage for relationship lines from the panel iframe
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      if (event.data?.type === 'XTM_DRAW_RELATIONSHIP_LINES') {
        const rels = event.data.payload?.relationships || [];
        setRelationships(rels);
      } else if (event.data?.type === 'XTM_CLEAR_RELATIONSHIP_LINES') {
        setRelationships([]);
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, []);

  // Track highlight positions when scan results change
  // This is done by observing changes and updating a positions map
  useEffect(() => {
    if (!scanResults || !pagesContainerRef.current) {
      setHighlightPositions(new Map());
      return;
    }

    // Build a map of entity values to their positions
    // We need to parse the scanResults to get entity values
    const positions = new Map<string, HighlightPosition[]>();
    
    const allEntities = [
      ...(scanResults.observables || []),
      ...(scanResults.openctiEntities || []),
      ...(scanResults.cves || []),
      ...(scanResults.openaevEntities || []),
      ...(scanResults.aiEntities || []),
    ];

    allEntities.forEach(entity => {
      const value = 'value' in entity && entity.value ? entity.value : 
                   'name' in entity && entity.name ? entity.name : '';
      if (value) {
        // We'll estimate positions based on the scroll container
        // The actual positions are computed by PageRenderer
        const key = value.toLowerCase();
        if (!positions.has(key)) {
          positions.set(key, []);
        }
      }
    });

    setHighlightPositions(positions);
  }, [scanResults]);

  // Load PDF document
  useEffect(() => {
    if (!pdfUrl) return;

    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          rangeChunkSize: 65536,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;
        
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        
        // Extract text from all pages
        const texts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => (item as TextItem).str)
            .join(' ');
          texts.push(pageText);
        }
        
        if (cancelled) return;
        setPageTexts(texts);
        setLoading(false);

        // Automatically scan and open panel using the ref (gets latest function)
        const fullText = texts.join('\n');
        if (scanAndShowPanelRef.current) {
          await scanAndShowPanelRef.current(fullText);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Rescan the PDF
  const rescan = async () => {
    if (!pdfUrl) return;
    const fullText = pageTexts.join('\n');
    await scanAndShowPanel(fullText, pdfUrl);
  };

  // Clear highlights
  const clearHighlights = () => {
    setScanResults(null);
    setSelectedEntities(new Set());
    chrome.runtime.sendMessage({
      type: 'FORWARD_TO_PANEL',
      payload: { type: 'CLEAR_SCAN_RESULTS' },
    });
  };

  // Zoom functions
  const zoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));

  // Open original PDF
  const openOriginal = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  // Loading state
  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            bgcolor: 'background.default',
            gap: 2,
          }}
        >
          <CircularProgress />
          <Typography>Loading PDF...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // Error state
  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            bgcolor: 'background.default',
            gap: 2,
          }}
        >
          <Typography color="error" variant="h6">
            Error loading PDF
          </Typography>
          <Typography color="text.secondary">{error}</Typography>
          {pdfUrl && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'primary.main', 
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={openOriginal}
            >
              Try opening the original PDF
            </Typography>
          )}
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        ref={containerRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          bgcolor: 'background.default',
        }}
      >
        {/* Toolbar */}
        <Paper
          elevation={2}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            borderRadius: 0,
            bgcolor: 'background.paper',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Filigran XTM - PDF Viewer
            </Typography>
            {scanning && <CircularProgress size={16} />}
            {selectedEntities.size > 0 && (
              <Typography variant="caption" color="primary">
                ({selectedEntities.size} selected)
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Zoom controls first */}
            <Tooltip title="Zoom out">
              <IconButton size="small" onClick={zoomOut}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </Typography>
            <Tooltip title="Zoom in">
              <IconButton size="small" onClick={zoomIn}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Box sx={{ mx: 1, borderLeft: 1, borderColor: 'divider', height: 24 }} />
            
            {/* Action buttons */}
            <Tooltip title={scanning ? "Scanning..." : "Rescan PDF"}>
              <IconButton size="small" onClick={rescan} disabled={scanning}>
                {scanning ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear highlights">
              <IconButton size="small" onClick={clearHighlights} disabled={!scanResults}>
                <HighlightOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open original PDF">
              <IconButton size="small" onClick={openOriginal}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            {/* Primary Open Results button */}
            <Tooltip title="Open scan results panel">
              <IconButton 
                size="small" 
                onClick={togglePanel} 
                disabled={!scanResults}
                sx={{
                  bgcolor: scanResults ? 'primary.main' : 'transparent',
                  color: scanResults ? 'primary.contrastText' : 'text.secondary',
                  '&:hover': {
                    bgcolor: scanResults ? 'primary.dark' : 'action.hover',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'transparent',
                  },
                }}
              >
                <MenuOpenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        {/* PDF Viewer - Vertical Scrolling */}
        <Box
          ref={pagesContainerRef}
          onClick={(e) => {
            // Close iframe panel when clicking on background (not on highlights)
            // Only in iframe mode - native panel is controlled by browser
            if (!splitScreenMode && e.target === e.currentTarget && isIframePanelOpen()) {
              closeIframePanel();
            }
          }}
          sx={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 3,
            bgcolor: mode === 'dark' ? '#1a1a2e' : '#f5f5f5',
          }}
        >
          {pdfDocument && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
            <PageRenderer
              key={pageNumber}
              pdfDocument={pdfDocument}
              pageNumber={pageNumber}
              scale={scale}
              scanResults={scanResults}
              numPages={numPages}
              selectedEntities={selectedEntities}
              onEntityClick={handleEntityClick}
              onEntityHover={handleEntityHover}
            />
          ))}
        </Box>

        {/* Tooltip for hovered entity */}
        {hoveredEntity && (
          <Box
            sx={{
              position: 'fixed',
              left: hoveredEntity.x + 10,
              top: hoveredEntity.y + 10,
              bgcolor: '#070d19',
              color: 'white',
              p: 1.5,
              borderRadius: 1,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              maxWidth: 320,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  color: '#0fbcff',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  fontSize: 10,
                  letterSpacing: 0.5,
                  bgcolor: 'rgba(15, 188, 255, 0.15)',
                  px: 1,
                  py: 0.25,
                  borderRadius: 0.5,
                }}
              >
                {hoveredEntity.entity.type}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
              {'value' in hoveredEntity.entity && hoveredEntity.entity.value 
                ? hoveredEntity.entity.value 
                : 'name' in hoveredEntity.entity && hoveredEntity.entity.name
                  ? hoveredEntity.entity.name
                  : ''}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 1,
                pt: 1,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                color: hoveredEntity.entity.discoveredByAI 
                  ? '#9c27b0' 
                  : hoveredEntity.entity.found 
                    ? '#00c853' 
                    : '#ffa726',
                fontSize: 12,
              }}
            >
              {hoveredEntity.entity.discoveredByAI 
                ? '✨ AI Discovered' 
                : hoveredEntity.entity.found 
                  ? `✓ Found in ${hoveredEntity.entity.platformType === 'openaev' ? 'OpenAEV' : 'OpenCTI'}` 
                  : 'ℹ Not found'}
            </Box>
            {/* Show AI confidence and reason for AI-discovered entities */}
            {hoveredEntity.entity.discoveredByAI && hoveredEntity.entity.aiConfidence && (
              <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary', display: 'block' }}>
                Confidence: {hoveredEntity.entity.aiConfidence}
              </Typography>
            )}
            {hoveredEntity.entity.discoveredByAI && hoveredEntity.entity.aiReason && (
              <Typography 
                variant="caption" 
                sx={{ 
                  mt: 0.5, 
                  color: 'text.secondary', 
                  display: 'block',
                  fontStyle: 'italic',
                  opacity: 0.8,
                }}
              >
                {hoveredEntity.entity.aiReason}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}
