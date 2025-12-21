/**
 * Unit Tests for Platform Handler Utilities
 * 
 * Tests common utilities used across platform message handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkClientsConfigured,
  getClientOrError,
  getTargetClient,
  getTargetClientOrError,
  fetchFromSinglePlatform,
  fetchFromAllPlatforms,
  searchAcrossPlatforms,
  handleError,
  withClientCheck,
  testPlatformConnection,
  type SendResponse,
  type PlatformClientMap,
  type TestableClient,
  type ConnectionTestRequest,
  type ConnectionTestDeps,
} from '../../src/background/handlers/platform-utils';

// Mock the logger
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    background: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

// ============================================================================
// Mock Helpers
// ============================================================================

function createMockSendResponse(): SendResponse {
  return vi.fn();
}

function createMockClientMap<T>(clients: Map<string, T>): PlatformClientMap<T> {
  return {
    size: clients.size,
    get: (key: string) => clients.get(key),
    entries: () => clients.entries(),
    keys: () => clients.keys(),
  };
}

// ============================================================================
// checkClientsConfigured Tests
// ============================================================================

describe('checkClientsConfigured', () => {
  let sendResponse: SendResponse;

  beforeEach(() => {
    sendResponse = createMockSendResponse();
  });

  it('should return true when clients exist', () => {
    const clients = createMockClientMap(new Map([['platform1', { test: true }]]));
    
    const result = checkClientsConfigured(clients, sendResponse);
    
    expect(result).toBe(true);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('should return false and send error when no clients exist', () => {
    const clients = createMockClientMap(new Map());
    
    const result = checkClientsConfigured(clients, sendResponse);
    
    expect(result).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Not configured',
    });
  });

  it('should use custom error message', () => {
    const clients = createMockClientMap(new Map());
    
    checkClientsConfigured(clients, sendResponse, 'Custom error message');
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Custom error message',
    });
  });
});

// ============================================================================
// getClientOrError Tests
// ============================================================================

describe('getClientOrError', () => {
  let sendResponse: SendResponse;
  const mockClient = { id: 'client1' };

  beforeEach(() => {
    sendResponse = createMockSendResponse();
  });

  it('should return client when found', () => {
    const clients = createMockClientMap(new Map([['platform1', mockClient]]));
    
    const result = getClientOrError(clients, 'platform1', sendResponse);
    
    expect(result).toBe(mockClient);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('should return null and send error when client not found', () => {
    const clients = createMockClientMap(new Map());
    
    const result = getClientOrError(clients, 'unknown', sendResponse);
    
    expect(result).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Platform not found',
    });
  });
});

// ============================================================================
// getTargetClient Tests
// ============================================================================

describe('getTargetClient', () => {
  const mockClient1 = { id: 'client1' };
  const mockClient2 = { id: 'client2' };

  it('should return specific client when platformId provided', () => {
    const clients = createMockClientMap(new Map([
      ['platform1', mockClient1],
      ['platform2', mockClient2],
    ]));
    
    const result = getTargetClient(clients, 'platform2');
    
    expect(result.client).toBe(mockClient2);
    expect(result.targetPlatformId).toBe('platform2');
  });

  it('should return first client when no platformId provided', () => {
    const clients = createMockClientMap(new Map([
      ['platform1', mockClient1],
      ['platform2', mockClient2],
    ]));
    
    const result = getTargetClient(clients);
    
    expect(result.client).toBe(mockClient1);
    expect(result.targetPlatformId).toBe('platform1');
  });

  it('should return undefined for both when clients map is empty', () => {
    const clients = createMockClientMap(new Map());
    
    const result = getTargetClient(clients);
    
    expect(result.client).toBeUndefined();
    expect(result.targetPlatformId).toBeUndefined();
  });

  it('should return undefined client when specified platform not found', () => {
    const clients = createMockClientMap(new Map([['platform1', mockClient1]]));
    
    const result = getTargetClient(clients, 'unknown');
    
    expect(result.client).toBeUndefined();
    expect(result.targetPlatformId).toBe('unknown');
  });
});

// ============================================================================
// getTargetClientOrError Tests
// ============================================================================

describe('getTargetClientOrError', () => {
  let sendResponse: SendResponse;
  const mockClient = { id: 'client1' };

  beforeEach(() => {
    sendResponse = createMockSendResponse();
  });

  it('should return client and platformId when found', () => {
    const clients = createMockClientMap(new Map([['platform1', mockClient]]));
    
    const result = getTargetClientOrError(clients, 'platform1', sendResponse);
    
    expect(result).toEqual({ client: mockClient, platformId: 'platform1' });
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('should return first client when platformId undefined', () => {
    const clients = createMockClientMap(new Map([['platform1', mockClient]]));
    
    const result = getTargetClientOrError(clients, undefined, sendResponse);
    
    expect(result).toEqual({ client: mockClient, platformId: 'platform1' });
  });

  it('should return null and send error when client not found', () => {
    const clients = createMockClientMap(new Map());
    
    const result = getTargetClientOrError(clients, undefined, sendResponse);
    
    expect(result).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Platform not found',
    });
  });

  it('should return null when specified platform not in map', () => {
    const clients = createMockClientMap(new Map([['platform1', mockClient]]));
    
    const result = getTargetClientOrError(clients, 'unknown', sendResponse);
    
    expect(result).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Platform not found',
    });
  });
});

// ============================================================================
// fetchFromSinglePlatform Tests
// ============================================================================

describe('fetchFromSinglePlatform', () => {
  let sendResponse: SendResponse;
  const mockClient = { id: 'client1' };

  beforeEach(() => {
    sendResponse = createMockSendResponse();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch results and attach platformId', async () => {
    const results = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
    const fetchFn = vi.fn().mockResolvedValue(results);
    
    await fetchFromSinglePlatform(mockClient, 'platform1', fetchFn, sendResponse);
    
    expect(fetchFn).toHaveBeenCalledWith(mockClient);
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: [
        { id: '1', name: 'Item 1', platformId: 'platform1' },
        { id: '2', name: 'Item 2', platformId: 'platform1' },
      ],
    });
  });

  it('should handle fetch errors', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));
    
    await fetchFromSinglePlatform(mockClient, 'platform1', fetchFn, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Network error',
    });
  });

  it('should handle non-Error exceptions', async () => {
    const fetchFn = vi.fn().mockRejectedValue('Unknown error');
    
    await fetchFromSinglePlatform(mockClient, 'platform1', fetchFn, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Fetch failed',
    });
  });

  it('should handle empty results', async () => {
    const fetchFn = vi.fn().mockResolvedValue([]);
    
    await fetchFromSinglePlatform(mockClient, 'platform1', fetchFn, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: [],
    });
  });
});

// ============================================================================
// fetchFromAllPlatforms Tests
// ============================================================================

describe('fetchFromAllPlatforms', () => {
  const mockClient1 = { id: 'client1' };
  const mockClient2 = { id: 'client2' };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch from all platforms and deduplicate by id', async () => {
    const clients = createMockClientMap(new Map([
      ['platform1', mockClient1],
      ['platform2', mockClient2],
    ]));
    
    const fetchFn = vi.fn()
      .mockResolvedValueOnce([{ id: '1', name: 'Item 1' }])
      .mockResolvedValueOnce([{ id: '1', name: 'Item 1 Dupe' }, { id: '2', name: 'Item 2' }]);
    
    const result = await fetchFromAllPlatforms(clients, fetchFn, 5000);
    
    expect(result.results).toHaveLength(2);
    expect(result.results.map(r => r.id)).toEqual(['1', '2']);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle timeouts', async () => {
    const clients = createMockClientMap(new Map([['platform1', mockClient1]]));
    
    const fetchFn = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 100))
    );
    
    const result = await fetchFromAllPlatforms(clients, fetchFn, 10);
    
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].platformId).toBe('platform1');
  });

  it('should handle partial failures', async () => {
    const clients = createMockClientMap(new Map([
      ['platform1', mockClient1],
      ['platform2', mockClient2],
    ]));
    
    const fetchFn = vi.fn()
      .mockResolvedValueOnce([{ id: '1', name: 'Item 1' }])
      .mockRejectedValueOnce(new Error('Platform 2 error'));
    
    const result = await fetchFromAllPlatforms(clients, fetchFn, 5000, 'TestFetch');
    
    expect(result.results).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].platformId).toBe('platform2');
  });
});

// ============================================================================
// searchAcrossPlatforms Tests
// ============================================================================

describe('searchAcrossPlatforms', () => {
  const mockClient1 = { id: 'client1' };
  const mockClient2 = { id: 'client2' };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should search all platforms when no platformId specified', async () => {
    const clients = createMockClientMap(new Map([
      ['platform1', mockClient1],
      ['platform2', mockClient2],
    ]));
    
    const searchFn = vi.fn()
      .mockResolvedValueOnce([{ id: '1', name: 'Result 1' }])
      .mockResolvedValueOnce([{ id: '2', name: 'Result 2' }]);
    
    const results = await searchAcrossPlatforms(clients, undefined, searchFn, 5000);
    
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: '1', name: 'Result 1', platformId: 'platform1' });
    expect(results[1]).toEqual({ id: '2', name: 'Result 2', platformId: 'platform2' });
  });

  it('should search specific platform when platformId specified', async () => {
    const clients = createMockClientMap(new Map([
      ['platform1', mockClient1],
      ['platform2', mockClient2],
    ]));
    
    const searchFn = vi.fn().mockResolvedValueOnce([{ id: '1', name: 'Result 1' }]);
    
    const results = await searchAcrossPlatforms(clients, 'platform1', searchFn, 5000);
    
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].platformId).toBe('platform1');
  });

  it('should handle timeout errors gracefully', async () => {
    const clients = createMockClientMap(new Map([['platform1', mockClient1]]));
    
    const searchFn = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([{ id: '1' }]), 100))
    );
    
    const results = await searchAcrossPlatforms(clients, undefined, searchFn, 10, 'TestSearch');
    
    expect(results).toHaveLength(0);
  });

  it('should return empty array when platform not found', async () => {
    const clients = createMockClientMap(new Map([['platform1', mockClient1]]));
    
    const searchFn = vi.fn();
    
    const results = await searchAcrossPlatforms(clients, 'unknown', searchFn, 5000);
    
    expect(results).toHaveLength(0);
    expect(searchFn).not.toHaveBeenCalled();
  });
});

// ============================================================================
// handleError Tests
// ============================================================================

describe('handleError', () => {
  let sendResponse: SendResponse;

  beforeEach(() => {
    sendResponse = createMockSendResponse();
  });

  it('should extract message from Error objects', () => {
    handleError(new Error('Specific error'), sendResponse, 'Default message');
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Specific error',
    });
  });

  it('should use default message for non-Error exceptions', () => {
    handleError('string error', sendResponse, 'Default message');
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Default message',
    });
  });

  it('should use default message for null', () => {
    handleError(null, sendResponse, 'Default message');
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Default message',
    });
  });

  it('should use default message for undefined', () => {
    handleError(undefined, sendResponse, 'Default message');
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Default message',
    });
  });
});

// ============================================================================
// withClientCheck Tests
// ============================================================================

describe('withClientCheck', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute handler when clients are configured', async () => {
    const mockClient = { id: 'client1' };
    const clients = createMockClientMap(new Map([['platform1', mockClient]]));
    const getClients = vi.fn().mockReturnValue(clients);
    const handler = vi.fn().mockResolvedValue(undefined);
    const sendResponse = createMockSendResponse();
    
    const wrappedHandler = withClientCheck(getClients, handler);
    await wrappedHandler(sendResponse);
    
    expect(handler).toHaveBeenCalledWith(clients, sendResponse);
  });

  it('should not execute handler when no clients configured', async () => {
    const clients = createMockClientMap(new Map());
    const getClients = vi.fn().mockReturnValue(clients);
    const handler = vi.fn();
    const sendResponse = createMockSendResponse();
    
    const wrappedHandler = withClientCheck(getClients, handler);
    await wrappedHandler(sendResponse);
    
    expect(handler).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Not configured',
    });
  });
});

// ============================================================================
// testPlatformConnection Tests
// ============================================================================

describe('testPlatformConnection', () => {
  let sendResponse: SendResponse;
  let mockClient: TestableClient;
  let mockGetSettings: ReturnType<typeof vi.fn>;
  let mockCreateClient: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendResponse = createMockSendResponse();
    mockClient = {
      testConnection: vi.fn().mockResolvedValue({ version: '1.0.0', status: 'connected' }),
    };
    mockGetSettings = vi.fn().mockResolvedValue({
      openctiPlatforms: [
        { id: 'platform1', name: 'Platform 1', url: 'https://opencti.example.com', apiToken: 'token123', enabled: true },
      ],
      openaevPlatforms: [],
    });
    mockCreateClient = vi.fn().mockReturnValue(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should test temporary connection with provided credentials', async () => {
    const request: ConnectionTestRequest = {
      temporary: true,
      url: 'https://test.example.com',
      apiToken: 'temp-token',
    };
    const deps: ConnectionTestDeps<TestableClient> = {
      getSettings: mockGetSettings,
      clients: new Map(),
      createClient: mockCreateClient,
      settingsKey: 'openctiPlatforms',
    };
    
    await testPlatformConnection(request, deps, sendResponse);
    
    expect(mockCreateClient).toHaveBeenCalledWith({
      id: 'temp',
      name: 'temp',
      url: 'https://test.example.com',
      apiToken: 'temp-token',
      enabled: true,
    });
    expect(mockClient.testConnection).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { version: '1.0.0', status: 'connected' },
    });
  });

  it('should test saved platform using cached client', async () => {
    const request: ConnectionTestRequest = {
      platformId: 'platform1',
    };
    const cachedClients = new Map([['platform1', mockClient]]);
    const deps: ConnectionTestDeps<TestableClient> = {
      getSettings: mockGetSettings,
      clients: cachedClients,
      createClient: mockCreateClient,
      settingsKey: 'openctiPlatforms',
    };
    
    await testPlatformConnection(request, deps, sendResponse);
    
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockClient.testConnection).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { version: '1.0.0', status: 'connected' },
    });
  });

  it('should create client from settings when not cached', async () => {
    const request: ConnectionTestRequest = {
      platformId: 'platform1',
    };
    const deps: ConnectionTestDeps<TestableClient> = {
      getSettings: mockGetSettings,
      clients: new Map(),
      createClient: mockCreateClient,
      settingsKey: 'openctiPlatforms',
    };
    
    await testPlatformConnection(request, deps, sendResponse);
    
    expect(mockCreateClient).toHaveBeenCalledWith({
      id: 'platform1',
      name: 'Platform 1',
      url: 'https://opencti.example.com',
      apiToken: 'token123',
      enabled: true,
    });
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { version: '1.0.0', status: 'connected' },
    });
  });

  it('should handle platform not configured error', async () => {
    const request: ConnectionTestRequest = {
      platformId: 'unknown-platform',
    };
    const deps: ConnectionTestDeps<TestableClient> = {
      getSettings: mockGetSettings,
      clients: new Map(),
      createClient: mockCreateClient,
      settingsKey: 'openctiPlatforms',
    };
    
    await testPlatformConnection(request, deps, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Platform not configured',
    });
  });

  it('should handle missing platformId and credentials', async () => {
    const request: ConnectionTestRequest = {};
    const deps: ConnectionTestDeps<TestableClient> = {
      getSettings: mockGetSettings,
      clients: new Map(),
      createClient: mockCreateClient,
      settingsKey: 'openctiPlatforms',
    };
    
    await testPlatformConnection(request, deps, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Missing platformId or temporary credentials',
    });
  });

  it('should handle connection errors', async () => {
    mockClient.testConnection = vi.fn().mockRejectedValue(new Error('Connection refused'));
    
    const request: ConnectionTestRequest = {
      platformId: 'platform1',
    };
    const deps: ConnectionTestDeps<TestableClient> = {
      getSettings: mockGetSettings,
      clients: new Map([['platform1', mockClient]]),
      createClient: mockCreateClient,
      settingsKey: 'openctiPlatforms',
    };
    
    await testPlatformConnection(request, deps, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Connection refused',
    });
  });

  it('should handle connection timeout', async () => {
    mockClient.testConnection = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    const request: ConnectionTestRequest = {
      platformId: 'platform1',
    };
    const deps: ConnectionTestDeps<TestableClient> = {
      getSettings: mockGetSettings,
      clients: new Map([['platform1', mockClient]]),
      createClient: mockCreateClient,
      settingsKey: 'openctiPlatforms',
      timeoutMs: 10,
    };
    
    await testPlatformConnection(request, deps, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Connection timeout',
    });
  });
});

