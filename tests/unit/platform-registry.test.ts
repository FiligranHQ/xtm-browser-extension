/**
 * Tests for Platform Registry
 */

import { describe, it, expect } from 'vitest';
import {
  PLATFORM_REGISTRY,
  PREFIX_TO_PLATFORM,
  ALL_PLATFORM_TYPES,
  ALL_PLATFORM_PREFIXES,
  getPlatformDefinition,
  getPlatformByPrefix,
  parsePrefixedType,
  createPrefixedType,
  getDisplayType,
  isPlatformEntity,
  isNonDefaultPlatformEntity,
  getPlatformTypeFromEntity,
  getPlatformFromEntity,
  getPlatformDisplayName,
  getPlatformColor,
  buildEntityUrl,
  getEnabledPlatformTypes,
  isDefaultPlatform,
  getPlatformLogoPath,
  getPlatformActionColor,
  isPlatformType,
  isPlatformPrefix,
  getPlatformName,
  getPlatformLogoName,
  getPlatformSettingsKey,
  normalizeTypeForComparison,
  formatEntityTypeForDisplay,
  getCanonicalTypeName,
} from '../../src/shared/platform/registry';

describe('Platform Registry', () => {
  // ============================================================================
  // Registry Constants
  // ============================================================================
  
  describe('PLATFORM_REGISTRY', () => {
    it('should have opencti platform defined', () => {
      expect(PLATFORM_REGISTRY.opencti).toBeDefined();
      expect(PLATFORM_REGISTRY.opencti.name).toBe('OpenCTI');
    });

    it('should have openaev platform defined', () => {
      expect(PLATFORM_REGISTRY.openaev).toBeDefined();
      expect(PLATFORM_REGISTRY.openaev.name).toBe('OpenAEV');
    });

    it('should have opengrc platform defined', () => {
      expect(PLATFORM_REGISTRY.opengrc).toBeDefined();
      expect(PLATFORM_REGISTRY.opengrc.name).toBe('OpenGRC');
    });
  });

  describe('PREFIX_TO_PLATFORM', () => {
    it('should map octi to opencti', () => {
      expect(PREFIX_TO_PLATFORM.octi).toBe('opencti');
    });

    it('should map oaev to openaev', () => {
      expect(PREFIX_TO_PLATFORM.oaev).toBe('openaev');
    });

    it('should map ogrc to opengrc', () => {
      expect(PREFIX_TO_PLATFORM.ogrc).toBe('opengrc');
    });
  });

  describe('ALL_PLATFORM_TYPES', () => {
    it('should include all platform types', () => {
      expect(ALL_PLATFORM_TYPES).toContain('opencti');
      expect(ALL_PLATFORM_TYPES).toContain('openaev');
      expect(ALL_PLATFORM_TYPES).toContain('opengrc');
    });
  });

  describe('ALL_PLATFORM_PREFIXES', () => {
    it('should include all platform prefixes', () => {
      expect(ALL_PLATFORM_PREFIXES).toContain('octi');
      expect(ALL_PLATFORM_PREFIXES).toContain('oaev');
      expect(ALL_PLATFORM_PREFIXES).toContain('ogrc');
    });
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  describe('getPlatformDefinition', () => {
    it('should return OpenCTI definition', () => {
      const def = getPlatformDefinition('opencti');
      expect(def.type).toBe('opencti');
      expect(def.prefix).toBe('octi');
      expect(def.name).toBe('OpenCTI');
    });

    it('should return OpenAEV definition', () => {
      const def = getPlatformDefinition('openaev');
      expect(def.type).toBe('openaev');
      expect(def.prefix).toBe('oaev');
    });
  });

  describe('getPlatformByPrefix', () => {
    it('should return platform for valid prefix', () => {
      const def = getPlatformByPrefix('oaev');
      expect(def?.type).toBe('openaev');
    });

    it('should return undefined for invalid prefix', () => {
      const def = getPlatformByPrefix('invalid');
      expect(def).toBeUndefined();
    });

    it('should be case insensitive', () => {
      const def = getPlatformByPrefix('OAEV');
      expect(def?.type).toBe('openaev');
    });
  });

  describe('parsePrefixedType', () => {
    it('should parse oaev-Asset correctly', () => {
      const result = parsePrefixedType('oaev-Asset');
      expect(result).not.toBeNull();
      expect(result?.prefix).toBe('oaev');
      expect(result?.entityType).toBe('Asset');
      expect(result?.platformType).toBe('openaev');
    });

    it('should parse octi-Malware correctly', () => {
      const result = parsePrefixedType('octi-Malware');
      expect(result).not.toBeNull();
      expect(result?.prefix).toBe('octi');
      expect(result?.entityType).toBe('Malware');
    });

    it('should return null for non-prefixed type', () => {
      const result = parsePrefixedType('Malware');
      expect(result).toBeNull();
    });

    it('should return null for invalid prefix', () => {
      const result = parsePrefixedType('xyz-Something');
      expect(result).toBeNull();
    });
  });

  describe('createPrefixedType', () => {
    it('should create prefixed type for OpenAEV', () => {
      const result = createPrefixedType('Asset', 'openaev');
      expect(result).toBe('oaev-Asset');
    });

    it('should not prefix OpenCTI types', () => {
      const result = createPrefixedType('Malware', 'opencti');
      expect(result).toBe('Malware');
    });

    it('should create prefixed type for OpenGRC', () => {
      const result = createPrefixedType('Control', 'opengrc');
      expect(result).toBe('ogrc-Control');
    });
  });

  describe('getDisplayType', () => {
    it('should strip prefix from prefixed type', () => {
      expect(getDisplayType('oaev-Asset')).toBe('Asset');
    });

    it('should return original for non-prefixed type', () => {
      expect(getDisplayType('Malware')).toBe('Malware');
    });
  });

  describe('isPlatformEntity', () => {
    it('should return true for OpenAEV entity', () => {
      expect(isPlatformEntity('oaev-Asset', 'openaev')).toBe(true);
    });

    it('should return false for mismatched platform', () => {
      expect(isPlatformEntity('oaev-Asset', 'opencti')).toBe(false);
    });

    it('should assume non-prefixed types are OpenCTI', () => {
      expect(isPlatformEntity('Malware', 'opencti')).toBe(true);
      expect(isPlatformEntity('Malware', 'openaev')).toBe(false);
    });
  });

  describe('isNonDefaultPlatformEntity', () => {
    it('should return true for prefixed types', () => {
      expect(isNonDefaultPlatformEntity('oaev-Asset')).toBe(true);
    });

    it('should return false for non-prefixed types', () => {
      expect(isNonDefaultPlatformEntity('Malware')).toBe(false);
    });
  });

  describe('getPlatformTypeFromEntity', () => {
    it('should return openaev for oaev- prefixed type', () => {
      expect(getPlatformTypeFromEntity('oaev-Asset')).toBe('openaev');
    });

    it('should return opencti for non-prefixed type', () => {
      expect(getPlatformTypeFromEntity('Malware')).toBe('opencti');
    });
  });

  describe('getPlatformFromEntity', () => {
    it('should return OpenAEV definition for oaev- prefixed type', () => {
      const def = getPlatformFromEntity('oaev-Asset');
      expect(def.type).toBe('openaev');
    });

    it('should return OpenCTI definition for non-prefixed type', () => {
      const def = getPlatformFromEntity('Malware');
      expect(def.type).toBe('opencti');
    });
  });

  describe('getPlatformDisplayName', () => {
    it('should return OpenAEV for oaev- prefixed type', () => {
      expect(getPlatformDisplayName('oaev-Asset')).toBe('OpenAEV');
    });

    it('should return OpenCTI for non-prefixed type', () => {
      expect(getPlatformDisplayName('Malware')).toBe('OpenCTI');
    });
  });

  describe('getPlatformColor', () => {
    it('should return correct color for each platform', () => {
      expect(getPlatformColor('oaev-Asset')).toBe(PLATFORM_REGISTRY.openaev.primaryColor);
      expect(getPlatformColor('Malware')).toBe(PLATFORM_REGISTRY.opencti.primaryColor);
    });
  });

  describe('buildEntityUrl', () => {
    it('should build URL for OpenCTI entity', () => {
      const url = buildEntityUrl('https://opencti.example.com', 'Malware', 'entity-123', 'opencti');
      expect(url).toContain('/dashboard');
      expect(url).toContain('entity-123');
    });

    it('should build URL for OpenAEV entity', () => {
      const url = buildEntityUrl('https://openaev.example.com', 'oaev-Asset', 'asset-456');
      expect(url).toContain('/admin');
      expect(url).toContain('asset-456');
    });

    it('should handle trailing slashes in base URL', () => {
      const url = buildEntityUrl('https://example.com/', 'Malware', '123', 'opencti');
      expect(url).not.toContain('//dashboard');
    });
  });

  describe('getEnabledPlatformTypes', () => {
    it('should return array of platform types', () => {
      const enabled = getEnabledPlatformTypes();
      expect(Array.isArray(enabled)).toBe(true);
    });

    it('should only include platforms with entity types', () => {
      const enabled = getEnabledPlatformTypes();
      // OpenCTI and OpenAEV have entity types defined
      expect(enabled).toContain('opencti');
      expect(enabled).toContain('openaev');
    });
  });

  describe('isDefaultPlatform', () => {
    it('should return true for opencti', () => {
      expect(isDefaultPlatform('opencti')).toBe(true);
    });

    it('should return false for openaev', () => {
      expect(isDefaultPlatform('openaev')).toBe(false);
    });
  });

  describe('getPlatformLogoPath', () => {
    it('should return correct path for dark theme', () => {
      const path = getPlatformLogoPath('opencti', 'dark');
      expect(path).toContain('dark-theme');
      expect(path).toContain('.svg');
    });

    it('should return correct path for light theme', () => {
      const path = getPlatformLogoPath('opencti', 'light');
      expect(path).toContain('light-theme');
    });
  });

  describe('getPlatformActionColor', () => {
    it('should return blue for scan action', () => {
      expect(getPlatformActionColor('opencti', 'scan')).toBe('#2196f3');
    });

    it('should return purple for search action', () => {
      expect(getPlatformActionColor('openaev', 'search')).toBe('#7c4dff');
    });

    it('should return primary color for primary action', () => {
      expect(getPlatformActionColor('opencti', 'primary')).toBe(PLATFORM_REGISTRY.opencti.primaryColor);
    });

    it('should return secondary color for secondary action', () => {
      expect(getPlatformActionColor('openaev', 'secondary')).toBe(PLATFORM_REGISTRY.openaev.secondaryColor);
    });
  });

  // ============================================================================
  // Type Guards
  // ============================================================================

  describe('isPlatformType', () => {
    it('should return true for valid platform types', () => {
      expect(isPlatformType('opencti')).toBe(true);
      expect(isPlatformType('openaev')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isPlatformType('invalid')).toBe(false);
      expect(isPlatformType('')).toBe(false);
    });
  });

  describe('isPlatformPrefix', () => {
    it('should return true for valid prefixes', () => {
      expect(isPlatformPrefix('octi')).toBe(true);
      expect(isPlatformPrefix('oaev')).toBe(true);
    });

    it('should return false for invalid prefixes', () => {
      expect(isPlatformPrefix('invalid')).toBe(false);
    });
  });

  // ============================================================================
  // Display Name Utilities
  // ============================================================================

  describe('getPlatformName', () => {
    it('should return name for valid platform type', () => {
      expect(getPlatformName('opencti')).toBe('OpenCTI');
      expect(getPlatformName('openaev')).toBe('OpenAEV');
    });

    it('should capitalize unknown platform names', () => {
      expect(getPlatformName('unknown')).toBe('Unknown');
    });
  });

  describe('getPlatformLogoName', () => {
    it('should return logo suffix for valid platform', () => {
      expect(getPlatformLogoName('opencti')).toBe(PLATFORM_REGISTRY.opencti.logoSuffix);
    });
  });

  describe('getPlatformSettingsKey', () => {
    it('should return settings key for valid platform', () => {
      expect(getPlatformSettingsKey('opencti')).toBe('openctiPlatforms');
      expect(getPlatformSettingsKey('openaev')).toBe('openaevPlatforms');
    });
  });

  // ============================================================================
  // Type Normalization Utilities
  // ============================================================================

  describe('normalizeTypeForComparison', () => {
    it('should normalize type to lowercase', () => {
      expect(normalizeTypeForComparison('MALWARE')).toBe('malware');
    });

    it('should strip prefix before normalizing', () => {
      expect(normalizeTypeForComparison('oaev-Asset')).toBe('asset');
    });
  });

  describe('formatEntityTypeForDisplay', () => {
    it('should format entity type with spaces', () => {
      const formatted = formatEntityTypeForDisplay('Intrusion-Set');
      expect(formatted).toBe('Intrusion Set');
    });

    it('should handle prefixed types with platform name', () => {
      const formatted = formatEntityTypeForDisplay('oaev-AssetGroup');
      expect(formatted).toContain('OpenAEV');
      expect(formatted).toContain('Asset');
    });
  });

  describe('getCanonicalTypeName', () => {
    it('should return formatted type name', () => {
      // getCanonicalTypeName returns formatted type (not canonical mapping)
      const result = getCanonicalTypeName('intrusion-set');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  // ============================================================================
  // Platform Definition Access
  // ============================================================================

  describe('Platform Definition Properties', () => {
    it('should have correct features for OpenCTI', () => {
      const def = getPlatformDefinition('opencti');
      expect(def.features.containers).toBe(true);
      expect(def.features.investigations).toBe(true);
      expect(def.usesGraphQL).toBe(true);
    });

    it('should have correct features for OpenAEV', () => {
      const def = getPlatformDefinition('openaev');
      expect(def.features.atomicTesting).toBe(true);
      expect(def.features.scenarios).toBe(true);
      expect(def.usesGraphQL).toBe(false);
    });

    it('should have entity types for OpenCTI', () => {
      const def = getPlatformDefinition('opencti');
      expect(def.entityTypes).toContain('Malware');
      expect(def.entityTypes).toContain('Intrusion-Set');
    });

    it('should have entity types for OpenAEV', () => {
      const def = getPlatformDefinition('openaev');
      expect(def.entityTypes).toContain('Asset');
      expect(def.entityTypes).toContain('AssetGroup');
    });

    it('should have URL patterns for OpenCTI', () => {
      const def = getPlatformDefinition('opencti');
      expect(def.urlPatterns.entityPaths['Malware']).toBeDefined();
    });
  });
});

