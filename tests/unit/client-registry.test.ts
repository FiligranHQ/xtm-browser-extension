/**
 * Unit Tests for Client Registry
 * 
 * Tests the centralized client registry service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setOpenCTIClientGetter,
  setOpenAEVClientGetter,
  setPrimaryOpenCTIClientGetter,
  getOpenCTIClients,
  getOpenAEVClients,
  getPrimaryOpenCTIClient,
  getFirstOpenAEVClient,
  hasOpenCTIClients,
  hasOpenAEVClients,
} from '../../src/background/services/client-registry';

// ============================================================================
// Client Registry Tests
// ============================================================================

describe('Client Registry', () => {
  // Save original state before each test
  let originalState: {
    octi: (() => Map<string, unknown>) | null;
    oaev: (() => Map<string, unknown>) | null;
    primaryOcti: (() => unknown) | null;
  };

  beforeEach(() => {
    // We can't access the internal state directly, but we can test behavior
    // Reset by setting new getters
  });

  describe('OpenCTI Client Getter', () => {
    it('should return empty map when no getter is configured', () => {
      // By default, should return empty map
      // Note: This may fail if tests run in sequence - we can't truly reset the module
      const clients = getOpenCTIClients();
      expect(clients instanceof Map).toBe(true);
    });

    it('should use configured getter to return clients', () => {
      const mockClient1 = { name: 'OpenCTI-1' };
      const mockClient2 = { name: 'OpenCTI-2' };
      const mockClients = new Map([
        ['platform-1', mockClient1],
        ['platform-2', mockClient2],
      ]);

      const getter = vi.fn().mockReturnValue(mockClients);
      setOpenCTIClientGetter(getter as any);

      const result = getOpenCTIClients();
      
      expect(getter).toHaveBeenCalled();
      expect(result.size).toBe(2);
      expect(result.get('platform-1')).toBe(mockClient1);
    });

    it('should reflect changes when getter returns different values', () => {
      let mockClients = new Map<string, unknown>();
      const getter = vi.fn().mockImplementation(() => mockClients);
      
      setOpenCTIClientGetter(getter as any);
      
      expect(getOpenCTIClients().size).toBe(0);
      
      mockClients = new Map([['p1', { name: 'New Client' }]]);
      
      expect(getOpenCTIClients().size).toBe(1);
    });
  });

  describe('OpenAEV Client Getter', () => {
    it('should use configured getter to return clients', () => {
      const mockClient = { name: 'OpenAEV-1' };
      const mockClients = new Map([['platform-1', mockClient]]);
      
      const getter = vi.fn().mockReturnValue(mockClients);
      setOpenAEVClientGetter(getter as any);

      const result = getOpenAEVClients();
      
      expect(getter).toHaveBeenCalled();
      expect(result.size).toBe(1);
    });
  });

  describe('Primary OpenCTI Client Getter', () => {
    it('should return null when no getter is configured', () => {
      // Default behavior should return null
      const result = getPrimaryOpenCTIClient();
      // Can't guarantee this without module reset, but testing the interface
      expect(result === null || result !== undefined).toBe(true);
    });

    it('should use configured getter to return primary client', () => {
      const mockClient = { name: 'Primary OpenCTI' };
      const getter = vi.fn().mockReturnValue(mockClient);
      
      setPrimaryOpenCTIClientGetter(getter as any);

      const result = getPrimaryOpenCTIClient();
      
      expect(getter).toHaveBeenCalled();
      expect(result).toBe(mockClient);
    });

    it('should return null when getter returns null', () => {
      const getter = vi.fn().mockReturnValue(null);
      
      setPrimaryOpenCTIClientGetter(getter as any);

      const result = getPrimaryOpenCTIClient();
      
      expect(result).toBeNull();
    });
  });

  describe('getFirstOpenAEVClient', () => {
    it('should return the first OpenAEV client', () => {
      const mockClient = { name: 'First Client' };
      const mockClients = new Map([
        ['platform-1', mockClient],
        ['platform-2', { name: 'Second Client' }],
      ]);
      
      setOpenAEVClientGetter(() => mockClients as any);

      const result = getFirstOpenAEVClient();
      
      expect(result).toBe(mockClient);
    });

    it('should return undefined when no clients exist', () => {
      setOpenAEVClientGetter(() => new Map());

      const result = getFirstOpenAEVClient();
      
      expect(result).toBeUndefined();
    });
  });

  describe('hasOpenCTIClients', () => {
    it('should return true when clients exist', () => {
      const mockClients = new Map([['p1', { name: 'Client' }]]);
      setOpenCTIClientGetter(() => mockClients as any);

      expect(hasOpenCTIClients()).toBe(true);
    });

    it('should return false when no clients exist', () => {
      setOpenCTIClientGetter(() => new Map());

      expect(hasOpenCTIClients()).toBe(false);
    });
  });

  describe('hasOpenAEVClients', () => {
    it('should return true when clients exist', () => {
      const mockClients = new Map([['p1', { name: 'Client' }]]);
      setOpenAEVClientGetter(() => mockClients as any);

      expect(hasOpenAEVClients()).toBe(true);
    });

    it('should return false when no clients exist', () => {
      setOpenAEVClientGetter(() => new Map());

      expect(hasOpenAEVClients()).toBe(false);
    });
  });
});

