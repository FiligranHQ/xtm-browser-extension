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
import themeDark from '../shared/theme/theme-dark';
import themeLight from '../shared/theme/theme-light';
import type { ScanResultPayload } from '../shared/types/messages';
import { inferPlatformTypeFromEntityType } from '../shared/platform/registry';

// PDF.js imports
import * as pdfjsLib from 'pdfjs-dist';

// Local imports
import type { ScanEntity, HoveredEntityState } from './types';
import { PageRenderer } from './components/PageRenderer';
import { PDFToolbar } from './components/PDFToolbar';
import { EntityTooltip } from './components/EntityTooltip';
import { usePanelManager } from './hooks/usePanelManager';
import { useMessageHandlers } from './hooks/useMessageHandlers';
import { groupTextItemsIntoLines, buildLineTextAndCharMap } from './utils/highlight-utils';

// Configure PDF.js worker - MUST be embedded in the extension for Chrome Web Store compliance
if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf-scanner/pdf.worker.min.mjs');
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export default function App() {
  // State
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
  const [hoveredEntity, setHoveredEntity] = useState<HoveredEntityState | null>(null);
  const [splitScreenMode, setSplitScreenMode] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const scanAndShowPanelRef = useRef<((content: string) => Promise<void>) | undefined>(undefined);
  const pageTextsRef = useRef<string[]>([]);
  const pdfUrlRef = useRef<string>(pdfUrl || '');
  
  // Keep refs in sync
  useEffect(() => {
    pageTextsRef.current = pageTexts;
  }, [pageTexts]);
  
  useEffect(() => {
    pdfUrlRef.current = pdfUrl || '';
  }, [pdfUrl]);

  // Theme
  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? themeDark() : themeLight();
    return createTheme(themeOptions);
  }, [mode]);

  // Panel manager hook
  const {
    closeIframePanel,
    isIframePanelOpen,
    openPanel,
    sendToPanel,
    sendResultsToPanel,
    panelIframeRef,
  } = usePanelManager({ splitScreenMode });

  // Message handlers hook
  useMessageHandlers({
    pageTextsRef,
    pdfUrlRef,
    scanAndShowPanelRef,
    panelIframeRef,
    pdfUrl,
    setScanResults,
    setSelectedEntities,
    setHoveredEntity,
    setMode,
    setSplitScreenMode,
    closeIframePanel,
  });

  // Build platform matches for found entities
  const buildEntityPlatformMatches = useCallback((entity: ScanEntity) => {
    if (entity.platformMatches && entity.platformMatches.length > 0) {
      return entity.platformMatches;
    }
    const entityType = entity.type || '';
    const cleanType = entityType.replace(/^(oaev|ogrc)-/, '');
    const platformType = inferPlatformTypeFromEntityType(entityType);
    const entityId = entity.entityId || (entity as unknown as { id?: string }).id || '';
    const platformId = entity.platformId || '';
    
    return [{
      platformId,
      platformType,
      entityId,
      type: entityType,
      entityData: {
        ...(entity.entityData || {}),
        entity_type: cleanType,
      },
    }];
  }, []);

  // Handle entity click - toggle selection or open entity details
  const handleEntityClick = useCallback(async (entityKey: string, entity: ScanEntity, isCheckboxClick: boolean) => {
    const isOpenAEVOnly = entity.type?.startsWith('oaev-') || false;
    
    // For OpenAEV-only found entities, clicking anywhere opens entity details (no checkbox)
    if (isOpenAEVOnly && entity.found) {
      const entityValue = 'value' in entity && entity.value ? entity.value : 
                         'name' in entity && entity.name ? entity.name : '';
      const platformMatches = buildEntityPlatformMatches(entity);
      await openPanel(true);
      await new Promise(resolve => setTimeout(resolve, 100));
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
    const platformMatches = buildEntityPlatformMatches(entity);
    await openPanel(true);
    await new Promise(resolve => setTimeout(resolve, 100));
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
  }, [scanResults, openPanel, sendToPanel, buildEntityPlatformMatches]);

  // Handle entity hover
  const handleEntityHover = useCallback((entity: ScanEntity | null, x: number, y: number) => {
    if (entity) {
      setHoveredEntity({ entity, x, y });
    } else {
      setHoveredEntity(null);
    }
  }, []);

  // Scan PDF content and open side panel
  const scanAndShowPanel = useCallback(async (content: string, currentPdfUrl: string) => {
    if (!currentPdfUrl) return;
    
    setScanning(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SCAN_PDF_CONTENT',
        payload: { content, url: currentPdfUrl },
      });

      if (response?.success && response.data) {
        setScanResults(response.data);
        await sendResultsToPanel(response.data, content, currentPdfUrl);
      } else {
        console.error('Scan failed:', response?.error);
      }
    } catch (err) {
      console.error('Failed to scan PDF:', err);
    } finally {
      setScanning(false);
    }
  }, [sendResultsToPanel]);

  // Keep ref in sync for message handlers
  useEffect(() => {
    scanAndShowPanelRef.current = (content: string) => scanAndShowPanel(content, pdfUrl || '');
  });

  // Toggle panel (called from button click - user gesture)
  const togglePanel = useCallback(async () => {
    if (!scanResults || !pdfUrl) return;
    
    await openPanel(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const fullText = pageTexts.join('\n');
    await sendResultsToPanel(scanResults, fullText, pdfUrl, false);
  }, [scanResults, pdfUrl, pageTexts, openPanel, sendResultsToPanel]);

  // Parse PDF URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    if (url) {
      setPdfUrl(decodeURIComponent(url));
    } else {
      setError('No PDF URL provided');
      setLoading(false);
    }
  }, []);

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
        
        // Extract text from all pages using line-based grouping
        const texts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Group items into lines
          const lines = groupTextItemsIntoLines(textContent);
          
          // Build combined text for each line
          const lineTexts = lines.map(line => {
            buildLineTextAndCharMap(line);
            return line.combinedText;
          });
          
          texts.push(lineTexts.join('\n'));
        }
        
        if (cancelled) return;
        setPageTexts(texts);
        setLoading(false);

        // Automatically scan and open panel
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
  const rescan = useCallback(async () => {
    if (!pdfUrl) return;
    const fullText = pageTexts.join('\n');
    await scanAndShowPanel(fullText, pdfUrl);
  }, [pdfUrl, pageTexts, scanAndShowPanel]);

  // Clear highlights
  const clearHighlights = useCallback(() => {
    setScanResults(null);
    setSelectedEntities(new Set());
    chrome.runtime.sendMessage({
      type: 'FORWARD_TO_PANEL',
      payload: { type: 'CLEAR_SCAN_RESULTS' },
    });
  }, []);

  // Zoom functions
  const zoomIn = useCallback(() => setScale(s => Math.min(s + 0.2, 3)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(s - 0.2, 0.5)), []);

  // Open original PDF
  const openOriginal = useCallback(() => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  }, [pdfUrl]);

  // Handle background click to close panel
  const handleBackgroundClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!splitScreenMode && isIframePanelOpen()) {
      const target = e.target as HTMLElement;
      const isHighlight = target.hasAttribute?.('data-entity-value') || 
                          target.closest?.('[data-entity-value]') ||
                          target.closest?.('.xtm-panel-iframe');
      if (!isHighlight) {
        closeIframePanel();
      }
    }
  }, [splitScreenMode, isIframePanelOpen, closeIframePanel]);

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
        <PDFToolbar
          scale={scale}
          scanning={scanning}
          selectedCount={selectedEntities.size}
          hasScanResults={!!scanResults}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onRescan={rescan}
          onClearHighlights={clearHighlights}
          onOpenOriginal={openOriginal}
          onTogglePanel={togglePanel}
        />

        {/* PDF Viewer - Vertical Scrolling */}
        <Box
          ref={pagesContainerRef}
          onClick={handleBackgroundClick}
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
        {hoveredEntity && <EntityTooltip hoveredEntity={hoveredEntity} />}
      </Box>
    </ThemeProvider>
  );
}
