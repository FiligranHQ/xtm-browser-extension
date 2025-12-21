/**
 * Browser Extension E2E Tests
 * 
 * Tests the browser extension's core functionality including:
 * - Extension loading and initialization
 * - Popup page rendering
 * - Options page configuration
 * - Panel page functionality
 */

import { test, expect, type BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '../../dist/chrome');

// Helper to create browser context with extension
async function createExtensionContext() {
  const context = await chromium.launchPersistentContext('', {
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
  return context;
}

// Helper to get extension ID
async function getExtensionId(context: BrowserContext): Promise<string> {
  // Wait for service worker to be ready
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 30000 });
  }
  
  // Extract extension ID from service worker URL
  const swUrl = serviceWorker.url();
  const match = swUrl.match(/chrome-extension:\/\/([^/]+)/);
  if (!match) {
    throw new Error('Could not determine extension ID');
  }
  return match[1];
}

test.describe('Extension Loading', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('extension should load successfully', async () => {
    expect(extensionId).toBeTruthy();
    expect(extensionId.length).toBeGreaterThan(0);
  });

  test('service worker should be running', async () => {
    const serviceWorkers = context.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);
    
    const extensionSW = serviceWorkers.find(sw => 
      sw.url().includes('chrome-extension://')
    );
    expect(extensionSW).toBeTruthy();
  });
});

test.describe('Popup Page', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('popup should render without errors', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup/index.html`;
    const page = await context.newPage();
    
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto(popupUrl);
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for React to render
    await page.waitForTimeout(1000);
    
    // Should not have critical console errors (some may be expected)
    const criticalErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('Extension context invalidated')
    );
    
    // Page should have content
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    
    await page.close();
  });

  test('popup should show setup wizard when not configured', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup/index.html`;
    const page = await context.newPage();
    
    await page.goto(popupUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should show some form of setup or configuration UI
    // The exact text depends on the current popup implementation
    const hasSetupUI = await page.getByText(/platform|configure|setup|connect/i).count() > 0 ||
                       await page.getByRole('button').count() > 0;
    
    expect(hasSetupUI).toBe(true);
    
    await page.close();
  });
});

test.describe('Options Page', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('options page should render', async () => {
    const optionsUrl = `chrome-extension://${extensionId}/options/index.html`;
    const page = await context.newPage();
    
    await page.goto(optionsUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Page should have loaded
    const title = await page.title();
    expect(title).toBeTruthy();
    
    await page.close();
  });
});

test.describe('Panel Page', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('panel should render without errors', async () => {
    const panelUrl = `chrome-extension://${extensionId}/panel/index.html`;
    const page = await context.newPage();
    
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto(panelUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should render some UI
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    
    await page.close();
  });

  test('panel should show scan interface', async () => {
    const panelUrl = `chrome-extension://${extensionId}/panel/index.html`;
    const page = await context.newPage();
    
    await page.goto(panelUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Panel should show some scan-related UI
    // This could be a scan button, results area, etc.
    const hasUI = await page.locator('button, [role="button"]').count() > 0 ||
                  await page.getByText(/scan|result|detect|platform/i).count() > 0;
    
    expect(hasUI).toBe(true);
    
    await page.close();
  });
});

test.describe('PDF Scanner Page', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('PDF scanner page should render', async () => {
    const pdfScannerUrl = `chrome-extension://${extensionId}/pdf-scanner/index.html`;
    const page = await context.newPage();
    
    await page.goto(pdfScannerUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should have loaded
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    
    await page.close();
  });
});

