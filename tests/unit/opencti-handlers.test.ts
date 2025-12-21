/**
 * Tests for OpenCTI Message Handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleGetEntityDetails,
  handleSearchEntities,
  handleCreateEntity,
  handleCreateObservablesBulk,
  handleFetchLabels,
  handleSearchLabels,
  handleCreateLabel,
  handleFetchMarkings,
  handleFetchVocabulary,
  handleFetchIdentities,
  handleSearchIdentities,
  handleCreateIdentity,
  handleFetchEntityContainers,
  handleFindContainersByUrl,
  handleCreateWorkbench,
  handleGetLabelsAndMarkings,
} from '../../src/background/handlers/opencti-handlers';

// Mock the client manager
vi.mock('../../src/background/services/client-manager', () => ({
  getOpenCTIClients: vi.fn(),
  getPrimaryOpenCTIClient: vi.fn(),
  hasOpenCTIClients: vi.fn(),
}));

// Mock platform-utils helpers
vi.mock('../../src/background/handlers/platform-utils', () => ({
  checkClientsConfigured: vi.fn((clients, sendResponse) => {
    if (clients.size === 0) {
      sendResponse({ success: false, error: 'Not configured' });
      return false;
    }
    return true;
  }),
  getClientOrError: vi.fn((clients, platformId, sendResponse) => {
    const client = clients.get(platformId);
    if (!client) {
      sendResponse({ success: false, error: 'Platform not found' });
      return null;
    }
    return client;
  }),
  getTargetClient: vi.fn((clients, platformId) => {
    if (platformId && clients.has(platformId)) {
      return { client: clients.get(platformId), platformId };
    }
    const first = clients.entries().next().value;
    return first ? { client: first[1], platformId: first[0] } : { client: null, platformId: null };
  }),
  getTargetClientOrError: vi.fn((clients, platformId, sendResponse) => {
    const { client, platformId: pId } = (vi.mocked(require('../../src/background/handlers/platform-utils').getTargetClient))(clients, platformId);
    if (!client) {
      sendResponse({ success: false, error: 'Platform not found' });
      return null;
    }
    return { client, platformId: pId };
  }),
  fetchFromAllPlatforms: vi.fn().mockResolvedValue({ results: [], hasErrors: false }),
  searchAcrossPlatforms: vi.fn().mockResolvedValue([]),
  handleError: vi.fn((error, sendResponse, message) => {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : message,
    });
  }),
}));

// Mock storage
vi.mock('../../src/shared/utils/storage', () => ({
  addEntityToOCTICache: vi.fn().mockResolvedValue(undefined),
}));

// Mock detection patterns
vi.mock('../../src/shared/detection/patterns', () => ({
  refangIndicator: vi.fn((v) => v),
}));

// Mock entity utils
vi.mock('../../src/shared/utils/entity', () => ({
  isObservableType: vi.fn((type) => ['IPv4-Addr', 'Domain-Name', 'Url'].includes(type)),
}));

import {
  getOpenCTIClients,
  getPrimaryOpenCTIClient,
  hasOpenCTIClients,
} from '../../src/background/services/client-manager';
import {
  checkClientsConfigured,
  getClientOrError,
  getTargetClient,
  getTargetClientOrError,
  fetchFromAllPlatforms,
  searchAcrossPlatforms,
} from '../../src/background/handlers/platform-utils';
import { addEntityToOCTICache } from '../../src/shared/utils/storage';

describe('OpenCTI Handlers', () => {
  const mockSendResponse = vi.fn();
  
  // Create a mock OpenCTI client
  const createMockClient = (overrides = {}) => ({
    getSDOById: vi.fn().mockResolvedValue(null),
    getObservableById: vi.fn().mockResolvedValue(null),
    globalSearch: vi.fn().mockResolvedValue([]),
    createEntity: vi.fn().mockResolvedValue({ id: 'new-id', name: 'Test' }),
    fetchLabels: vi.fn().mockResolvedValue([]),
    searchLabels: vi.fn().mockResolvedValue([]),
    createLabel: vi.fn().mockResolvedValue({ id: 'label-id', value: 'test' }),
    fetchMarkingDefinitions: vi.fn().mockResolvedValue([]),
    fetchVocabulary: vi.fn().mockResolvedValue([]),
    fetchIdentities: vi.fn().mockResolvedValue([]),
    searchIdentities: vi.fn().mockResolvedValue([]),
    createOrganization: vi.fn().mockResolvedValue({ id: 'org-id', name: 'Test Org' }),
    createIndividual: vi.fn().mockResolvedValue({ id: 'ind-id', name: 'Test Person' }),
    fetchContainersForEntity: vi.fn().mockResolvedValue([]),
    findContainersByExternalReferenceUrl: vi.fn().mockResolvedValue([]),
    createInvestigation: vi.fn().mockResolvedValue({ id: 'inv-id' }),
    getInvestigationUrl: vi.fn().mockReturnValue('https://opencti.test/inv-id'),
    ...overrides,
  });
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset platform-utils mocks to their default behavior
    vi.mocked(checkClientsConfigured).mockImplementation((clients, sendResponse) => {
      if (clients.size === 0) {
        sendResponse({ success: false, error: 'Not configured' });
        return false;
      }
      return true;
    });
    vi.mocked(getTargetClient).mockImplementation((clients, platformId) => {
      if (platformId && clients.has(platformId)) {
        return { client: clients.get(platformId), platformId };
      }
      const entries = Array.from(clients.entries());
      const first = entries[0];
      return first ? { client: first[1], platformId: first[0] } : { client: null, platformId: null };
    });
    vi.mocked(getTargetClientOrError).mockImplementation((clients, platformId, sendResponse) => {
      const result = vi.mocked(getTargetClient)(clients, platformId);
      if (!result.client) {
        sendResponse({ success: false, error: 'Platform not found' });
        return null;
      }
      return result;
    });
  });

  describe('handleGetEntityDetails', () => {
    it('should return error when not configured', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(false);

      await handleGetEntityDetails({ id: '1', entityType: 'Malware' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Not configured'
      });
    });

    it('should get SDO entity from specific platform', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(true);
      const mockEntity = { id: '1', name: 'Emotet', entity_type: 'Malware' };
      const mockClient = createMockClient({
        getSDOById: vi.fn().mockResolvedValue(mockEntity),
      });
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map([['test-platform', mockClient]]));

      await handleGetEntityDetails({
        id: '1',
        entityType: 'Malware',
        platformId: 'test-platform'
      }, mockSendResponse);

      expect(mockClient.getSDOById).toHaveBeenCalledWith('1');
      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.platformId).toBe('test-platform');
    });

    it('should get observable entity', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(true);
      const mockEntity = { id: '1', value: '192.168.1.1', entity_type: 'IPv4-Addr' };
      const mockClient = createMockClient({
        getObservableById: vi.fn().mockResolvedValue(mockEntity),
      });
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map([['test', mockClient]]));

      await handleGetEntityDetails({
        id: '1',
        entityType: 'IPv4-Addr',
        platformId: 'test'
      }, mockSendResponse);

      expect(mockClient.getObservableById).toHaveBeenCalledWith('1');
    });

    it('should search all platforms when no platformId', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(true);
      const mockEntity = { id: '1', name: 'Emotet' };
      const mockClient1 = createMockClient({
        getSDOById: vi.fn().mockResolvedValue(null),
      });
      const mockClient2 = createMockClient({
        getSDOById: vi.fn().mockResolvedValue(mockEntity),
      });
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map([
        ['platform1', mockClient1],
        ['platform2', mockClient2],
      ]));

      await handleGetEntityDetails({ id: '1', entityType: 'Malware' }, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.platformId).toBe('platform2');
    });

    it('should return error when entity not found in any platform', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(true);
      const mockClient = createMockClient({
        getSDOById: vi.fn().mockResolvedValue(null),
      });
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map([['test', mockClient]]));

      await handleGetEntityDetails({ id: 'unknown', entityType: 'Malware' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Entity not found in any platform'
      });
    });
  });

  describe('handleSearchEntities', () => {
    it('should return error when not configured', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(false);

      await handleSearchEntities({ searchTerm: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Not configured'
      });
    });

    it('should search entities across platforms', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(true);
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map([['test', createMockClient()]]));
      vi.mocked(searchAcrossPlatforms).mockResolvedValue([
        { id: '1', name: 'Result 1', platformId: 'test' },
        { id: '2', name: 'Result 2', platformId: 'test' },
      ]);

      await handleSearchEntities({ searchTerm: 'malware' }, mockSendResponse);

      expect(searchAcrossPlatforms).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });
  });

  describe('handleCreateEntity', () => {
    it('should return error when not configured', async () => {
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map());
      vi.mocked(getPrimaryOpenCTIClient).mockReturnValue(undefined);

      await handleCreateEntity({ type: 'Malware', value: 'Test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'No OpenCTI platform configured'
      });
    });

    it('should create entity successfully', async () => {
      const createdEntity = { id: 'new-id', name: 'Test Malware', entity_type: 'Malware' };
      const mockClient = createMockClient({
        createEntity: vi.fn().mockResolvedValue(createdEntity),
      });
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map([['test', mockClient]]));

      await handleCreateEntity({ type: 'Malware', value: 'Test Malware' }, mockSendResponse);

      expect(mockClient.createEntity).toHaveBeenCalledWith({
        type: 'Malware',
        value: 'Test Malware',
        name: 'Test Malware',
      });
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: createdEntity
      });
    });
  });

  describe('handleCreateObservablesBulk', () => {
    it('should return error when not configured', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(false);

      await handleCreateObservablesBulk({ entities: [] }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Not configured'
      });
    });

    it('should create multiple observables', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(true);
      const mockClient = createMockClient({
        createEntity: vi.fn()
          .mockResolvedValueOnce({ id: '1', entity_type: 'IPv4-Addr' })
          .mockResolvedValueOnce({ id: '2', entity_type: 'Domain-Name' }),
      });
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map([['test', mockClient]]));

      await handleCreateObservablesBulk({
        entities: [
          { type: 'IPv4-Addr', value: '192.168.1.1' },
          { type: 'Domain-Name', value: 'example.com' },
        ]
      }, mockSendResponse);

      expect(mockClient.createEntity).toHaveBeenCalledTimes(2);
      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
    });

    it('should cache created SDOs', async () => {
      vi.mocked(hasOpenCTIClients).mockReturnValue(true);
      const createdEntity = { id: '1', name: 'APT29', entity_type: 'Intrusion-Set' };
      const mockClient = createMockClient({
        createEntity: vi.fn().mockResolvedValue(createdEntity),
      });
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map([['test', mockClient]]));

      await handleCreateObservablesBulk({
        entities: [{ type: 'Intrusion-Set', name: 'APT29' }]
      }, mockSendResponse);

      expect(addEntityToOCTICache).toHaveBeenCalled();
    });
  });

  describe('handleFetchLabels', () => {
    it('should fetch labels from specific platform', async () => {
      const mockLabels = [{ id: '1', value: 'malware' }];
      const mockClient = createMockClient({
        fetchLabels: vi.fn().mockResolvedValue(mockLabels),
      });
      const clients = new Map([['test', mockClient]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(getClientOrError).mockReturnValue(mockClient);

      await handleFetchLabels({ platformId: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: [{ id: '1', value: 'malware', platformId: 'test' }]
      });
    });

    it('should fetch labels from all platforms', async () => {
      const clients = new Map([['test', createMockClient()]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(fetchFromAllPlatforms).mockResolvedValue({
        results: [{ id: '1', value: 'test' }],
        hasErrors: false,
      });

      await handleFetchLabels({}, mockSendResponse);

      expect(fetchFromAllPlatforms).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: [{ id: '1', value: 'test' }]
      });
    });
  });

  describe('handleSearchLabels', () => {
    it('should search labels with pagination', async () => {
      const mockLabels = [{ id: '1', value: 'apt' }];
      const mockClient = createMockClient({
        searchLabels: vi.fn().mockResolvedValue(mockLabels),
      });
      const clients = new Map([['test', mockClient]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(getTargetClientOrError).mockReturnValue({ client: mockClient, platformId: 'test' });

      await handleSearchLabels({ search: 'apt', first: 10 }, mockSendResponse);

      expect(mockClient.searchLabels).toHaveBeenCalledWith('apt', 10);
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: [{ id: '1', value: 'apt', platformId: 'test' }]
      });
    });
  });

  describe('handleCreateLabel', () => {
    it('should return error when value is missing', async () => {
      const clients = new Map([['test', createMockClient()]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);

      await handleCreateLabel({ color: '#ff0000' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Label value is required'
      });
    });

    it('should create label successfully', async () => {
      const mockLabel = { id: 'new-label', value: 'critical', color: '#ff0000' };
      const mockClient = createMockClient({
        createLabel: vi.fn().mockResolvedValue(mockLabel),
      });
      const clients = new Map([['test', mockClient]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(getTargetClientOrError).mockReturnValue({ client: mockClient, platformId: 'test' });

      await handleCreateLabel({ value: 'critical', color: '#ff0000' }, mockSendResponse);

      expect(mockClient.createLabel).toHaveBeenCalledWith('critical', '#ff0000');
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { ...mockLabel, platformId: 'test' }
      });
    });
  });

  describe('handleFetchMarkings', () => {
    it('should fetch markings', async () => {
      const mockMarkings = [{ id: '1', definition: 'TLP:RED' }];
      const mockClient = createMockClient({
        fetchMarkingDefinitions: vi.fn().mockResolvedValue(mockMarkings),
      });
      const clients = new Map([['test', mockClient]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(getClientOrError).mockReturnValue(mockClient);

      await handleFetchMarkings({ platformId: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: [{ id: '1', definition: 'TLP:RED', platformId: 'test' }]
      });
    });
  });

  describe('handleFetchVocabulary', () => {
    it('should fetch vocabulary by category', async () => {
      const mockVocab = ['value1', 'value2'];
      const mockClient = createMockClient({
        fetchVocabulary: vi.fn().mockResolvedValue(mockVocab),
      });
      const clients = new Map([['test', mockClient]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);

      await handleFetchVocabulary({ category: 'report_types_ov' }, mockSendResponse);

      expect(mockClient.fetchVocabulary).toHaveBeenCalledWith('report_types_ov');
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockVocab
      });
    });
  });

  describe('handleCreateIdentity', () => {
    it('should return error when name is missing', async () => {
      const clients = new Map([['test', createMockClient()]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);

      await handleCreateIdentity({ entityType: 'Organization' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Identity name is required'
      });
    });

    it('should return error for invalid entity type', async () => {
      const clients = new Map([['test', createMockClient()]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);

      await handleCreateIdentity({ name: 'Test', entityType: 'Invalid' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid entity type. Must be Organization or Individual'
      });
    });

    it('should create Organization', async () => {
      const mockOrg = { id: 'org-id', name: 'Test Org', entity_type: 'Organization' };
      const mockClient = createMockClient({
        createOrganization: vi.fn().mockResolvedValue(mockOrg),
      });
      const clients = new Map([['test', mockClient]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(getTargetClientOrError).mockReturnValue({ client: mockClient, platformId: 'test' });

      await handleCreateIdentity({ name: 'Test Org', entityType: 'Organization' }, mockSendResponse);

      expect(mockClient.createOrganization).toHaveBeenCalledWith('Test Org');
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { ...mockOrg, platformId: 'test' }
      });
    });

    it('should create Individual', async () => {
      const mockPerson = { id: 'ind-id', name: 'John Doe', entity_type: 'Individual' };
      const mockClient = createMockClient({
        createIndividual: vi.fn().mockResolvedValue(mockPerson),
      });
      const clients = new Map([['test', mockClient]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(getTargetClientOrError).mockReturnValue({ client: mockClient, platformId: 'test' });

      await handleCreateIdentity({ name: 'John Doe', entityType: 'Individual' }, mockSendResponse);

      expect(mockClient.createIndividual).toHaveBeenCalledWith('John Doe');
    });
  });

  describe('handleFetchEntityContainers', () => {
    it('should return error when entityId is missing', async () => {
      const clients = new Map([['test', createMockClient()]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);

      await handleFetchEntityContainers({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'No entityId provided'
      });
    });

    it('should fetch containers for entity', async () => {
      const mockContainers = [{ id: 'report-1', name: 'Report' }];
      const clients = new Map([['test', createMockClient()]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(searchAcrossPlatforms).mockResolvedValue(mockContainers);

      await handleFetchEntityContainers({ entityId: 'entity-1' }, mockSendResponse);

      expect(searchAcrossPlatforms).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockContainers
      });
    });
  });

  describe('handleFindContainersByUrl', () => {
    it('should return empty array when not configured', async () => {
      vi.mocked(getOpenCTIClients).mockReturnValue(new Map());

      await handleFindContainersByUrl({ url: 'https://example.com' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should find containers by URL', async () => {
      const mockContainers = [{ id: 'report-1', name: 'Related Report' }];
      const clients = new Map([['test', createMockClient()]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(searchAcrossPlatforms).mockResolvedValue(mockContainers);

      await handleFindContainersByUrl({ url: 'https://example.com/report' }, mockSendResponse);

      expect(searchAcrossPlatforms).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockContainers
      });
    });
  });

  describe('handleCreateWorkbench', () => {
    it('should create investigation with URL', async () => {
      const mockInvestigation = { id: 'inv-123' };
      const mockClient = createMockClient({
        createInvestigation: vi.fn().mockResolvedValue(mockInvestigation),
        getInvestigationUrl: vi.fn().mockReturnValue('https://opencti.test/inv-123'),
      });
      const clients = new Map([['test', mockClient]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(getTargetClientOrError).mockReturnValue({ client: mockClient, platformId: 'test' });

      await handleCreateWorkbench({
        name: 'Test Investigation',
        entityIds: ['entity-1', 'entity-2'],
      }, mockSendResponse);

      expect(mockClient.createInvestigation).toHaveBeenCalledWith({
        name: 'Test Investigation',
        description: expect.stringContaining('2 entities'),
        investigated_entities_ids: ['entity-1', 'entity-2'],
      });
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          ...mockInvestigation,
          url: 'https://opencti.test/inv-123',
          platformId: 'test',
        }
      });
    });
  });

  describe('handleGetLabelsAndMarkings', () => {
    it('should fetch both labels and markings', async () => {
      const mockLabels = [{ id: 'l1', value: 'test' }];
      const mockMarkings = [{ id: 'm1', definition: 'TLP:GREEN' }];
      const clients = new Map([['test', createMockClient()]]);
      vi.mocked(getOpenCTIClients).mockReturnValue(clients);
      vi.mocked(fetchFromAllPlatforms)
        .mockResolvedValueOnce({ results: mockLabels, hasErrors: false })
        .mockResolvedValueOnce({ results: mockMarkings, hasErrors: false });

      await handleGetLabelsAndMarkings({}, mockSendResponse);

      expect(fetchFromAllPlatforms).toHaveBeenCalledTimes(2);
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          labels: mockLabels,
          markings: mockMarkings,
        }
      });
    });
  });
});

