/**
 * Platform Types
 * 
 * Types related to platform information and connections
 */

/**
 * Platform information returned from connection test
 */
export interface PlatformInfo {
  version?: string;
  enterprise_edition?: boolean;
  me?: {
    name?: string;
    user_email?: string;
  };
  settings?: {
    platform_title?: string;
  };
  user?: {
    user_email?: string;
  };
  platform_name?: string;
}

/**
 * Platform settings
 */
export interface PlatformSettings {
  platform_title?: string;
  platform_enterprise_edition?: {
    license_enterprise?: boolean;
  };
}

/**
 * Investigation type
 */
export interface Investigation {
  id: string;
  name: string;
  description?: string;
  created?: string;
  modified?: string;
  investigated_entities_ids?: string[];
}

/**
 * Investigation create input
 */
export interface InvestigationCreateInput {
  name: string;
  description?: string;
  investigated_entities_ids?: string[];
}

