/**
 * Unit Tests for the popup setup wizard hook
 *
 * Covers the races behind #220: a second Connect or Skip while a save is in
 * flight or finishing, the popup closing before the step transition, duplicate
 * platforms, and when the XTM One step is offered.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useSetupWizard } from '../../src/popup/hooks/useSetupWizard';
import type { ConnectionStatus, SetupStep } from '../../src/popup/types';

const SETUP_STATE_KEY = 'xtm_setup_wizard_state';
const OAEV_URL = 'https://openaev.example.test';
const TOKEN = 'token-123';

type Wizard = ReturnType<typeof useSetupWizard>;
type PlatformType = 'opencti' | 'openaev' | 'xtm-one';

interface StoredPlatform {
  id: string;
  url: string;
  apiToken: string;
  isEnterprise?: boolean;
}

let store: Record<string, unknown>;
let settings: { openctiPlatforms: StoredPlatform[]; openaevPlatforms: StoredPlatform[]; ai: Record<string, unknown> };
let connectionTest: { enterprise: boolean; error?: string };
let heldConnectionTest: Promise<void> | null;
// Unmounted in afterEach so a failing test cannot leak a live hook into the next one
let mountedRoots: Array<() => void> = [];

const chromeMock = () => (globalThis as any).chrome;

const sentCount = (type: string) =>
  chromeMock().runtime.sendMessage.mock.calls.filter(([message]: [{ type: string }]) => message.type === type).length;

/** Keep TEST_PLATFORM_CONNECTION pending until the returned function is called */
function holdConnectionTest(): () => void {
  let release!: () => void;
  heldConnectionTest = new Promise<void>((resolve) => { release = resolve; });
  return release;
}

function renderWizard(hasEnterpriseConfigured = false) {
  const view = {} as { wizard: Wizard; status: ConnectionStatus };
  function Harness() {
    const [status, setStatus] = useState<ConnectionStatus>({ opencti: [], openaev: [], xtmOne: null });
    view.status = status;
    view.wizard = useSetupWizard({ setStatus, hasEnterpriseConfigured });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Harness)));
  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    act(() => root.unmount());
  };
  mountedRoots.push(unmount);
  return { view, unmount };
}

const flush = () => act(async () => {});
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

async function openStep(wizard: () => Wizard, step: SetupStep, url = OAEV_URL, token = TOKEN) {
  await flush(); // persisted state load on mount
  await act(async () => {
    wizard().setIsInSetupWizard(true);
    wizard().setSetupStep(step);
    wizard().setSetupUrl(url);
    wizard().setSetupToken(token);
  });
}

const connect = (wizard: () => Wizard, platformType: PlatformType) =>
  act(async () => { await wizard().handleSetupTestAndSave(platformType); });

const skip = (wizard: () => Wizard, step: PlatformType) =>
  act(async () => { await wizard().handleSetupSkip(step); });

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();

  store = {};
  settings = { openctiPlatforms: [], openaevPlatforms: [], ai: {} };
  connectionTest = { enterprise: true };
  heldConnectionTest = null;

  const { storage, runtime } = chromeMock();
  storage.local.get.mockImplementation(async (key: string) => ({ [key]: structuredClone(store[key]) }));
  storage.local.set.mockImplementation(async (items: Record<string, unknown>) => {
    Object.assign(store, structuredClone(items));
  });
  storage.local.remove.mockImplementation(async (key: string) => { delete store[key]; });
  runtime.sendMessage.mockImplementation(async (message: { type: string; payload?: any }) => {
    switch (message.type) {
      case 'TEST_PLATFORM_CONNECTION':
      case 'AI_TEST_CONNECTION':
        if (heldConnectionTest) await heldConnectionTest;
        if (connectionTest.error) return { success: false, error: connectionTest.error };
        return {
          success: true,
          data: {
            platform_name: 'OpenAEV',
            settings: { platform_title: 'OpenCTI' },
            enterprise_edition: connectionTest.enterprise,
            version: '1.0.0',
            user: { user_email: 'admin@example.test' },
            me: { name: 'admin' },
          },
        };
      case 'GET_SETTINGS':
        return { success: true, data: structuredClone(settings) };
      case 'SAVE_SETTINGS':
        settings = structuredClone(message.payload);
        return { success: true };
      default:
        return { success: true };
    }
  });
});

