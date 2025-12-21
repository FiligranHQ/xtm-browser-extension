/**
 * Common matching utilities for entity detection
 * 
 * Shared helper functions to reduce code duplication between
 * SDO detection and platform entity detection.
 */

/**
 * Check if a character is a valid word boundary
 * Returns true for undefined/null, empty string, whitespace, or sentence punctuation
 * 
 * IMPORTANT: Does NOT include '.', '-', '_', '[', ']' as boundaries because:
 * - '.', '-', '_' appear in identifiers (domains, hostnames)
 * - '[', ']' are used for defanging URLs (e.g., dl[.]software-update.org)
 * e.g., "Software" should NOT match in "dl[.]software-update.org"
 */
export function isValidBoundary(char: string | undefined | null): boolean {
  if (!char) return true; // undefined, null, or empty string
  // Only whitespace and sentence-ending punctuation are valid boundaries
  // NOT: . - _ [ ] (these appear in identifiers/domains or defanged URLs)
  return /[\s,;:!?()"'<>/\\@#$%^&*+=|`~\n\r\t{}]/.test(char);
}

/**
 * Check if a match at given position has valid word boundaries
 * Useful for names with special characters that can't use \b regex
 * 
 * A valid boundary is whitespace, sentence punctuation, or start/end of text.
 * Characters like '.', '-', '_' are NOT valid boundaries (they appear in identifiers).
 */
export function hasValidBoundaries(
  text: string,
  startIndex: number,
  endIndex: number
): boolean {
  const charBefore = startIndex > 0 ? text[startIndex - 1] : undefined;
  const charAfter = endIndex < text.length ? text[endIndex] : undefined;
  
  // Check if charBefore is a valid boundary
  // Must be: undefined (start of text), whitespace, or sentence punctuation
  // NOT valid: alphanumeric, '.', '-', '_' (these indicate the match is inside an identifier)
  if (!isValidBoundary(charBefore)) {
    return false;
  }
  
  // Check if charAfter is a valid boundary
  if (!isValidBoundary(charAfter)) {
    return false;
  }
  
  return true;
}

/**
 * Check if a range overlaps with any existing range in the set
 */
export function hasOverlappingRange(
  startIndex: number,
  endIndex: number,
  seenRanges: Set<string>
): boolean {
  for (const existingRange of seenRanges) {
    const [existStart, existEnd] = existingRange.split('-').map(Number);
    // Check for overlap: ranges overlap if they are not completely separate
    if (!(endIndex <= existStart || startIndex >= existEnd)) {
      return true;
    }
  }
  return false;
}

/**
 * Create a range key for tracking seen ranges
 */
export function createRangeKey(startIndex: number, endIndex: number): string {
  return `${startIndex}-${endIndex}`;
}

/**
 * Check if a name looks like a MITRE ATT&CK ID (T1059, T1059.001, TA0001, etc.)
 */
export function isMitreId(name: string): boolean {
  return /^t[as]?\d{4}(\.\d{3})?$/i.test(name);
}

/**
 * Check if a name is a parent MITRE technique (without sub-technique)
 */
export function isParentMitreId(name: string): boolean {
  return /^t[as]?\d{4}$/i.test(name);
}

/**
 * Check if a value looks like an IP address
 */
export function isIpAddress(value: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value);
}

/**
 * Check if a value looks like a MAC address
 */
export function isMacAddress(value: string): boolean {
  return /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value);
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create an appropriate regex pattern for entity name matching
 * Returns a regex configured for the type of name (MITRE ID, special chars, normal)
 */
export function createMatchingRegex(nameLower: string): RegExp {
  const escapedName = escapeRegex(nameLower);
  const hasSpecialChars = /[.\-_@]/.test(nameLower);
  const mitreId = isMitreId(nameLower);
  const ipAddr = isIpAddress(nameLower);
  const macAddr = isMacAddress(nameLower);
  
  if (ipAddr || macAddr) {
    // IP and MAC addresses: use lookahead/lookbehind for proper boundaries
    return new RegExp(`(?<![\\w.])${escapedName}(?![\\w.])`, 'gi');
  } else if (mitreId) {
    // MITRE IDs: require exact word boundaries
    return new RegExp(`\\b${escapedName}\\b`, 'gi');
  } else if (hasSpecialChars) {
    // Names with special characters: simple match, verify boundaries later
    return new RegExp(escapedName, 'gi');
  } else {
    // Normal names: use word boundaries for exact word match
    return new RegExp(`\\b${escapedName}\\b`, 'gi');
  }
}

/**
 * Determine if manual boundary validation is needed for a name
 * 
 * ALWAYS returns true for entity names because the \b regex boundary
 * treats '.', '-', '_' as boundaries, which causes false positives like
 * "Software" matching in "dl.software-update.org" or "Linux" in "test-linux-01"
 * 
 * Exceptions: IP addresses, MAC addresses, and MITRE IDs have their own
 * specialized regex patterns that handle boundaries correctly.
 */
export function needsManualBoundaryCheck(nameLower: string): boolean {
  // Always validate boundaries manually except for special patterns
  // that have their own boundary handling
  return !isIpAddress(nameLower) && !isMacAddress(nameLower) && !isMitreId(nameLower);
}

