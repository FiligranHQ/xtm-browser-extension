/**
 * Page Content Extraction for Scanning
 * Utilities for extracting comprehensive page content for entity detection.
 */

import { loggers } from '../shared/utils/logger';
import { getPageContentForScanning } from './extraction';

const log = loggers.content;

// ============================================================================
// Comprehensive Page Content
// ============================================================================

/**
 * Get comprehensive page content for scanning
 * Uses the robust extraction from extraction.ts
 */
export function getComprehensivePageContent(): string {
  const content = getPageContentForScanning();
  log.debug(' Page content extracted, length:', content.length);
  return content;
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

