// ============================================================================
// Platform Registry - Multi-Platform Support System
// ============================================================================
// This module provides a centralized registry for all supported platforms.
// When adding a new platform (e.g., OpenGRC), only this file needs to be
// updated with the platform definition.
// ============================================================================

// ============================================================================
// Platform Type Definitions
// ============================================================================

/**
 * Unique identifier for each platform type
 * Add new platforms here when integrating new products
 */
export type PlatformType = 'opencti' | 'openaev' | 'opengrc';

/**
 * Entity type prefix used for internal identification
 * Format: lowercase platform identifier
 */
export type PlatformPrefix = 'octi' | 'oaev' | 'ogrc';

/**
 * Platform definition containing all metadata and configuration
 */
export interface PlatformDefinition {
  /** Unique platform type identifier */
  type: PlatformType;
  /** Prefix used for entity type identification (e.g., 'oaev-Asset') */
  prefix: PlatformPrefix;
  /** Human-readable name */
  name: string;
  /** Short name for compact displays */
  shortName: string;
  /** Full product name */
  fullName: string;
  /** Tagline/description */
  tagline: string;
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Secondary/accent color (hex) */
  secondaryColor: string;
  /** Logo file suffix (for assets/logos/logo_{product}_{theme}_embleme_square.svg) */
  logoSuffix: string;
  /** Settings key for platforms array (e.g., 'openctiPlatforms') */
  settingsKey: string;
  /** Cache key prefix for storage */
  cacheKeyPrefix: string;
  /** URL path pattern for entity links */
  urlPatterns: PlatformUrlPatterns;
  /** Entity types supported by this platform */
  entityTypes: string[];
  /** Whether this platform uses GraphQL (true) or REST (false) */
  usesGraphQL: boolean;
  /** Platform-specific features */
  features: PlatformFeatures;
}

/**
 * URL patterns for constructing entity links
 */
export interface PlatformUrlPatterns {
  /** Base path for entities (e.g., '/dashboard' for OpenCTI) */
  basePath: string;
  /** Entity type to URL path mapping */
  entityPaths: Record<string, string>;
}

/**
 * Platform-specific features/capabilities
 */
export interface PlatformFeatures {
  /** Supports container creation */
  containers?: boolean;
  /** Supports investigation/workbench */
  investigations?: boolean;
  /** Supports atomic testing */
  atomicTesting?: boolean;
  /** Supports scenario generation */
  scenarios?: boolean;
  /** Supports full-text search API */
  fullTextSearch?: boolean;
  /** Supports entity caching for scan */
  entityCache?: boolean;
}

// ============================================================================
// Platform Definitions
// ============================================================================

