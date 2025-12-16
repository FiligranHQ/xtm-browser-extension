/**
 * Page Content Extraction for Scanning
 * Utilities for extracting comprehensive page content for entity detection.
 */

import { loggers } from '../shared/utils/logger';
import { extractTextFromShadowDOM, getCleanVisibleText } from './extraction';

const log = loggers.content;

// ============================================================================
// Boilerplate Domain Filtering
// ============================================================================

/**
 * Common boilerplate domains to exclude from scanning
 * (CSS frameworks, CDNs, analytics, etc.)
 */
const BOILERPLATE_DOMAIN_PATTERNS = [
  // CSS frameworks and UI libraries
  /tailwindcss\.com/i,
  /bootstrap(cdn)?\.com/i,
  /fontawesome\.com/i,
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
  /cdnjs\.cloudflare\.com/i,
  /unpkg\.com/i,
  /jsdelivr\.net/i,
  /rawgit\.com/i,
  // Analytics and tracking
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /analytics\.google\.com/i,
  /facebook\.net/i,
  /connect\.facebook\.net/i,
  /twitter\.com\/widgets/i,
  /platform\.twitter\.com/i,
  /linkedin\.com\/embed/i,
  // CDNs and hosting
  /cloudflare\.com/i,
  /fastly\.net/i,
  /akamaihd\.net/i,
  /amazonaws\.com/i,
  /azureedge\.net/i,
  /cloudfront\.net/i,
  // Common website infrastructure
  /jquery\.com/i,
  /reactjs\.org/i,
  /vuejs\.org/i,
  /angular\.io/i,
  /w3\.org/i,
  /schema\.org/i,
  /gravatar\.com/i,
  /wordpress\.com/i,
  /wp\.com/i,
  // Social media embeds
  /instagram\.com\/embed/i,
  /youtube\.com\/embed/i,
  /vimeo\.com\/video/i,
  /player\.vimeo\.com/i,
  // Ad networks
  /doubleclick\.net/i,
  /googlesyndication\.com/i,
  /googleadservices\.com/i,
  /amazon-adsystem\.com/i,
  // Other common infrastructure
  /gstatic\.com/i,
  /googleapis\.com/i,
  /recaptcha\.net/i,
  /hcaptcha\.com/i,
  /sentry\.io/i,
  /bugsnag\.com/i,
  /hotjar\.com/i,
  /intercom\.io/i,
  /crisp\.chat/i,
  /zendesk\.com/i,
  /typekit\.net/i,
  /use\.typekit\.net/i,
];

/**
 * Check if a domain is a boilerplate/infrastructure domain
 */
export function isBoilerplateDomain(domain: string): boolean {
  return BOILERPLATE_DOMAIN_PATTERNS.some(pattern => pattern.test(domain));
}

/**
 * Filter out boilerplate domains from text content
 */
export function filterBoilerplateFromContent(content: string): string {
  let filtered = content;
  
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  filtered = filtered.replace(urlPattern, (match) => {
    try {
      const url = new URL(match);
      if (isBoilerplateDomain(url.hostname)) {
        return '';
      }
    } catch { /* Not a valid URL, keep it */ }
    return match;
  });
  
  return filtered;
}

// ============================================================================
// IOC Detection Helpers
// ============================================================================

/**
 * Check if a value looks like a genuine IOC (hash, IP, CVE, etc.)
 */
export function looksLikeIOC(value: string): boolean {
  const trimmed = value.trim();
  
  // Hashes (MD5, SHA1, SHA256, SHA512)
  if (/^[a-fA-F0-9]{32}$/.test(trimmed)) return true;  // MD5
  if (/^[a-fA-F0-9]{40}$/.test(trimmed)) return true;  // SHA1
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return true;  // SHA256
  if (/^[a-fA-F0-9]{128}$/.test(trimmed)) return true; // SHA512
  
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) return true;
  
  // CVE
  if (/^CVE-\d{4}-\d+$/i.test(trimmed)) return true;
  
  // Skip generic URLs
  if (/^https?:\/\//i.test(trimmed)) return false;
  
  // Skip short generic strings
  if (trimmed.length < 5) return false;
  
  return false;
}

// ============================================================================
// Data Attribute Extraction
// ============================================================================

/**
 * Extract IOC-like values from data attributes and specific elements
 * Useful for SPAs where data is in attributes rather than text content
 */
