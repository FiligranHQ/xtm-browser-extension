/**
 * AI Client - XTM One agent invocation
 *
 * Every AI feature is delegated to a dedicated XTM One agent through
 * ``POST {xtmOneUrl}/api/v1/extension/execute-task``.
 *
 * The extension is a thin client: it serializes the task input as JSON
 * into the ``content`` field and identifies the target agent by slug.
 * XTM One resolves the agent, loads its persona, executes via the full
 * Agent framework, and returns parsed JSON in a ``{ data }`` envelope.
 */

import { AI_DEFAULTS, type AISettings } from '../types/ai';
import type {
  ContainerDescriptionRequest,
  ScenarioGenerationRequest,
  FullScenarioGenerationRequest,
  AtomicTestRequest,
  EmailGenerationRequest,
  EntityDiscoveryRequest,
  RelationshipResolutionRequest,
} from './ai/types';

// ============================================================================
// Constants
// ============================================================================

const EXECUTE_TASK_PATH = '/api/v1/extension/execute-task';
const TEST_CONNECTION_PATH = '/api/v1/auth/me';
const PLATFORM_CONFIG_PATH = '/api/v1/platform/config';

/**
 * Agent slugs matching the seeded browser-extension agents in XTM One.
 * Adding a new entry here requires a corresponding agent in XTM One's
 * ``builtin_agents.py``.
 */
export const XTM_ONE_AGENT_SLUGS = {
  containerDescription: 'browser-container-description',
  scenarioGeneration: 'browser-scenario-generation',
  fullScenarioGeneration: 'browser-full-scenario-generation',
  atomicTestGeneration: 'browser-atomic-test-generation',
  emailGeneration: 'browser-email-generation',
  entityDiscovery: 'browser-entity-discovery',
  relationshipResolution: 'browser-relationship-resolution',
  scanAll: 'browser-scan-all',
} as const;

export type XtmOneAgentSlug = (typeof XTM_ONE_AGENT_SLUGS)[keyof typeof XTM_ONE_AGENT_SLUGS];

// ============================================================================
// Types
// ============================================================================

export interface XtmOneTaskResponse<T = unknown> {
  success: boolean;
  /** Structured payload returned by the XTM One agent. */
  data?: T;
  /** Human-readable error message ready to surface to the user. */
  error?: string;
  /** HTTP status code from XTM One (when applicable), useful for telemetry. */
  status?: number;
}

// ============================================================================
// AI Client
// ============================================================================

export class AIClient {
  private readonly xtmOneUrl: string;
  private readonly apiToken: string;
  private readonly maxTokens: number;
  private readonly maxContentLength: number;

  constructor(settings: AISettings) {
    if (!settings.xtmOneUrl || !settings.apiToken) {
      throw new Error('XTM One URL and API token are required');
    }
    this.xtmOneUrl = normalizeUrl(settings.xtmOneUrl);
    this.apiToken = settings.apiToken;
    this.maxTokens = settings.maxTokens ?? AI_DEFAULTS.maxTokens;
    this.maxContentLength = settings.maxContentLength ?? AI_DEFAULTS.maxContentLength;
  }

  getMaxContentLength(): number {
    return this.maxContentLength;
  }