const OPENCTI_DEFINITION: PlatformDefinition = {
  type: 'opencti',
  prefix: 'octi',
  name: 'OpenCTI',
  shortName: 'OCTI',
  fullName: 'OpenCTI',
  tagline: 'Cyber Threat Intelligence',
  primaryColor: '#5c6bc0', // Indigo (distinct from green=found, amber=new)
  secondaryColor: '#001e3c',
  logoSuffix: 'opencti',
  settingsKey: 'openctiPlatforms',
  cacheKeyPrefix: 'sdo_cache',
  urlPatterns: {
    basePath: '/dashboard',
    entityPaths: {
      'Attack-Pattern': '/techniques/attack_patterns',
      'Narrative': '/techniques/narratives',
      'Channel': '/techniques/channels',
      'Campaign': '/threats/campaigns',
      'Incident': '/events/incidents',
      'Indicator': '/observations/indicators',
      'Intrusion-Set': '/threats/intrusion_sets',
      'Malware': '/arsenal/malwares',
      'Threat-Actor-Group': '/threats/threat_actors_group',
      'Threat-Actor-Individual': '/threats/threat_actors_individual',
      'Tool': '/arsenal/tools',
      'Vulnerability': '/arsenal/vulnerabilities',
      'Report': '/analyses/reports',
      'Case-Incident': '/cases/incidents',
      'Case-Rfi': '/cases/rfis',
      'Case-Rft': '/cases/rfts',
      'Grouping': '/analyses/groupings',
      'Organization': '/entities/organizations',
      'Individual': '/entities/individuals',
      'System': '/entities/systems',
      'Sector': '/entities/sectors',
      'Event': '/entities/events',
      'Country': '/locations/countries',
      'Region': '/locations/regions',
      'City': '/locations/cities',
      'Administrative-Area': '/locations/administrative_areas',
      'Position': '/locations/positions',
      'IPv4-Addr': '/observations/observables',
      'IPv6-Addr': '/observations/observables',
      'Domain-Name': '/observations/observables',
      'Hostname': '/observations/observables',
      'Url': '/observations/observables',
      'Email-Addr': '/observations/observables',
      'StixFile': '/observations/observables',
      'File': '/observations/observables',
      // Default for unknown types
      '_default': '/id',
    },
  },
  entityTypes: [
    'Attack-Pattern', 'Narrative', 'Channel', 'Campaign', 'Incident', 'Indicator', 'Intrusion-Set',
    'Malware', 'Threat-Actor-Group', 'Threat-Actor-Individual',
    'Tool', 'Vulnerability', 'Report', 'Organization', 'Individual', 'System', 'Sector', 'Event',
    'Country', 'Region', 'City', 'Administrative-Area', 'Position', 'IPv4-Addr', 'IPv6-Addr', 'Domain-Name',
    'Hostname', 'Url', 'Email-Addr', 'StixFile', 'File', 'Artifact',
  ],
  usesGraphQL: true,
  features: {
    containers: true,
    investigations: true,
    atomicTesting: false,
    scenarios: false,
    fullTextSearch: true,
    entityCache: true,
  },
};

const OPENAEV_DEFINITION: PlatformDefinition = {
  type: 'openaev',
  prefix: 'oaev',
  name: 'OpenAEV',
  shortName: 'OAEV',
  fullName: 'OpenAEV',
  tagline: 'Adversarial Exposure Validation',
  primaryColor: '#e91e63', // Pink (distinct from primary blue)
  secondaryColor: '#4a148c',
  logoSuffix: 'openaev',
  settingsKey: 'openaevPlatforms',
  cacheKeyPrefix: 'oaev_cache',
  urlPatterns: {
    basePath: '/admin',
    entityPaths: {
      'Asset': '/assets/endpoints',
      'AssetGroup': '/assets/asset_groups',
      'Team': '/teams/teams',
      'Player': '/teams/players',
      'AttackPattern': '/components/attack_patterns',
      'Finding': '/assets/security_platforms',
      'Vulnerability': '/vulnerabilities',
      'Scenario': '/scenarios',
      'Exercise': '/exercises',
      'Organization': '/settings/organizations',
      'User': '/settings/users',
      // Default for unknown types
      '_default': '',
    },
  },
  entityTypes: [
    'Asset', 'AssetGroup', 'Team', 'Player', 'AttackPattern', 'Finding',
    'Vulnerability', 'Scenario', 'Exercise', 'Organization', 'User',
  ],
  usesGraphQL: false,
  features: {
    containers: false,
    investigations: false,
    atomicTesting: true,
    scenarios: true,
    fullTextSearch: true,
    entityCache: true,
  },
};

const OPENGRC_DEFINITION: PlatformDefinition = {
  type: 'opengrc',
  prefix: 'ogrc',
  name: 'OpenGRC',
  shortName: 'OGRC',
  fullName: 'OpenGRC',
  tagline: 'Governance, Risk & Compliance',
  primaryColor: '#ff9800', // Orange
  secondaryColor: '#e65100',
  logoSuffix: 'opengrc',
  settingsKey: 'opengrcPlatforms',
  cacheKeyPrefix: 'ogrc_cache',
  urlPatterns: {
    basePath: '/admin',
    entityPaths: {
      // To be defined when OpenGRC is integrated
      '_default': '',
    },
  },
  entityTypes: [
    // To be defined when OpenGRC is integrated
  ],
  usesGraphQL: false,
  features: {
    containers: false,
    investigations: false,
    atomicTesting: false,
    scenarios: false,
    fullTextSearch: true,
    entityCache: true,
  },
};

