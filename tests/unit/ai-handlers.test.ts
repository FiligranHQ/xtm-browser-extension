/**
 * Tests for AI Message Handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleAICheckStatus,
  handleAITestAndFetchModels,
  handleAIGenerateDescription,
  handleAIGenerateScenario,
  handleAIGenerateFullScenario,
  handleAIGenerateAtomicTest,
  handleAIGenerateEmails,
  handleAIDiscoverEntities,
  handleAIResolveRelationships,
  handleAIScanAll,
} from '../../src/background/handlers/ai-handlers';

// Create a mock class for AIClient
const mockAIClientInstance = {
  testConnectionAndFetchModels: vi.fn(),
  generateContainerDescription: vi.fn(),
  generateScenario: vi.fn(),
  generateFullScenario: vi.fn(),
  generateAtomicTest: vi.fn(),
  generateEmails: vi.fn(),
  discoverEntities: vi.fn(),
  resolveRelationships: vi.fn(),
  generate: vi.fn(),
};

// Mock dependencies
vi.mock('../../src/shared/utils/storage', () => ({
  getSettings: vi.fn(),
}));

vi.mock('../../src/shared/api/ai-client', () => {
  // Create a proper mock class
  class MockAIClient {
    testConnectionAndFetchModels = mockAIClientInstance.testConnectionAndFetchModels;
    generateContainerDescription = mockAIClientInstance.generateContainerDescription;
    generateScenario = mockAIClientInstance.generateScenario;
    generateFullScenario = mockAIClientInstance.generateFullScenario;
    generateAtomicTest = mockAIClientInstance.generateAtomicTest;
    generateEmails = mockAIClientInstance.generateEmails;
    discoverEntities = mockAIClientInstance.discoverEntities;
    resolveRelationships = mockAIClientInstance.resolveRelationships;
    generate = mockAIClientInstance.generate;
  }
  return {
    AIClient: MockAIClient,
    isAIAvailable: vi.fn(),
  };
});

vi.mock('../../src/shared/api/ai/json-parser', () => ({
  parseAIJsonResponse: vi.fn(),
}));

import { getSettings } from '../../src/shared/utils/storage';
import { isAIAvailable } from '../../src/shared/api/ai-client';
import { parseAIJsonResponse } from '../../src/shared/api/ai/json-parser';

describe('AI Handlers', () => {
  const mockSendResponse = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock functions on the instance
    Object.values(mockAIClientInstance).forEach(fn => {
      if (typeof fn.mockReset === 'function') {
        fn.mockReset();
      }
    });
  });

  describe('handleAICheckStatus', () => {
    it('should return available=true when AI is configured', async () => {
      const mockSettings = {
        ai: { provider: 'openai', apiKey: 'test-key', model: 'gpt-4' }
      };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);

      await handleAICheckStatus(mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          available: true,
          provider: 'openai',
          enabled: true,
        }
      });
    });

    it('should return available=false when AI is not configured', async () => {
      vi.mocked(getSettings).mockResolvedValue({});
      vi.mocked(isAIAvailable).mockReturnValue(false);

      await handleAICheckStatus(mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          available: false,
          provider: undefined,
          enabled: false,
        }
      });
    });
  });

  describe('handleAITestAndFetchModels', () => {
    it('should return models on successful connection', async () => {
      mockAIClientInstance.testConnectionAndFetchModels.mockResolvedValue({
        success: true,
        models: ['gpt-4', 'gpt-3.5-turbo'],
      });

      await handleAITestAndFetchModels(
        { provider: 'openai', apiKey: 'test-key' },
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { models: ['gpt-4', 'gpt-3.5-turbo'] }
      });
    });

    it('should return error on failed connection', async () => {
      mockAIClientInstance.testConnectionAndFetchModels.mockResolvedValue({
        success: false,
        error: 'Invalid API key',
      });

      await handleAITestAndFetchModels(
        { provider: 'openai', apiKey: 'invalid' },
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid API key'
      });
    });

    it('should handle exceptions', async () => {
      mockAIClientInstance.testConnectionAndFetchModels.mockRejectedValue(new Error('Network error'));

      await handleAITestAndFetchModels(
        { provider: 'openai', apiKey: 'test' },
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Network error'
      });
    });
  });

  describe('handleAIGenerateScenario', () => {
    it('should return error when AI is not configured', async () => {
      vi.mocked(getSettings).mockResolvedValue({});
      vi.mocked(isAIAvailable).mockReturnValue(false);

      await handleAIGenerateScenario({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'AI not configured'
      });
    });

    it('should generate scenario successfully', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateScenario.mockResolvedValue({
        success: true,
        content: '{"name": "Test Scenario"}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({ name: 'Test Scenario' });

      await handleAIGenerateScenario({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { name: 'Test Scenario' }
      });
    });

    it('should handle generation failure', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateScenario.mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
      });

      await handleAIGenerateScenario({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded'
      });
    });
  });

  describe('handleAIGenerateFullScenario', () => {
    it('should return error when AI is not configured', async () => {
      vi.mocked(getSettings).mockResolvedValue({});
      vi.mocked(isAIAvailable).mockReturnValue(false);

      await handleAIGenerateFullScenario({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'AI not configured'
      });
    });

    it('should generate full scenario with injects', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateFullScenario.mockResolvedValue({
        success: true,
        content: '{"name": "Test", "injects": []}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({ name: 'Test', injects: [] });

      await handleAIGenerateFullScenario({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { name: 'Test', injects: [] }
      });
    });

    it('should handle missing injects array', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateFullScenario.mockResolvedValue({
        success: true,
        content: '{"name": "Test"}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({ name: 'Test' }); // No injects

      await handleAIGenerateFullScenario({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('injects array is missing')
      });
    });

    it('should truncate large page content', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateFullScenario.mockResolvedValue({
        success: true,
        content: '{"name": "Test", "injects": []}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({ name: 'Test', injects: [] });

      const largeContent = 'x'.repeat(10000);
      await handleAIGenerateFullScenario({ pageContent: largeContent }, mockSendResponse);

      // Should have called with truncated content
      expect(mockAIClientInstance.generateFullScenario).toHaveBeenCalled();
      const callArg = mockAIClientInstance.generateFullScenario.mock.calls[0][0];
      expect(callArg.pageContent.length).toBeLessThan(largeContent.length);
    });
  });

  describe('handleAIGenerateAtomicTest', () => {
    it('should return error when AI is not configured', async () => {
      vi.mocked(getSettings).mockResolvedValue({});
      vi.mocked(isAIAvailable).mockReturnValue(false);

      await handleAIGenerateAtomicTest({ attackPattern: { name: 'T1566' } }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'AI not configured'
      });
    });

    it('should generate atomic test successfully', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateAtomicTest.mockResolvedValue({
        success: true,
        content: '{"name": "Phishing Test", "steps": []}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({ name: 'Phishing Test', steps: [] });

      await handleAIGenerateAtomicTest({ attackPattern: { name: 'T1566' } }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { name: 'Phishing Test', steps: [] }
      });
    });

    it('should handle parsing failure', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateAtomicTest.mockResolvedValue({
        success: true,
        content: 'invalid json',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue(null);

      await handleAIGenerateAtomicTest({ attackPattern: { name: 'T1566' } }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('parsing failed')
      });
    });
  });

  describe('handleAIGenerateEmails', () => {
    it('should return error when AI is not configured', async () => {
      vi.mocked(getSettings).mockResolvedValue({});
      vi.mocked(isAIAvailable).mockReturnValue(false);

      await handleAIGenerateEmails({ attackPatterns: [] }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'AI not configured'
      });
    });

    it('should generate emails successfully', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateEmails.mockResolvedValue({
        success: true,
        content: '{"emails": [{"attackPatternId": "1", "subject": "Test", "body": "Body"}]}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({
        emails: [{ attackPatternId: '1', subject: 'Test', body: 'Body' }]
      });

      await handleAIGenerateEmails({ attackPatterns: [{ id: '1', name: 'T1566' }] }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { emails: [{ attackPatternId: '1', subject: 'Test', body: 'Body' }] }
      });
    });

    it('should handle invalid emails structure', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generateEmails.mockResolvedValue({
        success: true,
        content: '{"result": "bad"}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({ result: 'bad' });

      await handleAIGenerateEmails({ attackPatterns: [] }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('parsing failed')
      });
    });
  });

  describe('handleAIDiscoverEntities', () => {
    it('should return error when AI is not configured', async () => {
      vi.mocked(getSettings).mockResolvedValue({});
      vi.mocked(isAIAvailable).mockReturnValue(false);

      await handleAIDiscoverEntities({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'AI not configured'
      });
    });

    it('should discover entities and filter already detected', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.discoverEntities.mockResolvedValue({
        success: true,
        content: '{"entities": []}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({
        entities: [
          { type: 'Malware', value: 'Emotet', confidence: 'high' },
          { type: 'Malware', value: 'Already Known', confidence: 'high' },
        ]
      });

      await handleAIDiscoverEntities({
        pageContent: 'test',
        pageTitle: 'Test Page',
        alreadyDetected: [{ value: 'Already Known', type: 'Malware' }]
      }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          entities: [{ type: 'Malware', value: 'Emotet', confidence: 'high' }]
        }
      });
    });

    it('should return empty entities on invalid structure', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.discoverEntities.mockResolvedValue({
        success: true,
        content: '{"invalid": true}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({ invalid: true });

      await handleAIDiscoverEntities({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { entities: [] }
      });
    });
  });

  describe('handleAIResolveRelationships', () => {
    it('should return error when AI is not configured', async () => {
      vi.mocked(getSettings).mockResolvedValue({});
      vi.mocked(isAIAvailable).mockReturnValue(false);

      await handleAIResolveRelationships({ entities: [], pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'AI not configured'
      });
    });

    it('should resolve relationships and validate indices', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.resolveRelationships.mockResolvedValue({
        success: true,
        content: '{"relationships": []}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({
        relationships: [
          { fromIndex: 0, toIndex: 1, relationshipType: 'uses', confidence: 'high', reason: 'Test' },
          { fromIndex: 999, toIndex: 0, relationshipType: 'invalid', confidence: 'high', reason: 'Bad index' }, // Invalid
        ]
      });

      await handleAIResolveRelationships({
        entities: [
          { value: 'APT29', type: 'Intrusion-Set' },
          { value: 'Emotet', type: 'Malware' },
        ],
        pageContent: 'test'
      }, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.relationships).toHaveLength(1); // Only valid relationship
      expect(response.data.relationships[0].fromEntityValue).toBe('APT29');
      expect(response.data.relationships[0].toEntityValue).toBe('Emotet');
    });

    it('should return empty relationships on invalid structure', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.resolveRelationships.mockResolvedValue({
        success: true,
        content: '{"bad": true}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({ bad: true });

      await handleAIResolveRelationships({ entities: [], pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { relationships: [] }
      });
    });
  });

  describe('handleAIScanAll', () => {
    it('should return error when AI is not configured', async () => {
      vi.mocked(getSettings).mockResolvedValue({});
      vi.mocked(isAIAvailable).mockReturnValue(false);

      await handleAIScanAll({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'AI not configured'
      });
    });

    it('should scan all and return entities and relationships', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generate.mockResolvedValue({
        success: true,
        content: '{"entities": [], "relationships": []}',
      });
      vi.mocked(parseAIJsonResponse).mockReturnValue({
        entities: [
          { type: 'Malware', value: 'Emotet' },
        ],
        relationships: [
          { fromIndex: 0, toIndex: 1, relationshipType: 'uses', confidence: 'high', reason: 'Test' },
        ]
      });

      await handleAIScanAll({
        pageContent: 'test',
        pageTitle: 'Test',
        pageUrl: 'http://test.com',
        alreadyDetected: [{ value: 'APT29', type: 'Intrusion-Set' }]
      }, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.entities).toHaveLength(1);
      expect(response.data.relationships).toHaveLength(1);
    });

    it('should handle exceptions gracefully', async () => {
      const mockSettings = { ai: { provider: 'openai', apiKey: 'key' } };
      vi.mocked(getSettings).mockResolvedValue(mockSettings);
      vi.mocked(isAIAvailable).mockReturnValue(true);
      
      mockAIClientInstance.generate.mockRejectedValue(new Error('Connection error'));

      await handleAIScanAll({ pageContent: 'test' }, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Connection error'
      });
    });
  });
});

