/**
 * Unit Tests for AI Client
 * 
 * Tests the AI client functionality including:
 * - Client instantiation
 * - Helper functions
 * - JSON parsing
 * - Request building
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  AIClient, 
  isAIAvailable, 
  parseAIJsonResponse,
  type AIGenerationRequest,
  type ContainerDescriptionRequest,
  type ScenarioGenerationRequest,
  type AtomicTestRequest,
} from '../../src/shared/api/ai-client';
import type { AISettings } from '../../src/shared/types';

describe('AIClient', () => {
  describe('Constructor', () => {
    it('should create client with valid OpenAI settings', () => {
      const settings: AISettings = {
        enabled: true,
        provider: 'openai',
        apiKey: 'sk-test-key-12345',
      };
      
      const client = new AIClient(settings);
      expect(client).toBeDefined();
    });

    it('should create client with valid Anthropic settings', () => {
      const settings: AISettings = {
        enabled: true,
        provider: 'anthropic',
        apiKey: 'sk-ant-test-key-12345',
      };
      
      const client = new AIClient(settings);
      expect(client).toBeDefined();
    });

    it('should create client with valid Gemini settings', () => {
      const settings: AISettings = {
        enabled: true,
        provider: 'gemini',
        apiKey: 'test-gemini-key-12345',
      };
      
      const client = new AIClient(settings);
      expect(client).toBeDefined();
    });

    it('should throw error when provider is missing', () => {
      const settings = {
        enabled: true,
        apiKey: 'sk-test-key-12345',
      } as AISettings;
      
      expect(() => new AIClient(settings)).toThrow('AI provider and API key are required');
    });

    it('should throw error when API key is missing', () => {
      const settings = {
        enabled: true,
        provider: 'openai',
      } as AISettings;
      
      expect(() => new AIClient(settings)).toThrow('AI provider and API key are required');
    });

    it('should throw error when XTM One is selected (not yet available)', () => {
      const settings: AISettings = {
        enabled: true,
        provider: 'xtm-one',
        apiKey: 'test-key',
      };
      
      expect(() => new AIClient(settings)).toThrow('XTM One is not yet available');
    });
  });
});

describe('isAIAvailable', () => {
  it('should return true when AI is fully configured', () => {
    const settings: AISettings = {
      enabled: true,
      provider: 'openai',
      apiKey: 'sk-test-key',
    };
    
    expect(isAIAvailable(settings)).toBe(true);
  });

  it('should return false when AI is disabled', () => {
    const settings: AISettings = {
      enabled: false,
      provider: 'openai',
      apiKey: 'sk-test-key',
    };
    
    expect(isAIAvailable(settings)).toBe(false);
  });

  it('should return false when provider is missing', () => {
    const settings = {
      enabled: true,
      apiKey: 'sk-test-key',
    } as AISettings;
    
    expect(isAIAvailable(settings)).toBe(false);
  });

  it('should return false when API key is missing', () => {
    const settings = {
      enabled: true,
      provider: 'openai',
    } as AISettings;
    
    expect(isAIAvailable(settings)).toBe(false);
  });

  it('should return false when settings are undefined', () => {
    expect(isAIAvailable(undefined)).toBe(false);
  });

  it('should return false when API key is empty string', () => {
    const settings: AISettings = {
      enabled: true,
      provider: 'openai',
      apiKey: '',
    };
    
    expect(isAIAvailable(settings)).toBe(false);
  });
});

describe('parseAIJsonResponse', () => {
  it('should parse valid JSON directly', () => {
    const json = '{"name": "Test", "value": 123}';
    const result = parseAIJsonResponse<{ name: string; value: number }>(json);
    
    expect(result).toEqual({ name: 'Test', value: 123 });
  });

  it('should parse JSON from markdown code block', () => {
    const markdown = `Here's the response:
\`\`\`json
{
  "name": "Test Scenario",
  "description": "A test description"
}
\`\`\`
That's the result.`;
    
    const result = parseAIJsonResponse<{ name: string; description: string }>(markdown);
    
    expect(result).toEqual({
      name: 'Test Scenario',
      description: 'A test description',
    });
  });

  it('should parse JSON from code block without language tag', () => {
    const markdown = `\`\`\`
{"key": "value"}
\`\`\``;
    
    const result = parseAIJsonResponse<{ key: string }>(markdown);
    
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for invalid JSON', () => {
    const invalid = 'This is not JSON at all';
    const result = parseAIJsonResponse(invalid);
    
    expect(result).toBeNull();
  });

  it('should return null for malformed JSON in code block', () => {
    const markdown = `\`\`\`json
{invalid json here}
\`\`\``;
    
    const result = parseAIJsonResponse(markdown);
    
    expect(result).toBeNull();
  });

  it('should handle complex nested JSON', () => {
    const json = JSON.stringify({
      scenario: {
        name: 'Attack Scenario',
        injects: [
          { title: 'Step 1', type: 'email' },
          { title: 'Step 2', type: 'command' },
        ],
      },
    });
    
    const result = parseAIJsonResponse<{ scenario: { name: string; injects: Array<{ title: string; type: string }> } }>(json);
    
    expect(result?.scenario.name).toBe('Attack Scenario');
    expect(result?.scenario.injects).toHaveLength(2);
  });

  it('should handle JSON arrays', () => {
    const json = '[1, 2, 3, "test"]';
    const result = parseAIJsonResponse<(number | string)[]>(json);
    
    expect(result).toEqual([1, 2, 3, 'test']);
  });
});

describe('AIClient Request Building', () => {
  let client: AIClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new AIClient({
      enabled: true,
      provider: 'openai',
      apiKey: 'sk-test-key',
    });
    
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateContainerDescription', () => {
    it('should build correct request structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Generated description' } }],
        }),
      });

      const request: ContainerDescriptionRequest = {
        pageTitle: 'Test Article',
        pageUrl: 'https://example.com/article',
        pageContent: 'This is the page content about APT29...',
        containerType: 'Report',
        containerName: 'Test Report',
        detectedEntities: ['APT29', 'Cozy Bear'],
        detectedObservables: ['192.168.1.1', 'evil.com'],
      };

      await client.generateContainerDescription(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('openai.com');
      
      const body = JSON.parse(options.body);
      expect(body.messages).toBeDefined();
      expect(body.messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateScenario', () => {
    it('should build correct request structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"name": "test"}' } }],
        }),
      });

      const request: ScenarioGenerationRequest = {
        pageTitle: 'Phishing Campaign Analysis',
        pageUrl: 'https://example.com/analysis',
        pageContent: 'Analysis of recent phishing campaigns...',
        scenarioName: 'Phishing Simulation',
        typeAffinity: 'attack-scenario',
        platformAffinity: ['Windows', 'macOS'],
        detectedAttackPatterns: [
          { name: 'Phishing', id: 'T1566' },
          { name: 'User Execution', id: 'T1204' },
        ],
        detectedDomains: ['malicious.com'],
        detectedEmails: ['attacker@evil.com'],
      };

      await client.generateScenario(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('openai.com');
      
      const body = JSON.parse(options.body);
      expect(body.max_tokens).toBe(2500);
      expect(body.temperature).toBe(0.7);
    });
  });

  describe('generateAtomicTest', () => {
    it('should build correct request structure for Windows', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"name": "test", "executor": "powershell"}' } }],
        }),
      });

      const request: AtomicTestRequest = {
        attackPattern: {
          name: 'Command and Scripting Interpreter',
          id: 'T1059',
          description: 'Adversaries may abuse command and script interpreters...',
          mitrePlatforms: ['Windows', 'Linux', 'macOS'],
        },
        targetPlatform: 'windows',
        context: 'Testing in lab environment',
      };

      await client.generateAtomicTest(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      
      const body = JSON.parse(options.body);
      expect(body.max_tokens).toBe(1000);
      expect(body.temperature).toBe(0.5);
    });

    it('should build correct request structure for Linux', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"name": "test", "executor": "bash"}' } }],
        }),
      });

      const request: AtomicTestRequest = {
        attackPattern: {
          name: 'Unix Shell',
          id: 'T1059.004',
        },
        targetPlatform: 'linux',
      };

      await client.generateAtomicTest(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      });

      const result = await client.generate({
        prompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.generate({
        prompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle unknown provider', async () => {
      // Force a client with an invalid provider (bypassing constructor check)
      const badClient = new AIClient({
        enabled: true,
        provider: 'openai', // valid for construction
        apiKey: 'test-key',
      });
      
      // Manually set to invalid provider
      (badClient as any).provider = 'unknown';

      const result = await badClient.generate({
        prompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown AI provider');
    });
  });
});

describe('Provider-specific API Calls', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call OpenAI API with correct format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenAI response' } }],
      }),
    });

    const client = new AIClient({
      enabled: true,
      provider: 'openai',
      apiKey: 'sk-openai-key',
    });

    const result = await client.generate({
      prompt: 'Test prompt',
      systemPrompt: 'You are a helpful assistant',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBe('OpenAI response');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(options.headers['Authorization']).toBe('Bearer sk-openai-key');
    
    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-5.2');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
  });

  it('should call Anthropic API with correct format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: 'Anthropic response' }],
      }),
    });

    const client = new AIClient({
      enabled: true,
      provider: 'anthropic',
      apiKey: 'sk-anthropic-key',
    });

    const result = await client.generate({
      prompt: 'Test prompt',
      systemPrompt: 'You are a helpful assistant',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBe('Anthropic response');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('sk-anthropic-key');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    
    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-sonnet-4-5');
    expect(body.system).toBe('You are a helpful assistant');
  });

  it('should call Gemini API with correct format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
      }),
    });

    const client = new AIClient({
      enabled: true,
      provider: 'gemini',
      apiKey: 'gemini-api-key',
    });

    const result = await client.generate({
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBe('Gemini response');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('key=gemini-api-key');
  });
});
