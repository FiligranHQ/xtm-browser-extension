/**
 * OpenAEV API Client
 * 
 * REST API client for OpenAEV platform operations.
 */

import { loggers } from '../utils/logger';

const log = loggers.openaev;

// User-Agent for API requests
const USER_AGENT = 'xtm-browser-extension/0.0.4';

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

/**
 * OpenAEV Tag structure
 */
interface OAEVTag {
  tag_id: string;
  tag_name: string;
}

export class OpenAEVClient {
  private baseUrl: string;
  private token: string;
  private platformId: string;
  private platformName: string;
  
  /**
   * Cache of tags for resolving IDs to names
   */
  private tagsCache: Map<string, string> = new Map();

  /**
   * Cache of kill chain phases for resolving IDs to names
   * Maps phase_id -> phase_name
   */
  private killChainPhasesCache: Map<string, string> = new Map();

  /**
   * Cache of attack patterns for resolving parent technique IDs to names
   * Maps attack_pattern_id -> { name, external_id }
   */
  private attackPatternsCache: Map<string, { name: string; externalId: string }> = new Map();

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
      'User-Agent': USER_AGENT,
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
  // Tags - For resolving tag IDs to names
  // ============================================================================

  /**
   * Fetch all tags from the platform and populate the cache
   */
  async fetchAllTags(): Promise<void> {
    try {
      const response = await this.request<OAEVTag[]>('/api/tags');
      this.tagsCache.clear();
      for (const tag of response) {
        this.tagsCache.set(tag.tag_id, tag.tag_name);
      }
      log.debug(`[OpenAEV] Cached ${this.tagsCache.size} tags`);
    } catch (error) {
      log.warn('[OpenAEV] Failed to fetch tags:', error);
    }
  }

  /**
   * Resolve a list of tag IDs to tag names
   * Returns empty array if tags cache is empty
   */
  resolveTagIds(tagIds: string[] | undefined): string[] {
    if (!tagIds || tagIds.length === 0) return [];
    
    return tagIds
      .map(id => this.tagsCache.get(id) || id) // Fall back to ID if not found
      .filter(Boolean);
  }

  /**
   * Ensure tags are cached before resolving
   */
  async ensureTagsCached(): Promise<void> {
    if (this.tagsCache.size === 0) {
      await this.fetchAllTags();
    }
  }

  // ============================================================================
  // Kill Chain Phases - For resolving kill chain phase IDs to names
  // ============================================================================

  /**
   * Fetch all kill chain phases from the platform and populate the cache
   */
  async fetchAllKillChainPhases(): Promise<void> {
    try {
      const response = await this.request<Array<{
        phase_id: string;
        phase_kill_chain_name: string;
        phase_name: string;
        phase_order: number;
      }>>('/api/kill_chain_phases');
      this.killChainPhasesCache.clear();
      for (const phase of response) {
        this.killChainPhasesCache.set(phase.phase_id, phase.phase_name);
      }
      log.debug(`[OpenAEV] Cached ${this.killChainPhasesCache.size} kill chain phases`);
    } catch (error) {
      log.warn('[OpenAEV] Failed to fetch kill chain phases:', error);
    }
  }

  /**
   * Resolve a list of kill chain phase IDs to phase names
   * Returns empty array if cache is empty
   */
  resolveKillChainPhaseIds(phaseIds: string[] | undefined): string[] {
    if (!phaseIds || phaseIds.length === 0) return [];
    
    return phaseIds
      .map(id => this.killChainPhasesCache.get(id) || id) // Fall back to ID if not found
      .filter(Boolean);
  }

  /**
   * Ensure kill chain phases are cached before resolving
   */
  async ensureKillChainPhasesCached(): Promise<void> {
    if (this.killChainPhasesCache.size === 0) {
      await this.fetchAllKillChainPhases();
    }
  }

  // ============================================================================
  // Attack Patterns Cache - For resolving parent technique IDs to names
  // ============================================================================

  /**
   * Fetch all attack patterns from the platform and populate the cache
   * Used for resolving parent technique IDs to names
   */
  async fetchAllAttackPatternsForCache(): Promise<void> {
    try {
      const attackPatterns = await this.getAllAttackPatterns();
      this.attackPatternsCache.clear();
      for (const ap of attackPatterns) {
        this.attackPatternsCache.set(ap.attack_pattern_id, {
          name: ap.attack_pattern_name,
          externalId: ap.attack_pattern_external_id || '',
        });
      }
      log.debug(`[OpenAEV] Cached ${this.attackPatternsCache.size} attack patterns for parent resolution`);
    } catch (error) {
      log.warn('[OpenAEV] Failed to fetch attack patterns for cache:', error);
    }
  }

