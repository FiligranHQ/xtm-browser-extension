/**
 * Unit Tests for Page Content Scanning
 *
 * Tests that the text extracted from the page for scanning keeps the indicators
 * the detection engine needs (regression guard for uppercase hashes being
 * stripped by the content filter before detection ran).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    content: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));
vi.mock('jspdf', () => ({ jsPDF: vi.fn() }));
vi.mock('../../src/shared/extraction/pdf-generator', () => ({ generatePDF: vi.fn() }));
vi.mock('../../src/shared/extraction/content-extractor', () => ({ extractContent: vi.fn() }));
vi.mock('../../src/shared/utils/sanitize', () => ({ setSanitizedHtml: vi.fn() }));

import { getPageContentForScanning } from '../../src/content/extraction';

// jsdom does not implement innerText, which getPageContentForScanning reads
function setPageText(text: string): void {
  Object.defineProperty(document.body, 'innerText', { value: text, configurable: true });
}

describe('getPageContentForScanning', () => {
  afterEach(() => {
    delete (document.body as { innerText?: string }).innerText;
  });

  it('should keep uppercase SHA-1 hashes', () => {
    const sha1 = '54547180A99474B0DBA289D92C4A8F3EEA78B531';
    setPageText(`SHA-1 Filename\n${sha1} 2Gk8.exe Win32/Loader.Lycaon.Y.gen`);

    expect(getPageContentForScanning()).toContain(sha1);
  });

  it('should keep lowercase SHA-1 hashes', () => {
    const sha1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
    setPageText(`hash: ${sha1}`);

    expect(getPageContentForScanning()).toContain(sha1);
  });

  it('should still strip URL-encoded fragments', () => {
    setPageText('before 2Fwww.w3.org after');

    expect(getPageContentForScanning()).not.toContain('2Fwww.w3.org');
  });
});
