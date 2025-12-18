/**
 * OpenAEV API Client
 *
 * REST API client for OpenAEV platform operations.
 */

import { loggers } from '../utils/logger';
import {
  buildAssetSearchFilter,
  buildAssetGroupSearchFilter,
  buildPlayerSearchFilter,
  buildTeamSearchFilter,
  buildDnsResolutionPayloadFilter,
  buildPayloadByIdFilter,
  buildKillChainPhaseFilter,
  buildSearchBody,
  buildPaginatedBody,
  buildPayloadBody,
  buildDnsResolutionPayloadBody,
  buildAtomicTestingBody,
  ENTITY_TYPE_PATH_MAP,
  type PayloadInput,
  type AtomicTestingInput,
  type InjectInput,
} from './openaev/filters';

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

const log = loggers.openaev;

// User-Agent for API requests
const USER_AGENT = 'xtm-browser-extension/0.0.5';
const DEFAULT_PAGE_SIZE = 500;

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

  // Caches
  private tagsCache: Map<string, string> = new Map();
  private killChainPhasesCache: Map<string, string> = new Map();
  private attackPatternsCache: Map<string, { name: string; externalId: string }> = new Map();

  constructor(config: PlatformConfig) {
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.token = config.apiToken;
    this.platformId = config.id;
    this.platformName = config.name;
  }

  // ============================================================================
  // Core Request Method
  // ============================================================================

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'User-Agent': USER_AGENT,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAEV API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ============================================================================
  // Pagination Helper
  // ============================================================================

  private async fetchAllWithPagination<T>(
    searchEndpoint: string,
    entityType: string,
    pageSize: number = DEFAULT_PAGE_SIZE
  ): Promise<T[]> {
    const allResults: T[] = [];
    let currentPage = 0;
    let totalPages = 1;
    let pageCount = 0;

    while (currentPage < totalPages) {
      const response = await this.request<PaginatedResponse<T>>(searchEndpoint, {
        method: 'POST',
        body: JSON.stringify(buildPaginatedBody(currentPage, pageSize)),
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
  // Cache Management - Tags
  // ============================================================================

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

  resolveTagIds(tagIds: string[] | undefined): string[] {
    if (!tagIds || tagIds.length === 0) return [];
    return tagIds.map(id => this.tagsCache.get(id) || id).filter(Boolean);
  }

  async ensureTagsCached(): Promise<void> {
    if (this.tagsCache.size === 0) await this.fetchAllTags();
  }

  // ============================================================================
  // Cache Management - Kill Chain Phases
  // ============================================================================

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

  resolveKillChainPhaseIds(phaseIds: string[] | undefined): string[] {
    if (!phaseIds || phaseIds.length === 0) return [];
    return phaseIds.map(id => this.killChainPhasesCache.get(id) || id).filter(Boolean);
  }

  async ensureKillChainPhasesCached(): Promise<void> {
    if (this.killChainPhasesCache.size === 0) await this.fetchAllKillChainPhases();
  }

  // ============================================================================
  // Cache Management - Attack Patterns
  // ============================================================================

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

  resolveAttackPatternId(attackPatternId: string | undefined): string | undefined {
    if (!attackPatternId) return undefined;
    const cached = this.attackPatternsCache.get(attackPatternId);
    if (cached) {
      return cached.externalId ? `${cached.name} (${cached.externalId})` : cached.name;
    }
    return attackPatternId;
  }

  async ensureAttackPatternsCached(): Promise<void> {
    if (this.attackPatternsCache.size === 0) await this.fetchAllAttackPatternsForCache();
  }

  // ============================================================================
  // Authentication & Platform Info
  // ============================================================================

  async testConnection(): Promise<{
    success: boolean;
    user?: OAEVPlayer;
    platform_name?: string;
    version?: string;
    enterprise_edition?: boolean;
  }> {
    try {
      const [user, settings] = await Promise.all([
        this.request<OAEVPlayer>('/api/me'),
        this.fetchPlatformSettings().catch(() => null),
      ]);
      return {
        success: true,
        user,
        platform_name: settings?.platform_name,
        version: settings?.platform_version,
        enterprise_edition: settings?.platform_license?.license_is_enterprise ?? false,
      };
    } catch (error) {
      log.error('Connection test failed:', error);
      return { success: false };
    }
  }

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
      return await this.request('/api/settings');
    } catch (error) {
      log.error('Get platform settings failed:', error);
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
        body: JSON.stringify(buildSearchBody({ page: 0, size: limit, filterGroup: buildAssetSearchFilter(searchTerm) })),
      });
      return response.content || [];
    } catch (error) {
      log.error('Asset search failed:', error);
      return [];
    }
  }

  async getAsset(assetId: string): Promise<OAEVAsset | null> {
    try {
      return await this.request<OAEVAsset>(`/api/endpoints/${assetId}`);
    } catch (error) {
      log.error('Get asset failed:', error);
      return null;
    }
  }

  async getAllAssets(): Promise<OAEVAsset[]> {
    try {
      return await this.fetchAllWithPagination<OAEVAsset>('/api/endpoints/search', 'Assets');
    } catch (error) {
      log.error('Get all assets failed:', error);
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
        body: JSON.stringify(buildSearchBody({ page: 0, size: limit, filterGroup: buildAssetGroupSearchFilter(searchTerm) })),
      });
      return response.content || [];
    } catch (error) {
      log.error('Asset group search failed:', error);
      return [];
    }
  }

  async getAssetGroup(groupId: string): Promise<OAEVAssetGroup | null> {
    try {
      return await this.request<OAEVAssetGroup>(`/api/asset_groups/${groupId}`);
    } catch (error) {
      log.error('Get asset group failed:', error);
      return null;
    }
  }

  async getAllAssetGroups(): Promise<OAEVAssetGroup[]> {
    try {
      return await this.fetchAllWithPagination<OAEVAssetGroup>('/api/asset_groups/search', 'AssetGroups');
    } catch (error) {
      log.error('Get all asset groups failed:', error);
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
        body: JSON.stringify(buildSearchBody({ page: 0, size: limit, filterGroup: buildPlayerSearchFilter(searchTerm) })),
      });
      return response.content || [];
    } catch (error) {
      log.error('Player search failed:', error);
      return [];
    }
  }

  async getPlayer(playerId: string): Promise<OAEVPlayer | null> {
    try {
      const users = await this.request<OAEVPlayer[]>('/api/users/find', {
        method: 'POST',
        body: JSON.stringify([playerId]),
      });
      return users && users.length > 0 ? users[0] : null;
    } catch (error) {
      log.error('Get player failed:', error);
      return null;
    }
  }

  async getAllPlayers(): Promise<OAEVPlayer[]> {
    try {
      return await this.fetchAllWithPagination<OAEVPlayer>('/api/players/search', 'Players');
    } catch (error) {
      log.error('Get all players failed:', error);
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
        body: JSON.stringify(buildSearchBody({ page: 0, size: limit, filterGroup: buildTeamSearchFilter(searchTerm) })),
      });
      return response.content || [];
    } catch (error) {
      log.error('Team search failed:', error);
      return [];
    }
  }

  async getTeam(teamId: string): Promise<OAEVTeam | null> {
    try {
      return await this.request<OAEVTeam>(`/api/teams/${teamId}`);
    } catch (error) {
      log.error('Get team failed:', error);
      return null;
    }
  }

  async getAllTeams(): Promise<OAEVTeam[]> {
    try {
      return await this.fetchAllWithPagination<OAEVTeam>('/api/teams/search', 'Teams');
    } catch (error) {
      log.error('Get all teams failed:', error);
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
      log.error('Get attack pattern failed:', error);
      return null;
    }
  }

  async getAllAttackPatterns(): Promise<OAEVAttackPattern[]> {
    try {
      return await this.fetchAllWithPagination<OAEVAttackPattern>('/api/attack_patterns/search', 'AttackPatterns');
    } catch (error) {
      log.error('Get all attack patterns failed:', error);
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
      log.error('Get finding failed:', error);
      return null;
    }
  }

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
          body: JSON.stringify(buildPaginatedBody(currentPage, 200)),
        });

        if (response.content && Array.isArray(response.content)) {
          allFindings.push(...response.content);
          log.debug(`[OpenAEV] Added ${response.content.length} findings, total now: ${allFindings.length}`);
        }

        totalPages = response.totalPages || 1;
        currentPage++;
      }

      log.info(`[OpenAEV] Completed fetching Findings: ${allFindings.length} total items`);
      return allFindings;
    } catch (error) {
      log.error('[OpenAEV] Get all findings failed:', error);
      return allFindings;
    }
  }

  getFindingUrl(findingId: string): string {
    return `${this.baseUrl}/admin/findings/${findingId}`;
  }

  // ============================================================================
  // Vulnerabilities (CVE)
  // ============================================================================

  /**
   * Get a vulnerability by its external ID (CVE ID)
   * Uses the /api/vulnerabilities/external-id/{externalId} endpoint
   */
  async getVulnerabilityByExternalId(cveId: string): Promise<{
    vulnerability_id: string;
    vulnerability_external_id: string;
    vulnerability_cvss_v31?: number;
    vulnerability_published?: string;
    vulnerability_description?: string;
    vulnerability_vuln_status?: string;
    vulnerability_cisa_vulnerability_name?: string;
    vulnerability_remediation?: string;
    vulnerability_reference_urls?: string[];
  } | null> {
    try {
      log.info(`[OpenAEV] Searching for vulnerability by external ID: ${cveId}`);
      const endpoint = `/api/vulnerabilities/external-id/${encodeURIComponent(cveId)}`;
      log.debug(`[OpenAEV] Calling endpoint: ${endpoint}`);
      
      const result = await this.request<{
        vulnerability_id: string;
        vulnerability_external_id: string;
        vulnerability_cvss_v31?: number;
        vulnerability_published?: string;
        vulnerability_description?: string;
        vulnerability_vuln_status?: string;
        vulnerability_cisa_vulnerability_name?: string;
        vulnerability_remediation?: string;
        vulnerability_reference_urls?: string[];
      }>(endpoint);
      
      if (result && result.vulnerability_id) {
        log.info(`[OpenAEV] Found vulnerability ${cveId}: id=${result.vulnerability_id}`);
        return result;
      }
      log.debug(`[OpenAEV] Vulnerability ${cveId} - empty result`);
      return null;
    } catch (error) {
      // Not found (404) is expected - not all CVEs will be in OpenAEV
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
        log.debug(`[OpenAEV] Vulnerability ${cveId} not found in OpenAEV (404)`);
      } else {
        log.warn(`[OpenAEV] Error searching vulnerability ${cveId}: ${errorMsg}`);
      }
      return null;
    }
  }

  /**
   * Get a vulnerability by its internal ID
   */
  async getVulnerability(vulnerabilityId: string): Promise<{
    vulnerability_id: string;
    vulnerability_external_id: string;
    vulnerability_cvss_v31?: number;
    vulnerability_published?: string;
    vulnerability_description?: string;
    vulnerability_vuln_status?: string;
    vulnerability_cisa_vulnerability_name?: string;
    vulnerability_remediation?: string;
    vulnerability_reference_urls?: string[];
  } | null> {
    try {
      return await this.request(`/api/vulnerabilities/${vulnerabilityId}`);
    } catch (error) {
      log.error('Get vulnerability failed:', error);
      return null;
    }
  }

  getVulnerabilityUrl(vulnerabilityId: string): string {
    return `${this.baseUrl}/admin/vulnerabilities/${vulnerabilityId}`;
  }

  // ============================================================================
  // Full Text Search
  // ============================================================================

  async fullTextSearch(searchTerm: string): Promise<Record<string, { count: number }>> {
    try {
      return await this.request<Record<string, { count: number }>>('/api/fulltextsearch', {
        method: 'POST',
        body: JSON.stringify({ searchTerm }),
      });
    } catch (error) {
      log.error('Full text search failed:', error);
      return {};
    }
  }

  async fullTextSearchByClass(
    className: string,
    searchPaginationInput: { textSearch?: string; page?: number; size?: number }
  ): Promise<{ content: any[]; totalElements: number; totalPages: number }> {
    try {
      return await this.request(`/api/fulltextsearch/${className}`, {
        method: 'POST',
        body: JSON.stringify(searchPaginationInput),
      });
    } catch (error) {
      log.error(`Full text search for ${className} failed:`, error);
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
      log.error('Get scenario failed:', error);
      return null;
    }
  }

  async getAllScenarios(): Promise<OAEVScenario[]> {
    try {
      return await this.fetchAllWithPagination<OAEVScenario>('/api/scenarios/search', 'Scenarios');
    } catch (error) {
      log.error('Get all scenarios failed:', error);
      return [];
    }
  }

  async addInjectToScenario(scenarioId: string, inject: InjectInput): Promise<any> {
    log.debug(`Adding inject to scenario ${scenarioId}:`, inject);
    const result = await this.request(`/api/scenarios/${scenarioId}/injects`, {
      method: 'POST',
      body: JSON.stringify(inject),
    });
    log.debug('Inject added:', result);
    return result;
  }

  async getKillChainPhases(): Promise<Array<{
    phase_id: string;
    phase_kill_chain_name: string;
    phase_name: string;
    phase_order: number;
  }>> {
    try {
      return await this.request('/api/kill_chain_phases') || [];
    } catch (error) {
      log.error('Get kill chain phases failed:', error);
      return [];
    }
  }

  async searchInjectorContractsByKillChainPhase(killChainPhase: string): Promise<any[]> {
    const response = await this.request<{ content?: any[] }>('/api/injector_contracts/search', {
      method: 'POST',
      body: JSON.stringify(buildSearchBody({ size: 100, filterGroup: buildKillChainPhaseFilter(killChainPhase) })),
    });
    return response?.content || [];
  }

  async getInjectorContractsForAttackPatterns(attackPatternIds: string[]): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();
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
      log.error('Fetch all entities failed:', error);
      return { assets: [], assetGroups: [], teams: [], players: [] };
    }
  }

  // ============================================================================
  // Atomic Testing & Injector Contracts
  // ============================================================================

  async getAllInjectorContracts(): Promise<any[]> {
    const allContracts: any[] = [];
    let currentPage = 0;
    let totalPages = 1;
    let pageCount = 0;

    log.info('[OpenAEV] Starting to fetch all injector contracts with pagination...');

    while (currentPage < totalPages) {
      const response = await this.request<PaginatedResponse<any>>('/api/injector_contracts/search', {
        method: 'POST',
        body: JSON.stringify(buildPaginatedBody(currentPage, DEFAULT_PAGE_SIZE)),
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

  async searchInjectorContracts(attackPatternId?: string): Promise<any[]> {
    const allContracts = await this.getAllInjectorContracts();
    log.debug('[OpenAEV] searchInjectorContracts - total contracts fetched:', allContracts.length);

    if (!attackPatternId) return allContracts;

    // Filter client-side by attack pattern ID
    const filteredContracts = allContracts.filter((contract: any) => {
      const attackPatternIds = contract.injector_contract_attack_patterns || [];
      return attackPatternIds.includes(attackPatternId);
    });

    log.debug('[OpenAEV] searchInjectorContracts - filtered for attackPatternId:', attackPatternId, '- found:', filteredContracts.length);

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

  async getInjectorContract(contractId: string): Promise<any> {
    return this.request(`/api/injector_contracts/${contractId}`);
  }

  async createDnsResolutionPayload(input: {
    hostname: string;
    name: string;
    platforms: string[];
    attackPatternIds?: string[];
  }): Promise<any> {
    return this.request('/api/payloads', {
      method: 'POST',
      body: JSON.stringify(buildDnsResolutionPayloadBody(input)),
    });
  }

  async createPayload(payload: PayloadInput): Promise<any> {
    return this.request('/api/payloads', {
      method: 'POST',
      body: JSON.stringify(buildPayloadBody(payload)),
    });
  }

  async getPayload(payloadId: string): Promise<any> {
    return this.request(`/api/payloads/${payloadId}`);
  }

  async findDnsResolutionPayloadByHostname(hostname: string): Promise<any | null> {
    log.debug('[OpenAEV] Searching for DNS resolution payload with hostname:', hostname);

    try {
      const response = await this.request<PaginatedResponse<any>>('/api/payloads/search', {
        method: 'POST',
        body: JSON.stringify(buildSearchBody({ page: 0, size: 10, filterGroup: buildDnsResolutionPayloadFilter(hostname) })),
      });

      if (response.content && response.content.length > 0) {
        const payload = response.content[0];
        log.debug('[OpenAEV] Found existing DNS resolution payload:', payload.payload_id, '->', payload.payload_name);
        return response.content[0];
      }

      log.debug('[OpenAEV] No existing DNS resolution payload found for hostname:', hostname);
      return null;
    } catch (error) {
      log.error('[OpenAEV] Error searching for DNS resolution payload:', error);
      return null;
    }
  }

  async findInjectorContractByPayloadId(payloadId: string): Promise<any | null> {
    log.debug('[OpenAEV] Searching for injector contract with payload ID:', payloadId);

    try {
      const response = await this.request<PaginatedResponse<any>>('/api/injector_contracts/search', {
        method: 'POST',
        body: JSON.stringify(buildSearchBody({ page: 0, size: 10, filterGroup: buildPayloadByIdFilter(payloadId) })),
      });

      if (response.content && response.content.length > 0) {
        const contract = response.content[0];
        log.debug('[OpenAEV] Found injector contract for payload:', payloadId, '->', contract.injector_contract_id);
        return response.content[0];
      }

      log.debug('[OpenAEV] No injector contract found for payload via search:', payloadId);

      // Fallback: fetch all contracts and filter locally
      log.debug('[OpenAEV] Fallback: Searching all contracts locally...');
      const allContracts = await this.getAllInjectorContracts();

      const matchingContract = allContracts.find((contract: any) => {
        const contractPayloadId = typeof contract.injector_contract_payload === 'object'
          ? contract.injector_contract_payload?.payload_id
          : contract.injector_contract_payload;
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

  async createAtomicTesting(input: AtomicTestingInput): Promise<any> {
    return this.request('/api/atomic-testings', {
      method: 'POST',
      body: JSON.stringify(buildAtomicTestingBody(input)),
    });
  }

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

  getEntityUrl(entityClass: string, entityId: string): string {
    const path = ENTITY_TYPE_PATH_MAP[entityClass];
    return path ? `${this.baseUrl}/${path}/${entityId}` : this.baseUrl;
  }

  getPlatformInfo(): { id: string; name: string; url: string } {
    return { id: this.platformId, name: this.platformName, url: this.baseUrl };
  }

  // ============================================================================
  // Entity Getters
  // ============================================================================

  async getOrganization(organizationId: string): Promise<any | null> {
    try {
      return await this.request(`/api/organizations/${organizationId}`);
    } catch (error) {
      log.error('Get organization failed:', error);
      return null;
    }
  }

  async getExercise(exerciseId: string): Promise<any | null> {
    try {
      return await this.request(`/api/exercises/${exerciseId}`);
    } catch (error) {
      log.error('Get exercise failed:', error);
      return null;
    }
  }

  async getEntityById(entityId: string, entityType: string): Promise<any | null> {
    const normalizedType = entityType.replace('oaev-', '');

    switch (normalizedType) {
      case 'Asset': return this.getAsset(entityId);
      case 'AssetGroup': return this.getAssetGroup(entityId);
      case 'Player':
      case 'User': return this.getPlayer(entityId);
      case 'Team': return this.getTeam(entityId);
      case 'Organization': return this.getOrganization(entityId);
      case 'Scenario': return this.getScenario(entityId);
      case 'Exercise': return this.getExercise(entityId);
      case 'AttackPattern': return this.getAttackPattern(entityId);
      case 'Finding': return this.getFinding(entityId);
      case 'Vulnerability': return this.getVulnerability(entityId);
      default:
        log.warn(`Unknown entity type: ${normalizedType}`);
        return null;
    }
  }
}

export default OpenAEVClient;
