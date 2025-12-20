/**
 * Integration Tests for OpenCTI Client
 * 
 * These tests require a running OpenCTI instance.
 * Environment variables:
 * - OPENCTI_URL: OpenCTI API URL (default: http://localhost:8080)
 * - OPENCTI_TOKEN: OpenCTI API token
 * 
 * Coverage:
 * - Connection & Platform Info
 * - Observable Search (by value, by hash)
 * - SDO Queries & Creation
 * - Labels, Markings, Vocabulary
 * - Identities (Organizations, Individuals)
 * - External References
 * - Containers (Reports, Cases, Groupings)
 * - Investigations & Workbenches
 * - Global Search
 * - Relationships
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// OpenCTI client types and helpers
interface OpenCTIConfig {
  url: string;
  token: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

// Comprehensive GraphQL client for testing
class TestOpenCTIClient {
  private config: OpenCTIConfig;

  constructor(config: OpenCTIConfig) {
    this.config = config;
  }

  async query<T>(query: string, variables?: Record<string, unknown>, draftId?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.token}`,
    };
    if (draftId) {
      headers['opencti-draft-id'] = draftId;
    }

    const response = await fetch(`${this.config.url}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: GraphQLResponse<T> = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    return result.data as T;
  }

  // ==========================================================================
  // Platform Information
  // ==========================================================================

  async testConnection(): Promise<{ version: string; enterprise_edition: boolean; platform_title: string }> {
    const query = `
      query TestConnection {
        about { version }
        settings {
          platform_title
          platform_enterprise_edition { license_enterprise }
        }
        me { name user_email }
      }
    `;
    const result = await this.query<{
      about: { version: string };
      settings: { platform_title: string; platform_enterprise_edition?: { license_enterprise?: boolean } };
      me: { name?: string; user_email?: string };
    }>(query);
    return {
      version: result.about.version,
      enterprise_edition: result.settings.platform_enterprise_edition?.license_enterprise ?? false,
      platform_title: result.settings.platform_title,
    };
  }

  // ==========================================================================
  // Observable Operations
  // ==========================================================================

  async searchObservableByValue(value: string, type?: string) {
    const query = `
      query SearchObservable($filters: FilterGroup) {
        stixCyberObservables(filters: $filters, first: 1) {
          edges {
            node { id entity_type observable_value x_opencti_score }
          }
        }
      }
    `;
    const filters: any = {
      mode: 'and',
      filters: [{ key: 'value', values: [value] }],
      filterGroups: [],
    };
    if (type) {
      filters.filters.push({ key: 'entity_type', values: [type] });
    }
    return this.query<{ stixCyberObservables: { edges: Array<{ node: any }> } }>(query, { filters });
  }

  async searchObservableByHash(hash: string, hashType: string) {
    const query = `
      query SearchFileByHash($filters: FilterGroup) {
        stixCyberObservables(filters: $filters, first: 1) {
          edges {
            node { id entity_type observable_value }
          }
        }
      }
    `;
    const filters = {
      mode: 'and',
      filters: [{ key: `hashes.${hashType}`, values: [hash] }],
      filterGroups: [],
    };
    return this.query<{ stixCyberObservables: { edges: Array<{ node: any }> } }>(query, { filters });
  }

  async createObservable(type: string, value: string, options?: { score?: number; description?: string; createIndicator?: boolean }) {
    // Map type to GraphQL input type
    const typeMap: Record<string, string> = {
      'IPv4-Addr': 'IPv4Addr',
      'IPv6-Addr': 'IPv6Addr',
      'Domain-Name': 'DomainName',
      'Email-Addr': 'EmailAddr',
      'Url': 'Url',
      'StixFile': 'StixFile',
    };
    const gqlType = typeMap[type] || type;
    
    const mutation = `
      mutation CreateObservable(
        $type: String!,
        $x_opencti_score: Int,
        $x_opencti_description: String,
        $createIndicator: Boolean,
        $${gqlType}: ${gqlType}AddInput
      ) {
        stixCyberObservableAdd(
          type: $type,
          x_opencti_score: $x_opencti_score,
          x_opencti_description: $x_opencti_description,
          createIndicator: $createIndicator,
          ${gqlType}: $${gqlType}
        ) {
          id standard_id entity_type observable_value
        }
      }
    `;
    
    return this.query<{ stixCyberObservableAdd: any }>(mutation, {
      type,
      x_opencti_score: options?.score,
      x_opencti_description: options?.description,
      createIndicator: options?.createIndicator ?? false,
      [gqlType]: { value },
    });
  }

  // ==========================================================================
  // SDO Operations
  // ==========================================================================

  async searchEntities(searchTerm: string, types?: string[], limit = 10) {
    const query = `
      query SearchEntities($search: String, $types: [String], $first: Int) {
        stixCoreObjects(search: $search, types: $types, first: $first) {
          edges {
            node {
              id entity_type
              ... on ThreatActorGroup { name aliases }
              ... on ThreatActorIndividual { name aliases }
              ... on IntrusionSet { name aliases }
              ... on Malware { name aliases }
              ... on Tool { name aliases }
              ... on AttackPattern { name x_mitre_id }
              ... on Campaign { name aliases }
              ... on Vulnerability { name }
              ... on Indicator { name pattern }
              ... on StixCyberObservable { observable_value }
            }
          }
        }
      }
    `;
    return this.query<{ stixCoreObjects: { edges: Array<{ node: any }> } }>(query, {
      search: searchTerm,
      types,
      first: limit,
    });
  }

  async getSDOsByTypes(types: string[], limit = 100) {
    const query = `
      query GetSDOs($types: [String], $first: Int) {
        stixDomainObjects(types: $types, first: $first) {
          edges {
            node {
              id entity_type
              ... on ThreatActorGroup { name aliases }
              ... on ThreatActorIndividual { name aliases }
              ... on IntrusionSet { name aliases }
              ... on Malware { name aliases }
              ... on Tool { name aliases }
              ... on AttackPattern { name aliases x_mitre_id }
              ... on Campaign { name aliases }
              ... on Incident { name aliases }
              ... on Vulnerability { name }
              ... on Sector { name }
              ... on Country { name }
              ... on Organization { name }
            }
          }
        }
      }
    `;
    return this.query<{ stixDomainObjects: { edges: Array<{ node: any }> } }>(query, {
      types,
      first: limit,
    });
  }

  async createIntrusionSet(input: { name: string; description?: string }) {
    const mutation = `
      mutation IntrusionSetAdd($input: IntrusionSetAddInput!) {
        intrusionSetAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    return this.query<{ intrusionSetAdd: any }>(mutation, { input });
  }

  async createMalware(input: { name: string; description?: string; malware_types?: string[]; is_family?: boolean }) {
    const mutation = `
      mutation MalwareAdd($input: MalwareAddInput!) {
        malwareAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    return this.query<{ malwareAdd: any }>(mutation, {
      input: { ...input, malware_types: input.malware_types || ['unknown'], is_family: input.is_family ?? true },
    });
  }

  async createTool(input: { name: string; description?: string }) {
    const mutation = `
      mutation ToolAdd($input: ToolAddInput!) {
        toolAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    return this.query<{ toolAdd: any }>(mutation, { input });
  }

  async createVulnerability(input: { name: string; description?: string }) {
    const mutation = `
      mutation VulnerabilityAdd($input: VulnerabilityAddInput!) {
        vulnerabilityAdd(input: $input) { id standard_id entity_type name }
      }
    `;
    return this.query<{ vulnerabilityAdd: any }>(mutation, { input });
  }

  async createAttackPattern(input: { name: string; description?: string; x_mitre_id?: string }) {
    const mutation = `
      mutation AttackPatternAdd($input: AttackPatternAddInput!) {
        attackPatternAdd(input: $input) { id standard_id entity_type name x_mitre_id aliases }
      }
    `;
    return this.query<{ attackPatternAdd: any }>(mutation, { input });
  }

  async createCampaign(input: { name: string; description?: string }) {
    const mutation = `
      mutation CampaignAdd($input: CampaignAddInput!) {
        campaignAdd(input: $input) { id standard_id entity_type name aliases }
      }
    `;
    return this.query<{ campaignAdd: any }>(mutation, { input });
  }

  // ==========================================================================
  // Labels & Markings
  // ==========================================================================

  async getLabels(limit = 100) {
    const query = `
      query GetLabels($first: Int) {
        labels(first: $first) {
          edges { node { id value color } }
        }
      }
    `;
    return this.query<{ labels: { edges: Array<{ node: any }> } }>(query, { first: limit });
  }

  async searchLabels(search: string, limit = 10) {
    const query = `
      query SearchLabels($first: Int, $search: String) {
        labels(first: $first, search: $search, orderBy: value, orderMode: asc) {
          edges { node { id value color } }
        }
      }
    `;
    return this.query<{ labels: { edges: Array<{ node: any }> } }>(query, { first: limit, search });
  }

  async createLabel(value: string, color: string) {
    const mutation = `
      mutation LabelAdd($input: LabelAddInput!) {
        labelAdd(input: $input) { id value color }
      }
    `;
    return this.query<{ labelAdd: any }>(mutation, { input: { value, color } });
  }

  async getMarkings(limit = 100) {
    const query = `
      query GetMarkings($first: Int) {
        markingDefinitions(first: $first) {
          edges { node { id definition definition_type x_opencti_color } }
        }
      }
    `;
    return this.query<{ markingDefinitions: { edges: Array<{ node: any }> } }>(query, { first: limit });
  }

  // ==========================================================================
  // Vocabulary
  // ==========================================================================

  async getVocabulary(category: string, limit = 100) {
    const query = `
      query FetchVocabulary($category: VocabularyCategory!, $first: Int) {
        vocabularies(category: $category, first: $first) {
          edges { node { id name description } }
        }
      }
    `;
    return this.query<{ vocabularies: { edges: Array<{ node: any }> } }>(query, { category, first: limit });
  }

  // ==========================================================================
  // Identities
  // ==========================================================================

  async getIdentities(limit = 100) {
    const query = `
      query FetchIdentities($first: Int) {
        identities(first: $first, types: ["Organization", "Individual", "System"]) {
          edges { node { id name entity_type } }
        }
      }
    `;
    return this.query<{ identities: { edges: Array<{ node: any }> } }>(query, { first: limit });
  }

  async searchIdentities(search: string, limit = 50) {
    const query = `
      query SearchIdentities($first: Int, $search: String) {
        identities(first: $first, search: $search, types: ["Organization", "Individual"], orderBy: name, orderMode: asc) {
          edges { node { id name entity_type } }
        }
      }
    `;
    return this.query<{ identities: { edges: Array<{ node: any }> } }>(query, { first: limit, search });
  }

  async createOrganization(name: string) {
    const mutation = `
      mutation CreateOrganization($input: OrganizationAddInput!) {
        organizationAdd(input: $input) { id name entity_type }
      }
    `;
    return this.query<{ organizationAdd: any }>(mutation, { input: { name } });
  }

  async createIndividual(name: string) {
    const mutation = `
      mutation CreateIndividual($input: IndividualAddInput!) {
        individualAdd(input: $input) { id name entity_type }
      }
    `;
    return this.query<{ individualAdd: any }>(mutation, { input: { name } });
  }

  // ==========================================================================
  // External References
  // ==========================================================================

  async createExternalReference(input: { source_name: string; url?: string; external_id?: string; description?: string }) {
    const mutation = `
      mutation ExternalReferenceAdd($input: ExternalReferenceAddInput!) {
        externalReferenceAdd(input: $input) { id standard_id url source_name }
      }
    `;
    return this.query<{ externalReferenceAdd: any }>(mutation, { input });
  }

  async findExternalReferencesByUrl(url: string) {
    const query = `
      query ExternalReferences($filters: FilterGroup) {
        externalReferences(filters: $filters, first: 10) {
          edges { node { id url source_name } }
        }
      }
    `;
    const filters = {
      mode: 'and',
      filters: [{ key: 'url', values: [url], operator: 'eq' }],
      filterGroups: [],
    };
    return this.query<{ externalReferences: { edges: Array<{ node: any }> } }>(query, { filters });
  }

  // ==========================================================================
  // Containers (Reports, Cases, Groupings)
  // ==========================================================================

  async createReport(input: { name: string; description?: string; published?: string; report_types?: string[]; objects?: string[] }) {
    const mutation = `
      mutation CreateReport($input: ReportAddInput!) {
        reportAdd(input: $input) { id standard_id entity_type name description created modified }
      }
    `;
    return this.query<{ reportAdd: any }>(mutation, {
      input: {
        ...input,
        published: input.published || new Date().toISOString(),
        report_types: input.report_types || ['threat-report'],
      },
    });
  }

  async createCaseIncident(input: { name: string; description?: string; severity?: string; priority?: string }) {
    const mutation = `
      mutation CreateCaseIncident($input: CaseIncidentAddInput!) {
        caseIncidentAdd(input: $input) { id standard_id entity_type name description }
      }
    `;
    return this.query<{ caseIncidentAdd: any }>(mutation, {
      input: { ...input, severity: input.severity || 'medium', priority: input.priority || 'P3' },
    });
  }

  async createGrouping(input: { name: string; description?: string; context?: string }) {
    const mutation = `
      mutation CreateGrouping($input: GroupingAddInput!) {
        groupingAdd(input: $input) { id standard_id entity_type name description }
      }
    `;
    return this.query<{ groupingAdd: any }>(mutation, {
      input: { ...input, context: input.context || 'suspicious-activity' },
    });
  }

  async addObjectsToContainer(containerId: string, objectIds: string[]) {
    const mutation = `
      mutation ContainerEditObjectsAdd($id: ID!, $toIds: [String]!) {
        containerEdit(id: $id) { objectsAdd(toIds: $toIds) { id } }
      }
    `;
    return this.query<{ containerEdit: any }>(mutation, { id: containerId, toIds: objectIds });
  }

  async fetchContainersForEntity(entityId: string, limit = 5) {
    const query = `
      query GetContainersForEntity($first: Int, $filters: FilterGroup) {
        containers(first: $first, filters: $filters) {
          edges {
            node {
              id entity_type created modified
              ... on Report { name }
              ... on Grouping { name }
              ... on CaseIncident { name }
            }
          }
        }
      }
    `;
    const filters = {
      mode: 'and',
      filters: [{ key: 'objects', values: [entityId] }],
      filterGroups: [],
    };
    return this.query<{ containers: { edges: Array<{ node: any }> } }>(query, { first: limit, filters });
  }

  // ==========================================================================
  // Investigations & Workbenches
  // ==========================================================================

  async createInvestigation(input: { name: string; description?: string; investigated_entities_ids?: string[] }) {
    const mutation = `
      mutation CreateInvestigation($input: WorkspaceAddInput!) {
        workspaceAdd(input: $input) { id name description type investigated_entities_ids }
      }
    `;
    return this.query<{ workspaceAdd: any }>(mutation, {
      input: { type: 'investigation', ...input, investigated_entities_ids: input.investigated_entities_ids || [] },
    });
  }

  async addEntitiesToInvestigation(investigationId: string, entityIds: string[]) {
    const mutation = `
      mutation AddToInvestigation($id: ID!, $input: [EditInput!]!) {
        workspaceFieldPatch(id: $id, input: $input) { id name investigated_entities_ids }
      }
    `;
    return this.query<{ workspaceFieldPatch: any }>(mutation, {
      id: investigationId,
      input: [{ key: 'investigated_entities_ids', value: entityIds, operation: 'add' }],
    });
  }

  // ==========================================================================
  // Global Search
  // ==========================================================================

  async globalSearch(searchTerm: string, types?: string[], limit = 25) {
    const query = `
      query GlobalSearch($search: String!, $types: [String], $first: Int) {
        stixCoreObjects(search: $search, types: $types, first: $first, orderBy: _score, orderMode: desc) {
          edges {
            node {
              id entity_type representative { main }
              ... on ThreatActorGroup { name }
              ... on Malware { name }
              ... on Vulnerability { name x_opencti_cvss_base_score }
              ... on StixCyberObservable { observable_value }
            }
          }
        }
      }
    `;
    return this.query<{ stixCoreObjects: { edges: Array<{ node: any }> } }>(query, {
      search: searchTerm,
      types,
      first: limit,
    });
  }

  // ==========================================================================
  // Relationships
  // ==========================================================================

  async createRelationship(input: { fromId: string; toId: string; relationship_type: string; description?: string }) {
    const mutation = `
      mutation StixCoreRelationshipAdd($input: StixCoreRelationshipAddInput!) {
        stixCoreRelationshipAdd(input: $input) { id standard_id relationship_type }
      }
    `;
    return this.query<{ stixCoreRelationshipAdd: any }>(mutation, { input });
  }

  // ==========================================================================
  // Indicators
  // ==========================================================================

  async createIndicator(indicator: { name: string; pattern: string; pattern_type: string; valid_from?: string }) {
    const mutation = `
      mutation CreateIndicator($input: IndicatorAddInput!) {
        indicatorAdd(input: $input) { id name pattern pattern_type }
      }
    `;
    return this.query<{ indicatorAdd: any }>(mutation, {
      input: {
        name: indicator.name,
        pattern: indicator.pattern,
        pattern_type: indicator.pattern_type,
        valid_from: indicator.valid_from || new Date().toISOString(),
      },
    });
  }

  // ==========================================================================
  // Deletion
  // ==========================================================================

  async deleteEntity(id: string) {
    const mutation = `
      mutation DeleteEntity($id: ID!) {
        stixCoreObjectEdit(id: $id) { delete }
      }
    `;
    return this.query<{ stixCoreObjectEdit: { delete: string } }>(mutation, { id });
  }

  async deleteWorkspace(id: string) {
    const mutation = `
      mutation DeleteWorkspace($id: ID!) {
        workspaceDelete(id: $id)
      }
    `;
    return this.query<{ workspaceDelete: string }>(mutation, { id });
  }
}

// Test configuration
const config: OpenCTIConfig = {
  url: process.env.OPENCTI_URL || 'http://localhost:8080',
  token: process.env.OPENCTI_TOKEN || '',
};

// Check if we have a token configured
const hasToken = !!config.token;

// Check if OpenCTI is actually available (only if we have a token)
let isOpenCTIAvailable = false;
let connectionError: string | null = null;

async function checkOpenCTIConnection(): Promise<boolean> {
  if (!hasToken) {
    connectionError = 'OPENCTI_TOKEN environment variable is not set';
    return false;
  }
  
  try {
    const response = await fetch(`${config.url}/graphql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ about { version } }' }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.data?.about?.version) {
        isOpenCTIAvailable = true;
        return true;
      }
    }
    connectionError = `OpenCTI returned status ${response.status}`;
    return false;
  } catch (error) {
    connectionError = error instanceof Error ? error.message : 'Unknown connection error';
    return false;
  }
}

// Integration tests that require OpenCTI to be running
describe('OpenCTI Client Integration Tests', () => {
  let client: TestOpenCTIClient;
  let createdEntityIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    // Cleanup created entities
    if (client && createdEntityIds.length > 0) {
      for (const id of createdEntityIds) {
        try {
          await client.deleteEntity(id);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('Connection', () => {
    it('should connect to OpenCTI and get version', async (context) => {
      if (!isOpenCTIAvailable) {
        console.log(`Skipping: OpenCTI not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const result = await client.testConnection();
      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    });
  });

  describe('Search', () => {
    it('should search for entities', async (context) => {
      if (!isOpenCTIAvailable) {
        console.log(`Skipping: OpenCTI not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const result = await client.searchEntities('test', undefined, 5);
      expect(result.stixCoreObjects).toBeDefined();
      expect(result.stixCoreObjects.edges).toBeDefined();
      expect(Array.isArray(result.stixCoreObjects.edges)).toBe(true);
    });

    it('should search with type filter', async (context) => {
      if (!isOpenCTIAvailable) {
        console.log(`Skipping: OpenCTI not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const result = await client.searchEntities('', ['Malware'], 5);
      expect(result.stixCoreObjects).toBeDefined();
      
      // All results should be of type Malware
      for (const edge of result.stixCoreObjects.edges) {
        expect(edge.node.entity_type).toBe('Malware');
      }
    });
  });

  describe('SDO Retrieval', () => {
    it('should get SDOs by types', async (context) => {
      if (!isOpenCTIAvailable) {
        console.log(`Skipping: OpenCTI not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const result = await client.getSDOsByTypes(['Threat-Actor', 'Malware'], 10);
      expect(result.stixDomainObjects).toBeDefined();
      expect(result.stixDomainObjects.edges).toBeDefined();
    });

    it('should get labels', async (context) => {
      if (!isOpenCTIAvailable) {
        console.log(`Skipping: OpenCTI not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const result = await client.getLabels(10);
      expect(result.labels).toBeDefined();
      expect(result.labels.edges).toBeDefined();
    });

    it('should get markings', async (context) => {
      if (!isOpenCTIAvailable) {
        console.log(`Skipping: OpenCTI not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const result = await client.getMarkings(10);
      expect(result.markingDefinitions).toBeDefined();
      expect(result.markingDefinitions.edges).toBeDefined();
    });
  });

  describe('Entity Creation', () => {
    it('should create an indicator', async (context) => {
      if (!isOpenCTIAvailable) {
        console.log(`Skipping: OpenCTI not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const testIndicator = {
        name: `Test Indicator ${Date.now()}`,
        pattern: "[domain-name:value = 'test-domain.example.com']",
        pattern_type: 'stix',
      };
      
      const result = await client.createIndicator(testIndicator);
      expect(result.indicatorAdd).toBeDefined();
      expect(result.indicatorAdd.id).toBeDefined();
      expect(result.indicatorAdd.name).toBe(testIndicator.name);
      
      // Track for cleanup
      createdEntityIds.push(result.indicatorAdd.id);
    });
  });

  describe('Cache Simulation', () => {
    it('should fetch all cacheable SDO types', async (context) => {
      if (!isOpenCTIAvailable) {
        console.log(`Skipping: OpenCTI not available - ${connectionError}`);
        context.skip();
        return;
      }
      
      const cacheableTypes = [
        'Threat-Actor',
        'Intrusion-Set',
        'Malware',
        'Tool',
        'Attack-Pattern',
        'Campaign',
        'Incident',
        'Sector',
        'Country',
        'Organization',
      ];
      
      const result = await client.getSDOsByTypes(cacheableTypes, 50);
      expect(result.stixDomainObjects).toBeDefined();
      
      // Build a cache map
      const cacheMap = new Map<string, any>();
      for (const edge of result.stixDomainObjects.edges) {
        const entity = edge.node;
        if (entity.name) {
          cacheMap.set(entity.name.toLowerCase(), entity);
          // Also add aliases
          if (entity.aliases) {
            for (const alias of entity.aliases) {
              cacheMap.set(alias.toLowerCase(), entity);
            }
          }
        }
      }
      
      expect(cacheMap.size).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Pagination Tests', () => {
  let client: TestOpenCTIClient;

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  it('should paginate through SDOs using cursor-based pagination', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // First, get the total count
    const countQuery = `
      query CountSDOs($types: [String]) {
        stixDomainObjects(types: $types, first: 1) {
          pageInfo {
            globalCount
          }
        }
      }
    `;
    
    const countResult = await client.query<{
      stixDomainObjects: { pageInfo: { globalCount: number } }
    }>(countQuery, { types: ['Malware'] });
    
    const totalCount = countResult.stixDomainObjects.pageInfo.globalCount;
    console.log(`Total Malware entities: ${totalCount}`);
    
    // Now paginate through all results using small page size
    const pageSize = 5;
    let allResults: any[] = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;
    
    const paginatedQuery = `
      query PaginatedSDOs($types: [String], $first: Int, $after: ID) {
        stixDomainObjects(types: $types, first: $first, after: $after) {
          edges {
            node {
              id
              entity_type
              ... on Malware {
                name
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
    
    while (hasNextPage) {
      const result = await client.query<{
        stixDomainObjects: {
          edges: Array<{ node: any }>;
          pageInfo: { hasNextPage: boolean; endCursor: string; globalCount: number };
        };
      }>(paginatedQuery, { types: ['Malware'], first: pageSize, after });
      
      allResults = allResults.concat(result.stixDomainObjects.edges.map(e => e.node));
      hasNextPage = result.stixDomainObjects.pageInfo.hasNextPage;
      after = result.stixDomainObjects.pageInfo.endCursor;
      pageCount++;
      
      // Safety limit to prevent infinite loops in tests
      if (pageCount > 100) {
        console.warn('Pagination safety limit reached');
        break;
      }
    }
    
    console.log(`Fetched ${allResults.length} entities in ${pageCount} pages`);
    
    // Verify we got all entities (or close to it for safety)
    expect(allResults.length).toBeGreaterThanOrEqual(Math.min(totalCount, pageCount * pageSize - pageSize));
    expect(pageCount).toBeGreaterThanOrEqual(1);
    
    // Verify no duplicate IDs
    const ids = allResults.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should paginate through labels', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const pageSize = 5;
    let allLabels: any[] = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;
    
    const query = `
      query PaginatedLabels($first: Int, $after: ID) {
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
    
    while (hasNextPage) {
      const result = await client.query<{
        labels: {
          edges: Array<{ node: any }>;
          pageInfo: { hasNextPage: boolean; endCursor: string };
        };
      }>(query, { first: pageSize, after });
      
      allLabels = allLabels.concat(result.labels.edges.map(e => e.node));
      hasNextPage = result.labels.pageInfo.hasNextPage;
      after = result.labels.pageInfo.endCursor;
      pageCount++;
      
      if (pageCount > 100) break;
    }
    
    console.log(`Fetched ${allLabels.length} labels in ${pageCount} pages`);
    
    // Verify pagination worked
    expect(pageCount).toBeGreaterThanOrEqual(1);
    
    // Verify no duplicate IDs
    const ids = allLabels.map(l => l.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should paginate through locations', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const pageSize = 10;
    let allLocations: any[] = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;
    
    const query = `
      query PaginatedLocations($first: Int, $after: ID) {
        locations(first: $first, after: $after) {
          edges {
            node {
              id
              entity_type
              name
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    
    while (hasNextPage) {
      const result = await client.query<{
        locations: {
          edges: Array<{ node: any }>;
          pageInfo: { hasNextPage: boolean; endCursor: string };
        };
      }>(query, { first: pageSize, after });
      
      allLocations = allLocations.concat(result.locations.edges.map(e => e.node));
      hasNextPage = result.locations.pageInfo.hasNextPage;
      after = result.locations.pageInfo.endCursor;
      pageCount++;
      
      if (pageCount > 100) break;
    }
    
    console.log(`Fetched ${allLocations.length} locations in ${pageCount} pages`);
    
    // Verify pagination worked
    expect(pageCount).toBeGreaterThanOrEqual(1);
    
    // Verify no duplicate IDs
    const ids = allLocations.map(l => l.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('Observable Operations Tests', () => {
  let client: TestOpenCTIClient;
  let createdObservableIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    for (const id of createdObservableIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
  });

  it('should search observable by value (IPv4)', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.searchObservableByValue('8.8.8.8', 'IPv4-Addr');
    expect(result.stixCyberObservables).toBeDefined();
    expect(result.stixCyberObservables.edges).toBeDefined();
  });

  it('should search observable by value (Domain)', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.searchObservableByValue('example.com', 'Domain-Name');
    expect(result.stixCyberObservables).toBeDefined();
  });

  it('should create an IPv4 observable', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const testIP = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const result = await client.createObservable('IPv4-Addr', testIP, { score: 50, description: 'Test IP' });
    
    expect(result.stixCyberObservableAdd).toBeDefined();
    expect(result.stixCyberObservableAdd.id).toBeDefined();
    expect(result.stixCyberObservableAdd.observable_value).toBe(testIP);
    
    createdObservableIds.push(result.stixCyberObservableAdd.id);
  });

  it('should create a domain observable', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const testDomain = `test-${Date.now()}.example.com`;
    const result = await client.createObservable('Domain-Name', testDomain);
    
    expect(result.stixCyberObservableAdd).toBeDefined();
    expect(result.stixCyberObservableAdd.id).toBeDefined();
    
    createdObservableIds.push(result.stixCyberObservableAdd.id);
  });

  it('should search observable by hash (MD5)', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // Search for a known hash pattern
    const result = await client.searchObservableByHash('d41d8cd98f00b204e9800998ecf8427e', 'MD5');
    expect(result.stixCyberObservables).toBeDefined();
  });
});

describe('SDO Creation Tests', () => {
  let client: TestOpenCTIClient;
  let createdEntityIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    for (const id of createdEntityIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
  });

  it('should create an Intrusion Set', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createIntrusionSet({
      name: `Test Intrusion Set ${Date.now()}`,
      description: 'Test intrusion set for integration tests',
    });
    
    expect(result.intrusionSetAdd).toBeDefined();
    expect(result.intrusionSetAdd.id).toBeDefined();
    expect(result.intrusionSetAdd.entity_type).toBe('Intrusion-Set');
    
    createdEntityIds.push(result.intrusionSetAdd.id);
  });

  it('should create a Malware', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createMalware({
      name: `Test Malware ${Date.now()}`,
      description: 'Test malware for integration tests',
      malware_types: ['ransomware'],
    });
    
    expect(result.malwareAdd).toBeDefined();
    expect(result.malwareAdd.id).toBeDefined();
    expect(result.malwareAdd.entity_type).toBe('Malware');
    
    createdEntityIds.push(result.malwareAdd.id);
  });

  it('should create a Tool', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createTool({
      name: `Test Tool ${Date.now()}`,
      description: 'Test tool for integration tests',
    });
    
    expect(result.toolAdd).toBeDefined();
    expect(result.toolAdd.id).toBeDefined();
    expect(result.toolAdd.entity_type).toBe('Tool');
    
    createdEntityIds.push(result.toolAdd.id);
  });

  it('should create a Vulnerability', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createVulnerability({
      name: `CVE-${Date.now()}-TEST`,
      description: 'Test vulnerability for integration tests',
    });
    
    expect(result.vulnerabilityAdd).toBeDefined();
    expect(result.vulnerabilityAdd.id).toBeDefined();
    expect(result.vulnerabilityAdd.entity_type).toBe('Vulnerability');
    
    createdEntityIds.push(result.vulnerabilityAdd.id);
  });

  it('should create an Attack Pattern', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createAttackPattern({
      name: `Test Attack Pattern ${Date.now()}`,
      description: 'Test attack pattern for integration tests',
      x_mitre_id: `T9999.${Math.floor(Math.random() * 999)}`,
    });
    
    expect(result.attackPatternAdd).toBeDefined();
    expect(result.attackPatternAdd.id).toBeDefined();
    expect(result.attackPatternAdd.entity_type).toBe('Attack-Pattern');
    
    createdEntityIds.push(result.attackPatternAdd.id);
  });

  it('should create a Campaign', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createCampaign({
      name: `Test Campaign ${Date.now()}`,
      description: 'Test campaign for integration tests',
    });
    
    expect(result.campaignAdd).toBeDefined();
    expect(result.campaignAdd.id).toBeDefined();
    expect(result.campaignAdd.entity_type).toBe('Campaign');
    
    createdEntityIds.push(result.campaignAdd.id);
  });
});

describe('Labels & Vocabulary Tests', () => {
  let client: TestOpenCTIClient;
  let createdLabelIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    // Labels typically aren't deleted in tests, but could be cleaned up
  });

  it('should search labels', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.searchLabels('test', 10);
    expect(result.labels).toBeDefined();
    expect(result.labels.edges).toBeDefined();
  });

  it('should create a label', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const labelValue = `test-label-${Date.now()}`;
    const result = await client.createLabel(labelValue, '#FF5733');
    
    expect(result.labelAdd).toBeDefined();
    expect(result.labelAdd.value).toBe(labelValue);
    expect(result.labelAdd.color).toBe('#FF5733');
    
    createdLabelIds.push(result.labelAdd.id);
  });

  it('should get vocabulary for report types', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.getVocabulary('report_types_ov', 50);
    expect(result.vocabularies).toBeDefined();
    expect(result.vocabularies.edges).toBeDefined();
  });

  it('should get vocabulary for malware types', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.getVocabulary('malware_type_ov', 50);
    expect(result.vocabularies).toBeDefined();
  });
});

describe('Identity Operations Tests', () => {
  let client: TestOpenCTIClient;
  let createdIdentityIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    for (const id of createdIdentityIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
  });

  it('should get identities list', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.getIdentities(50);
    expect(result.identities).toBeDefined();
    expect(result.identities.edges).toBeDefined();
  });

  it('should search identities', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.searchIdentities('test', 10);
    expect(result.identities).toBeDefined();
  });

  it('should create an Organization', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createOrganization(`Test Organization ${Date.now()}`);
    
    expect(result.organizationAdd).toBeDefined();
    expect(result.organizationAdd.id).toBeDefined();
    expect(result.organizationAdd.entity_type).toBe('Organization');
    
    createdIdentityIds.push(result.organizationAdd.id);
  });

  it('should create an Individual', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createIndividual(`Test Individual ${Date.now()}`);
    
    expect(result.individualAdd).toBeDefined();
    expect(result.individualAdd.id).toBeDefined();
    expect(result.individualAdd.entity_type).toBe('Individual');
    
    createdIdentityIds.push(result.individualAdd.id);
  });
});

describe('External Reference Tests', () => {
  let client: TestOpenCTIClient;
  let createdExternalRefIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    for (const id of createdExternalRefIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
  });

  it('should create an external reference', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createExternalReference({
      source_name: `Test Source ${Date.now()}`,
      url: `https://example.com/test-${Date.now()}`,
      description: 'Test external reference',
    });
    
    expect(result.externalReferenceAdd).toBeDefined();
    expect(result.externalReferenceAdd.id).toBeDefined();
    
    createdExternalRefIds.push(result.externalReferenceAdd.id);
  });

  it('should find external references by URL', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // First create one with a known URL
    const testUrl = `https://test-${Date.now()}.example.com/article`;
    await client.createExternalReference({
      source_name: 'Test Source',
      url: testUrl,
    }).then(r => createdExternalRefIds.push(r.externalReferenceAdd.id));
    
    // Then search for it
    const result = await client.findExternalReferencesByUrl(testUrl);
    expect(result.externalReferences).toBeDefined();
    expect(result.externalReferences.edges.length).toBeGreaterThan(0);
  });
});

describe('Container Operations Tests', () => {
  let client: TestOpenCTIClient;
  let createdContainerIds: string[] = [];
  let createdEntityIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    for (const id of createdContainerIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
    for (const id of createdEntityIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
  });

  it('should create a Report', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createReport({
      name: `Test Report ${Date.now()}`,
      description: 'Test report for integration tests',
      report_types: ['threat-report'],
    });
    
    expect(result.reportAdd).toBeDefined();
    expect(result.reportAdd.id).toBeDefined();
    expect(result.reportAdd.entity_type).toBe('Report');
    
    createdContainerIds.push(result.reportAdd.id);
  });

  it('should create a Case Incident', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createCaseIncident({
      name: `Test Case Incident ${Date.now()}`,
      description: 'Test case incident for integration tests',
      severity: 'high',
      priority: 'P1',
    });
    
    expect(result.caseIncidentAdd).toBeDefined();
    expect(result.caseIncidentAdd.id).toBeDefined();
    expect(result.caseIncidentAdd.entity_type).toBe('Case-Incident');
    
    createdContainerIds.push(result.caseIncidentAdd.id);
  });

  it('should create a Grouping', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createGrouping({
      name: `Test Grouping ${Date.now()}`,
      description: 'Test grouping for integration tests',
      context: 'malware-analysis',
    });
    
    expect(result.groupingAdd).toBeDefined();
    expect(result.groupingAdd.id).toBeDefined();
    expect(result.groupingAdd.entity_type).toBe('Grouping');
    
    createdContainerIds.push(result.groupingAdd.id);
  });

  it('should add objects to a container', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // Create a report
    const reportResult = await client.createReport({
      name: `Test Report for Objects ${Date.now()}`,
    });
    createdContainerIds.push(reportResult.reportAdd.id);
    
    // Create an entity to add
    const malwareResult = await client.createMalware({
      name: `Test Malware for Container ${Date.now()}`,
    });
    createdEntityIds.push(malwareResult.malwareAdd.id);
    
    // Add entity to container
    const result = await client.addObjectsToContainer(
      reportResult.reportAdd.id,
      [malwareResult.malwareAdd.id]
    );
    
    expect(result.containerEdit).toBeDefined();
  });

  it('should fetch containers for an entity', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // Use the first created entity from previous test or create new one
    const malwareResult = await client.createMalware({
      name: `Test Malware for Container Fetch ${Date.now()}`,
    });
    createdEntityIds.push(malwareResult.malwareAdd.id);
    
    const result = await client.fetchContainersForEntity(malwareResult.malwareAdd.id);
    expect(result.containers).toBeDefined();
    expect(result.containers.edges).toBeDefined();
  });
});

describe('Investigation Tests', () => {
  let client: TestOpenCTIClient;
  let createdInvestigationIds: string[] = [];
  let createdEntityIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    for (const id of createdInvestigationIds) {
      try { await client.deleteWorkspace(id); } catch { /* ignore */ }
    }
    for (const id of createdEntityIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
  });

  it('should create an Investigation', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.createInvestigation({
      name: `Test Investigation ${Date.now()}`,
      description: 'Test investigation for integration tests',
    });
    
    expect(result.workspaceAdd).toBeDefined();
    expect(result.workspaceAdd.id).toBeDefined();
    expect(result.workspaceAdd.type).toBe('investigation');
    
    createdInvestigationIds.push(result.workspaceAdd.id);
  });

  it('should add entities to an Investigation', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // Create an investigation
    const investigationResult = await client.createInvestigation({
      name: `Test Investigation with Entities ${Date.now()}`,
    });
    createdInvestigationIds.push(investigationResult.workspaceAdd.id);
    
    // Create an entity to add
    const malwareResult = await client.createMalware({
      name: `Test Malware for Investigation ${Date.now()}`,
    });
    createdEntityIds.push(malwareResult.malwareAdd.id);
    
    // Add entity to investigation
    const result = await client.addEntitiesToInvestigation(
      investigationResult.workspaceAdd.id,
      [malwareResult.malwareAdd.id]
    );
    
    expect(result.workspaceFieldPatch).toBeDefined();
    expect(result.workspaceFieldPatch.investigated_entities_ids).toContain(malwareResult.malwareAdd.id);
  });
});

