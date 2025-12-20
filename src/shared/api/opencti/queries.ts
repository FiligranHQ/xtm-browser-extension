/**
 * OpenCTI GraphQL Queries
 *
 * Centralized GraphQL query templates for the OpenCTI client.
 * Separating queries from the client logic improves maintainability.
 */

import { ALL_FRAGMENTS, OBSERVABLE_PROPERTIES, SDO_PROPERTIES } from './fragments';

// ============================================================================
// Platform Information Queries
// ============================================================================

export const TEST_CONNECTION_QUERY = `
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

// ============================================================================
// Observable Queries
// ============================================================================

export const SEARCH_OBSERVABLE_QUERY = `
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

export const SEARCH_FILE_BY_HASH_QUERY = `
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

export const GET_OBSERVABLE_QUERY = `
  ${ALL_FRAGMENTS}
  query GetObservable($id: String!) {
    stixCyberObservable(id: $id) {
      ${OBSERVABLE_PROPERTIES}
    }
  }
`;

// ============================================================================
// SDO Queries
// ============================================================================

export const SEARCH_SDO_QUERY = `
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

export const GET_SDO_QUERY = `
  ${ALL_FRAGMENTS}
  query GetSDO($id: String!) {
    stixDomainObject(id: $id) {
      ${SDO_PROPERTIES}
    }
  }
`;

export const FETCH_SDOS_FOR_CACHE_QUERY = `
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
          ... on Tool { name aliases }
          ... on Vulnerability { name x_opencti_aliases }
          ... on Sector { name x_opencti_aliases }
          ... on Country { name x_opencti_aliases }
          ... on Region { name x_opencti_aliases }
          ... on City { name x_opencti_aliases }
          ... on AdministrativeArea { name x_opencti_aliases }
          ... on Position { name x_opencti_aliases }
          ... on Organization { name x_opencti_aliases }
          ... on Individual { name x_opencti_aliases }
          ... on System { name x_opencti_aliases }
          ... on Event { name aliases }
          ... on AttackPattern { name aliases x_mitre_id }
          ... on Narrative { name aliases }
          ... on Channel { name aliases }
        }
      }
      pageInfo { hasNextPage endCursor globalCount }
    }
  }
`;

// ============================================================================
// Location & Reference Data Queries
// ============================================================================

export const FETCH_LOCATIONS_QUERY = `
  query FetchLocations($first: Int, $after: ID) {
    locations(first: $first, after: $after) {
      edges {
        node { id entity_type name x_opencti_aliases }
      }
      pageInfo { hasNextPage endCursor globalCount }
    }
  }
`;

export const FETCH_LABELS_QUERY = `
  query FetchLabels($first: Int, $after: ID) {
    labels(first: $first, after: $after) {
      edges { node { id value color } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const SEARCH_LABELS_QUERY = `
  query SearchLabels($first: Int, $search: String) {
    labels(first: $first, search: $search, orderBy: value, orderMode: asc) {
      edges { node { id value color } }
    }
  }
`;

export const CREATE_LABEL_MUTATION = `
  mutation LabelAdd($input: LabelAddInput!) {
    labelAdd(input: $input) { id value color }
  }