afterEach(() => {
  mountedRoots.forEach((unmount) => unmount());
  mountedRoots = [];
  vi.useRealTimers();
  const { storage, runtime } = chromeMock();
  [storage.local.get, storage.local.set, storage.local.remove, runtime.sendMessage].forEach((fn) => fn.mockReset());
});

describe('useSetupWizard — Connect', () => {
  it('ignores a second Connect while the first one is in flight', async () => {
    const { view, unmount } = renderWizard();
    await openStep(() => view.wizard, 'openaev');

    const release = holdConnectionTest();
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => { first = view.wizard.handleSetupTestAndSave('openaev'); });
    await act(async () => { second = view.wizard.handleSetupTestAndSave('openaev'); });
    release();
    await act(async () => { await Promise.all([first, second]); });

    expect(sentCount('TEST_PLATFORM_CONNECTION')).toBe(1);
    expect(settings.openaevPlatforms).toHaveLength(1);
    unmount();
  });

  it('ignores Connect during the success delay, then moves to the next step', async () => {
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');
    expect(view.wizard.setupSuccess).toBe(true);
    expect(view.wizard.setupUrl).toBe(OAEV_URL); // form still filled during the delay
    await connect(() => view.wizard, 'openaev');

    await advance(1000);
    expect(sentCount('SAVE_SETTINGS')).toBe(1);
    expect(settings.openaevPlatforms).toHaveLength(1);
    expect(view.status.openaev).toHaveLength(1);
    expect(view.wizard.setupStep).toBe('xtm-one');
    expect(view.wizard.setupSuccess).toBe(false);
    unmount();
  });

  it('persists the next step without credentials as soon as the save succeeds', async () => {
    const first = renderWizard(true);
    await openStep(() => first.view.wizard, 'openaev');
    await connect(() => first.view.wizard, 'openaev');
    first.unmount(); // popup closes before the delay ends

    expect(store[SETUP_STATE_KEY]).toEqual({
      setupStep: 'xtm-one',
      isInSetupWizard: true,
      setupUrl: '',
      setupToken: '',
      setupName: '',
    });

    const reopened = renderWizard(true);
    await flush();
    expect(reopened.view.wizard.setupStep).toBe('xtm-one');
    expect(reopened.view.wizard.setupToken).toBe('');
    reopened.unmount();
  });

  it('reuses the saved platform when Connect is retried after the popup closed mid-request', async () => {
    settings.openaevPlatforms = [{ id: 'openaev-existing', url: OAEV_URL, apiToken: TOKEN }];
    store[SETUP_STATE_KEY] = {
      setupStep: 'openaev',
      isInSetupWizard: true,
      setupUrl: `${OAEV_URL}/`,
      setupToken: TOKEN,
      setupName: '',
    };
    const { view, unmount } = renderWizard(true);
    await flush();
    expect(view.wizard.setupStep).toBe('openaev');

    await connect(() => view.wizard, 'openaev');

    expect(sentCount('SAVE_SETTINGS')).toBe(0);
    expect(settings.openaevPlatforms).toHaveLength(1);
    expect(view.status.openaev.map((p) => p.id)).toEqual(['openaev-existing']);
    unmount();
  });

  it('adds a separate platform for the same URL with another token', async () => {
    settings.openaevPlatforms = [{ id: 'openaev-existing', url: OAEV_URL, apiToken: 'other-token' }];
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');

    expect(settings.openaevPlatforms.map((p) => p.apiToken)).toEqual(['other-token', TOKEN]);
    unmount();
  });

  it('lets the user retry after a failed connection', async () => {
    connectionTest.error = 'Connection refused';
    const { view, unmount } = renderWizard();
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');
    expect(view.wizard.setupError).toBe('Connection refused');
    expect(view.wizard.setupTesting).toBe(false);

    connectionTest.error = undefined;
    await connect(() => view.wizard, 'openaev');
    expect(view.wizard.setupSuccess).toBe(true);
    expect(settings.openaevPlatforms).toHaveLength(1);
    unmount();
  });

  it('saves XTM One and clears the persisted state before the delay', async () => {
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'xtm-one', 'https://xtm-one.example.test', 'fcp-token');
    expect(store[SETUP_STATE_KEY]).toMatchObject({ setupStep: 'xtm-one' });

    await connect(() => view.wizard, 'xtm-one');
    expect(settings.ai).toMatchObject({ xtmOneUrl: 'https://xtm-one.example.test', apiToken: 'fcp-token' });
    expect(store[SETUP_STATE_KEY]).toBeUndefined();

    await advance(1000);
    expect(view.wizard.isInSetupWizard).toBe(false);
    expect(store[SETUP_STATE_KEY]).toBeUndefined();
    unmount();
  });

  it('offers XTM One after a community OpenAEV when an EE platform is already saved', async () => {
    settings.openctiPlatforms = [{ id: 'opencti-ee', url: 'https://opencti.example.test', apiToken: 't', isEnterprise: true }];
    connectionTest.enterprise = false;
    const { view, unmount } = renderWizard(false); // platform status not loaded yet
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');
    expect(store[SETUP_STATE_KEY]).toMatchObject({ setupStep: 'xtm-one' });

    await advance(1000);
    expect(view.wizard.setupStep).toBe('xtm-one');
    unmount();
  });

  it('ends the wizard after OpenAEV when no platform is Enterprise', async () => {
    connectionTest.enterprise = false;
    const { view, unmount } = renderWizard(false);
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');
    expect(store[SETUP_STATE_KEY]).toBeUndefined();

    await advance(1000);
    expect(view.wizard.isInSetupWizard).toBe(false);
    unmount();
  });
});

