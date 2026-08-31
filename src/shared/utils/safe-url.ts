/**
 * Safe URL helpers
 *
 * Platform URLs, API responses and page URLs all reach navigation and fetch
 * sinks, so they are checked against a scheme allowlist first: `javascript:`
 * and `data:` would otherwise run in the extension's own origin, and the
 * background worker holds `<all_urls>` plus `file:///*`.
 *
 * URLs must be absolute. Every caller builds one from a configured platform URL
 * or reads one from a page, and resolving a relative path against whichever
 * context happens to be running would silently mean the extension's own origin
 * in a panel and the visited page's in a content script.
 */

const WEB_SCHEMES = ['http:', 'https:'];

/**
 * Resolve a URL, returning it only if its scheme is allowed.
 *
 * @param extraSchemes additional schemes to allow, e.g. `file:` for local PDFs
 * @returns the parsed URL, or null if it is relative, malformed or disallowed
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
 * Open a URL in a new tab, ignoring it if the scheme is not allowed.
 */
export function openExternalUrl(url: string, extraSchemes: string[] = []): boolean {
  const safe = resolveSafeUrl(url, extraSchemes);
  if (!safe) return false;
  window.open(safe, '_blank', 'noopener,noreferrer');
  return true;
}
