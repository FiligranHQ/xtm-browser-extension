/**
 * Unit Tests for AI Entity Helper Functions
 * 
 * Tests utilities for handling AI-discovered entities.
 */

import { describe, it, expect } from 'vitest';
import {
  createAIEntityPayload,
  formatEntityCountMessage,
} from '../../src/panel/utils/ai-entity-helpers';
import type { ScanResultEntity } from '../../src/shared/types/scan';

// ============================================================================
// createAIEntityPayload Tests
// ============================================================================

describe('createAIEntityPayload', () => {
  it('should map all entity properties correctly', () => {
    const entities: ScanResultEntity[] = [
      {
        id: 'entity-1',
        type: 'Malware',
        name: 'Emotet',
        value: 'emotet',
        aiReason: 'Found in threat report',
        aiConfidence: 'high',
      },
    ];

    const result = createAIEntityPayload(entities);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'entity-1',
      type: 'Malware',
      name: 'Emotet',
      value: 'emotet',
      aiReason: 'Found in threat report',
      aiConfidence: 'high',
    });
  });

  it('should handle multiple entities', () => {
    const entities: ScanResultEntity[] = [
      { id: '1', type: 'Malware', name: 'Emotet' },
      { id: '2', type: 'Intrusion-Set', name: 'APT29' },
      { id: '3', type: 'Tool', name: 'Mimikatz' },
    ];

    const result = createAIEntityPayload(entities);

    expect(result).toHaveLength(3);
    expect(result.map(e => e.name)).toEqual(['Emotet', 'APT29', 'Mimikatz']);
  });

  it('should handle empty entities array', () => {
    const result = createAIEntityPayload([]);
    expect(result).toEqual([]);
  });

  it('should handle entities without optional properties', () => {
    const entities: ScanResultEntity[] = [
      { id: 'entity-1', type: 'Malware', name: 'Test' },
    ];

    const result = createAIEntityPayload(entities);

    expect(result[0].value).toBeUndefined();
    expect(result[0].aiReason).toBeUndefined();
    expect(result[0].aiConfidence).toBeUndefined();
  });

  it('should preserve all confidence levels', () => {
    const entities: ScanResultEntity[] = [
      { id: '1', type: 'Malware', name: 'Low', aiConfidence: 'low' },
      { id: '2', type: 'Malware', name: 'Medium', aiConfidence: 'medium' },
      { id: '3', type: 'Malware', name: 'High', aiConfidence: 'high' },
    ];

    const result = createAIEntityPayload(entities);

    expect(result[0].aiConfidence).toBe('low');
    expect(result[1].aiConfidence).toBe('medium');
    expect(result[2].aiConfidence).toBe('high');
  });
});

// ============================================================================
// formatEntityCountMessage Tests
// ============================================================================

describe('formatEntityCountMessage', () => {
  it('should use singular form for 1 entity', () => {
    expect(formatEntityCountMessage(1)).toBe('AI discovered 1 additional entity');
  });

  it('should use plural form for 0 entities', () => {
    expect(formatEntityCountMessage(0)).toBe('AI discovered 0 additional entities');
  });

  it('should use plural form for multiple entities', () => {
    expect(formatEntityCountMessage(2)).toBe('AI discovered 2 additional entities');
    expect(formatEntityCountMessage(5)).toBe('AI discovered 5 additional entities');
    expect(formatEntityCountMessage(100)).toBe('AI discovered 100 additional entities');
  });

  it('should use custom prefix', () => {
    expect(formatEntityCountMessage(3, 'Found')).toBe('Found 3 additional entities');
    expect(formatEntityCountMessage(1, 'Detected')).toBe('Detected 1 additional entity');
  });

  it('should handle large numbers', () => {
    expect(formatEntityCountMessage(1000)).toBe('AI discovered 1000 additional entities');
  });

  it('should handle default prefix when not provided', () => {
    const result = formatEntityCountMessage(5);
    expect(result).toContain('AI discovered');
  });
});