describe('useSetupWizard — Skip', () => {
  it('ignores Skip while a Connect is in flight', async () => {
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'opencti', 'https://opencti.example.test');

    const release = holdConnectionTest();
    let pending!: Promise<void>;
    await act(async () => { pending = view.wizard.handleSetupTestAndSave('opencti'); });
    await skip(() => view.wizard, 'opencti');
    expect(view.wizard.setupStep).toBe('opencti');
    expect(view.wizard.setupUrl).toBe('https://opencti.example.test');

    release();
    await act(async () => { await pending; });
    await advance(1000);
    expect(view.wizard.setupStep).toBe('openaev');
    expect(settings.openctiPlatforms).toHaveLength(1);
    unmount();
  });

  it('checks the saved settings for an EE platform when skipping OpenAEV', async () => {
    settings.openctiPlatforms = [{ id: 'opencti-ee', url: 'https://opencti.example.test', apiToken: 't', isEnterprise: true }];
    const { view, unmount } = renderWizard(false); // platform status not loaded yet
    await openStep(() => view.wizard, 'openaev');

    await skip(() => view.wizard, 'openaev');
    expect(view.wizard.setupStep).toBe('xtm-one');
    expect(view.wizard.isInSetupWizard).toBe(true);
    unmount();
  });

  it('ends the wizard when skipping OpenAEV with no EE platform', async () => {
    const { view, unmount } = renderWizard(false);
    await openStep(() => view.wizard, 'openaev');

    await skip(() => view.wizard, 'openaev');
    expect(view.wizard.isInSetupWizard).toBe(false);
    expect(store[SETUP_STATE_KEY]).toBeUndefined();
    unmount();
  });
});
