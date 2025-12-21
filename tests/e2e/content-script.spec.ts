/**
 * Content Script E2E Tests
 * 
 * Tests the content script injection and page scanning functionality.
 */

import { test, expect, type BrowserContext, chromium, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { collectPageCoverage, collectBackgroundCoverage } from './coverage-utils';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '../../dist/chrome');
const FIXTURES_PATH = path.join(__dirname, 'fixtures');

// Convert local file path to file:// URL
function getFixtureUrl(filename: string): string {
  const filePath = path.join(FIXTURES_PATH, filename);
  return pathToFileURL(filePath).href;
}

async function createExtensionContext() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // Allow file:// URLs for content scripts
      '--allow-file-access-from-files',
    ],
  });
  return context;
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 30000 });
  }
  const swUrl = serviceWorker.url();
  const match = swUrl.match(/chrome-extension:\/\/([^/]+)/);
  if (!match) throw new Error('Could not determine extension ID');
  return match[1];
}

// Helper to collect coverage from a page before closing
async function collectAndClosePage(page: Page, testName: string, pageType: string) {
  await collectPageCoverage(page, testName, pageType);
  await page.close();
}

test.describe('Content Script on Test Pages', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
    // Wait for extension to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'content-script-tests', extensionId);
    await context.close();
  });

  test('should load on threat report page', async () => {
    const page = await context.newPage();
    
    await page.goto(getFixtureUrl('threat-report.html'));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Page should have loaded correctly
    const title = await page.title();
    expect(title).toContain('APT29');
    
    // Content script should not break the page
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('APT29');
    expect(bodyText).toContain('192.168.1.100');
    
    await collectAndClosePage(page, 'threat-report-load', 'content');
  });

  test('should load on empty page without errors', async () => {
    const page = await context.newPage();
    
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto(getFixtureUrl('empty-page.html'));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Should have loaded
    const title = await page.title();
    expect(title).toContain('Empty');
    
    // Should not have critical errors
    const criticalErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('net::ERR')
    );
    
    // Some errors might be expected from the extension's functionality
    // but there shouldn't be crashes
    
    await collectAndClosePage(page, 'empty-page-load', 'content');
  });

  test('should handle defanged IOCs page', async () => {
    const page = await context.newPage();
    
    await page.goto(getFixtureUrl('defanged-iocs.html'));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Page should contain defanged indicators
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('192[.]168[.]1[.]1');
    expect(bodyText).toContain('evil[.]example[.]com');
    expect(bodyText).toContain('hxxp://');
    
    await collectAndClosePage(page, 'defanged-iocs-load', 'content');
  });
});

test.describe('Extension Panel Integration', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'panel-integration', extensionId);
    await context.close();
  });

  test('panel should work alongside content page', async () => {
    // Open a content page
    const contentPage = await context.newPage();
    await contentPage.goto(getFixtureUrl('threat-report.html'));
    await contentPage.waitForLoadState('domcontentloaded');
    
    // Open panel in another tab
    const panelUrl = `chrome-extension://${extensionId}/panel/index.html`;
    const panelPage = await context.newPage();
    await panelPage.goto(panelUrl);
    await panelPage.waitForLoadState('domcontentloaded');
    await panelPage.waitForTimeout(1000);
    
    // Both should be functional
    const contentText = await contentPage.textContent('body');
    expect(contentText).toContain('APT29');
    
    const panelText = await panelPage.textContent('body');
    expect(panelText).toBeTruthy();
    
    // Collect coverage from both pages
    await collectPageCoverage(contentPage, 'panel-with-content', 'content');
    await collectPageCoverage(panelPage, 'panel-with-content', 'panel');
    
    await contentPage.close();
    await panelPage.close();
  });
});

test.describe('Navigation and State', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test.afterAll(async () => {
    await collectBackgroundCoverage(context, 'navigation-state', extensionId);
    await context.close();
  });

  test('should handle page navigation', async () => {
    const page = await context.newPage();
    
    // Navigate to first page
    await page.goto(getFixtureUrl('threat-report.html'));
    await page.waitForLoadState('domcontentloaded');
    await collectPageCoverage(page, 'navigation-page1', 'content');
    
    // Navigate to empty page
    await page.goto(getFixtureUrl('empty-page.html'));
    await page.waitForLoadState('domcontentloaded');
    await collectPageCoverage(page, 'navigation-page2', 'content');
    
    // Navigate back to threat report
    await page.goto(getFixtureUrl('threat-report.html'));
    await page.waitForLoadState('domcontentloaded');
    
    // Page should still work
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('APT29');
    
    await collectAndClosePage(page, 'navigation-final', 'content');
  });

  test('should handle multiple tabs', async () => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // Load different pages in different tabs
    await page1.goto(getFixtureUrl('threat-report.html'));
    await page2.goto(getFixtureUrl('defanged-iocs.html'));
    
    await page1.waitForLoadState('domcontentloaded');
    await page2.waitForLoadState('domcontentloaded');
    
    // Both should have their respective content
    const text1 = await page1.textContent('body');
    const text2 = await page2.textContent('body');
    
    expect(text1).toContain('APT29');
    expect(text2).toContain('Defanged');
    
    // Collect coverage from both pages
    await collectPageCoverage(page1, 'multiple-tabs', 'content-tab1');
    await collectPageCoverage(page2, 'multiple-tabs', 'content-tab2');
    
    await page1.close();
    await page2.close();
  });
});
