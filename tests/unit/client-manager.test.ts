/**
 * Tests for background/services/client-manager.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPlatformCounts,
  setOpenCTIClientGetter,
  setOpenAEVClientGetter,
  getOpenCTIClients,
  getOpenAEVClients,
  hasOpenCTIClients,
  hasOpenAEVClients,
} from '../../src/background/services/client-manager';

// ============================================================================
// Mock Clients
// ============================================================================

const createMockOpenCTIClient = (name: string) => ({
  name,
  getPlatformInfo: () => ({ name, url: `https://${name}.opencti.io` }),
});

const createMockOpenAEVClient = (name: string) => ({
  name,
  getPlatformInfo: () => ({ name, url: `https://${name}.openaev.io` }),
});

// ============================================================================
// Tests
// ============================================================================

describe('Client Manager', () => {
  beforeEach(() => {
    // Reset client getters to empty maps
    setOpenCTIClientGetter(() => new Map());
    setOpenAEVClientGetter(() => new Map());
  });

  describe('getPlatformCounts', () => {
    it('should return zero counts when no clients configured', () => {
      const counts = getPlatformCounts();
      
      expect(counts.opencti).toBe(0);
      expect(counts.openaev).toBe(0);
    });

    it('should return correct count for OpenCTI clients', () => {
      const octiClients = new Map<string, any>([
        ['p1', createMockOpenCTIClient('Platform1')],
        ['p2', createMockOpenCTIClient('Platform2')],
      ]);
      setOpenCTIClientGetter(() => octiClients);
      
      const counts = getPlatformCounts();
      
      expect(counts.opencti).toBe(2);
      expect(counts.openaev).toBe(0);
    });

    it('should return correct count for OpenAEV clients', () => {
      const oaevClients = new Map<string, any>([
        ['p1', createMockOpenAEVClient('Platform1')],
      ]);
      setOpenAEVClientGetter(() => oaevClients);
      
      const counts = getPlatformCounts();
      
      expect(counts.opencti).toBe(0);
      expect(counts.openaev).toBe(1);
    });

    it('should return correct counts for both platform types', () => {
      const octiClients = new Map<string, any>([
        ['octi-1', createMockOpenCTIClient('OCTI1')],
        ['octi-2', createMockOpenCTIClient('OCTI2')],
        ['octi-3', createMockOpenCTIClient('OCTI3')],
      ]);
      const oaevClients = new Map<string, any>([
        ['oaev-1', createMockOpenAEVClient('OAEV1')],
        ['oaev-2', createMockOpenAEVClient('OAEV2')],
      ]);
      
      setOpenCTIClientGetter(() => octiClients);
      setOpenAEVClientGetter(() => oaevClients);
      
      const counts = getPlatformCounts();
      
      expect(counts.opencti).toBe(3);
      expect(counts.openaev).toBe(2);
    });

    it('should reflect dynamic changes', () => {
      const octiClients = new Map<string, any>();
      setOpenCTIClientGetter(() => octiClients);
      
      expect(getPlatformCounts().opencti).toBe(0);
      
      octiClients.set('p1', createMockOpenCTIClient('Platform1'));
      expect(getPlatformCounts().opencti).toBe(1);
      
      octiClients.set('p2', createMockOpenCTIClient('Platform2'));
      expect(getPlatformCounts().opencti).toBe(2);
      
      octiClients.delete('p1');
      expect(getPlatformCounts().opencti).toBe(1);
    });
  });

  describe('Re-exported registry functions', () => {
    it('should provide getOpenCTIClients', () => {
      const octiClients = new Map<string, any>([
        ['p1', createMockOpenCTIClient('Platform1')],
      ]);
      setOpenCTIClientGetter(() => octiClients);
      
      const clients = getOpenCTIClients();
      
      expect(clients.size).toBe(1);
      expect(clients.has('p1')).toBe(true);
    });

    it('should provide getOpenAEVClients', () => {
      const oaevClients = new Map<string, any>([
        ['p1', createMockOpenAEVClient('Platform1')],
      ]);
      setOpenAEVClientGetter(() => oaevClients);
      
      const clients = getOpenAEVClients();
      
      expect(clients.size).toBe(1);
      expect(clients.has('p1')).toBe(true);
    });

    it('should provide hasOpenCTIClients', () => {
      expect(hasOpenCTIClients()).toBe(false);
      
      const octiClients = new Map<string, any>([
        ['p1', createMockOpenCTIClient('Platform1')],
      ]);
      setOpenCTIClientGetter(() => octiClients);
      
      expect(hasOpenCTIClients()).toBe(true);
    });

    it('should provide hasOpenAEVClients', () => {
      expect(hasOpenAEVClients()).toBe(false);
      
      const oaevClients = new Map<string, any>([
        ['p1', createMockOpenAEVClient('Platform1')],
      ]);
      setOpenAEVClientGetter(() => oaevClients);
      
      expect(hasOpenAEVClients()).toBe(true);
    });
  });
});

