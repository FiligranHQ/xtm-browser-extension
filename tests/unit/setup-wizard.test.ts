/**
 * Unit Tests for the popup setup wizard hook
 *
 * Covers the races behind #220: a second Connect or Skip while a save is in
 * flight or finishing, the popup closing before the step transition, duplicate
 * platforms, when the XTM One step is offered, and the failure paths around them.
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
let failure: { getSettings?: string | Error; saveSettings?: string; storageWrite?: boolean };
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

function renderWizard(
  hasEnterpriseConfigured = false,
  initialStatus: ConnectionStatus = { opencti: [], openaev: [], xtmOne: null },
) {
  const view = {} as { wizard: Wizard; status: ConnectionStatus };
  function Harness() {
    const [status, setStatus] = useState<ConnectionStatus>(initialStatus);
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
  failure = {};

  const { storage, runtime } = chromeMock();
  storage.local.get.mockImplementation(async (key: string) => ({ [key]: structuredClone(store[key]) }));
  storage.local.set.mockImplementation(async (items: Record<string, unknown>) => {
    if (failure.storageWrite) throw new Error('QUOTA_BYTES quota exceeded');
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
        if (failure.getSettings instanceof Error) throw failure.getSettings;
        if (failure.getSettings) return { success: false, error: failure.getSettings };
        return { success: true, data: structuredClone(settings) };
      case 'SAVE_SETTINGS':
        if (failure.saveSettings) return { success: false, error: failure.saveSettings };
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

  it('reuses the saved platform when the URL differs only in case', async () => {
    settings.openaevPlatforms = [{ id: 'openaev-existing', url: OAEV_URL, apiToken: TOKEN }];
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'openaev', 'HTTPS://OpenAEV.Example.Test/');

    await connect(() => view.wizard, 'openaev');

    expect(sentCount('SAVE_SETTINGS')).toBe(0);
    expect(settings.openaevPlatforms).toHaveLength(1);
    expect(view.status.openaev.map((p) => p.id)).toEqual(['openaev-existing']);
    unmount();
  });

  it('updates the token of the platform saved for the same URL instead of adding one', async () => {
    settings.openaevPlatforms = [
      { id: 'openaev-other', url: 'https://other.example.test', apiToken: 'kept' },
      { id: 'openaev-existing', url: OAEV_URL, apiToken: 'expired-token' },
    ];
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');

    expect(sentCount('SAVE_SETTINGS')).toBe(1);
    expect(settings.openaevPlatforms.map((p) => [p.id, p.apiToken])).toEqual([
      ['openaev-other', 'kept'],
      ['openaev-existing', TOKEN],
    ]);
    expect(view.status.openaev.map((p) => p.id)).toEqual(['openaev-existing']);
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

  it('keeps the user on the step when saving the platform fails', async () => {
    failure.saveSettings = 'Failed to save settings';
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');
    expect(view.wizard.setupError).toBe('Failed to save settings');
    expect(view.wizard.setupSuccess).toBe(false);
    expect(view.status.openaev).toHaveLength(0); // not shown as connected when nothing was saved
    expect(store[SETUP_STATE_KEY]).toMatchObject({ setupStep: 'openaev', setupUrl: OAEV_URL });

    failure.saveSettings = undefined;
    await connect(() => view.wizard, 'openaev');
    expect(settings.openaevPlatforms).toHaveLength(1);
    expect(view.status.openaev).toHaveLength(1);
    unmount();
  });

  it('lists a reconnected platform once in the popup status', async () => {
    settings.openaevPlatforms = [{ id: 'openaev-existing', url: OAEV_URL, apiToken: TOKEN }];
    const listed = { id: 'openaev-existing', name: 'OpenAEV', url: OAEV_URL, connected: false };
    const { view, unmount } = renderWizard(true, { opencti: [], openaev: [listed], xtmOne: null });
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');

    expect(view.status.openaev).toHaveLength(1);
    expect(view.status.openaev[0]).toMatchObject({ id: 'openaev-existing', connected: true });
    unmount();
  });

  it('still completes the step when the wizard state cannot be persisted', async () => {
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'openaev');
    failure.storageWrite = true;

    await connect(() => view.wizard, 'openaev');
    await advance(1000);

    expect(settings.openaevPlatforms).toHaveLength(1);
    expect(view.wizard.setupStep).toBe('xtm-one');
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

  it('uses the new test result, not the saved copy, when reconnecting a platform that lost EE', async () => {
    settings.openaevPlatforms = [{ id: 'openaev-existing', url: OAEV_URL, apiToken: 'old-token', isEnterprise: true }];
    connectionTest.enterprise = false;
    const { view, unmount } = renderWizard(true); // popup status still shows the saved EE copy
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');
    expect(settings.openaevPlatforms[0]).toMatchObject({ id: 'openaev-existing', isEnterprise: false });
    expect(store[SETUP_STATE_KEY]).toBeUndefined();

    await advance(1000);
    expect(view.wizard.isInSetupWizard).toBe(false);
    unmount();
  });

  it('still offers XTM One when another saved platform is EE', async () => {
    settings.openctiPlatforms = [{ id: 'opencti-ee', url: 'https://opencti.example.test', apiToken: 't', isEnterprise: true }];
    settings.openaevPlatforms = [{ id: 'openaev-existing', url: OAEV_URL, apiToken: 'old-token', isEnterprise: true }];
    connectionTest.enterprise = false;
    const { view, unmount } = renderWizard(true);
    await openStep(() => view.wizard, 'openaev');

    await connect(() => view.wizard, 'openaev');
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

  it.each([
    ['returns an error', 'Storage unavailable', 'Storage unavailable'],
    ['throws', new Error('Extension context invalidated'), 'Extension context invalidated'],
  ])('stays on OpenAEV and shows the error when reading the settings %s', async (_case, getSettingsFailure, message) => {
    failure.getSettings = getSettingsFailure;
    const { view, unmount } = renderWizard(false);
    await openStep(() => view.wizard, 'openaev');

    await skip(() => view.wizard, 'openaev');
    expect(view.wizard.setupStep).toBe('openaev');
    expect(view.wizard.isInSetupWizard).toBe(true);
    expect(view.wizard.setupError).toBe(message);

    failure.getSettings = undefined;
    await skip(() => view.wizard, 'openaev');
    expect(view.wizard.isInSetupWizard).toBe(false);
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