export function extractDataAttributeContent(): string {
  const values: string[] = [];
  
  const dataAttributePatterns = [
    'data-hash', 'data-sha256', 'data-sha1', 'data-md5',
    'data-ip', 'data-ioc', 'data-indicator',
    'data-file-hash', 'data-malware', 'data-threat',
  ];
  
  const iocSelectors = [
    '[class*="hash"]', '[class*="sha256"]', '[class*="sha1"]', '[class*="md5"]',
    '[class*="ip-address"]', '[class*="indicator"]',
    '[class*="ioc"]', '[class*="detection"]', '[class*="malware"]',
    '[id*="hash"]', '[id*="indicator"]',
    '[class*="file-id"]', '[class*="vt-ui"]',
  ];
  
  // Extract from data attributes
  document.querySelectorAll('*').forEach(el => {
    const htmlEl = el as HTMLElement;
    
    dataAttributePatterns.forEach(attr => {
      const value = htmlEl.getAttribute(attr);
      if (value && value.length > 5) {
        if (looksLikeIOC(value)) {
          values.push(value);
        }
      }
    });
    
    // Get all data-* attributes but only if they look like IOCs
    Array.from(htmlEl.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') && attr.value.length >= 32) {
        const val = attr.value;
        if (/^[a-fA-F0-9]{32}$/.test(val) ||  // MD5
            /^[a-fA-F0-9]{40}$/.test(val) ||  // SHA1
            /^[a-fA-F0-9]{64}$/.test(val) ||  // SHA256
            /^[a-fA-F0-9]{128}$/.test(val)) { // SHA512
          values.push(val);
        }
      }
    });
  });
  
  // Extract from elements with IOC-related classes
  iocSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        const text = (el as HTMLElement).innerText || el.textContent || '';
        const trimmed = text.trim();
        if (trimmed.length > 0 && trimmed.length < 500 && !trimmed.startsWith('http')) {
          if (!isBoilerplateDomain(trimmed)) {
            values.push(trimmed);
          }
        }
      });
    } catch { /* Skip invalid selectors */ }
  });
  
  // Get content from code and pre elements (common for hashes)
  document.querySelectorAll('code, pre, .hash, .sha256, .sha1, .md5, .file-hash').forEach(el => {
    const text = el.textContent?.trim() || '';
    if (text.length > 5 && text.length < 200) {
      values.push(text);
    }
  });
  
  // Get content from title attributes and aria-labels
  document.querySelectorAll('[title], [aria-label]').forEach(el => {
    const title = el.getAttribute('title') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    if (title.length > 10) values.push(title);
    if (ariaLabel.length > 10) values.push(ariaLabel);
  });
  
  return values.join('\n');
}

// ============================================================================
// Comprehensive Page Content
// ============================================================================

/**
 * Get comprehensive page content for scanning
 * Combines multiple sources to handle SPAs and dynamic content
 */
export function getComprehensivePageContent(): string {
  const contentParts: string[] = [];
  
  // 1. Get clean visible text content
  const cleanText = getCleanVisibleText();
  if (cleanText) {
    contentParts.push(cleanText);
  }
  
  // 2. Shadow DOM content (for Web Components like VirusTotal)
  try {
    const shadowText = extractTextFromShadowDOM(document);
    if (shadowText.trim()) {
      contentParts.push(shadowText);
    }
  } catch (e) {
    log.debug(' Shadow DOM extraction failed:', e);
  }
  
  // 3. Data attributes that specifically look like IOCs
  try {
    const dataContent = extractDataAttributeContent();
    if (dataContent.trim()) {
      contentParts.push(dataContent);
    }
  } catch (e) {
    log.debug(' Data attribute extraction failed:', e);
  }
  
  // 4. URL path and query parameters (often contain hashes on VirusTotal, etc.)
  try {
    const url = new URL(window.location.href);
    // Add path segments that look like IOCs
    url.pathname.split('/').forEach(segment => {
      if (segment.length >= 32 && /^[a-fA-F0-9]+$/.test(segment)) {
        contentParts.push(segment);
      }
    });
    // Add query parameters that look like IOCs
    url.searchParams.forEach((value, key) => {
      if (value.length >= 32 && /^[a-fA-F0-9]+$/.test(value)) {
        contentParts.push(`${key}: ${value}`);
      }
    });
  } catch { /* Skip URL parsing errors */ }
  
  // Combine, filter boilerplate, and return
  const combined = contentParts.join('\n\n');
  return filterBoilerplateFromContent(combined);
}

/**
 * Detect domains and hostnames for atomic testing
 */
export function detectDomainsAndHostnamesForAtomicTesting(content: string): Array<{ type: string; value: string }> {
  const results: Array<{ type: string; value: string }> = [];
  const seen = new Set<string>();
  
  const domainPattern = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|org|net|io|co|gov|edu|mil|int|info|biz|name|pro|aero|museum|xyz|online|site|tech|dev|app|cloud|ai|sh|me|cc|tv|ws|fm|am|to|li|ms|la|gg|im|pw|so|sx|tk|ml|ga|cf|gq|ru|cn|uk|de|fr|jp|kr|br|in|au|nl|it|es|se|no|fi|dk|pl|cz|at|ch|be|pt|hu|ro|bg|sk|si|hr|rs|ua|tr|il|ae|sa|za|ng|ke|eg|ma|tn|dz|ly|jo|kw|qa|om|bh|lb|sy|iq|ir|pk|bd|vn|th|my|sg|ph|id|tw|hk|mo|eu|ca|mx|ar|cl|pe|ve|ec|uy|py|bo|cr|pa|gt|hn|sv|ni|cu|do|pr|nz|ph|ie|gr|cz|is|lu|mc|ee|lv|lt|mt|cy)\b/gi;
  
  let match;
  while ((match = domainPattern.exec(content)) !== null) {
    const value = match[0].toLowerCase();
    if (!seen.has(value) && value.length >= 4 && !value.startsWith('.')) {
      seen.add(value);
      const parts = value.split('.');
      const type = parts.length > 2 ? 'Hostname' : 'Domain-Name';
      results.push({ type, value });
    }
  }
  
  return results;
}

/**
 * Generate a clean description from page content
 */
export function generateCleanDescription(content: string, maxLength = 500): string {
  let description = content.substring(0, maxLength * 2);
  
  description = description.replace(/\s+/g, ' ').trim();
  
  if (description.length > maxLength) {
    description = description.substring(0, maxLength);
    const lastPeriod = description.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.7) {
      description = description.substring(0, lastPeriod + 1);
    } else {
      description += '...';
    }
  }
  
  return description;
}

