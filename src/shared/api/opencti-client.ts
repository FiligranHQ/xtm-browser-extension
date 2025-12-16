/**
 * OpenCTI GraphQL API Client
 * 
 * Handles all communication with the OpenCTI platform via GraphQL API.
 */

import { loggers } from '../utils/logger';
import {
  OBSERVABLE_PROPERTIES,
  SDO_PROPERTIES,
  ALL_FRAGMENTS,
} from './opencti/fragments';
import {
  type SDOQueryResponse,
  type LocationQueryResponse,
  type LabelQueryResponse,
  type MarkingQueryResponse,
  type VocabularyQueryResponse,
  type IdentityQueryResult,
  type ContainerQueryResult,
} from './opencti/types';
import {
  normalizeToStixType,
  stixToGraphQLType,
  buildObservableInput,
} from './opencti/observable-utils';

import type {
  ExtensionSettings,
  PlatformInfo,
  StixCyberObservable,
  StixDomainObject,
  SearchResult,
  GraphQLResponse,
  ContainerCreateInput,
  ObservableType,
  HashType,
  OpenCTITheme,
  PlatformSettings,
  Investigation,
  InvestigationCreateInput,
} from '../types';

const log = loggers.opencti;

// User-Agent for API requests
const USER_AGENT = 'xtm-browser-extension/0.0.4';

// ============================================================================
// API Client Class
// ============================================================================

export class OpenCTIClient {
  private baseUrl: string;
  private apiToken: string;

  constructor(config: { url: string; apiToken: string }) {
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.apiToken = config.apiToken;
  }

