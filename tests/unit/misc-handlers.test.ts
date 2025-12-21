/**
 * Tests for background/handlers/misc-handlers.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  tryOpenSidePanel,
  getSidePanelTarget,
  handleInjectContentScript,
  handleInjectAllTabs,
  handleGetPanelState,
  handleFetchImageAsDataURL,
  type SidePanelOpenResult,
} from '../../src/background/handlers/misc-handlers';

// Mock chrome APIs
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    background: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock('../../src/shared/extraction/native-pdf', () => ({
  generateNativePDF: vi.fn(),
  isNativePDFAvailable: vi.fn().mockReturnValue(false),
}));

describe('tryOpenSidePanel', () => {
  beforeEach(() => {
    // Reset chrome mock
    globalThis.chrome = {
      sidePanel: {
        open: vi.fn().mockResolvedValue(undefined),
      },
      tabs: {
        get: vi.fn().mockResolvedValue({ id: 1, windowId: 1 }),
      },
    } as unknown as typeof chrome;
  });

  it('should return opened: false when no tabId or windowId', async () => {
    const result = await tryOpenSidePanel(undefined, undefined);
    expect(result.opened).toBe(false);
  });

  it('should try tabId first and succeed', async () => {
    const result = await tryOpenSidePanel(1, 1);
    
    expect(result.opened).toBe(true);
    expect(result.method).toBe('tabId');
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 1 });
  });

  it('should try windowId if tabId fails', async () => {
    (chrome.sidePanel.open as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('tabId failed'))
      .mockResolvedValueOnce(undefined);

    const result = await tryOpenSidePanel(1, 2);
    
    expect(result.opened).toBe(true);
    expect(result.method).toBe('windowId');
  });

  it('should try fresh windowId as last resort', async () => {
    (chrome.sidePanel.open as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('tabId failed'))
      .mockRejectedValueOnce(new Error('windowId failed'))
      .mockResolvedValueOnce(undefined);

    const result = await tryOpenSidePanel(1, 2);
    
    expect(result.opened).toBe(true);
    expect(result.method).toBe('freshWindowId');
    expect(chrome.tabs.get).toHaveBeenCalledWith(1);
  });

  it('should return lastError when all strategies fail', async () => {
    (chrome.sidePanel.open as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('failed'));
    (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, windowId: undefined });

    const result = await tryOpenSidePanel(1, 2);
    
    expect(result.opened).toBe(false);
    expect(result.lastError).toBeDefined();
  });
});

describe('getSidePanelTarget', () => {
  beforeEach(() => {
    globalThis.chrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 5, windowId: 10 }]),
      },
    } as unknown as typeof chrome;
  });

  it('should return sender tab info when provided', async () => {
    const result = await getSidePanelTarget({ id: 1, windowId: 2 });
    
    expect(result.tabId).toBe(1);
    expect(result.windowId).toBe(2);
  });

  it('should query active tab when no sender', async () => {
    const result = await getSidePanelTarget(undefined);
    
    expect(result.tabId).toBe(5);
    expect(result.windowId).toBe(10);
    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
  });

  it('should query active tab when sender has no id', async () => {
    const result = await getSidePanelTarget({});
    
    expect(result.tabId).toBe(5);
    expect(result.windowId).toBe(10);
  });
});

describe('handleInjectContentScript', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSendResponse = vi.fn();
    globalThis.chrome = {
      tabs: {
        get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue(undefined),
        insertCSS: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as typeof chrome;
  });

  it('should return error when no tabId provided', async () => {
    await handleInjectContentScript({}, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'No tabId provided',
      })
    );
  });

  it('should return error for chrome:// URLs', async () => {
    (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      url: 'chrome://extensions',
    });

    await handleInjectContentScript({ tabId: 1 }, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Cannot inject into this page',
      })
    );
  });

  it('should return error for chrome-extension:// URLs', async () => {
    (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      url: 'chrome-extension://abc123/popup.html',
    });

    await handleInjectContentScript({ tabId: 1 }, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Cannot inject into this page',
      })
    );
  });

  it('should inject successfully into normal URLs', async () => {
    await handleInjectContentScript({ tabId: 1 }, mockSendResponse);
    
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      files: ['content/index.js'],
    });
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { injected: true },
      })
    );
  });

  it('should continue even if CSS injection fails', async () => {
    (chrome.scripting.insertCSS as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('CSS failed'));

    await handleInjectContentScript({ tabId: 1 }, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });

  it('should handle injection errors', async () => {
    (chrome.scripting.executeScript as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Injection failed'));

    await handleInjectContentScript({ tabId: 1 }, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Injection failed',
      })
    );
  });
});

describe('handleInjectAllTabs', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSendResponse = vi.fn();
    globalThis.chrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, url: 'https://example.com' },
          { id: 2, url: 'https://test.com' },
          { id: 3, url: 'chrome://extensions' },
        ]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as typeof chrome;
  });

  it('should inject into valid tabs and skip chrome:// URLs', async () => {
    await handleInjectAllTabs({}, mockSendResponse);
    
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { injectedCount: 2 },
      })
    );
  });

  it('should handle errors gracefully', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Query failed'));

    await handleInjectAllTabs({}, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Query failed',
      })
    );
  });

  it('should skip tabs without id or url', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, url: 'https://example.com' },
      { url: 'https://no-id.com' },
      { id: 2 },
    ]);

    await handleInjectAllTabs({}, mockSendResponse);
    
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { injectedCount: 1 },
      })
    );
  });
});

describe('handleGetPanelState', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSendResponse = vi.fn();
  });

  it('should return ready: true', async () => {
    await handleGetPanelState({}, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { ready: true },
      })
    );
  });
});

describe('handleFetchImageAsDataURL', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSendResponse = vi.fn();
    // Mock fetch
    globalThis.fetch = vi.fn();
  });

  it('should return error when no URL provided', async () => {
    await handleFetchImageAsDataURL({}, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'No URL provided',
      })
    );
  });

  it('should return error on fetch failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await handleFetchImageAsDataURL({ url: 'https://example.com/image.png' }, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'HTTP 404',
      })
    );
  });

  // Note: This test requires jsdom environment for FileReader API
  // FileReader.readAsDataURL is complex to mock in Node.js without DOM
  it.skip('should successfully convert image to data URL', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    await handleFetchImageAsDataURL({ url: 'https://example.com/image.png' }, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          dataUrl: expect.stringMatching(/^data:/),
        }),
      })
    );
  });

  it('should handle fetch exceptions', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    await handleFetchImageAsDataURL({ url: 'https://example.com/image.png' }, mockSendResponse);
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Network error',
      })
    );
  });
});

