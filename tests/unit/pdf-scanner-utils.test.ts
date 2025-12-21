/**
 * Unit Tests for PDF Scanner Utilities
 * 
 * Tests the utility functions used for PDF text extraction and entity highlighting.
 */

import { describe, it, expect } from 'vitest';
import {
  groupTextItemsIntoLines,
  buildLineTextAndCharMap,
  extractAllEntities,
} from '../../src/pdf-scanner/utils/highlight-utils';
import type { TextLine } from '../../src/pdf-scanner/types';
import type { ScanResultPayload } from '../../src/shared/types/messages';

// ============================================================================
// Text Line Grouping Tests
// ============================================================================

describe('groupTextItemsIntoLines', () => {
  it('should group items on the same Y position into one line', () => {
    const textContent = {
      items: [
        { str: 'Hello', transform: [1, 0, 0, 1, 10, 100], width: 50, height: 12 },
        { str: 'World', transform: [1, 0, 0, 1, 70, 100], width: 50, height: 12 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(2);
  });

  it('should create separate lines for different Y positions', () => {
    const textContent = {
      items: [
        { str: 'Line 1', transform: [1, 0, 0, 1, 10, 100], width: 50, height: 12 },
        { str: 'Line 2', transform: [1, 0, 0, 1, 10, 80], width: 50, height: 12 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(2);
    expect(lines[0].items[0].str).toBe('Line 1');
    expect(lines[1].items[0].str).toBe('Line 2');
  });

  it('should handle Y tolerance for items that are close', () => {
    const textContent = {
      items: [
        { str: 'Item1', transform: [1, 0, 0, 1, 10, 100], width: 50, height: 12 },
        { str: 'Item2', transform: [1, 0, 0, 1, 70, 101], width: 50, height: 12 }, // 1px difference
        { str: 'Item3', transform: [1, 0, 0, 1, 130, 102], width: 50, height: 12 }, // 2px difference from first
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    // All should be on the same line due to Y_TOLERANCE of 3
    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(3);
  });

  it('should skip empty text items', () => {
    const textContent = {
      items: [
        { str: 'Text', transform: [1, 0, 0, 1, 10, 100], width: 50, height: 12 },
        { str: '', transform: [1, 0, 0, 1, 70, 100], width: 0, height: 12 }, // Empty
        { str: 'More', transform: [1, 0, 0, 1, 130, 100], width: 50, height: 12 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(2);
  });
});

// ============================================================================
// Line Text Building Tests
// ============================================================================

describe('buildLineTextAndCharMap', () => {
  it('should combine text items into a single string', () => {
    const line: TextLine = {
      items: [
        { str: 'Hello', transform: [1, 0, 0, 1, 10, 100], width: 50, height: 12 },
        { str: 'World', transform: [1, 0, 0, 1, 70, 100], width: 50, height: 12 },
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.combinedText).toBe('Hello World');
  });

  it('should add space between items with large gap', () => {
    const line: TextLine = {
      items: [
        { str: 'Column1', transform: [1, 0, 0, 1, 10, 100], width: 50, height: 12 },
        { str: 'Column2', transform: [1, 0, 0, 1, 100, 100], width: 50, height: 12 }, // 40px gap
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.combinedText).toBe('Column1 Column2');
  });

  it('should add space between alphanumeric boundaries', () => {
    const line: TextLine = {
      items: [
        { str: 'ABC', transform: [1, 0, 0, 1, 10, 100], width: 30, height: 12 },
        { str: '123', transform: [1, 0, 0, 1, 41, 100], width: 30, height: 12 }, // Small gap between alphanumerics
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.combinedText).toBe('ABC 123');
  });

  it('should build correct character map', () => {
    const line: TextLine = {
      items: [
        { str: 'AB', transform: [1, 0, 0, 1, 10, 100], width: 20, height: 12 },
        { str: 'CD', transform: [1, 0, 0, 1, 50, 100], width: 20, height: 12 },
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    // With space: "AB CD" = 5 chars
    expect(line.charMap.length).toBeGreaterThanOrEqual(4); // At least the original chars
    
    // First char 'A' should map to first item, charIndex 0
    expect(line.charMap[0].item.str).toBe('AB');
    expect(line.charMap[0].charIndex).toBe(0);
    
    // Second char 'B' should map to first item, charIndex 1
    expect(line.charMap[1].item.str).toBe('AB');
    expect(line.charMap[1].charIndex).toBe(1);
  });

  it('should sort items by X position', () => {
    const line: TextLine = {
      items: [
        { str: 'Second', transform: [1, 0, 0, 1, 100, 100], width: 50, height: 12 },
        { str: 'First', transform: [1, 0, 0, 1, 10, 100], width: 50, height: 12 },
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.combinedText).toContain('First');
    expect(line.combinedText.indexOf('First')).toBeLessThan(line.combinedText.indexOf('Second'));
  });
});

// ============================================================================
// Entity Extraction Tests
// ============================================================================

describe('extractAllEntities', () => {
  it('should extract observables', () => {
    const scanResults: ScanResultPayload = {
      observables: [
        { value: '192.168.1.1', type: 'IPv4-Addr', found: true, platformMatches: [] },
        { value: 'example.com', type: 'Domain-Name', found: false, platformMatches: [] },
      ],
      openctiEntities: [],
      cves: [],
      pageContent: '',
      pageTitle: 'Test',
      pageUrl: 'https://test.com',
    };
    
    const entities = extractAllEntities(scanResults);
    
    expect(entities).toHaveLength(2);
    expect(entities[0].value).toBe('192.168.1.1');
    expect(entities[1].value).toBe('example.com');
  });

  it('should extract OpenCTI entities', () => {
    const scanResults: ScanResultPayload = {
      observables: [],
      openctiEntities: [
        { name: 'APT29', type: 'Threat-Actor', found: true, platformMatches: [] },
      ],
      cves: [],
      pageContent: '',
      pageTitle: 'Test',
      pageUrl: 'https://test.com',
    };
    
    const entities = extractAllEntities(scanResults);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('APT29');
    expect(entities[0].type).toBe('Threat-Actor');
  });

  it('should extract CVEs', () => {
    const scanResults: ScanResultPayload = {
      observables: [],
      openctiEntities: [],
      cves: [
        { value: 'CVE-2021-44228', type: 'cve', found: true, platformMatches: [] },
      ],
      pageContent: '',
      pageTitle: 'Test',
      pageUrl: 'https://test.com',
    };
    
    const entities = extractAllEntities(scanResults);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].value).toBe('CVE-2021-44228');
    expect(entities[0].type).toBe('cve');
  });

  it('should extract OpenAEV entities with prefixed type', () => {
    const scanResults: ScanResultPayload = {
      observables: [],
      openctiEntities: [],
      cves: [],
      openaevEntities: [
        { name: 'Attack Pattern 1', type: 'Attack-Pattern', found: true, platformMatches: [] },
      ],
      pageContent: '',
      pageTitle: 'Test',
      pageUrl: 'https://test.com',
    };
    
    const entities = extractAllEntities(scanResults);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('Attack Pattern 1');
    expect(entities[0].type).toBe('oaev-Attack-Pattern');
  });

  it('should extract AI-discovered entities', () => {
    const scanResults: ScanResultPayload = {
      observables: [],
      openctiEntities: [],
      cves: [],
      aiDiscoveredEntities: [
        {
          id: 'ai-1',
          name: 'Suspicious Entity',
          value: 'SuspiciousValue',
          type: 'Malware',
          aiReason: 'Found in context of attack',
          aiConfidence: 'high',
        },
      ],
      pageContent: '',
      pageTitle: 'Test',
      pageUrl: 'https://test.com',
    };
    
    const entities = extractAllEntities(scanResults);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('Suspicious Entity');
    expect(entities[0].discoveredByAI).toBe(true);
    expect(entities[0].found).toBe(false);
    expect(entities[0].aiReason).toBe('Found in context of attack');
    expect(entities[0].aiConfidence).toBe('high');
  });

  it('should combine all entity types', () => {
    const scanResults: ScanResultPayload = {
      observables: [
        { value: '10.0.0.1', type: 'IPv4-Addr', found: true, platformMatches: [] },
      ],
      openctiEntities: [
        { name: 'APT28', type: 'Threat-Actor', found: true, platformMatches: [] },
      ],
      cves: [
        { value: 'CVE-2020-1234', type: 'cve', found: false, platformMatches: [] },
      ],
      openaevEntities: [
        { name: 'Technique 1', type: 'Attack-Pattern', found: true, platformMatches: [] },
      ],
      aiDiscoveredEntities: [
        { id: 'ai-1', name: 'AI Entity', value: 'AIValue', type: 'entity' },
      ],
      pageContent: '',
      pageTitle: 'Test',
      pageUrl: 'https://test.com',
    };
    
    const entities = extractAllEntities(scanResults);
    
    expect(entities).toHaveLength(5);
  });

  it('should handle empty scan results', () => {
    const scanResults: ScanResultPayload = {
      observables: [],
      openctiEntities: [],
      cves: [],
      pageContent: '',
      pageTitle: 'Test',
      pageUrl: 'https://test.com',
    };
    
    const entities = extractAllEntities(scanResults);
    
    expect(entities).toHaveLength(0);
  });
});

// ============================================================================
// Integration-style Tests for Table Detection
// ============================================================================

describe('Table text extraction (integration)', () => {
  it('should correctly handle table-like text with column gaps', () => {
    // Simulate PDF table text extraction where columns are separate items
    const textContent = {
      items: [
        { str: 'Name', transform: [1, 0, 0, 1, 10, 100], width: 40, height: 12 },
        { str: 'IP Address', transform: [1, 0, 0, 1, 100, 100], width: 80, height: 12 },
        { str: 'Status', transform: [1, 0, 0, 1, 250, 100], width: 50, height: 12 },
        // Next row
        { str: 'Server1', transform: [1, 0, 0, 1, 10, 80], width: 50, height: 12 },
        { str: '192.168.1.1', transform: [1, 0, 0, 1, 100, 80], width: 90, height: 12 },
        { str: 'Active', transform: [1, 0, 0, 1, 250, 80], width: 50, height: 12 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(2);
    
    // Build text for each line
    lines.forEach(line => buildLineTextAndCharMap(line));
    
    // First line should be header
    expect(lines[0].combinedText).toContain('Name');
    expect(lines[0].combinedText).toContain('IP Address');
    expect(lines[0].combinedText).toContain('Status');
    
    // Second line should have data with proper spacing
    expect(lines[1].combinedText).toContain('Server1');
    expect(lines[1].combinedText).toContain('192.168.1.1');
    expect(lines[1].combinedText).toContain('Active');
    
    // The IP should be searchable as a complete string
    expect(lines[1].combinedText).toMatch(/192\.168\.1\.1/);
  });

  it('should handle hash values that might be split', () => {
    // Simulate a long hash that appears in a table cell
    const textContent = {
      items: [
        { str: 'Hash:', transform: [1, 0, 0, 1, 10, 100], width: 40, height: 12 },
        { str: 'a1b2c3d4e5f6', transform: [1, 0, 0, 1, 100, 100], width: 100, height: 12 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    lines.forEach(line => buildLineTextAndCharMap(line));
    
    expect(lines[0].combinedText).toContain('a1b2c3d4e5f6');
  });
});

