/**
 * Unit Tests for Injector Helper Functions
 * 
 * Tests formatting and display utilities for injector/contract information.
 */

import { describe, it, expect } from 'vitest';
import {
  formatInjectorName,
  getContractLabel,
} from '../../src/panel/utils/injector-helpers';

// ============================================================================
// formatInjectorName Tests
// ============================================================================

describe('formatInjectorName', () => {
  it('should convert snake_case to Title Case', () => {
    expect(formatInjectorName('my_injector')).toBe('My Injector');
    expect(formatInjectorName('some_other_name')).toBe('Some Other Name');
  });

  it('should handle special name: openaev', () => {
    expect(formatInjectorName('openaev_implant')).toBe('OpenAEV Implant');
    expect(formatInjectorName('OPENAEV_test')).toBe('OpenAEV Test');
  });

  it('should handle special name: caldera', () => {
    expect(formatInjectorName('caldera_ability')).toBe('Caldera Ability');
    expect(formatInjectorName('CALDERA_plugin')).toBe('Caldera Plugin');
  });

  it('should handle special name: atomic', () => {
    expect(formatInjectorName('atomic_red_team')).toBe('Atomic Red Team');
    expect(formatInjectorName('ATOMIC_test')).toBe('Atomic Test');
  });

  it('should handle empty string', () => {
    expect(formatInjectorName('')).toBe('');
  });

  it('should handle single word', () => {
    expect(formatInjectorName('test')).toBe('Test');
  });

  it('should handle already formatted names', () => {
    expect(formatInjectorName('Already Formatted')).toBe('Already Formatted');
  });

  it('should handle mixed case special names', () => {
    expect(formatInjectorName('OpenAEV_test')).toBe('OpenAEV Test');
    expect(formatInjectorName('openAEV_test')).toBe('OpenAEV Test');
  });

  it('should capitalize first letter of each word', () => {
    expect(formatInjectorName('word_one_two_three')).toBe('Word One Two Three');
  });

  it('should handle names without underscores', () => {
    expect(formatInjectorName('singleword')).toBe('Singleword');
  });
});

// ============================================================================
// getContractLabel Tests
// ============================================================================

describe('getContractLabel', () => {
  it('should return English label when available', () => {
    const contract = {
      injector_contract_labels: { en: 'Execute Command' },
      injector_name: 'cmd_exec',
    };
    expect(getContractLabel(contract)).toBe('Execute Command');
  });

  it('should fall back to injector_name when no label', () => {
    const contract = {
      injector_contract_labels: {},
      injector_name: 'my_injector',
    };
    expect(getContractLabel(contract)).toBe('my_injector');
  });

  it('should fall back to injector_name when labels undefined', () => {
    const contract = {
      injector_name: 'fallback_name',
    };
    expect(getContractLabel(contract)).toBe('fallback_name');
  });

  it('should return Unknown when neither label nor name available', () => {
    const contract = {};
    expect(getContractLabel(contract)).toBe('Unknown');
  });

  it('should return Unknown for empty labels and no name', () => {
    const contract = {
      injector_contract_labels: { en: '' },
      injector_name: '',
    };
    // Empty string is falsy, so it falls through to 'Unknown'
    expect(getContractLabel(contract)).toBe('Unknown');
  });

  it('should prioritize English label over injector_name', () => {
    const contract = {
      injector_contract_labels: { en: 'Preferred Label' },
      injector_name: 'Not Used',
    };
    expect(getContractLabel(contract)).toBe('Preferred Label');
  });
});

