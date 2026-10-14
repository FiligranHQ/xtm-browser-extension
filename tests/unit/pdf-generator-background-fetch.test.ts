/**
 * Tests for fetchImageViaBackground in shared/extraction/pdf-generator.ts
 *
 * Runs the real FETCH_IMAGE_AS_DATA_URL handler behind a mocked sendMessage, so
 * the response shape the handler sends is the one the PDF generator reads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchImageViaBackground } from '../../src/shared/extraction/pdf-generator';
import { handleFetchImageAsDataURL } from '../../src/background/handlers/misc-handlers';

vi.mock('../../src/shared/extraction/native-pdf', () => ({
  generateNativePDF: vi.fn(),
  isNativePDFAvailable: vi.fn().mockReturnValue(false),
}));

describe('fetchImageViaBackground', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        lastError: undefined,
        sendMessage: vi.fn((message: { payload: unknown }, callback: (response: unknown) => void) => {
          void handleFetchImageAsDataURL(message.payload, callback, {} as never);
        }),
      },
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return an inline data:image URL through the background handler', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

    await expect(fetchImageViaBackground(dataUrl)).resolves.toBe(dataUrl);
  });

  it('should return null when the background handler refuses the URL', async () => {
    await expect(fetchImageViaBackground('file:///etc/passwd')).resolves.toBeNull();
  });
});