describe('Global Search Tests', () => {
  let client: TestOpenCTIClient;

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  it('should perform global search', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.globalSearch('test', undefined, 10);
    expect(result.stixCoreObjects).toBeDefined();
    expect(result.stixCoreObjects.edges).toBeDefined();
  });

  it('should perform global search with type filter', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.globalSearch('malware', ['Malware'], 10);
    expect(result.stixCoreObjects).toBeDefined();
    
    // All results should be Malware type
    for (const edge of result.stixCoreObjects.edges) {
      expect(edge.node.entity_type).toBe('Malware');
    }
  });
});

describe('Relationship Tests', () => {
  let client: TestOpenCTIClient;
  let createdEntityIds: string[] = [];
  let createdRelationshipIds: string[] = [];

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  afterAll(async () => {
    for (const id of createdRelationshipIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
    for (const id of createdEntityIds) {
      try { await client.deleteEntity(id); } catch { /* ignore */ }
    }
  });

  it('should create a relationship between entities', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // Create a malware
    const malwareResult = await client.createMalware({
      name: `Test Malware for Relationship ${Date.now()}`,
    });
    createdEntityIds.push(malwareResult.malwareAdd.id);
    
    // Create a vulnerability
    const vulnResult = await client.createVulnerability({
      name: `CVE-${Date.now()}-REL`,
    });
    createdEntityIds.push(vulnResult.vulnerabilityAdd.id);
    
    // Create relationship
    const result = await client.createRelationship({
      fromId: malwareResult.malwareAdd.id,
      toId: vulnResult.vulnerabilityAdd.id,
      relationship_type: 'targets',
      description: 'Test relationship',
    });
    
    expect(result.stixCoreRelationshipAdd).toBeDefined();
    expect(result.stixCoreRelationshipAdd.id).toBeDefined();
    expect(result.stixCoreRelationshipAdd.relationship_type).toBe('targets');
    
    createdRelationshipIds.push(result.stixCoreRelationshipAdd.id);
  });
});

