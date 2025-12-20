/**
 * AI Client Types
 * Type definitions for AI providers and generation requests
 */

// ============================================================================
// Base Types
// ============================================================================

export interface AIGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerationResponse {
  success: boolean;
  content?: string;
  error?: string;
}

// ============================================================================
// Container Description Types
// ============================================================================

export interface ContainerDescriptionRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  containerType: string;
  containerName: string;
  detectedEntities?: string[];
  detectedObservables?: string[];
}

// ============================================================================
// Scenario Generation Types
// ============================================================================

export interface ScenarioGenerationRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  scenarioName: string;
  typeAffinity?: string;
  platformAffinity?: string[];
  detectedAttackPatterns?: Array<{ name: string; id?: string; description?: string }>;
  detectedDomains?: string[];
  detectedHostnames?: string[];
  detectedEmails?: string[];
}

export interface GeneratedScenario {
  name: string;
  description: string;
  subtitle?: string;
  category?: string;
  injects: GeneratedInject[];
}

export interface GeneratedInject {
  title: string;
  description: string;
  type: string; // e.g., 'email', 'manual', 'command'
  content?: string; // Command content for executable injects
  executor?: string; // Executor for command type (powershell, bash, etc.)
  subject?: string; // Email subject for table-top scenarios
  body?: string; // Email body for table-top scenarios
  dependsOn?: number; // Index of dependent inject
  delayMinutes?: number;
}

export interface FullScenarioGenerationRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  scenarioName: string;
  typeAffinity: string; // ENDPOINT, CLOUD, WEB, TABLE-TOP
  platformAffinity?: string[]; // windows, linux, macos
  numberOfInjects: number; // Number of injects to generate
  payloadAffinity?: string; // For technical: powershell, bash, sh, cmd
  tableTopDuration?: number; // For table-top: duration in minutes
  scenarioTheme?: string; // For table-top: theme category (cybersecurity, physical-security, etc.)
  emailLanguage?: string; // For table-top: language for email content
  additionalContext?: string; // Additional context from user
  detectedAttackPatterns?: Array<{ name: string; id?: string; description?: string }>;
}

// ============================================================================
// Atomic Testing Types
// ============================================================================

export interface AtomicTestRequest {
  attackPattern: {
    name: string;
    id?: string;
    description?: string;
    mitrePlatforms?: string[];
  };
  targetPlatform: string; // windows, linux, macos
  context?: string; // Additional context from page
}

export interface GeneratedAtomicTest {
  name: string;
  description: string;
  executor: string; // powershell, bash, sh, cmd
  command: string;
  cleanupCommand?: string;
  prerequisites?: string[];
}

// ============================================================================
// Email Generation Types
// ============================================================================

export interface EmailGenerationRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  scenarioName: string;
  language?: string; // Language for email content (e.g., 'english', 'french', 'german')
  attackPatterns: Array<{
    id: string;
    name: string;
    externalId?: string;
    killChainPhases?: string[];
  }>;
}

export interface GeneratedEmail {
  attackPatternId: string;
  subject: string;
  body: string;
}

// ============================================================================
// Entity Discovery Types
// ============================================================================

export interface EntityDiscoveryRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  /** Already detected entities (known or unknown) - to avoid duplicates */
  alreadyDetected?: Array<{
    type: string;
    name: string;
    value?: string;
    found?: boolean;
    /** External ID for attack patterns (e.g., T1562.001) */
    externalId?: string;
    /** Alternative names/aliases for the entity */
    aliases?: string[];
  }>;
}

export interface DiscoveredEntity {
  /** Entity type (e.g., 'IPv4-Addr', 'Domain-Name', 'Malware', 'Threat-Actor-Group') */
  type: string;
  /** Display name or identifier */
  name: string;
  /** The actual value as found in the page (for observables) */
  value: string;
  /** Why this entity is relevant - brief explanation */
  reason: string;
  /** Confidence level: high, medium, low */
  confidence: 'high' | 'medium' | 'low';
  /** The exact text excerpt from the page where this was found */
  excerpt?: string;
}

// ============================================================================
// Relationship Resolution Types
// ============================================================================

export interface RelationshipResolutionRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  /** Entities to find relationships between */
  entities: Array<{
    type: string;
    name: string;
    value?: string;
    /** Whether this entity already exists in OpenCTI */
    existsInPlatform: boolean;
    /** OpenCTI entity ID if it exists */
    octiEntityId?: string;
  }>;
}

export interface ResolvedRelationship {
  /** Index of the source entity in the entities array */
  fromIndex: number;
  /** Index of the target entity in the entities array */
  toIndex: number;
  /** Entity value for lookup (more reliable than index when list is filtered) */
  fromEntityValue?: string;
  /** Entity value for lookup (more reliable than index when list is filtered) */
  toEntityValue?: string;
  /** STIX relationship type (e.g., 'uses', 'targets', 'indicates', 'related-to') */
  relationshipType: string;
  /** Confidence level: high, medium, low */
  confidence: 'high' | 'medium' | 'low';
  /** Explanation for why this relationship exists */
  reason: string;
  /** Text excerpt from the page supporting this relationship */
  excerpt?: string;
}

