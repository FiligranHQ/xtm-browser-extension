/**
 * Scenario Handler
 * 
 * Handles processing of scenario data.
 * Extracts pure data transformation logic from App.tsx.
 */

/**
 * Default values for scenario form
 */
export const SCENARIO_DEFAULT_VALUES = {
  category: 'Endpoint',
  mainFocus: 'incident-response',
  severity: 'medium',
} as const;

/**
 * Scenario form data
 */
export interface ScenarioFormData {
  name: string;
  description: string;
  subtitle: string;
  category: string;
  mainFocus: string;
  severity: string;
}

/**
 * Raw attack pattern from payload
 */
export interface RawAttackPattern {
  id?: string;
  entityId?: string;
  name: string;
  externalId?: string;
  description?: string;
  killChainPhases?: unknown[];
  platformId?: string;
}

/**
 * Payload for showing scenario panel
 */
export interface ShowScenarioPayload {
  attackPatterns?: RawAttackPattern[];
  pageTitle?: string;
  pageUrl?: string;
  pageDescription?: string;
  theme?: 'dark' | 'light';
}

/**
 * Result of processing scenario payload
 */
export interface ProcessedScenarioResult {
  scenarioForm: ScenarioFormData;
  pageTitle: string;
  pageUrl: string;
  rawAttackPatterns: RawAttackPattern[];
  theme?: 'dark' | 'light';
}

/**
 * Process scenario payload and return initial form data
 */
export function processScenarioPayload(
  payload: ShowScenarioPayload
): ProcessedScenarioResult {
  const pageTitle = payload?.pageTitle || '';
  const pageUrl = payload?.pageUrl || '';
  const pageDescription = payload?.pageDescription || '';
  const attackPatterns = payload?.attackPatterns || [];

  const scenarioForm: ScenarioFormData = {
    name: pageTitle || 'New Scenario',
    description: pageDescription,
    subtitle: '',
    category: SCENARIO_DEFAULT_VALUES.category,
    mainFocus: SCENARIO_DEFAULT_VALUES.mainFocus,
    severity: SCENARIO_DEFAULT_VALUES.severity,
  };

  return {
    scenarioForm,
    pageTitle,
    pageUrl,
    rawAttackPatterns: attackPatterns,
    theme: payload?.theme,
  };
}

/**
 * Filter attack patterns by platform ID
 */
export function filterAttackPatternsByPlatform(
  attackPatterns: RawAttackPattern[],
  platformId: string | null
): RawAttackPattern[] {
  if (!platformId) {
    return attackPatterns;
  }
  return attackPatterns.filter(
    ap => !ap.platformId || ap.platformId === platformId
  );
}

/**
 * Extract attack pattern IDs from raw patterns
 */
export function extractAttackPatternIds(
  attackPatterns: RawAttackPattern[]
): string[] {
  return attackPatterns
    .map(ap => ap.id || ap.entityId)
    .filter((id): id is string => !!id);
}

/**
 * Build scenario overview data from raw attack patterns
 * Used when no platform is available or for display purposes
 */
export function buildRawScenarioOverviewData(
  attackPatterns: RawAttackPattern[],
  pageTitle: string,
  pageUrl: string,
  pageDescription: string
) {
  const rawPatternsForDisplay = attackPatterns.map(ap => ({
    id: ap.id || ap.entityId || '',
    name: ap.name,
    externalId: ap.externalId,
    description: ap.description,
    killChainPhases: ap.killChainPhases || [],
    contracts: [],
  }));

  return {
    attackPatterns: rawPatternsForDisplay,
    killChainPhases: [],
    pageTitle,
    pageUrl,
    pageDescription,
  };
}

/**
 * Default scenario AI settings
 */
export const SCENARIO_AI_DEFAULTS = {
  numberOfInjects: 5,
  payloadAffinity: 'powershell',
  tableTopDuration: 60,
  emailLanguage: 'english',
  theme: 'cybersecurity',
  context: '',
  typeAffinity: 'ENDPOINT',
  platformsAffinity: ['windows', 'linux', 'macos'],
} as const;

