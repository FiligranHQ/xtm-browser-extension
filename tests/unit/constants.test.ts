/**
 * Unit Tests for Constants
 * 
 * Tests application constants and configuration values.
 */

import { describe, it, expect } from 'vitest';
import {
  CONNECTION_TIMEOUT_MS,
  ENTITY_FETCH_TIMEOUT_MS,
  SEARCH_TIMEOUT_MS,
  CONTAINER_FETCH_TIMEOUT_MS,
  PLATFORM_STARTUP_TIMEOUT_MS,
  CACHE_DURATION_MS,
  CACHE_REFRESH_INTERVAL_MS,
  OPENCTI_PAGE_SIZE,
  OPENAEV_PAGE_SIZE,
  OPENAEV_FINDINGS_PAGE_SIZE,
  MAX_DESCRIPTION_LENGTH,
  MAX_URL_DISPLAY_LENGTH,
  MIN_ENTITY_NAME_LENGTH,
  MAX_PAGINATION_PAGES,
  PANEL_WIDTH_PX,
  OVERLAY_Z_INDEX,
  PANEL_Z_INDEX,
  FILIGRAN_URL,
  EE_TRIAL_URL,
  OPENCTI_DOCS_URL,
  OPENAEV_DOCS_URL,
  EXTENSION_VERSION,
  EXTENSION_NAME,
  HIGHLIGHT_FOUND,
  HIGHLIGHT_NOT_FOUND,
  HIGHLIGHT_SELECTED,
  HIGHLIGHT_AI_DISCOVERED,
} from '../../src/shared/constants';

// ============================================================================
// Timeout Constants Tests
// ============================================================================

