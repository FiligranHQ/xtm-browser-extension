/**
 * Tests for the legacy settings migration (OpenGRC renamed OpenCRQ).
 * A user's saved platforms stored under a renamed key must never be dropped.
 */

import { describe, it, expect } from 'vitest';
import { migrateLegacySettings } from '../../src/shared/utils/storage';
import { LEGACY_PLATFORM_SETTINGS_KEYS, getPlatformSettingsKey } from '../../src/shared/platform/registry';

const platform = (id: string) => ({ id, name: `Platform ${id}`, url: `https://${id}.example.com`, apiToken: 't', enabled: true });

describe('migrateLegacySettings', () => {
  it('maps the legacy OpenGRC key to the current OpenCRQ key', () => {
    expect(LEGACY_PLATFORM_SETTINGS_KEYS.opengrcPlatforms).toBe('opencrqPlatforms');
    expect(getPlatformSettingsKey('opencrq')).toBe('opencrqPlatforms');
  });

  it('carries saved platforms from opengrcPlatforms to opencrqPlatforms', () => {
    const migrated = migrateLegacySettings({ openctiPlatforms: [], opengrcPlatforms: [platform('a')] });
    expect(migrated.opencrqPlatforms).toEqual([platform('a')]);
    expect(migrated).not.toHaveProperty('opengrcPlatforms');
    expect(migrated.openctiPlatforms).toEqual([]);
  });

  it('merges with platforms already under the current key, without duplicates', () => {
    const migrated = migrateLegacySettings({
      opencrqPlatforms: [platform('a')],
      opengrcPlatforms: [platform('a'), platform('b')],
    });
    expect(migrated.opencrqPlatforms).toEqual([platform('a'), platform('b')]);
  });

  it('leaves settings without a legacy key unchanged', () => {
    const stored = { openctiPlatforms: [platform('x')], theme: 'dark' };
    expect(migrateLegacySettings(stored)).toEqual(stored);
  });

  it('does not mutate the stored object', () => {
    const stored = { opengrcPlatforms: [platform('a')] };
    migrateLegacySettings(stored);
    expect(stored).toEqual({ opengrcPlatforms: [platform('a')] });
  });
});
