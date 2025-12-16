/**
 * OpenCTI GraphQL Query Result Types
 * Types for strict type checking of GraphQL query responses
 */

// ============================================================================
// Query Result Types
// ============================================================================

export interface SDOQueryResponse {
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

export interface LocationQueryResponse {
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

export interface LabelQueryResponse {
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

export interface MarkingQueryResponse {
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

export interface VocabularyQueryResponse {
  vocabularies: {
    edges: Array<{ node: { id: string; name: string; description?: string } }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export interface IdentityQueryResult {
  identities: {
    edges: Array<{ node: { id: string; name: string; entity_type: string } }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

// ============================================================================
// Entity Creation Types
// ============================================================================

export interface SDOCreateResult {
  id: string;
  standard_id: string;
  entity_type: string;
  name: string;
  aliases?: string[];
  x_mitre_id?: string;
}

export interface ObservableCreateResult {
  id: string;
  standard_id: string;
  entity_type: string;
  observable_value?: string;
}

// ============================================================================
// Container Fetch Types
// ============================================================================

export interface ContainerNode {
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
}

export interface ContainerQueryResult {
  containers: {
    edges: Array<{ node: ContainerNode }>;
  };
}