describe('Timeout Constants', () => {
  it('should have reasonable CONNECTION_TIMEOUT_MS', () => {
    expect(CONNECTION_TIMEOUT_MS).toBeGreaterThan(0);
    expect(CONNECTION_TIMEOUT_MS).toBeLessThanOrEqual(30000); // Max 30 seconds
    expect(CONNECTION_TIMEOUT_MS).toBe(8000);
  });

  it('should have reasonable ENTITY_FETCH_TIMEOUT_MS', () => {
    expect(ENTITY_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
    expect(ENTITY_FETCH_TIMEOUT_MS).toBeLessThanOrEqual(60000); // Max 60 seconds
    expect(ENTITY_FETCH_TIMEOUT_MS).toBe(15000);
  });

  it('should have reasonable SEARCH_TIMEOUT_MS', () => {
    expect(SEARCH_TIMEOUT_MS).toBeGreaterThan(0);
    expect(SEARCH_TIMEOUT_MS).toBeLessThanOrEqual(60000);
    expect(SEARCH_TIMEOUT_MS).toBe(10000);
  });

  it('should have CONTAINER_FETCH_TIMEOUT_MS >= ENTITY_FETCH_TIMEOUT_MS', () => {
    expect(CONTAINER_FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(ENTITY_FETCH_TIMEOUT_MS);
  });

  it('should have reasonable PLATFORM_STARTUP_TIMEOUT_MS', () => {
    expect(PLATFORM_STARTUP_TIMEOUT_MS).toBeGreaterThan(0);
    expect(PLATFORM_STARTUP_TIMEOUT_MS).toBe(10000);
  });
});

// ============================================================================
// Cache Configuration Tests
// ============================================================================

describe('Cache Configuration', () => {
  it('should have CACHE_DURATION_MS of at least 30 minutes', () => {
    const thirtyMinutes = 30 * 60 * 1000;
    expect(CACHE_DURATION_MS).toBeGreaterThanOrEqual(thirtyMinutes);
  });

  it('should have CACHE_REFRESH_INTERVAL_MS less than CACHE_DURATION_MS', () => {
    expect(CACHE_REFRESH_INTERVAL_MS).toBeLessThanOrEqual(CACHE_DURATION_MS);
  });

  it('should have reasonable page sizes', () => {
    expect(OPENCTI_PAGE_SIZE).toBeGreaterThan(0);
    expect(OPENCTI_PAGE_SIZE).toBeLessThanOrEqual(1000);
    expect(OPENCTI_PAGE_SIZE).toBe(500);

    expect(OPENAEV_PAGE_SIZE).toBeGreaterThan(0);
    expect(OPENAEV_PAGE_SIZE).toBeLessThanOrEqual(500);
    expect(OPENAEV_PAGE_SIZE).toBe(100);

    expect(OPENAEV_FINDINGS_PAGE_SIZE).toBeGreaterThan(OPENAEV_PAGE_SIZE);
  });
});

// ============================================================================
// Limits Tests
// ============================================================================

describe('Limit Constants', () => {
  it('should have reasonable MAX_DESCRIPTION_LENGTH', () => {
    expect(MAX_DESCRIPTION_LENGTH).toBeGreaterThan(100);
    expect(MAX_DESCRIPTION_LENGTH).toBe(500);
  });

  it('should have reasonable MAX_URL_DISPLAY_LENGTH', () => {
    expect(MAX_URL_DISPLAY_LENGTH).toBeGreaterThan(30);
    expect(MAX_URL_DISPLAY_LENGTH).toBe(70);
  });

  it('should have reasonable MIN_ENTITY_NAME_LENGTH', () => {
    expect(MIN_ENTITY_NAME_LENGTH).toBeGreaterThan(0);
    expect(MIN_ENTITY_NAME_LENGTH).toBeLessThanOrEqual(10);
    expect(MIN_ENTITY_NAME_LENGTH).toBe(4);
  });

  it('should have reasonable MAX_PAGINATION_PAGES', () => {
    expect(MAX_PAGINATION_PAGES).toBeGreaterThan(0);
    expect(MAX_PAGINATION_PAGES).toBe(100);
  });
});

// ============================================================================
// UI Configuration Tests
// ============================================================================

describe('UI Configuration', () => {
  it('should have reasonable PANEL_WIDTH_PX', () => {
    expect(PANEL_WIDTH_PX).toBeGreaterThan(200);
    expect(PANEL_WIDTH_PX).toBeLessThanOrEqual(600);
    expect(PANEL_WIDTH_PX).toBe(400);
  });

  it('should have high z-index values for overlays', () => {
    expect(OVERLAY_Z_INDEX).toBeGreaterThan(1000000);
    expect(PANEL_Z_INDEX).toBeGreaterThan(OVERLAY_Z_INDEX);
  });
});

// ============================================================================
// External URLs Tests
// ============================================================================

describe('External URLs', () => {
  it('should have valid FILIGRAN_URL', () => {
    expect(FILIGRAN_URL).toBe('https://filigran.io');
    expect(FILIGRAN_URL).toMatch(/^https:\/\//);
  });

  it('should have valid EE_TRIAL_URL', () => {
    expect(EE_TRIAL_URL).toContain('filigran.io');
    expect(EE_TRIAL_URL).toMatch(/^https:\/\//);
  });

  it('should have valid documentation URLs', () => {
    expect(OPENCTI_DOCS_URL).toMatch(/^https:\/\//);
    expect(OPENAEV_DOCS_URL).toMatch(/^https:\/\//);
    expect(OPENCTI_DOCS_URL).toContain('opencti');
    expect(OPENAEV_DOCS_URL).toContain('openaev');
  });
});

// ============================================================================
// Extension Metadata Tests
// ============================================================================

describe('Extension Metadata', () => {
  it('should have valid EXTENSION_VERSION', () => {
    expect(EXTENSION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have valid EXTENSION_NAME', () => {
    expect(EXTENSION_NAME).toBeTruthy();
    expect(EXTENSION_NAME).toBe('XTM Browser Extension');
  });
});

// ============================================================================
// Highlight Colors Tests
// ============================================================================

describe('Highlight Colors', () => {
  const validateRgbaColor = (color: string) => {
    expect(color).toMatch(/^rgba?\(|^#[0-9a-fA-F]/);
  };

  const validateHexColor = (color: string) => {
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  };

  it('should have valid HIGHLIGHT_FOUND colors', () => {
    validateRgbaColor(HIGHLIGHT_FOUND.background);
    validateRgbaColor(HIGHLIGHT_FOUND.backgroundHover);
    validateHexColor(HIGHLIGHT_FOUND.outline);
    validateHexColor(HIGHLIGHT_FOUND.outlineHover);
  });

  it('should have valid HIGHLIGHT_NOT_FOUND colors', () => {
    validateRgbaColor(HIGHLIGHT_NOT_FOUND.background);
    validateRgbaColor(HIGHLIGHT_NOT_FOUND.backgroundHover);
    validateHexColor(HIGHLIGHT_NOT_FOUND.outline);
    validateHexColor(HIGHLIGHT_NOT_FOUND.outlineHover);
  });

  it('should have valid HIGHLIGHT_SELECTED colors', () => {
    validateRgbaColor(HIGHLIGHT_SELECTED.background);
    validateHexColor(HIGHLIGHT_SELECTED.outline);
  });

  it('should have valid HIGHLIGHT_AI_DISCOVERED colors', () => {
    validateRgbaColor(HIGHLIGHT_AI_DISCOVERED.background);
    validateRgbaColor(HIGHLIGHT_AI_DISCOVERED.backgroundHover);
    validateHexColor(HIGHLIGHT_AI_DISCOVERED.outline);
    validateHexColor(HIGHLIGHT_AI_DISCOVERED.outlineHover);
  });

  it('should have distinct colors for different highlight types', () => {
    expect(HIGHLIGHT_FOUND.outline).not.toBe(HIGHLIGHT_NOT_FOUND.outline);
    expect(HIGHLIGHT_FOUND.outline).not.toBe(HIGHLIGHT_AI_DISCOVERED.outline);
    expect(HIGHLIGHT_NOT_FOUND.outline).not.toBe(HIGHLIGHT_SELECTED.outline);
  });
});

