/**
 * Tests for handleOpenPdfScanner in background/handlers/pdf-handlers.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleOpenPdfScanner } from '../../src/background/handlers/pdf-handlers';

vi.mock('../../src/shared/utils/logger', () => {
  const mockLogger = () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() });
  return { loggers: { background: mockLogger() }, createLogger: mockLogger };
});

const SCANNER_PAGE = 'chrome-extension://test-extension-id/pdf-scanner/index.html';

describe('handleOpenPdfScanner', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>;
  let createTab: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSendResponse = vi.fn();
    createTab = vi.fn().mockResolvedValue({ id: 7 });
    vi.stubGlobal('chrome', {
      runtime: { getURL: vi.fn().mockReturnValue(SCANNER_PAGE) },
      tabs: { create: createTab },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should refuse a non-string pdfUrl without throwing', async () => {
    await handleOpenPdfScanner({ pdfUrl: 123 }, mockSendResponse, {});

    expect(createTab).not.toHaveBeenCalled();
    expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'No PDF URL provided' });
  });

  it.each([
    ['https:', 'https://example.com/report.pdf'],
    ['file:', 'file:///Users/analyst/report.pdf'],
    ['blob:', 'blob:https://example.com/0b1c2d3e-0000-4000-8000-000000000000'],
  ])('should open the scanner for a %s URL', async (_label, pdfUrl) => {
    await handleOpenPdfScanner({ pdfUrl }, mockSendResponse, {});

    expect(createTab).toHaveBeenCalledWith({ url: `${SCANNER_PAGE}?url=${encodeURIComponent(pdfUrl)}` });
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: { tabId: 7 } });
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:application/pdf;base64,JVBERi0='],
    ['relative', '/report.pdf'],
  ])('should refuse a %s URL without opening a tab', async (_label, pdfUrl) => {
    await handleOpenPdfScanner({ pdfUrl }, mockSendResponse, {});

    expect(createTab).not.toHaveBeenCalled();
    expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'Unsupported PDF URL' });
  });
});