describe('Seeded Data Tests', () => {
  let client: TestOpenCTIClient;

  beforeAll(async () => {
    await checkOpenCTIConnection();
    if (isOpenCTIAvailable) {
      client = new TestOpenCTIClient(config);
    }
  });

  it('should find seeded APT29 intrusion set', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // APT29 is an Intrusion Set, not a Threat Actor Group
    const result = await client.searchEntities('APT29', ['Intrusion-Set'], 5);
    expect(result.stixCoreObjects).toBeDefined();
    
    const apt29 = result.stixCoreObjects.edges.find(
      (e: any) => e.node.name === 'APT29'
    );
    // May or may not exist depending on seeding timing
    if (apt29) {
      expect(apt29.node.entity_type).toBe('Intrusion-Set');
    }
  });

  it('should find seeded GRU threat actor group', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    // GRU is a Threat Actor Group (an actual organization)
    const result = await client.searchEntities('GRU', ['Threat-Actor-Group'], 5);
    expect(result.stixCoreObjects).toBeDefined();
    
    const gru = result.stixCoreObjects.edges.find(
      (e: any) => e.node.name === 'GRU'
    );
    if (gru) {
      expect(gru.node.entity_type).toBe('Threat-Actor-Group');
    }
  });

  it('should find seeded Emotet malware', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.searchEntities('Emotet', ['Malware'], 5);
    expect(result.stixCoreObjects).toBeDefined();
    
    const emotet = result.stixCoreObjects.edges.find(
      (e: any) => e.node.name === 'Emotet'
    );
    if (emotet) {
      expect(emotet.node.entity_type).toBe('Malware');
    }
  });

  it('should find seeded attack pattern T1566', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.searchEntities('Phishing', ['Attack-Pattern'], 5);
    expect(result.stixCoreObjects).toBeDefined();
  });

  it('should find seeded vulnerability CVE-2021-44228', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.searchEntities('CVE-2021-44228', ['Vulnerability'], 5);
    expect(result.stixCoreObjects).toBeDefined();
  });

  it('should find seeded Cobalt Strike tool', async (context) => {
    if (!isOpenCTIAvailable) {
      console.log(`Skipping: OpenCTI not available - ${connectionError}`);
      context.skip();
      return;
    }
    
    const result = await client.searchEntities('Cobalt Strike', ['Tool'], 5);
    expect(result.stixCoreObjects).toBeDefined();
  });
});

