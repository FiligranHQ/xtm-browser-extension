/**
 * Build target, read from BROWSER and interpolated into manifest and dist paths.
 * BROWSER is also an ambient variable (dev-server browser, e.g. `wslview`), so the
 * allowlist is only enforced when building.
 */

const SUPPORTED_BROWSERS = ['chrome', 'firefox', 'edge'];

export const browser = process.env.BROWSER || 'chrome';

export function assertBuildBrowser(): void {
  if (!SUPPORTED_BROWSERS.includes(browser)) {
    throw new Error(`Unknown BROWSER "${browser}". Expected one of: ${SUPPORTED_BROWSERS.join(', ')}`);
  }
}
