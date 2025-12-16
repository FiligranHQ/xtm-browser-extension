/**
 * OpenCTI GraphQL API Client
 * 
 * Handles all communication with the OpenCTI platform via GraphQL API.
 */

import { loggers } from '../utils/logger';

const log = loggers.opencti;

// User-Agent for API requests
const USER_AGENT = 'xtm-browser-extension/0.0.3';

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

// ============================================================================
// Query Result Types (for strict type checking)
// ============================================================================

interface SDOQueryResponse {
  stixDomainObjects: {
    edges: Array<{
      node: {
        id: string;
        entity_type: string;
        name?: string;
        aliases?: string[];
        x_opencti_aliases?: string[];
        x_mitre_id?: string;
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
      globalCount: number;
    };
  };
}

interface LocationQueryResponse {
  locations: {
    edges: Array<{
      node: {
        id: string;
        entity_type: string;
        name: string;
        x_opencti_aliases?: string[];
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
      globalCount: number;
    };
  };
}

interface LabelQueryResponse {
  labels: {
    edges: Array<{
      node: { id: string; value: string; color: string };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

interface MarkingQueryResponse {
  markingDefinitions: {
    edges: Array<{
      node: { id: string; definition: string; definition_type: string; x_opencti_color: string };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

interface VocabularyQueryResponse {
  vocabularies: {
    edges: Array<{ node: { id: string; name: string; description?: string } }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

interface IdentityQueryResponse {
  identities: {
    edges: Array<{ node: { id: string; name: string; entity_type: string } }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

// ============================================================================
// GraphQL Fragments
// ============================================================================

const MARKING_FRAGMENT = `
  fragment MarkingFields on MarkingDefinition {
    id
    definition_type
    definition
    x_opencti_order
    x_opencti_color
  }
`;

const LABEL_FRAGMENT = `
  fragment LabelFields on Label {
    id
    value
    color
  }
`;

const IDENTITY_FRAGMENT = `
  fragment IdentityFields on Identity {
    id
    standard_id
    entity_type
    name
    description
    identity_class
  }
`;

const OBSERVABLE_PROPERTIES = `
  id
  standard_id
  entity_type
  parent_types
  created_at
  updated_at
  observable_value
  x_opencti_description
  x_opencti_score
  objectMarking {
    ...MarkingFields
  }
  objectLabel {
    ...LabelFields
  }
  createdBy {
    ...IdentityFields
  }
  creators {
    id
    name
  }
  ... on IPv4Addr {
    value
  }
  ... on IPv6Addr {
    value
  }
  ... on DomainName {
    value
  }
  ... on Hostname {
    value
  }
  ... on EmailAddr {
    value
  }
  ... on Url {
    value
  }
  ... on MacAddr {
    value
  }
  ... on StixFile {
    name
    hashes {
      algorithm
      hash
    }
  }
  ... on Artifact {
    hashes {
      algorithm
      hash
    }
  }
  indicators {
    edges {
      node {
        id
        name
        pattern
        pattern_type
        x_opencti_score
      }
    }
  }
`;

const SDO_PROPERTIES = `
  id
  standard_id
  entity_type
  parent_types
  created_at
  updated_at
  created
  modified
  revoked
  confidence
  objectMarking {
    ...MarkingFields
  }
  objectLabel {
    ...LabelFields
  }
  createdBy {
    ...IdentityFields
  }
  creators {
    id
    name
  }
  externalReferences {
    edges {
      node {
        id
        source_name
        description
        url
        external_id
      }
    }
  }
  ... on IntrusionSet {
    name
    description
    aliases
    first_seen
    last_seen
    goals
    resource_level
    primary_motivation
    secondary_motivations
  }
  ... on Malware {
    name
    description
    aliases
    malware_types
    is_family
    first_seen
    last_seen
  }
  ... on ThreatActor {
    name
    description
    aliases
    threat_actor_types
    first_seen
    last_seen
    goals
    resource_level
    primary_motivation
    secondary_motivations
  }
  ... on Campaign {
    name
    description
    aliases
    first_seen
    last_seen
    objective
  }
  ... on Vulnerability {
    name
    description
    x_opencti_aliases
    x_opencti_cvss_base_score
    x_opencti_cvss_base_severity
    x_opencti_epss_score
    x_opencti_epss_percentile
    x_opencti_cisa_kev
  }
  ... on Tool {
    name
    description
    aliases
    tool_types
  }
  ... on AttackPattern {
    name
    description
    aliases
    x_mitre_id
  }
  ... on Indicator {
    name
    description
    pattern
    pattern_type
    valid_from
    valid_until
    x_opencti_score
    x_opencti_main_observable_type
  }
  ... on Report {
    name
    description
    report_types
    published
  }
  ... on Grouping {
    name
    description
    context
  }
  ... on CaseIncident {
    name
    description
    severity
    priority
    response_types
  }
  ... on CaseRfi {
    name
    description
    severity
    priority
  }
  ... on CaseRft {
    name
    description
    severity
    priority
  }
`;

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
   * Note: We avoid querying platform_theme here as its type varies between OpenCTI versions
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
        platform_theme: 'dark', // Default, actual theme fetched separately if needed
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
   * For Domain-Name/Hostname types, searches both types since they can be interchangeable
   */
  async searchObservableByValue(
    value: string,
    type?: ObservableType
  ): Promise<StixCyberObservable | null> {
    const query = `
      ${MARKING_FRAGMENT}
      ${LABEL_FRAGMENT}
      ${IDENTITY_FRAGMENT}
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

    // For Domain-Name and Hostname, search both types since they can be interchangeable
    // A hostname like "capital.go2cloud.org" might be stored as Domain-Name or Hostname
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
      ${MARKING_FRAGMENT}
      ${LABEL_FRAGMENT}
      ${IDENTITY_FRAGMENT}
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
    
    // Process in batches to avoid overwhelming the API
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
      ${MARKING_FRAGMENT}
      ${LABEL_FRAGMENT}
      ${IDENTITY_FRAGMENT}
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

    // First try exact name match
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

    // Try alias match
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
      ${MARKING_FRAGMENT}
      ${LABEL_FRAGMENT}
      ${IDENTITY_FRAGMENT}
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
      ${MARKING_FRAGMENT}
      ${LABEL_FRAGMENT}
      ${IDENTITY_FRAGMENT}
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
  // SDO Bulk Fetch for Caching (with full pagination support)
  // ==========================================================================

  /**
   * Default page size for pagination (balance between efficiency and API limits)
   */
  private static readonly DEFAULT_PAGE_SIZE = 500;

  /**
   * Fetch SDOs of a specific type for caching with full pagination
   * Iterates through all pages to ensure no entities are missed
   */
  async fetchSDOsForCache(
    entityType: string,
    pageSize: number = OpenCTIClient.DEFAULT_PAGE_SIZE
  ): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    const query = `
      query FetchSDOsForCache($types: [String], $first: Int, $after: ID) {
        stixDomainObjects(types: $types, first: $first, after: $after) {
          edges {
            node {
              id
              entity_type
              ... on ThreatActorGroup {
                name
                aliases
              }
              ... on ThreatActorIndividual {
                name
                aliases
              }
              ... on IntrusionSet {
                name
                aliases
              }
              ... on Campaign {
                name
                aliases
              }
              ... on Incident {
                name
                aliases
              }
              ... on Malware {
                name
                aliases
              }
              ... on Vulnerability {
                name
                x_opencti_aliases
              }
              ... on Sector {
                name
                x_opencti_aliases
              }
              ... on Country {
                name
                x_opencti_aliases
              }
              ... on Region {
                name
                x_opencti_aliases
              }
              ... on City {
                name
                x_opencti_aliases
              }
              ... on AdministrativeArea {
                name
                x_opencti_aliases
              }
              ... on Position {
                name
                x_opencti_aliases
              }
              ... on Organization {
                name
                x_opencti_aliases
              }
              ... on Individual {
                name
                x_opencti_aliases
              }
              ... on Event {
                name
                aliases
              }
              ... on AttackPattern {
                name
                aliases
                x_mitre_id
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
            globalCount
          }
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
          // Merge aliases and x_opencti_aliases (x_mitre_id is kept separate for explicit matching)
          const allAliases = [
            ...(node.aliases || []), 
            ...(node.x_opencti_aliases || []),
          ];
          return {
            id: node.id,
            name: node.name || '',
            aliases: allAliases.length > 0 ? allAliases : undefined,
            // Keep x_mitre_id as separate field for attack patterns
            x_mitre_id: node.x_mitre_id || undefined,
          };
        })
        .filter(node => node.name) as Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }>;

      allResults.push(...pageResults);
      hasNextPage = data.stixDomainObjects.pageInfo.hasNextPage;
      after = data.stixDomainObjects.pageInfo.endCursor;
      pageCount++;

      log.debug(`[OpenCTI] Fetched page ${pageCount} for ${entityType}: ${pageResults.length} items (total: ${allResults.length}, hasMore: ${hasNextPage})`);
    }

    log.info(`[OpenCTI] Completed fetching ${entityType}: ${allResults.length} total items in ${pageCount} pages`);
    return allResults;
  }

  /**
   * Fetch all threat actor groups for caching (with full pagination)
   */
  async fetchThreatActorGroups(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Threat-Actor-Group');
  }

  /**
   * Fetch all threat actor individuals for caching (with full pagination)
   */
  async fetchThreatActorIndividuals(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Threat-Actor-Individual');
  }

  /**
   * Fetch all intrusion sets for caching (with full pagination)
   */
  async fetchIntrusionSets(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Intrusion-Set');
  }

  /**
   * Fetch all campaigns for caching (with full pagination)
   */
  async fetchCampaigns(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Campaign');
  }

  /**
   * Fetch all incidents for caching (with full pagination)
   */
  async fetchIncidents(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Incident');
  }

  /**
   * Fetch all malware for caching (with full pagination)
   */
  async fetchMalware(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Malware');
  }

  /**
   * Fetch all vulnerabilities for caching (with full pagination)
   */
  async fetchVulnerabilities(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Vulnerability');
  }

  /**
   * Fetch all locations (countries, regions, cities) for caching with full pagination
   */
  async fetchLocations(pageSize: number = OpenCTIClient.DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    const query = `
      query FetchLocations($first: Int, $after: ID) {
        locations(first: $first, after: $after) {
          edges {
            node {
              id
              entity_type
              name
              x_opencti_aliases
            }
          }
          pageInfo {
            hasNextPage
            endCursor
            globalCount
          }
        }
      }
    `;

    const allResults: Array<{ id: string; name: string; aliases?: string[] }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;

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
      pageCount++;

      log.debug(`[OpenCTI] Fetched page ${pageCount} for Locations: ${pageResults.length} items (total: ${allResults.length}, hasMore: ${hasNextPage})`);
    }

    log.info(`[OpenCTI] Completed fetching Locations: ${allResults.length} total items in ${pageCount} pages`);
    return allResults;
  }

  /**
   * Fetch all sectors for caching (with full pagination)
   */
  async fetchSectors(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Sector');
  }

  /**
   * Fetch all organizations for caching (with full pagination)
   */
  async fetchOrganizations(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Organization');
  }

  /**
   * Fetch all individuals for caching (with full pagination)
   */
  async fetchIndividuals(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Individual');
  }

  /**
   * Fetch all events for caching (with full pagination)
   */
  async fetchEvents(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Event');
  }

  /**
   * Fetch all attack patterns for caching with full pagination (includes x_mitre_id as separate field)
   */
  async fetchAttackPatterns(): Promise<Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }>> {
    return this.fetchSDOsForCache('Attack-Pattern');
  }

  /**
   * Fetch all countries for caching (with full pagination)
   */
  async fetchCountries(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Country');
  }

  /**
   * Fetch all regions for caching (with full pagination)
   */
  async fetchRegions(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Region');
  }

  /**
   * Fetch all cities for caching (with full pagination)
   */
  async fetchCities(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('City');
  }

  /**
   * Fetch all administrative areas for caching (with full pagination)
   */
  async fetchAdministrativeAreas(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Administrative-Area');
  }

  /**
   * Fetch all positions for caching (with full pagination)
   */
  async fetchPositions(): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    return this.fetchSDOsForCache('Position');
  }

  /**
   * Fetch all labels with full pagination
   */
  async fetchLabels(pageSize: number = OpenCTIClient.DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; value: string; color: string }>> {
    const query = `
      query FetchLabels($first: Int, $after: ID) {
        labels(first: $first, after: $after) {
          edges {
            node {
              id
              value
              color
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const allResults: Array<{ id: string; value: string; color: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage) {
      const data: LabelQueryResponse = await this.query<LabelQueryResponse>(query, { first: pageSize, after });

      const pageResults = data.labels.edges.map((e) => e.node);
      allResults.push(...pageResults);
      hasNextPage = data.labels.pageInfo.hasNextPage;
      after = data.labels.pageInfo.endCursor;
      pageCount++;

      log.debug(`[OpenCTI] Fetched page ${pageCount} for Labels: ${pageResults.length} items (total: ${allResults.length})`);
    }

    log.info(`[OpenCTI] Completed fetching Labels: ${allResults.length} total items in ${pageCount} pages`);
    return allResults;
  }

  /**
   * Fetch all marking definitions with full pagination
   */
  async fetchMarkingDefinitions(pageSize: number = 100): Promise<Array<{ id: string; definition: string; definition_type: string; x_opencti_color: string }>> {
    const query = `
      query FetchMarkingDefinitions($first: Int, $after: ID) {
        markingDefinitions(first: $first, after: $after) {
          edges {
            node {
              id
              definition
              definition_type
              x_opencti_color
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const allResults: Array<{ id: string; definition: string; definition_type: string; x_opencti_color: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage) {
      const data: MarkingQueryResponse = await this.query<MarkingQueryResponse>(query, { first: pageSize, after });

      const pageResults = data.markingDefinitions.edges.map((e) => e.node);
      allResults.push(...pageResults);
      hasNextPage = data.markingDefinitions.pageInfo.hasNextPage;
      after = data.markingDefinitions.pageInfo.endCursor;
      pageCount++;

      log.debug(`[OpenCTI] Fetched page ${pageCount} for MarkingDefinitions: ${pageResults.length} items (total: ${allResults.length})`);
    }

    log.info(`[OpenCTI] Completed fetching MarkingDefinitions: ${allResults.length} total items in ${pageCount} pages`);
    return allResults;
  }

  /**
   * Fetch open vocabulary values by category with full pagination
   * Used for report_types, grouping context, case severity/priority, etc.
   */
  async fetchVocabulary(category: string, pageSize: number = 100): Promise<Array<{ id: string; name: string; description?: string }>> {
    const query = `
      query FetchVocabulary($category: VocabularyCategory!, $first: Int, $after: ID) {
        vocabularies(category: $category, first: $first, after: $after) {
          edges {
            node {
              id
              name
              description
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const allResults: Array<{ id: string; name: string; description?: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage) {
      const data: VocabularyQueryResponse = await this.query<VocabularyQueryResponse>(query, { category, first: pageSize, after });

      const pageResults = data.vocabularies.edges.map((e) => e.node);
      allResults.push(...pageResults);
      hasNextPage = data.vocabularies.pageInfo.hasNextPage;
      after = data.vocabularies.pageInfo.endCursor;
      pageCount++;

      log.debug(`[OpenCTI] Fetched page ${pageCount} for Vocabulary(${category}): ${pageResults.length} items (total: ${allResults.length})`);
    }

    log.info(`[OpenCTI] Completed fetching Vocabulary(${category}): ${allResults.length} total items in ${pageCount} pages`);
    return allResults;
  }

  /**
   * Fetch identities (Organizations, Individuals, Systems) for the createdBy field with full pagination
   */
  async fetchIdentities(pageSize: number = OpenCTIClient.DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; name: string; entity_type: string }>> {
    const query = `
      query FetchIdentities($first: Int, $after: ID) {
        identities(first: $first, after: $after, types: ["Organization", "Individual", "System"]) {
          edges {
            node {
              id
              name
              entity_type
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const allResults: Array<{ id: string; name: string; entity_type: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;

    type IdentityQueryResult = {
        identities: {
          edges: Array<{ node: { id: string; name: string; entity_type: string } }>;
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string;
          };
        };
      };
    while (hasNextPage) {
      const data: IdentityQueryResult = await this.query<IdentityQueryResult>(query, { first: pageSize, after });

      const pageResults = data.identities.edges.map((e) => e.node);
      allResults.push(...pageResults);
      hasNextPage = data.identities.pageInfo.hasNextPage;
      after = data.identities.pageInfo.endCursor;
      pageCount++;

      log.debug(`[OpenCTI] Fetched page ${pageCount} for Identities: ${pageResults.length} items (total: ${allResults.length})`);
    }

    log.info(`[OpenCTI] Completed fetching Identities: ${allResults.length} total items in ${pageCount} pages`);
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
    // Normalize the input type to STIX format (with hyphens)
    // Handles: IPv4Addr -> IPv4-Addr, ipv4-addr -> IPv4-Addr, ipv4addr -> IPv4-Addr
    const normalizeToStixType = (type: string): string => {
      const typeNormalizationMap: Record<string, string> = {
        'ipv4addr': 'IPv4-Addr',
        'ipv4-addr': 'IPv4-Addr',
        'ipv6addr': 'IPv6-Addr',
        'ipv6-addr': 'IPv6-Addr',
        'domainname': 'Domain-Name',
        'domain-name': 'Domain-Name',
        'hostname': 'Hostname',
        'emailaddr': 'Email-Addr',
        'email-addr': 'Email-Addr',
        'url': 'Url',
        'macaddr': 'Mac-Addr',
        'mac-addr': 'Mac-Addr',
        'stixfile': 'StixFile',
        'file': 'StixFile',
        'autonomoussystem': 'Autonomous-System',
        'autonomous-system': 'Autonomous-System',
        'cryptocurrencywallet': 'Cryptocurrency-Wallet',
        'cryptocurrency-wallet': 'Cryptocurrency-Wallet',
        'useragent': 'User-Agent',
        'user-agent': 'User-Agent',
        'phonenumber': 'Phone-Number',
        'phone-number': 'Phone-Number',
        'bankaccount': 'Bank-Account',
        'bank-account': 'Bank-Account',
        'artifact': 'Artifact',
        'directory': 'Directory',
        'emailmessage': 'Email-Message',
        'email-message': 'Email-Message',
        'mutex': 'Mutex',
        'networktraffic': 'Network-Traffic',
        'network-traffic': 'Network-Traffic',
        'process': 'Process',
        'software': 'Software',
        'windowsregistrykey': 'Windows-Registry-Key',
        'windows-registry-key': 'Windows-Registry-Key',
        'windowsregistryvaluetype': 'Windows-Registry-Value-Type',
        'windows-registry-value-type': 'Windows-Registry-Value-Type',
        'x509certificate': 'X509-Certificate',
        'x509-certificate': 'X509-Certificate',
        'paymentcard': 'Payment-Card',
        'payment-card': 'Payment-Card',
        'credential': 'Credential',
        'trackingnumber': 'Tracking-Number',
        'tracking-number': 'Tracking-Number',
        'mediacontent': 'Media-Content',
        'media-content': 'Media-Content',
        'text': 'Text',
      };
      return typeNormalizationMap[type.toLowerCase()] || type;
    };

    // Map STIX type to GraphQL input type (remove hyphens)
    const stixToGqlType: Record<string, string> = {
      'IPv4-Addr': 'IPv4Addr',
      'IPv6-Addr': 'IPv6Addr',
      'Domain-Name': 'DomainName',
      'Hostname': 'Hostname',
      'Email-Addr': 'EmailAddr',
      'Url': 'Url',
      'Mac-Addr': 'MacAddr',
      'StixFile': 'StixFile',
      'Autonomous-System': 'AutonomousSystem',
      'Cryptocurrency-Wallet': 'CryptocurrencyWallet',
      'User-Agent': 'UserAgent',
      'Phone-Number': 'PhoneNumber',
      'Bank-Account': 'BankAccount',
      'Artifact': 'Artifact',
      'Directory': 'Directory',
      'Email-Message': 'EmailMessage',
      'Mutex': 'Mutex',
      'Network-Traffic': 'NetworkTraffic',
      'Process': 'Process',
      'Software': 'Software',
      'Windows-Registry-Key': 'WindowsRegistryKey',
      'Windows-Registry-Value-Type': 'WindowsRegistryValueType',
      'X509-Certificate': 'X509Certificate',
      'Payment-Card': 'PaymentCard',
      'Credential': 'Credential',
      'Tracking-Number': 'TrackingNumber',
      'Media-Content': 'MediaContent',
      'Text': 'Text',
    };

    // Normalize to STIX format first
    const stixType = normalizeToStixType(input.type);
    // Then convert to GraphQL format
    const gqlType = stixToGqlType[stixType] || stixType.replace(/-/g, '');
    
    // Helper to detect hash type from value
    const detectHashType = (value: string): HashType | null => {
      const cleanValue = value.trim().toLowerCase();
      if (/^[a-f0-9]{32}$/i.test(cleanValue)) return 'MD5';
      if (/^[a-f0-9]{40}$/i.test(cleanValue)) return 'SHA-1';
      if (/^[a-f0-9]{64}$/i.test(cleanValue)) return 'SHA-256';
      if (/^[a-f0-9]{128}$/i.test(cleanValue)) return 'SHA-512';
      // SSDEEP format: blocksize:hash1:hash2
      if (/^\d+:[a-z0-9+/]+:[a-z0-9+/]+$/i.test(cleanValue)) return 'SSDEEP';
      return null;
    };
    
    // Build the appropriate input based on observable type
    // Different observable types require different input structures per OpenCTI GraphQL schema
    let observableInput: Record<string, unknown> = {};
    
    const isFileType = stixType === 'StixFile' || gqlType === 'StixFile';
    const isArtifact = stixType === 'Artifact' || gqlType === 'Artifact';
    const isX509 = stixType === 'X509-Certificate' || gqlType === 'X509Certificate';
    
    if (isFileType || isArtifact || isX509) {
      // Hash-based observables: StixFile, Artifact, X509Certificate
      // These types use 'hashes' field, NOT 'value'
      const hashType = input.hashType || detectHashType(input.value);
      if (hashType) {
        observableInput = {
          hashes: [{ algorithm: hashType, hash: input.value }],
        };
      } else if (isFileType) {
        // For StixFile without detectable hash, use name field (filename)
        observableInput = { name: input.value };
      } else if (isArtifact) {
        // For Artifact without hash, use url or payload_bin
        observableInput = input.value.startsWith('http') ? { url: input.value } : { payload_bin: input.value };
      } else if (isX509) {
        // For X509 without hash, use serial_number
        observableInput = { serial_number: input.value };
      }
    } else if (stixType === 'Autonomous-System' || gqlType === 'AutonomousSystem') {
      // AutonomousSystem requires 'number' (Int), not 'value'
      // Extract ASN number from formats like "AS12345", "ASN12345", or just "12345"
      const asnMatch = input.value.match(/(?:AS[N]?)?(\d+)/i);
      const asnNumber = asnMatch ? parseInt(asnMatch[1], 10) : parseInt(input.value, 10);
      observableInput = { number: asnNumber, name: input.value };
    } else if (stixType === 'Bank-Account' || gqlType === 'BankAccount') {
      // BankAccount uses 'iban', 'bic', or 'account_number'
      // IBAN format: 2 letters + 2 digits + up to 30 alphanumeric
      if (/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/i.test(input.value.replace(/\s/g, ''))) {
        observableInput = { iban: input.value.replace(/\s/g, '').toUpperCase() };
      } else if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(input.value.replace(/\s/g, ''))) {
        // BIC/SWIFT format: 8 or 11 characters
        observableInput = { bic: input.value.replace(/\s/g, '').toUpperCase() };
      } else {
        observableInput = { account_number: input.value };
      }
    } else if (stixType === 'Payment-Card' || gqlType === 'PaymentCard') {
      // PaymentCard requires 'card_number'
      observableInput = { card_number: input.value.replace(/[\s-]/g, '') };
    } else if (stixType === 'Media-Content' || gqlType === 'MediaContent') {
      // MediaContent requires 'url'
      observableInput = { url: input.value, title: input.value };
    } else if (stixType === 'Directory' || gqlType === 'Directory') {
      // Directory requires 'path'
      observableInput = { path: input.value };
    } else if (stixType === 'Process' || gqlType === 'Process') {
      // Process requires 'command_line'
      observableInput = { command_line: input.value };
    } else if (stixType === 'Software' || gqlType === 'Software') {
      // Software uses 'name'
      observableInput = { name: input.value };
    } else if (stixType === 'Mutex' || gqlType === 'Mutex') {
      // Mutex uses 'name'
      observableInput = { name: input.value };
    } else if (stixType === 'Windows-Registry-Key' || gqlType === 'WindowsRegistryKey') {
      // WindowsRegistryKey uses 'attribute_key'
      observableInput = { attribute_key: input.value };
    } else if (stixType === 'Windows-Registry-Value-Type' || gqlType === 'WindowsRegistryValueType') {
      // WindowsRegistryValueType uses 'name' and 'data'
      observableInput = { name: input.value, data: input.value };
    } else if (stixType === 'Network-Traffic' || gqlType === 'NetworkTraffic') {
      // NetworkTraffic - try to parse port info
      observableInput = { protocols: ['tcp'] };
    } else if (stixType === 'Email-Message' || gqlType === 'EmailMessage') {
      // EmailMessage uses 'subject' or 'body'
      observableInput = { subject: input.value };
    } else if (stixType === 'User-Account' || gqlType === 'UserAccount') {
      // UserAccount uses 'account_login' or 'user_id'
      observableInput = { account_login: input.value };
    } else {
      // Default: types that use 'value' field
      // IPv4Addr, IPv6Addr, DomainName, Hostname, EmailAddr, Url, MacAddr,
      // CryptocurrencyWallet, UserAgent, PhoneNumber, Text, Credential, TrackingNumber
      observableInput = { value: input.value };
    }

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
          id
          standard_id
          entity_type
          observable_value
        }
      }
    `;

    const variables = {
      type: stixType,  // API expects STIX format like "IPv4-Addr", not "IPv4Addr"
      x_opencti_score: input.score,
      x_opencti_description: input.description,
      createIndicator: input.createIndicator ?? false,
      objectMarking: input.objectMarking,
      objectLabel: input.objectLabel,
      [gqlType]: observableInput,  // But the input variable uses GraphQL format
    };

    const data = await this.query<{
      stixCyberObservableAdd: StixCyberObservable;
    }>(query, variables);

    return data.stixCyberObservableAdd;
  }

  // ============================================================================
  // STIX Domain Object Creation (SDOs - Threat Intelligence entities)
  // ============================================================================

  /**
   * Create an Intrusion Set
   */
  async createIntrusionSet(input: {
    name: string;
    description?: string;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] }> {
    const query = `
      mutation IntrusionSetAdd($input: IntrusionSetAddInput!) {
        intrusionSetAdd(input: $input) {
          id
          standard_id
          entity_type
          name
          aliases
        }
      }
    `;

    const data = await this.query<{
      intrusionSetAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.intrusionSetAdd;
  }

  /**
   * Create a Threat Actor (Group or Individual)
   */
  async createThreatActor(input: {
    name: string;
    description?: string;
    threat_actor_types?: string[];
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] }> {
    const query = `
      mutation ThreatActorGroupAdd($input: ThreatActorGroupAddInput!) {
        threatActorGroupAdd(input: $input) {
          id
          standard_id
          entity_type
          name
          aliases
        }
      }
    `;

    const data = await this.query<{
      threatActorGroupAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        threat_actor_types: input.threat_actor_types || ['unknown'],
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.threatActorGroupAdd;
  }

  /**
   * Create a Malware
   */
  async createMalware(input: {
    name: string;
    description?: string;
    malware_types?: string[];
    is_family?: boolean;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] }> {
    const query = `
      mutation MalwareAdd($input: MalwareAddInput!) {
        malwareAdd(input: $input) {
          id
          standard_id
          entity_type
          name
          aliases
        }
      }
    `;

    const data = await this.query<{
      malwareAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        malware_types: input.malware_types || ['unknown'],
        is_family: input.is_family ?? true,
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.malwareAdd;
  }

  /**
   * Create a Tool
   */
  async createTool(input: {
    name: string;
    description?: string;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] }> {
    const query = `
      mutation ToolAdd($input: ToolAddInput!) {
        toolAdd(input: $input) {
          id
          standard_id
          entity_type
          name
          aliases
        }
      }
    `;

    const data = await this.query<{
      toolAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.toolAdd;
  }

  /**
   * Create a Campaign
   */
  async createCampaign(input: {
    name: string;
    description?: string;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] }> {
    const query = `
      mutation CampaignAdd($input: CampaignAddInput!) {
        campaignAdd(input: $input) {
          id
          standard_id
          entity_type
          name
          aliases
        }
      }
    `;

    const data = await this.query<{
      campaignAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.campaignAdd;
  }

  /**
   * Create a Vulnerability (CVE)
   */
  async createVulnerability(input: {
    name: string;
    description?: string;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string }> {
    const query = `
      mutation VulnerabilityAdd($input: VulnerabilityAddInput!) {
        vulnerabilityAdd(input: $input) {
          id
          standard_id
          entity_type
          name
        }
      }
    `;

    const data = await this.query<{
      vulnerabilityAdd: { id: string; standard_id: string; entity_type: string; name: string };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.vulnerabilityAdd;
  }

  /**
   * Create an Attack Pattern
   */
  async createAttackPattern(input: {
    name: string;
    description?: string;
    x_mitre_id?: string;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string; x_mitre_id?: string; aliases?: string[] }> {
    const query = `
      mutation AttackPatternAdd($input: AttackPatternAddInput!) {
        attackPatternAdd(input: $input) {
          id
          standard_id
          entity_type
          name
          x_mitre_id
          aliases
        }
      }
    `;

    const data = await this.query<{
      attackPatternAdd: { id: string; standard_id: string; entity_type: string; name: string; x_mitre_id?: string; aliases?: string[] };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        x_mitre_id: input.x_mitre_id,
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.attackPatternAdd;
  }

  /**
   * Create a Country
   */
  async createCountry(input: {
    name: string;
    description?: string;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string }> {
    const query = `
      mutation CountryAdd($input: CountryAddInput!) {
        countryAdd(input: $input) {
          id
          standard_id
          entity_type
          name
        }
      }
    `;

    const data = await this.query<{
      countryAdd: { id: string; standard_id: string; entity_type: string; name: string };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.countryAdd;
  }

  /**
   * Create a Sector
   */
  async createSector(input: {
    name: string;
    description?: string;
    objectMarking?: string[];
    objectLabel?: string[];
  }): Promise<{ id: string; standard_id: string; entity_type: string; name: string }> {
    const query = `
      mutation SectorAdd($input: SectorAddInput!) {
        sectorAdd(input: $input) {
          id
          standard_id
          entity_type
          name
        }
      }
    `;

    const data = await this.query<{
      sectorAdd: { id: string; standard_id: string; entity_type: string; name: string };
    }>(query, {
      input: {
        name: input.name,
        description: input.description,
        objectMarking: input.objectMarking,
        objectLabel: input.objectLabel,
      },
    });

    return data.sectorAdd;
  }

  /**
   * Create any entity by type - dispatches to the appropriate creation method
   * Handles both STIX Cyber Observables (SCOs) and STIX Domain Objects (SDOs)
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
    
    // STIX Domain Objects (SDOs) - use name-based creation
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

    // Check if it's an SDO type
    if (sdoTypes[normalizedType]) {
      const result = await sdoTypes[normalizedType]();
      return { ...result, observable_value: undefined };
    }

    // Otherwise, treat as STIX Cyber Observable (SCO)
    if (!input.value) {
      throw new Error(`Observable type "${input.type}" requires a value`);
    }
    
    const observable = await this.createObservable({
      type: input.type as any,
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

  /**
   * Create an external reference
   * External references must be created first and then attached to entities
   */
  async createExternalReference(input: {
    source_name: string;
    url?: string;
    external_id?: string;
    description?: string;
  }): Promise<{ id: string; standard_id: string; url?: string }> {
    const query = `
      mutation ExternalReferenceAdd($input: ExternalReferenceAddInput!) {
        externalReferenceAdd(input: $input) {
          id
          standard_id
          entity_type
          source_name
          description
          url
          external_id
        }
      }
    `;

    const data = await this.query<{
      externalReferenceAdd: { id: string; standard_id: string; url?: string };
    }>(query, { input });

    return data.externalReferenceAdd;
  }

  /**
   * Add an external reference to a STIX Domain Object (like a container)
   */
  async addExternalReferenceToEntity(entityId: string, externalReferenceId: string): Promise<void> {
    const query = `
      mutation StixDomainObjectEditRelationAdd($id: ID!, $input: StixRefRelationshipAddInput!) {
        stixDomainObjectEdit(id: $id) {
          relationAdd(input: $input) {
            id
          }
        }
      }
    `;

    await this.query(query, {
      id: entityId,
      input: {
        toId: externalReferenceId,
        relationship_type: 'external-reference',
      },
    });
  }

  /**
   * Search for external references by URL
   */
  async findExternalReferencesByUrl(url: string): Promise<Array<{ id: string; url: string; source_name: string }>> {
    const query = `
      query ExternalReferences($filters: FilterGroup) {
        externalReferences(filters: $filters, first: 10) {
          edges {
            node {
              id
              standard_id
              source_name
              description
              url
            }
          }
        }
      }
    `;

    const filters = {
      mode: 'and',
      filters: [
        {
          key: 'url',
          values: [url],
          operator: 'eq',
        },
      ],
      filterGroups: [],
    };

    const data = await this.query<{
      externalReferences: {
        edges: Array<{ node: { id: string; url: string; source_name: string } }>;
      };
    }>(query, { filters });

    return data.externalReferences.edges.map(edge => edge.node);
  }

  /**
   * Search for containers that have an external reference with the given URL
   * Two-step process: 1) Find external references by URL, 2) Find containers with those refs
   */
  async findContainersByExternalReferenceUrl(url: string): Promise<StixDomainObject[]> {
    // Step 1: Find external references matching the URL
    const externalRefs = await this.findExternalReferencesByUrl(url);
    
    if (externalRefs.length === 0) {
      return [];
    }

    // Step 2: Search for containers that have these external reference IDs
    const extRefIds = externalRefs.map(ref => ref.id);
    
    const query = `
      ${MARKING_FRAGMENT}
      ${LABEL_FRAGMENT}
      ${IDENTITY_FRAGMENT}
      query FindContainersByExternalRefs($filters: FilterGroup) {
        stixDomainObjects(
          types: ["Report", "Case-Incident", "Case-Rfi", "Case-Rft", "Grouping"]
          filters: $filters
          first: 10
          orderBy: modified
          orderMode: desc
        ) {
          edges {
            node {
              ${SDO_PROPERTIES}
            }
          }
        }
      }
    `;

    // Filter by external reference IDs
    const filters = {
      mode: 'and',
      filters: [
        {
          key: 'externalReferences',
          values: extRefIds,
          operator: 'eq',
        },
      ],
      filterGroups: [],
    };

    const data = await this.query<{
      stixDomainObjects: {
        edges: Array<{ node: StixDomainObject }>;
      };
    }>(query, { filters });

    return data.stixDomainObjects.edges.map(edge => edge.node);
  }

  /**
   * Create a draft workspace
   * Used to create entities in draft mode before validation
   */
  async createDraftWorkspace(name: string): Promise<{ id: string; name: string }> {
    const query = `
      mutation DraftWorkspaceAdd($input: DraftWorkspaceAddInput!) {
        draftWorkspaceAdd(input: $input) {
          id
          name
        }
      }
    `;
    
    const data = await this.query<{
      draftWorkspaceAdd: { id: string; name: string };
    }>(query, { input: { name } });
    
    return data.draftWorkspaceAdd;
  }

  /**
   * Create a new container (Report, Case, Grouping)
   * Each container type has its own mutation and input type
   * If createAsDraft is true, creates a draft workspace first and adds the container to it
   */
  async createContainer(input: ContainerCreateInput): Promise<StixDomainObject & { draftId?: string }> {
    // If creating as draft, first create a draft workspace
    let draftId: string | undefined;
    if (input.createAsDraft) {
      const draftWorkspace = await this.createDraftWorkspace(`Draft - ${input.name}`);
      draftId = draftWorkspace.id;
    }
    
    // Build container input based on type
    const containerInput: Record<string, unknown> = {
      name: input.name,
      description: input.description,
      objects: input.objects,
      objectMarking: input.objectMarking,
      objectLabel: input.objectLabel,
      createdBy: input.createdBy,
    };

    // Add external references for the source URL
    if (input.externalReferences && input.externalReferences.length > 0) {
      containerInput.externalReferences = input.externalReferences;
    }

    let query: string;
    let mutationName: string;

    // Common fields to return for all container types
    const containerFields = `
      id
      standard_id
      entity_type
      name
      description
      created
      modified
      createdBy {
        id
        name
      }
      objectLabel {
        id
        value
        color
      }
      objectMarking {
        id
        definition
        x_opencti_color
      }
    `;

    switch (input.type) {
      case 'Report':
        containerInput.published = input.published || new Date().toISOString();
        containerInput.report_types = input.report_types || ['threat-report'];
        containerInput.content = input.content;
        mutationName = 'reportAdd';
        query = `
          mutation CreateReport($input: ReportAddInput!) {
            reportAdd(input: $input) {
              ${containerFields}
            }
          }
        `;
        break;

      case 'Case-Incident':
        // Use provided values or defaults
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        if (input.response_types && input.response_types.length > 0) {
          containerInput.response_types = input.response_types;
        }
        mutationName = 'caseIncidentAdd';
        query = `
          mutation CreateCaseIncident($input: CaseIncidentAddInput!) {
            caseIncidentAdd(input: $input) {
              ${containerFields}
            }
          }
        `;
        break;

      case 'Case-Rfi':
        containerInput.information_types = ['strategic'];
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        mutationName = 'caseRfiAdd';
        query = `
          mutation CreateCaseRfi($input: CaseRfiAddInput!) {
            caseRfiAdd(input: $input) {
              ${containerFields}
            }
          }
        `;
        break;

      case 'Case-Rft':
        containerInput.takedown_types = ['content'];
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        mutationName = 'caseRftAdd';
        query = `
          mutation CreateCaseRft($input: CaseRftAddInput!) {
            caseRftAdd(input: $input) {
              ${containerFields}
            }
          }
        `;
        break;

      case 'Grouping':
        // Context is mandatory for Grouping
        containerInput.context = input.context || 'suspicious-activity';
        mutationName = 'groupingAdd';
        query = `
          mutation CreateGrouping($input: GroupingAddInput!) {
            groupingAdd(input: $input) {
              ${containerFields}
            }
          }
        `;
        break;

      default:
        throw new Error(`Unsupported container type: ${input.type}`);
    }

    // Execute query with draft context if creating as draft
    const data = await this.query<{
      [key: string]: StixDomainObject;
    }>(query, { input: containerInput }, draftId);

    const container = data[mutationName];
    
    // Return container with draftId if created in draft mode
    if (draftId) {
      return { ...container, draftId };
    }
    
    return container;
  }

  /**
   * Upload a file to a container
   */
  async uploadFileToEntity(
    entityId: string,
    file: { name: string; data: Blob | ArrayBuffer; mimeType: string }
  ): Promise<void> {
    const formData = new FormData();
    
    const operations = JSON.stringify({
      query: `
        mutation StixDomainObjectFileUpload($id: ID!, $file: Upload!) {
          stixDomainObjectEdit(id: $id) {
            importPush(file: $file) {
              id
              name
            }
          }
        }
      `,
      variables: {
        id: entityId,
        file: null,
      },
    });
    
    const map = JSON.stringify({ '0': ['variables.file'] });
    
    formData.append('operations', operations);
    formData.append('map', map);
    formData.append('0', new Blob([file.data], { type: file.mimeType }), file.name);

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'User-Agent': USER_AGENT,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.status}`);
    }
  }

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  /**
   * Global search across all entities
   */
  async globalSearch(
    searchTerm: string,
    types?: string[],
    limit: number = 25
  ): Promise<SearchResult[]> {
    const query = `
      query GlobalSearch($search: String!, $types: [String], $first: Int) {
        stixCoreObjects(search: $search, types: $types, first: $first) {
          edges {
            node {
              id
              entity_type
              representative {
                main
              }
              ... on ThreatActorGroup {
                name
                aliases
              }
              ... on ThreatActorIndividual {
                name
                aliases
              }
              ... on IntrusionSet {
                name
                aliases
              }
              ... on Campaign {
                name
                aliases
              }
              ... on Incident {
                name
                aliases
              }
              ... on Malware {
                name
                aliases
              }
              ... on Vulnerability {
                name
                x_opencti_cvss_base_score
                x_opencti_cvss_base_severity
              }
              ... on Country {
                name
              }
              ... on Region {
                name
              }
              ... on City {
                name
              }
              ... on Sector {
                name
              }
              ... on Organization {
                name
              }
              ... on Individual {
                name
              }
              ... on Event {
                name
              }
              ... on Report {
                name
              }
              ... on Grouping {
                name
              }
              ... on StixCyberObservable {
                observable_value
                x_opencti_score
              }
            }
          }
        }
      }
    `;

    const data = await this.query<{
      stixCoreObjects: {
        edges: Array<{ node: SearchResult }>;
      };
    }>(query, { search: searchTerm, types, first: limit });

    return data.stixCoreObjects.edges.map((e) => e.node);
  }

  /**
   * Get entity URL for direct link to OpenCTI
   */
  getEntityUrl(entityId: string, entityType: string): string {
    const typePathMap: Record<string, string> = {
      'Intrusion-Set': 'threats/intrusion_sets',
      'Malware': 'arsenal/malwares',
      'Threat-Actor': 'threats/threat_actors_group',
      'Campaign': 'threats/campaigns',
      'Vulnerability': 'arsenal/vulnerabilities',
      'Tool': 'arsenal/tools',
      'Attack-Pattern': 'techniques/attack_patterns',
      'Indicator': 'observations/indicators',
      'Report': 'analyses/reports',
      'Case-Incident': 'cases/incidents',
      'Grouping': 'analyses/groupings',
      'Investigation': 'workspaces/investigations',
      // Observables
      'IPv4-Addr': 'observations/observables',
      'IPv6-Addr': 'observations/observables',
      'Domain-Name': 'observations/observables',
      'Url': 'observations/observables',
      'Email-Addr': 'observations/observables',
      'StixFile': 'observations/observables',
      'Artifact': 'observations/observables',
    };

    const path = typePathMap[entityType] || 'dashboard';
    return `${this.baseUrl}/${path}/${entityId}`;
  }

  // ==========================================================================
  // Investigation (Workbench) Operations
  // ==========================================================================

  /**
   * Create a new investigation (workbench)
   */
  async createInvestigation(input: InvestigationCreateInput): Promise<Investigation> {
    const query = `
      mutation CreateInvestigation($input: WorkspaceAddInput!) {
        workspaceAdd(input: $input) {
          id
          name
          description
          type
          investigated_entities_ids
          created_at
          updated_at
        }
      }
    `;

    const workspaceInput = {
      type: 'investigation',
      name: input.name,
      description: input.description,
      investigated_entities_ids: input.investigated_entities_ids || [],
    };

    const data = await this.query<{
      workspaceAdd: Investigation;
    }>(query, { input: workspaceInput });

    return data.workspaceAdd;
  }

  /**
   * Add entities to an existing investigation
   */
  async addEntitiesToInvestigation(
    investigationId: string,
    entityIds: string[]
  ): Promise<Investigation> {
    const query = `
      mutation AddToInvestigation($id: ID!, $input: [EditInput!]!) {
        workspaceFieldPatch(id: $id, input: $input) {
          id
          name
          investigated_entities_ids
        }
      }
    `;

    const data = await this.query<{
      workspaceFieldPatch: Investigation;
    }>(query, {
      id: investigationId,
      input: [{
        key: 'investigated_entities_ids',
        value: entityIds,
        operation: 'add',
      }],
    });

    return data.workspaceFieldPatch;
  }

  /**
   * Create observables and start an investigation with them
   * This is a convenience method that:
   * 1. Creates observables that don't exist
   * 2. Creates an investigation
   * 3. Adds all entities (existing + newly created) to the investigation
   */
  async createInvestigationWithEntities(
    name: string,
    description: string | undefined,
    entities: Array<{
      type: 'observable' | 'sdo';
      existingId?: string;
      newObservable?: {
        type: ObservableType;
        value: string;
        hashType?: HashType;
      };
    }>
  ): Promise<{ investigation: Investigation; createdEntityIds: string[] }> {
    const createdEntityIds: string[] = [];
    const allEntityIds: string[] = [];

    // First, create any new observables
    for (const entity of entities) {
      if (entity.existingId) {
        allEntityIds.push(entity.existingId);
      } else if (entity.newObservable) {
        try {
          const newObs = await this.createObservable({
            type: entity.newObservable.type,
            value: entity.newObservable.value,
            hashType: entity.newObservable.hashType,
          });
          allEntityIds.push(newObs.id);
          createdEntityIds.push(newObs.id);
        } catch (error) {
          log.warn(`Failed to create observable ${entity.newObservable.value}:`, error);
        }
      }
    }

    // Create the investigation with all entity IDs
    const investigation = await this.createInvestigation({
      name,
      description,
      investigated_entities_ids: allEntityIds,
    });

    return { investigation, createdEntityIds };
  }

  /**
   * Get investigation URL for direct link
   */
  getInvestigationUrl(investigationId: string): string {
    return `${this.baseUrl}/dashboard/workspaces/investigations/${investigationId}`;
  }

  /**
   * Fetch containers that contain a specific entity
   * Uses the root containers query with filters and ordering (sorted by created desc)
   */
  async fetchContainersForEntity(entityId: string, limit: number = 10): Promise<Array<{
    id: string;
    entity_type: string;
    name: string;
    created: string;
    modified: string;
    createdBy?: { id: string; name: string };
  }>> {
    // Use root containers query with filters and ordering (like OpenCTI frontend does)
    const query = `
      query GetContainersForEntity(
        $first: Int
        $orderBy: ContainersOrdering
        $orderMode: OrderingMode
        $filters: FilterGroup
      ) {
        containers(
          first: $first
          orderBy: $orderBy
          orderMode: $orderMode
          filters: $filters
        ) {
          edges {
            node {
              id
              entity_type
              created
              modified
              createdBy {
                ... on Identity {
                  id
                  name
                }
              }
              ... on Report {
                name
              }
              ... on Grouping {
                name
              }
              ... on Note {
                attribute_abstract
                content
              }
              ... on Opinion {
                opinion
              }
              ... on ObservedData {
                name
                first_observed
                last_observed
              }
              ... on CaseIncident {
                name
              }
              ... on CaseRfi {
                name
              }
              ... on CaseRft {
                name
              }
              ... on Task {
                name
              }
            }
          }
        }
      }
    `;

    // Build filters to find containers that include this entity
    const filters = {
      mode: 'and',
      filters: [
        {
          key: 'objects',
          values: [entityId],
        },
      ],
      filterGroups: [],
    };

    try {
      const data = await this.query<{
        containers: {
          edges: Array<{
            node: {
              id: string;
              entity_type: string;
              name?: string;
              attribute_abstract?: string;
              content?: string;
              opinion?: string;
              first_observed?: string;
              last_observed?: string;
              created: string;
              modified: string;
              createdBy?: { id: string; name: string };
            };
          }>;
        };
      }>(query, { 
        first: limit, 
        orderBy: 'created',
        orderMode: 'desc',
        filters,
      });

      return data.containers?.edges?.map(edge => {
        const node = edge.node;
        // Determine name based on entity type
        let name = node.name;
        if (!name) {
          if (node.attribute_abstract) {
            name = node.attribute_abstract.substring(0, 50) + (node.attribute_abstract.length > 50 ? '...' : '');
          } else if (node.content) {
            name = node.content.substring(0, 50) + (node.content.length > 50 ? '...' : '');
          } else if (node.opinion) {
            name = `Opinion: ${node.opinion}`;
          } else if (node.first_observed && node.last_observed) {
            name = `Observed Data (${new Date(node.first_observed).toLocaleDateString()})`;
          } else {
            name = node.entity_type;
          }
        }
        return {
          id: node.id,
          entity_type: node.entity_type,
          name,
          created: node.created,
          modified: node.modified,
          createdBy: node.createdBy,
        };
      }) || [];
    } catch (error) {
      log.warn('Failed to fetch containers for entity:', error);
      return [];
    }
  }

  // ==========================================================================
  // Workbench (Investigation) Operations
  // ==========================================================================

  /**
   * Create a workbench (investigation workspace)
   */
  async createWorkbench(input: {
    name: string;
    description?: string;
  }): Promise<{ id: string; name: string }> {
    const query = `
      mutation WorkbenchAdd($input: WorkspaceAddInput!) {
        workspaceAdd(input: $input) {
          id
          name
          entity_type
        }
      }
    `;

    const data = await this.query<{ workspaceAdd: { id: string; name: string; entity_type: string } }>(query, {
      input: {
        name: input.name,
        description: input.description,
        type: 'INVESTIGATION',
      },
    });

    return data.workspaceAdd;
  }

  /**
   * Add entities to a workbench
   */
  async addEntitiesToWorkbench(workbenchId: string, entityIds: string[]): Promise<void> {
    const query = `
      mutation WorkspaceStixCoreObjectsAdd($id: ID!, $toIds: [String]!) {
        workspaceEdit(id: $id) {
          relationAdd(input: { toIds: $toIds, relationship_type: "has" }) {
            id
          }
        }
      }
    `;

    await this.query(query, {
      id: workbenchId,
      toIds: entityIds,
    });
  }

  /**
   * Get workbench URL
   */
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
 * Uses the first configured OpenCTI platform
 */
export async function getOpenCTIClient(): Promise<OpenCTIClient | null> {
  if (clientInstance) {
    return clientInstance;
  }

  const settings = await chrome.storage.local.get('settings') as { settings?: ExtensionSettings };
  const openctiPlatforms = settings.settings?.openctiPlatforms;
  
  // Use the first enabled platform
  const firstPlatform = openctiPlatforms?.find(p => p.enabled && p.url && p.apiToken);
  
  if (!firstPlatform) {
    return null;
  }

  clientInstance = new OpenCTIClient({
    url: firstPlatform.url,
    apiToken: firstPlatform.apiToken,
  });

  return clientInstance;
}

/**
 * Reset the client instance (useful when settings change)
 */
export function resetOpenCTIClient(): void {
  clientInstance = null;
}

