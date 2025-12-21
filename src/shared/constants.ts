/**
 * Application Constants
 * 
 * Centralized configuration values for timeouts, limits, and other constants.
 * Keeping these in one place makes the application easier to configure and maintain.
 */

// ============================================================================
// Timeouts (in milliseconds)
// ============================================================================

/** Timeout for API connection tests */
export const CONNECTION_TIMEOUT_MS = 8000;

/** Timeout for entity detail fetches */
export const ENTITY_FETCH_TIMEOUT_MS = 15000;

/** Timeout for search operations */
export const SEARCH_TIMEOUT_MS = 10000;

/** Timeout for container fetch operations */
export const CONTAINER_FETCH_TIMEOUT_MS = 15000;

/** Timeout for platform response during startup */
export const PLATFORM_STARTUP_TIMEOUT_MS = 10000;

/** Short delay for UI transitions */
export const UI_TRANSITION_DELAY_MS = 200;

/** Medium delay for sequential operations */
export const OPERATION_DELAY_MS = 500;

/** Delay between retry attempts */
export const RETRY_DELAY_MS = 1000;

/** Delay before hiding scan overlay (with results) */
export const SCAN_OVERLAY_HIDE_DELAY_MS = 3000;

/** Delay before hiding scan overlay (no results) */
export const SCAN_OVERLAY_HIDE_DELAY_NO_RESULTS_MS = 8000;

// ============================================================================
// Cache Configuration
// ============================================================================

/** Default cache duration in milliseconds (1 hour) */
export const CACHE_DURATION_MS = 60 * 60 * 1000;

/** Cache refresh check interval in milliseconds (30 minutes) */
export const CACHE_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/** Page size for OpenCTI GraphQL queries */
export const OPENCTI_PAGE_SIZE = 500;

/** Page size for OpenAEV REST queries */
export const OPENAEV_PAGE_SIZE = 100;

/** Page size for OpenAEV findings (larger due to volume) */
export const OPENAEV_FINDINGS_PAGE_SIZE = 200;

// ============================================================================
// Limits
// ============================================================================

/** Maximum length for truncated descriptions */
export const MAX_DESCRIPTION_LENGTH = 500;

/** Maximum length for truncated URLs */
export const MAX_URL_DISPLAY_LENGTH = 70;

/** Minimum entity name length for cache matching */
export const MIN_ENTITY_NAME_LENGTH = 4;

/** Maximum pagination pages (safety limit) */
export const MAX_PAGINATION_PAGES = 100;

// ============================================================================
// UI Configuration
// ============================================================================

/** Width of the side panel in pixels */
export const PANEL_WIDTH_PX = 560;

/** Z-index for overlays */
export const OVERLAY_Z_INDEX = 2147483640;

/** Z-index for panel */
export const PANEL_Z_INDEX = 2147483647;

// ============================================================================
// External URLs
// ============================================================================

/** Filigran website */
export const FILIGRAN_URL = 'https://filigran.io';

/** Enterprise Edition trial page */
export const EE_TRIAL_URL = 'https://filigran.io/enterprise-editions-trial/';

/** OpenCTI documentation */
export const OPENCTI_DOCS_URL = 'https://docs.opencti.io';

/** OpenAEV documentation */
export const OPENAEV_DOCS_URL = 'https://docs.openaev.io';

// ============================================================================
// Extension Metadata
// ============================================================================

/** Extension version - SINGLE SOURCE OF TRUTH for version number */
export const EXTENSION_VERSION = '0.0.12';

/** Extension name */
export const EXTENSION_NAME = 'XTM Browser Extension';

// ============================================================================
// Highlight Colors - Shared between web page and PDF highlighting
// ============================================================================

/** Highlight colors for entities found in the platform */
export const HIGHLIGHT_FOUND = {
  background: 'rgba(0, 200, 83, 0.2)',
  backgroundHover: 'rgba(0, 200, 83, 0.35)',
  outline: '#4caf50',
  outlineHover: '#2e7d32',
};

/** Highlight colors for entities not found in the platform */
export const HIGHLIGHT_NOT_FOUND = {
  background: 'rgba(255, 167, 38, 0.2)',
  backgroundHover: 'rgba(255, 167, 38, 0.35)',
  outline: '#ffa726',
  outlineHover: '#f57c00',
};

/** Highlight colors for selected entities */
export const HIGHLIGHT_SELECTED = {
  background: 'rgba(15, 188, 255, 0.25)',
  outline: '#0fbcff',
};

/** Highlight colors for AI-discovered entities (purple theme) */
export const HIGHLIGHT_AI_DISCOVERED = {
  background: 'rgba(156, 39, 176, 0.2)',
  backgroundHover: 'rgba(156, 39, 176, 0.35)',
  outline: '#9c27b0',
  outlineHover: '#7b1fa2',
};

// ============================================================================
// CVSS Severity Colors
// ============================================================================

/** Colors for CVSS severity levels */
export const CVSS_COLORS = {
  /** Unknown/None severity - Blue Grey */
  unknown: '#607d8b',
  /** Low severity - Green */
  low: '#4caf50',
  /** Medium severity - Amber (lighter for dark mode visibility) */
  medium: '#ffb74d',
  /** High severity - Orange */
  high: '#ff7043',
  /** Critical severity - Red */
  critical: '#ef5350',
};

/** Colors for severity text labels */
export const SEVERITY_COLORS = {
  low: { bgcolor: '#4caf50', color: '#ffffff' },
  medium: { bgcolor: '#5c7bf5', color: '#ffffff' },
  high: { bgcolor: '#ff9800', color: '#ffffff' },
  critical: { bgcolor: '#ef5350', color: '#ffffff' },
  unknown: { bgcolor: '#607d8b', color: '#ffffff' },
};

// ============================================================================
// TLP/PAP Marking Colors
// ============================================================================

/** Colors for TLP/PAP markings */
export const MARKING_COLORS = {
  /** TLP:RED, PAP:RED, CD, CD-SF, DR, DR-SF */
  red: '#c62828',
  /** TLP:AMBER, TLP:AMBER+STRICT, PAP:AMBER */
  amber: '#d84315',
  /** TLP:GREEN, PAP:GREEN, NP */
  green: '#2e7d32',
  /** SF (Special Forces) */
  blue: '#283593',
  /** Default fallback */
  default: '#ffffff',
};

/** Clear/White marking colors by mode */
export const MARKING_CLEAR_COLORS = {
  dark: { bgcolor: '#ffffff', color: '#000000' },
  light: { bgcolor: '#2b2b2b', color: '#ffffff' },
};

// ============================================================================
// Text Colors
// ============================================================================

/** Common text colors for chips and UI elements */
export const TEXT_COLORS = {
  /** White text (for dark backgrounds) */
  onDark: '#ffffff',
  /** Black text (for light backgrounds) */
  onLight: '#000000',
  /** Primary text in dark mode */
  primaryDark: '#ffffff',
  /** Primary text in light mode */
  primaryLight: '#2b2b2b',
};