  /**
   * Probe the XTM One endpoint with the configured credentials.
   * Calls GET /api/v1/auth/me to verify the token and fetches
   * platform settings for version/license info.
   */
  async testConnection(): Promise<XtmOneTaskResponse<{
    message?: string;
    user_email?: string;
    version?: string;
    enterprise_edition?: boolean;
  }>> {
    const url = `${this.xtmOneUrl}${TEST_CONNECTION_PATH}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        credentials: 'omit',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? `Unable to reach XTM One: ${error.message}` : 'Unable to reach XTM One',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: await formatHttpError(response, 'connection-test'),
      };
    }

    // Parse user info from the /auth/me response
    let meBody: Record<string, unknown> = {};
    try {
      meBody = await response.json();
    } catch {
      // Non-JSON response is acceptable — connection still verified
    }

    // Fetch platform config for version/license (best-effort)
    let configBody: Record<string, unknown> = {};
    try {
      const configResponse = await fetch(`${this.xtmOneUrl}${PLATFORM_CONFIG_PATH}`, {
        method: 'GET',
        credentials: 'omit',
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      if (configResponse.ok) {
        configBody = await configResponse.json();
      }
    } catch {
      // Config endpoint may not be available
    }

    const user_email = (meBody.user_email ?? meBody.email ?? meBody.full_name ?? meBody.name) as string | undefined;
    const version = (configBody.platform_version ?? meBody.platform_version ?? meBody.version) as string | undefined;

    // Determine enterprise status from deployment_tier or xtm_license
    const deploymentTier = configBody.deployment_tier as string | undefined;
    const xtmLicense = configBody.xtm_license as Record<string, unknown> | undefined;
    let enterprise_edition: boolean | undefined;
    if (deploymentTier) {
      enterprise_edition = deploymentTier === 'xtm_licensed' || deploymentTier === 'ee_platform';
    } else if (xtmLicense) {
      enterprise_edition = xtmLicense.valid === true;
    }

    return {
      success: true,
      status: response.status,
      data: { message: 'Connection successful', user_email, version, enterprise_edition },
    };
  }

  // ==========================================================================
  // Feature-specific wrappers (1:1 with XTM One agents)
  // ==========================================================================

  generateContainerDescription(
    request: ContainerDescriptionRequest,
  ): Promise<XtmOneTaskResponse<{ description: string }>> {
    return this.executeTask(XTM_ONE_AGENT_SLUGS.containerDescription, request);
  }

  generateScenario(
    request: ScenarioGenerationRequest,
  ): Promise<XtmOneTaskResponse<Record<string, unknown>>> {
    return this.executeTask(XTM_ONE_AGENT_SLUGS.scenarioGeneration, request);
  }

  generateFullScenario(
    request: FullScenarioGenerationRequest,
  ): Promise<XtmOneTaskResponse<Record<string, unknown>>> {
    return this.executeTask(XTM_ONE_AGENT_SLUGS.fullScenarioGeneration, request);
  }

  generateAtomicTest(
    request: AtomicTestRequest,
  ): Promise<XtmOneTaskResponse<Record<string, unknown>>> {
    return this.executeTask(XTM_ONE_AGENT_SLUGS.atomicTestGeneration, request);
  }

  generateEmails(
    request: EmailGenerationRequest,
  ): Promise<XtmOneTaskResponse<{ emails: Array<Record<string, unknown>> }>> {
    return this.executeTask(XTM_ONE_AGENT_SLUGS.emailGeneration, request);
  }

  discoverEntities(
    request: EntityDiscoveryRequest,
  ): Promise<XtmOneTaskResponse<{ entities: Array<Record<string, unknown>> }>> {
    return this.executeTask(XTM_ONE_AGENT_SLUGS.entityDiscovery, request);
  }

  resolveRelationships(
    request: RelationshipResolutionRequest,
  ): Promise<XtmOneTaskResponse<{ relationships: Array<Record<string, unknown>> }>> {
    return this.executeTask(XTM_ONE_AGENT_SLUGS.relationshipResolution, request);
  }

  scanAll(
    request: EntityDiscoveryRequest,
  ): Promise<
    XtmOneTaskResponse<{
      entities: Array<Record<string, unknown>>;
      relationships: Array<Record<string, unknown>>;
    }>
  > {
    return this.executeTask(XTM_ONE_AGENT_SLUGS.scanAll, request);
  }

  // ==========================================================================
  // Core HTTP boundary
  // ==========================================================================

  private async executeTask<TInput, TOutput>(
    agentSlug: XtmOneAgentSlug,
    inputData: TInput,
  ): Promise<XtmOneTaskResponse<TOutput>> {
    const url = `${this.xtmOneUrl}${EXECUTE_TASK_PATH}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          agent_slug: agentSlug,
          content: JSON.stringify(inputData),
          max_tokens: this.maxTokens,
        }),
      });
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? `Unable to reach XTM One: ${error.message}`
            : 'Unable to reach XTM One',
      };
    }

    const status = response.status;

    if (!response.ok) {
      return {
        success: false,
        status,
        error: await formatHttpError(response, agentSlug),
      };
    }

    let body: { data?: TOutput; error?: string } | null;
    try {
      body = (await response.json()) as { data?: TOutput; error?: string } | null;
    } catch {
      return {
        success: false,
        status,
        error: 'XTM One returned a malformed response',
      };
    }

    if (!body) {
      return { success: false, status, error: 'Empty response from XTM One' };
    }
    if (body.error) {
      return { success: false, status, error: body.error };
    }
    if (body.data === undefined) {
      return { success: false, status, error: 'XTM One returned no data' };
    }
    return { success: true, status, data: body.data };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Map XTM One HTTP statuses to messages we can surface to the user. The
 * mapping mirrors the contract documented in the integration architecture
 * (401 invalid token, 422 version mismatch, 429 quota exceeded).
 */
async function formatHttpError(response: Response, taskId: string): Promise<string> {
  const status = response.status;
  let detail = '';
  try {
    const data = (await response.json()) as { detail?: string; error?: string };
    detail = data.detail || data.error || '';
  } catch {
    try {
      detail = await response.text();
    } catch {
      detail = '';
    }
  }

  switch (status) {
    case 401:
      return 'Your XTM One token is invalid or expired. Please generate a new one.';
    case 403:
      return 'Your XTM One token is not authorized to run this task.';
    case 404:
      if (taskId === 'connection-test') {
        return 'This URL does not appear to be an XTM One instance. Please verify the URL.';
      }
      return `The XTM One agent for task "${taskId}" was not found. Your XTM One server may need an update.`;
    case 422:
      return 'Your XTM One server needs an update to use this feature.';
    case 429:
      return 'You have reached your XTM One AI quota. Please try again later.';
    default:
      if (status >= 500) {
        return `XTM One server error (${status}). ${detail || 'Please try again later.'}`;
      }
      return detail
        ? `XTM One error (${status}): ${detail}`
        : `XTM One error (${status})`;
  }
}

// ============================================================================
// Availability check
// ============================================================================

/**
 * Returns true when the extension has the minimum credentials required to
 * call XTM One. The connectionTested flag is not required — we want AI
 * features to light up as soon as the user has supplied configuration, even
 * if they haven't pressed the "Test connection" button.
 */
export function isAIAvailable(settings?: AISettings): boolean {
  return Boolean(settings?.xtmOneUrl?.trim() && settings?.apiToken?.trim());
}
