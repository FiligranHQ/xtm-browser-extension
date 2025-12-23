/**
 * Entity helper utilities
 * Common functions for working with entities across different platforms
 */

import type { PlatformType } from '../platform/registry';

/**
 * OpenCTI Observable Types
 */
export const OBSERVABLE_TYPES = [
  'IPv4-Addr', 'IPv6-Addr', 'Domain-Name', 'Hostname', 'Url', 
  'Email-Addr', 'Mac-Addr', 'StixFile', 'Artifact', 
  'Cryptocurrency-Wallet', 'User-Agent', 'Phone-Number', 'Bank-Account'
] as const;

/**
 * OpenCTI Entity Types (STIX Domain Objects)
 */
export const OPENCTI_ENTITY_TYPES = [
  'Attack-Pattern', 'Campaign', 'Course-Of-Action', 'Data-Component',
  'Data-Source', 'Grouping', 'Identity', 'Incident', 'Indicator',
  'Infrastructure', 'Intrusion-Set', 'Location', 'Malware',
  'Malware-Analysis', 'Note', 'Observed-Data', 'Opinion', 'Report',
  'Threat-Actor-Group', 'Threat-Actor-Individual', 'Tool', 'Vulnerability', 
  'Narrative', 'Channel', 'Event', 'Language', 'Administrative-Area', 
  'City', 'Country', 'Position', 'Region', 'Individual', 'Organization', 
  'Sector', 'System'
] as const;

/**
 * OpenCTI Container Types
 */
export const CONTAINER_TYPES = [
  'Report', 'Grouping', 'Case-Incident', 'Case-Rfi', 'Case-Rft',
  'Feedback', 'Task', 'Note', 'Opinion'
] as const;

/**
 * Check if entity type is an observable
 */
export function isObservableType(type: string): boolean {
  const typeLower = type.toLowerCase().replace(/-/g, '');
  return OBSERVABLE_TYPES.some(t => 
    typeLower.includes(t.toLowerCase().replace(/-/g, ''))
  ) || type.includes('Addr') || type.includes('Observable');
}

/**
 * Check if entity type is an OpenCTI Entity Type
 * These entities can be created via the extension using AI discovery
 */
export function isOpenCTIEntityType(type: string): boolean {
  return OPENCTI_ENTITY_TYPES.some(t => 
    type.toLowerCase() === t.toLowerCase()
  );
}

/**
 * Check if entity type is an indicator
 */
export function isIndicatorType(type: string): boolean {
  return type.toLowerCase() === 'indicator';
}

/**
 * Check if entity type is a vulnerability
 */
export function isVulnerabilityType(type: string): boolean {
  return type.toLowerCase() === 'vulnerability';
}

/**
 * Check if entity type is a container
 */
export function isOCTIContainerType(type: string): boolean {
  return CONTAINER_TYPES.some(t => 
    type.toLowerCase() === t.toLowerCase()
  );
}

/**
 * Get entity ID from various entity data structures
 */
export function getEntityId(entity: Record<string, unknown>): string | undefined {
  return (entity.id || entity.standard_id || entity.entityId || 
    entity.entity_id || entity._id) as string | undefined;
}

/**
 * Get entity name from various entity data structures
 */
export function getEntityName(entity: Record<string, unknown>): string {
  const representative = entity.representative as Record<string, unknown> | undefined;
  return (entity.name || entity.value || representative?.main || 
    entity.entity_name || 'Unknown') as string;
}

/**
 * Get entity type from various entity data structures
 */
export function getEntityType(entity: Record<string, unknown>): string {
  return (entity.type || entity.entity_type || entity.entityType || 
    entity._type || 'Unknown') as string;
}

/**
 * Extract platform ID from entity
 * Note: We only use camelCase 'platformId' - the extension doesn't use snake_case 'platform_id'
 */
export function getEntityPlatformId(entity: Record<string, unknown>): string | undefined {
  return entity.platformId as string | undefined;
}

/**
 * Extract platform type from entity
 */
export function getEntityPlatformType(entity: Record<string, unknown>): PlatformType {
  return (entity.platformType || 'opencti') as PlatformType;
}

/**
 * Get OpenAEV entity name based on type
 */
export function getOAEVEntityName(entity: Record<string, unknown>, type: string): string {
  switch (type) {
    case 'Asset':
      return (entity.endpoint_name || entity.asset_name || entity.name || 'Unknown Asset') as string;
    case 'AssetGroup':
      return (entity.asset_group_name || entity.name || 'Unknown Asset Group') as string;
    case 'Player':
    case 'User': {
      const firstName = entity.user_firstname || '';
      const lastName = entity.user_lastname || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      return fullName || (entity.user_email as string) || 'Unknown Player';
    }
    case 'Team':
      return (entity.team_name || entity.name || 'Unknown Team') as string;
    case 'Organization':
      return (entity.organization_name || entity.name || 'Unknown Organization') as string;
    case 'Scenario':
      return (entity.scenario_name || entity.name || 'Unknown Scenario') as string;
    case 'Exercise':
      return (entity.exercise_name || entity.name || 'Unknown Simulation') as string;
    case 'AttackPattern':
      return (entity.attack_pattern_name || entity.name || 'Unknown Attack Pattern') as string;
    case 'Finding':
      return (entity.finding_value || entity.name || 'Unknown Finding') as string;
    case 'Vulnerability':
      return (entity.vulnerability_external_id || entity.vulnerability_cisa_vulnerability_name || entity.name || 'Unknown Vulnerability') as string;
    default:
      return (entity.name || 'Unknown') as string;
  }
}

/**
 * Get OpenAEV entity ID based on type
 */
