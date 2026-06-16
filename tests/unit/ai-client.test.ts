/**
 * AIClient tests — XTM One execute-task contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIClient, isAIAvailable, XTM_ONE_AGENT_SLUGS } from '../../src/shared/api/ai-client';
import type { AISettings } from '../../src/shared/types/ai';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return {
    ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number, body: unknown = { detail: 'oops' }) {
  return jsonResponse(body, { status });
}

const validSettings: AISettings = {
  xtmOneUrl: 'https://xtm.example.com',
  apiToken: 'fcp-test-token',
};

describe('AIClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('accepts complete settings', () => {
      expect(() => new AIClient(validSettings)).not.toThrow();
    });

    it('throws when xtmOneUrl is missing', () => {
      expect(() => new AIClient({ apiToken: 'fcp-test' })).toThrow(/required/i);
    });

    it('throws when apiToken is missing', () => {
      expect(() => new AIClient({ xtmOneUrl: 'https://xtm.example.com' })).toThrow(/required/i);
    });

    it('normalizes trailing slashes on the URL', async () => {
      const client = new AIClient({ ...validSettings, xtmOneUrl: 'https://xtm.example.com///' });
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      await client.testConnection();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://xtm.example.com/api/v1/auth/me',
        expect.any(Object),
      );
    });
  });

  describe('executeTask wiring', () => {
    it('posts to execute-task with bearer header and structured body', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { description: 'ok' } }));

      await client.generateContainerDescription({
        pageTitle: 'p',
        pageUrl: 'u',
        pageContent: 'c',
        containerType: 'Report',
        containerName: 'n',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://xtm.example.com/api/v1/extension/execute-task');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer fcp-test-token');
      const body = JSON.parse(init.body);
      expect(body.agent_slug).toBe(XTM_ONE_AGENT_SLUGS.containerDescription);
      expect(JSON.parse(body.content).containerName).toBe('n');
      expect(body.max_tokens).toBe(10000);
    });

    it('returns structured data on success', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { description: 'hello' } }));
      const res = await client.generateContainerDescription({
        pageTitle: 'p', pageUrl: 'u', pageContent: 'c', containerType: 'Report', containerName: 'n',
      });
      expect(res.success).toBe(true);
      expect(res.data?.description).toBe('hello');
    });

    it('reports network errors with a helpful message', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const res = await client.testConnection();
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Unable to reach XTM One/i);
    });
  });

  describe('HTTP error mapping', () => {
    it('401 → invalid/expired token message', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(errorResponse(401));
      const res = await client.testConnection();
      expect(res.success).toBe(false);
      expect(res.status).toBe(401);
      expect(res.error).toMatch(/token is invalid or expired/i);
    });

    it('403 → unauthorized message', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(errorResponse(403));
      const res = await client.testConnection();
      expect(res.error).toMatch(/not authorized/i);
    });

    it('404 → agent not found message, embeds agent slug', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(errorResponse(404));
      const res = await client.generateEmails({
        pageTitle: '', pageUrl: '', pageContent: '', scenarioName: '', attackPatterns: [],
      });
      expect(res.error).toMatch(/agent for task "browser-email-generation" was not found/i);
    });

    it('422 → server needs update message', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(errorResponse(422));
      const res = await client.testConnection();
      expect(res.error).toMatch(/needs an update/i);
    });

    it('429 → quota exceeded message', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(errorResponse(429));
      const res = await client.testConnection();
      expect(res.error).toMatch(/quota/i);
    });

    it('5xx → generic server error', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(errorResponse(503));
      const res = await client.testConnection();
      expect(res.error).toMatch(/server error.*503/i);
    });

    it('malformed JSON success → reports it', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('bad json');
        },
        text: async () => '',
      } as unknown as Response);
      const res = await client.generateContainerDescription({} as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/malformed/i);
    });

    it('success with no data field → treated as error', async () => {
      const client = new AIClient(validSettings);
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      const res = await client.generateContainerDescription({} as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no data/i);
    });
  });

  describe('agent slug mapping', () => {
    const fixtureSettings = validSettings;
    const minimalRequests = {
      scenarioGeneration: { pageTitle: '', pageUrl: '', pageContent: '', scenarioName: '' },
      fullScenarioGeneration: { pageTitle: '', pageUrl: '', pageContent: '', scenarioName: '', typeAffinity: 'ENDPOINT', numberOfInjects: 1 },
      atomicTestGeneration: { attackPattern: { name: 'x' }, targetPlatform: 'linux' },
      entityDiscovery: { pageTitle: '', pageUrl: '', pageContent: '' },
      relationshipResolution: { pageTitle: '', pageUrl: '', pageContent: '', entities: [] },
      scanAll: { pageTitle: '', pageUrl: '', pageContent: '' },
    };

    it.each([
      ['generateScenario', minimalRequests.scenarioGeneration, XTM_ONE_AGENT_SLUGS.scenarioGeneration],
      ['generateFullScenario', minimalRequests.fullScenarioGeneration, XTM_ONE_AGENT_SLUGS.fullScenarioGeneration],
      ['generateAtomicTest', minimalRequests.atomicTestGeneration, XTM_ONE_AGENT_SLUGS.atomicTestGeneration],
      ['discoverEntities', minimalRequests.entityDiscovery, XTM_ONE_AGENT_SLUGS.entityDiscovery],
      ['resolveRelationships', minimalRequests.relationshipResolution, XTM_ONE_AGENT_SLUGS.relationshipResolution],
      ['scanAll', minimalRequests.scanAll, XTM_ONE_AGENT_SLUGS.scanAll],
    ])('%s posts agent_slug=%s', async (method, payload, expectedSlug) => {
      const client = new AIClient(fixtureSettings);
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
      // @ts-expect-error indexed dispatch on client
      await client[method](payload);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.agent_slug).toBe(expectedSlug);
    });
  });
});

describe('AIClient – getMaxContentLength', () => {
  it('returns default when not configured', () => {
    const client = new AIClient(validSettings);
    expect(client.getMaxContentLength()).toBe(50000);
  });

  it('returns custom value when configured', () => {
    const client = new AIClient({ ...validSettings, maxContentLength: 12000 });
    expect(client.getMaxContentLength()).toBe(12000);
  });
});

describe('AIClient – executeTask edge cases', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('reports empty body from XTM One', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse(null));
    const res = await client.generateContainerDescription({
      pageTitle: 'p', pageUrl: 'u', pageContent: 'c', containerType: 'Report', containerName: 'n',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/empty/i);
  });

  it('surfaces body.error from a 200 response', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Agent quota exceeded' }));
    const res = await client.generateScenario({
      pageTitle: '', pageUrl: '', pageContent: '', scenarioName: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Agent quota exceeded');
  });

  it('handles non-Error throw from fetch gracefully', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockRejectedValueOnce('network down');
    const res = await client.generateContainerDescription({
      pageTitle: 'p', pageUrl: 'u', pageContent: 'c', containerType: 'Report', containerName: 'n',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Unable to reach XTM One/i);
  });

  it('handles unknown HTTP status codes', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(errorResponse(418, { detail: "I'm a teapot" }));
    const res = await client.generateContainerDescription({} as any);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/418/);
    expect(res.error).toMatch(/teapot/i);
  });

  it.each([
    ['generateContainerDescription', XTM_ONE_AGENT_SLUGS.containerDescription],
    ['generateEmails', XTM_ONE_AGENT_SLUGS.emailGeneration],
  ])('%s posts the correct agent_slug (%s)', async (method, expectedSlug) => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
    const dummyPayloads: Record<string, unknown> = {
      generateContainerDescription: {
        pageTitle: 'p', pageUrl: 'u', pageContent: 'c', containerType: 'Report', containerName: 'n',
      },
      generateEmails: {
        pageTitle: '', pageUrl: '', pageContent: '', scenarioName: '', attackPatterns: [],
      },
    };
    // @ts-expect-error indexed dispatch
    await client[method](dummyPayloads[method]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.agent_slug).toBe(expectedSlug);
  });
});

describe('isAIAvailable', () => {
  it('returns true when both URL and token are set', () => {
    expect(isAIAvailable({ xtmOneUrl: 'https://x', apiToken: 'fcp-1' })).toBe(true);
  });

  it('returns false when URL missing', () => {
    expect(isAIAvailable({ apiToken: 'fcp-1' })).toBe(false);
  });

  it('returns false when token missing', () => {
    expect(isAIAvailable({ xtmOneUrl: 'https://x' })).toBe(false);
  });

  it('returns false when settings undefined', () => {
    expect(isAIAvailable(undefined)).toBe(false);
  });

  it.each([
    ['empty strings', { xtmOneUrl: '', apiToken: '' }],
    ['whitespace-only URL', { xtmOneUrl: '   ', apiToken: 'fcp-1' }],
    ['whitespace-only token', { xtmOneUrl: 'https://x', apiToken: '  ' }],
  ])('returns false for %s', (_label, settings) => {
    expect(isAIAvailable(settings)).toBe(false);
  });
});

describe('AIClient – constructor normalizeUrl', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it.each([
    ['trailing slashes', 'https://xtm.example.com///', 'https://xtm.example.com'],
    ['leading/trailing whitespace', '  https://xtm.example.com  ', 'https://xtm.example.com'],
    ['whitespace + trailing slash', '  https://xtm.example.com/  ', 'https://xtm.example.com'],
  ])('normalizes %s → %s', async (_label, input, expected) => {
    const client = new AIClient({ ...validSettings, xtmOneUrl: input });
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.testConnection();
    expect(mockFetch.mock.calls[0][0]).toBe(`${expected}/api/v1/auth/me`);
  });
});

describe('AIClient – maxTokens forwarding', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('forwards custom maxTokens value in the request body', async () => {
    const client = new AIClient({ ...validSettings, maxTokens: 25000 });
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: { description: 'ok' } }));
    await client.generateContainerDescription({
      pageTitle: 'p', pageUrl: 'u', pageContent: 'c', containerType: 'Report', containerName: 'n',
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(25000);
  });

  it('uses default (10000) when maxTokens is not configured', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
    await client.generateScenario({ pageTitle: '', pageUrl: '', pageContent: '', scenarioName: '' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(10000);
  });
});

describe('AIClient – testConnection', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns success with message on 200', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ email: 'user@test.com' }));
    const res = await client.testConnection();
    expect(res.success).toBe(true);
    expect(res.data?.message).toMatch(/successful/i);
  });

  it('extracts user_email from "user_email" field', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ user_email: 'admin@filigran.io' }));
    const res = await client.testConnection();
    expect(res.data?.user_email).toBe('admin@filigran.io');
  });

  it('extracts user_email from "email" field as fallback', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ email: 'user@test.com' }));
    const res = await client.testConnection();
    expect(res.data?.user_email).toBe('user@test.com');
  });

  it('extracts user_email from "name" field as last fallback', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ name: 'John Doe' }));
    const res = await client.testConnection();
    expect(res.data?.user_email).toBe('John Doe');
  });

  it('extracts version from "platform_version" field', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ platform_version: '2.1.0' }));
    const res = await client.testConnection();
    expect(res.data?.version).toBe('2.1.0');
  });

  it('extracts version from "version" field as fallback', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ version: '1.0.0' }));
    const res = await client.testConnection();
    expect(res.data?.version).toBe('1.0.0');
  });

  it('enterprise_edition is undefined when config has no license info', async () => {
    const client = new AIClient(validSettings);
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ email: 'user@test.com' }))
      .mockResolvedValueOnce(jsonResponse({ platform_version: '1.0.0' }));
    const res = await client.testConnection();
    expect(res.data?.enterprise_edition).toBeUndefined();
  });

  it('handles non-JSON response body gracefully', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error('not json'); },
      text: async () => 'OK',
    } as unknown as Response);
    const res = await client.testConnection();
    expect(res.success).toBe(true);
    expect(res.data?.user_email).toBeUndefined();
    expect(res.data?.version).toBeUndefined();
  });

  it('uses GET method with credentials omit', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.testConnection();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('omit');
  });

  it('404 returns "does not appear to be XTM One" message', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(errorResponse(404));
    const res = await client.testConnection();
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/does not appear to be.*XTM One/i);
  });

  it('fetches /api/v1/platform/config for version and license info', async () => {
    const client = new AIClient(validSettings);
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ user_email: 'admin@filigran.io' }))
      .mockResolvedValueOnce(jsonResponse({
        platform_version: '3.0.0',
        deployment_tier: 'xtm_licensed',
      }));
    const res = await client.testConnection();
    expect(res.data?.user_email).toBe('admin@filigran.io');
    expect(res.data?.version).toBe('3.0.0');
    expect(res.data?.enterprise_edition).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe('https://xtm.example.com/api/v1/platform/config');
  });

  it('detects EE from xtm_license.valid when deployment_tier is absent', async () => {
    const client = new AIClient(validSettings);
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ email: 'user@test.com' }))
      .mockResolvedValueOnce(jsonResponse({
        platform_version: '2.0.0',
        xtm_license: { valid: true, license_type: 'standard' },
      }));
    const res = await client.testConnection();
    expect(res.data?.version).toBe('2.0.0');
    expect(res.data?.enterprise_edition).toBe(true);
  });

  it('detects CE from deployment_tier ce_only', async () => {
    const client = new AIClient(validSettings);
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ email: 'user@test.com' }))
      .mockResolvedValueOnce(jsonResponse({
        deployment_tier: 'ce_only',
      }));
    const res = await client.testConnection();
    expect(res.data?.enterprise_edition).toBe(false);
  });

  it('still succeeds if config endpoint fails', async () => {
    const client = new AIClient(validSettings);
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ user_email: 'user@test.com' }))
      .mockRejectedValueOnce(new Error('network error'));
    const res = await client.testConnection();
    expect(res.success).toBe(true);
    expect(res.data?.user_email).toBe('user@test.com');
    expect(res.data?.version).toBeUndefined();
  });
});

describe('AIClient – executeTask fetch options', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('sets credentials to omit on task requests', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
    await client.generateContainerDescription({
      pageTitle: 'p', pageUrl: 'u', pageContent: 'c', containerType: 'Report', containerName: 'n',
    });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.credentials).toBe('omit');
  });

  it('sends Content-Type application/json', async () => {
    const client = new AIClient(validSettings);
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
    await client.generateContainerDescription({
      pageTitle: 'p', pageUrl: 'u', pageContent: 'c', containerType: 'Report', containerName: 'n',
    });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
  });
});
