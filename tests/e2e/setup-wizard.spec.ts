/**
 * Setup Wizard E2E Tests
 *
 * Covers the conditional XTM One step logic in useSetupWizard:
 * - Without an EE platform configured, skipping the OpenAEV step ends the wizard.
 * - With an EE platform already configured, skipping OpenAEV advances to XTM One.
 */

import { test, expect, type BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectPageCoverage, collectBackgroundCoverage } from './coverage-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.join(__dirname, '../../dist/chrome');

const MOCK_EE_PLATFORM = {
  id: 'mock-ee',
  name: 'Mock EE Platform',
  url: 'https://opencti.mock.test',
  apiToken: 'mock-token',
  enabled: true,
  isEnterprise: true,
  type: 'opencti',
};

// Storage key used by useSetupWizard
const SETUP_STATE_KEY = 'xtm_setup_wizard_state';

async function createExtensionContext(): Promise<BrowserContext> {
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

// ---------------------------------------------------------------------------
// Without EE: skipping OpenAEV ends the wizard
// ---------------------------------------------------------------------------

test.describe('Setup Wizard — no EE platform', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'setup-wizard-no-ee', extensionId);
    await context.close();
  });

  test('skipping OpenAEV ends the wizard without showing the XTM One step', async () => {
    const page = await context.newPage();

    // Start from a clean state so the welcome screen is shown
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(async (key) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.remove(key);
    }, SETUP_STATE_KEY);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Start the wizard
    await page.getByRole('button', { name: 'Get Started' }).click();

    // OpenCTI step → skip
    await expect(page.getByText('Connect OpenCTI')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Skip' }).click();

    // OpenAEV step → skip
    await expect(page.getByText('Connect OpenAEV')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Skip' }).click();

    // Wizard should end: welcome screen reappears, XTM One step is never shown
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Connect XTM One')).not.toBeVisible();

    await collectPageCoverage(page, 'setup-wizard-no-ee-skip', 'popup');
    await page.close();
  });
});

// ---------------------------------------------------------------------------
// With EE: skipping OpenAEV advances to XTM One
// ---------------------------------------------------------------------------

test.describe('Setup Wizard — with EE platform', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'setup-wizard-with-ee', extensionId);
    await context.close();
  });

  test('skipping OpenAEV advances to the XTM One step when an EE platform is configured', async () => {
    const page = await context.newPage();

    // Seed: EE platform already configured + wizard resumed at the openaev step
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(
      async ({ platform, key, wizardState }) => {
        await chrome.storage.local.clear();
        await chrome.storage.local.set({
          settings: { openctiPlatforms: [platform] },
          [key]: wizardState,
        });
      },
      {
        platform: MOCK_EE_PLATFORM,
        key: SETUP_STATE_KEY,
        wizardState: {
          isInSetupWizard: true,
          setupStep: 'openaev',
          setupUrl: '',
          setupToken: '',
          setupName: '',
        },
      },
    );
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Wizard resumes at OpenAEV → skip
    await expect(page.getByText('Connect OpenAEV')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Skip' }).click();

    // XTM One step should appear
    await expect(page.getByText('Connect XTM One')).toBeVisible({ timeout: 5000 });

    await collectPageCoverage(page, 'setup-wizard-ee-skip-to-xtm', 'popup');
    await page.close();
  });
});
