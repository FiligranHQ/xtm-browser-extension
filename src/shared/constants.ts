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
export const ENTITY_FETCH_TIMEOUT_MS = 8000;

/** Timeout for search operations */
export const SEARCH_TIMEOUT_MS = 8000;

/** Timeout for container fetch operations */
export const CONTAINER_FETCH_TIMEOUT_MS = 5000;

/** Timeout for cache refresh operations */
export const CACHE_REFRESH_TIMEOUT_MS = 30000;

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
export const PANEL_WIDTH_PX = 400;

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
export const OPENAEV_DOCS_URL = 'https://docs.filigran.io/openaev';

// ============================================================================
// Extension Metadata
// ============================================================================

/** Extension version */
export const EXTENSION_VERSION = '1.0.0';

/** Extension name */
export const EXTENSION_NAME = 'XTM Browser Extension';
