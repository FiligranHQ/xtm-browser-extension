/**
 * PDF Highlight Utilities
 * 
 * Functions for rendering entity highlights on PDF pages
 */

import type * as pdfjsLib from 'pdfjs-dist';
import type { ScanResultPayload } from '../../shared/types/messages';
import { getHighlightColors, getStatusIconColor } from '../../shared/utils/highlight-colors';
import type { ScanEntity, HighlightRegion, TextItem, TextLine, CharPosition, PDFViewport } from '../types';

/**
 * Get unique entity key for deduplication
 */
export function getEntityKey(entity: ScanEntity): string {
  const value = 'value' in entity && entity.value ? entity.value : 'name' in entity && entity.name ? entity.name : '';
  return `${entity.type}-${value}`.toLowerCase();
}

/**
 * Y-position tolerance for grouping text items on the same line
 */
const Y_TOLERANCE = 3;

/**
 * Group text items by Y position into lines
 */
export function groupTextItemsIntoLines(textContent: { items: unknown[] }): TextLine[] {
  const lines: TextLine[] = [];
  
  // Sort items by Y position (top to bottom), then X (left to right)
  const sortedItems = [...textContent.items].sort((a, b) => {
    const itemA = a as TextItem;
    const itemB = b as TextItem;
    const yA = itemA.transform[5];
    const yB = itemB.transform[5];
    if (Math.abs(yA - yB) > Y_TOLERANCE) {
      return yB - yA; // Higher Y = higher on page in PDF coords (inverted)
    }
    return itemA.transform[4] - itemB.transform[4]; // Sort by X (left to right)
  });
  
  // Group into lines
  sortedItems.forEach((item) => {
    const textItem = item as TextItem;
    if (!textItem.str) return; // Skip empty items
    
    const itemY = textItem.transform[5];
    
    // Find existing line within Y tolerance
    const existingLine = lines.find(line => Math.abs(line.y - itemY) <= Y_TOLERANCE);
    
    if (existingLine) {
      existingLine.items.push(textItem);
    } else {
      lines.push({
        items: [textItem],
        combinedText: '',
        charMap: [],
        y: itemY,
      });
    }
  });
  
  return lines;
}

/**
 * Build combined text and character map for a line
 */
export function buildLineTextAndCharMap(line: TextLine): void {
  // Sort items in line by X position (left to right)
  line.items.sort((a, b) => a.transform[4] - b.transform[4]);
  
  let combinedText = '';
  const charMap: CharPosition[] = [];
  
  line.items.forEach((item, itemIndex) => {
    // Check if we need to add a space between this item and the previous one
    // This handles table columns and other cases where text items have gaps
    if (itemIndex > 0 && combinedText.length > 0) {
      const prevItem = line.items[itemIndex - 1];
      const prevItemEnd = prevItem.transform[4] + prevItem.width;
      const currentItemStart = item.transform[4];
      const gap = currentItemStart - prevItemEnd;
      
      // Calculate average character width for the previous item
      const avgCharWidth = prevItem.str.length > 0 ? prevItem.width / prevItem.str.length : 5;
      
      // Add space if:
      // 1. Gap is larger than 1 character (proportional), OR
      // 2. Gap is larger than 4 pixels absolute (handles tight PDF columns)
      // Also add space if the previous text ends with alphanumeric and current starts with alphanumeric
      const needsSpace = gap > avgCharWidth * 1.0 || gap > 4;
      const prevChar = prevItem.str.length > 0 ? prevItem.str[prevItem.str.length - 1] : '';
      const currChar = item.str.length > 0 ? item.str[0] : '';
      const alphanumericBoundary = /[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z0-9]/.test(currChar);
      
      if (needsSpace || (gap > 0 && alphanumericBoundary)) {
        // Add a space character (with no associated item for highlighting purposes)
        charMap.push({
          item: prevItem, // Associate with previous item
          charIndex: prevItem.str.length, // After the last char
          globalIndex: combinedText.length,
        });
        combinedText += ' ';
      }
    }
    
    const startGlobalIndex = combinedText.length;
    
    for (let i = 0; i < item.str.length; i++) {
      charMap.push({
        item,
        charIndex: i,
        globalIndex: startGlobalIndex + i,
      });
    }
    
    combinedText += item.str;
  });
  
  line.combinedText = combinedText;
  line.charMap = charMap;
}

/**
 * Extract all entities from scan results
 */
