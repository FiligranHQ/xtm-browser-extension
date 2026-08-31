/**
 * Safe URL helpers
 *
 * Platform URLs and page URLs are user- or page-supplied, so anything that ends
 * up in a navigation sink (`window.open`, `chrome.tabs.create`, `fetch`) is
 * checked against a scheme allowlist first: `javascript:` and `data:` links
 * would otherwise run in the extension's own origin.
 */

const WEB_SCHEMES = ['http:', 'https:'];

/**
 * Whether a URL is safe to navigate to or fetch.
 *
 * @param extraSchemes additional schemes to allow, e.g. `file:` for local PDFs
 */
export function isSafeUrl(url: string, extraSchemes: string[] = []): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url, window.location.href);
    return WEB_SCHEMES.includes(protocol) || extraSchemes.includes(protocol);
  } catch {
    return false;
  }
}

/**
 * Open a URL in a new tab, ignoring it if the scheme is not allowed.
 */
export function openExternalUrl(url: string, extraSchemes: string[] = []): boolean {
  if (!isSafeUrl(url, extraSchemes)) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
