/**
 * Playwright E2E Test Helpers for Browser Extension Testing
 * 
 * Provides utilities for interacting with the browser extension.
 */

import { type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the extension ID from a Chrome context
 * Note: Extension IDs are generated based on the extension's public key
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  // Get all pages including extension pages
  let extensionId = '';
  
  // Wait for the service worker to be ready
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  
  // Extract extension ID from the service worker URL
  // Format: chrome-extension://<extension-id>/...
  const swUrl = serviceWorker.url();
  const match = swUrl.match(/chrome-extension:\/\/([^/]+)/);
  if (match) {
    extensionId = match[1];
  }
  
  return extensionId;
}

/**
 * Wait for extension service worker to be ready
 */
export async function waitForExtension(context: BrowserContext): Promise<void> {
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  // Give it a moment to initialize
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Open the extension popup in a new page
 */
export async function openExtensionPopup(
  context: BrowserContext, 
  extensionId: string
): Promise<Page> {
  const popupUrl = `chrome-extension://${extensionId}/popup/index.html`;
  const page = await context.newPage();
  await page.goto(popupUrl);
  return page;
}

/**
 * Open the extension options page
 */
export async function openExtensionOptions(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const optionsUrl = `chrome-extension://${extensionId}/options/index.html`;
  const page = await context.newPage();
  await page.goto(optionsUrl);
  return page;
}

/**
 * Open the extension panel (side panel HTML)
 */
export async function openExtensionPanel(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const panelUrl = `chrome-extension://${extensionId}/panel/index.html`;
  const page = await context.newPage();
  await page.goto(panelUrl);
  return page;
}

/**
 * Navigate to a test fixture page
 */
export async function navigateToTestPage(
  page: Page,
  fixtureName: string
): Promise<void> {
  await page.goto(`http://localhost:3000/${fixtureName}`);
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for the extension to inject content script
 */
export async function waitForContentScript(page: Page): Promise<void> {
  // Wait for the extension's content script marker
  await page.waitForFunction(() => {
    return (window as unknown as { __xtmExtensionInjected?: boolean }).__xtmExtensionInjected === true;
  }, { timeout: 10000 }).catch(() => {
    // Content script may not set this marker, continue anyway
  });
  
  // Give content script time to initialize
  await page.waitForTimeout(500);
}

/**
 * Check if extension highlighting is present on page
 */
export async function hasHighlights(page: Page): Promise<boolean> {
  const highlights = await page.locator('[data-xtm-highlight]').count();
  return highlights > 0;
}

/**
 * Count highlights on page
 */
export async function countHighlights(page: Page): Promise<number> {
  return page.locator('[data-xtm-highlight]').count();
}

/**
 * Get all highlighted text values
 */
export async function getHighlightedValues(page: Page): Promise<string[]> {
  const highlights = page.locator('[data-xtm-highlight]');
  const count = await highlights.count();
  const values: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const text = await highlights.nth(i).textContent();
    if (text) {
      values.push(text.trim());
    }
  }
  
  return values;
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, text?: string): Promise<void> {
  const toastLocator = text 
    ? page.locator(`[role="alert"]:has-text("${text}")`)
    : page.locator('[role="alert"]');
  
  await toastLocator.waitFor({ timeout: 5000 });
}

/**
 * Configure extension settings via the popup
 */
export async function configureExtensionSettings(
  popupPage: Page,
  settings: {
    openctiUrl?: string;
    openctiToken?: string;
    openaevUrl?: string;
    openaevToken?: string;
  }
): Promise<void> {
  // This would need to interact with the actual popup UI
  // Implementation depends on the popup structure
  if (settings.openctiUrl) {
    await popupPage.fill('[data-testid="opencti-url"]', settings.openctiUrl);
  }
  if (settings.openctiToken) {
    await popupPage.fill('[data-testid="opencti-token"]', settings.openctiToken);
  }
  // ... similar for other settings
}

/**
 * Trigger scan on current page (via extension)
 */
export async function triggerScan(page: Page, context: BrowserContext): Promise<void> {
  // Send message to trigger scan
  // This could be done via keyboard shortcut or clicking extension icon
  await page.keyboard.press('Alt+Shift+S'); // Example shortcut
}

/**
 * Get extension path for loading
 */
export function getExtensionPath(): string {
  return path.join(__dirname, '../../dist/chrome');
}

