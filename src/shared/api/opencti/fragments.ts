/**
 * OpenCTI GraphQL Fragments
 * Reusable GraphQL fragments for common entity fields
 */

// ============================================================================
// GraphQL Fragments
// ============================================================================

export const MARKING_FRAGMENT = `
  fragment MarkingFields on MarkingDefinition {
    id
    definition_type
    definition
    x_opencti_order
    x_opencti_color
  }
`;

export const LABEL_FRAGMENT = `
  fragment LabelFields on Label {
    id
    value
    color
  }
`;

export const IDENTITY_FRAGMENT = `
  fragment IdentityFields on Identity {
    id
    standard_id
    entity_type
    name
    description
    identity_class
  }
`;

export const OBSERVABLE_PROPERTIES = `
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

export const SDO_PROPERTIES = `
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
  ... on Sector {
    name
    description
  }
  ... on Organization {
    name
    description
    x_opencti_organization_type
    contact_information
  }
  ... on Individual {
    name
    description
    contact_information
  }
  ... on Event {
    name
    description
    event_types
    start_time
    stop_time
  }
  ... on Incident {
    name
    description
    aliases
    first_seen
    last_seen
    incident_type
    severity
    source
  }
  ... on Country {
    name
    description
  }
  ... on Region {
    name
    description
  }
  ... on City {
    name
    description
  }
  ... on AdministrativeArea {
    name
    description
  }
  ... on Position {
    name
    description
    latitude
    longitude
  }
`;

// ============================================================================
// Combined Fragments Helper
// ============================================================================

export const ALL_FRAGMENTS = `
  ${MARKING_FRAGMENT}
  ${LABEL_FRAGMENT}
  ${IDENTITY_FRAGMENT}
`;

