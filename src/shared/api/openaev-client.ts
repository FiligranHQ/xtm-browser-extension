/**
 * OpenAEV API Client
 * 
 * REST API client for OpenAEV platform operations.
 */

import { loggers } from '../utils/logger';

const log = loggers.openaev;

import type {
  PlatformConfig,
  OAEVAsset,
  OAEVAssetGroup,
  OAEVPlayer,
  OAEVTeam,
  OAEVAttackPattern,
  OAEVScenario,
  OAEVScenarioInput,
} from '../types';

export class OpenAEVClient {
  private baseUrl: string;
  private token: string;
  private platformId: string;
  private platformName: string;

  constructor(config: PlatformConfig) {
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.token = config.apiToken;
    this.platformId = config.id;
    this.platformName = config.name;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAEV API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ============================================================================
  // Authentication & Platform Info
  // ============================================================================

  /**
   * Test connection and get platform info including platform name, version, and enterprise status
   */
  async testConnection(): Promise<{ 
    success: boolean; 
    user?: OAEVPlayer; 
    platform_name?: string;
    version?: string;
    enterprise_edition?: boolean;
  }> {
    try {
      // Fetch both user info and platform settings in parallel
      const [user, settings] = await Promise.all([
        this.request<OAEVPlayer>('/api/me'),
        this.fetchPlatformSettings().catch(() => null),
      ]);
      
      // Enterprise edition is in platform_license.license_is_enterprise
      const isEnterprise = settings?.platform_license?.license_is_enterprise ?? false;
      
      return { 
        success: true, 
        user,
        platform_name: settings?.platform_name,
        version: settings?.platform_version,
        enterprise_edition: isEnterprise,
      };
    } catch (error) {
      log.error(' Connection test failed:', error);
      return { success: false };
    }
  }

  /**
   * Fetch platform settings including platform name, version, and enterprise status
   */
  async fetchPlatformSettings(): Promise<{ 
    platform_name: string; 
    platform_theme: string; 
    platform_lang: string;
    platform_version?: string;
    platform_license?: {
      license_is_enterprise?: boolean;
      license_is_validated?: boolean;
      license_type?: string;
    };
  } | null> {
    try {
      return await this.request<{ 
        platform_name: string; 
        platform_theme: string; 
        platform_lang: string;
        platform_version?: string;
        platform_license?: {
          license_is_enterprise?: boolean;
          license_is_validated?: boolean;
          license_type?: string;
        };
      }>('/api/settings');
    } catch (error) {
      log.error(' Get platform settings failed:', error);
      return null;
    }
  }

  async login(email: string, password: string): Promise<OAEVPlayer> {
    return this.request<OAEVPlayer>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ login: email, password }),
    });
  }

  // ============================================================================
  // Assets (Endpoints)
  // ============================================================================

  async searchAssets(searchTerm: string, limit = 20): Promise<OAEVAsset[]> {
    try {
      const response = await this.request<{ content: OAEVAsset[] }>('/api/endpoints/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroup: {
            mode: 'or',
            filters: [
              {
                key: 'asset_name',
                operator: 'contains',
                values: [searchTerm],
              },
              {
                key: 'endpoint_hostname',
                operator: 'contains',
                values: [searchTerm],
              },
              {
                key: 'endpoint_ips',
                operator: 'contains',
                values: [searchTerm],
              },
            ],
          },
          page: 0,
          size: limit,
        }),
      });
      return response.content || [];
    } catch (error) {
      log.error(' Asset search failed:', error);
      return [];
    }
  }

  async getAsset(assetId: string): Promise<OAEVAsset | null> {
    try {
      return await this.request<OAEVAsset>(`/api/endpoints/${assetId}`);
    } catch (error) {
      log.error(' Get asset failed:', error);
      return null;
    }
  }

  async getAllAssets(): Promise<OAEVAsset[]> {
    try {
      return await this.request<OAEVAsset[]>('/api/endpoints');
    } catch (error) {
      log.error(' Get all assets failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Asset Groups
  // ============================================================================

  async searchAssetGroups(searchTerm: string, limit = 20): Promise<OAEVAssetGroup[]> {
    try {
      const response = await this.request<{ content: OAEVAssetGroup[] }>('/api/asset_groups/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroup: {
            mode: 'or',
            filters: [
              {
                key: 'asset_group_name',
                operator: 'contains',
                values: [searchTerm],
              },
            ],
          },
          page: 0,
          size: limit,
        }),
      });
      return response.content || [];
    } catch (error) {
      log.error(' Asset group search failed:', error);
      return [];
    }
  }

  async getAssetGroup(groupId: string): Promise<OAEVAssetGroup | null> {
    try {
      return await this.request<OAEVAssetGroup>(`/api/asset_groups/${groupId}`);
    } catch (error) {
      log.error(' Get asset group failed:', error);
      return null;
    }
  }

  async getAllAssetGroups(): Promise<OAEVAssetGroup[]> {
    try {
      return await this.request<OAEVAssetGroup[]>('/api/asset_groups');
    } catch (error) {
      log.error(' Get all asset groups failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Players (People/Users)
  // ============================================================================

  async searchPlayers(searchTerm: string, limit = 20): Promise<OAEVPlayer[]> {
    try {
      const response = await this.request<{ content: OAEVPlayer[] }>('/api/players/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroup: {
            mode: 'or',
            filters: [
              {
                key: 'user_email',
                operator: 'contains',
                values: [searchTerm],
              },
              {
                key: 'user_firstname',
                operator: 'contains',
                values: [searchTerm],
              },
              {
                key: 'user_lastname',
                operator: 'contains',
                values: [searchTerm],
              },
            ],
          },
          page: 0,
          size: limit,
        }),
      });
      return response.content || [];
    } catch (error) {
      log.error(' Player search failed:', error);
      return [];
    }
  }

  async getPlayer(playerId: string): Promise<OAEVPlayer | null> {
    try {
      return await this.request<OAEVPlayer>(`/api/players/${playerId}`);
    } catch (error) {
      log.error(' Get player failed:', error);
      return null;
    }
  }

  async getAllPlayers(): Promise<OAEVPlayer[]> {
    try {
      return await this.request<OAEVPlayer[]>('/api/players');
    } catch (error) {
      log.error(' Get all players failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Teams
  // ============================================================================

  async searchTeams(searchTerm: string, limit = 20): Promise<OAEVTeam[]> {
    try {
      const response = await this.request<{ content: OAEVTeam[] }>('/api/teams/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroup: {
            mode: 'or',
            filters: [
              {
                key: 'team_name',
                operator: 'contains',
                values: [searchTerm],
              },
            ],
          },
          page: 0,
          size: limit,
        }),
      });
      return response.content || [];
    } catch (error) {
      log.error(' Team search failed:', error);
      return [];
    }
  }

  async getTeam(teamId: string): Promise<OAEVTeam | null> {
    try {
      return await this.request<OAEVTeam>(`/api/teams/${teamId}`);
    } catch (error) {
      log.error(' Get team failed:', error);
      return null;
    }
  }

  async getAllTeams(): Promise<OAEVTeam[]> {
    try {
      return await this.request<OAEVTeam[]>('/api/teams');
    } catch (error) {
      log.error(' Get all teams failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Attack Patterns
  // ============================================================================

  async getAttackPattern(attackPatternId: string): Promise<OAEVAttackPattern | null> {
    try {
      return await this.request<OAEVAttackPattern>(`/api/attack_patterns/${attackPatternId}`);
    } catch (error) {
      log.error(' Get attack pattern failed:', error);
      return null;
    }
  }

  async getAllAttackPatterns(): Promise<OAEVAttackPattern[]> {
    try {
      return await this.request<OAEVAttackPattern[]>('/api/attack_patterns');
    } catch (error) {
      log.error(' Get all attack patterns failed:', error);
      return [];
    }
  }

  getAttackPatternUrl(attackPatternId: string): string {
    return `${this.baseUrl}/admin/attack_patterns/${attackPatternId}`;
  }

  // ============================================================================
  // Scenarios
  // ============================================================================

  async createScenario(input: OAEVScenarioInput): Promise<OAEVScenario> {
    return this.request<OAEVScenario>('/api/scenarios', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getScenario(scenarioId: string): Promise<OAEVScenario | null> {
    try {
      return await this.request<OAEVScenario>(`/api/scenarios/${scenarioId}`);
    } catch (error) {
      log.error(' Get scenario failed:', error);
      return null;
    }
  }

  async getAllScenarios(): Promise<OAEVScenario[]> {
    try {
      return await this.request<OAEVScenario[]>('/api/scenarios');
    } catch (error) {
      log.error(' Get all scenarios failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Unified Search (for cache building)
  // ============================================================================

  async fetchAllEntitiesForCache(): Promise<{
    assets: OAEVAsset[];
    assetGroups: OAEVAssetGroup[];
    teams: OAEVTeam[];
    players: OAEVPlayer[];
  }> {
    try {
      const [assets, assetGroups, teams, players] = await Promise.all([
        this.getAllAssets(),
        this.getAllAssetGroups(),
        this.getAllTeams(),
        this.getAllPlayers(),
      ]);
      
      return { assets, assetGroups, teams, players };
    } catch (error) {
      log.error(' Fetch all entities failed:', error);
      return { assets: [], assetGroups: [], teams: [], players: [] };
    }
  }

  // ============================================================================
  // Atomic Testing
  // ============================================================================

  /**
   * Search injector contracts with optional attack pattern filter
   */
  async searchInjectorContracts(attackPatternId?: string): Promise<any[]> {
    const filterGroup: any = {
      mode: 'and',
      filters: [],
    };
    
    if (attackPatternId) {
      filterGroup.filters.push({
        key: 'injector_contract_attack_patterns',
        operator: 'contains',
        values: [attackPatternId],
      });
    }

    const response = await this.request<{ content?: any[] }>('/api/injector_contracts/search', {
      method: 'POST',
      body: JSON.stringify({
        size: 100,
        filterGroup: filterGroup.filters.length > 0 ? filterGroup : undefined,
      }),
    });
    
    return response?.content || [];
  }

  /**
   * Get a single injector contract
   */
  async getInjectorContract(contractId: string): Promise<any> {
    return this.request(`/api/injector_contracts/${contractId}`);
  }

  /**
   * Create a DNS resolution payload for domain/hostname
   */
  async createDnsResolutionPayload(input: {
    hostname: string;
    name: string;
    platforms: string[];
    attackPatternIds?: string[];
  }): Promise<any> {
    return this.request('/api/payloads', {
      method: 'POST',
      body: JSON.stringify({
        payload_type: 'DnsResolution',
        payload_name: input.name,
        payload_source: 'MANUAL',
        payload_status: 'VERIFIED',
        payload_platforms: input.platforms,
        payload_execution_arch: 'ALL_ARCHITECTURES',
        payload_expectations: ['PREVENTION', 'DETECTION'],
        dns_resolution_hostname: input.hostname,
        payload_attack_patterns: input.attackPatternIds || [],
      }),
    });
  }

  /**
   * Get payload by ID
   */
  async getPayload(payloadId: string): Promise<any> {
    return this.request(`/api/payloads/${payloadId}`);
  }

  /**
   * Create an atomic testing
   */
  async createAtomicTesting(input: {
    title: string;
    description?: string;
    injectorContractId: string;
    content?: Record<string, any>;
    assetIds?: string[];
    assetGroupIds?: string[];
  }): Promise<any> {
    return this.request('/api/atomic-testings', {
      method: 'POST',
      body: JSON.stringify({
        inject_title: input.title,
        inject_description: input.description || '',
        inject_injector_contract: input.injectorContractId,
        inject_content: input.content || {},
        inject_assets: input.assetIds || [],
        inject_asset_groups: input.assetGroupIds || [],
        inject_teams: [],
        inject_all_teams: false,
      }),
    });
  }

  /**
   * Get atomic testing URL
   */
  getAtomicTestingUrl(atomicTestingId: string): string {
    return `${this.baseUrl}/admin/atomic/${atomicTestingId}`;
  }

  // ============================================================================
  // URL Builders
  // ============================================================================

  getAssetUrl(assetId: string): string {
    return `${this.baseUrl}/admin/assets/endpoints/${assetId}`;
  }

  getAssetGroupUrl(groupId: string): string {
    return `${this.baseUrl}/admin/assets/asset_groups/${groupId}`;
  }

  getPlayerUrl(playerId: string): string {
    return `${this.baseUrl}/admin/teams/players/${playerId}`;
  }

  getTeamUrl(teamId: string): string {
    return `${this.baseUrl}/admin/teams/teams/${teamId}`;
  }

  getScenarioUrl(scenarioId: string): string {
    return `${this.baseUrl}/admin/scenarios/${scenarioId}`;
  }

  getPlatformInfo(): { id: string; name: string; url: string } {
    return {
      id: this.platformId,
      name: this.platformName,
      url: this.baseUrl,
    };
  }
}

export default OpenAEVClient;

