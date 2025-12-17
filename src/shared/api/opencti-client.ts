/**
 * OpenCTI GraphQL API Client
 *
 * Handles all communication with the OpenCTI platform via GraphQL API.
 */

import { loggers } from '../utils/logger';
import {
  TEST_CONNECTION_QUERY,
  SEARCH_OBSERVABLE_QUERY,
  SEARCH_FILE_BY_HASH_QUERY,
  GET_OBSERVABLE_QUERY,
  SEARCH_SDO_QUERY,
  GET_SDO_QUERY,
  FETCH_SDOS_FOR_CACHE_QUERY,
  FETCH_LOCATIONS_QUERY,
  FETCH_LABELS_QUERY,
  FETCH_MARKING_DEFINITIONS_QUERY,
  FETCH_VOCABULARY_QUERY,
  FETCH_IDENTITIES_QUERY,
  buildCreateObservableMutation,
  CREATE_INTRUSION_SET_MUTATION,
  CREATE_THREAT_ACTOR_MUTATION,
  CREATE_MALWARE_MUTATION,
  CREATE_TOOL_MUTATION,
  CREATE_CAMPAIGN_MUTATION,
  CREATE_VULNERABILITY_MUTATION,
  CREATE_ATTACK_PATTERN_MUTATION,
  CREATE_COUNTRY_MUTATION,
  CREATE_SECTOR_MUTATION,
  CREATE_EXTERNAL_REFERENCE_MUTATION,
  ADD_EXTERNAL_REFERENCE_TO_ENTITY_MUTATION,
  FIND_EXTERNAL_REFERENCES_QUERY,
  FIND_CONTAINERS_BY_EXTERNAL_REFS_QUERY,
  CREATE_DRAFT_WORKSPACE_MUTATION,
  CREATE_REPORT_MUTATION,
  CREATE_CASE_INCIDENT_MUTATION,
  CREATE_CASE_RFI_MUTATION,
  CREATE_CASE_RFT_MUTATION,
  CREATE_GROUPING_MUTATION,
  GLOBAL_SEARCH_QUERY,
  CREATE_INVESTIGATION_MUTATION,
  ADD_TO_INVESTIGATION_MUTATION,
  FETCH_CONTAINERS_FOR_ENTITY_QUERY,
  CREATE_WORKBENCH_MUTATION,
  ADD_OBJECTS_TO_CONTAINER_MUTATION,
  CREATE_RELATIONSHIP_MUTATION,
  ADD_ENTITIES_TO_WORKBENCH_MUTATION,
  buildValueFilter,
  buildHashFilter,
  buildNameFilter,
  buildUrlFilter,
  buildExternalRefFilter,
  buildObjectsFilter,
  ENTITY_TYPE_PATH_MAP,
} from './opencti/queries';
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
  Investigation,
  InvestigationCreateInput,
} from '../types';

const log = loggers.opencti;