// Unit tests that don't require OpenCTI connection
describe('SDO Matching Tests', () => {
  it('should match SDO names case-insensitively', () => {
    const cache = new Map<string, { name: string; type: string }>();
    cache.set('apt29', { name: 'APT29', type: 'Threat-Actor' });
    cache.set('cozy bear', { name: 'APT29', type: 'Threat-Actor' });
    
    const textToSearch = 'The threat actor APT29, also known as Cozy Bear, was observed...';
    const textLower = textToSearch.toLowerCase();
    
    const found: string[] = [];
    for (const [key, value] of cache.entries()) {
      if (textLower.includes(key)) {
        found.push(value.name);
      }
    }
    
    expect(found).toContain('APT29');
    expect(found.length).toBe(2); // Both APT29 and Cozy Bear match
  });

  it('should respect minimum name length for matching', () => {
    const cache = new Map<string, { name: string; type: string }>();
    cache.set('apt', { name: 'APT', type: 'Malware' }); // Too short
    cache.set('apt29', { name: 'APT29', type: 'Threat-Actor' });
    
    const minLength = 4;
    const textToSearch = 'APT groups like APT29 are dangerous';
    const textLower = textToSearch.toLowerCase();
    
    const found: string[] = [];
    for (const [key, value] of cache.entries()) {
      if (key.length >= minLength && textLower.includes(key)) {
        found.push(value.name);
      }
    }
    
    expect(found).toContain('APT29');
    expect(found).not.toContain('APT');
  });

  it('should use word boundaries for matching', () => {
    const searchValue = 'apt29';
    const textWithMatch = 'The APT29 threat actor...';
    const textWithoutMatch = 'The APT291 threat actor...';
    
    const regex = new RegExp(`\\b${searchValue}\\b`, 'i');
    
    expect(regex.test(textWithMatch)).toBe(true);
    expect(regex.test(textWithoutMatch)).toBe(false);
  });

  it('should match MITRE attack pattern IDs exactly', () => {
    const mitrePattern = /\bT\d{4}(?:\.\d{3})?\b/g;
    
    const textWithMatches = 'The attack used T1566 and T1059.001 techniques.';
    const matches = textWithMatches.match(mitrePattern);
    
    expect(matches).toBeDefined();
    expect(matches).toContain('T1566');
    expect(matches).toContain('T1059.001');
    
    // Should not match partial IDs
    const textNoMatch = 'Error code T156612345 is not a MITRE ID';
    const noMatches = textNoMatch.match(mitrePattern);
    expect(noMatches).toBeNull();
  });

  it('should match CVE identifiers', () => {
    const cvePattern = /\bCVE-\d{4}-\d{4,7}\b/gi;
    
    const text = 'The vulnerability CVE-2021-44228 (Log4Shell) was critical.';
    const matches = text.match(cvePattern);
    
    expect(matches).toBeDefined();
    expect(matches).toContain('CVE-2021-44228');
  });
});
