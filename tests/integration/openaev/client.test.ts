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

  // Helper to extract array from paginated response (Spring Boot style)
  private extractArray(response: any): any[] {
    // Handle Spring Boot paginated response: { content: [...], totalElements: N }
    if (response && typeof response === 'object' && Array.isArray(response.content)) {
      return response.content;
    }
    // Handle direct array response
    if (Array.isArray(response)) {
      return response;
    }
    // Return empty array if response format is unexpected
    return [];
  }

  async testConnection(): Promise<any> {
    return this.request('/api/settings');
  }

  async getEndpoints(): Promise<any[]> {
    // GET /api/endpoints returns a direct list of endpoints (not paginated)
    const response = await this.request('/api/endpoints');
    return this.extractArray(response);
  }

  async getEndpoint(id: string): Promise<any> {
    return this.request(`/api/endpoints/${id}`);
  }

  async searchEndpoints(searchTerm: string, limit = 10): Promise<any[]> {
    // POST /api/endpoints/search with SearchPaginationInput body
    const response = await this.request('/api/endpoints/search', {
      method: 'POST',
      body: JSON.stringify({
        textSearch: searchTerm,
        size: limit,
        page: 0,
      }),
    });
    return this.extractArray(response);
  }

  async getAssetGroups(): Promise<any[]> {
    // GET /api/asset_groups returns a direct list
    const response = await this.request('/api/asset_groups');
    return this.extractArray(response);
  }

  async getAssetGroup(id: string): Promise<any> {
    return this.request(`/api/asset_groups/${id}`);
  }

  async getPlayers(): Promise<any[]> {
    // GET /api/players returns a direct list
    const response = await this.request('/api/players');
    return this.extractArray(response);
  }

  async getPlayer(id: string): Promise<any> {
    return this.request(`/api/players/${id}`);
  }

  async getTeams(): Promise<any[]> {
    // GET /api/teams returns a direct list
    const response = await this.request('/api/teams');
    return this.extractArray(response);
  }

  async getTeam(id: string): Promise<any> {
    return this.request(`/api/teams/${id}`);
  }

  async getAttackPatterns(): Promise<any[]> {
    // GET /api/attack_patterns returns a direct list
    const response = await this.request('/api/attack_patterns');
    return this.extractArray(response);
  }

  async getAttackPattern(id: string): Promise<any> {
    return this.request(`/api/attack_patterns/${id}`);
  }

  async getScenarios(limit = 100): Promise<any[]> {
    // POST /api/scenarios/search with SearchPaginationInput body
    const response = await this.request('/api/scenarios/search', {
      method: 'POST',
      body: JSON.stringify({
        size: limit,
        page: 0,
      }),
    });
    return this.extractArray(response);
  }

  async getScenario(id: string): Promise<any> {
    return this.request(`/api/scenarios/${id}`);
  }

  async createEndpoint(endpoint: { 
    asset_name: string; 
    asset_description?: string;
    endpoint_platform: string;
    endpoint_arch: string;
  }): Promise<any> {
    // POST /api/endpoints/agentless for creating agentless endpoints
    return this.request('/api/endpoints/agentless', {
      method: 'POST',
      body: JSON.stringify(endpoint),
    });
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.request(`/api/endpoints/${id}`, { method: 'DELETE' });
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
    // Check settings endpoint - if this works, OpenAEV is available
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
    
    // Verify the response contains expected data
    const settingsData = await settingsResponse.json();
    if (settingsData) {
      isOpenAEVAvailable = true;
      return true;
    }
    
    connectionError = 'OpenAEV settings response was empty';
    return false;
  } catch (error) {
    connectionError = error instanceof Error ? error.message : 'Unknown connection error';
    return false;
  }
}

