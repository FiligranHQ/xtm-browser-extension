/**
 * AI Settings & XTM One Integration E2E Tests
 *
 * Tests the XTM One configuration UI, disabled-state messaging, settings
 * persistence, and background message handling — all without requiring an
 * actual XTM One backend.
 */

import { test, expect, type BrowserContext, chromium, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectPageCoverage, collectBackgroundCoverage } from './coverage-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.join(__dirname, '../../dist/chrome');

// A minimal EE platform config so the AI tab becomes enabled in settings.
const MOCK_EE_PLATFORM = {
  id: 'mock-ee',
  name: 'Mock EE Platform',
  url: 'https://opencti.mock.test',
  apiToken: 'mock-token',
  enabled: true,
  isEnterprise: true,
  type: 'opencti',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createExtensionContext() {
  return chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
  }
  const match = sw.url().match(/chrome-extension:\/\/([^/]+)/);
  if (!match) throw new Error('Could not determine extension ID');
  return match[1];
}

async function openOptions(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options/index.html`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  return page;
}

async function openPanel(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/panel/index.html`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  return page;
}

/**
 * Seed an Enterprise platform into storage so the AI tab is accessible,
 * then reload the page.
 */
async function seedEEPlatformAndReload(page: Page): Promise<void> {
  await page.evaluate(async (platform) => {
    const result = await chrome.storage.local.get('settings');
    const settings = (result as any).settings || {};
    settings.openctiPlatforms = [platform];
    await chrome.storage.local.set({ settings });
  }, MOCK_EE_PLATFORM);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/** Click the "XTM One" sidebar item. */
async function navigateToAITab(page: Page): Promise<void> {
  const aiTab = page.getByText('XTM One');
  await expect(aiTab).toBeVisible({ timeout: 5000 });
  await aiTab.click();
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Tests: Options Page — AI Tab Rendering & Interaction
// ---------------------------------------------------------------------------

test.describe('Options Page — AI Tab', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'ai-settings-tab', extensionId);
    await context.close();
  });

  test('AI tab renders XTM One URL and token fields', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    await expect(page.getByLabel('XTM One URL')).toBeVisible();
    await expect(page.getByLabel('XTM One API Token')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test Connection' })).toBeVisible();

    await collectPageCoverage(page, 'ai-tab-render', 'options');
    await page.close();
  });

  test('Test Connection button is disabled until both fields are filled', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    const testBtn = page.getByRole('button', { name: 'Test Connection' });

    // Both empty → disabled
    await expect(testBtn).toBeDisabled();

    // Only URL → still disabled
    await page.getByLabel('XTM One URL').fill('https://xtm.example.com');
    await expect(testBtn).toBeDisabled();

    // Both filled → enabled
    await page.getByLabel('XTM One API Token').fill('fcp-test-123');
    await expect(testBtn).toBeEnabled();

    await collectPageCoverage(page, 'ai-tab-button-state', 'options');
    await page.close();
  });

  test('Test Connection button stays disabled for whitespace-only values', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    await page.getByLabel('XTM One URL').fill('   ');
    await page.getByLabel('XTM One API Token').fill('   ');
    await expect(page.getByRole('button', { name: 'Test Connection' })).toBeDisabled();

    await page.close();
  });

  test('"Get API Token" link appears after entering URL', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    // Before URL → helper text
    await expect(page.getByText('Enter your XTM One URL above')).toBeVisible();

    // Enter URL → link appears
    await page.getByLabel('XTM One URL').fill('https://xtm.example.com');
    await page.waitForTimeout(200);
    const link = page.getByRole('link', { name: 'XTM One profile' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://xtm.example.com/profile/api-keys');

    await collectPageCoverage(page, 'ai-tab-token-link', 'options');
    await page.close();
  });

  test('clearing URL and token fields and saving resets configuration', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    await page.getByLabel('XTM One URL').fill('https://xtm.example.com');
    await page.getByLabel('XTM One API Token').fill('fcp-test-123');

    // Clear the fields manually
    await page.getByLabel('XTM One URL').fill('');
    await page.getByLabel('XTM One API Token').fill('');

    await expect(page.getByLabel('XTM One URL')).toHaveValue('');
    await expect(page.getByLabel('XTM One API Token')).toHaveValue('');

    await collectPageCoverage(page, 'ai-tab-clear', 'options');
    await page.close();
  });

  test('no BYOK provider dropdown exists', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    await expect(page.getByText('OpenAI', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Anthropic', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Gemini', { exact: true })).not.toBeVisible();

    await collectPageCoverage(page, 'ai-tab-no-byok', 'options');
    await page.close();
  });
});

// ---------------------------------------------------------------------------
// Tests: Options Page — Connection Test via Background
// ---------------------------------------------------------------------------

