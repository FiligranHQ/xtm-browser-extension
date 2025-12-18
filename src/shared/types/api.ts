/**
 * API Response Types
 * 
 * Types for GraphQL and REST API responses.
 */

// ============================================================================
// GraphQL Types
// ============================================================================

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  name?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Platform Info
// ============================================================================

export interface PlatformInfo {
  version: string;
  enterprise_edition?: boolean;
  me?: {
    name?: string;
    user_email?: string;
  };
  settings?: {
    platform_title?: string;
  };
}
