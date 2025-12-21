/**
 * Unit Tests for Matching Module
 * 
 * Tests matching utilities for entity detection.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidBoundary,
  hasValidBoundaries,
  hasOverlappingRange,
  createRangeKey,
  isMitreId,
  isParentMitreId,
  isIpAddress,
  isMacAddress,
  escapeRegex,
  createMatchingRegex,
  needsManualBoundaryCheck,
} from '../../src/shared/detection/matching';

// ============================================================================
// isValidBoundary Tests
// ============================================================================

describe('isValidBoundary', () => {
  it('should return true for undefined', () => {
    expect(isValidBoundary(undefined)).toBe(true);
  });

  it('should return true for null', () => {
    expect(isValidBoundary(null)).toBe(true);
  });

  it('should return true for empty string', () => {
    expect(isValidBoundary('')).toBe(true);
  });

  it('should return true for whitespace characters', () => {
    expect(isValidBoundary(' ')).toBe(true);
    expect(isValidBoundary('\t')).toBe(true);
    expect(isValidBoundary('\n')).toBe(true);
    expect(isValidBoundary('\r')).toBe(true);
  });

  it('should return true for sentence punctuation', () => {
    expect(isValidBoundary(',')).toBe(true);
    expect(isValidBoundary(';')).toBe(true);
    expect(isValidBoundary(':')).toBe(true);
    expect(isValidBoundary('!')).toBe(true);
    expect(isValidBoundary('?')).toBe(true);
  });

  it('should return false for identifier characters (dot, hyphen, underscore)', () => {
    // These are NOT valid boundaries because they appear in identifiers
    // e.g., "software" in "dl.software-update.org" should NOT match
    expect(isValidBoundary('.')).toBe(false);
    expect(isValidBoundary('-')).toBe(false);
    expect(isValidBoundary('_')).toBe(false);
  });

  it('should return true for parentheses and curly braces', () => {
    expect(isValidBoundary('(')).toBe(true);
    expect(isValidBoundary(')')).toBe(true);
    expect(isValidBoundary('{')).toBe(true);
    expect(isValidBoundary('}')).toBe(true);
  });

  it('should return false for square brackets (used in defanging)', () => {
    // [ and ] are NOT valid boundaries because they're used for defanging URLs
    // e.g., "software" in "dl[.]software-update[.]org" should NOT match
    expect(isValidBoundary('[')).toBe(false);
    expect(isValidBoundary(']')).toBe(false);
  });

  it('should return true for quotes', () => {
    expect(isValidBoundary('"')).toBe(true);
    expect(isValidBoundary("'")).toBe(true);
  });

  it('should return true for special characters (not in identifiers)', () => {
    expect(isValidBoundary('<')).toBe(true);
    expect(isValidBoundary('>')).toBe(true);
    expect(isValidBoundary('/')).toBe(true);
    expect(isValidBoundary('\\')).toBe(true);
    expect(isValidBoundary('@')).toBe(true);
    expect(isValidBoundary('#')).toBe(true);
    expect(isValidBoundary('$')).toBe(true);
    expect(isValidBoundary('%')).toBe(true);
    expect(isValidBoundary('^')).toBe(true);
    expect(isValidBoundary('&')).toBe(true);
    expect(isValidBoundary('*')).toBe(true);
    expect(isValidBoundary('+')).toBe(true);
    expect(isValidBoundary('=')).toBe(true);
    expect(isValidBoundary('|')).toBe(true);
    expect(isValidBoundary('`')).toBe(true);
    expect(isValidBoundary('~')).toBe(true);
    // Note: '_' and '-' are NOT valid boundaries (used in identifiers)
  });

  it('should return false for alphanumeric characters', () => {
    expect(isValidBoundary('a')).toBe(false);
    expect(isValidBoundary('Z')).toBe(false);
    expect(isValidBoundary('0')).toBe(false);
    expect(isValidBoundary('9')).toBe(false);
  });
});

// ============================================================================
// hasValidBoundaries Tests
// ============================================================================

describe('hasValidBoundaries', () => {
  it('should return true when match is at start of text', () => {
    expect(hasValidBoundaries('APT29 is active', 0, 5)).toBe(true);
  });

  it('should return true when match is at end of text', () => {
    expect(hasValidBoundaries('This is APT29', 8, 13)).toBe(true);
  });

  it('should return true when surrounded by spaces', () => {
    expect(hasValidBoundaries('The APT29 group', 4, 9)).toBe(true);
  });

  it('should return true when surrounded by punctuation', () => {
    expect(hasValidBoundaries('(APT29)', 1, 6)).toBe(true);
    expect(hasValidBoundaries('"APT29"', 1, 6)).toBe(true);
  });

  it('should return false when surrounded by brackets (used in defanging)', () => {
    // [ and ] are NOT valid boundaries because they're used for defanging URLs
    // e.g., "software" in "dl[.]software-update[.]org" should NOT match
    expect(hasValidBoundaries('[APT29]', 1, 6)).toBe(false);
  });

  it('should return false when preceded by alphanumeric', () => {
    expect(hasValidBoundaries('preAPT29', 3, 8)).toBe(false);
    expect(hasValidBoundaries('1APT29', 1, 6)).toBe(false);
  });

  it('should return false when followed by alphanumeric', () => {
    expect(hasValidBoundaries('APT29post', 0, 5)).toBe(false);
    expect(hasValidBoundaries('APT291', 0, 5)).toBe(false);
  });

  it('should handle single character text', () => {
    expect(hasValidBoundaries('A', 0, 1)).toBe(true);
  });

  it('should handle match spanning entire text', () => {
    expect(hasValidBoundaries('APT29', 0, 5)).toBe(true);
  });
});

// ============================================================================
// hasOverlappingRange Tests
// ============================================================================

describe('hasOverlappingRange', () => {
  it('should return false for empty set', () => {
    expect(hasOverlappingRange(0, 5, new Set())).toBe(false);
  });

  it('should return false for non-overlapping ranges', () => {
    const seenRanges = new Set(['0-5', '10-15']);
    expect(hasOverlappingRange(6, 9, seenRanges)).toBe(false);
    expect(hasOverlappingRange(20, 25, seenRanges)).toBe(false);
  });

  it('should return true for exact overlap', () => {
    const seenRanges = new Set(['0-5']);
    expect(hasOverlappingRange(0, 5, seenRanges)).toBe(true);
  });

  it('should return true for partial overlap at start', () => {
    const seenRanges = new Set(['0-10']);
    expect(hasOverlappingRange(5, 15, seenRanges)).toBe(true);
  });

  it('should return true for partial overlap at end', () => {
    const seenRanges = new Set(['10-20']);
    expect(hasOverlappingRange(5, 15, seenRanges)).toBe(true);
  });

  it('should return true when new range contains existing', () => {
    const seenRanges = new Set(['5-10']);
    expect(hasOverlappingRange(0, 15, seenRanges)).toBe(true);
  });

  it('should return true when new range is contained in existing', () => {
    const seenRanges = new Set(['0-20']);
    expect(hasOverlappingRange(5, 10, seenRanges)).toBe(true);
  });

  it('should return false for adjacent ranges (touching but not overlapping)', () => {
    const seenRanges = new Set(['0-5']);
    expect(hasOverlappingRange(5, 10, seenRanges)).toBe(false);
    expect(hasOverlappingRange(10, 15, new Set(['5-10']))).toBe(false);
  });
});

// ============================================================================
// createRangeKey Tests
// ============================================================================

describe('createRangeKey', () => {
  it('should create key from start and end indices', () => {
    expect(createRangeKey(0, 5)).toBe('0-5');
    expect(createRangeKey(10, 20)).toBe('10-20');
    expect(createRangeKey(100, 200)).toBe('100-200');
  });

  it('should handle zero indices', () => {
    expect(createRangeKey(0, 0)).toBe('0-0');
  });

  it('should handle large numbers', () => {
    expect(createRangeKey(1000000, 2000000)).toBe('1000000-2000000');
  });
});

// ============================================================================
// isMitreId Tests
// ============================================================================

describe('isMitreId', () => {
  it('should match technique IDs', () => {
    expect(isMitreId('T1059')).toBe(true);
    expect(isMitreId('T1234')).toBe(true);
    expect(isMitreId('t1059')).toBe(true); // case insensitive
  });

  it('should match sub-technique IDs', () => {
    expect(isMitreId('T1059.001')).toBe(true);
    expect(isMitreId('T1059.012')).toBe(true);
    expect(isMitreId('t1059.001')).toBe(true); // case insensitive
  });

  it('should match tactic IDs', () => {
    expect(isMitreId('TA0001')).toBe(true);
    expect(isMitreId('ta0001')).toBe(true); // case insensitive
  });

  it('should match software/group IDs', () => {
    expect(isMitreId('TS0001')).toBe(true);
  });

  it('should not match invalid formats', () => {
    expect(isMitreId('T123')).toBe(false); // Too few digits
    expect(isMitreId('T12345')).toBe(false); // Too many digits for main ID
    expect(isMitreId('T1059.1')).toBe(false); // Too few sub-technique digits
    expect(isMitreId('T1059.1234')).toBe(false); // Too many sub-technique digits
    expect(isMitreId('X1059')).toBe(false); // Wrong prefix
    expect(isMitreId('APT29')).toBe(false); // Not MITRE format
  });
});

// ============================================================================
// isParentMitreId Tests
// ============================================================================

describe('isParentMitreId', () => {
  it('should match parent technique IDs', () => {
    expect(isParentMitreId('T1059')).toBe(true);
    expect(isParentMitreId('T1234')).toBe(true);
    expect(isParentMitreId('t1059')).toBe(true); // case insensitive
  });

  it('should match tactic IDs', () => {
    expect(isParentMitreId('TA0001')).toBe(true);
  });

  it('should not match sub-technique IDs', () => {
    expect(isParentMitreId('T1059.001')).toBe(false);
    expect(isParentMitreId('T1059.012')).toBe(false);
  });

  it('should not match invalid formats', () => {
    expect(isParentMitreId('T123')).toBe(false);
    expect(isParentMitreId('APT29')).toBe(false);
  });
});

// ============================================================================
// isIpAddress Tests
// ============================================================================

describe('isIpAddress', () => {
  it('should match valid IPv4 addresses', () => {
    expect(isIpAddress('192.168.1.1')).toBe(true);
    expect(isIpAddress('10.0.0.1')).toBe(true);
    expect(isIpAddress('255.255.255.255')).toBe(true);
    expect(isIpAddress('0.0.0.0')).toBe(true);
  });

  it('should not match invalid formats', () => {
    expect(isIpAddress('192.168.1')).toBe(false); // Too few octets
    expect(isIpAddress('192.168.1.1.1')).toBe(false); // Too many octets
    expect(isIpAddress('example.com')).toBe(false);
    expect(isIpAddress('1234.1.1.1')).toBe(false); // Invalid octet
  });

  it('should not match defanged IPs', () => {
    expect(isIpAddress('192[.]168[.]1[.]1')).toBe(false);
  });

  it('should not match IPv6 addresses', () => {
    expect(isIpAddress('::1')).toBe(false);
    expect(isIpAddress('2001:db8::1')).toBe(false);
  });
});

// ============================================================================
// isMacAddress Tests
// ============================================================================

describe('isMacAddress', () => {
  it('should match colon-separated MAC addresses', () => {
    expect(isMacAddress('00:1A:2B:3C:4D:5E')).toBe(true);
    expect(isMacAddress('aa:bb:cc:dd:ee:ff')).toBe(true);
  });

  it('should match hyphen-separated MAC addresses', () => {
    expect(isMacAddress('00-1A-2B-3C-4D-5E')).toBe(true);
    expect(isMacAddress('aa-bb-cc-dd-ee-ff')).toBe(true);
  });

  it('should not match Cisco-style (dot notation)', () => {
    // The regex in matching.ts only supports : and - separators
    expect(isMacAddress('001a.2b3c.4d5e')).toBe(false);
  });

  it('should not match invalid formats', () => {
    expect(isMacAddress('00:1A:2B:3C:4D')).toBe(false); // Too few
    expect(isMacAddress('00:1A:2B:3C:4D:5E:6F')).toBe(false); // Too many
    expect(isMacAddress('GG:1A:2B:3C:4D:5E')).toBe(false); // Invalid hex
    expect(isMacAddress('192.168.1.1')).toBe(false); // IP address
  });
});

// ============================================================================
// escapeRegex Tests
// ============================================================================

describe('escapeRegex', () => {
  it('should escape dots', () => {
    expect(escapeRegex('example.com')).toBe('example\\.com');
  });

  it('should escape asterisks', () => {
    expect(escapeRegex('*.example.com')).toBe('\\*\\.example\\.com');
  });

  it('should escape question marks', () => {
    expect(escapeRegex('what?')).toBe('what\\?');
  });

  it('should escape plus signs', () => {
    expect(escapeRegex('a+b')).toBe('a\\+b');
  });

  it('should escape caret', () => {
    expect(escapeRegex('^start')).toBe('\\^start');
  });

  it('should escape dollar sign', () => {
    expect(escapeRegex('end$')).toBe('end\\$');
  });

  it('should escape brackets', () => {
    expect(escapeRegex('[a-z]')).toBe('\\[a-z\\]');
  });

  it('should escape braces', () => {
    expect(escapeRegex('a{1,3}')).toBe('a\\{1,3\\}');
  });

  it('should escape parentheses', () => {
    expect(escapeRegex('(group)')).toBe('\\(group\\)');
  });

  it('should escape pipe', () => {
    expect(escapeRegex('a|b')).toBe('a\\|b');
  });

  it('should escape backslash', () => {
    expect(escapeRegex('path\\to')).toBe('path\\\\to');
  });

  it('should handle multiple special characters', () => {
    expect(escapeRegex('a.b*c?d+e')).toBe('a\\.b\\*c\\?d\\+e');
  });

  it('should leave alphanumerics unchanged', () => {
    expect(escapeRegex('ABCabc123')).toBe('ABCabc123');
  });

  it('should handle empty string', () => {
    expect(escapeRegex('')).toBe('');
  });
});

// ============================================================================
// createMatchingRegex Tests
// ============================================================================

describe('createMatchingRegex', () => {
  it('should create regex for normal names with word boundaries', () => {
    const regex = createMatchingRegex('apt29');
    expect('APT29 is active'.match(regex)).toBeTruthy();
    expect('apt29'.match(regex)).toBeTruthy();
    expect('notapt29'.match(regex)).toBeFalsy(); // No match in middle of word
  });

  it('should be case insensitive', () => {
    const regex = createMatchingRegex('apt29');
    expect('APT29'.match(regex)).toBeTruthy();
    expect('apt29'.match(regex)).toBeTruthy();
    expect('Apt29'.match(regex)).toBeTruthy();
  });

  it('should be global to find all matches', () => {
    const regex = createMatchingRegex('apt29');
    const matches = 'APT29 and apt29 are the same'.match(regex);
    expect(matches).toHaveLength(2);
  });

  it('should handle MITRE IDs with word boundaries', () => {
    const regex = createMatchingRegex('t1059');
    expect('T1059 is a technique'.match(regex)).toBeTruthy();
    // Note: T1059 does match in 'T1059.001' because the . creates a word boundary
    // This is expected behavior - the detection logic filters duplicates separately
    expect('T1059.001 sub-technique'.match(regex)).toBeTruthy();
  });

  it('should handle IP addresses with lookahead/lookbehind', () => {
    const regex = createMatchingRegex('192.168.1.1');
    expect('IP: 192.168.1.1'.match(regex)).toBeTruthy();
    expect('192.168.1.100'.match(regex)).toBeFalsy(); // Should not match longer IP
  });

  it('should handle MAC addresses with lookahead/lookbehind', () => {
    const regex = createMatchingRegex('00:1a:2b:3c:4d:5e');
    expect('MAC: 00:1a:2b:3c:4d:5e'.match(regex)).toBeTruthy();
  });

  it('should handle names with special characters', () => {
    const regex = createMatchingRegex('threat-actor');
    expect('threat-actor is detected'.match(regex)).toBeTruthy();
  });

  it('should handle names with underscores', () => {
    const regex = createMatchingRegex('some_name');
    expect('some_name matches'.match(regex)).toBeTruthy();
  });
});

// ============================================================================
// needsManualBoundaryCheck Tests
// ============================================================================

describe('needsManualBoundaryCheck', () => {
  it('should return true for names with dots (not IPs)', () => {
    expect(needsManualBoundaryCheck('threat.actor')).toBe(true);
    expect(needsManualBoundaryCheck('sub.domain.name')).toBe(true);
  });

  it('should return true for names with hyphens (not MITRE IDs)', () => {
    expect(needsManualBoundaryCheck('threat-actor')).toBe(true);
    expect(needsManualBoundaryCheck('apt-29')).toBe(true);
  });

  it('should return true for names with underscores', () => {
    expect(needsManualBoundaryCheck('threat_actor')).toBe(true);
  });

  it('should return true for names with @ symbols', () => {
    expect(needsManualBoundaryCheck('user@domain')).toBe(true);
  });

  it('should return false for IP addresses', () => {
    expect(needsManualBoundaryCheck('192.168.1.1')).toBe(false);
    expect(needsManualBoundaryCheck('10.0.0.1')).toBe(false);
  });

  it('should return false for MAC addresses', () => {
    expect(needsManualBoundaryCheck('00:1a:2b:3c:4d:5e')).toBe(false);
    expect(needsManualBoundaryCheck('00-1a-2b-3c-4d-5e')).toBe(false);
  });

  it('should return false for MITRE IDs', () => {
    expect(needsManualBoundaryCheck('t1059')).toBe(false);
    expect(needsManualBoundaryCheck('t1059.001')).toBe(false);
    expect(needsManualBoundaryCheck('ta0001')).toBe(false);
  });

  it('should return true for plain names (always validate boundaries)', () => {
    // All entity names need boundary validation because \b regex treats
    // '.', '-', '_' as boundaries, which causes false positives
    expect(needsManualBoundaryCheck('apt29')).toBe(true);
    expect(needsManualBoundaryCheck('emotet')).toBe(true);
    expect(needsManualBoundaryCheck('lazarus')).toBe(true);
    expect(needsManualBoundaryCheck('software')).toBe(true);
    expect(needsManualBoundaryCheck('linux')).toBe(true);
  });
});

