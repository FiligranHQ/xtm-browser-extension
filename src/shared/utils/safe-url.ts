/**
 * Safe URL helpers: scheme allowlist (http/https, plus opt-in extras) for URLs
 * reaching navigation and fetch sinks. Relative URLs are refused, since they would
 * resolve against whichever context runs (extension origin or visited page).
 */

import { createLogger } from './logger';

const log = createLogger('SafeUrl');

const WEB_SCHEMES = ['http:', 'https:'];

/**
 * Return the parsed URL if absolute and its scheme allowed, else null.
 * @param extraSchemes additional schemes to allow, e.g. `file:` for local PDFs
 */
export function resolveSafeUrl(url: string, extraSchemes: string[] = []): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const allowed = WEB_SCHEMES.includes(parsed.protocol) || extraSchemes.includes(parsed.protocol);
    return allowed ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Whether a URL is safe to navigate to or fetch.
 */
export function isSafeUrl(url: string, extraSchemes: string[] = []): boolean {
  return resolveSafeUrl(url, extraSchemes) !== null;
}

/**
 * Open a URL in a new tab through the tabs API (the panel iframe can block popups).
 * Returns false, with a warning, when the URL is refused or the API is missing.
 */
export function openExternalUrl(url: string, extraSchemes: string[] = []): boolean {
  const safe = resolveSafeUrl(url, extraSchemes);
  if (!safe) {
    log.warn('Refused to open URL with an unsupported scheme:', String(url).slice(0, 40));
    return false;
  }
  if (typeof chrome === 'undefined' || !chrome.tabs?.create) {
    log.warn('Cannot open URL: chrome.tabs is unavailable in this context');
    return false;
  }
  chrome.tabs.create({ url: safe });
  return true;
}