export function extractAllEntities(scanResults: ScanResultPayload): ScanEntity[] {
  return [
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
}

/**
 * Draw a single highlight with checkbox and status icon
 */
function drawHighlight(
  context: CanvasRenderingContext2D,
  entity: ScanEntity,
  highlightX: number,
  highlightY: number,
  highlightWidth: number,
  highlightHeight: number,
  isSelected: boolean,
  showCheckbox: boolean
): void {
  const isAIDiscovered = entity.discoveredByAI === true;
  
  // Get colors using shared utility
  const { background: bgColor, outline: outlineColor } = getHighlightColors({
    found: entity.found,
    discoveredByAI: isAIDiscovered,
    isSelected,
  });
  
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
  
  // Calculate sizes
  const checkboxSize = Math.min(highlightHeight * 0.5, 10);
  const iconSize = Math.min(highlightHeight * 0.5, 10);
  const padding = 2;
  
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
  
  // Get icon color using shared utility
  const iconColor = getStatusIconColor({ found: entity.found, discoveredByAI: isAIDiscovered });
  
  if (isAIDiscovered) {
    // Draw AI sparkle/star icon for AI-discovered entities
    const cx = iconX + iconSize / 2;
    const cy = iconY + iconSize / 2;
    const r = iconSize / 2 - 1;
    
    context.fillStyle = iconColor;
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
    context.strokeStyle = iconColor;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(iconX + iconSize * 0.15, iconY + iconSize * 0.5);
    context.lineTo(iconX + iconSize * 0.4, iconY + iconSize * 0.75);
    context.lineTo(iconX + iconSize * 0.85, iconY + iconSize * 0.25);
    context.stroke();
  } else {
    // Draw info circle icon for not found
    context.strokeStyle = iconColor;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2 - 1, 0, Math.PI * 2);
    context.stroke();
    
    // Draw "i" in the circle
    context.fillStyle = iconColor;
    context.font = `bold ${iconSize * 0.6}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('i', iconX + iconSize / 2, iconY + iconSize / 2 + 1);
  }
}

/**
 * Render highlights on canvas for all entities found in text
 */
export async function renderHighlightsOnCanvas(
  page: pdfjsLib.PDFPageProxy,
  viewport: PDFViewport,
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
  const allEntities = extractAllEntities(scanResults);

  // Track which entity occurrences have been drawn to avoid duplicate highlights at same position
  const drawnPositions = new Set<string>();

  // Group text items into lines
  const lines = groupTextItemsIntoLines(textContent);
  
  // Build combined text and character map for each line
  lines.forEach(line => buildLineTextAndCharMap(line));
  
  // Search for entities in combined line text
  lines.forEach((line) => {
    const textLower = line.combinedText.toLowerCase();
    
    allEntities.forEach((entity) => {
      const entityValue = 'value' in entity && entity.value ? entity.value : 'name' in entity && entity.name ? entity.name : '';
      const searchValue = entityValue.toLowerCase();
      if (!searchValue || searchValue.length < 2) return;
      
      // Find all occurrences of the entity in this line
      let searchIndex = 0;
      while (searchIndex < textLower.length) {
        const matchIndex = textLower.indexOf(searchValue, searchIndex);
        if (matchIndex === -1) break;
        
        // Check word boundaries
        const charBefore = matchIndex > 0 ? textLower[matchIndex - 1] : ' ';
        const charAfter = matchIndex + searchValue.length < textLower.length 
          ? textLower[matchIndex + searchValue.length] 
          : ' ';
        
        const isWordBoundaryBefore = !/[a-z0-9]/.test(charBefore);
        const isWordBoundaryAfter = !/[a-z0-9]/.test(charAfter);
        
        if (isWordBoundaryBefore && isWordBoundaryAfter) {
          const entityKey = getEntityKey(entity);
          
          // Get the characters that make up this match from the charMap
          const matchEndIndex = matchIndex + searchValue.length;
          const startCharPos = line.charMap[matchIndex];
          const endCharPos = line.charMap[matchEndIndex - 1];
          
          if (!startCharPos || !endCharPos) {
            searchIndex = matchIndex + 1;
            continue;
          }
          
          // Get the first item for font height and Y position
          const firstItem = startCharPos.item;
          const lastItem = endCharPos.item;
          
          const [, , , fontHeight, , y] = firstItem.transform;
          const baseHeight = fontHeight * viewport.scale;
          const height = Math.max(baseHeight * 1.05, 12);
          
          // Calculate X positions
          const firstItemX = firstItem.transform[4];
          const firstItemCharWidth = firstItem.str.length > 0 ? firstItem.width / firstItem.str.length : 0;
          const startX = firstItemX + (startCharPos.charIndex * firstItemCharWidth);
          
          const lastItemX = lastItem.transform[4];
          const lastItemCharWidth = lastItem.str.length > 0 ? lastItem.width / lastItem.str.length : 0;
          const endX = lastItemX + ((endCharPos.charIndex + 1) * lastItemCharWidth);
          
          const matchWidth = endX - startX;
          
          const scaledX = startX * viewport.scale;
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
          const isOpenAEVOnly = entity.type?.startsWith('oaev-') || false;
          const showCheckbox = !isOpenAEVOnly || !entity.found;
          
          // Calculate padding and dimensions
          const checkboxSize = Math.min(height * 0.7, 10);
          const iconSize = Math.min(height * 0.7, 10);
          const padding = 2;
          const leftPadding = showCheckbox ? checkboxSize + padding * 2 : padding;
          const rightPadding = iconSize + padding * 2;
          const totalWidth = textWidth + leftPadding + rightPadding;
          
          const isSelected = selectedEntities.has(entityKey);
          
          const highlightX = scaledX - leftPadding;
          const highlightY = scaledY - padding;
          const highlightWidth = totalWidth;
          const highlightHeight = height + padding * 2;
          
          // Draw the highlight
          drawHighlight(
            context,
            entity,
            highlightX,
            highlightY,
            highlightWidth,
            highlightHeight,
            isSelected,
            showCheckbox
          );
          
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

/**
 * Extract text from PDF page using line-based grouping
 * Ensures proper spacing between table columns
 */
export async function extractPageText(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  const lines = groupTextItemsIntoLines(textContent);
  
  const lineTexts = lines.map(line => {
    buildLineTextAndCharMap(line);
    return line.combinedText;
  });
  
  return lineTexts.join('\n');
}

