/**
 * PDF Highlight Utilities
 * 
 * Functions for rendering entity highlights on PDF pages
 */

import type * as pdfjsLib from 'pdfjs-dist';
import type { ScanResultPayload } from '../../shared/types/messages';
import { getHighlightColors, getStatusIconColor } from '../../shared/utils/highlight-colors';
import { generateDefangedVariants } from '../../shared/detection/patterns';
import {
  HIGHLIGHT_FOUND,
  HIGHLIGHT_NOT_FOUND,
} from '../../shared/constants';
import type { ScanEntity, HighlightRegion, TextItem, TextLine, CharPosition, PDFViewport } from '../types';

/**
 * Get all text values to search for from an observable
 * Uses the shared generateDefangedVariants utility for consistency
 */
function getSearchValuesForObservable(obs: { value: string; refangedValue?: string; isDefanged?: boolean }): string[] {
  const values: string[] = [];
  
  // Primary: Use value field (text as found in document)
  if (obs.value) {
    values.push(obs.value);
  }
  
  // Also try refangedValue if different (for cross-referencing)
  if (obs.refangedValue && obs.refangedValue !== obs.value) {
    values.push(obs.refangedValue);
  }
  
  // CRITICAL: If the observable value is NOT defanged (clean form),
  // also generate and search for defanged patterns.
  // This handles the case where detection deduplication chose the clean version
  // but the PDF has defanged text in the IOC column that we need to highlight.
  const valueToDefang = obs.value || obs.refangedValue;
  if (valueToDefang && !obs.isDefanged) {
    const defangedPatterns = generateDefangedVariants(valueToDefang);
    for (const pattern of defangedPatterns) {
      if (!values.includes(pattern)) {
        values.push(pattern);
      }
    }
  }
  
  return values;
}

/**
 * Get all text values to search for from a generic entity
 */
function getSearchValuesForEntity(entity: ScanEntity): string[] {
  const values: string[] = [];
  
  // For observables (have value field from detection)
  if ('value' in entity && entity.value) {
    values.push(String(entity.value));
  }
  
  // For named entities (OpenCTI entities, CVEs)
  if ('name' in entity && entity.name) {
    const name = String(entity.name);
    if (!values.includes(name)) {
      values.push(name);
    }
  }
  
  // For defanged observables: also try refangedValue (clean form)
  if ('refangedValue' in entity && entity.refangedValue) {
    const refanged = String(entity.refangedValue);
    if (!values.includes(refanged)) {
      values.push(refanged);
    }
  }
  
  // For OpenCTI entities: also try matchedValue (text that matched in detection)
  if ('matchedValue' in entity && entity.matchedValue) {
    const matched = String(entity.matchedValue);
    if (!values.includes(matched)) {
      values.push(matched);
    }
  }
  
  // For OpenCTI entities: add aliases (which include x_mitre_id for attack patterns)
  if ('aliases' in entity && Array.isArray(entity.aliases)) {
    for (const alias of entity.aliases) {
      if (alias && !values.includes(alias)) {
        values.push(alias);
      }
    }
  }
  
  // For OpenCTI entities: check entityData for x_mitre_id (attack patterns)
  if ('entityData' in entity && entity.entityData) {
    const entityData = entity.entityData as { x_mitre_id?: string; attack_pattern_external_id?: string };
    // OpenCTI attack patterns
    if (entityData.x_mitre_id && !values.includes(entityData.x_mitre_id)) {
      values.push(entityData.x_mitre_id);
    }
    // OpenAEV attack patterns
    if (entityData.attack_pattern_external_id && !values.includes(entityData.attack_pattern_external_id)) {
      values.push(entityData.attack_pattern_external_id);
    }
  }
  
  return values;
}

/**
 * Get the entity value for selection (consistent with panel/webpage)
 * This is used for selection state sync between highlights and scan results list
 */
