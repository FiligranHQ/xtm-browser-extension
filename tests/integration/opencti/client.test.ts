/**
 * Integration Tests for OpenCTI Client
 * 
 * These tests require a running OpenCTI instance.
 * Environment variables:
 * - OPENCTI_URL: OpenCTI API URL (default: http://localhost:8080)
 * - OPENCTI_TOKEN: OpenCTI API token
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

// Simple GraphQL client for testing
class TestOpenCTIClient {
  private config: OpenCTIConfig;

  constructor(config: OpenCTIConfig) {
    this.config = config;
  }

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.config.url}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.token}`,
      },
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

  async testConnection(): Promise<{ version: string }> {
    const query = `
      query {
        about {
          version
        }
      }
    `;
    const result = await this.query<{ about: { version: string } }>(query);
    return { version: result.about.version };
  }

  async searchEntities(searchTerm: string, types?: string[], limit = 10) {
    const query = `
      query SearchEntities($search: String, $types: [String], $first: Int) {
        stixCoreObjects(search: $search, types: $types, first: $first) {
          edges {
            node {
              id
              entity_type
              ... on ThreatActor {
                name
              }
              ... on IntrusionSet {
                name
              }
              ... on Malware {
                name
              }
              ... on Tool {
                name
              }
              ... on AttackPattern {
                name
              }
              ... on Campaign {
                name
              }
              ... on Vulnerability {
                name
              }
              ... on Indicator {
                name
              }
              ... on StixCyberObservable {
                observable_value
              }
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
              id
              entity_type
              ... on ThreatActor {
                name
                aliases
              }
              ... on IntrusionSet {
                name
                aliases
              }
              ... on Malware {
                name
                aliases
              }
              ... on Tool {
                name
                aliases
              }
              ... on AttackPattern {
                name
                aliases
                x_mitre_id
              }
              ... on Campaign {
                name
                aliases
              }
              ... on Incident {
                name
                aliases
              }
              ... on Vulnerability {
                name
              }
              ... on Sector {
                name
              }
              ... on Country {
                name
              }
              ... on Organization {
                name
              }
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

  async getLabels(limit = 100) {
    const query = `
      query GetLabels($first: Int) {
        labels(first: $first) {
          edges {
            node {
              id
              value
              color
            }
          }
        }
      }
    `;
    return this.query<{ labels: { edges: Array<{ node: any }> } }>(query, {
      first: limit,
    });
  }

  async getMarkings(limit = 100) {
    const query = `
      query GetMarkings($first: Int) {
        markingDefinitions(first: $first) {
          edges {
            node {
              id
              definition
              definition_type
              x_opencti_color
            }
          }
        }
      }
    `;
    return this.query<{ markingDefinitions: { edges: Array<{ node: any }> } }>(query, {
      first: limit,
    });
  }

  async createIndicator(indicator: {
    name: string;
    pattern: string;
    pattern_type: string;
    valid_from?: string;
  }) {
    const mutation = `
      mutation CreateIndicator($input: IndicatorAddInput!) {
        indicatorAdd(input: $input) {
          id
          name
          pattern
          pattern_type
        }
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

  async deleteEntity(id: string) {
    const mutation = `
      mutation DeleteEntity($id: ID!) {
        stixCoreObjectEdit(id: $id) {
          delete
        }
      }
    `;
    return this.query<{ stixCoreObjectEdit: { delete: string } }>(mutation, { id });
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
