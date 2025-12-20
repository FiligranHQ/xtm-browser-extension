/**
 * Unit Tests for Entity Handlers
 * 
 * Tests entity message handlers for both OpenCTI and OpenAEV platforms.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleGetEntityDetails,
  type EntityHandlerDependencies,
  type GetEntityDetailsPayload,
} from '../../src/background/handlers/entity-handlers';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock OpenCTI Client
const createMockOpenCTIClient = (entities: Record<string, unknown> = {}) => ({
  getSDOById: vi.fn().mockImplementation((id: string) => {
    return entities[id] || null;
  }),
  getObservableById: vi.fn().mockImplementation((id: string) => {
    return entities[id] || null;
  }),
  getPlatformInfo: vi.fn().mockReturnValue({ name: 'Test OpenCTI', url: 'https://opencti.example.com' }),
});

// Mock OpenAEV Client
const createMockOpenAEVClient = (entities: Record<string, unknown> = {}) => ({
  getEntityById: vi.fn().mockImplementation((id: string) => {
    return entities[id] || null;
  }),
  getPlatformInfo: vi.fn().mockReturnValue({ name: 'Test OpenAEV', url: 'https://openaev.example.com' }),
  ensureTagsCached: vi.fn().mockResolvedValue(undefined),
  ensureKillChainPhasesCached: vi.fn().mockResolvedValue(undefined),
  ensureAttackPatternsCached: vi.fn().mockResolvedValue(undefined),
  resolveTagIds: vi.fn().mockImplementation((ids: string[]) => ids.map(id => ({ id, label: `Tag-${id}` }))),
  resolveKillChainPhaseIds: vi.fn().mockImplementation((ids: string[]) => ids.map(id => ({ id, name: `Phase-${id}` }))),
  resolveAttackPatternId: vi.fn().mockImplementation((id: string) => ({ id, name: `Pattern-${id}` })),
});

// ============================================================================
// handleGetEntityDetails Tests
// ============================================================================

describe('handleGetEntityDetails', () => {
  let sendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendResponse = vi.fn();
  });

  describe('OpenCTI platform', () => {
    it('should return error when no OpenCTI clients are configured', async () => {
      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => new Map(),
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'test-id',
        entityType: 'Malware',
        platformType: 'opencti',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'OpenCTI not configured',
        })
      );
    });

    it('should return error when specific platform is not found', async () => {
      const mockClient = createMockOpenCTIClient();
      const clients = new Map([['platform-1', mockClient as any]]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => clients,
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'test-id',
        entityType: 'Malware',
        platformId: 'non-existent-platform',
        platformType: 'opencti',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Platform not found',
        })
      );
    });

    it('should fetch SDO entity from specific platform', async () => {
      const testEntity = { id: 'malware-123', name: 'Test Malware', type: 'Malware' };
      const mockClient = createMockOpenCTIClient({ 'malware-123': testEntity });
      const clients = new Map([['platform-1', mockClient as any]]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => clients,
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'malware-123',
        entityType: 'Malware',
        platformId: 'platform-1',
        platformType: 'opencti',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(mockClient.getSDOById).toHaveBeenCalledWith('malware-123');
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'malware-123',
            name: 'Test Malware',
            platformId: 'platform-1',
            platformType: 'opencti',
          }),
        })
      );
    });

    it('should fetch observable entity correctly', async () => {
      const testEntity = { id: 'ipv4-123', value: '192.168.1.1', type: 'IPv4-Addr' };
      const mockClient = createMockOpenCTIClient({ 'ipv4-123': testEntity });
      const clients = new Map([['platform-1', mockClient as any]]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => clients,
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'ipv4-123',
        entityType: 'IPv4-Addr',
        platformId: 'platform-1',
        platformType: 'opencti',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(mockClient.getObservableById).toHaveBeenCalledWith('ipv4-123');
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should search all platforms when no specific platform is provided', async () => {
      const testEntity = { id: 'campaign-456', name: 'Test Campaign', type: 'Campaign' };
      const mockClient1 = createMockOpenCTIClient(); // No entity here
      const mockClient2 = createMockOpenCTIClient({ 'campaign-456': testEntity }); // Entity here
      
      const clients = new Map([
        ['platform-1', mockClient1 as any],
        ['platform-2', mockClient2 as any],
      ]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => clients,
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'campaign-456',
        entityType: 'Campaign',
        platformType: 'opencti',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'campaign-456',
            platformType: 'opencti',
          }),
        })
      );
    });

    it('should return error when entity not found in any platform', async () => {
      const mockClient1 = createMockOpenCTIClient();
      const mockClient2 = createMockOpenCTIClient();
      
      const clients = new Map([
        ['platform-1', mockClient1 as any],
        ['platform-2', mockClient2 as any],
      ]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => clients,
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'non-existent',
        entityType: 'Malware',
        platformType: 'opencti',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Entity not found in any OpenCTI platform',
        })
      );
    });
  });

  describe('OpenAEV platform', () => {
    it('should return error when platformId is not provided', async () => {
      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => new Map(),
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'test-id',
        entityType: 'Asset',
        platformType: 'openaev',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'platformId is required for OpenAEV',
        })
      );
    });

    it('should return error when OpenAEV platform is not found', async () => {
      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => new Map(),
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'test-id',
        entityType: 'Asset',
        platformId: 'non-existent',
        platformType: 'openaev',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'OpenAEV platform not found',
        })
      );
    });

    it('should fetch OpenAEV entity correctly', async () => {
      const testEntity = { 
        asset_id: 'asset-123', 
        asset_name: 'Server-01',
        asset_tags: ['tag-1', 'tag-2'],
      };
      const mockClient = createMockOpenAEVClient({ 'asset-123': testEntity });
      const clients = new Map([['platform-1', mockClient as any]]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => new Map(),
        getOpenAEVClients: () => clients,
      };

      const payload: GetEntityDetailsPayload = {
        id: 'asset-123',
        entityType: 'Asset',
        platformId: 'platform-1',
        platformType: 'openaev',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(mockClient.ensureTagsCached).toHaveBeenCalled();
      expect(mockClient.getEntityById).toHaveBeenCalledWith('asset-123', 'Asset');
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            asset_id: 'asset-123',
            platformId: 'platform-1',
            platformType: 'openaev',
          }),
        })
      );
    });

    it('should resolve attack pattern details for AttackPattern type', async () => {
      const testEntity = {
        attack_pattern_id: 'ap-123',
        attack_pattern_name: 'Phishing',
        attack_pattern_kill_chain_phases: ['phase-1', 'phase-2'],
        attack_pattern_parent: 'parent-ap',
      };
      const mockClient = createMockOpenAEVClient({ 'ap-123': testEntity });
      const clients = new Map([['platform-1', mockClient as any]]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => new Map(),
        getOpenAEVClients: () => clients,
      };

      const payload: GetEntityDetailsPayload = {
        id: 'ap-123',
        entityType: 'AttackPattern',
        platformId: 'platform-1',
        platformType: 'openaev',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(mockClient.ensureKillChainPhasesCached).toHaveBeenCalled();
      expect(mockClient.ensureAttackPatternsCached).toHaveBeenCalled();
      expect(mockClient.resolveKillChainPhaseIds).toHaveBeenCalledWith(['phase-1', 'phase-2']);
      expect(mockClient.resolveAttackPatternId).toHaveBeenCalledWith('parent-ap');
    });

    it('should return error when OpenAEV entity not found', async () => {
      const mockClient = createMockOpenAEVClient();
      const clients = new Map([['platform-1', mockClient as any]]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => new Map(),
        getOpenAEVClients: () => clients,
      };

      const payload: GetEntityDetailsPayload = {
        id: 'non-existent',
        entityType: 'Asset',
        platformId: 'platform-1',
        platformType: 'openaev',
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Entity not found',
        })
      );
    });
  });

  describe('Unsupported platform', () => {
    it('should return error for unsupported platform type', async () => {
      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => new Map(),
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'test-id',
        entityType: 'Entity',
        platformId: 'platform-1',
        platformType: 'unsupported' as any,
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Unsupported platform type'),
        })
      );
    });
  });

  describe('Default platform type', () => {
    it('should default to opencti when platformType is not provided', async () => {
      const testEntity = { id: 'test-123', name: 'Test Entity', type: 'Malware' };
      const mockClient = createMockOpenCTIClient({ 'test-123': testEntity });
      const clients = new Map([['platform-1', mockClient as any]]);

      const deps: EntityHandlerDependencies = {
        getOpenCTIClients: () => clients,
        getOpenAEVClients: () => new Map(),
      };

      const payload: GetEntityDetailsPayload = {
        id: 'test-123',
        entityType: 'Malware',
        platformId: 'platform-1',
        // platformType not provided - should default to 'opencti'
      };

      await handleGetEntityDetails(payload, sendResponse, deps);

      expect(mockClient.getSDOById).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            platformType: 'opencti',
          }),
        })
      );
    });
  });
});