export function getEntityValue(entity: ScanEntity): string {
  return 'value' in entity && entity.value ? String(entity.value) : 'name' in entity && entity.name ? String(entity.name) : '';
}

/**
 * Get unique entity key for position deduplication (includes type to avoid overlaps)
 */
export function getEntityPositionKey(entity: ScanEntity): string {
  const value = getEntityValue(entity);
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
 * Build a map of OpenAEV entity values for cross-platform lookup
 * Used to detect mixed state (not in OpenCTI but found in OpenAEV)
 */
function buildOpenAEVEntityMap(scanResults: ScanResultPayload): Set<string> {
  const openaevValues = new Set<string>();
  
  if (scanResults.openaevEntities) {
    for (const entity of scanResults.openaevEntities) {
      if (entity.found) {
        // Add the entity name (lowercase for case-insensitive matching)
        openaevValues.add(entity.name.toLowerCase());
        // Also add the value field if present
        if ('value' in entity && entity.value) {
          openaevValues.add(String(entity.value).toLowerCase());
        }
      }
    }
  }
  
  return openaevValues;
}

/**
 * Check if an entity value exists in OpenAEV (for mixed state detection)
 */
function isFoundInOpenAEV(entity: ScanEntity, openaevValues: Set<string>): boolean {
  // Check the entity value
  if ('value' in entity && entity.value) {
    if (openaevValues.has(String(entity.value).toLowerCase())) {
      return true;
    }
  }
  // Check the entity name
  if ('name' in entity && entity.name) {
    if (openaevValues.has(String(entity.name).toLowerCase())) {
      return true;
    }
  }
  return false;
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
  showCheckbox: boolean,
  isMixedState: boolean = false
): void {
  const isAIDiscovered = entity.discoveredByAI === true;
  
  // Calculate sizes
  const checkboxSize = Math.min(highlightHeight * 0.5, 10);
  const iconSize = Math.min(highlightHeight * 0.5, 10);
  const padding = 2;
  
  // For mixed state: draw gradient background (amber -> green)
  if (isMixedState) {
    // Draw gradient background: 70% amber, 30% green
    const gradient = context.createLinearGradient(highlightX, 0, highlightX + highlightWidth, 0);
    gradient.addColorStop(0, isSelected ? 'rgba(15, 188, 255, 0.2)' : HIGHLIGHT_NOT_FOUND.background);
    gradient.addColorStop(0.7, isSelected ? 'rgba(15, 188, 255, 0.2)' : HIGHLIGHT_NOT_FOUND.background);
    gradient.addColorStop(0.7, HIGHLIGHT_FOUND.background);
    gradient.addColorStop(1, HIGHLIGHT_FOUND.background);
    
    context.fillStyle = gradient;
    context.beginPath();
    context.roundRect(highlightX, highlightY, highlightWidth, highlightHeight, 2);
    context.fill();
    
    // Draw amber outline
    context.strokeStyle = isSelected ? '#0fbcff' : HIGHLIGHT_NOT_FOUND.outline;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(highlightX, highlightY, highlightWidth, highlightHeight, 2);
    context.stroke();
    
    // Draw checkbox on the left (amber style for mixed state)
    if (showCheckbox) {
      const checkboxX = highlightX + padding;
      const checkboxY = highlightY + (highlightHeight - checkboxSize) / 2;
      
      context.strokeStyle = isSelected ? '#0fbcff' : HIGHLIGHT_NOT_FOUND.outline;
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(checkboxX, checkboxY, checkboxSize, checkboxSize, 1);
      context.stroke();
      
      if (isSelected) {
        context.fillStyle = HIGHLIGHT_NOT_FOUND.outline;
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
    
    // Draw green checkmark on the right (found in OpenAEV)
    const iconX = highlightX + highlightWidth - iconSize - padding;
    const iconY = highlightY + (highlightHeight - iconSize) / 2;
    
    context.strokeStyle = HIGHLIGHT_FOUND.outline;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(iconX + iconSize * 0.15, iconY + iconSize * 0.5);
    context.lineTo(iconX + iconSize * 0.4, iconY + iconSize * 0.75);
    context.lineTo(iconX + iconSize * 0.85, iconY + iconSize * 0.25);
    context.stroke();
    
    return;
  }
  
  // Get colors using shared utility (for non-mixed state)
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
  
  // Build OpenAEV entity map for mixed state detection
  // (entities not found in OpenCTI but found in OpenAEV)
  const openaevValues = buildOpenAEVEntityMap(scanResults);
  
  // Build entities array combining all types, but preserving original observable values
  // This mirrors the webpage approach where obs.value is used directly
  const allEntities: Array<{ entity: ScanEntity; searchValues: string[] }> = [];
  
  // Process observables - use obs.value directly like the webpage does
  // This preserves the original defanged text from detection
  for (const obs of scanResults.observables) {
    const entity: ScanEntity = { ...obs, type: obs.type };
    const searchValues = getSearchValuesForObservable(obs);
    allEntities.push({ entity, searchValues });
  }
  
  // Process OpenCTI entities
  for (const e of scanResults.openctiEntities) {
    const entity: ScanEntity = { ...e, name: e.name, type: e.type || 'entity' };
    const searchValues = getSearchValuesForEntity(entity);
    allEntities.push({ entity, searchValues });
  }
  
  // Process CVEs
  for (const c of (scanResults.cves || [])) {
    const entity: ScanEntity = { ...c, type: c.type || 'cve' };
    const searchValues = getSearchValuesForEntity(entity);
    allEntities.push({ entity, searchValues });
  }
  
  // Process OpenAEV entities
  for (const e of (scanResults.openaevEntities || [])) {
    const entity: ScanEntity = {
      ...e,
      name: e.name,
      type: e.type ? `oaev-${e.type}` : 'oaev-entity',
      found: e.found ?? true,
    };
    const searchValues = getSearchValuesForEntity(entity);
    allEntities.push({ entity, searchValues });
  }
  
  // Process AI-discovered entities
  for (const e of (scanResults.aiDiscoveredEntities || [])) {
    const entity: ScanEntity = {
      ...e,
      name: e.name,
      value: e.value,
      type: e.type || 'entity',
      found: false,
      discoveredByAI: true,
      aiReason: e.aiReason,
      aiConfidence: e.aiConfidence,
    };
    const searchValues = getSearchValuesForEntity(entity);
    allEntities.push({ entity, searchValues });
  }

  // Track which entity occurrences have been drawn to avoid duplicate highlights at same position
  const drawnPositions = new Set<string>();

  // Group text items into lines
  const lines = groupTextItemsIntoLines(textContent);
  
  // Build combined text and character map for each line
  lines.forEach(line => buildLineTextAndCharMap(line));
  
  // IMPORTANT: Collect ALL matches first, then draw highlights
  // This ensures we find all occurrences before any position tracking interferes
  interface PendingHighlight {
    entity: ScanEntity;
    line: TextLine;
    matchIndex: number;
    searchValueLength: number;
  }
  const pendingHighlights: PendingHighlight[] = [];

  // First pass: collect all matches across all lines and entities
  lines.forEach((line) => {
    const textLower = line.combinedText.toLowerCase();
    
    allEntities.forEach(({ entity, searchValues }) => {
      for (const searchValue of searchValues) {
        const searchValueLower = searchValue.toLowerCase();
        if (!searchValueLower || searchValueLower.length < 2) continue;
        
        // Find ALL occurrences of this search value in this line
        let searchIndex = 0;
        while (searchIndex < textLower.length) {
          const matchIndex = textLower.indexOf(searchValueLower, searchIndex);
          if (matchIndex === -1) break;
          
          // Check word boundaries
          // Character BEFORE: '.', '-', '_', '[', ']' indicate we're INSIDE an identifier = reject
          // Character AFTER: only reject if alphanumeric (word continues), allow punctuation
          // 
          // e.g., "Software" should NOT match in "dl.software-update.org" (. before = reject)
          //       "Linux" should NOT match in "oaev-test-linux-01" (- before = reject)
          //       "Ransomware.Live" SHOULD match in "Ransomware.Live." (. after = just punctuation)
          const matchEndPos = matchIndex + searchValueLower.length;
          const charBefore = matchIndex > 0 ? textLower[matchIndex - 1] : undefined;
          const charAfter = matchEndPos < textLower.length 
            ? textLower[matchEndPos] 
            : undefined;
          
          // Check if character BEFORE indicates we're inside an identifier
          const isInsideIdentifier = charBefore && /[.\-_[\]]/.test(charBefore);
          
          // Check if character AFTER continues the word (alphanumeric)
          const wordContinuesAfter = charAfter && /[a-zA-Z0-9]/.test(charAfter);
          
          // Check if character BEFORE continues the word (alphanumeric)
          const wordContinuesBefore = charBefore && /[a-zA-Z0-9]/.test(charBefore);
          
          // Valid match: not inside identifier, word doesn't continue before/after
          if (!isInsideIdentifier && !wordContinuesBefore && !wordContinuesAfter) {
            // Collect this match for later drawing
            pendingHighlights.push({
              entity,
              line,
              matchIndex,
              searchValueLength: searchValueLower.length,
            });
          }
          
          // Move to next potential match
          searchIndex = matchIndex + searchValueLower.length;
        }
      }
    });
  });

  // Second pass: draw all collected highlights (deduplicating by position)
  for (const { entity, line, matchIndex, searchValueLength } of pendingHighlights) {
    // Use value for selection (consistent with panel/webpage)
    const entityValue = getEntityValue(entity);
    // Use type+value for position deduplication (avoid overlapping highlights)
    const entityPositionKey = getEntityPositionKey(entity);
    
    // Get the characters that make up this match from the charMap
    const matchEndIndex = matchIndex + searchValueLength;
    const startCharPos = line.charMap[matchIndex];
    const endCharPos = line.charMap[matchEndIndex - 1];
    
    if (!startCharPos || !endCharPos) {
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
    
    // Create unique position key to avoid overlapping highlights at exact same position
    // Use precise coordinates for position (not rounded) to detect truly identical positions
    const positionKey = `${scaledX.toFixed(1)}-${scaledY.toFixed(1)}-${entityPositionKey}`;
    if (drawnPositions.has(positionKey)) {
      continue;
    }
    drawnPositions.add(positionKey);
    
    // Determine if entity is OpenAEV-only (not selectable for OpenCTI import)
    const isOpenAEVOnly = entity.type?.startsWith('oaev-') || false;
    const showCheckbox = !isOpenAEVOnly || !entity.found;
    
    // Check for mixed state: entity not found in OpenCTI but found in OpenAEV
    // Only applies to observables and OpenCTI entities that are not found
    const isMixedState = !entity.found && 
                         !isOpenAEVOnly && 
                         !entity.discoveredByAI && 
                         isFoundInOpenAEV(entity, openaevValues);
    
    // Calculate padding and dimensions
    const checkboxSize = Math.min(height * 0.7, 10);
    const iconSize = Math.min(height * 0.7, 10);
    const padding = 2;
    const leftPadding = showCheckbox ? checkboxSize + padding * 2 : padding;
    const rightPadding = iconSize + padding * 2;
    const totalWidth = textWidth + leftPadding + rightPadding;
    
    const isSelected = selectedEntities.has(entityValue);
    
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
      showCheckbox,
      isMixedState
    );
    
    // Store region for click detection
    regions.push({
      x: highlightX,
      y: highlightY,
      width: highlightWidth,
      height: highlightHeight,
      entityKey: entityValue, // Use value for selection consistency with panel
      entity,
    });
  }
  
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