// ============================================================================
// Platform Registry
// ============================================================================

/**
 * Registry of all supported platforms
 * Add new platforms here
 */
export const PLATFORM_REGISTRY: Record<PlatformType, PlatformDefinition> = {
  opencti: OPENCTI_DEFINITION,
  openaev: OPENAEV_DEFINITION,
  opengrc: OPENGRC_DEFINITION,
};

/**
 * Mapping from prefix to platform type
 */
export const PREFIX_TO_PLATFORM: Record<PlatformPrefix, PlatformType> = {
  octi: 'opencti',
  oaev: 'openaev',
  ogrc: 'opengrc',
};

/**
 * All registered platform types
 */
export const ALL_PLATFORM_TYPES: PlatformType[] = Object.keys(PLATFORM_REGISTRY) as PlatformType[];

/**
 * All platform prefixes
 */
export const ALL_PLATFORM_PREFIXES: PlatformPrefix[] = Object.values(PLATFORM_REGISTRY).map(p => p.prefix);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get platform definition by type
 */
export function getPlatformDefinition(type: PlatformType): PlatformDefinition {
  return PLATFORM_REGISTRY[type];
}

/**
 * Get platform definition by prefix
 */
export function getPlatformByPrefix(prefix: string): PlatformDefinition | undefined {
  const normalizedPrefix = prefix.toLowerCase() as PlatformPrefix;
  const type = PREFIX_TO_PLATFORM[normalizedPrefix];
  return type ? PLATFORM_REGISTRY[type] : undefined;
}

/**
 * Check if a type string is prefixed (e.g., 'oaev-Asset')
 * Returns the prefix and entity type if prefixed, null otherwise
 */
export function parsePrefixedType(type: string): { prefix: PlatformPrefix; entityType: string; platformType: PlatformType } | null {
  for (const definition of Object.values(PLATFORM_REGISTRY)) {
    const prefixPattern = `${definition.prefix}-`;
    if (type.startsWith(prefixPattern)) {
      return {
        prefix: definition.prefix,
        entityType: type.substring(prefixPattern.length),
        platformType: definition.type,
      };
    }
  }
  return null;
}

/**
 * Create a prefixed type string (e.g., 'Asset' + 'openaev' -> 'oaev-Asset')
 */
export function createPrefixedType(entityType: string, platformType: PlatformType): string {
  const definition = PLATFORM_REGISTRY[platformType];
  // OpenCTI entities are not prefixed (they are the default)
  if (platformType === 'opencti') {
    return entityType;
  }
  return `${definition.prefix}-${entityType}`;
}

/**
 * Get the display name for a prefixed type (strips prefix for display)
 */
export function getDisplayType(type: string): string {
  const parsed = parsePrefixedType(type);
  return parsed ? parsed.entityType : type;
}

/**
 * Check if an entity type belongs to a specific platform
 */
export function isPlatformEntity(type: string, platformType: PlatformType): boolean {
  const parsed = parsePrefixedType(type);
  if (parsed) {
    return parsed.platformType === platformType;
  }
  // Non-prefixed types are assumed to be OpenCTI
  return platformType === 'opencti';
}

/**
 * Check if an entity type is from a non-default platform (has a prefix)
 */
export function isNonDefaultPlatformEntity(type: string): boolean {
  return parsePrefixedType(type) !== null;
}

/**
 * Get platform type from an entity type string
 */
export function getPlatformTypeFromEntity(type: string): PlatformType {
  const parsed = parsePrefixedType(type);
  return parsed ? parsed.platformType : 'opencti';
}

/**
 * Get platform definition from an entity type string
 */
export function getPlatformFromEntity(type: string): PlatformDefinition {
  const platformType = getPlatformTypeFromEntity(type);
  return PLATFORM_REGISTRY[platformType];
}