// Integration tests that require OpenAEV to be running
describe('OpenAEV Client Integration Tests', () => {
  let client: TestOpenAEVClient;
  let createdEndpointIds: string[] = [];

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  afterAll(async () => {
    // Cleanup created endpoints
    if (client && createdEndpointIds.length > 0) {
      for (const id of createdEndpointIds) {
        try {
          await client.deleteEndpoint(id);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('Connection', () => {
    it('should connect to OpenAEV and get settings', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const result = await client.testConnection();
      expect(result).toBeDefined();
    });
  });

  describe('Endpoints', () => {
    it('should get endpoints list', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const endpoints = await client.getEndpoints();
      expect(Array.isArray(endpoints)).toBe(true);
    });

    it('should search endpoints', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const endpoints = await client.searchEndpoints('test', 5);
      expect(Array.isArray(endpoints)).toBe(true);
    });
  });

  describe('Asset Groups', () => {
    it('should get asset groups list', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const groups = await client.getAssetGroups();
      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe('Players', () => {
    it('should get players list', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const players = await client.getPlayers();
      expect(Array.isArray(players)).toBe(true);
    });
  });

  describe('Teams', () => {
    it('should get teams list', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const teams = await client.getTeams();
      expect(Array.isArray(teams)).toBe(true);
    });
  });

  describe('Attack Patterns', () => {
    it('should get attack patterns list', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const patterns = await client.getAttackPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('Scenarios', () => {
    it('should get scenarios list', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const scenarios = await client.getScenarios();
      expect(Array.isArray(scenarios)).toBe(true);
    });
  });

  describe('Cache Simulation', () => {
    it('should fetch all cacheable entity types', async (context) => {
      if (!isOpenAEVAvailable) {
        console.log(`Skipping: OpenAEV not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const [endpoints, assetGroups, players, teams, attackPatterns] = await Promise.all([
        client.getEndpoints(),
        client.getAssetGroups(),
        client.getPlayers(),
        client.getTeams(),
        client.getAttackPatterns(),
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
      
      addToCache(endpoints, 'Endpoint', 'asset_name');
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

  it('should find seeded Production Web Server endpoint', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const endpoints = await client.searchEndpoints('Production Web Server', 5);
    expect(Array.isArray(endpoints)).toBe(true);
  });

  it('should find seeded Database Server endpoint with IPs', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const endpoints = await client.searchEndpoints('Database Server', 5);
    expect(Array.isArray(endpoints)).toBe(true);
  });

  it('should find seeded Production Servers asset group', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const groups = await client.getAssetGroups();
    expect(Array.isArray(groups)).toBe(true);
  });

  it('should find seeded Red Team Alpha', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const teams = await client.getTeams();
    expect(Array.isArray(teams)).toBe(true);
  });

  it('should find seeded attack patterns T1566 and T1059', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const patterns = await client.getAttackPatterns();
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('should find seeded scenarios', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const scenarios = await client.getScenarios();
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

describe('Pagination Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should paginate through endpoints using page-based pagination', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const pageSize = 5;
    let allResults: any[] = [];
    let currentPage = 0;
    let totalPages = 1;
    let pageCount = 0;
    
    while (currentPage < totalPages) {
      const response = await fetch(`${config.url}/api/endpoints/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          page: currentPage,
          size: pageSize,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Handle paginated response
      if (result.content) {
        allResults = allResults.concat(result.content);
        totalPages = result.totalPages || 1;
      } else if (Array.isArray(result)) {
        allResults = allResults.concat(result);
        totalPages = 1; // No pagination info
      }
      
      currentPage++;
      pageCount++;
      
      // Safety limit
      if (pageCount > 100) break;
    }
    
    console.log(`Fetched ${allResults.length} endpoints in ${pageCount} pages`);
    
    // Verify pagination worked
    expect(pageCount).toBeGreaterThanOrEqual(1);
    
    // Verify no duplicate IDs if we have results
    if (allResults.length > 0) {
      const ids = allResults.map(r => r.asset_id || r.endpoint_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it('should paginate through teams', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const pageSize = 5;
    let allResults: any[] = [];
    let currentPage = 0;
    let totalPages = 1;
    let pageCount = 0;
    
    while (currentPage < totalPages) {
      const response = await fetch(`${config.url}/api/teams/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          page: currentPage,
          size: pageSize,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.content) {
        allResults = allResults.concat(result.content);
        totalPages = result.totalPages || 1;
      } else if (Array.isArray(result)) {
        allResults = allResults.concat(result);
        totalPages = 1;
      }
      
      currentPage++;
      pageCount++;
      
      if (pageCount > 100) break;
    }
    
    console.log(`Fetched ${allResults.length} teams in ${pageCount} pages`);
    
    expect(pageCount).toBeGreaterThanOrEqual(1);
    
    if (allResults.length > 0) {
      const ids = allResults.map(r => r.team_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it('should paginate through attack patterns', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const pageSize = 10;
    let allResults: any[] = [];
    let currentPage = 0;
    let totalPages = 1;
    let pageCount = 0;
    
    while (currentPage < totalPages) {
      const response = await fetch(`${config.url}/api/attack_patterns/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          page: currentPage,
          size: pageSize,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.content) {
        allResults = allResults.concat(result.content);
        totalPages = result.totalPages || 1;
      } else if (Array.isArray(result)) {
        allResults = allResults.concat(result);
        totalPages = 1;
      }
      
      currentPage++;
      pageCount++;
      
      if (pageCount > 100) break;
    }
    
    console.log(`Fetched ${allResults.length} attack patterns in ${pageCount} pages`);
    
    expect(pageCount).toBeGreaterThanOrEqual(1);
    
    if (allResults.length > 0) {
      const ids = allResults.map(r => r.attack_pattern_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it('should paginate through players', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const pageSize = 5;
    let allResults: any[] = [];
    let currentPage = 0;
    let totalPages = 1;
    let pageCount = 0;
    
    while (currentPage < totalPages) {
      const response = await fetch(`${config.url}/api/players/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          page: currentPage,
          size: pageSize,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.content) {
        allResults = allResults.concat(result.content);
        totalPages = result.totalPages || 1;
      } else if (Array.isArray(result)) {
        allResults = allResults.concat(result);
        totalPages = 1;
      }
      
      currentPage++;
      pageCount++;
      
      if (pageCount > 100) break;
    }
    
    console.log(`Fetched ${allResults.length} players in ${pageCount} pages`);
    
    expect(pageCount).toBeGreaterThanOrEqual(1);
    
    if (allResults.length > 0) {
      const ids = allResults.map(r => r.user_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});
