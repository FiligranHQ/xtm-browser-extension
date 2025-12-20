/**
 * PageRenderer Component
 * 
 * Renders a single PDF page with entity highlights
 */

import { useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import type { PageRendererProps, ScanEntity, HighlightRegion } from '../types';
import { renderHighlightsOnCanvas } from '../utils';

export function PageRenderer({ 
  pdfDocument,
  pageNumber, 
  scale, 
  scanResults,
  numPages,
  selectedEntities,
  onEntityClick,
  onEntityHover,
  onHighlightPositions,
}: PageRendererProps) {
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

  // Helper to report highlight positions
  const reportHighlightPositions = useCallback((regions: HighlightRegion[]) => {
    if (onHighlightPositions && regions.length > 0) {
      const positions = regions.map(r => ({
        entityValue: 'value' in r.entity && r.entity.value ? r.entity.value : 
                    'name' in r.entity && r.entity.name ? r.entity.name : '',
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      }));
      onHighlightPositions(pageNumber, positions);
    }
  }, [onHighlightPositions, pageNumber]);

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
        
        reportHighlightPositions(highlightRegionsRef.current);
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
  }, [pdfDocument, pageNumber, scale, selectedEntities, reportHighlightPositions]);

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
        
        reportHighlightPositions(highlightRegionsRef.current);
      } catch (err) {
        console.error(`Failed to render highlights for page ${pageNumber}:`, err);
      }
    };

    renderHighlightsAsync();
  }, [pdfDocument, pageNumber, scale, scanResults, selectedEntities, reportHighlightPositions]);

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
      data-page-number={pageNumber}
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

