/**
 * AI Client Tests
 *
 * Tests for the unified AI provider interface (OpenAI, Anthropic, Gemini, Custom).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIClient, isAIAvailable } from '../../src/shared/api/ai-client';
import type { AISettings } from '../../src/shared/types/ai';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('AIClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create client with valid OpenAI settings', () => {
      const settings: AISettings = {
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      };

      const client = new AIClient(settings);
      expect(client).toBeInstanceOf(AIClient);
    });

    it('should create client with valid Anthropic settings', () => {
      const settings: AISettings = {
        provider: 'anthropic',
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-opus-20240229',
      };

      const client = new AIClient(settings);
      expect(client).toBeInstanceOf(AIClient);
    });

    it('should create client with valid Gemini settings', () => {
      const settings: AISettings = {
        provider: 'gemini',
        apiKey: 'gemini-api-key',
        model: 'gemini-pro',
      };

      const client = new AIClient(settings);
      expect(client).toBeInstanceOf(AIClient);
    });

    it('should create client with valid custom settings', () => {
      const settings: AISettings = {
        provider: 'custom',
        apiKey: 'custom-api-key',
        model: 'custom-model',
        customBaseUrl: 'https://my-api.example.com/v1',
      };

      const client = new AIClient(settings);
      expect(client).toBeInstanceOf(AIClient);
    });

    it('should throw error when provider is missing', () => {
      const settings = {
        apiKey: 'test-key',
      } as AISettings;

      expect(() => new AIClient(settings)).toThrow('AI provider and API key are required');
    });

    it('should throw error when apiKey is missing', () => {
      const settings = {
        provider: 'openai',
      } as AISettings;

      expect(() => new AIClient(settings)).toThrow('AI provider and API key are required');
    });

    it('should throw error for xtm-one provider', () => {
      const settings: AISettings = {
        provider: 'xtm-one',
        apiKey: 'test-key',
      };

      expect(() => new AIClient(settings)).toThrow('XTM One is not yet available');
    });

    it('should throw error for custom provider without customBaseUrl', () => {
      const settings: AISettings = {
        provider: 'custom',
        apiKey: 'test-key',
        model: 'custom-model',
      };

      expect(() => new AIClient(settings)).toThrow('Custom endpoint URL is required for custom provider');
    });

    it('should allow custom provider without model at construction, but fail at generate', async () => {
      const settings: AISettings = {
        provider: 'custom',
        apiKey: 'test-key',
        customBaseUrl: 'https://my-api.example.com/v1',
      };

      const client = new AIClient(settings);
      const result = await client.generate({ prompt: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Model name is required for custom provider');
    });
  });

  // ============================================================================
  // Model Discovery Tests
  // ============================================================================

  describe('testConnectionAndFetchModels', () => {
    describe('OpenAI', () => {
      it('should fetch OpenAI models successfully', async () => {
        const settings: AISettings = {
          provider: 'openai',
          apiKey: 'sk-test-key',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'gpt-4', created: 1000, owned_by: 'openai' },
              { id: 'gpt-3.5-turbo', created: 900, owned_by: 'openai' },
            ],
          }),
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(true);
        expect(result.models).toHaveLength(2);
        expect(result.models?.[0].id).toBe('gpt-4');
      });

      it('should handle OpenAI 401 error', async () => {
        const settings: AISettings = {
          provider: 'openai',
          apiKey: 'invalid-key',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid API key');
      });

      it('should handle OpenAI generic error', async () => {
        const settings: AISettings = {
          provider: 'openai',
          apiKey: 'sk-test-key',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(false);
        expect(result.error).toContain('OpenAI API error');
      });
    });

    describe('Anthropic', () => {
      it('should fetch Anthropic models successfully', async () => {
        const settings: AISettings = {
          provider: 'anthropic',
          apiKey: 'sk-ant-test-key',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'claude-3-opus', display_name: 'Claude 3 Opus', created_at: '2024-01-01T00:00:00Z' },
            ],
          }),
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(true);
        expect(result.models?.[0].name).toBe('Claude 3 Opus');
      });

      it('should handle Anthropic 401 error', async () => {
        const settings: AISettings = {
          provider: 'anthropic',
          apiKey: 'invalid-key',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid API key');
      });
    });

    describe('Gemini', () => {
      it('should fetch Gemini models successfully', async () => {
        const settings: AISettings = {
          provider: 'gemini',
          apiKey: 'gemini-api-key',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [
              { name: 'models/gemini-pro', displayName: 'Gemini Pro', description: 'Advanced model' },
            ],
          }),
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(true);
        expect(result.models?.[0].id).toBe('gemini-pro');
        expect(result.models?.[0].name).toBe('Gemini Pro');
      });

      it('should handle Gemini 401 error', async () => {
        const settings: AISettings = {
          provider: 'gemini',
          apiKey: 'invalid-key',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid API key');
      });
    });

    describe('Custom', () => {
      it('should test custom endpoint with models support', async () => {
        const settings: AISettings = {
          provider: 'custom',
          apiKey: 'custom-key',
          model: 'custom-model',
          customBaseUrl: 'https://my-api.example.com/v1',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'custom-model', owned_by: 'custom' }],
          }),
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(true);
        expect(result.models?.[0].id).toBe('custom-model');
      });

      it('should fallback to chat completion test when models endpoint fails', async () => {
        const settings: AISettings = {
          provider: 'custom',
          apiKey: 'custom-key',
          model: 'custom-model',
          customBaseUrl: 'https://my-api.example.com/v1',
        };
        const client = new AIClient(settings);

        // First call fails (models endpoint not supported)
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        // Second call succeeds (chat completion test)
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Hello' } }],
          }),
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(true);
        expect(result.models).toContainEqual({ id: 'custom-model', name: 'custom-model' });
      });

      it('should handle custom endpoint 401 error', async () => {
        const settings: AISettings = {
          provider: 'custom',
          apiKey: 'invalid-key',
          model: 'custom-model',
          customBaseUrl: 'https://my-api.example.com/v1',
        };
        const client = new AIClient(settings);

        // Models endpoint fails
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        // Chat completion returns 401
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'Invalid token' } }),
        });

        const result = await client.testConnectionAndFetchModels();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid API key or token');
      });

      it('should normalize custom URL with trailing slash', async () => {
        const settings: AISettings = {
          provider: 'custom',
          apiKey: 'custom-key',
          model: 'custom-model',
          customBaseUrl: 'https://my-api.example.com/v1/',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

        await client.testConnectionAndFetchModels();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://my-api.example.com/v1/models',
          expect.any(Object)
        );
      });
    });

    it('should handle unknown provider', async () => {
      const settings = {
        provider: 'unknown' as 'openai',
        apiKey: 'test-key',
      };
      const client = new AIClient(settings);

      const result = await client.testConnectionAndFetchModels();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown AI provider');
    });

    it('should handle network errors', async () => {
      const settings: AISettings = {
        provider: 'openai',
        apiKey: 'sk-test-key',
      };
      const client = new AIClient(settings);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.testConnectionAndFetchModels();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  // ============================================================================
  // Generation Tests
  // ============================================================================

  describe('generate', () => {
    describe('OpenAI', () => {
      it('should generate content successfully', async () => {
        const settings: AISettings = {
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: 'gpt-4',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Generated content' } }],
          }),
        });

        const result = await client.generate({
          prompt: 'Test prompt',
          systemPrompt: 'You are a helpful assistant',
        });

        expect(result.success).toBe(true);
        expect(result.content).toBe('Generated content');
      });

      it('should handle OpenAI generation error', async () => {
        const settings: AISettings = {
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: 'gpt-4',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: { message: 'Rate limit exceeded' } }),
        });

        const result = await client.generate({ prompt: 'Test' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Rate limit exceeded');
      });
    });

    describe('Anthropic', () => {
      it('should generate content successfully', async () => {
        const settings: AISettings = {
          provider: 'anthropic',
          apiKey: 'sk-ant-test-key',
          model: 'claude-3-opus-20240229',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ text: 'Generated by Claude' }],
          }),
        });

        const result = await client.generate({
          prompt: 'Test prompt',
          systemPrompt: 'You are a helpful assistant',
        });

        expect(result.success).toBe(true);
        expect(result.content).toBe('Generated by Claude');
      });
    });

    describe('Gemini', () => {
      it('should generate content successfully', async () => {
        const settings: AISettings = {
          provider: 'gemini',
          apiKey: 'gemini-api-key',
          model: 'gemini-pro',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Generated by Gemini' }] } }],
          }),
        });

        const result = await client.generate({
          prompt: 'Test prompt',
        });

        expect(result.success).toBe(true);
        expect(result.content).toBe('Generated by Gemini');
      });
    });

    describe('Custom', () => {
      it('should generate content successfully', async () => {
        const settings: AISettings = {
          provider: 'custom',
          apiKey: 'custom-key',
          model: 'custom-model',
          customBaseUrl: 'https://my-api.example.com/v1',
        };
        const client = new AIClient(settings);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Custom generated content' } }],
          }),
        });

        const result = await client.generate({
          prompt: 'Test prompt',
        });

        expect(result.success).toBe(true);
        expect(result.content).toBe('Custom generated content');
      });
    });

    it('should handle unknown provider', async () => {
      const settings = {
        provider: 'unknown' as 'openai',
        apiKey: 'test-key',
      };
      const client = new AIClient(settings);

      const result = await client.generate({ prompt: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown AI provider');
    });

    it('should handle network exceptions', async () => {
      const settings: AISettings = {
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      };
      const client = new AIClient(settings);

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await client.generate({ prompt: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  // ============================================================================
  // Feature-Specific Generation Methods Tests
  // ============================================================================

  describe('feature-specific generation methods', () => {
    let client: AIClient;

    beforeEach(() => {
      client = new AIClient({
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Generated response' } }],
        }),
      });
    });

    it('should generate container description', async () => {
      const result = await client.generateContainerDescription({
        containerTitle: 'Test Report',
        containerContent: 'Analysis of APT29',
        pageContent: 'APT29 analysis page content for threat intelligence report.',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should generate scenario', async () => {
      const result = await client.generateScenario({
        scenarioName: 'Phishing Attack',
        scenarioDescription: 'Test scenario',
        pageContent: 'A phishing attack scenario involving malicious email attachments.',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should generate full scenario', async () => {
      const result = await client.generateFullScenario({
        scenarioName: 'Advanced Persistent Threat',
        includeInjects: true,
        pageContent: 'APT group targeting financial institutions with spear-phishing.',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should generate atomic test', async () => {
      const result = await client.generateAtomicTest({
        attackPattern: {
          id: 'attack-pattern-123',
          name: 'Command and Scripting Interpreter',
          description: 'Test description for command execution',
          external_id: 'T1059',
        },
        platformType: 'windows',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should generate emails', async () => {
      const result = await client.generateEmails({
        scenarioName: 'Phishing Campaign',
        scenarioDescription: 'Test phishing scenario',
        language: 'en',
        pageContent: 'Threat intelligence report about phishing attacks targeting employees.',
        attackPatterns: [
          { name: 'Phishing', externalId: 'T1566' },
          { name: 'Spearphishing Attachment', externalId: 'T1566.001' },
        ],
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should discover entities', async () => {
      const result = await client.discoverEntities({
        pageContent: 'APT29 used Emotet malware to target financial institutions',
        existingEntities: [],
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should resolve relationships', async () => {
      const result = await client.resolveRelationships({
        contextText: 'APT29 deployed Emotet against banks',
        entities: [
          { type: 'Intrusion-Set', name: 'APT29' },
          { type: 'Malware', name: 'Emotet' },
        ],
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Default Model Selection Tests
  // ============================================================================

  describe('default model selection', () => {
    it('should use default OpenAI model when not specified', async () => {
      const client = new AIClient({
        provider: 'openai',
        apiKey: 'sk-test-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.generate({ prompt: 'Test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('gpt-5.2'),
        })
      );
    });

    it('should use specified model over default', async () => {
      const client = new AIClient({
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4-turbo',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.generate({ prompt: 'Test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('gpt-4-turbo'),
        })
      );
    });
  });
});

// ============================================================================
// isAIAvailable Tests
// ============================================================================

describe('isAIAvailable', () => {
  it('should return false when settings are undefined', () => {
    expect(isAIAvailable(undefined)).toBe(false);
  });

  it('should return false when provider is missing', () => {
    expect(isAIAvailable({ apiKey: 'key', model: 'model' } as AISettings)).toBe(false);
  });

  it('should return false when apiKey is missing', () => {
    expect(isAIAvailable({ provider: 'openai', model: 'model' } as AISettings)).toBe(false);
  });

  it('should return false when model is missing', () => {
    expect(isAIAvailable({ provider: 'openai', apiKey: 'key' } as AISettings)).toBe(false);
  });

  it('should return true for valid OpenAI settings', () => {
    expect(isAIAvailable({
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4',
    })).toBe(true);
  });

  it('should return true for valid Anthropic settings', () => {
    expect(isAIAvailable({
      provider: 'anthropic',
      apiKey: 'sk-ant-test-key',
      model: 'claude-3-opus',
    })).toBe(true);
  });

  it('should return false for custom provider without customBaseUrl', () => {
    expect(isAIAvailable({
      provider: 'custom',
      apiKey: 'custom-key',
      model: 'custom-model',
    })).toBe(false);
  });

  it('should return true for valid custom provider settings', () => {
    expect(isAIAvailable({
      provider: 'custom',
      apiKey: 'custom-key',
      model: 'custom-model',
      customBaseUrl: 'https://api.example.com/v1',
    })).toBe(true);
  });
});
