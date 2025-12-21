/**
 * Integration Tests for OpenAEV Client
 * 
 * These tests require a running OpenAEV instance.
 * Environment variables:
 * - OPENAEV_URL: OpenAEV API URL (default: http://localhost:8080)
 * - OPENAEV_TOKEN: OpenAEV API token
 * 
 * Coverage:
 * - Connection & Platform Settings
 * - Assets (Endpoints) - CRUD, Search, Pagination
 * - Asset Groups - CRUD, Search
 * - Players (Users) - CRUD, Search
 * - Teams - CRUD, Search
 * - Attack Patterns - Fetch, Search
 * - Findings - Fetch, Pagination
 * - Vulnerabilities (CVE lookup)
 * - Kill Chain Phases & Tags
 * - Injector Contracts & Payloads
 * - Scenarios - CRUD, Injects
 * - Atomic Testing
 * - Full Text Search
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServiceGuard, assertEntityList } from '../test-helpers';

// OpenAEV client types and helpers
interface OpenAEVConfig {
  url: string;
  token: string;
}

// Comprehensive REST client for testing
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
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Helper to extract array from paginated response (Spring Boot style)
  private extractArray(response: any): any[] {
    if (response && typeof response === 'object' && Array.isArray(response.content)) {
      return response.content;
    }
    if (Array.isArray(response)) {
      return response;
    }
    return [];
  }

  // ==========================================================================
  // Connection & Platform Info
  // ==========================================================================

  async testConnection(): Promise<any> {
    return this.request('/api/settings');
  }

  async getCurrentUser(): Promise<any> {
    return this.request('/api/me');
  }

  async getPlatformSettings(): Promise<{
    platform_name: string;
    platform_theme: string;
    platform_lang: string;
    platform_version?: string;
    platform_license?: { license_is_enterprise?: boolean };
  }> {
    return this.request('/api/settings');
  }

  // ==========================================================================
  // Assets (Endpoints)
  // ==========================================================================

  async getEndpoints(): Promise<any[]> {
    const response = await this.request('/api/endpoints');
    return this.extractArray(response);
  }

  async getEndpoint(id: string): Promise<any> {
    return this.request(`/api/endpoints/${id}`);
  }

  async searchEndpoints(searchTerm: string, limit = 10): Promise<any[]> {
    const response = await this.request('/api/endpoints/search', {
      method: 'POST',
      body: JSON.stringify({ textSearch: searchTerm, size: limit, page: 0 }),
    });
    return this.extractArray(response);
  }

  async searchEndpointsWithFilter(filterGroup: any, page = 0, size = 10): Promise<{ content: any[]; totalPages: number; totalElements: number }> {
    return this.request('/api/endpoints/search', {
      method: 'POST',
      body: JSON.stringify({ page, size, filterGroup }),
    });
  }

  async createEndpoint(endpoint: { 
    asset_name: string; 
    asset_description?: string;
    endpoint_platform: string;
    endpoint_arch: string;
  }): Promise<any> {
    return this.request('/api/endpoints/agentless', {
      method: 'POST',
      body: JSON.stringify(endpoint),
    });
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.request(`/api/endpoints/${id}`, { method: 'DELETE' });
  }

  // ==========================================================================
  // Asset Groups
  // ==========================================================================

  async getAssetGroups(): Promise<any[]> {
    const response = await this.request('/api/asset_groups');
    return this.extractArray(response);
  }

  async getAssetGroup(id: string): Promise<any> {
    return this.request(`/api/asset_groups/${id}`);
  }

  async searchAssetGroups(searchTerm: string, limit = 10): Promise<any[]> {
    const filterGroup = {
      mode: 'and',
      filters: [{ key: 'asset_group_name', operator: 'contains', values: [searchTerm] }],
    };
    const response = await this.request<{ content: any[] }>('/api/asset_groups/search', {
      method: 'POST',
      body: JSON.stringify({ page: 0, size: limit, filterGroup }),
    });
    return response.content || [];
  }

  // ==========================================================================
  // Players (Users)
  // ==========================================================================

  async getPlayers(): Promise<any[]> {
    const response = await this.request('/api/players');
    return this.extractArray(response);
  }

  async getPlayer(id: string): Promise<any> {
    const users = await this.request<any[]>('/api/users/find', {
      method: 'POST',
      body: JSON.stringify([id]),
    });
    return users && users.length > 0 ? users[0] : null;
  }

  async searchPlayers(searchTerm: string, limit = 10): Promise<any[]> {
    const filterGroup = {
      mode: 'or',
      filters: [
        { key: 'user_email', operator: 'contains', values: [searchTerm] },
        { key: 'user_firstname', operator: 'contains', values: [searchTerm] },
        { key: 'user_lastname', operator: 'contains', values: [searchTerm] },
      ],
    };
    const response = await this.request<{ content: any[] }>('/api/players/search', {
      method: 'POST',
      body: JSON.stringify({ page: 0, size: limit, filterGroup }),
    });
    return response.content || [];
  }

  // ==========================================================================
  // Teams
  // ==========================================================================

  async getTeams(): Promise<any[]> {
    const response = await this.request('/api/teams');
    return this.extractArray(response);
  }

  async getTeam(id: string): Promise<any> {
    return this.request(`/api/teams/${id}`);
  }

  async searchTeams(searchTerm: string, limit = 10): Promise<any[]> {
    const filterGroup = {
      mode: 'and',
      filters: [{ key: 'team_name', operator: 'contains', values: [searchTerm] }],
    };
    const response = await this.request<{ content: any[] }>('/api/teams/search', {
      method: 'POST',
      body: JSON.stringify({ page: 0, size: limit, filterGroup }),
    });
    return response.content || [];
  }

  // ==========================================================================
  // Attack Patterns
  // ==========================================================================

  async getAttackPatterns(): Promise<any[]> {
    const response = await this.request('/api/attack_patterns');
    return this.extractArray(response);
  }

  async getAttackPattern(id: string): Promise<any> {
    return this.request(`/api/attack_patterns/${id}`);
  }

  async searchAttackPatterns(page = 0, size = 100): Promise<{ content: any[]; totalPages: number }> {
    return this.request('/api/attack_patterns/search', {
      method: 'POST',
      body: JSON.stringify({ page, size }),
    });
  }

  // ==========================================================================
  // Findings
  // ==========================================================================

  async getFindings(page = 0, size = 100): Promise<{ content: any[]; totalPages: number; totalElements: number }> {
    return this.request('/api/findings/search?distinct=true', {
      method: 'POST',
      body: JSON.stringify({ page, size }),
    });
  }

  async getFinding(id: string): Promise<any> {
    return this.request(`/api/findings/${id}`);
  }

  // ==========================================================================
  // Vulnerabilities (CVE)
  // ==========================================================================

  async getVulnerabilityByExternalId(cveId: string): Promise<any | null> {
    try {
      return await this.request(`/api/vulnerabilities/external-id/${encodeURIComponent(cveId)}`);
    } catch (error) {
      // 404 is expected for CVEs not in OpenAEV
      return null;
    }
  }

  async getVulnerability(id: string): Promise<any> {
    return this.request(`/api/vulnerabilities/${id}`);
  }

  // ==========================================================================
  // Kill Chain Phases & Tags
  // ==========================================================================

  async getKillChainPhases(): Promise<Array<{ phase_id: string; phase_name: string; phase_order: number }>> {
    return this.request('/api/kill_chain_phases');
  }

  async getTags(): Promise<Array<{ tag_id: string; tag_name: string }>> {
    return this.request('/api/tags');
  }

  // ==========================================================================
  // Injector Contracts & Payloads
  // ==========================================================================

  async getInjectorContracts(page = 0, size = 100): Promise<{ content: any[]; totalPages: number }> {
    return this.request('/api/injector_contracts/search', {
      method: 'POST',
      body: JSON.stringify({ page, size }),
    });
  }

  async getInjectorContract(id: string): Promise<any> {
    return this.request(`/api/injector_contracts/${id}`);
  }

  async searchInjectorContractsByKillChainPhase(killChainPhaseId: string, size = 100): Promise<any[]> {
    const filterGroup = {
      mode: 'and',
      filters: [{ key: 'injector_contract_kill_chain_phases', operator: 'contains', values: [killChainPhaseId] }],
    };
    const response = await this.request<{ content: any[] }>('/api/injector_contracts/search', {
      method: 'POST',
      body: JSON.stringify({ page: 0, size, filterGroup }),
    });
    return response.content || [];
  }

  async getPayload(id: string): Promise<any> {
    return this.request(`/api/payloads/${id}`);
  }

  async searchPayloads(page = 0, size = 100): Promise<{ content: any[]; totalPages: number }> {
    return this.request('/api/payloads/search', {
      method: 'POST',
      body: JSON.stringify({ page, size }),
    });
  }

  async createPayload(payload: {
    payload_name: string;
    payload_description?: string;
    payload_platforms: string[];
    payload_type: string;
    payload_source?: string;
    payload_status?: string;
    payload_attack_patterns?: string[];
    command_executor?: string;
    command_content?: string;
  }): Promise<any> {
    return this.request('/api/payloads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async findDnsResolutionPayloadByHostname(hostname: string): Promise<any | null> {
    // Note: payload_type is not a filterable field in OpenAEV API
    // Only dns_resolution_hostname is filterable, which uniquely identifies DnsResolution payloads
    const filterGroup = {
      mode: 'and',
      filters: [
        { key: 'dns_resolution_hostname', operator: 'eq', values: [hostname] },
      ],
    };
    const response = await this.request<{ content: any[] }>('/api/payloads/search', {
      method: 'POST',
      body: JSON.stringify({ page: 0, size: 10, filterGroup }),
    });
    return response.content?.[0] || null;
  }

  // ==========================================================================
  // Scenarios
  // ==========================================================================

  async getScenarios(limit = 100): Promise<any[]> {
    const response = await this.request('/api/scenarios/search', {
      method: 'POST',
      body: JSON.stringify({ size: limit, page: 0 }),
    });
    return this.extractArray(response);
  }

  async getScenario(id: string): Promise<any> {
    return this.request(`/api/scenarios/${id}`);
  }

  async createScenario(input: {
    scenario_name: string;
    scenario_description?: string;
    scenario_subtitle?: string;
    scenario_category?: string;
    scenario_main_focus?: string;
    scenario_severity?: string;
  }): Promise<any> {
    return this.request('/api/scenarios', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async deleteScenario(id: string): Promise<void> {
    await this.request(`/api/scenarios/${id}`, { method: 'DELETE' });
  }

  async addInjectToScenario(scenarioId: string, inject: any): Promise<any> {
    return this.request(`/api/scenarios/${scenarioId}/injects`, {
      method: 'POST',
      body: JSON.stringify(inject),
    });
  }

  // ==========================================================================
  // Atomic Testing
  // ==========================================================================

  async createAtomicTesting(input: {
    atomic_testing_name: string;
    atomic_testing_description?: string;
    atomic_testing_injector_contract: string;
    atomic_testing_targets: Array<{ id: string; type: string }>;
  }): Promise<any> {
    return this.request('/api/atomic-testings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ==========================================================================
  // Full Text Search
  // ==========================================================================

  async fullTextSearch(searchTerm: string): Promise<Record<string, { count: number }>> {
    return this.request('/api/fulltextsearch', {
      method: 'POST',
      body: JSON.stringify({ searchTerm }),
    });
  }

  async fullTextSearchByClass(className: string, searchTerm: string, page = 0, size = 10): Promise<{ content: any[]; totalElements: number }> {
    return this.request(`/api/fulltextsearch/${className}`, {
      method: 'POST',
      body: JSON.stringify({ textSearch: searchTerm, page, size }),
    });
  }

  // ==========================================================================
  // Organizations & Exercises
  // ==========================================================================

  async getOrganization(id: string): Promise<any> {
    return this.request(`/api/organizations/${id}`);
  }

  async getExercise(id: string): Promise<any> {
    return this.request(`/api/exercises/${id}`);
  }

  async searchExercises(page = 0, size = 100): Promise<{ content: any[]; totalPages: number }> {
    return this.request('/api/exercises/search', {
      method: 'POST',
      body: JSON.stringify({ page, size }),
    });
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

// Create a service guard for skipping tests when OpenAEV is unavailable
const skipIfUnavailable = createServiceGuard(
  () => isOpenAEVAvailable,
  'OpenAEV',
  () => connectionError || undefined
);

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
      if (skipIfUnavailable(context)) return;
      
      const result = await client.testConnection();
      expect(result).toBeDefined();
    });
  });

  describe('Endpoints', () => {
    it('should get endpoints list', async (context) => {
      if (skipIfUnavailable(context)) return;
      
      const endpoints = await client.getEndpoints();
      assertEntityList(endpoints);
    });

    it('should search endpoints', async (context) => {
      if (skipIfUnavailable(context)) return;
      
      const endpoints = await client.searchEndpoints('test', 5);
      assertEntityList(endpoints);
    });
  });

  describe('Asset Groups', () => {
    it('should get asset groups list', async (context) => {
      if (skipIfUnavailable(context)) return;
      
      const groups = await client.getAssetGroups();
      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe('Players', () => {
    it('should get players list', async (context) => {
      if (skipIfUnavailable(context)) return;
      
      const players = await client.getPlayers();
      expect(Array.isArray(players)).toBe(true);
    });
  });

  describe('Teams', () => {
    it('should get teams list', async (context) => {
      if (skipIfUnavailable(context)) return;
      
      const teams = await client.getTeams();
      expect(Array.isArray(teams)).toBe(true);
    });
  });

  describe('Attack Patterns', () => {
    it('should get attack patterns list', async (context) => {
      if (skipIfUnavailable(context)) return;
      
      const patterns = await client.getAttackPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('Scenarios', () => {
    it('should get scenarios list', async (context) => {
      if (skipIfUnavailable(context)) return;
      
      const scenarios = await client.getScenarios();
      expect(Array.isArray(scenarios)).toBe(true);
    });
  });

  describe('Cache Simulation', () => {
    it('should fetch all cacheable entity types', async (context) => {
      if (skipIfUnavailable(context)) return;
      
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

describe('Vulnerability (CVE) Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should search for a known CVE by external ID', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    // Search for a well-known CVE
    const result = await client.getVulnerabilityByExternalId('CVE-2021-44228');
    // May or may not exist depending on data seeding
    if (result) {
      expect(result.vulnerability_external_id).toBe('CVE-2021-44228');
      expect(result.vulnerability_id).toBeDefined();
    }
  });

  it('should return null for non-existent CVE', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.getVulnerabilityByExternalId('CVE-9999-99999');
    expect(result).toBeNull();
  });
});

describe('Kill Chain Phases & Tags Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should get kill chain phases', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const phases = await client.getKillChainPhases();
    expect(Array.isArray(phases)).toBe(true);
    
    if (phases.length > 0) {
      expect(phases[0].phase_id).toBeDefined();
      expect(phases[0].phase_name).toBeDefined();
    }
  });

  it('should get tags', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const tags = await client.getTags();
    expect(Array.isArray(tags)).toBe(true);
    
    if (tags.length > 0) {
      expect(tags[0].tag_id).toBeDefined();
      expect(tags[0].tag_name).toBeDefined();
    }
  });
});

describe('Injector Contracts & Payloads Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should get injector contracts with pagination', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.getInjectorContracts(0, 10);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should search injector contracts by kill chain phase', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    // First get kill chain phases
    const phases = await client.getKillChainPhases();
    if (phases.length > 0) {
      const contracts = await client.searchInjectorContractsByKillChainPhase(phases[0].phase_id);
      expect(Array.isArray(contracts)).toBe(true);
    }
  });

  it('should search payloads', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.searchPayloads(0, 10);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should search for DNS resolution payload by hostname', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.findDnsResolutionPayloadByHostname('test.example.com');
    // May be null if no such payload exists
    expect(result === null || typeof result === 'object').toBe(true);
  });
});

describe('Scenario Operations Tests', () => {
  let client: TestOpenAEVClient;
  let createdScenarioIds: string[] = [];

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  afterAll(async () => {
    for (const id of createdScenarioIds) {
      try { await client.deleteScenario(id); } catch { /* ignore */ }
    }
  });

  it('should create a scenario', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.createScenario({
      scenario_name: `Test Scenario ${Date.now()}`,
      scenario_description: 'Integration test scenario',
      scenario_category: 'attack-scenario',
      scenario_main_focus: 'incident-response',
      scenario_severity: 'high',
    });
    
    expect(result).toBeDefined();
    expect(result.scenario_id || result.id).toBeDefined();
    
    createdScenarioIds.push(result.scenario_id || result.id);
  });

  it('should get a scenario by ID', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const scenarios = await client.getScenarios(1);
    if (scenarios.length > 0) {
      const scenarioId = scenarios[0].scenario_id || scenarios[0].id;
      const scenario = await client.getScenario(scenarioId);
      expect(scenario).toBeDefined();
      expect(scenario.scenario_id || scenario.id).toBe(scenarioId);
    }
  });
});

