/**
 * E2E Coverage Utilities
 * 
 * Utilities for collecting Istanbul coverage data from Playwright tests.
 * Coverage is collected from window.__coverage__ which is populated by
 * the Istanbul-instrumented code.
 */

import { Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Coverage output directory
const COVERAGE_DIR = path.join(__dirname, '../../coverage/e2e');

// Ensure coverage directory exists
export function ensureCoverageDir(): void {
  if (!fs.existsSync(COVERAGE_DIR)) {
    fs.mkdirSync(COVERAGE_DIR, { recursive: true });
  }
}

/**
 * Collect coverage from a single page and save it
 */
export async function collectPageCoverage(
  page: Page, 
  testName: string,
  pageIdentifier: string = 'main'
): Promise<void> {
  try {
    // Get coverage from the page's window object
    const coverage = await page.evaluate(() => {
      // @ts-ignore - __coverage__ is injected by Istanbul
      return window.__coverage__ || null;
    });

    if (coverage) {
      ensureCoverageDir();
      const sanitizedTestName = testName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const sanitizedPageId = pageIdentifier.replace(/[^a-zA-Z0-9-_]/g, '_');
      const timestamp = Date.now();
      const filename = `coverage-${sanitizedTestName}-${sanitizedPageId}-${timestamp}.json`;
      const filepath = path.join(COVERAGE_DIR, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(coverage, null, 2));
      console.log(`✓ Coverage collected for ${testName} (${pageIdentifier})`);
    } else {
      console.log(`⚠ No coverage data found for ${testName} (${pageIdentifier})`);
    }
  } catch (error) {
    console.log(`⚠ Failed to collect coverage for ${testName}: ${error}`);
  }
}

/**
 * Collect coverage from all pages in a context
 */
export async function collectContextCoverage(
  context: BrowserContext,
  testName: string
): Promise<void> {
  const pages = context.pages();
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageUrl = page.url();
    
    // Identify the page type by URL
    let pageIdentifier = `page-${i}`;
    if (pageUrl.includes('popup')) {
      pageIdentifier = 'popup';
    } else if (pageUrl.includes('options')) {
      pageIdentifier = 'options';
    } else if (pageUrl.includes('panel')) {
      pageIdentifier = 'panel';
    } else if (pageUrl.includes('pdf-scanner')) {
      pageIdentifier = 'pdf-scanner';
    } else if (pageUrl.startsWith('chrome-extension://')) {
      pageIdentifier = `extension-${i}`;
    }
    
    await collectPageCoverage(page, testName, pageIdentifier);
  }
}

/**
 * Collect coverage from the background service worker
 * Note: This requires accessing the service worker context which is more complex
 */
export async function collectBackgroundCoverage(
  context: BrowserContext,
  testName: string,
  extensionId: string
): Promise<void> {
  try {
    // Try to get the background service worker
    const serviceWorker = context.serviceWorkers().find(sw => 
      sw.url().includes(extensionId)
    );
    
    if (serviceWorker) {
      const coverage = await serviceWorker.evaluate(() => {
        // @ts-ignore - __coverage__ is injected by Istanbul
        return (globalThis as any).__coverage__ || null;
      });

      if (coverage) {
        ensureCoverageDir();
        const sanitizedTestName = testName.replace(/[^a-zA-Z0-9-_]/g, '_');
        const timestamp = Date.now();
        const filename = `coverage-${sanitizedTestName}-background-${timestamp}.json`;
        const filepath = path.join(COVERAGE_DIR, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(coverage, null, 2));
        console.log(`✓ Background coverage collected for ${testName}`);
      }
    }
  } catch (error) {
    console.log(`⚠ Failed to collect background coverage: ${error}`);
  }
}

/**
 * Create a test fixture that automatically collects coverage after each test
 */
export function createCoverageCollector() {
  return {
    async afterEach(
      context: BrowserContext,
      testInfo: { title: string; project: { name: string } }
    ): Promise<void> {
      const testName = `${testInfo.project.name}-${testInfo.title}`;
      await collectContextCoverage(context, testName);
    },
  };
}

