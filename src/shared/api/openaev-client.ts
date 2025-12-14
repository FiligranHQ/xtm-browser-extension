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
  OAEVFinding,
  OAEVScenario,
  OAEVScenarioInput,
} from '../types';

/**
 * Spring Boot paginated response format
 */
interface PaginatedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export class OpenAEVClient {
  private baseUrl: string;
  private token: string;
  private platformId: string;
  private platformName: string;

  /**
   * Default page size for pagination
   */
  private static readonly DEFAULT_PAGE_SIZE = 500;

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

  /**
   * Generic paginated search method that iterates through all pages
   * Used for building complete cache data
   */
  private async fetchAllWithPagination<T>(
    searchEndpoint: string,
    entityType: string,
    pageSize: number = OpenAEVClient.DEFAULT_PAGE_SIZE
  ): Promise<T[]> {
    const allResults: T[] = [];
    let currentPage = 0;
    let totalPages = 1;
    let pageCount = 0;

    while (currentPage < totalPages) {
      const response = await this.request<PaginatedResponse<T>>(searchEndpoint, {
        method: 'POST',
        body: JSON.stringify({
          page: currentPage,
          size: pageSize,
        }),
      });

      allResults.push(...response.content);
      totalPages = response.totalPages;
      currentPage++;
      pageCount++;

      log.debug(`[OpenAEV] Fetched page ${pageCount}/${totalPages} for ${entityType}: ${response.content.length} items (total: ${allResults.length})`);
    }

    log.info(`[OpenAEV] Completed fetching ${entityType}: ${allResults.length} total items in ${pageCount} pages`);
    return allResults;
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

  /**
   * Get all assets with full pagination support
   * Uses the search endpoint to iterate through all pages
   */
  async getAllAssets(): Promise<OAEVAsset[]> {
    try {
      return await this.fetchAllWithPagination<OAEVAsset>('/api/endpoints/search', 'Assets');
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

  /**
   * Get all asset groups with full pagination support
   * Uses the search endpoint to iterate through all pages
   */
  async getAllAssetGroups(): Promise<OAEVAssetGroup[]> {
    try {
      return await this.fetchAllWithPagination<OAEVAssetGroup>('/api/asset_groups/search', 'AssetGroups');
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

  /**
   * Get all players with full pagination support
   * Uses the search endpoint to iterate through all pages
   */
  async getAllPlayers(): Promise<OAEVPlayer[]> {
    try {
      return await this.fetchAllWithPagination<OAEVPlayer>('/api/players/search', 'Players');
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

  /**
   * Get all teams with full pagination support
   * Uses the search endpoint to iterate through all pages
   */
  async getAllTeams(): Promise<OAEVTeam[]> {
    try {
      return await this.fetchAllWithPagination<OAEVTeam>('/api/teams/search', 'Teams');
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

  /**
   * Get all attack patterns with full pagination support
   * Uses the search endpoint to iterate through all pages
   */
  async getAllAttackPatterns(): Promise<OAEVAttackPattern[]> {
    try {
      return await this.fetchAllWithPagination<OAEVAttackPattern>('/api/attack_patterns/search', 'AttackPatterns');
    } catch (error) {
      log.error(' Get all attack patterns failed:', error);
      return [];
    }
  }

  getAttackPatternUrl(attackPatternId: string): string {
    return `${this.baseUrl}/admin/attack_patterns/${attackPatternId}`;
  }

  // ============================================================================
  // Findings
  // ============================================================================

  async getFinding(findingId: string): Promise<OAEVFinding | null> {
    try {
      return await this.request<OAEVFinding>(`/api/findings/${findingId}`);
    } catch (error) {
      log.error(' Get finding failed:', error);
      return null;
    }
  }

  /**
   * Get all findings with full pagination support (distinct by finding_value)
   * Uses the search endpoint with distinct=true to get unique findings
   */
  async getAllFindings(): Promise<OAEVFinding[]> {
    try {
      return await this.fetchAllWithPagination<OAEVFinding>('/api/findings/search?distinct=true', 'Findings');
    } catch (error) {
      log.error(' Get all findings failed:', error);
      return [];
    }
  }

  getFindingUrl(findingId: string): string {
    return `${this.baseUrl}/admin/findings/${findingId}`;
  }

  // ============================================================================
  // Full Text Search
  // ============================================================================

  /**
   * Full text search across all OpenAEV entities
   * Returns counts for each entity type
   */
  async fullTextSearch(searchTerm: string): Promise<Record<string, { count: number }>> {
    try {
      return await this.request<Record<string, { count: number }>>('/api/fulltextsearch', {
        method: 'POST',
        body: JSON.stringify({ searchTerm }),
      });
    } catch (error) {
      log.error(' Full text search failed:', error);
      return {};
    }
  }

  /**
   * Full text search for a specific entity class
   * Returns paginated results
   */
  async fullTextSearchByClass(
    className: string,
    searchPaginationInput: { textSearch?: string; page?: number; size?: number }
  ): Promise<{ content: any[]; totalElements: number; totalPages: number }> {
    try {
      return await this.request<{ content: any[]; totalElements: number; totalPages: number }>(
        `/api/fulltextsearch/${className}`,
        {
          method: 'POST',
          body: JSON.stringify(searchPaginationInput),
        }
      );
    } catch (error) {
      log.error(` Full text search for ${className} failed:`, error);
      return { content: [], totalElements: 0, totalPages: 0 };
    }
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

  /**
   * Get all scenarios with full pagination support
   * Uses the search endpoint to iterate through all pages
   */
  async getAllScenarios(): Promise<OAEVScenario[]> {
    try {
      return await this.fetchAllWithPagination<OAEVScenario>('/api/scenarios/search', 'Scenarios');
    } catch (error) {
      log.error(' Get all scenarios failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Unified Search (for cache building)
  // ============================================================================

  /**
   * Fetch all entities for cache building with full pagination support
   * Ensures no entities are missed regardless of the total count
   */
  async fetchAllEntitiesForCache(): Promise<{
    assets: OAEVAsset[];
    assetGroups: OAEVAssetGroup[];
    teams: OAEVTeam[];
    players: OAEVPlayer[];
  }> {
    try {
      log.info('[OpenAEV] Starting full cache fetch with pagination...');
      
      const [assets, assetGroups, teams, players] = await Promise.all([
        this.getAllAssets(),
        this.getAllAssetGroups(),
        this.getAllTeams(),
        this.getAllPlayers(),
      ]);
      
      log.info(`[OpenAEV] Cache fetch complete: ${assets.length} assets, ${assetGroups.length} asset groups, ${teams.length} teams, ${players.length} players`);
      
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

  getExerciseUrl(exerciseId: string): string {
    return `${this.baseUrl}/admin/simulations/${exerciseId}`;
  }

  getOrganizationUrl(organizationId: string): string {
    return `${this.baseUrl}/admin/teams/organizations/${organizationId}`;
  }

  getAttackPatternUrl(attackPatternId: string): string {
    return `${this.baseUrl}/admin/attack_patterns/${attackPatternId}`;
  }

  getFindingUrl(findingId: string): string {
    return `${this.baseUrl}/admin/findings/${findingId}`;
  }

  /**
   * Get URL for any entity type
   */
  getEntityUrl(entityClass: string, entityId: string): string {
    switch (entityClass) {
      case 'Asset':
        return this.getAssetUrl(entityId);
      case 'AssetGroup':
        return this.getAssetGroupUrl(entityId);
      case 'User':
      case 'Player':
        return this.getPlayerUrl(entityId);
      case 'Team':
        return this.getTeamUrl(entityId);
      case 'Organization':
        return this.getOrganizationUrl(entityId);
      case 'Scenario':
        return this.getScenarioUrl(entityId);
      case 'Exercise':
        return this.getExerciseUrl(entityId);
      case 'AttackPattern':
        return this.getAttackPatternUrl(entityId);
      case 'Finding':
        return this.getFindingUrl(entityId);
      default:
        return this.baseUrl;
    }
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

