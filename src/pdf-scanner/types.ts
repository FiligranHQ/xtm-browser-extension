/**
 * PDF Scanner Types
 */

import type * as pdfjsLib from 'pdfjs-dist';

// Note: ScanEntity is a local type for PDF scanner that's more flexible
// than the panel's ScanResultEntity (which requires id and name).
// This allows working with raw scan results from DetectedObservable/DetectedOCTIEntity.

/**
 * Entity from scan results - flexible type for PDF scanner
 * Allows any properties from DetectedObservable/DetectedOCTIEntity
 */
export interface ScanEntity {
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

/**
 * Text item from PDF.js text content
 */
export interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * Highlight region for click detection
 */
export interface HighlightRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  entityKey: string;
  entity: ScanEntity;
}

/**
 * Character position mapping for text extraction
 */
export interface CharPosition {
  item: TextItem;
  charIndex: number; // Index within the item's str
  globalIndex: number; // Index in combined text
}

/**
 * Text line structure for combining adjacent text items
 */
export interface TextLine {
  items: TextItem[];
  combinedText: string;
  charMap: CharPosition[]; // Maps global char index to item + local char index
  y: number; // Base Y position for this line
}

/**
 * Props for the PageRenderer component
 */
export interface PageRendererProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  scanResults: import('../shared/types/messages').ScanResultPayload | null;
  numPages: number;
  selectedEntities: Set<string>;
  onEntityClick: (entityKey: string, entity: ScanEntity, isCheckboxClick: boolean) => void;
  onEntityHover: (entity: ScanEntity | null, x: number, y: number) => void;
  onHighlightPositions?: (pageNumber: number, positions: Array<{ entityValue: string; x: number; y: number; width: number; height: number }>) => void;
}

/**
 * Viewport info from PDF.js
 */
export interface PDFViewport {
  width: number;
  height: number;
  scale: number;
}

/**
 * Hovered entity state
 */
export interface HoveredEntityState {
  entity: ScanEntity;
  x: number;
  y: number;
}