  /**
   * Resolve a single attack pattern ID to its name and external ID
   * Returns the ID if not found in cache
   */
  resolveAttackPatternId(attackPatternId: string | undefined): string | undefined {
    if (!attackPatternId) return undefined;
    
    const cached = this.attackPatternsCache.get(attackPatternId);
    if (cached) {
      // Return formatted as "Name (T1234)" if external ID exists, otherwise just name
      return cached.externalId ? `${cached.name} (${cached.externalId})` : cached.name;
    }
    return attackPatternId; // Fall back to ID if not found
  }

  /**
   * Ensure attack patterns are cached before resolving
   */
  async ensureAttackPatternsCached(): Promise<void> {
    if (this.attackPatternsCache.size === 0) {
      await this.fetchAllAttackPatternsForCache();
    }
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
    const allFindings: OAEVFinding[] = [];
    let currentPage = 0;
    let totalPages = 1;

    log.info('[OpenAEV] Starting to fetch findings...');

    try {
      while (currentPage < totalPages) {
        log.debug(`[OpenAEV] Fetching findings page ${currentPage}...`);
        
        const response = await this.request<{
          content: OAEVFinding[];
          totalPages: number;
          totalElements: number;
        }>('/api/findings/search?distinct=true', {
          method: 'POST',
          body: JSON.stringify({
            page: currentPage,
            size: 200, // Larger page size for findings
          }),
        });

        log.debug(`[OpenAEV] Findings response:`, response);

        if (response.content && Array.isArray(response.content)) {
          allFindings.push(...response.content);
          log.debug(`[OpenAEV] Added ${response.content.length} findings, total now: ${allFindings.length}`);
        } else {
          log.warn('[OpenAEV] No content in findings response or not an array');
        }
        
        totalPages = response.totalPages || 1;
        currentPage++;

        log.debug(`[OpenAEV] Fetched findings page ${currentPage}/${totalPages}: ${response.content?.length || 0} items (total: ${allFindings.length})`);
      }

      log.info(`[OpenAEV] Completed fetching Findings: ${allFindings.length} total items`);
      return allFindings;
    } catch (error) {
      log.error('[OpenAEV] Get all findings failed:', error);
      // Return whatever we collected so far
      return allFindings;
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

  /**
   * Add inject to a scenario
   */
  async addInjectToScenario(scenarioId: string, inject: {
    inject_title: string;
    inject_description?: string;
    inject_injector_contract: string;
    inject_content?: Record<string, any>;
    inject_depends_duration?: number; // Relative time from scenario start in seconds
    inject_teams?: string[];
    inject_assets?: string[];
    inject_asset_groups?: string[];
  }): Promise<any> {
    log.debug(` Adding inject to scenario ${scenarioId}:`, inject);
    const result = await this.request<any>(`/api/scenarios/${scenarioId}/injects`, {
      method: 'POST',
      body: JSON.stringify(inject),
    });
    log.debug(` Inject added:`, result);
    return result;
  }

  /**
   * Get all kill chain phases
   */
  async getKillChainPhases(): Promise<Array<{
    phase_id: string;
    phase_kill_chain_name: string;
    phase_name: string;
    phase_order: number;
  }>> {
    try {
      const response = await this.request<any[]>('/api/kill_chain_phases');
      return response || [];
    } catch (error) {
      log.error(' Get kill chain phases failed:', error);
      return [];
    }
  }

  /**
   * Search injector contracts by kill chain phase
   */
  async searchInjectorContractsByKillChainPhase(killChainPhase: string): Promise<any[]> {
    const filterGroup = {
      mode: 'and',
      filters: [
        {
          key: 'injector_contract_kill_chain_phases',
          operator: 'contains',
          values: [killChainPhase],
        },
      ],
    };

    const response = await this.request<{ content?: any[] }>('/api/injector_contracts/search', {
      method: 'POST',
      body: JSON.stringify({
        size: 100,
        filterGroup,
      }),
    });
    
    return response?.content || [];
  }

  /**
   * Get injector contracts for multiple attack patterns
   * Returns a map of attack pattern ID to available contracts
   */
  async getInjectorContractsForAttackPatterns(attackPatternIds: string[]): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();
    
    // Fetch contracts for each attack pattern in parallel
    const promises = attackPatternIds.map(async (apId) => {
      const contracts = await this.searchInjectorContracts(apId);
      return { apId, contracts };
    });
    
    const results = await Promise.all(promises);
    for (const { apId, contracts } of results) {
      result.set(apId, contracts);
    }
    
    return result;
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
   * Get ALL injector contracts with full pagination support
   * This ensures we fetch all contracts even when there are more than 500
   */
  async getAllInjectorContracts(): Promise<any[]> {
    const allContracts: any[] = [];
    let currentPage = 0;
    let totalPages = 1;
    let pageCount = 0;

    log.info('[OpenAEV] Starting to fetch all injector contracts with pagination...');

    while (currentPage < totalPages) {
      const response = await this.request<PaginatedResponse<any>>('/api/injector_contracts/search', {
        method: 'POST',
        body: JSON.stringify({
          page: currentPage,
          size: OpenAEVClient.DEFAULT_PAGE_SIZE,
        }),
      });

      allContracts.push(...response.content);
      totalPages = response.totalPages;
      currentPage++;
      pageCount++;

      log.debug(`[OpenAEV] Fetched injector contracts page ${pageCount}/${totalPages}: ${response.content.length} items (total: ${allContracts.length})`);
    }

    log.info(`[OpenAEV] Completed fetching injector contracts: ${allContracts.length} total items in ${pageCount} pages`);
    return allContracts;
  }

  /**
   * Search injector contracts with optional attack pattern filter
   * If attackPatternId is provided, fetches all contracts and filters client-side
   * Note: injector_contract_attack_patterns is a List<String> of attack pattern UUIDs
   */
  async searchInjectorContracts(attackPatternId?: string): Promise<any[]> {
    // Fetch ALL contracts using pagination
    const allContracts = await this.getAllInjectorContracts();
    log.debug('[OpenAEV] searchInjectorContracts - total contracts fetched:', allContracts.length);
    
    // If no attack pattern filter, return all
    if (!attackPatternId) {
      return allContracts;
    }
    
    // Filter client-side by attack pattern ID
    // NOTE: injector_contract_attack_patterns is a List<String> of UUIDs, NOT objects!
    const filteredContracts = allContracts.filter((contract: any) => {
      const attackPatternIds = contract.injector_contract_attack_patterns || [];
      // Each item in the array is a UUID string, not an object
      return attackPatternIds.includes(attackPatternId);
    });
    
    log.debug('[OpenAEV] searchInjectorContracts - filtered for attackPatternId:', attackPatternId, '- found:', filteredContracts.length);
    
    // Debug logging when no matches found
    if (filteredContracts.length === 0 && allContracts.length > 0) {
      log.debug('[OpenAEV] No matches found. Sample contract attack patterns:', 
        allContracts.slice(0, 3).map((c: any) => ({
          label: c.injector_contract_labels?.en,
          attackPatterns: c.injector_contract_attack_patterns,
        }))
      );
    }
    
    return filteredContracts;
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
   * Create a generic payload (Command, Executable, FileDrop, DnsResolution, NetworkTraffic)
   */
  async createPayload(payload: {
    payload_type: 'Command' | 'Executable' | 'FileDrop' | 'DnsResolution' | 'NetworkTraffic';
    payload_name: string;
    payload_description?: string;
    payload_platforms: string[];
    payload_source?: string;
    payload_status?: string;
    payload_execution_arch?: string;
    payload_expectations?: string[];
    payload_attack_patterns?: string[];
    // Command-specific
    command_executor?: string;
    command_content?: string;
    // Cleanup
    payload_cleanup_executor?: string | null;
    payload_cleanup_command?: string | null;
    // DNS Resolution-specific
    dns_resolution_hostname?: string;
  }): Promise<any> {
    const body: Record<string, any> = {
      payload_type: payload.payload_type,
      payload_name: payload.payload_name,
      payload_description: payload.payload_description || '',
      payload_platforms: payload.payload_platforms,
      payload_source: payload.payload_source || 'MANUAL',
      payload_status: payload.payload_status || 'VERIFIED',
      payload_execution_arch: payload.payload_execution_arch || 'ALL_ARCHITECTURES',
      payload_expectations: payload.payload_expectations || ['PREVENTION', 'DETECTION'],
      payload_attack_patterns: payload.payload_attack_patterns || [],
    };

    // Add type-specific fields
    if (payload.payload_type === 'Command') {
      body.command_executor = payload.command_executor;
      body.command_content = payload.command_content;
    }
    if (payload.payload_type === 'DnsResolution') {
      body.dns_resolution_hostname = payload.dns_resolution_hostname;
    }

    // Add cleanup if provided
    if (payload.payload_cleanup_executor) {
      body.payload_cleanup_executor = payload.payload_cleanup_executor;
    }
    if (payload.payload_cleanup_command) {
      body.payload_cleanup_command = payload.payload_cleanup_command;
    }

    return this.request('/api/payloads', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get payload by ID
   */
  async getPayload(payloadId: string): Promise<any> {
    return this.request(`/api/payloads/${payloadId}`);
  }

  /**
   * Search for existing DNS resolution payload by hostname
   * Returns the payload if found, null otherwise
   */
  async findDnsResolutionPayloadByHostname(hostname: string): Promise<any | null> {
    log.debug('[OpenAEV] Searching for DNS resolution payload with hostname:', hostname);
    
    try {
      const response = await this.request<PaginatedResponse<any>>('/api/payloads/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroup: {
            mode: 'and',
            filters: [
              {
                key: 'payload_type',
                mode: 'or',
                operator: 'eq',
                values: ['DnsResolution'],
              },
              {
                key: 'dns_resolution_hostname',
                mode: 'or',
                operator: 'eq',
                values: [hostname],
              },
            ],
          },
          page: 0,
          size: 10,
        }),
      });
      
      if (response.content && response.content.length > 0) {
        const payload = response.content[0];
        log.debug('[OpenAEV] Found existing DNS resolution payload:', payload.payload_id, '->', payload.payload_name);
        return payload;
      }
      
      log.debug('[OpenAEV] No existing DNS resolution payload found for hostname:', hostname);
      return null;
    } catch (error) {
      log.error('[OpenAEV] Error searching for DNS resolution payload:', error);
      return null;
    }
  }

  /**
   * Find injector contract by payload ID
   * When a payload is created, an injector contract is automatically created for it.
   * This method finds that injector contract using the search API with filters.
   */
  async findInjectorContractByPayloadId(payloadId: string): Promise<any | null> {
    log.debug('[OpenAEV] Searching for injector contract with payload ID:', payloadId);
    
    try {
      // Use the search API with proper filter structure
      const response = await this.request<PaginatedResponse<any>>('/api/injector_contracts/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroup: {
            mode: 'and',
            filters: [
              {
                key: 'injector_contract_payload',
                mode: 'or',
                operator: 'eq',
                values: [payloadId],
              },
            ],
          },
          page: 0,
          size: 10,
        }),
      });
      
      if (response.content && response.content.length > 0) {
        const contract = response.content[0];
        log.debug('[OpenAEV] Found injector contract for payload:', payloadId, '->', contract.injector_contract_id);
        return contract;
      }
      
      log.debug('[OpenAEV] No injector contract found for payload via search:', payloadId);
      
      // Fallback: fetch all contracts and filter locally (slower but more reliable)
      log.debug('[OpenAEV] Fallback: Searching all contracts locally...');
      const allContracts = await this.getAllInjectorContracts();
      
      const matchingContract = allContracts.find((contract: any) => {
        // The injector contract has a payload reference
        const contractPayloadId = contract.injector_contract_payload?.payload_id || 
                                  contract.injector_contract_payload;
        return contractPayloadId === payloadId;
      });
      
      if (matchingContract) {
        log.debug('[OpenAEV] Found injector contract via fallback:', payloadId, '->', matchingContract.injector_contract_id);
        return matchingContract;
      }
      
      log.debug('[OpenAEV] No injector contract found for payload:', payloadId);
      return null;
    } catch (error) {
      log.error('[OpenAEV] Error searching for injector contract:', error);
      return null;
    }
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
    return `${this.baseUrl}/admin/atomic_testings/${atomicTestingId}`;
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

  /**
   * Get Organization by ID
   */
  async getOrganization(organizationId: string): Promise<any | null> {
    try {
      return await this.request(`/api/organizations/${organizationId}`);
    } catch (error) {
      log.error(' Get organization failed:', error);
      return null;
    }
  }

  /**
   * Get Exercise by ID
   */
  async getExercise(exerciseId: string): Promise<any | null> {
    try {
      return await this.request(`/api/exercises/${exerciseId}`);
    } catch (error) {
      log.error(' Get exercise failed:', error);
      return null;
    }
  }

  /**
   * Get any entity by ID and type
   * This is a unified getter that dispatches to the appropriate method
   */
  async getEntityById(entityId: string, entityType: string): Promise<any | null> {
    // Normalize the type - remove 'oaev-' prefix if present
    const normalizedType = entityType.replace('oaev-', '');
    
    switch (normalizedType) {
      case 'Asset':
        return this.getAsset(entityId);
      case 'AssetGroup':
        return this.getAssetGroup(entityId);
      case 'Player':
      case 'User':
        return this.getPlayer(entityId);
      case 'Team':
        return this.getTeam(entityId);
      case 'Organization':
        return this.getOrganization(entityId);
      case 'Scenario':
        return this.getScenario(entityId);
      case 'Exercise':
        return this.getExercise(entityId);
      case 'AttackPattern':
        return this.getAttackPattern(entityId);
      case 'Finding':
        return this.getFinding(entityId);
      default:
        log.warn(`Unknown entity type: ${normalizedType}`);
        return null;
    }
  }
}

export default OpenAEVClient;