// User-Agent for API requests
const USER_AGENT = 'xtm-browser-extension/0.0.5';
const DEFAULT_PAGE_SIZE = 500;

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
      throw new Error(result.errors[0].message || 'GraphQL error');
    }

    return result.data as T;
  }

  // ==========================================================================
  // Platform Information
  // ==========================================================================

  async testConnection(): Promise<PlatformInfo> {
    const data = await this.query<{
      about: { version: string };
      settings: {
        platform_title: string;
        platform_enterprise_edition?: { license_enterprise?: boolean };
      };
      me: { name?: string; user_email?: string };
    }>(TEST_CONNECTION_QUERY);

    return {
      version: data.about.version,
      enterprise_edition: data.settings.platform_enterprise_edition?.license_enterprise ?? false,
      me: { name: data.me?.name, user_email: data.me?.user_email },
      settings: { platform_title: data.settings.platform_title },
    };
  }

  // ==========================================================================
  // Observable Queries
  // ==========================================================================

  async searchObservableByValue(value: string, type?: ObservableType): Promise<StixCyberObservable | null> {
    const data = await this.query<{
      stixCyberObservables: { edges: Array<{ node: StixCyberObservable }> };
    }>(SEARCH_OBSERVABLE_QUERY, { filters: buildValueFilter(value, type) });
    return data.stixCyberObservables.edges[0]?.node || null;
  }

  async searchObservableByHash(hash: string, hashType: HashType): Promise<StixCyberObservable | null> {
    const data = await this.query<{
      stixCyberObservables: { edges: Array<{ node: StixCyberObservable }> };
    }>(SEARCH_FILE_BY_HASH_QUERY, { filters: buildHashFilter(hash, hashType) });
    return data.stixCyberObservables.edges[0]?.node || null;
  }

  async batchSearchObservables(
    values: Array<{ value: string; type?: ObservableType; hashType?: HashType }>
  ): Promise<Map<string, StixCyberObservable>> {
    const results = new Map<string, StixCyberObservable>();
    const batchSize = 20;

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const promises = batch.map(async ({ value, type, hashType }) => {
        try {
          const result = hashType
            ? await this.searchObservableByHash(value, hashType)
            : await this.searchObservableByValue(value, type);
          if (result) results.set(value, result);
        } catch (error) {
          log.warn(`Failed to search for ${value}:`, error);
        }
      });
      await Promise.all(promises);
    }
    return results;
  }

  async getObservableById(id: string): Promise<StixCyberObservable | null> {
    const data = await this.query<{ stixCyberObservable: StixCyberObservable | null }>(GET_OBSERVABLE_QUERY, { id });
    return data.stixCyberObservable;
  }

  // ==========================================================================
  // SDO Queries
  // ==========================================================================

  async searchSDOByNameOrAlias(name: string, types?: string[]): Promise<StixDomainObject | null> {
    // Try name first
    let data = await this.query<{
      stixDomainObjects: { edges: Array<{ node: StixDomainObject }> };
    }>(SEARCH_SDO_QUERY, { types, filters: buildNameFilter(name, false) });

    if (data.stixDomainObjects.edges[0]?.node) {
      return data.stixDomainObjects.edges[0].node;
    }

    // Try aliases
    data = await this.query<{
      stixDomainObjects: { edges: Array<{ node: StixDomainObject }> };
    }>(SEARCH_SDO_QUERY, { types, filters: buildNameFilter(name, true) });

    return data.stixDomainObjects.edges[0]?.node || null;
  }

  async getSDOById(id: string): Promise<StixDomainObject | null> {
    const data = await this.query<{ stixDomainObject: StixDomainObject | null }>(GET_SDO_QUERY, { id });
    return data.stixDomainObject;
  }

  // ==========================================================================
  // SDO Bulk Fetch for Caching
  // ==========================================================================

  async fetchSDOsForCache(
    entityType: string,
    pageSize: number = DEFAULT_PAGE_SIZE
  ): Promise<Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }>> {
    const allResults: Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage) {
      const data: SDOQueryResponse = await this.query<SDOQueryResponse>(
        FETCH_SDOS_FOR_CACHE_QUERY,
        { types: [entityType], first: pageSize, after }
      );

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
        .filter(node => node.name);

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

  async fetchLocations(pageSize: number = DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; name: string; aliases?: string[] }>> {
    const allResults: Array<{ id: string; name: string; aliases?: string[] }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: LocationQueryResponse = await this.query<LocationQueryResponse>(FETCH_LOCATIONS_QUERY, { first: pageSize, after });
      allResults.push(...data.locations.edges.map((edge) => ({
        id: edge.node.id,
        name: edge.node.name,
        aliases: edge.node.x_opencti_aliases,
      })));
      hasNextPage = data.locations.pageInfo.hasNextPage;
      after = data.locations.pageInfo.endCursor;
    }
    return allResults;
  }

  async fetchLabels(pageSize: number = DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; value: string; color: string }>> {
    const allResults: Array<{ id: string; value: string; color: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: LabelQueryResponse = await this.query<LabelQueryResponse>(FETCH_LABELS_QUERY, { first: pageSize, after });
      allResults.push(...data.labels.edges.map((e) => e.node));
      hasNextPage = data.labels.pageInfo.hasNextPage;
      after = data.labels.pageInfo.endCursor;
    }
    return allResults;
  }

  async fetchMarkingDefinitions(pageSize: number = 100): Promise<Array<{ id: string; definition: string; definition_type: string; x_opencti_color: string }>> {
    const allResults: Array<{ id: string; definition: string; definition_type: string; x_opencti_color: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: MarkingQueryResponse = await this.query<MarkingQueryResponse>(FETCH_MARKING_DEFINITIONS_QUERY, { first: pageSize, after });
      allResults.push(...data.markingDefinitions.edges.map((e) => e.node));
      hasNextPage = data.markingDefinitions.pageInfo.hasNextPage;
      after = data.markingDefinitions.pageInfo.endCursor;
    }
    return allResults;
  }

  async fetchVocabulary(category: string, pageSize: number = 100): Promise<Array<{ id: string; name: string; description?: string }>> {
    const allResults: Array<{ id: string; name: string; description?: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: VocabularyQueryResponse = await this.query<VocabularyQueryResponse>(FETCH_VOCABULARY_QUERY, { category, first: pageSize, after });
      allResults.push(...data.vocabularies.edges.map((e) => e.node));
      hasNextPage = data.vocabularies.pageInfo.hasNextPage;
      after = data.vocabularies.pageInfo.endCursor;
    }
    return allResults;
  }

  async fetchIdentities(pageSize: number = DEFAULT_PAGE_SIZE): Promise<Array<{ id: string; name: string; entity_type: string }>> {
    const allResults: Array<{ id: string; name: string; entity_type: string }> = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const data: IdentityQueryResult = await this.query<IdentityQueryResult>(FETCH_IDENTITIES_QUERY, { first: pageSize, after });
      allResults.push(...data.identities.edges.map((e) => e.node));
      hasNextPage = data.identities.pageInfo.hasNextPage;
      after = data.identities.pageInfo.endCursor;
    }
    return allResults;
  }

  // ==========================================================================
  // Create Operations
  // ==========================================================================

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

    const variables = {
      type: stixType,
      x_opencti_score: input.score,
      x_opencti_description: input.description,
      createIndicator: input.createIndicator ?? false,
      objectMarking: input.objectMarking,
      objectLabel: input.objectLabel,
      [gqlType]: observableInput,
    };

    const data = await this.query<{ stixCyberObservableAdd: StixCyberObservable }>(
      buildCreateObservableMutation(gqlType),
      variables
    );
    return data.stixCyberObservableAdd;
  }

  // ==========================================================================
  // SDO Creation Methods
  // ==========================================================================

  async createIntrusionSet(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ intrusionSetAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(CREATE_INTRUSION_SET_MUTATION, { input });
    return data.intrusionSetAdd;
  }

  async createThreatActor(input: { name: string; description?: string; threat_actor_types?: string[]; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ threatActorGroupAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(CREATE_THREAT_ACTOR_MUTATION, {
      input: { ...input, threat_actor_types: input.threat_actor_types || ['unknown'] },
    });
    return data.threatActorGroupAdd;
  }

  async createMalware(input: { name: string; description?: string; malware_types?: string[]; is_family?: boolean; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ malwareAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(CREATE_MALWARE_MUTATION, {
      input: { ...input, malware_types: input.malware_types || ['unknown'], is_family: input.is_family ?? true },
    });
    return data.malwareAdd;
  }

  async createTool(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ toolAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(CREATE_TOOL_MUTATION, { input });
    return data.toolAdd;
  }

  async createCampaign(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ campaignAdd: { id: string; standard_id: string; entity_type: string; name: string; aliases?: string[] } }>(CREATE_CAMPAIGN_MUTATION, { input });
    return data.campaignAdd;
  }

  async createVulnerability(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ vulnerabilityAdd: { id: string; standard_id: string; entity_type: string; name: string } }>(CREATE_VULNERABILITY_MUTATION, { input });
    return data.vulnerabilityAdd;
  }

  async createAttackPattern(input: { name: string; description?: string; x_mitre_id?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ attackPatternAdd: { id: string; standard_id: string; entity_type: string; name: string; x_mitre_id?: string; aliases?: string[] } }>(CREATE_ATTACK_PATTERN_MUTATION, { input });
    return data.attackPatternAdd;
  }

  async createCountry(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ countryAdd: { id: string; standard_id: string; entity_type: string; name: string } }>(CREATE_COUNTRY_MUTATION, { input });
    return data.countryAdd;
  }

  async createSector(input: { name: string; description?: string; objectMarking?: string[]; objectLabel?: string[] }) {
    const data = await this.query<{ sectorAdd: { id: string; standard_id: string; entity_type: string; name: string } }>(CREATE_SECTOR_MUTATION, { input });
    return data.sectorAdd;
  }

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
    const data = await this.query<{ externalReferenceAdd: { id: string; standard_id: string; url?: string } }>(CREATE_EXTERNAL_REFERENCE_MUTATION, { input });
    return data.externalReferenceAdd;
  }

  async addExternalReferenceToEntity(entityId: string, externalReferenceId: string): Promise<void> {
    await this.query(ADD_EXTERNAL_REFERENCE_TO_ENTITY_MUTATION, { id: entityId, input: { toId: externalReferenceId, relationship_type: 'external-reference' } });
  }

  async findExternalReferencesByUrl(url: string): Promise<Array<{ id: string; url: string; source_name: string }>> {
    const data = await this.query<{ externalReferences: { edges: Array<{ node: { id: string; url: string; source_name: string } }> } }>(FIND_EXTERNAL_REFERENCES_QUERY, { filters: buildUrlFilter(url) });
    return data.externalReferences.edges.map(edge => edge.node);
  }

  async findContainersByExternalReferenceUrl(url: string): Promise<StixDomainObject[]> {
    const externalRefs = await this.findExternalReferencesByUrl(url);
    if (externalRefs.length === 0) return [];

    const extRefIds = externalRefs.map(ref => ref.id);
    const data = await this.query<{ stixDomainObjects: { edges: Array<{ node: StixDomainObject }> } }>(FIND_CONTAINERS_BY_EXTERNAL_REFS_QUERY, { filters: buildExternalRefFilter(extRefIds) });
    return data.stixDomainObjects.edges.map(edge => edge.node);
  }

  // ==========================================================================
  // Draft and Container Operations
  // ==========================================================================

  async createDraftWorkspace(name: string): Promise<{ id: string; name: string }> {
    const data = await this.query<{ draftWorkspaceAdd: { id: string; name: string } }>(CREATE_DRAFT_WORKSPACE_MUTATION, { input: { name } });
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

    let query: string;
    let mutationName: string;

    switch (input.type) {
      case 'Report':
        containerInput.published = input.published || new Date().toISOString();
        containerInput.report_types = input.report_types || ['threat-report'];
        containerInput.content = input.content;
        mutationName = 'reportAdd';
        query = CREATE_REPORT_MUTATION;
        break;
      case 'Case-Incident':
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        if (input.response_types?.length) containerInput.response_types = input.response_types;
        if (input.created) containerInput.created = input.created;
        mutationName = 'caseIncidentAdd';
        query = CREATE_CASE_INCIDENT_MUTATION;
        break;
      case 'Case-Rfi':
        containerInput.information_types = ['strategic'];
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        if (input.created) containerInput.created = input.created;
        mutationName = 'caseRfiAdd';
        query = CREATE_CASE_RFI_MUTATION;
        break;
      case 'Case-Rft':
        containerInput.takedown_types = ['content'];
        containerInput.severity = input.severity || 'medium';
        containerInput.priority = input.priority || 'P3';
        if (input.created) containerInput.created = input.created;
        mutationName = 'caseRftAdd';
        query = CREATE_CASE_RFT_MUTATION;
        break;
      case 'Grouping':
        containerInput.context = input.context || 'suspicious-activity';
        if (input.created) containerInput.created = input.created;
        mutationName = 'groupingAdd';
        query = CREATE_GROUPING_MUTATION;
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
    const data = await this.query<{ stixCoreObjects: { edges: Array<{ node: SearchResult }> } }>(GLOBAL_SEARCH_QUERY, {
      search: searchTerm,
      types,
      first: limit,
      orderBy: '_score',
      orderMode: 'desc',
    });
    return data.stixCoreObjects.edges.map((e) => e.node);
  }

  getEntityUrl(entityId: string, entityType: string): string {
    return `${this.baseUrl}/${ENTITY_TYPE_PATH_MAP[entityType] || 'dashboard'}/${entityId}`;
  }

  // ==========================================================================
  // Investigation Operations
  // ==========================================================================

  async createInvestigation(input: InvestigationCreateInput): Promise<Investigation> {
    const data = await this.query<{ workspaceAdd: Investigation }>(CREATE_INVESTIGATION_MUTATION, {
      input: { type: 'investigation', name: input.name, description: input.description, investigated_entities_ids: input.investigated_entities_ids || [] },
    });
    return data.workspaceAdd;
  }

  async addEntitiesToInvestigation(investigationId: string, entityIds: string[]): Promise<Investigation> {
    const data = await this.query<{ workspaceFieldPatch: Investigation }>(ADD_TO_INVESTIGATION_MUTATION, {
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

  async fetchContainersForEntity(entityId: string, limit: number = 5): Promise<Array<{ id: string; entity_type: string; name: string; created: string; modified: string; createdBy?: { id: string; name: string } }>> {
    try {
      const data = await this.query<ContainerQueryResult>(FETCH_CONTAINERS_FOR_ENTITY_QUERY, { first: limit, orderBy: 'created', orderMode: 'desc', filters: buildObjectsFilter(entityId) });
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
    const data = await this.query<{ workspaceAdd: { id: string; name: string; entity_type: string } }>(CREATE_WORKBENCH_MUTATION, { input: { ...input, type: 'INVESTIGATION' } });
    return data.workspaceAdd;
  }

  async addObjectsToContainer(containerId: string, objectIds: string[]): Promise<void> {
    if (objectIds.length === 0) return;
    await this.query(ADD_OBJECTS_TO_CONTAINER_MUTATION, { id: containerId, toIds: objectIds });
  }

  async createStixCoreRelationship(input: { fromId: string; toId: string; relationship_type: string; description?: string; confidence?: number; objectMarking?: string[] }): Promise<{ id: string; standard_id: string }> {
    const data = await this.query<{ stixCoreRelationshipAdd: { id: string; standard_id: string } }>(CREATE_RELATIONSHIP_MUTATION, { input });
    return data.stixCoreRelationshipAdd;
  }

  async addEntitiesToWorkbench(workbenchId: string, entityIds: string[]): Promise<void> {
    await this.query(ADD_ENTITIES_TO_WORKBENCH_MUTATION, { id: workbenchId, toIds: entityIds });
  }

  getWorkbenchUrl(workbenchId: string): string {
    return `${this.baseUrl}/dashboard/workspaces/investigations/${workbenchId}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let clientInstance: OpenCTIClient | null = null;

export async function getOpenCTIClient(): Promise<OpenCTIClient | null> {
  if (clientInstance) return clientInstance;

  const settings = await chrome.storage.local.get('settings') as { settings?: ExtensionSettings };
  const firstPlatform = settings.settings?.openctiPlatforms?.find(p => p.enabled && p.url && p.apiToken);

  if (!firstPlatform) return null;

  clientInstance = new OpenCTIClient({ url: firstPlatform.url, apiToken: firstPlatform.apiToken });
  return clientInstance;
}

export function resetOpenCTIClient(): void {
  clientInstance = null;
}