export function getOAEVEntityId(entity: Record<string, unknown>, type: string): string {
  switch (type) {
    case 'Asset':
      return (entity.endpoint_id || entity.asset_id || entity.id || '') as string;
    case 'AssetGroup':
      return (entity.asset_group_id || entity.id || '') as string;
    case 'Player':
    case 'User':
      return (entity.user_id || entity.id || '') as string;
    case 'Team':
      return (entity.team_id || entity.id || '') as string;
    case 'Organization':
      return (entity.organization_id || entity.id || '') as string;
    case 'Scenario':
      return (entity.scenario_id || entity.id || '') as string;
    case 'Exercise':
      return (entity.exercise_id || entity.id || '') as string;
    case 'AttackPattern':
      return (entity.attack_pattern_id || entity.id || '') as string;
    case 'Finding':
      return (entity.finding_id || entity.id || '') as string;
    case 'Vulnerability':
      return (entity.vulnerability_id || entity.id || '') as string;
    default:
      return (entity._id || entity.id || '') as string;
  }
}

/**
 * Build OpenAEV query parameter for list pages with text search filter.
 * OpenAEV uses base64-encoded query string for filtering.
 * Format: ?query=btoa("page=0&size=25&textSearch=<search>&key=<localStorageKey>")
 */
function buildOAEVListQueryParam(localStorageKey: string, searchText: string): string {
  // Build query string manually to avoid qs dependency
  const params = [
    'page=0',
    'size=25',
    `textSearch=${encodeURIComponent(searchText)}`,
    `key=${encodeURIComponent(localStorageKey)}`,
  ].join('&');
  
  // Base64 encode the query string (using btoa in browser)
  try {
    const encoded = btoa(params);
    return `?query=${encoded}`;
  } catch {
    // Fallback if btoa fails (shouldn't happen in browser)
    return '';
  }
}

/**
 * Get OpenAEV entity URL for navigating to the platform.
 * 
 * Only Asset (Endpoint), Scenario, and Exercise (Simulation) have overview pages.
 * All other entities redirect to their list page with a text search filter.
 * 
 * @param platformUrl - Base URL of the OpenAEV platform
 * @param type - Entity type (e.g., 'Asset', 'Player', 'AttackPattern')
 * @param entityId - Entity ID (used for entities with overview pages)
 * @param entityName - Entity name (used for text search on list pages)
 */
export function getOAEVEntityUrl(platformUrl: string, type: string, entityId: string, entityName?: string): string {
  const baseUrl = platformUrl.replace(/\/$/, '');
  const searchText = entityName || entityId;
  
  switch (type) {
    // Entities WITH individual overview pages
    case 'Asset':
      return `${baseUrl}/admin/assets/endpoints/${entityId}`;
    case 'Scenario':
      return `${baseUrl}/admin/scenarios/${entityId}`;
    case 'Exercise':
      return `${baseUrl}/admin/simulations/${entityId}`;
    
    // Entities WITHOUT individual overview pages - redirect to list with filter
    case 'AssetGroup':
      return `${baseUrl}/admin/assets/asset_groups${buildOAEVListQueryParam('asset-groups', searchText)}`;
    case 'Player':
    case 'User':
      return `${baseUrl}/admin/teams/players${buildOAEVListQueryParam('players', searchText)}`;
    case 'Team':
      // Teams page doesn't use queryable filtering, just redirect to list
      return `${baseUrl}/admin/teams/teams`;
    case 'Organization':
      // Organizations page doesn't use queryable filtering, just redirect to list
      return `${baseUrl}/admin/teams/organizations`;
    case 'AttackPattern':
      // Attack patterns page doesn't use queryable filtering, just redirect to list
      return `${baseUrl}/admin/settings/taxonomies/attack_patterns`;
    case 'Finding':
      return `${baseUrl}/admin/findings${buildOAEVListQueryParam('findings', searchText)}`;
    case 'Vulnerability':
      return `${baseUrl}/admin/settings/taxonomies/vulnerabilities${buildOAEVListQueryParam('vulnerability', searchText)}`;
    default:
      return baseUrl;
  }
}

/**
 * Convert OpenAEV entity class name to type
 */
export function getOAEVTypeFromClass(className: string): string {
  const simpleName = className.split('.').pop() || className;
  switch (simpleName) {
    case 'Endpoint': return 'Asset';
    case 'AssetGroup': return 'AssetGroup';
    case 'User': return 'User';
    case 'Player': return 'Player';
    case 'Team': return 'Team';
    case 'Organization': return 'Organization';
    case 'AttackPattern': return 'AttackPattern';
    case 'Scenario': return 'Scenario';
    case 'Exercise': return 'Exercise';
    case 'Finding': return 'Finding';
    case 'Vulnerability': return 'Vulnerability';
    default: return simpleName;
  }
}

/**
 * Get color for OpenAEV entity type
 */
export function getOAEVEntityColor(type: string): string {
  switch (type) {
    case 'Asset': return '#009688'; // Teal
    case 'AssetGroup': return '#26a69a'; // Light Teal
    case 'Player':
    case 'User': return '#7e57c2'; // Deep Purple
    case 'Team': return '#66bb6a'; // Light Green
    case 'Organization': return '#3f51b5'; // Indigo
    case 'Scenario': return '#ab47bc'; // Purple
    case 'Exercise': return '#ff7043'; // Deep Orange
    case 'AttackPattern': return '#d4e157'; // Yellow-green
    case 'Finding': return '#ec407a'; // Pink
    case 'Vulnerability': return '#795548'; // Brown (same as OpenCTI CVE)
    default: return '#e91e63'; // Pink (OAEV platform color)
  }
}

