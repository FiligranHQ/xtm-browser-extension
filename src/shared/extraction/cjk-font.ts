/**
 * CJK Font loader for jsPDF
 *
 * Loads the bundled Noto Sans CJK font on demand and registers it with jsPDF
 * so that CJK characters (Japanese, Chinese, Korean) render correctly.
 * The font is only loaded when CJK characters are detected in the content.
 */

import { jsPDF } from 'jspdf';
import { loggers } from '../utils/logger';

const log = loggers.extraction;

const CJK_FONT_FILENAME = 'NotoSansCJK-Regular.ttf';
const CJK_FONT_FAMILY = 'NotoSansCJK';

// BMP ranges: CJK Symbols/Punctuation, Hiragana, Katakana, Bopomofo,
// CJK Extension A, CJK Unified Ideographs, Hangul Syllables/Jamo,
// CJK Compatibility Ideographs.
// Supplementary: CJK Extension B–F, CJK Compatibility Supplement.
const CJK_RE = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\u1100-\u11FF\u{20000}-\u{2FA1F}]/u;

/**
 * Check whether text contains CJK characters that require
 * the bundled font to render.
 */
export function needsCJKFont(text: string): boolean {
  return CJK_RE.test(text);
}

// Promise-based lock: held only while a fetch is in progress.
// Resets after resolve so the base64 string can be GC'd between PDF generations.
let fontLoadPromise: Promise<string | null> | null = null;

/**
 * Load the CJK font file from extension assets and return as base64.
 * Uses a promise lock to prevent duplicate concurrent fetches.
 * The result is NOT cached long-term to avoid holding ~25 MB in memory.
 */
function loadCJKFontBase64(): Promise<string | null> {
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      const fontUrl = chrome.runtime.getURL(`assets/fonts/${CJK_FONT_FILENAME}`);
      const response = await fetch(fontUrl);
      if (!response.ok) {
        log.warn('[CJKFont] Failed to fetch font:', response.status);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Chunk-based binary→string conversion.
      // Uses a pre-allocated array + join instead of spread to avoid
      // hitting engine-specific call-stack argument limits.
      const chunkSize = 8192;
      const chunks: string[] = [];
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, bytes.length);
        const charCodes = new Array<string>(end - i);
        for (let j = i; j < end; j++) {
          charCodes[j - i] = String.fromCharCode(bytes[j]);
        }
        chunks.push(charCodes.join(''));
      }
      const base64 = btoa(chunks.join(''));

      log.debug('[CJKFont] Font loaded, size:', bytes.length);
      return base64;
    } catch (error) {
      log.warn('[CJKFont] Error loading font:', error);
      return null;
    }
  })().finally(() => {
    // Release the lock so the resolved base64 string can be GC'd
    // once registerCJKFont is done with it.
    fontLoadPromise = null;
  });

  return fontLoadPromise;
}

/**
 * Register the CJK font with a jsPDF instance.
 * Loads the font, validates it, and registers for the 'normal' style.
 * Bold/italic calls will fall back to normal automatically in jsPDF.
 */
export async function registerCJKFont(pdf: jsPDF): Promise<boolean> {
  try {
    const fontBase64 = await loadCJKFontBase64();
    if (!fontBase64) return false;

    pdf.addFileToVFS(CJK_FONT_FILENAME, fontBase64);
    pdf.addFont(CJK_FONT_FILENAME, CJK_FONT_FAMILY, 'normal');

    // Verify the font is usable by attempting to set it
    pdf.setFont(CJK_FONT_FAMILY, 'normal');

    return true;
  } catch (error) {
    log.warn('[CJKFont] Failed to register font (file may be corrupt):', error);
    return false;
  }
}

/**
 * The font family name to use after registration.
 */
export { CJK_FONT_FAMILY };