`;

export const FETCH_MARKING_DEFINITIONS_QUERY = `
  query FetchMarkingDefinitions($first: Int, $after: ID) {
    markingDefinitions(first: $first, after: $after) {
      edges { node { id definition definition_type x_opencti_color } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const FETCH_VOCABULARY_QUERY = `
  query FetchVocabulary($category: VocabularyCategory!, $first: Int, $after: ID) {
    vocabularies(category: $category, first: $first, after: $after) {
      edges { node { id name description } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const FETCH_IDENTITIES_QUERY = `
  query FetchIdentities($first: Int, $after: ID) {
    identities(first: $first, after: $after, types: ["Organization", "Individual", "System"]) {
      edges { node { id name entity_type } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const SEARCH_IDENTITIES_QUERY = `
  query SearchIdentities($first: Int, $search: String) {
    identities(first: $first, search: $search, types: ["Organization", "Individual"], orderBy: name, orderMode: asc) {
      edges { node { id name entity_type } }
    }
  }
`;

export const CREATE_ORGANIZATION_MUTATION = `
  mutation CreateOrganization($input: OrganizationAddInput!) {
    organizationAdd(input: $input) {
      id
      name
      entity_type
    }
  }
`;

export const CREATE_INDIVIDUAL_MUTATION = `
  mutation CreateIndividual($input: IndividualAddInput!) {
    individualAdd(input: $input) {
      id
      name
      entity_type
    }
  }
`;

// ============================================================================
// Create Mutations
// ============================================================================

/**
 * Build the create observable mutation dynamically based on the GraphQL type
 */
export function buildCreateObservableMutation(gqlType: string): string {
  return `
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
}

export const CREATE_INTRUSION_SET_MUTATION = `
  mutation IntrusionSetAdd($input: IntrusionSetAddInput!) {
    intrusionSetAdd(input: $input) { id standard_id entity_type name aliases }
  }
`;

export const CREATE_THREAT_ACTOR_GROUP_MUTATION = `
  mutation ThreatActorGroupAdd($input: ThreatActorGroupAddInput!) {
    threatActorGroupAdd(input: $input) { id standard_id entity_type name aliases }
  }
`;

export const CREATE_THREAT_ACTOR_INDIVIDUAL_MUTATION = `
  mutation ThreatActorIndividualAdd($input: ThreatActorIndividualAddInput!) {
    threatActorIndividualAdd(input: $input) { id standard_id entity_type name aliases }
  }
`;

export const CREATE_MALWARE_MUTATION = `
  mutation MalwareAdd($input: MalwareAddInput!) {
    malwareAdd(input: $input) { id standard_id entity_type name aliases }
  }
`;

export const CREATE_TOOL_MUTATION = `
  mutation ToolAdd($input: ToolAddInput!) {
    toolAdd(input: $input) { id standard_id entity_type name aliases }
  }
`;

export const CREATE_CAMPAIGN_MUTATION = `
  mutation CampaignAdd($input: CampaignAddInput!) {
    campaignAdd(input: $input) { id standard_id entity_type name aliases }
  }
`;

export const CREATE_VULNERABILITY_MUTATION = `
  mutation VulnerabilityAdd($input: VulnerabilityAddInput!) {
    vulnerabilityAdd(input: $input) { id standard_id entity_type name }
  }
`;

export const CREATE_ATTACK_PATTERN_MUTATION = `
  mutation AttackPatternAdd($input: AttackPatternAddInput!) {
    attackPatternAdd(input: $input) { id standard_id entity_type name x_mitre_id aliases }
  }
`;

export const CREATE_COUNTRY_MUTATION = `
  mutation CountryAdd($input: CountryAddInput!) {
    countryAdd(input: $input) { id standard_id entity_type name }
  }
`;

export const CREATE_SECTOR_MUTATION = `
  mutation SectorAdd($input: SectorAddInput!) {
    sectorAdd(input: $input) { id standard_id entity_type name }
  }
`;

export const CREATE_NARRATIVE_MUTATION = `
  mutation NarrativeAdd($input: NarrativeAddInput!) {
    narrativeAdd(input: $input) { id standard_id entity_type name aliases }
  }
`;

export const CREATE_CHANNEL_MUTATION = `
  mutation ChannelAdd($input: ChannelAddInput!) {
    channelAdd(input: $input) { id standard_id entity_type name aliases }
  }
`;

export const CREATE_SYSTEM_MUTATION = `
  mutation SystemAdd($input: SystemAddInput!) {
    systemAdd(input: $input) { id standard_id entity_type name x_opencti_aliases }
  }
`;

// ============================================================================
// External Reference Mutations & Queries
// ============================================================================

export const CREATE_EXTERNAL_REFERENCE_MUTATION = `
  mutation ExternalReferenceAdd($input: ExternalReferenceAddInput!) {
    externalReferenceAdd(input: $input) { id standard_id entity_type source_name description url external_id }
  }
`;

export const ADD_EXTERNAL_REFERENCE_TO_ENTITY_MUTATION = `
  mutation StixDomainObjectEditRelationAdd($id: ID!, $input: StixRefRelationshipAddInput!) {
    stixDomainObjectEdit(id: $id) { relationAdd(input: $input) { id } }
  }
`;

export const FIND_EXTERNAL_REFERENCES_QUERY = `
  query ExternalReferences($filters: FilterGroup) {
    externalReferences(filters: $filters, first: 10) {
      edges { node { id standard_id source_name description url } }
    }
  }
`;

export const FIND_CONTAINERS_BY_EXTERNAL_REFS_QUERY = `
  ${ALL_FRAGMENTS}
  query FindContainersByExternalRefs($filters: FilterGroup) {
    stixDomainObjects(types: ["Report", "Case-Incident", "Case-Rfi", "Case-Rft", "Grouping"], filters: $filters, first: 10, orderBy: modified, orderMode: desc) {
      edges { node { ${SDO_PROPERTIES} } }
    }
  }
`;

// ============================================================================
// Container Mutations
// ============================================================================

export const CREATE_DRAFT_WORKSPACE_MUTATION = `
  mutation DraftWorkspaceAdd($input: DraftWorkspaceAddInput!) {
    draftWorkspaceAdd(input: $input) { id name }
  }
`;

const CONTAINER_FIELDS = `id standard_id entity_type name description created modified createdBy { id name } objectLabel { id value color } objectMarking { id definition x_opencti_color }`;

export const CREATE_REPORT_MUTATION = `
  mutation CreateReport($input: ReportAddInput!) {
    reportAdd(input: $input) { ${CONTAINER_FIELDS} }
  }
`;

export const CREATE_CASE_INCIDENT_MUTATION = `
  mutation CreateCaseIncident($input: CaseIncidentAddInput!) {
    caseIncidentAdd(input: $input) { ${CONTAINER_FIELDS} }
  }
`;

export const CREATE_CASE_RFI_MUTATION = `
  mutation CreateCaseRfi($input: CaseRfiAddInput!) {
    caseRfiAdd(input: $input) { ${CONTAINER_FIELDS} }
  }
`;

export const CREATE_CASE_RFT_MUTATION = `
  mutation CreateCaseRft($input: CaseRftAddInput!) {
    caseRftAdd(input: $input) { ${CONTAINER_FIELDS} }
  }
`;

export const CREATE_GROUPING_MUTATION = `
  mutation CreateGrouping($input: GroupingAddInput!) {
    groupingAdd(input: $input) { ${CONTAINER_FIELDS} }
  }
`;

// ============================================================================
// Search Queries
// ============================================================================

export const GLOBAL_SEARCH_QUERY = `
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

// ============================================================================
// Investigation & Workspace Mutations
// ============================================================================

export const CREATE_INVESTIGATION_MUTATION = `
  mutation CreateInvestigation($input: WorkspaceAddInput!) {
    workspaceAdd(input: $input) { id name description type investigated_entities_ids created_at updated_at }
  }
`;

export const ADD_TO_INVESTIGATION_MUTATION = `
  mutation AddToInvestigation($id: ID!, $input: [EditInput!]!) {
    workspaceFieldPatch(id: $id, input: $input) { id name investigated_entities_ids }
  }
`;

export const FETCH_CONTAINERS_FOR_ENTITY_QUERY = `
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

export const CREATE_WORKBENCH_MUTATION = `
  mutation WorkbenchAdd($input: WorkspaceAddInput!) {
    workspaceAdd(input: $input) { id name entity_type }
  }
`;

export const ADD_OBJECTS_TO_CONTAINER_MUTATION = `
  mutation ContainerEditObjectsAdd($id: ID!, $toIds: [String]!) {
    containerEdit(id: $id) { objectsAdd(toIds: $toIds) { id } }
  }
`;

export const CREATE_RELATIONSHIP_MUTATION = `
  mutation StixCoreRelationshipAdd($input: StixCoreRelationshipAddInput!) {
    stixCoreRelationshipAdd(input: $input) { id standard_id entity_type relationship_type from { ... on BasicObject { id entity_type } } to { ... on BasicObject { id entity_type } } }
  }
`;

export const ADD_ENTITIES_TO_WORKBENCH_MUTATION = `
  mutation WorkspaceStixCoreObjectsAdd($id: ID!, $toIds: [String]!) {
    workspaceEdit(id: $id) { relationAdd(input: { toIds: $toIds, relationship_type: "has" }) { id } }
  }
`;

export const FILE_UPLOAD_MUTATION = `
  mutation StixDomainObjectFileUpload($id: ID!, $file: Upload!) {
    stixDomainObjectEdit(id: $id) { importPush(file: $file) { id name } }
  }
`;

// ============================================================================
// Filter Builders
// ============================================================================

/**
 * Build a simple filter for exact value match
 */
export function buildValueFilter(value: string, type?: string): object {
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

  return filters;
}

/**
 * Build a filter for hash lookup
 */
export function buildHashFilter(hash: string, hashType: string): object {
  return {
    mode: 'and',
    filters: [{ key: `hashes.${hashType}`, values: [hash] }],
    filterGroups: [],
  };
}

/**
 * Build a filter for name or alias search
 */
export function buildNameFilter(name: string, searchByAlias = false): object {
  return {
    mode: 'and',
    filters: [{ key: searchByAlias ? 'aliases' : 'name', values: [name], operator: 'eq' }],
    filterGroups: [],
  };
}

/**
 * Build a filter for URL lookup
 */
export function buildUrlFilter(url: string): object {
  return {
    mode: 'and',
    filters: [{ key: 'url', values: [url], operator: 'eq' }],
    filterGroups: [],
  };
}

/**
 * Build a filter for external reference IDs
 */
export function buildExternalRefFilter(extRefIds: string[]): object {
  return {
    mode: 'and',
    filters: [{ key: 'externalReferences', values: extRefIds, operator: 'eq' }],
    filterGroups: [],
  };
}

/**
 * Build a filter for objects in a container
 */
export function buildObjectsFilter(entityId: string): object {
  return {
    mode: 'and',
    filters: [{ key: 'objects', values: [entityId] }],
    filterGroups: [],
  };
}

// ============================================================================
// URL Path Mapping
// ============================================================================

export const ENTITY_TYPE_PATH_MAP: Record<string, string> = {
  'Intrusion-Set': 'threats/intrusion_sets',
  'Malware': 'arsenal/malwares',
  'Threat-Actor-Group': 'threats/threat_actors_group',
  'Threat-Actor-Individual': 'threats/threat_actors_individual',
  'Campaign': 'threats/campaigns',
  'Vulnerability': 'arsenal/vulnerabilities',
  'Tool': 'arsenal/tools',
  'Attack-Pattern': 'techniques/attack_patterns',
  'Narrative': 'techniques/narratives',
  'Channel': 'techniques/channels',
  'Indicator': 'observations/indicators',
  'Report': 'analyses/reports',
  'Case-Incident': 'cases/incidents',
  'Grouping': 'analyses/groupings',
  'Investigation': 'workspaces/investigations',
  'Organization': 'entities/organizations',
  'Individual': 'entities/individuals',
  'System': 'entities/systems',
  'Sector': 'entities/sectors',
  'Event': 'entities/events',
  'Country': 'locations/countries',
  'Region': 'locations/regions',
  'City': 'locations/cities',
  'Administrative-Area': 'locations/administrative_areas',
  'Position': 'locations/positions',
  'IPv4-Addr': 'observations/observables',
  'IPv6-Addr': 'observations/observables',
  'Domain-Name': 'observations/observables',
  'Url': 'observations/observables',
  'Email-Addr': 'observations/observables',
  'StixFile': 'observations/observables',
  'Artifact': 'observations/observables',
};