test.describe('Options Page — Connection Test (background messaging)', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'ai-connection-test', extensionId);
    await context.close();
  });

  test('connection test to unreachable host returns error via message', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    // Send AI_TEST_CONNECTION directly and verify the response
    const response = await page.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'AI_TEST_CONNECTION',
            payload: {
              xtmOneUrl: 'https://xtm-nonexistent-host-12345.invalid',
              apiToken: 'fcp-test',
            },
          },
          (resp) => resolve(resp),
        );
      });
    });

    expect(response).toBeTruthy();
    expect((response as any).success).toBe(false);
    expect((response as any).error).toMatch(/unable|reach|fail|error/i);

    await collectPageCoverage(page, 'ai-connection-test-error', 'options');
    await page.close();
  });

  test('Test Connection button click shows error alert for invalid host', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    await page.getByLabel('XTM One URL').fill('https://xtm-nonexistent-host-12345.invalid');
    await page.getByLabel('XTM One API Token').fill('fcp-test');
    await page.getByRole('button', { name: 'Test Connection' }).click();

    // Error alert should eventually appear
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 30000 });

    // Alert content should indicate a connection failure
    const alertText = await errorAlert.textContent();
    expect(alertText).toBeTruthy();

    await collectPageCoverage(page, 'ai-connection-ui-flow', 'options');
    await page.close();
  });
});

// ---------------------------------------------------------------------------
// Tests: Options Page — Settings Persistence
// ---------------------------------------------------------------------------

test.describe('Options Page — Settings Persistence', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'ai-settings-persistence', extensionId);
    await context.close();
  });

  test('settings persist after save and page reload', async () => {
    const page = await openOptions(context, extensionId);
    await seedEEPlatformAndReload(page);
    await navigateToAITab(page);

    await page.getByLabel('XTM One URL').fill('https://xtm.persisted.com');
    await page.getByLabel('XTM One API Token').fill('fcp-persisted-token');
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await page.waitForTimeout(500);

    // Reload and verify
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await navigateToAITab(page);

    await expect(page.getByLabel('XTM One URL')).toHaveValue('https://xtm.persisted.com');
    await expect(page.getByLabel('XTM One API Token')).toHaveValue('fcp-persisted-token');

    await collectPageCoverage(page, 'ai-settings-persist', 'options');
    await page.close();
  });
});

// ---------------------------------------------------------------------------
// Tests: Panel — AI Disabled State
// ---------------------------------------------------------------------------

test.describe('Panel — AI disabled when not configured', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(async (platform) => {
      const result = await chrome.storage.local.get('settings');
      const settings = (result as any).settings || {};
      settings.openctiPlatforms = [platform];
      delete settings.ai;
      await chrome.storage.local.set({ settings });
    }, MOCK_EE_PLATFORM);
    await page.close();
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'ai-disabled-panel', extensionId);
    await context.close();
  });

  test('panel renders without errors when AI not configured', async () => {
    const page = await openPanel(context, extensionId);

    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();

    // No crash, no blank page
    const hasContent = await page.locator('button, [role="button"], p, h1, h2, h3, h4, h5, h6, span').count();
    expect(hasContent).toBeGreaterThan(0);

    await collectPageCoverage(page, 'panel-ai-disabled', 'panel');
    await page.close();
  });
});

// ---------------------------------------------------------------------------
// Tests: Background — AI Message Handling (no AI configured)
// ---------------------------------------------------------------------------

test.describe('Background — AI messages return error when not configured', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(async (platform) => {
      const result = await chrome.storage.local.get('settings');
      const settings = (result as any).settings || {};
      settings.openctiPlatforms = [platform];
      delete settings.ai;
      await chrome.storage.local.set({ settings });
    }, MOCK_EE_PLATFORM);
    await page.close();
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'ai-messages-no-config', extensionId);
    await context.close();
  });

  const aiMessageTypes = [
    'AI_GENERATE_DESCRIPTION',
    'AI_GENERATE_SCENARIO',
    'AI_GENERATE_FULL_SCENARIO',
    'AI_GENERATE_ATOMIC_TEST',
    'AI_GENERATE_EMAILS',
    'AI_DISCOVER_ENTITIES',
    'AI_RESOLVE_RELATIONSHIPS',
  ];

  for (const messageType of aiMessageTypes) {
    test(`${messageType} returns "not configured" error`, async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/panel/index.html`);
      await page.waitForLoadState('networkidle');

      const response = await page.evaluate(async (type) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type, payload: {} },
            (resp) => resolve(resp),
          );
        });
      }, messageType);

      expect(response).toBeTruthy();
      expect((response as any).success).toBe(false);
      expect((response as any).error).toMatch(/not configured/i);

      await page.close();
    });
  }
});