/**
 * Get the platform name for display
 */
export function getPlatformDisplayName(type: string): string {
  const platform = getPlatformFromEntity(type);
  return platform.name;
}

/**
 * Get the platform color for an entity type
 */
export function getPlatformColor(type: string): string {
  const platform = getPlatformFromEntity(type);
  return platform.primaryColor;
}

/**
 * Build entity URL for a platform
 */
export function buildEntityUrl(
  baseUrl: string,
  entityType: string,
  entityId: string,
  platformType?: PlatformType
): string {
  // Determine platform type from entity type if not provided
  const parsed = parsePrefixedType(entityType);
  const type = platformType || (parsed?.platformType ?? 'opencti');
  const cleanEntityType = parsed?.entityType || entityType;
  
  const definition = PLATFORM_REGISTRY[type];
  const { basePath, entityPaths } = definition.urlPatterns;
  
  // Find the path for this entity type
  const path = entityPaths[cleanEntityType] || entityPaths['_default'] || '';
  
  // Build URL - handle trailing slashes
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}${basePath}${path}/${entityId}`;
}

/**
 * Get all platform types that are currently enabled
 * This is a placeholder - actual implementation needs settings access
 */
export function getEnabledPlatformTypes(): PlatformType[] {
  // This will be called with actual settings in context
  return ALL_PLATFORM_TYPES.filter(type => {
    const def = PLATFORM_REGISTRY[type];
    // Filter out platforms that are not yet fully implemented
    return def.entityTypes.length > 0;
  });
}

/**
 * Check if a platform type is the default/primary platform
 * OpenCTI is considered the default platform
 */
export function isDefaultPlatform(type: PlatformType): boolean {
  return type === 'opencti';
}

/**
 * Get the logo path for a platform
 */
export function getPlatformLogoPath(platformType: PlatformType, theme: 'dark' | 'light'): string {
  const definition = PLATFORM_REGISTRY[platformType];
  const themeSuffix = theme === 'dark' ? 'dark-theme' : 'light-theme';
  return `../assets/logos/logo_${definition.logoSuffix}_${themeSuffix}_embleme_square.svg`;
}

/**
 * Get platform action button color
 */
export function getPlatformActionColor(platformType: PlatformType, actionType: 'scan' | 'search' | 'primary' | 'secondary'): string {
  const definition = PLATFORM_REGISTRY[platformType];
  
  switch (actionType) {
    case 'scan':
      return '#2196f3'; // Blue for scan across all platforms
    case 'search':
      return '#7c4dff'; // Deep purple for search across all platforms
    case 'primary':
      return definition.primaryColor;
    case 'secondary':
      return definition.secondaryColor;
    default:
      return definition.primaryColor;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid platform type
 */
export function isPlatformType(value: string): value is PlatformType {
  return value in PLATFORM_REGISTRY;
}

/**
 * Type guard to check if a string is a valid platform prefix
 */
export function isPlatformPrefix(value: string): value is PlatformPrefix {
  return value in PREFIX_TO_PLATFORM;
}

// ============================================================================
// Platform Display Name Utilities
// ============================================================================

/**
 * Get the human-readable name for a platform type
 * Use this instead of ternary expressions like: platformType === 'openaev' ? 'OpenAEV' : 'OpenCTI'
 */
export function getPlatformName(platformType: PlatformType | string): string {
  if (isPlatformType(platformType)) {
    return PLATFORM_REGISTRY[platformType].name;
  }
  // Fallback: capitalize first letter
  return platformType.charAt(0).toUpperCase() + platformType.slice(1);
}

/**
 * Get the logo name suffix for a platform type
 * Use this instead of: platformType === 'openaev' ? 'openaev' : 'opencti'
 */
export function getPlatformLogoName(platformType: PlatformType | string): string {
  if (isPlatformType(platformType)) {
    return PLATFORM_REGISTRY[platformType].logoSuffix;
  }
  return platformType;
}

/**
 * Get the entity type prefix for a platform
 * Returns 'oaev' for openaev, 'ogrc' for opengrc, empty string for opencti
 */
export function getEntityTypePrefix(platformType: PlatformType): string {
  if (platformType === 'opencti') {
    return ''; // OpenCTI entities are not prefixed
  }
  return PLATFORM_REGISTRY[platformType].prefix;
}

/**
 * Prefix an entity type based on platform
 * Returns prefixed type for non-opencti platforms (e.g., 'oaev-Asset')
 * Returns the original type for opencti
 */
export function prefixEntityType(entityType: string, platformType: PlatformType): string {
  if (platformType === 'opencti') {
    return entityType;
  }
  const prefix = PLATFORM_REGISTRY[platformType].prefix;
  return `${prefix}-${entityType}`;
}

/**
 * Infer platform type from entity type string
 * Returns 'openaev' if type starts with 'oaev-', 'opengrc' if starts with 'ogrc-', etc.
 */
export function inferPlatformTypeFromEntityType(entityType: string | undefined): PlatformType {
  if (!entityType) return 'opencti';
  
  for (const [prefix, platformType] of Object.entries(PREFIX_TO_PLATFORM)) {
    if (entityType.startsWith(`${prefix}-`)) {
      return platformType;
    }
  }
  return 'opencti';
}

// ============================================================================
// Cross-Platform Type Mapping
// ============================================================================
// Defines equivalent types across platforms. When the same concept exists
// in multiple platforms (e.g., Attack Pattern in both OpenCTI and OpenAEV),
// they are mapped here for deduplication in multi-type displays.
// ============================================================================

/**
 * Cross-platform type equivalence mapping.
 * Key: canonical display name (used for deduplication)
 * Value: array of equivalent types across platforms (normalized to lowercase)
 * 
 * When adding new platform integrations, add mappings here for types
 * that represent the same concept across platforms.
 */
export const CROSS_PLATFORM_TYPE_MAPPINGS: Record<string, string[]> = {
  // Attack Pattern exists in both OpenCTI (Attack-Pattern) and OpenAEV (AttackPattern)
  'Attack Pattern': ['attack-pattern', 'attackpattern', 'oaev-attackpattern'],
  
  // Organization exists in both platforms
  'Organization': ['organization', 'oaev-organization'],
  
  // Vulnerability/CVE exists in both OpenCTI (Vulnerability) and OpenAEV (oaev-Vulnerability)
  // CVE is the common identifier format but maps to Vulnerability type in both platforms
  'Vulnerability': ['vulnerability', 'oaev-vulnerability', 'cve'],
};

/**
 * Normalize a type string for comparison (lowercase, remove prefix)
 */
export function normalizeTypeForComparison(type: string): string {
  return type.toLowerCase().replace('oaev-', '');
}

/**
 * Get the canonical display name for a type, considering cross-platform equivalents.
 * Returns the canonical name if found in mappings, otherwise formats the original type.
 */
export function getCanonicalTypeName(type: string): string {
  const normalizedType = normalizeTypeForComparison(type);
  
  for (const [canonicalName, equivalentTypes] of Object.entries(CROSS_PLATFORM_TYPE_MAPPINGS)) {
    if (equivalentTypes.some(t => normalizeTypeForComparison(t) === normalizedType)) {
      return canonicalName;
    }
  }
  
  // Fallback: format the type name for display
  return type
    .replace('oaev-', '')
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

/**
 * Get unique canonical types from a list of types, deduplicating cross-platform equivalents.
 * Returns an array of canonical type names.
 */
export function getUniqueCanonicalTypes(types: string[]): string[] {
  const canonicalTypes = new Set<string>();
  
  for (const type of types) {
    canonicalTypes.add(getCanonicalTypeName(type));
  }
  
  return Array.from(canonicalTypes);
}

/**
 * Check if two types are equivalent across platforms.
 */
export function areTypesEquivalent(type1: string, type2: string): boolean {
  return getCanonicalTypeName(type1) === getCanonicalTypeName(type2);
}
