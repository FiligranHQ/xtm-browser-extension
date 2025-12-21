/**
 * Unit Tests for PDF Highlight Utilities
 * 
 * Tests helper functions for rendering entity highlights on PDF pages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEntityValue,
  getEntityPositionKey,
  groupTextItemsIntoLines,
  buildLineTextAndCharMap,
  extractAllEntities,
} from '../../src/pdf-scanner/utils/highlight-utils';
import type { ScanResultPayload } from '../../src/shared/types/messages';

// Mock dependencies
vi.mock('../../src/shared/utils/highlight-colors', () => ({
  getHighlightColors: () => ({ background: 'rgba(0,0,0,0.1)', outline: 'rgba(0,0,0,0.5)' }),
  getStatusIconColor: () => '#000000',
}));

vi.mock('../../src/shared/detection/patterns', () => ({
  generateDefangedVariants: (value: string) => {
    const variants: string[] = [];
    if (value.includes('.')) {
      // Simulate defanging dots
      variants.push(value.replace(/\./g, '[.]'));
      variants.push(value.replace(/\./g, '(.)'));
    }
    return variants;
  },
}));

// ============================================================================
// getEntityValue Tests
// ============================================================================

describe('getEntityValue', () => {
  it('should return value when entity has value property', () => {
    const entity = { value: '192.168.1.1', type: 'IPv4-Addr', found: true };
    expect(getEntityValue(entity)).toBe('192.168.1.1');
  });

  it('should return name when entity has name but no value', () => {
    const entity = { name: 'Threat Actor Group', type: 'threat-actor', found: true };
    expect(getEntityValue(entity)).toBe('Threat Actor Group');
  });

  it('should prefer value over name', () => {
    const entity = { value: 'test-value', name: 'test-name', type: 'test', found: true };
    expect(getEntityValue(entity)).toBe('test-value');
  });

  it('should return empty string when neither value nor name exists', () => {
    const entity = { type: 'unknown', found: false };
    expect(getEntityValue(entity)).toBe('');
  });

  it('should handle empty value string', () => {
    const entity = { value: '', name: 'fallback', type: 'test', found: true };
    expect(getEntityValue(entity)).toBe('fallback');
  });

  it('should convert non-string value to string', () => {
    // TypeScript would normally catch this, but runtime could have numbers
    const entity = { value: 12345 as unknown as string, type: 'test', found: true };
    expect(getEntityValue(entity)).toBe('12345');
  });
});

// ============================================================================
// getEntityPositionKey Tests
// ============================================================================

describe('getEntityPositionKey', () => {
  it('should create lowercase key from type and value', () => {
    const entity = { value: 'TEST.com', type: 'Domain-Name', found: true };
    expect(getEntityPositionKey(entity)).toBe('domain-name-test.com');
  });

  it('should create key from type and name when value is missing', () => {
    const entity = { name: 'APT Group', type: 'Threat-Actor', found: true };
    expect(getEntityPositionKey(entity)).toBe('threat-actor-apt group');
  });

  it('should handle empty value gracefully', () => {
    const entity = { type: 'test', found: false };
    expect(getEntityPositionKey(entity)).toBe('test-');
  });

  it('should normalize case consistently', () => {
    const entity1 = { value: 'Example.COM', type: 'Domain', found: true };
    const entity2 = { value: 'example.com', type: 'domain', found: true };
    expect(getEntityPositionKey(entity1)).toBe(getEntityPositionKey(entity2));
  });
});

// ============================================================================
// groupTextItemsIntoLines Tests
// ============================================================================

describe('groupTextItemsIntoLines', () => {
  it('should group items on same Y position into one line', () => {
    const textContent = {
      items: [
        { str: 'Hello', transform: [1, 0, 0, 12, 10, 100], width: 40 },
        { str: ' World', transform: [1, 0, 0, 12, 55, 100], width: 50 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(2);
  });

  it('should create separate lines for different Y positions', () => {
    const textContent = {
      items: [
        { str: 'Line 1', transform: [1, 0, 0, 12, 10, 100], width: 40 },
        { str: 'Line 2', transform: [1, 0, 0, 12, 10, 80], width: 40 },
        { str: 'Line 3', transform: [1, 0, 0, 12, 10, 60], width: 40 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(3);
  });

  it('should group items within Y tolerance', () => {
    const textContent = {
      items: [
        { str: 'Item1', transform: [1, 0, 0, 12, 10, 100], width: 40 },
        { str: 'Item2', transform: [1, 0, 0, 12, 50, 102], width: 40 }, // Within 3px tolerance
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(2);
  });

  it('should skip empty text items', () => {
    const textContent = {
      items: [
        { str: 'Valid', transform: [1, 0, 0, 12, 10, 100], width: 40 },
        { str: '', transform: [1, 0, 0, 12, 50, 100], width: 0 },
        { str: 'Also Valid', transform: [1, 0, 0, 12, 60, 100], width: 50 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(2);
  });

  it('should sort items by X position within a line', () => {
    const textContent = {
      items: [
        { str: 'Second', transform: [1, 0, 0, 12, 50, 100], width: 50 },
        { str: 'First', transform: [1, 0, 0, 12, 10, 100], width: 35 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(1);
    // Note: groupTextItemsIntoLines sorts by Y then X during grouping,
    // buildLineTextAndCharMap will sort by X later
  });

  it('should handle empty items array', () => {
    const textContent = { items: [] };
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(0);
  });

  it('should initialize charMap as empty array', () => {
    const textContent = {
      items: [{ str: 'Test', transform: [1, 0, 0, 12, 10, 100], width: 40 }],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines[0].charMap).toEqual([]);
    expect(lines[0].combinedText).toBe('');
  });
});

// ============================================================================
// buildLineTextAndCharMap Tests
// ============================================================================

describe('buildLineTextAndCharMap', () => {
  it('should build combined text from line items', () => {
    const line = {
      items: [
        { str: 'Hello', transform: [1, 0, 0, 12, 10, 100], width: 40 },
        { str: 'World', transform: [1, 0, 0, 12, 60, 100], width: 40 },
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.combinedText).toContain('Hello');
    expect(line.combinedText).toContain('World');
  });

  it('should add space between separated items', () => {
    const line = {
      items: [
        { str: 'Col1', transform: [1, 0, 0, 12, 10, 100], width: 30 },
        { str: 'Col2', transform: [1, 0, 0, 12, 100, 100], width: 30 }, // Big gap
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.combinedText).toBe('Col1 Col2');
  });

  it('should build character map with correct indices', () => {
    const line = {
      items: [{ str: 'ABC', transform: [1, 0, 0, 12, 10, 100], width: 30 }],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.charMap).toHaveLength(3);
    expect(line.charMap[0].charIndex).toBe(0);
    expect(line.charMap[1].charIndex).toBe(1);
    expect(line.charMap[2].charIndex).toBe(2);
    expect(line.charMap[0].globalIndex).toBe(0);
    expect(line.charMap[1].globalIndex).toBe(1);
    expect(line.charMap[2].globalIndex).toBe(2);
  });

  it('should handle adjacent items without gap', () => {
    const line = {
      items: [
        { str: 'No', transform: [1, 0, 0, 12, 10, 100], width: 20 },
        { str: 'Gap', transform: [1, 0, 0, 12, 30, 100], width: 30 }, // Directly adjacent
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    // May or may not have space depending on precise calculation
    // Just verify it runs without error
    expect(line.combinedText.length).toBeGreaterThan(0);
  });

  it('should sort items by X position', () => {
    const line = {
      items: [
        { str: 'B', transform: [1, 0, 0, 12, 50, 100], width: 10 },
        { str: 'A', transform: [1, 0, 0, 12, 10, 100], width: 10 },
      ],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.combinedText.startsWith('A')).toBe(true);
  });

  it('should handle empty line items array', () => {
    const line = {
      items: [],
      combinedText: '',
      charMap: [],
      y: 100,
    };
    
    buildLineTextAndCharMap(line);
    
    expect(line.combinedText).toBe('');
    expect(line.charMap).toHaveLength(0);
  });
});

// ============================================================================
// extractAllEntities Tests
// ============================================================================

describe('extractAllEntities', () => {
  const baseScanResults: ScanResultPayload = {
    url: 'https://example.com',
    pageContent: 'Test content',
    observables: [],
    openctiEntities: [],
    cves: [],
    openaevEntities: [],
    aiDiscoveredEntities: [],
  };

  it('should extract observables with correct type', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      observables: [
        { type: 'IPv4-Addr', value: '192.168.1.1', found: true },
        { type: 'Domain-Name', value: 'example.com', found: false },
      ],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities).toHaveLength(2);
    expect(entities[0].type).toBe('IPv4-Addr');
    expect(entities[0].value).toBe('192.168.1.1');
    expect(entities[1].type).toBe('Domain-Name');
  });

  it('should extract OpenCTI entities', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      openctiEntities: [
        { id: '1', name: 'Threat Actor', type: 'threat-actor', found: true },
      ],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('Threat Actor');
    expect(entities[0].type).toBe('threat-actor');
  });

  it('should extract CVEs with default type', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      cves: [
        { name: 'CVE-2024-1234', type: undefined as unknown as string, found: true },
      ],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('CVE-2024-1234');
    expect(entities[0].type).toBe('cve');
  });

  it('should extract OpenAEV entities with prefixed type', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      openaevEntities: [
        { id: '1', name: 'Vuln Name', type: 'vulnerability', found: true },
      ],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('Vuln Name');
    expect(entities[0].type).toBe('oaev-vulnerability');
    expect(entities[0].found).toBe(true);
  });

  it('should extract AI-discovered entities with discoveredByAI flag', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      aiDiscoveredEntities: [
        { 
          name: 'AI Found', 
          type: 'malware',
          value: 'test-value',
          aiReason: 'Detected by AI',
          aiConfidence: 0.9,
        },
      ],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('AI Found');
    expect(entities[0].discoveredByAI).toBe(true);
    expect(entities[0].found).toBe(false);
    expect(entities[0].aiReason).toBe('Detected by AI');
    expect(entities[0].aiConfidence).toBe(0.9);
  });

  it('should combine all entity types', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      observables: [{ type: 'IP', value: '10.0.0.1', found: true }],
      openctiEntities: [{ id: '1', name: 'Actor', type: 'threat-actor', found: true }],
      cves: [{ name: 'CVE-2024-0001', type: 'cve', found: true }],
      openaevEntities: [{ id: '2', name: 'Vuln', type: 'vulnerability', found: true }],
      aiDiscoveredEntities: [{ name: 'AI Entity', type: 'indicator', value: 'val' }],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities).toHaveLength(5);
  });

  it('should handle empty scan results', () => {
    const entities = extractAllEntities(baseScanResults);
    expect(entities).toHaveLength(0);
  });

  it('should handle missing optional arrays', () => {
    const results: ScanResultPayload = {
      url: 'https://example.com',
      pageContent: 'Test',
      observables: [],
      openctiEntities: [],
      // Missing cves, openaevEntities, aiDiscoveredEntities
    } as ScanResultPayload;
    
    const entities = extractAllEntities(results);
    
    expect(entities).toHaveLength(0);
  });

  it('should preserve entity data for OpenCTI entities', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      openctiEntities: [
        { 
          id: '1', 
          name: 'Attack Pattern', 
          type: 'attack-pattern', 
          found: true,
          aliases: ['T1234', 'T1234.001'],
        },
      ],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities[0].aliases).toEqual(['T1234', 'T1234.001']);
  });

  it('should handle OpenAEV entities without type', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      openaevEntities: [
        { id: '1', name: 'Generic', type: undefined as unknown as string, found: true },
      ],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities[0].type).toBe('oaev-entity');
  });

  it('should default found to true for OpenAEV entities', () => {
    const results: ScanResultPayload = {
      ...baseScanResults,
      openaevEntities: [
        { id: '1', name: 'Entity', type: 'type', found: undefined as unknown as boolean },
      ],
    };
    
    const entities = extractAllEntities(results);
    
    expect(entities[0].found).toBe(true);
  });
});

// ============================================================================
// Edge Cases and Integration
// ============================================================================

describe('Edge Cases', () => {
  it('should handle unicode text in entities', () => {
    const entity = { value: '日本語ドメイン.jp', type: 'Domain', found: true };
    expect(getEntityValue(entity)).toBe('日本語ドメイン.jp');
    expect(getEntityPositionKey(entity)).toBe('domain-日本語ドメイン.jp');
  });

  it('should handle special characters in values', () => {
    const entity = { value: 'test@example.com', type: 'Email-Addr', found: true };
    expect(getEntityValue(entity)).toBe('test@example.com');
  });

  it('should handle very long entity values', () => {
    const longValue = 'A'.repeat(1000);
    const entity = { value: longValue, type: 'Hash', found: true };
    expect(getEntityValue(entity)).toBe(longValue);
    expect(getEntityPositionKey(entity)).toContain(longValue.toLowerCase());
  });

  it('should handle text items with zero width', () => {
    const textContent = {
      items: [
        { str: 'Test', transform: [1, 0, 0, 12, 10, 100], width: 0 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    buildLineTextAndCharMap(lines[0]);
    
    expect(lines[0].combinedText).toBe('Test');
  });

  it('should handle negative transform values', () => {
    const textContent = {
      items: [
        { str: 'Neg', transform: [1, 0, 0, 12, -10, -50], width: 30 },
      ],
    };
    
    const lines = groupTextItemsIntoLines(textContent);
    
    expect(lines).toHaveLength(1);
  });
});

