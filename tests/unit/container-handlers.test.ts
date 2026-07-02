/**
 * Tests for Container Message Handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateContainer } from '../../src/background/handlers/container-handlers';

vi.mock('../../src/shared/detection/patterns', () => ({
  refangIndicator: vi.fn((v: string) => v),
}));

vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    background: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

const makeClient = (overrides = {}) => ({
  createDraftWorkspace: vi.fn().mockResolvedValue({ id: 'draft-ws-1', name: 'Draft - Test Report' }),
  createEntity: vi.fn().mockResolvedValue({ id: 'entity-1', entity_type: 'Malware' }),
  createStixCoreRelationship: vi.fn().mockResolvedValue({ id: 'rel-1' }),
  createExternalReference: vi.fn().mockResolvedValue({ id: 'extref-1' }),
  addExternalReferenceToEntity: vi.fn().mockResolvedValue(undefined),
  uploadFileToEntity: vi.fn().mockResolvedValue(undefined),
  createContainer: vi.fn().mockResolvedValue({ id: 'container-1', entity_type: 'Report', name: 'Test Report' }),
  ...overrides,
});

const makePayload = (overrides = {}): any => ({
  type: 'Report',
  name: 'Test Report',
  description: '',
  labels: [],
  markings: [],
  entities: [],
  entitiesToCreate: [],
  platformId: 'platform-1',
  ...overrides,
});

describe('handleCreateContainer', () => {
  const mockSendResponse = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when no clients configured', async () => {
    await handleCreateContainer(makePayload(), mockSendResponse, new Map());
    expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'Not configured' });
  });

  it('should create container successfully with no entities to create', async () => {
    const client = makeClient();
    const clients = new Map([['platform-1', client as any]]);

    await handleCreateContainer(makePayload(), mockSendResponse, clients);

    expect(client.createContainer).toHaveBeenCalledOnce();
    expect(mockSendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 'container-1', failedEntities: undefined }),
    }));
  });

  it('should create all entities and attach them to the container', async () => {
    const client = makeClient({
      createEntity: vi.fn()
        .mockResolvedValueOnce({ id: 'entity-1', entity_type: 'IPv4-Addr' })
        .mockResolvedValueOnce({ id: 'entity-2', entity_type: 'Domain-Name' }),
    });
    const clients = new Map([['platform-1', client as any]]);
    const payload = makePayload({
      entitiesToCreate: [
        { type: 'IPv4-Addr', value: '1.2.3.4' },
        { type: 'Domain-Name', value: 'evil.com' },
      ],
    });

    await handleCreateContainer(payload, mockSendResponse, clients);

    expect(client.createEntity).toHaveBeenCalledTimes(2);
    expect(client.createContainer).toHaveBeenCalledWith(expect.objectContaining({
      objects: expect.arrayContaining(['entity-1', 'entity-2']),
    }));
    expect(mockSendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ failedEntities: undefined }),
    }));
  });

  it('should continue and report failed entities when some entity creation fails', async () => {
    const client = makeClient({
      createEntity: vi.fn()
        .mockResolvedValueOnce({ id: 'entity-1', entity_type: 'IPv4-Addr' })
        .mockRejectedValueOnce(new Error('Forbidden by marking')),
    });
    const clients = new Map([['platform-1', client as any]]);
    const payload = makePayload({
      entitiesToCreate: [
        { type: 'IPv4-Addr', value: '1.2.3.4' },
        { type: 'Domain-Name', value: 'evil.com' },
      ],
    });

    await handleCreateContainer(payload, mockSendResponse, clients);

    // Container still created with the one that succeeded
    expect(client.createContainer).toHaveBeenCalledWith(expect.objectContaining({
      objects: expect.arrayContaining(['entity-1']),
    }));
    expect(mockSendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        failedEntities: [{ type: 'Domain-Name', value: 'evil.com', error: 'Forbidden by marking' }],
      }),
    }));
  });

  it('should use stable indices for relationships when a preceding entity creation fails', async () => {
    // entity at index 0 fails, entity at index 1 succeeds.
    // a relationship between index 1 (entitiesToCreate) and index 0 (existing entity)
    // must still resolve correctly — index 0 maps to the pre-existing entity.
    const client = makeClient({
      createEntity: vi.fn()
        .mockRejectedValueOnce(new Error('API error'))        // entitiesToCreate[0] fails
        .mockResolvedValueOnce({ id: 'entity-2', entity_type: 'Domain-Name' }), // entitiesToCreate[1] succeeds
    });
    const clients = new Map([['platform-1', client as any]]);
    const payload = makePayload({
      entities: ['existing-1'],
      entitiesToCreate: [
        { type: 'IPv4-Addr', value: '1.2.3.4' },   // index 1 in combined array (after existing-1)
        { type: 'Domain-Name', value: 'evil.com' }, // index 2 in combined array
      ],
      relationshipsToCreate: [
        // relationship between existing-1 (index 0) and Domain-Name (index 2)
        { fromEntityIndex: 0, toEntityIndex: 2, relationship_type: 'related-to' },
      ],
    });

    await handleCreateContainer(payload, mockSendResponse, clients);

    expect(client.createStixCoreRelationship).toHaveBeenCalledWith(expect.objectContaining({
      fromId: 'existing-1',
      toId: 'entity-2',
    }), undefined);
    expect(mockSendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('should report all entities as failed but still create the container', async () => {
    const client = makeClient({
      createEntity: vi.fn().mockRejectedValue(new Error('API error')),
    });
    const clients = new Map([['platform-1', client as any]]);
    const payload = makePayload({
      entitiesToCreate: [
        { type: 'IPv4-Addr', value: '1.2.3.4' },
        { type: 'Domain-Name', value: 'evil.com' },
      ],
    });

    await handleCreateContainer(payload, mockSendResponse, clients);

    expect(client.createContainer).toHaveBeenCalledOnce();
    expect(mockSendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        failedEntities: [
          { type: 'IPv4-Addr', value: '1.2.3.4', error: 'API error' },
          { type: 'Domain-Name', value: 'evil.com', error: 'API error' },
        ],
      }),
    }));
  });

  it('should return error when container creation itself fails', async () => {
    const client = makeClient({
      createContainer: vi.fn().mockRejectedValue(new Error('Unauthorized')),
    });
    const clients = new Map([['platform-1', client as any]]);

    await handleCreateContainer(makePayload(), mockSendResponse, clients);

    expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
  });

  describe('draft mode', () => {
    it('should pre-create draft workspace before entities and thread draftId to all creation calls', async () => {
      const client = makeClient({
        createEntity: vi.fn().mockResolvedValue({ id: 'entity-1', entity_type: 'IPv4-Addr' }),
      });
      const clients = new Map([['platform-1', client as any]]);
      const payload = makePayload({
        createAsDraft: true,
        entitiesToCreate: [{ type: 'IPv4-Addr', value: '1.2.3.4' }],
        pageUrl: 'https://example.com',
        pageTitle: 'Article',
        relationshipsToCreate: [
          { fromEntityIndex: 0, toEntityIndex: 0, relationship_type: 'related-to' },
        ],
      });

      // Capture call order
      const callOrder: string[] = [];
      client.createDraftWorkspace.mockImplementation(async () => { callOrder.push('createDraftWorkspace'); return { id: 'draft-ws-1' }; });
      client.createEntity.mockImplementation(async () => { callOrder.push('createEntity'); return { id: 'entity-1', entity_type: 'IPv4-Addr' }; });
      client.createExternalReference.mockImplementation(async () => { callOrder.push('createExternalReference'); return { id: 'extref-1' }; });

      await handleCreateContainer(payload, mockSendResponse, clients);

      // Workspace must be first
      expect(callOrder[0]).toBe('createDraftWorkspace');

      // draftId threaded into every subsequent call
      expect(client.createEntity).toHaveBeenCalledWith(expect.anything(), 'draft-ws-1');
      expect(client.createExternalReference).toHaveBeenCalledWith(expect.anything(), 'draft-ws-1');
      expect(client.createContainer).toHaveBeenCalledWith(expect.objectContaining({
        createAsDraft: true,
        draftId: 'draft-ws-1',
      }));
      expect(mockSendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should NOT call createDraftWorkspace when createAsDraft is false', async () => {
      const client = makeClient();
      const clients = new Map([['platform-1', client as any]]);

      await handleCreateContainer(makePayload({ createAsDraft: false }), mockSendResponse, clients);

      expect(client.createDraftWorkspace).not.toHaveBeenCalled();
      expect(client.createContainer).toHaveBeenCalledWith(expect.objectContaining({ draftId: undefined }));
    });
  });
});
