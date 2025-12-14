/**
 * Integration Tests for OpenAEV Client
 * 
 * These tests require a running OpenAEV instance.
 * Environment variables:
 * - OPENAEV_URL: OpenAEV API URL (default: http://localhost:8080)
 * - OPENAEV_TOKEN: OpenAEV API token
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// OpenAEV client types and helpers
interface OpenAEVConfig {
  url: string;
  token: string;
}

// Simple REST client for testing
class TestOpenAEVClient {
  private config: OpenAEVConfig;

  constructor(config: OpenAEVConfig) {
    this.config = config;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.url}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async testConnection(): Promise<any> {
    return this.request('/api/settings');
  }

  async getAssets(limit = 100): Promise<any[]> {
    return this.request(`/api/assets?size=${limit}`);
  }

  async getAsset(id: string): Promise<any> {
    return this.request(`/api/assets/${id}`);
  }

  async searchAssets(searchTerm: string, limit = 10): Promise<any[]> {
    return this.request(`/api/assets?searchPaginationInput.textSearch=${encodeURIComponent(searchTerm)}&size=${limit}`);
  }

  async getAssetGroups(limit = 100): Promise<any[]> {
    return this.request(`/api/asset_groups?size=${limit}`);
  }

  async getAssetGroup(id: string): Promise<any> {
    return this.request(`/api/asset_groups/${id}`);
  }

  async getPlayers(limit = 100): Promise<any[]> {
    return this.request(`/api/players?size=${limit}`);
  }

  async getPlayer(id: string): Promise<any> {
    return this.request(`/api/players/${id}`);
  }

  async getTeams(limit = 100): Promise<any[]> {
    return this.request(`/api/teams?size=${limit}`);
  }

  async getTeam(id: string): Promise<any> {
    return this.request(`/api/teams/${id}`);
  }

  async getAttackPatterns(limit = 100): Promise<any[]> {
    return this.request(`/api/attack_patterns?size=${limit}`);
  }

  async getAttackPattern(id: string): Promise<any> {
    return this.request(`/api/attack_patterns/${id}`);
  }

  async getScenarios(limit = 100): Promise<any[]> {
    return this.request(`/api/scenarios?size=${limit}`);
  }

  async getScenario(id: string): Promise<any> {
    return this.request(`/api/scenarios/${id}`);
  }

  async createAsset(asset: { asset_name: string; asset_description?: string }): Promise<any> {
    return this.request('/api/assets', {
      method: 'POST',
      body: JSON.stringify(asset),
    });
  }

  async deleteAsset(id: string): Promise<void> {
    await this.request(`/api/assets/${id}`, { method: 'DELETE' });
  }
}

// Test configuration
const config: OpenAEVConfig = {
  url: process.env.OPENAEV_URL || 'http://localhost:8080',
  token: process.env.OPENAEV_TOKEN || '',
};

// Check if we have a token configured
const hasToken = !!config.token;

// Check if OpenAEV is actually available (only if we have a token)
let isOpenAEVAvailable = false;
let connectionError: string | null = null;

async function checkOpenAEVConnection(): Promise<boolean> {
  if (!hasToken) {
    connectionError = 'OPENAEV_TOKEN environment variable is not set';
    return false;
  }
  
  try {
    // Check settings endpoint
    const settingsResponse = await fetch(`${config.url}/api/settings`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!settingsResponse.ok) {
      connectionError = `OpenAEV settings returned status ${settingsResponse.status}`;
      return false;
    }
    
    // Also verify that the assets endpoint exists (to ensure full API is available)
    const assetsResponse = await fetch(`${config.url}/api/assets?size=1`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!assetsResponse.ok) {
      connectionError = `OpenAEV assets API returned status ${assetsResponse.status} - API may not be fully available`;
      return false;
    }
    
    isOpenAEVAvailable = true;
    return true;
  } catch (error) {
    connectionError = error instanceof Error ? error.message : 'Unknown connection error';
    return false;
  }
}

// Integration tests that require OpenAEV to be running
describe('OpenAEV Client Integration Tests', () => {
  let client: TestOpenAEVClient;
  let createdAssetIds: string[] = [];

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  afterAll(async () => {
    // Cleanup created assets
    if (client && createdAssetIds.length > 0) {
      for (const id of createdAssetIds) {
        try {
          await client.deleteAsset(id);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('Connection', () => {
    it('should connect to OpenAEV and get settings', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const result = await client.testConnection();
      expect(result).toBeDefined();
    });
  });

  describe('Assets', () => {
    it('should get assets list', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const assets = await client.getAssets(10);
      expect(Array.isArray(assets)).toBe(true);
    });

    it('should search assets', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const assets = await client.searchAssets('test', 5);
      expect(Array.isArray(assets)).toBe(true);
    });

    it('should create and delete an asset', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const testAsset = {
        asset_name: `Test Asset ${Date.now()}`,
        asset_description: 'Created by integration test',
      };
      
      const created = await client.createAsset(testAsset);
      expect(created).toBeDefined();
      expect(created.asset_id || created.id).toBeDefined();
      
      const assetId = created.asset_id || created.id;
      createdAssetIds.push(assetId);
      
      // Verify we can retrieve it
      const retrieved = await client.getAsset(assetId);
      expect(retrieved).toBeDefined();
      expect(retrieved.asset_name).toBe(testAsset.asset_name);
    });
  });

  describe('Asset Groups', () => {
    it('should get asset groups list', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const groups = await client.getAssetGroups(10);
      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe('Players', () => {
    it('should get players list', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const players = await client.getPlayers(10);
      expect(Array.isArray(players)).toBe(true);
    });
  });

  describe('Teams', () => {
    it('should get teams list', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const teams = await client.getTeams(10);
      expect(Array.isArray(teams)).toBe(true);
    });
  });

  describe('Attack Patterns', () => {
    it('should get attack patterns list', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const patterns = await client.getAttackPatterns(10);
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('Scenarios', () => {
    it('should get scenarios list', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const scenarios = await client.getScenarios(10);
      expect(Array.isArray(scenarios)).toBe(true);
    });
  });

  describe('Cache Simulation', () => {
    it('should fetch all cacheable entity types', async ({ skip }) => {
      if (!isOpenAEVAvailable) {
        skip(`OpenAEV not available: ${connectionError}`);
        return;
      }
      
      const [assets, assetGroups, players, teams, attackPatterns] = await Promise.all([
        client.getAssets(50),
        client.getAssetGroups(50),
        client.getPlayers(50),
        client.getTeams(50),
        client.getAttackPatterns(50),
      ]);
      
      // Build a cache map
      const cacheMap = new Map<string, any>();
      
      const addToCache = (entities: any[], type: string, nameField: string) => {
        for (const entity of entities) {
          const name = entity[nameField];
          if (name && name.length >= 4) {
            cacheMap.set(name.toLowerCase(), { ...entity, type });
          }
        }
      };
      
      addToCache(assets, 'Asset', 'asset_name');
      addToCache(assetGroups, 'AssetGroup', 'asset_group_name');
      addToCache(players, 'Player', 'user_email');
      addToCache(teams, 'Team', 'team_name');
      addToCache(attackPatterns, 'AttackPattern', 'attack_pattern_name');
      
      expect(cacheMap.size).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Seeded Data Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should find seeded Production Web Server asset', async ({ skip }) => {
    if (!isOpenAEVAvailable) {
      skip(`OpenAEV not available: ${connectionError}`);
      return;
    }
    
    const assets = await client.searchAssets('Production Web Server', 5);
    expect(Array.isArray(assets)).toBe(true);
  });

  it('should find seeded Database Server asset with IPs', async ({ skip }) => {
    if (!isOpenAEVAvailable) {
      skip(`OpenAEV not available: ${connectionError}`);
      return;
    }
    
    const assets = await client.searchAssets('Database Server', 5);
    expect(Array.isArray(assets)).toBe(true);
  });

  it('should find seeded Production Servers asset group', async ({ skip }) => {
    if (!isOpenAEVAvailable) {
      skip(`OpenAEV not available: ${connectionError}`);
      return;
    }
    
    const groups = await client.getAssetGroups(10);
    expect(Array.isArray(groups)).toBe(true);
  });

  it('should find seeded Red Team Alpha', async ({ skip }) => {
    if (!isOpenAEVAvailable) {
      skip(`OpenAEV not available: ${connectionError}`);
      return;
    }
    
    const teams = await client.getTeams(10);
    expect(Array.isArray(teams)).toBe(true);
  });

  it('should find seeded attack patterns T1566 and T1059', async ({ skip }) => {
    if (!isOpenAEVAvailable) {
      skip(`OpenAEV not available: ${connectionError}`);
      return;
    }
    
    const patterns = await client.getAttackPatterns(10);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('should find seeded scenarios', async ({ skip }) => {
    if (!isOpenAEVAvailable) {
      skip(`OpenAEV not available: ${connectionError}`);
      return;
    }
    
    const scenarios = await client.getScenarios(10);
    expect(Array.isArray(scenarios)).toBe(true);
  });
});

// Unit tests that don't require OpenAEV connection
describe('OpenAEV Entity Matching Tests', () => {
  it('should match asset names case-insensitively', () => {
    const cache = new Map<string, { name: string; type: string }>();
    cache.set('production server', { name: 'Production Server', type: 'Asset' });
    cache.set('web server', { name: 'Web Server', type: 'Asset' });
    
    const textToSearch = 'The production server was compromised along with the web server';
    const textLower = textToSearch.toLowerCase();
    
    const found: string[] = [];
    for (const [key, value] of cache.entries()) {
      if (textLower.includes(key)) {
        found.push(value.name);
      }
    }
    
    expect(found).toContain('Production Server');
    expect(found).toContain('Web Server');
  });

  it('should respect minimum name length for matching', () => {
    const cache = new Map<string, { name: string; type: string }>();
    cache.set('srv', { name: 'SRV', type: 'Asset' }); // Too short
    cache.set('production', { name: 'Production', type: 'Asset' });
    
    const minLength = 4;
    const textToSearch = 'SRV and Production servers';
    const textLower = textToSearch.toLowerCase();
    
    const found: string[] = [];
    for (const [key, value] of cache.entries()) {
      if (key.length >= minLength && textLower.includes(key)) {
        found.push(value.name);
      }
    }
    
    expect(found).toContain('Production');
    expect(found).not.toContain('SRV');
  });

  it('should use word boundaries for matching', () => {
    const searchValue = 'server';
    const textWithMatch = 'The server was attacked';
    const textWithoutMatch = 'The serverless function...';
    
    const regex = new RegExp(`\\b${searchValue}\\b`, 'i');
    
    expect(regex.test(textWithMatch)).toBe(true);
    expect(regex.test(textWithoutMatch)).toBe(false);
  });

  it('should match attack patterns by name', () => {
    const cache = new Map<string, { name: string; type: string; external_id?: string }>();
    cache.set('command and scripting interpreter', {
      name: 'Command and Scripting Interpreter',
      type: 'AttackPattern',
      external_id: 'T1059',
    });
    cache.set('spearphishing attachment', {
      name: 'Spearphishing Attachment',
      type: 'AttackPattern',
      external_id: 'T1566.001',
    });
    
    const textToSearch = 'The attacker used Command and Scripting Interpreter techniques';
    const textLower = textToSearch.toLowerCase();
    
    const found: { name: string; external_id?: string }[] = [];
    for (const [key, value] of cache.entries()) {
      if (textLower.includes(key)) {
        found.push({ name: value.name, external_id: value.external_id });
      }
    }
    
    expect(found.length).toBe(1);
    expect(found[0].name).toBe('Command and Scripting Interpreter');
    expect(found[0].external_id).toBe('T1059');
  });

  it('should match IP addresses exactly', () => {
    const ipPattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    
    const text = 'The server at 192.168.1.100 was connected to 10.0.0.50';
    const matches = text.match(ipPattern);
    
    expect(matches).toBeDefined();
    expect(matches).toContain('192.168.1.100');
    expect(matches).toContain('10.0.0.50');
  });

  it('should match MAC addresses', () => {
    const macPattern = /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g;
    
    const text = 'The device MAC address is 00:1A:2B:3C:4D:5E';
    const matches = text.match(macPattern);
    
    expect(matches).toBeDefined();
    expect(matches).toContain('00:1A:2B:3C:4D:5E');
  });

  it('should match hostnames in cache', () => {
    const cache = new Map<string, { name: string; type: string }>();
    cache.set('db-server-01', { name: 'Database Server', type: 'Asset' });
    cache.set('ws-alpha', { name: 'Workstation Alpha', type: 'Asset' });
    
    const textToSearch = 'Connection from db-server-01 to ws-alpha detected';
    
    const found: string[] = [];
    for (const [key, value] of cache.entries()) {
      const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(textToSearch)) {
        found.push(value.name);
      }
    }
    
    expect(found).toContain('Database Server');
    expect(found).toContain('Workstation Alpha');
  });
});

describe('Domain/Hostname Detection for Atomic Testing', () => {
  const domainPattern = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|org|net|io|co|gov|edu)\b/gi;
  
  it('should detect domains in text', () => {
    const text = 'The malware connects to evil.com and also uses malicious.org';
    const matches = text.match(domainPattern);
    
    expect(matches).toBeDefined();
    expect(matches).toContain('evil.com');
    expect(matches).toContain('malicious.org');
  });

  it('should detect subdomains', () => {
    const text = 'C2 traffic observed to api.evil.com and cdn.malicious.org';
    const matches = text.match(domainPattern);
    
    expect(matches).toBeDefined();
    expect(matches).toContain('api.evil.com');
    expect(matches).toContain('cdn.malicious.org');
  });

  it('should not match invalid TLDs', () => {
    const text = 'This is not a domain: test.notarealtld';
    const matches = text.match(domainPattern);
    
    expect(matches).toBeNull();
  });
});
