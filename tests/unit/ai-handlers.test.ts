/**
 * AI message handler tests (XTM One path).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  testConnection: vi.fn(),
  generateContainerDescription: vi.fn(),
  generateScenario: vi.fn(),
  generateFullScenario: vi.fn(),
  generateAtomicTest: vi.fn(),
  generateEmails: vi.fn(),
  discoverEntities: vi.fn(),
  resolveRelationships: vi.fn(),
  scanAll: vi.fn(),
  getMaxTokens: vi.fn().mockReturnValue(10000),
  getMaxContentLength: vi.fn().mockReturnValue(50000),
};

vi.mock('../../src/shared/utils/storage', () => ({
  getSettings: vi.fn(),
}));

vi.mock('../../src/shared/utils/logger', () => ({
  loggers: { background: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

vi.mock('../../src/shared/api/ai-client', () => {
  class MockAIClient {
    constructor() {
      Object.assign(this, mockClient);
    }
  }
  return {
    AIClient: MockAIClient,
    isAIAvailable: vi.fn(),
  };
});

import {
  handleAICheckStatus,
  handleAITestConnection,
  handleAIGenerateDescription,
  handleAIGenerateScenario,
  handleAIGenerateFullScenario,
  handleAIGenerateAtomicTest,
  handleAIGenerateEmails,
  handleAIDiscoverEntities,
  handleAIResolveRelationships,
  handleAIScanAll,
  aiHandlers,
} from '../../src/background/handlers/ai-handlers';
import { getSettings } from '../../src/shared/utils/storage';
import { isAIAvailable } from '../../src/shared/api/ai-client';

const mockedGetSettings = vi.mocked(getSettings);
const mockedIsAvailable = vi.mocked(isAIAvailable);

const configuredSettings = {
  openctiPlatforms: [],
  openaevPlatforms: [],
  theme: 'dark' as const,
  autoScan: false,
  showNotifications: true,
  splitScreenMode: false,
  detection: {},
  ai: { xtmOneUrl: 'https://xtm.example.com', apiToken: 'fcp-test' },
};

const unconfiguredSettings = { ...configuredSettings, ai: {} };

describe('AI handlers', () => {
  const sendResponse = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockClient).forEach((fn) => {
      if (typeof (fn as { mockReset?: () => void }).mockReset === 'function') {
        (fn as { mockReset: () => void }).mockReset();
      }
    });
    mockClient.getMaxTokens.mockReturnValue(10000);
    mockClient.getMaxContentLength.mockReturnValue(50000);
  });

  describe('handleAICheckStatus', () => {
    it('reports availability when XTM One is configured', async () => {
      mockedGetSettings.mockResolvedValue(configuredSettings);
      mockedIsAvailable.mockReturnValue(true);
      await handleAICheckStatus(sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { available: true, enabled: true, provider: 'xtm-one' },
      });
    });

    it('reports unavailable when XTM One is not configured', async () => {
      mockedGetSettings.mockResolvedValue(unconfiguredSettings);
      mockedIsAvailable.mockReturnValue(false);
      await handleAICheckStatus(sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { available: false, enabled: false, provider: 'xtm-one' },
      });
    });
  });

  describe('handleAITestConnection', () => {
    it('rejects empty payload', async () => {
      await handleAITestConnection({}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringMatching(/required/i) }),
      );
    });

    it('forwards the success message from the client', async () => {
      mockClient.testConnection.mockResolvedValue({
        success: true,
        data: { message: 'pong', user_email: 'admin@filigran.io', version: '1.2.0', enterprise_edition: true },
      });
      await handleAITestConnection(
        { xtmOneUrl: 'https://xtm.example.com', apiToken: 'fcp-test' },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'pong',
          user_email: 'admin@filigran.io',
          version: '1.2.0',
          enterprise_edition: true,
        },
      });
    });

    it('forwards undefined fields when client returns no extra data', async () => {
      mockClient.testConnection.mockResolvedValue({ success: true, data: { message: 'ok' } });
      await handleAITestConnection(
        { xtmOneUrl: 'https://xtm.example.com', apiToken: 'fcp-test' },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'ok',
          user_email: undefined,
          version: undefined,
          enterprise_edition: undefined,
        },
      });
    });

    it('forwards an error from the client', async () => {
      mockClient.testConnection.mockResolvedValue({ success: false, error: 'token expired' });
      await handleAITestConnection(
        { xtmOneUrl: 'https://xtm.example.com', apiToken: 'fcp-test' },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'token expired' }),
      );
    });
  });

  describe('generation handlers', () => {
    beforeEach(() => {
      mockedGetSettings.mockResolvedValue(configuredSettings);
      mockedIsAvailable.mockReturnValue(true);
    });

    it('handleAIGenerateDescription unwraps the description string', async () => {
      mockClient.generateContainerDescription.mockResolvedValue({
        success: true,
        data: { description: 'hello' },
      });
      await handleAIGenerateDescription(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          containerType: 'Report',
          containerName: 'n',
        },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true, data: 'hello' });
    });

    it('handleAIGenerateScenario forwards the agent payload', async () => {
      mockClient.generateScenario.mockResolvedValue({
        success: true,
        data: { name: 's', injects: [] },
      });
      await handleAIGenerateScenario(
        { pageTitle: '', pageUrl: '', pageContent: '', scenarioName: 's' },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { name: 's', injects: [] } });
    });

    it('handleAIGenerateFullScenario forwards the scenario on success', async () => {
      mockClient.generateFullScenario.mockResolvedValue({
        success: true,
        data: { name: 's', injects: [{ title: 'inject-1' }] },
      });
      await handleAIGenerateFullScenario(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          scenarioName: 's',
          typeAffinity: 'ENDPOINT',
          numberOfInjects: 1,
        },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { name: 's', injects: [{ title: 'inject-1' }] },
      });
    });

    it('handleAIGenerateFullScenario errors when injects array is missing', async () => {
      mockClient.generateFullScenario.mockResolvedValue({
        success: true,
        data: { name: 's' },
      });
      await handleAIGenerateFullScenario(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          scenarioName: 's',
          typeAffinity: 'ENDPOINT',
          numberOfInjects: 1,
        },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringMatching(/injects array/i) }),
      );
    });

    it('handleAIGenerateAtomicTest forwards the payload', async () => {
      mockClient.generateAtomicTest.mockResolvedValue({
        success: true,
        data: { name: 'test', command: 'whoami' },
      });
      await handleAIGenerateAtomicTest(
        { attackPattern: { name: 'x' }, targetPlatform: 'linux' },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { name: 'test', command: 'whoami' },
      });
    });

    it('handleAIGenerateEmails forwards the emails array', async () => {
      mockClient.generateEmails.mockResolvedValue({
        success: true,
        data: { emails: [{ attackPatternId: 'a', subject: 's', body: 'b' }] },
      });
      await handleAIGenerateEmails(
        { pageTitle: '', pageUrl: '', pageContent: '', scenarioName: 's', attackPatterns: [] },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { emails: [{ attackPatternId: 'a', subject: 's', body: 'b' }] },
      });
    });

    it('handleAIGenerateEmails errors when emails array is missing', async () => {
      mockClient.generateEmails.mockResolvedValue({ success: true, data: {} });
      await handleAIGenerateEmails(
        { pageTitle: '', pageUrl: '', pageContent: '', scenarioName: 's', attackPatterns: [] },
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringMatching(/emails array/i) }),
      );
    });
  });

  describe('handleAIDiscoverEntities', () => {
    beforeEach(() => {
      mockedGetSettings.mockResolvedValue(configuredSettings);
      mockedIsAvailable.mockReturnValue(true);
    });

    it('deduplicates against alreadyDetected', async () => {
      mockClient.discoverEntities.mockResolvedValue({
        success: true,
        data: {
          entities: [
            { type: 'Malware', name: 'Emotet', value: 'emotet' },
            { type: 'Malware', name: 'NewOne', value: 'newone' },
          ],
        },
      });
      await handleAIDiscoverEntities(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          alreadyDetected: [{ type: 'Malware', name: 'Emotet', value: 'emotet' }],
        },
        sendResponse,
      );
      const payload = sendResponse.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.entities).toHaveLength(1);
      expect(payload.data.entities[0].name).toBe('NewOne');
    });

    it('deduplicates case-insensitively across value, name, externalId, and aliases', async () => {
      mockClient.discoverEntities.mockResolvedValue({
        success: true,
        data: {
          entities: [
            { type: 'Attack-Pattern', name: 'Phishing', value: 'phishing', externalId: 'T1566' },
            { type: 'Malware', name: 'CozyDuke', value: 'cozyduke' },
            { type: 'Malware', name: 'Fresh', value: 'fresh' },
          ],
        },
      });
      await handleAIDiscoverEntities(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          alreadyDetected: [
            { type: 'Attack-Pattern', name: 'PHISHING', value: 'PHISHING', externalId: 'T1566' },
            { type: 'Intrusion-Set', name: 'APT29', value: 'apt29', aliases: ['CozyDuke'] },
          ],
        },
        sendResponse,
      );
      const payload = sendResponse.mock.calls[0][0];
      expect(payload.data.entities).toHaveLength(1);
      expect(payload.data.entities[0].name).toBe('Fresh');
    });

    it('returns all entities when alreadyDetected is empty', async () => {
      mockClient.discoverEntities.mockResolvedValue({
        success: true,
        data: { entities: [{ type: 'Malware', name: 'A', value: 'a' }] },
      });
      await handleAIDiscoverEntities(
        { pageTitle: '', pageUrl: '', pageContent: '', alreadyDetected: [] },
        sendResponse,
      );
      expect(sendResponse.mock.calls[0][0].data.entities).toHaveLength(1);
    });
  });

  describe('handleAIResolveRelationships', () => {
    beforeEach(() => {
      mockedGetSettings.mockResolvedValue(configuredSettings);
      mockedIsAvailable.mockReturnValue(true);
    });

    it('drops relationships with out-of-range indices and enriches valid ones with entity values', async () => {
      mockClient.resolveRelationships.mockResolvedValue({
        success: true,
        data: {
          relationships: [
            { fromIndex: 0, toIndex: 1, relationshipType: 'uses' },
            { fromIndex: 0, toIndex: 99, relationshipType: 'targets' }, // out of range
            { fromIndex: 0, toIndex: 0, relationshipType: 'related-to' }, // self
            { fromIndex: 1, toIndex: 0, relationshipType: '' }, // empty type
          ],
        },
      });
      await handleAIResolveRelationships(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          entities: [
            { type: 'Malware', name: 'A', value: 'a', existsInPlatform: false },
            { type: 'Threat-Actor-Group', name: 'B', value: 'b', existsInPlatform: false },
          ],
        },
        sendResponse,
      );
      const payload = sendResponse.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.relationships).toHaveLength(1);
      expect(payload.data.relationships[0]).toMatchObject({
        fromEntityValue: 'a',
        toEntityValue: 'b',
        relationshipType: 'uses',
      });
    });
  });

  describe('handleAIScanAll', () => {
    beforeEach(() => {
      mockedGetSettings.mockResolvedValue(configuredSettings);
      mockedIsAvailable.mockReturnValue(true);
    });

    it('combines already-detected and new entities for relationship lookup', async () => {
      mockClient.scanAll.mockResolvedValue({
        success: true,
        data: {
          entities: [
            { type: 'Malware', value: 'newmalware' },
          ],
          relationships: [
            // index 0 = already-detected APT29, index 1 = newly discovered Newmalware
            { fromIndex: 0, toIndex: 1, relationshipType: 'uses' },
          ],
        },
      });
      await handleAIScanAll(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          alreadyDetected: [{ type: 'Intrusion-Set', value: 'APT29' }],
        },
        sendResponse,
      );
      const payload = sendResponse.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.entities).toHaveLength(1);
      expect(payload.data.relationships).toHaveLength(1);
      expect(payload.data.relationships[0].fromEntityValue).toBe('APT29');
      expect(payload.data.relationships[0].toEntityValue).toBe('newmalware');
    });

    it('drops duplicate entities matching the already-detected set', async () => {
      mockClient.scanAll.mockResolvedValue({
        success: true,
        data: {
          entities: [
            { type: 'Intrusion-Set', value: 'APT29' },
            { type: 'Malware', value: 'NewOne' },
          ],
          relationships: [],
        },
      });
      await handleAIScanAll(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          alreadyDetected: [{ type: 'Intrusion-Set', value: 'APT29' }],
        },
        sendResponse,
      );
      const payload = sendResponse.mock.calls[0][0];
      expect(payload.data.entities).toHaveLength(1);
      expect(payload.data.entities[0].value).toBe('NewOne');
    });

    it('filters out self-referencing, out-of-range, and empty-type relationships', async () => {
      mockClient.scanAll.mockResolvedValue({
        success: true,
        data: {
          entities: [
            { type: 'Malware', value: 'X' },
            { type: 'Malware', value: 'Y' },
          ],
          relationships: [
            // valid: from already-detected (index 0) to new entity (index 1)
            { fromIndex: 0, toIndex: 1, relationshipType: 'uses' },
            // self-ref: both indices point to same entity
            { fromIndex: 0, toIndex: 0, relationshipType: 'related-to' },
            // out-of-range: index 99 does not exist in the combined entity list
            { fromIndex: 0, toIndex: 99, relationshipType: 'targets' },
            // empty type
            { fromIndex: 1, toIndex: 0, relationshipType: '' },
          ],
        },
      });
      await handleAIScanAll(
        {
          pageTitle: '',
          pageUrl: '',
          pageContent: '',
          alreadyDetected: [{ type: 'Intrusion-Set', value: 'APT29' }],
        },
        sendResponse,
      );
      const payload = sendResponse.mock.calls[0][0];
      expect(payload.data.relationships).toHaveLength(1);
      expect(payload.data.relationships[0]).toMatchObject({
        fromEntityValue: 'APT29',
        toEntityValue: 'X',
        relationshipType: 'uses',
      });
    });
  });
});

describe('aiHandlers registry', () => {
  it('exports the expected handler set', () => {
    expect(Object.keys(aiHandlers).sort()).toEqual(
      [
        'AI_CHECK_STATUS',
        'AI_TEST_CONNECTION',
        'AI_GENERATE_DESCRIPTION',
        'AI_GENERATE_SCENARIO',
        'AI_GENERATE_FULL_SCENARIO',
        'AI_GENERATE_ATOMIC_TEST',
        'AI_GENERATE_EMAILS',
        'AI_DISCOVER_ENTITIES',
        'AI_RESOLVE_RELATIONSHIPS',
        'AI_SCAN_ALL',
      ].sort(),
    );
  });
});