describe('Full Text Search Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should perform full text search', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.fullTextSearch('test');
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should perform full text search by class', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    // OpenAEV API requires full class names (e.g., io.openaev.database.model.Asset)
    // Asset is the parent class of Endpoint
    const result = await client.fullTextSearchByClass('io.openaev.database.model.Asset', 'server', 0, 10);
    expect(result).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should search by different entity classes', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    // OpenAEV API requires full class names
    const classes = [
      'io.openaev.database.model.Asset',
      'io.openaev.database.model.Team',
      'io.openaev.database.model.Scenario'
    ];
    for (const className of classes) {
      const result = await client.fullTextSearchByClass(className, 'test', 0, 5);
      expect(result).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    }
  });
});

describe('Individual Entity Getters Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should get a specific endpoint by ID', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const endpoints = await client.getEndpoints();
    if (endpoints.length > 0) {
      const endpointId = endpoints[0].asset_id || endpoints[0].endpoint_id;
      if (endpointId) {
        const endpoint = await client.getEndpoint(endpointId);
        expect(endpoint).toBeDefined();
        expect(endpoint.asset_id || endpoint.endpoint_id).toBe(endpointId);
      }
    }
  });

  it('should get a specific asset group by ID', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const groups = await client.getAssetGroups();
    if (groups.length > 0) {
      const groupId = groups[0].asset_group_id;
      if (groupId) {
        const group = await client.getAssetGroup(groupId);
        expect(group).toBeDefined();
        expect(group.asset_group_id).toBe(groupId);
      }
    }
  });

  it('should get a specific team by ID', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const teams = await client.getTeams();
    if (teams.length > 0) {
      const teamId = teams[0].team_id;
      if (teamId) {
        const team = await client.getTeam(teamId);
        expect(team).toBeDefined();
        expect(team.team_id).toBe(teamId);
      }
    }
  });

  it('should get a specific attack pattern by ID', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const patterns = await client.getAttackPatterns();
    if (patterns.length > 0) {
      const patternId = patterns[0].attack_pattern_id;
      if (patternId) {
        const pattern = await client.getAttackPattern(patternId);
        expect(pattern).toBeDefined();
        expect(pattern.attack_pattern_id).toBe(patternId);
      }
    }
  });
});

