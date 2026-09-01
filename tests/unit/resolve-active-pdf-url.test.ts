/**
 * Unit Tests for resolveActivePdfUrl
 *
 * The PDF to attach must come from chrome.tabs rather than the panel's
 * postMessage-supplied state, so a page cannot choose what the extension
 * fetches with its <all_urls> permission (see issue #208).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveActivePdfUrl } from '../../src/panel/hooks/useContainerActions';

const SCANNER = 'chrome-extension://mock-id/pdf-scanner/index.html';

function activeTab(url: string | undefined): void {
  (globalThis as any).chrome.tabs.query = vi.fn().mockResolvedValue(url === undefined ? [{}] : [{ url }]);
}

describe('resolveActivePdfUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return a web PDF URL from the active tab', async () => {
    activeTab('https://example.com/report.pdf');
    await expect(resolveActivePdfUrl()).resolves.toBe('https://example.com/report.pdf');
  });

  it('should return a local PDF URL from the active tab', async () => {
    activeTab('file:///tmp/report.pdf');
    await expect(resolveActivePdfUrl()).resolves.toBe('file:///tmp/report.pdf');
  });

  it('should unwrap the scanner page url param', async () => {
    activeTab(`${SCANNER}?url=${encodeURIComponent('https://example.com/report.pdf')}`);
    await expect(resolveActivePdfUrl()).resolves.toBe('https://example.com/report.pdf');
  });

  it('should reject a disallowed scheme in the scanner url param', async () => {
    activeTab(`${SCANNER}?url=${encodeURIComponent('javascript:alert(1)')}`);
    await expect(resolveActivePdfUrl()).resolves.toBeNull();
  });

  it('should return null when the scanner page has no url param', async () => {
    activeTab(SCANNER);
    await expect(resolveActivePdfUrl()).resolves.toBeNull();
  });

  it('should return null when there is no active tab URL', async () => {
    activeTab(undefined);
    await expect(resolveActivePdfUrl()).resolves.toBeNull();
  });

  it('should reject a non-fetchable tab scheme', async () => {
    activeTab('about:blank');
    await expect(resolveActivePdfUrl()).resolves.toBeNull();
  });
});