  /**
   * Execute a GraphQL query
   * @param query - The GraphQL query string
   * @param variables - Optional variables for the query
   * @param draftId - Optional draft workspace ID to execute the query in draft context
   */
  private async query<T>(
    query: string,
    variables?: Record<string, unknown>,
    draftId?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiToken}`,
      'User-Agent': USER_AGENT,
    };
    
    // Add draft context header if provided
    if (draftId) {
      headers['opencti-draft-id'] = draftId;
    }
    
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      throw new Error(error.message || 'GraphQL error');
    }

    return result.data as T;
  }

  // ==========================================================================
  // Platform Information
  // ==========================================================================

  /**
   * Test connection and get platform info
   */
  async testConnection(): Promise<PlatformInfo> {
    const query = `
      query TestConnection {
        about {
          version
        }
        settings {
          platform_title
          platform_enterprise_edition {
            license_enterprise
          }
        }
        me {
          name
          user_email
        }
      }
    `;

    const data = await this.query<{
      about: { version: string };
      settings: { 
        platform_title: string;
        platform_enterprise_edition?: { license_enterprise?: boolean };
      };
      me: { name?: string; user_email?: string };
    }>(query);

    return {
      version: data.about.version,
      enterprise_edition: data.settings.platform_enterprise_edition?.license_enterprise ?? false,
      me: {
        name: data.me?.name,
        user_email: data.me?.user_email,
      },
      settings: {
        platform_theme: 'dark',
        platform_title: data.settings.platform_title,
      },
    };
  }

  /**
   * Get platform theme setting (simple mode)
   */
  async getPlatformThemeMode(): Promise<'dark' | 'light'> {
    const query = `
      query GetTheme {
        settings {
          platform_theme {
            name
          }
        }
      }
    `;

    const data = await this.query<{
      settings: { platform_theme: { name: string } | null };
    }>(query);

    const themeName = data.settings.platform_theme?.name?.toLowerCase() || 'dark';
    return themeName.includes('light') ? 'light' : 'dark';
  }

  /**
   * Get full platform theme with all colors
   */
  async getPlatformTheme(): Promise<OpenCTITheme | null> {
    const query = `
      query GetFullTheme {
        settings {
          platform_theme {
            id
            name
            theme_background
            theme_paper
            theme_nav
            theme_primary
            theme_secondary
            theme_accent
            theme_text_color
            theme_logo
            theme_logo_collapsed
            theme_logo_login
          }
        }
      }
    `;

    const data = await this.query<{
      settings: { platform_theme: OpenCTITheme | null };
    }>(query);

    return data.settings.platform_theme;
  }

  /**
   * Get platform settings including theme and URL
   */
  async getPlatformSettings(): Promise<PlatformSettings> {
    const query = `
      query GetPlatformSettings {
        settings {
          platform_title
          platform_url
          platform_theme {
            id
            name
            theme_background
            theme_paper
            theme_nav
            theme_primary
            theme_secondary
            theme_accent
            theme_text_color
            theme_logo
            theme_logo_collapsed
            theme_logo_login
          }
        }
      }
    `;

    const data = await this.query<{
      settings: PlatformSettings;
    }>(query);

    return data.settings;
  }

  // ==========================================================================
  // Observable Queries
  // ==========================================================================

  /**
   * Search for an observable by exact value
   */
  async searchObservableByValue(
    value: string,
    type?: ObservableType
  ): Promise<StixCyberObservable | null> {
    const query = `
      ${ALL_FRAGMENTS}
      query SearchObservable($filters: FilterGroup) {
        stixCyberObservables(filters: $filters, first: 1) {
          edges {
            node {
              ${OBSERVABLE_PROPERTIES}
            }
          }
        }
      }
    `;

    const filters: { mode: string; filters: object[]; filterGroups: object[] } = {
      mode: 'and',
      filters: [{ key: 'value', values: [value] }],
      filterGroups: [],
    };

    if (type === 'Domain-Name' || type === 'Hostname') {
      filters.filters.push({ key: 'entity_type', values: ['Domain-Name', 'Hostname'] });
    } else if (type) {
      filters.filters.push({ key: 'entity_type', values: [type] });
    }

    const data = await this.query<{
      stixCyberObservables: {
        edges: Array<{ node: StixCyberObservable }>;
      };
    }>(query, { filters });

    return data.stixCyberObservables.edges[0]?.node || null;
  }

  /**
   * Search for a file observable by hash
   */
  async searchObservableByHash(
    hash: string,
    hashType: HashType
  ): Promise<StixCyberObservable | null> {
    const query = `
      ${ALL_FRAGMENTS}
      query SearchFileByHash($filters: FilterGroup) {
        stixCyberObservables(filters: $filters, first: 1) {
          edges {
            node {
              ${OBSERVABLE_PROPERTIES}
            }
          }
        }
      }
    `;

    const filterKey = `hashes.${hashType}`;
    const filters = {
      mode: 'and',
      filters: [{ key: filterKey, values: [hash] }],
      filterGroups: [],
    };

    const data = await this.query<{
      stixCyberObservables: {
        edges: Array<{ node: StixCyberObservable }>;
      };
    }>(query, { filters });

    return data.stixCyberObservables.edges[0]?.node || null;
  }

  /**
   * Batch search for multiple observables
   */
  async batchSearchObservables(
    values: Array<{ value: string; type?: ObservableType; hashType?: HashType }>
  ): Promise<Map<string, StixCyberObservable>> {
    const results = new Map<string, StixCyberObservable>();
    
    const batchSize = 20;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      
      const promises = batch.map(async ({ value, type, hashType }) => {
        try {
          let result: StixCyberObservable | null;
          if (hashType) {
            result = await this.searchObservableByHash(value, hashType);
          } else {
            result = await this.searchObservableByValue(value, type);
          }
          if (result) {
            results.set(value, result);
          }
        } catch (error) {
          log.warn(`Failed to search for ${value}:`, error);
        }
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }

  // ==========================================================================
  // SDO Queries
  // ==========================================================================

  /**
   * Search for SDO by name or alias
   */
  async searchSDOByNameOrAlias(
    name: string,
    types?: string[]
  ): Promise<StixDomainObject | null> {
    const query = `
      ${ALL_FRAGMENTS}
      query SearchSDO($types: [String], $filters: FilterGroup) {
        stixDomainObjects(types: $types, filters: $filters, first: 1) {
          edges {
            node {
              ${SDO_PROPERTIES}
            }
          }
        }
      }
    `;

    let filters = {
      mode: 'and',
      filters: [{ key: 'name', values: [name], operator: 'eq' }],
      filterGroups: [],
    };

    let data = await this.query<{
      stixDomainObjects: {
        edges: Array<{ node: StixDomainObject }>;
      };
    }>(query, { types, filters });

    if (data.stixDomainObjects.edges[0]?.node) {
      return data.stixDomainObjects.edges[0].node;
    }

    filters = {
      mode: 'and',
      filters: [{ key: 'aliases', values: [name], operator: 'eq' }],
      filterGroups: [],
    };

    data = await this.query<{
      stixDomainObjects: {
        edges: Array<{ node: StixDomainObject }>;
      };
    }>(query, { types, filters });

    return data.stixDomainObjects.edges[0]?.node || null;
  }

  /**
   * Get SDO by ID with full details
   */
  async getSDOById(id: string): Promise<StixDomainObject | null> {
    const query = `
      ${ALL_FRAGMENTS}
      query GetSDO($id: String!) {
        stixDomainObject(id: $id) {
          ${SDO_PROPERTIES}
        }
      }
    `;

    const data = await this.query<{
      stixDomainObject: StixDomainObject | null;
    }>(query, { id });

    return data.stixDomainObject;
  }

  /**
   * Get observable by ID with full details
   */
  async getObservableById(id: string): Promise<StixCyberObservable | null> {
    const query = `
      ${ALL_FRAGMENTS}
      query GetObservable($id: String!) {
        stixCyberObservable(id: $id) {
          ${OBSERVABLE_PROPERTIES}
        }
      }
    `;

    const data = await this.query<{
      stixCyberObservable: StixCyberObservable | null;
    }>(query, { id });

    return data.stixCyberObservable;
  }

  // ==========================================================================
  // SDO Bulk Fetch for Caching
  // ==========================================================================

  private static readonly DEFAULT_PAGE_SIZE = 500;

  /**
   * Fetch SDOs of a specific type for caching with full pagination
   */
  async fetchSDOsForCache(
    entityType: string,
    pageSize: number = OpenCTIClient.DEFAULT_PAGE_SIZE
  ): Promise<Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }>> {
    const query = `
      query FetchSDOsForCache($types: [String], $first: Int, $after: ID) {
        stixDomainObjects(types: $types, first: $first, after: $after) {
          edges {
            node {
              id
              entity_type
              ... on ThreatActorGroup { name aliases }
              ... on ThreatActorIndividual { name aliases }
              ... on IntrusionSet { name aliases }
              ... on Campaign { name aliases }
              ... on Incident { name aliases }
              ... on Malware { name aliases }
              ... on Vulnerability { name x_opencti_aliases }
              ... on Sector { name x_opencti_aliases }
              ... on Country { name x_opencti_aliases }
              ... on Region { name x_opencti_aliases }
              ... on City { name x_opencti_aliases }
              ... on AdministrativeArea { name x_opencti_aliases }
              ... on Position { name x_opencti_aliases }
              ... on Organization { name x_opencti_aliases }
              ... on Individual { name x_opencti_aliases }
              ... on Event { name aliases }
              ... on AttackPattern { name aliases x_mitre_id }
            }
          }
          pageInfo { hasNextPage endCursor globalCount }
        }
      }
    `;

    const allResults: Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage) {
      const data: SDOQueryResponse = await this.query<SDOQueryResponse>(query, { types: [entityType], first: pageSize, after });

      const pageResults = data.stixDomainObjects.edges
        .map((edge) => {
          const node = edge.node;
          const allAliases = [...(node.aliases || []), ...(node.x_opencti_aliases || [])];
          return {
            id: node.id,
            name: node.name || '',
            aliases: allAliases.length > 0 ? allAliases : undefined,
            x_mitre_id: node.x_mitre_id || undefined,
          };
        })
        .filter(node => node.name) as Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }>;

      allResults.push(...pageResults);
      hasNextPage = data.stixDomainObjects.pageInfo.hasNextPage;
      after = data.stixDomainObjects.pageInfo.endCursor;
      pageCount++;

      log.debug(`[OpenCTI] Fetched page ${pageCount} for ${entityType}: ${pageResults.length} items`);
    }

    log.info(`[OpenCTI] Completed fetching ${entityType}: ${allResults.length} total items`);
    return allResults;
  }

  // Convenience methods for specific entity types
  async fetchThreatActorGroups() { return this.fetchSDOsForCache('Threat-Actor-Group'); }
  async fetchThreatActorIndividuals() { return this.fetchSDOsForCache('Threat-Actor-Individual'); }
  async fetchIntrusionSets() { return this.fetchSDOsForCache('Intrusion-Set'); }
  async fetchCampaigns() { return this.fetchSDOsForCache('Campaign'); }
  async fetchIncidents() { return this.fetchSDOsForCache('Incident'); }
  async fetchMalware() { return this.fetchSDOsForCache('Malware'); }
  async fetchVulnerabilities() { return this.fetchSDOsForCache('Vulnerability'); }
  async fetchSectors() { return this.fetchSDOsForCache('Sector'); }
  async fetchOrganizations() { return this.fetchSDOsForCache('Organization'); }
  async fetchIndividuals() { return this.fetchSDOsForCache('Individual'); }
  async fetchEvents() { return this.fetchSDOsForCache('Event'); }
  async fetchAttackPatterns() { return this.fetchSDOsForCache('Attack-Pattern'); }
  async fetchCountries() { return this.fetchSDOsForCache('Country'); }
  async fetchRegions() { return this.fetchSDOsForCache('Region'); }
  async fetchCities() { return this.fetchSDOsForCache('City'); }
  async fetchAdministrativeAreas() { return this.fetchSDOsForCache('Administrative-Area'); }
  async fetchPositions() { return this.fetchSDOsForCache('Position'); }

  /**
   * Fetch all locations for caching with full pagination
   */
  async fetchLocations(pageSize: number = OpenCTIClient.DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    const query = `
      query FetchLocations($first: Int, $after: ID) {
        locations(first: $first, after: $after) {
          edges {
            node { id entity_type name x_opencti_aliases }
          }
          pageInfo { hasNextPage endCursor globalCount }
        }
      }
    `;

    const allResults: Array<{ id: string; name: string; aliases?: string[] }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: LocationQueryResponse = await this.query<LocationQueryResponse>(query, { first: pageSize, after });
      const pageResults = data.locations.edges.map((edge) => ({
        id: edge.node.id,
        name: edge.node.name,
        aliases: edge.node.x_opencti_aliases,
      }));
      allResults.push(...pageResults);
      hasNextPage = data.locations.pageInfo.hasNextPage;
      after = data.locations.pageInfo.endCursor;
    }

    return allResults;
  }

  /**
   * Fetch all labels with full pagination
   */
  async fetchLabels(pageSize: number = OpenCTIClient.DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; value: string; color: string }>> {
    const query = `
      query FetchLabels($first: Int, $after: ID) {
        labels(first: $first, after: $after) {
          edges { node { id value color } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const allResults: Array<{ id: string; value: string; color: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: LabelQueryResponse = await this.query<LabelQueryResponse>(query, { first: pageSize, after });
      allResults.push(...data.labels.edges.map((e) => e.node));
      hasNextPage = data.labels.pageInfo.hasNextPage;
      after = data.labels.pageInfo.endCursor;
    }

    return allResults;
  }

  /**
   * Fetch all marking definitions with full pagination
   */
  async fetchMarkingDefinitions(pageSize: number = 100): Promise<Array<{ id: string; definition: string; definition_type: string; x_opencti_color: string }>> {
    const query = `
      query FetchMarkingDefinitions($first: Int, $after: ID) {
        markingDefinitions(first: $first, after: $after) {
          edges { node { id definition definition_type x_opencti_color } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const allResults: Array<{ id: string; definition: string; definition_type: string; x_opencti_color: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: MarkingQueryResponse = await this.query<MarkingQueryResponse>(query, { first: pageSize, after });
      allResults.push(...data.markingDefinitions.edges.map((e) => e.node));
      hasNextPage = data.markingDefinitions.pageInfo.hasNextPage;
      after = data.markingDefinitions.pageInfo.endCursor;
    }

    return allResults;
  }

  /**
   * Fetch open vocabulary values by category with full pagination
   */
  async fetchVocabulary(category: string, pageSize: number = 100): Promise<Array<{ id: string; name: string; description?: string }>> {
    const query = `
      query FetchVocabulary($category: VocabularyCategory!, $first: Int, $after: ID) {
        vocabularies(category: $category, first: $first, after: $after) {
          edges { node { id name description } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const allResults: Array<{ id: string; name: string; description?: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: VocabularyQueryResponse = await this.query<VocabularyQueryResponse>(query, { category, first: pageSize, after });
      allResults.push(...data.vocabularies.edges.map((e) => e.node));
      hasNextPage = data.vocabularies.pageInfo.hasNextPage;
      after = data.vocabularies.pageInfo.endCursor;
    }

    return allResults;
  }

  /**
   * Fetch identities for the createdBy field with full pagination
   */
  async fetchIdentities(pageSize: number = OpenCTIClient.DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; name: string; entity_type: string }>> {
    const query = `
      query FetchIdentities($first: Int, $after: ID) {
        identities(first: $first, after: $after, types: ["Organization", "Individual", "System"]) {
          edges { node { id name entity_type } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const allResults: Array<{ id: string; name: string; entity_type: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: IdentityQueryResult = await this.query<IdentityQueryResult>(query, { first: pageSize, after });
      allResults.push(...data.identities.edges.map((e) => e.node));
      hasNextPage = data.identities.pageInfo.hasNextPage;
      after = data.identities.pageInfo.endCursor;
    }

    return allResults;
  }

  // ==========================================================================
  // Create Operations
  // ==========================================================================

  /**
   * Create a new observable
   */
  async createObservable(input: {
    type: ObservableType;
    value: string;
    hashType?: HashType;
    description?: string;
    score?: number;
    createIndicator?: boolean;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<StixCyberObservable> {
    const stixType = normalizeToStixType(input.type);
    const gqlType = stixToGraphQLType(stixType);
    const observableInput = buildObservableInput(stixType, gqlType, input.value, input.hashType);

    const query = `
      mutation CreateObservable(
        $type: String!,
        $x_opencti_score: Int,
        $x_opencti_description: String,
        $createIndicator: Boolean,
        $objectMarking: [String],
        $objectLabel: [String],
        $${gqlType}: ${gqlType}AddInput
      ) {
        stixCyberObservableAdd(
          type: $type,
          x_opencti_score: $x_opencti_score,
          x_opencti_description: $x_opencti_description,
          createIndicator: $createIndicator,
          objectMarking: $objectMarking,
          objectLabel: $objectLabel,
          ${gqlType}: $${gqlType}
        ) {
          id standard_id entity_type observable_value
        }
      }
    `;

    const variables = {
      type: stixType,
      x_opencti_score: input.score,
      x_opencti_description: input.description,
      createIndicator: input.createIndicator ?? false,
      objectMarking: input.objectMarking,
      objectLabel: input.objectLabel,
      [gqlType]: observableInput,
    };

    const data = await this.query<{ stixCyberObservableAdd: StixCyberObservable }>(query, variables);
    return data.stixCyberObservableAdd;
  }

  // ==========================================================================
  // SDO Creation Methods
  // ==========================================================================

  async createIntrusionSet(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation IntrusionSetAdd($input: IntrusionSetAddInput!) {
        intrusionSetAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    const data = await this.query<{ intrusionSetAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(query, { input });
    return data.intrusionSetAdd;
  }

  async createThreatActor(input: { name: string; description?: string; threat_actor_types?: string[]; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation ThreatActorGroupAdd($input: ThreatActorGroupAddInput!) {
        threatActorGroupAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    const data = await this.query<{ threatActorGroupAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(query, {
      input: { ...input, threat_actor_types: input.threat_actor_types || ['unknown'] },
    });
    return data.threatActorGroupAdd;
  }

  async createMalware(input: { name: string; description?: string; malware_types?: string[]; is_family?: boolean; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation MalwareAdd($input: MalwareAddInput!) {
        malwareAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    const data = await this.query<{ malwareAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(query, {
      input: { ...input, malware_types: input.malware_types || ['unknown'], is_family: input.is_family ?? true },
    });
    return data.malwareAdd;
  }

  async createTool(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation ToolAdd($input: ToolAddInput!) {
        toolAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    const data = await this.query<{ toolAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(query, { input });
    return data.toolAdd;
  }

  async createCampaign(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation CampaignAdd($input: CampaignAddInput!) {
        campaignAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    const data = await this.query<{ campaignAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(query, { input });
    return data.campaignAdd;
  }

  async createVulnerability(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation VulnerabilityAdd($input: VulnerabilityAddInput!) {
        vulnerabilityAdd(input: $input) { id standard_id entity_type name }
      }
    `;
    const data = await this.query<{ vulnerabilityAdd: { id: string; standard_id: string; entity_type: string; name: string } }>(query, { input });
    return data.vulnerabilityAdd;
  }

  async createAttackPattern(input: { name: string; description?: string; x_mitre_id?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation AttackPatternAdd($input: AttackPatternAddInput!) {
        attackPatternAdd(input: $input) { id standard_id entity_type name x_mitre_id aliases }
      }
    `;
    const data = await this.query<{ attackPatternAdd: { id: string; standard_id: string; entity_type: string; name: string; x_mitre_id?: string; aliases?: string[] } }>(query, { input });
    return data.attackPatternAdd;
  }

  async createCountry(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation CountryAdd($input: CountryAddInput!) {
        countryAdd(input: $input) { id standard_id entity_type name }
      }
    `;
    const data = await this.query<{ countryAdd: { id: string; standard_id: string; entity_type: string; name: string } }>(query, { input });
    return data.countryAdd;
  }

  async createSector(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const query = `
      mutation SectorAdd($input: SectorAddInput!) {
        sectorAdd(input: $input) { id standard_id entity_type name }
      }
    `;
    const data = await this.query<{ sectorAdd: { id: string; standard_id: string; entity_type: string; name: string } }>(query, { input });
    return data.sectorAdd;
  }

  /**
   * Create any entity by type - dispatches to the appropriate creation method
   */
  async createEntity(input: {
    type: string;
    value?: string;
    name?: string;
    description?: string;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name?: string; observable_value?: string; aliases?: string[]; x_mitre_id?: string }> {
    const normalizedType = input.type.toLowerCase().replace(/[_\s]/g, '-');
    const entityName = input.name || input.value || 'Unknown';
    
    const sdoTypes: Record<string, () => Promise<{ id: string; standard_id: string; entity_type: string; name: string; aliases?: string[]; x_mitre_id?: string }>> = {
      'intrusion-set': () => this.createIntrusionSet({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'threat-actor': () => this.createThreatActor({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'threat-actor-group': () => this.createThreatActor({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'threat-actor-individual': () => this.createThreatActor({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'malware': () => this.createMalware({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'tool': () => this.createTool({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'campaign': () => this.createCampaign({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'vulnerability': () => this.createVulnerability({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'attack-pattern': () => this.createAttackPattern({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'country': () => this.createCountry({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
      'sector': () => this.createSector({ name: entityName, description: input.description, objectMarking: input.objectMarking, objectLabel: input.objectLabel }),
    };

    if (sdoTypes[normalizedType]) {
      const result = await sdoTypes[normalizedType]();
      return { ...result, observable_value: undefined };
    }

    if (!input.value) {
      throw new Error(`Observable type "${input.type}" requires a value`);
    }
    
    const observable = await this.createObservable({
      type: input.type as ObservableType,
      value: input.value,
      description: input.description,
      objectMarking: input.objectMarking,
      objectLabel: input.objectLabel,
    });

    return {
      id: observable.id,
      standard_id: observable.standard_id,
      entity_type: observable.entity_type,
      observable_value: observable.observable_value,
    };
  }

  // ==========================================================================
  // External Reference Operations
  // ==========================================================================

  async createExternalReference(input: { source_name: string; url?: string; external_id?: string; description?: string }): Promise<{ id: string; standard_id: string; url?: string }> {
    const query = `
      mutation ExternalReferenceAdd($input: ExternalReferenceAddInput!) {
        externalReferenceAdd(input: $input) { id standard_id entity_type source_name description url external_id }
      }
    `;
    const data = await this.query<{ externalReferenceAdd: { id: string; standard_id: string; url?: string } }>(query, { input });
    return data.externalReferenceAdd;
  }

  async addExternalReferenceToEntity(entityId: string, externalReferenceId: string): Promise<void> {
    const query = `
      mutation StixDomainObjectEditRelationAdd($id: ID!, $input: StixRefRelationshipAddInput!) {
        stixDomainObjectEdit(id: $id) { relationAdd(input: $input) { id } }
      }
    `;
    await this.query(query, { id: entityId, input: { toId: externalReferenceId, relationship_type: 'external-reference' } });
  }

  async findExternalReferencesByUrl(url: string): Promise<Array<{ id: string; url: string; source_name: string }>> {
    const query = `
      query ExternalReferences($filters: FilterGroup) {
        externalReferences(filters: $filters, first: 10) {
          edges { node { id standard_id source_name description url } }
        }
      }
    `;
    const filters = { mode: 'and', filters: [{ key: 'url', values: [url], operator: 'eq' }], filterGroups: [] };
    const data = await this.query<{ externalReferences: { edges: Array<{ node: { id: string; url: string; source_name: string } }> } }>(query, { filters });
    return data.externalReferences.edges.map(edge => edge.node);
  }

  async findContainersByExternalReferenceUrl(url: string): Promise<StixDomainObject[]> {
    const externalRefs = await this.findExternalReferencesByUrl(url);
    if (externalRefs.length === 0) return [];

    const extRefIds = externalRefs.map(ref => ref.id);
    const query = `
      ${ALL_FRAGMENTS}
      query FindContainersByExternalRefs($filters: FilterGroup) {
        stixDomainObjects(types: ["Report", "Case-Incident", "Case-Rfi", "Case-Rft", "Grouping"], filters: $filters, first: 10, orderBy: modified, orderMode: desc) {
          edges { node { ${SDO_PROPERTIES} } }
        }
      }
    `;
    const filters = { mode: 'and', filters: [{ key: 'externalReferences', values: extRefIds, operator: 'eq' }], filterGroups: [] };
    const data = await this.query<{ stixDomainObjects: { edges: Array<{ node: StixDomainObject }> } }>(query, { filters });
    return data.stixDomainObjects.edges.map(edge => edge.node);
  }

  // ==========================================================================
  // Draft and Container Operations
  // ==========================================================================

  async createDraftWorkspace(name: string): Promise<{ id: string; name: string }> {
    const query = `
      mutation DraftWorkspaceAdd($input: DraftWorkspaceAddInput!) {
        draftWorkspaceAdd(input: $input) { id name }
      }
    `;
    const data = await this.query<{ draftWorkspaceAdd: { id: string; name: string } }>(query, { input: { name } });
    return data.draftWorkspaceAdd;
  }

  async createContainer(input: ContainerCreateInput): Promise<StixDomainObject & { draftId?: string }> {
    let draftId: string | undefined;
    if (input.createAsDraft) {
      const draftWorkspace = await this.createDraftWorkspace(`Draft - ${input.name}`);
      draftId = draftWorkspace.id;
    }
    
    const containerInput: Record<string, unknown> = {
      name: input.name,
      description: input.description,
      objects: input.objects,
      objectMarking: input.objectMarking,
      objectLabel: input.objectLabel,
      createdBy: input.createdBy,
    };

    if (input.externalReferences && input.externalReferences.length > 0) {
      containerInput.externalReferences = input.externalReferences;
    }

    const containerFields = `id standard_id entity_type name description created modified createdBy { id name } objectLabel { id value color } objectMarking { id definition x_opencti_color }`;
    let query: string;
    let mutationName: string;

    switch (input.type) {
      case 'Report':
        containerInput.published = input.published || new Date().toISOString();
        containerInput.report_types = input.report_types || ['threat-report'];
        containerInput.content = input.content;
        mutationName = 'reportAdd';
        query = `mutation CreateReport($input: ReportAddInput!) { reportAdd(input: $input) { ${containerFields} } }`;
        break;
      case 'Case-Incident':
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        if (input.response_types?.length) containerInput.response_types = input.response_types;
        if (input.created) containerInput.created = input.created;
        mutationName = 'caseIncidentAdd';
        query = `mutation CreateCaseIncident($input: CaseIncidentAddInput!) { caseIncidentAdd(input: $input) { ${containerFields} } }`;
        break;
      case 'Case-Rfi':
        containerInput.information_types = ['strategic'];
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        if (input.created) containerInput.created = input.created;
        mutationName = 'caseRfiAdd';
        query = `mutation CreateCaseRfi($input: CaseRfiAddInput!) { caseRfiAdd(input: $input) { ${containerFields} } }`;
        break;
      case 'Case-Rft':
        containerInput.takedown_types = ['content'];
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        if (input.created) containerInput.created = input.created;
        mutationName = 'caseRftAdd';
        query = `mutation CreateCaseRft($input: CaseRftAddInput!) { caseRftAdd(input: $input) { ${containerFields} } }`;
        break;
      case 'Grouping':
        containerInput.context = input.context || 'suspicious-activity';
        if (input.created) containerInput.created = input.created;
        mutationName = 'groupingAdd';
        query = `mutation CreateGrouping($input: GroupingAddInput!) { groupingAdd(input: $input) { ${containerFields} } }`;
        break;
      default:
        throw new Error(`Unsupported container type: ${input.type}`);
    }

    const data = await this.query<{ [key: string]: StixDomainObject }>(query, { input: containerInput }, draftId);
    const container = data[mutationName];
    return draftId ? { ...container, draftId } : container;
  }

  async uploadFileToEntity(entityId: string, file: { name: string; data: Blob | ArrayBuffer; mimeType: string }): Promise<void> {
    const formData = new FormData();
    const operations = JSON.stringify({
      query: `mutation StixDomainObjectFileUpload($id: ID!, $file: Upload!) { stixDomainObjectEdit(id: $id) { importPush(file: $file) { id name } } }`,
      variables: { id: entityId, file: null },
    });
    formData.append('operations', operations);
    formData.append('map', JSON.stringify({ '0': ['variables.file'] }));
    formData.append('0', new Blob([file.data], { type: file.mimeType }), file.name);

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiToken}`, 'User-Agent': USER_AGENT },
      body: formData,
    });

    if (!response.ok) throw new Error(`File upload failed: ${response.status}`);
  }

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  async globalSearch(searchTerm: string, types?: string[], limit: number = 25): Promise<SearchResult[]> {
    const query = `
      query GlobalSearch($search: String!, $types: [String], $first: Int, $orderBy: StixCoreObjectsOrdering, $orderMode: OrderingMode) {
        stixCoreObjects(search: $search, types: $types, first: $first, orderBy: $orderBy, orderMode: $orderMode) {
          edges {
            node {
              id entity_type representative { main }
              ... on ThreatActorGroup { name aliases }
              ... on ThreatActorIndividual { name aliases }
              ... on IntrusionSet { name aliases }
              ... on Campaign { name aliases }
              ... on Incident { name aliases }
              ... on Malware { name aliases }
              ... on Vulnerability { name x_opencti_cvss_base_score x_opencti_cvss_base_severity }
              ... on Country { name }
              ... on Region { name }
              ... on City { name }
              ... on Sector { name }
              ... on Organization { name }
              ... on Individual { name }
              ... on Event { name }
              ... on Report { name }
              ... on Grouping { name }
              ... on StixCyberObservable { observable_value x_opencti_score }
            }
          }
        }
      }
    `;
    const data = await this.query<{ stixCoreObjects: { edges: Array<{ node: SearchResult }> } }>(query, { 
      search: searchTerm, 
      types, 
      first: limit,
      orderBy: '_score',
      orderMode: 'desc',
    });
    return data.stixCoreObjects.edges.map((e) => e.node);
  }

  getEntityUrl(entityId: string, entityType: string): string {
    const typePathMap: Record<string, string> = {
      'Intrusion-Set': 'threats/intrusion_sets', 'Malware': 'arsenal/malwares', 'Threat-Actor': 'threats/threat_actors_group',
      'Campaign': 'threats/campaigns', 'Vulnerability': 'arsenal/vulnerabilities', 'Tool': 'arsenal/tools',
      'Attack-Pattern': 'techniques/attack_patterns', 'Indicator': 'observations/indicators', 'Report': 'analyses/reports',
      'Case-Incident': 'cases/incidents', 'Grouping': 'analyses/groupings', 'Investigation': 'workspaces/investigations',
      'IPv4-Addr': 'observations/observables', 'IPv6-Addr': 'observations/observables', 'Domain-Name': 'observations/observables',
      'Url': 'observations/observables', 'Email-Addr': 'observations/observables', 'StixFile': 'observations/observables', 'Artifact': 'observations/observables',
    };
    return `${this.baseUrl}/${typePathMap[entityType] || 'dashboard'}/${entityId}`;
  }

  // ==========================================================================
  // Investigation Operations
  // ==========================================================================

  async createInvestigation(input: InvestigationCreateInput): Promise<Investigation> {
    const query = `
      mutation CreateInvestigation($input: WorkspaceAddInput!) {
        workspaceAdd(input: $input) { id name description type investigated_entities_ids created_at updated_at }
      }
    `;
    const data = await this.query<{ workspaceAdd: Investigation }>(query, {
      input: { type: 'investigation', name: input.name, description: input.description, investigated_entities_ids: input.investigated_entities_ids || [] },
    });
    return data.workspaceAdd;
  }

  async addEntitiesToInvestigation(investigationId: string, entityIds: string[]): Promise<Investigation> {
    const query = `
      mutation AddToInvestigation($id: ID!, $input: [EditInput!]!) {
        workspaceFieldPatch(id: $id, input: $input) { id name investigated_entities_ids }
      }
    `;
    const data = await this.query<{ workspaceFieldPatch: Investigation }>(query, {
      id: investigationId, input: [{ key: 'investigated_entities_ids', value: entityIds, operation: 'add' }],
    });
    return data.workspaceFieldPatch;
  }

  async createInvestigationWithEntities(
    name: string,
    description: string | undefined,
    entities: Array<{ type: 'observable' | 'sdo'; existingId?: string; newObservable?: { type: ObservableType; value: string; hashType?: HashType } }>
  ): Promise<{ investigation: Investigation; createdEntityIds: string[] }> {
    const createdEntityIds: string[] = [];
    const allEntityIds: string[] = [];

    for (const entity of entities) {
      if (entity.existingId) {
        allEntityIds.push(entity.existingId);
      } else if (entity.newObservable) {
        try {
          const newObs = await this.createObservable({ type: entity.newObservable.type, value: entity.newObservable.value, hashType: entity.newObservable.hashType });
          allEntityIds.push(newObs.id);
          createdEntityIds.push(newObs.id);
        } catch (error) {
          log.warn(`Failed to create observable ${entity.newObservable.value}:`, error);
        }
      }
    }

    const investigation = await this.createInvestigation({ name, description, investigated_entities_ids: allEntityIds });
    return { investigation, createdEntityIds };
  }

  getInvestigationUrl(investigationId: string): string {
    return `${this.baseUrl}/dashboard/workspaces/investigations/${investigationId}`;
  }

  async fetchContainersForEntity(entityId: string, limit: number = 10): Promise<Array<{ id: string; entity_type: string; name: string; created: string; modified: string; createdBy?: { id: string; name: string } }>> {
    const query = `
      query GetContainersForEntity($first: Int, $orderBy: ContainersOrdering, $orderMode: OrderingMode, $filters: FilterGroup) {
        containers(first: $first, orderBy: $orderBy, orderMode: $orderMode, filters: $filters) {
          edges {
            node {
              id entity_type created modified
              createdBy { ... on Identity { id name } }
              ... on Report { name }
              ... on Grouping { name }
              ... on Note { attribute_abstract content }
              ... on Opinion { opinion }
              ... on ObservedData { name first_observed last_observed }
              ... on CaseIncident { name }
              ... on CaseRfi { name }
              ... on CaseRft { name }
              ... on Task { name }
            }
          }
        }
      }
    `;
    const filters = { mode: 'and', filters: [{ key: 'objects', values: [entityId] }], filterGroups: [] };

    try {
      const data = await this.query<ContainerQueryResult>(query, { first: limit, orderBy: 'created', orderMode: 'desc', filters });
      return data.containers?.edges?.map(edge => {
        const node = edge.node;
        let name = node.name;
        if (!name) {
          if (node.attribute_abstract) name = node.attribute_abstract.substring(0, 50) + (node.attribute_abstract.length > 50 ? '...' : '');
          else if (node.content) name = node.content.substring(0, 50) + (node.content.length > 50 ? '...' : '');
          else if (node.opinion) name = `Opinion: ${node.opinion}`;
          else if (node.first_observed && node.last_observed) name = `Observed Data (${new Date(node.first_observed).toLocaleDateString()})`;
          else name = node.entity_type;
        }
        return { id: node.id, entity_type: node.entity_type, name, created: node.created, modified: node.modified, createdBy: node.createdBy };
      }) || [];
    } catch (error) {
      log.warn('Failed to fetch containers for entity:', error);
      return [];
    }
  }

  // ==========================================================================
  // Workbench Operations
  // ==========================================================================

  async createWorkbench(input: { name: string; description?: string }): Promise<{ id: string; name: string }> {
    const query = `
      mutation WorkbenchAdd($input: WorkspaceAddInput!) {
        workspaceAdd(input: $input) { id name entity_type }
      }
    `;
    const data = await this.query<{ workspaceAdd: { id: string; name: string; entity_type: string } }>(query, { input: { ...input, type: 'INVESTIGATION' } });
    return data.workspaceAdd;
  }

  async addObjectsToContainer(containerId: string, objectIds: string[]): Promise<void> {
    if (objectIds.length === 0) return;
    const query = `
      mutation ContainerEditObjectsAdd($id: ID!, $toIds: [String]!) {
        containerEdit(id: $id) { objectsAdd(toIds: $toIds) { id } }
      }
    `;
    await this.query(query, { id: containerId, toIds: objectIds });
  }

  async createStixCoreRelationship(input: { fromId: string; toId: string; relationship_type: string; description?: string; confidence?: number; objectMarking?: string[] }): Promise<{ id: string; standard_id: string }> {
    const query = `
      mutation StixCoreRelationshipAdd($input: StixCoreRelationshipAddInput!) {
        stixCoreRelationshipAdd(input: $input) { id standard_id entity_type relationship_type from { ... on BasicObject { id entity_type } } to { ... on BasicObject { id entity_type } } }
      }
    `;
    const data = await this.query<{ stixCoreRelationshipAdd: { id: string; standard_id: string } }>(query, { input });
    return data.stixCoreRelationshipAdd;
  }

  async addEntitiesToWorkbench(workbenchId: string, entityIds: string[]): Promise<void> {
    const query = `
      mutation WorkspaceStixCoreObjectsAdd($id: ID!, $toIds: [String]!) {
        workspaceEdit(id: $id) { relationAdd(input: { toIds: $toIds, relationship_type: "has" }) { id } }
      }
    `;
    await this.query(query, { id: workbenchId, toIds: entityIds });
  }

  getWorkbenchUrl(workbenchId: string): string {
    return `${this.baseUrl}/dashboard/workspaces/investigations/${workbenchId}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let clientInstance: OpenCTIClient | null = null;

/**
 * Get or create the OpenCTI client instance
 */
export async function getOpenCTIClient(): Promise<OpenCTIClient | null> {
  if (clientInstance) return clientInstance;

  const settings = await chrome.storage.local.get('settings') as { settings?: ExtensionSettings };
  const firstPlatform = settings.settings?.openctiPlatforms?.find(p => p.enabled && p.url && p.apiToken);
  
  if (!firstPlatform) return null;

  clientInstance = new OpenCTIClient({ url: firstPlatform.url, apiToken: firstPlatform.apiToken });
  return clientInstance;
}

/**
 * Reset the client instance (useful when settings change)
 */
export function resetOpenCTIClient(): void {
  clientInstance = null;
}
