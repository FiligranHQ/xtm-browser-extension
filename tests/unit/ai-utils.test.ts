/**
 * AI handler utilities tests (XTM One path).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAITask, truncateContent } from '../../src/background/handlers/ai-utils';
import type { AIClient, XtmOneTaskResponse } from '../../src/shared/api/ai-client';

vi.mock('../../src/shared/utils/storage', () => ({
  getSettings: vi.fn(),
}));
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    background: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

import { getSettings } from '../../src/shared/utils/storage';

const mockedGetSettings = vi.mocked(getSettings);

function withConfiguredAI() {
  mockedGetSettings.mockResolvedValue({
    openctiPlatforms: [],
    openaevPlatforms: [],
    theme: 'dark',
    autoScan: false,
    showNotifications: true,
    splitScreenMode: false,
    detection: {},
    ai: { xtmOneUrl: 'https://xtm.example.com', apiToken: 'fcp-test' },
  });
}

function withoutConfiguredAI() {
  mockedGetSettings.mockResolvedValue({
    openctiPlatforms: [],
    openaevPlatforms: [],
    theme: 'dark',
    autoScan: false,
    showNotifications: true,
    splitScreenMode: false,
    detection: {},
    ai: {},
  });
}

describe('truncateContent', () => {
  it('returns content unchanged below the limit', () => {
    const out = truncateContent('hello', 100, 'test');
    expect(out).toBe('hello');
  });

  it('appends a truncation marker above the limit', () => {
    const out = truncateContent('a'.repeat(200), 50, 'test');
    expect(out?.length).toBeGreaterThan(50);
    expect(out).toMatch(/\[Content truncated due to size\]$/);
  });

  it('returns undefined for undefined input', () => {
    expect(truncateContent(undefined, 50, 'test')).toBeUndefined();
  });
});

describe('executeAITask', () => {
  beforeEach(() => {
    mockedGetSettings.mockReset();
  });

  it('errors when AI is not configured', async () => {
    withoutConfiguredAI();
    const sendResponse = vi.fn();
    await executeAITask(
      'TEST',
      { foo: 'bar' },
      async () => ({ success: true, data: {} }),
      sendResponse,
    );
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/not configured/i) }),
    );
  });

  it('forwards the structured XTM One payload on success', async () => {
    withConfiguredAI();
    const sendResponse = vi.fn();
    const execute = vi.fn(
      async (): Promise<XtmOneTaskResponse<{ message: string }>> => ({
        success: true,
        data: { message: 'ok' },
      }),
    );
    await executeAITask('TEST', { foo: 'bar' }, execute, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { message: 'ok' } });
  });

  it('applies the transform hook to the response data', async () => {
    withConfiguredAI();
    const sendResponse = vi.fn();
    await executeAITask<{ x: number }, { value: number }, { doubled: number }>(
      'TEST',
      { x: 1 },
      async () => ({ success: true, data: { value: 21 } }),
      sendResponse,
      { transform: (data) => ({ doubled: data.value * 2 }) },
    );
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { doubled: 42 } });
  });

  it('surfaces XTM One error message verbatim', async () => {
    withConfiguredAI();
    const sendResponse = vi.fn();
    await executeAITask(
      'TEST',
      {},
      async () => ({ success: false, error: 'XTM One quota exceeded' }),
      sendResponse,
    );
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'XTM One quota exceeded' }),
    );
  });

  it('truncates the configured field before invoking the agent', async () => {
    withConfiguredAI();
    const sendResponse = vi.fn();
    let observed = '';
    const execute = vi.fn(async (_client: AIClient, req: { pageContent: string }) => {
      observed = req.pageContent;
      return { success: true, data: {} };
    });
    // Default maxContentLength is 50000; raise input above that.
    const big = 'a'.repeat(60000);
    await executeAITask(
      'TEST',
      { pageContent: big } as { pageContent: string },
      execute,
      sendResponse,
      { truncateField: 'pageContent' },
    );
    expect(observed.length).toBeLessThanOrEqual(60000);
    expect(observed.endsWith('[Content truncated due to size]')).toBe(true);
  });

  it('catches exceptions thrown by the execute callback', async () => {
    withConfiguredAI();
    const sendResponse = vi.fn();
    await executeAITask(
      'TEST',
      {},
      async () => {
        throw new Error('boom');
      },
      sendResponse,
    );
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'boom' }),
    );
  });

  it('catches exceptions thrown by the transform hook', async () => {
    withConfiguredAI();
    const sendResponse = vi.fn();
    await executeAITask<{ x: number }, { ok: boolean }, never>(
      'TEST',
      { x: 1 },
      async () => ({ success: true, data: { ok: true } }),
      sendResponse,
      {
        transform: () => {
          throw new Error('transform broke');
        },
      },
    );
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'transform broke' }),
    );
  });

  it('errors when XTM One returns success: true but data is undefined', async () => {
    withConfiguredAI();
    const sendResponse = vi.fn();
    await executeAITask(
      'TEST',
      {},
      async () => ({ success: true, data: undefined }),
      sendResponse,
    );
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/no data/i) }),
    );
  });
});
