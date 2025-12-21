/**
 * Tests for OpenAEV Message Handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleFetchKillChainPhases,
  handleFetchInjectorContracts,
  handleFetchOAEVAssets,
  handleFetchOAEVAssetGroups,
  handleFetchOAEVTeams,
  handleCreateOAEVPayload,
  handleFetchOAEVPayload,
  handleFindDnsResolutionPayload,
  handleFindInjectorContractByPayload,
  handleCreateAtomicTesting,
  handleCreateScenario,
  handleAddInjectToScenario,
  handleAddEmailInjectToScenario,
  handleSearchOAEV,
  handleGetOAEVEntityDetails,
  handleSearchAssets,
  handleFetchScenarioOverview,
  handleFetchInjectorContractsForAttackPatterns,
} from '../../src/background/handlers/openaev-handlers';

// Mock the client manager
vi.mock('../../src/background/services/client-manager', () => ({
  getOpenAEVClients: vi.fn(),
  getFirstOpenAEVClient: vi.fn(),
  hasOpenAEVClients: vi.fn(),
}));

import {
  getOpenAEVClients,
  getFirstOpenAEVClient,
  hasOpenAEVClients,
} from '../../src/background/services/client-manager';

describe('OpenAEV Handlers', () => {
  const mockSendResponse = vi.fn();
  
  // Create a mock client that can be reused
  const createMockClient = (overrides = {}) => ({
    getKillChainPhases: vi.fn().mockResolvedValue([]),
    searchInjectorContracts: vi.fn().mockResolvedValue([]),
    getAllAssets: vi.fn().mockResolvedValue([]),
    getAllAssetGroups: vi.fn().mockResolvedValue([]),
    getAllTeams: vi.fn().mockResolvedValue([]),
    createPayload: vi.fn().mockResolvedValue({ payload_id: 'test-id' }),
    createDnsResolutionPayload: vi.fn().mockResolvedValue({ payload_id: 'dns-id' }),
    getPayload: vi.fn().mockResolvedValue({ payload_id: 'test-id' }),
    findDnsResolutionPayloadByHostname: vi.fn().mockResolvedValue(null),
    findInjectorContractByPayloadId: vi.fn().mockResolvedValue(null),
    createAtomicTesting: vi.fn().mockResolvedValue({ inject_id: 'inject-id' }),
    getAtomicTestingUrl: vi.fn().mockReturnValue('https://test.com/atomic/inject-id'),
    createScenario: vi.fn().mockResolvedValue({ scenario_id: 'scenario-id' }),
    getScenarioUrl: vi.fn().mockReturnValue('https://test.com/scenario/scenario-id'),
    addInjectToScenario: vi.fn().mockResolvedValue({ inject_id: 'new-inject' }),
    fullTextSearch: vi.fn().mockResolvedValue({}),
    fullTextSearchByClass: vi.fn().mockResolvedValue({ content: [] }),
    getPlatformInfo: vi.fn().mockReturnValue({ id: 'test', name: 'Test Platform' }),
    getEntityById: vi.fn().mockResolvedValue(null),
    ensureTagsCached: vi.fn().mockResolvedValue(undefined),
    ensureKillChainPhasesCached: vi.fn().mockResolvedValue(undefined),
    ensureAttackPatternsCached: vi.fn().mockResolvedValue(undefined),
    resolveTagIds: vi.fn().mockReturnValue([]),
    resolveKillChainPhaseIds: vi.fn().mockReturnValue([]),
    resolveAttackPatternId: vi.fn().mockReturnValue(null),
    searchAssets: vi.fn().mockResolvedValue([]),
    searchAssetGroups: vi.fn().mockResolvedValue([]),
    getAttackPattern: vi.fn().mockResolvedValue(null),
    getInjectorContractsForAttackPatterns: vi.fn().mockResolvedValue(new Map()),
    ...overrides,
  });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleFetchKillChainPhases', () => {
    it('should return error when OpenAEV is not configured', async () => {
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(undefined);
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map());

      await handleFetchKillChainPhases({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'OpenAEV not configured'
      });
    });

    it('should return kill chain phases successfully', async () => {
      const mockPhases = [{ phase_id: '1', phase_name: 'Reconnaissance' }];
      const mockClient = createMockClient({
        getKillChainPhases: vi.fn().mockResolvedValue(mockPhases),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchKillChainPhases({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockPhases
      });
    });

    it('should handle errors', async () => {
      const mockClient = createMockClient({
        getKillChainPhases: vi.fn().mockRejectedValue(new Error('API Error')),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchKillChainPhases({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'API Error'
      });
    });
  });

  describe('handleFetchInjectorContracts', () => {
    it('should return error when not configured', async () => {
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(undefined);
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map());

      await handleFetchInjectorContracts({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'OpenAEV not configured'
      });
    });

    it('should return injector contracts', async () => {
      const mockContracts = [{ injector_contract_id: '1', injector_contract_name: 'Test' }];
      const mockClient = createMockClient({
        searchInjectorContracts: vi.fn().mockResolvedValue(mockContracts),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchInjectorContracts({ attackPatternId: 'ap-1' }, mockSendResponse);

      expect(mockClient.searchInjectorContracts).toHaveBeenCalledWith('ap-1');
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockContracts
      });
    });
  });

  describe('handleFetchOAEVAssets', () => {
    it('should return error when not configured', async () => {
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(undefined);
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map());

      await handleFetchOAEVAssets({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'OpenAEV not configured'
      });
    });

    it('should return assets', async () => {
      const mockAssets = [{ asset_id: '1', asset_name: 'Server 1' }];
      const mockClient = createMockClient({
        getAllAssets: vi.fn().mockResolvedValue(mockAssets),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchOAEVAssets({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockAssets
      });
    });
  });

  describe('handleFetchOAEVAssetGroups', () => {
    it('should return asset groups', async () => {
      const mockGroups = [{ asset_group_id: '1', asset_group_name: 'Production' }];
      const mockClient = createMockClient({
        getAllAssetGroups: vi.fn().mockResolvedValue(mockGroups),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchOAEVAssetGroups({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockGroups
      });
    });
  });

  describe('handleFetchOAEVTeams', () => {
    it('should return teams', async () => {
      const mockTeams = [{ team_id: '1', team_name: 'Red Team' }];
      const mockClient = createMockClient({
        getAllTeams: vi.fn().mockResolvedValue(mockTeams),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchOAEVTeams({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockTeams
      });
    });
  });

  describe('handleCreateOAEVPayload', () => {
    it('should create payload with full payload data', async () => {
      const mockPayload = { payload_id: 'created-id' };
      const mockClient = createMockClient({
        createPayload: vi.fn().mockResolvedValue(mockPayload),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleCreateOAEVPayload({
        payload: {
          payload_type: 'Command',
          payload_name: 'Test Command',
          payload_platforms: ['Linux'],
        }
      }, mockSendResponse);

      expect(mockClient.createPayload).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockPayload
      });
    });

    it('should create DNS resolution payload', async () => {
      const mockPayload = { payload_id: 'dns-id' };
      const mockClient = createMockClient({
        createDnsResolutionPayload: vi.fn().mockResolvedValue(mockPayload),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleCreateOAEVPayload({
        hostname: 'test.example.com',
        name: 'DNS Test',
        platforms: ['Linux'],
      }, mockSendResponse);

      expect(mockClient.createDnsResolutionPayload).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockPayload
      });
    });

    it('should return error for invalid payload data', async () => {
      const mockClient = createMockClient();
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleCreateOAEVPayload({}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid payload data: missing required fields'
      });
    });
  });

  describe('handleFetchOAEVPayload', () => {
    it('should return payload by ID', async () => {
      const mockPayload = { payload_id: 'test-id', payload_name: 'Test' };
      const mockClient = createMockClient({
        getPayload: vi.fn().mockResolvedValue(mockPayload),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchOAEVPayload({ payloadId: 'test-id' }, mockSendResponse);

      expect(mockClient.getPayload).toHaveBeenCalledWith('test-id');
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockPayload
      });
    });
  });

  describe('handleFindDnsResolutionPayload', () => {
    it('should return existing payload when found', async () => {
      const mockPayload = { payload_id: 'found-id' };
      const mockClient = createMockClient({
        findDnsResolutionPayloadByHostname: vi.fn().mockResolvedValue(mockPayload),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFindDnsResolutionPayload({ hostname: 'test.com' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockPayload
      });
    });

    it('should return null when not found', async () => {
      const mockClient = createMockClient({
        findDnsResolutionPayloadByHostname: vi.fn().mockResolvedValue(null),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFindDnsResolutionPayload({ hostname: 'notfound.com' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: null
      });
    });
  });

  describe('handleFindInjectorContractByPayload', () => {
    it('should return contract when found', async () => {
      const mockContract = { injector_contract_id: 'contract-id' };
      const mockClient = createMockClient({
        findInjectorContractByPayloadId: vi.fn().mockResolvedValue(mockContract),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFindInjectorContractByPayload({ payloadId: 'payload-id' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockContract
      });
    });

    it('should return error when not found', async () => {
      const mockClient = createMockClient({
        findInjectorContractByPayloadId: vi.fn().mockResolvedValue(null),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFindInjectorContractByPayload({ payloadId: 'unknown' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'No injector contract found for this payload'
      });
    });
  });

  describe('handleCreateAtomicTesting', () => {
    it('should create atomic testing with URL', async () => {
      const mockResult = { inject_id: 'inject-123' };
      const mockClient = createMockClient({
        createAtomicTesting: vi.fn().mockResolvedValue(mockResult),
        getAtomicTestingUrl: vi.fn().mockReturnValue('https://test.com/atomic/inject-123'),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleCreateAtomicTesting({
        title: 'Test Atomic',
        injectorContractId: 'contract-1',
      }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { ...mockResult, url: 'https://test.com/atomic/inject-123' }
      });
    });
  });

  describe('handleCreateScenario', () => {
    it('should create scenario with URL', async () => {
      const mockResult = { scenario_id: 'scenario-123' };
      const mockClient = createMockClient({
        createScenario: vi.fn().mockResolvedValue(mockResult),
        getScenarioUrl: vi.fn().mockReturnValue('https://test.com/scenario/scenario-123'),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleCreateScenario({ name: 'Test Scenario' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { ...mockResult, url: 'https://test.com/scenario/scenario-123' }
      });
    });
  });

  describe('handleAddInjectToScenario', () => {
    it('should add inject to scenario', async () => {
      const mockResult = { inject_id: 'new-inject' };
      const mockClient = createMockClient({
        addInjectToScenario: vi.fn().mockResolvedValue(mockResult),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleAddInjectToScenario({
        scenarioId: 'scenario-1',
        inject: {
          inject_title: 'Test Inject',
          inject_injector_contract: 'contract-1',
        }
      }, mockSendResponse);

      expect(mockClient.addInjectToScenario).toHaveBeenCalledWith('scenario-1', {
        inject_title: 'Test Inject',
        inject_injector_contract: 'contract-1',
      });
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });
  });

  describe('handleAddEmailInjectToScenario', () => {
    it('should add email inject with correct format', async () => {
      const mockResult = { inject_id: 'email-inject' };
      const mockClient = createMockClient({
        addInjectToScenario: vi.fn().mockResolvedValue(mockResult),
      });
      // Use getOpenAEVClients since the handler uses getClient(platformId)
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map([['test-platform', mockClient]]));

      await handleAddEmailInjectToScenario({
        platformId: 'test-platform',
        scenarioId: 'scenario-1',
        title: 'Phishing Email',
        description: 'Test phishing',
        subject: 'Important Notice',
        body: 'Click here',
        delayMinutes: 5,
        teamId: 'team-1',
      }, mockSendResponse);

      expect(mockClient.addInjectToScenario).toHaveBeenCalled();
      const callArgs = mockClient.addInjectToScenario.mock.calls[0];
      expect(callArgs[0]).toBe('scenario-1');
      expect(callArgs[1].inject_title).toBe('Phishing Email');
      expect(callArgs[1].inject_depends_duration).toBe(300); // 5 * 60
    });
  });

  describe('handleSearchOAEV', () => {
    it('should return error when not configured', async () => {
      vi.mocked(hasOpenAEVClients).mockReturnValue(false);

      await handleSearchOAEV({ searchTerm: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Not configured'
      });
    });

    it('should search across platforms', async () => {
      vi.mocked(hasOpenAEVClients).mockReturnValue(true);
      
      const mockClient = createMockClient({
        fullTextSearch: vi.fn().mockResolvedValue({
          Endpoint: { count: 1 },
        }),
        fullTextSearchByClass: vi.fn().mockResolvedValue({
          content: [{ asset_id: '1', asset_name: 'Server' }]
        }),
      });
      
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map([['test', mockClient]]));

      await handleSearchOAEV({ searchTerm: 'server' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalled();
      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
    });
  });

  describe('handleGetOAEVEntityDetails', () => {
    it('should return error when platform not found', async () => {
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map());

      await handleGetOAEVEntityDetails({
        entityId: '1',
        entityType: 'Endpoint',
        platformId: 'nonexistent'
      }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'OpenAEV platform not found'
      });
    });

    it('should return entity with resolved tags', async () => {
      const mockEntity = {
        asset_id: '1',
        asset_name: 'Server',
        asset_tags: ['tag-1', 'tag-2'],
      };
      const mockClient = createMockClient({
        getEntityById: vi.fn().mockResolvedValue(mockEntity),
        resolveTagIds: vi.fn().mockReturnValue([{ id: 'tag-1', name: 'Production' }]),
      });
      
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map([['test-platform', mockClient]]));

      await handleGetOAEVEntityDetails({
        entityId: '1',
        entityType: 'Endpoint',
        platformId: 'test-platform'
      }, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.platformId).toBe('test-platform');
      expect(response.data.asset_tags_resolved).toBeDefined();
    });

    it('should return error when entity not found', async () => {
      const mockClient = createMockClient({
        getEntityById: vi.fn().mockResolvedValue(null),
      });
      
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map([['test', mockClient]]));

      await handleGetOAEVEntityDetails({
        entityId: 'unknown',
        entityType: 'Endpoint',
        platformId: 'test'
      }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Entity not found'
      });
    });
  });

  describe('handleSearchAssets', () => {
    it('should search assets and groups', async () => {
      const mockClient = createMockClient({
        searchAssets: vi.fn().mockResolvedValue([{ asset_id: '1', asset_name: 'Server' }]),
        searchAssetGroups: vi.fn().mockResolvedValue([{ asset_group_id: '1', asset_group_name: 'Prod' }]),
      });
      
      vi.mocked(getOpenAEVClients).mockReturnValue(new Map([['test', mockClient]]));

      await handleSearchAssets({ searchTerm: 'prod' }, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2); // 1 asset + 1 group
    });
  });

  describe('handleFetchScenarioOverview', () => {
    it('should fetch scenario overview with attack patterns', async () => {
      const mockClient = createMockClient({
        searchInjectorContracts: vi.fn().mockResolvedValue([
          { injector_contract_id: 'c1', injector_contract_attack_patterns: ['ap-1'] }
        ]),
        getKillChainPhases: vi.fn().mockResolvedValue([
          { phase_id: 'p1', phase_name: 'Initial Access' }
        ]),
        getAttackPattern: vi.fn().mockResolvedValue({
          attack_pattern_id: 'ap-1',
          attack_pattern_name: 'Phishing',
          attack_pattern_external_id: 'T1566',
          attack_pattern_kill_chain_phases: ['p1'],
        }),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchScenarioOverview({ attackPatternIds: ['ap-1'] }, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.attackPatterns).toHaveLength(1);
      expect(response.data.attackPatterns[0].name).toBe('Phishing');
    });
  });

  describe('handleFetchInjectorContractsForAttackPatterns', () => {
    it('should return contracts map as object', async () => {
      const contractsMap = new Map([
        ['ap-1', [{ injector_contract_id: 'c1' }]],
        ['ap-2', [{ injector_contract_id: 'c2' }]],
      ]);
      const mockClient = createMockClient({
        getInjectorContractsForAttackPatterns: vi.fn().mockResolvedValue(contractsMap),
      });
      vi.mocked(getFirstOpenAEVClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getFirstOpenAEVClient>);

      await handleFetchInjectorContractsForAttackPatterns({
        attackPatternIds: ['ap-1', 'ap-2']
      }, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data['ap-1']).toBeDefined();
      expect(response.data['ap-2']).toBeDefined();
    });
  });
});