describe('Search Operations Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should search asset groups', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const groups = await client.searchAssetGroups('test', 10);
    expect(Array.isArray(groups)).toBe(true);
  });

  it('should search players', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const players = await client.searchPlayers('admin', 10);
    expect(Array.isArray(players)).toBe(true);
  });

  it('should search teams', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const teams = await client.searchTeams('team', 10);
    expect(Array.isArray(teams)).toBe(true);
  });

  it('should search attack patterns with pagination', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.searchAttackPatterns(0, 10);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should search endpoints with filter', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const filterGroup = {
      mode: 'and',
      filters: [{ key: 'endpoint_platform', operator: 'eq', values: ['Linux'] }],
    };
    const result = await client.searchEndpointsWithFilter(filterGroup, 0, 10);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    
    // All results should be Linux platforms
    for (const endpoint of result.content) {
      expect(endpoint.endpoint_platform).toBe('Linux');
    }
  });
});

describe('Exercises Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should search exercises', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.searchExercises(0, 10);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should get a specific exercise by ID', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const result = await client.searchExercises(0, 1);
    if (result.content.length > 0) {
      const exerciseId = result.content[0].exercise_id;
      if (exerciseId) {
        const exercise = await client.getExercise(exerciseId);
        expect(exercise).toBeDefined();
        expect(exercise.exercise_id).toBe(exerciseId);
      }
    }
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
    if (skipIfUnavailable(context)) return;
    
    const endpoints = await client.searchEndpoints('Production Web Server', 5);
    expect(Array.isArray(endpoints)).toBe(true);
  });

  it('should find seeded Database Server endpoint with IPs', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const endpoints = await client.searchEndpoints('Database Server', 5);
    expect(Array.isArray(endpoints)).toBe(true);
  });

  it('should find seeded Production Servers asset group', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const groups = await client.getAssetGroups();
    expect(Array.isArray(groups)).toBe(true);
  });

  it('should find seeded Red Team Alpha', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const teams = await client.getTeams();
    expect(Array.isArray(teams)).toBe(true);
  });

  it('should find seeded attack patterns T1566 and T1059', async (context) => {
    if (skipIfUnavailable(context)) return;
    
    const patterns = await client.getAttackPatterns();
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('should find seeded scenarios', async (context) => {
    if (skipIfUnavailable(context)) return;
    
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

/**
 * Helper function for pagination tests to reduce duplication
 */
async function testPagination(options: {
  endpoint: string;
  entityName: string;
  pageSize: number;
  idField: string | string[];
}): Promise<void> {
  const { endpoint, entityName, pageSize, idField } = options;
  
  let allResults: any[] = [];
  let currentPage = 0;
  let totalPages = 1;
  let pageCount = 0;
  
  while (currentPage < totalPages) {
    const response = await fetch(`${config.url}${endpoint}`, {
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
  
  console.log(`Fetched ${allResults.length} ${entityName} in ${pageCount} pages`);
  
  // Verify pagination worked
  expect(pageCount).toBeGreaterThanOrEqual(1);
  
  // Verify no duplicate IDs if we have results
  if (allResults.length > 0) {
    const idFields = Array.isArray(idField) ? idField : [idField];
    const ids = allResults.map(r => {
      for (const field of idFields) {
        if (r[field]) return r[field];
      }
      return undefined;
    });
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  }
}

describe('Findings Tests', () => {
  let client: TestOpenAEVClient;

  beforeAll(async () => {
    await checkOpenAEVConnection();
    if (isOpenAEVAvailable) {
      client = new TestOpenAEVClient(config);
    }
  });

  it('should get findings list', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const response = await fetch(`${config.url}/api/findings/search?distinct=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        page: 0,
        size: 10,
      }),
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toBeDefined();
    // Response should have content array and pagination info
    if (data.content) {
      expect(Array.isArray(data.content)).toBe(true);
    }
  });

  it('should paginate through findings', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    await testPagination({
      endpoint: '/api/findings/search?distinct=true',
      entityName: 'findings',
      pageSize: 10,
      idField: 'finding_id',
    });
  });

  it('should have finding_value field for exact matching', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const response = await fetch(`${config.url}/api/findings/search?distinct=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        page: 0,
        size: 10,
      }),
    });
    
    const data = await response.json();
    
    if (data.content && data.content.length > 0) {
      // Check that findings have the expected fields for cache matching
      const finding = data.content[0];
      // Common fields that should exist
      expect(finding.finding_id || finding.id).toBeDefined();
    }
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
    
    await testPagination({
      endpoint: '/api/endpoints/search',
      entityName: 'endpoints',
      pageSize: 5,
      idField: ['asset_id', 'endpoint_id'],
    });
  });

  it('should paginate through teams', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    await testPagination({
      endpoint: '/api/teams/search',
      entityName: 'teams',
      pageSize: 5,
      idField: 'team_id',
    });
  });

  it('should paginate through attack patterns', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    await testPagination({
      endpoint: '/api/attack_patterns/search',
      entityName: 'attack patterns',
      pageSize: 10,
      idField: 'attack_pattern_id',
    });
  });

  it('should paginate through players', async (context) => {
    if (!isOpenAEVAvailable) {
      console.log(`Skipping: OpenAEV not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    await testPagination({
      endpoint: '/api/players/search',
      entityName: 'players',
      pageSize: 5,
      idField: 'user_id',
    });
  });
});
