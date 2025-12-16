/**
 * API Types
 * 
 * Types for API responses and GraphQL
 */

/**
 * GraphQL response wrapper
 */
export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * Search result from global search
 */
export interface SearchResult {
  id: string;
  entity_type: string;
  name?: string;
  value?: string;
  observable_value?: string;
  aliases?: string[];
  x_mitre_id?: string;
  description?: string;
  created?: string;
  modified?: string;
  createdBy?: { id: string; name?: string };
  objectMarking?: Array<{ id: string; definition?: string; x_opencti_color?: string }>;
  objectLabel?: Array<{ id: string; value: string; color?: string }>;
  // Platform tracking
  _platformId?: string;
}

/**
 * Message response from background script
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

