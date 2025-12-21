/**
 * Unit Tests for AI Handler Utilities
 * 
 * Tests helper functions used by AI message handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildParsingErrorMessage,
  truncateContent,
} from '../../src/background/handlers/ai-utils';

// Mock the dependencies
vi.mock('../../src/shared/utils/storage', () => ({
  getSettings: vi.fn(),
}));

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
// buildParsingErrorMessage Tests
// ============================================================================

describe('buildParsingErrorMessage', () => {
  it('should indicate JSON found but malformed when content has JSON structure', () => {
    const content = '{ "name": "test", invalid json here }';
    const message = buildParsingErrorMessage(content);
    
    expect(message).toContain('AI response parsing failed');
    expect(message).toContain('JSON found but malformed');
    expect(message).toContain('Preview:');
  });

  it('should indicate no JSON structure when content lacks braces', () => {
    const content = 'This is just plain text with no JSON structure at all';
    const message = buildParsingErrorMessage(content);
    
    expect(message).toContain('AI response parsing failed');
    expect(message).toContain('No JSON structure detected');
  });

  it('should handle custom check with key found', () => {
    const content = '{ "entities": [] }';
    const message = buildParsingErrorMessage(content, { key: 'entities', found: true });
    
    expect(message).toContain('Found "entities" but structure is invalid');
  });

  it('should handle custom check with key not found', () => {
    const content = '{ "other": [] }';
    const message = buildParsingErrorMessage(content, { key: 'entities', found: false });
    
    expect(message).toContain('Missing "entities"');
  });

  it('should truncate preview to 200 characters', () => {
    const content = 'A'.repeat(500);
    const message = buildParsingErrorMessage(content);
    
    expect(message.length).toBeLessThan(500);
    expect(message).toContain('...');
  });

  it('should handle empty content', () => {
    const message = buildParsingErrorMessage('');
    
    expect(message).toContain('AI response parsing failed');
    expect(message).toContain('No JSON structure detected');
  });

  it('should handle content with only opening brace', () => {
    const content = 'This has { but not closing';
    const message = buildParsingErrorMessage(content);
    
    expect(message).toContain('No JSON structure detected');
  });

  it('should handle content with only closing brace', () => {
    const content = 'This has } but not opening';
    const message = buildParsingErrorMessage(content);
    
    expect(message).toContain('No JSON structure detected');
  });

  it('should identify JSON structure with both braces', () => {
    const content = 'Before { "key": "value" } after';
    const message = buildParsingErrorMessage(content);
    
    expect(message).toContain('JSON found but malformed');
  });
});

// ============================================================================
// truncateContent Tests
// ============================================================================

describe('truncateContent', () => {
  it('should return undefined for undefined content', () => {
    const result = truncateContent(undefined, 1000, 'TestHandler');
    expect(result).toBeUndefined();
  });

  it('should return content unchanged when under max length', () => {
    const content = 'Short content';
    const result = truncateContent(content, 1000, 'TestHandler');
    
    expect(result).toBe(content);
  });

  it('should return content unchanged when exactly at max length', () => {
    const content = 'A'.repeat(1000);
    const result = truncateContent(content, 1000, 'TestHandler');
    
    expect(result).toBe(content);
  });

  it('should truncate content exceeding max length', () => {
    const content = 'A'.repeat(2000);
    const result = truncateContent(content, 1000, 'TestHandler');
    
    expect(result).not.toBeUndefined();
    expect(result!.length).toBeLessThan(2000);
    expect(result).toContain('[Content truncated due to size]');
  });

  it('should preserve start of content when truncating', () => {
    const content = 'Important start' + 'X'.repeat(2000);
    const result = truncateContent(content, 100, 'TestHandler');
    
    expect(result).toContain('Important start');
  });

  it('should handle empty string', () => {
    const result = truncateContent('', 1000, 'TestHandler');
    expect(result).toBe('');
  });

  it('should add truncation message at end', () => {
    const content = 'B'.repeat(200);
    const result = truncateContent(content, 100, 'TestHandler');
    
    expect(result).toMatch(/\[Content truncated due to size\]$/);
  });

  it('should preserve newlines in truncation message', () => {
    const content = 'Line 1\nLine 2\n' + 'C'.repeat(200);
    const result = truncateContent(content, 50, 'TestHandler');
    
    expect(result).toContain('\n\n[Content truncated');
  });

  it('should handle very small max length', () => {
    const content = 'Hello World';
    const result = truncateContent(content, 5, 'TestHandler');
    
    expect(result).toContain('[Content truncated');
    expect(result!.length).toBeLessThan(content.length + 50); // Allow for truncation message
  });

  it('should work with different handler names', () => {
    const content = 'D'.repeat(200);
    
    // All should work regardless of handler name (name is for logging)
    const result1 = truncateContent(content, 100, 'Handler1');
    const result2 = truncateContent(content, 100, 'Handler2');
    const result3 = truncateContent(content, 100, 'Another_Handler');
    
    expect(result1).toContain('[Content truncated');
    expect(result2).toContain('[Content truncated');
    expect(result3).toContain('[Content truncated');
  });
});

// ============================================================================
// AIRequestOptions Type Tests (compile-time)
// ============================================================================

describe('AIRequestOptions Type', () => {
  it('should define expected structure for AI requests', () => {
    // This is a type test - if it compiles, the types are correct
    interface TestRequest {
      text: string;
      pageContent?: string;
    }
    
    interface TestResponse {
      result: string;
    }

    const options = {
      handlerName: 'TEST',
      request: { text: 'test' } as TestRequest,
      maxContentLength: 8000,
      truncateField: 'pageContent' as const,
      executeRequest: async (_client: unknown, _request: TestRequest) => 
        ({ success: true, content: '{}' }),
      validateResponse: (parsed: TestResponse) => parsed.result ? null : 'Missing result',
      transformResponse: (parsed: TestResponse) => ({ transformed: parsed.result }),
    };

    expect(options.handlerName).toBe('TEST');
    expect(options.request.text).toBe('test');
    expect(options.maxContentLength).toBe(8000);
    expect(typeof options.executeRequest).toBe('function');
    expect(typeof options.validateResponse).toBe('function');
    expect(typeof options.transformResponse).toBe('function');
  });
});

// ============================================================================
// Error Message Format Tests
// ============================================================================

describe('Error Message Formatting', () => {
  it('should create consistent error message format', () => {
    const shortContent = '{}';
    const longContent = 'X'.repeat(1000);
    
    const shortMessage = buildParsingErrorMessage(shortContent);
    const longMessage = buildParsingErrorMessage(longContent);
    
    // Both should start with the same prefix
    expect(shortMessage).toMatch(/^AI response parsing failed/);
    expect(longMessage).toMatch(/^AI response parsing failed/);
    
    // Both should contain preview
    expect(shortMessage).toContain('Preview:');
    expect(longMessage).toContain('Preview:');
    
    // Long content preview should be truncated
    expect(longMessage.length).toBeLessThan(1000);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  describe('buildParsingErrorMessage edge cases', () => {
    it('should handle special characters in content', () => {
      const content = '{"special": "chars<>&\\""}';
      const message = buildParsingErrorMessage(content);
      
      expect(message).toContain('AI response parsing failed');
    });

    it('should handle unicode content', () => {
      const content = '{"unicode": "日本語テスト"}';
      const message = buildParsingErrorMessage(content);
      
      expect(message).toContain('AI response parsing failed');
    });

    it('should handle newlines in content', () => {
      const content = '{\n  "key": "value"\n}';
      const message = buildParsingErrorMessage(content);
      
      expect(message).toContain('JSON found but malformed');
    });
  });

  describe('truncateContent edge cases', () => {
    it('should handle content with unicode characters', () => {
      const content = '日本語'.repeat(100);
      const result = truncateContent(content, 50, 'TestHandler');
      
      // Should truncate based on string length, not byte length
      expect(result).toBeDefined();
    });

    it('should handle max length of 0', () => {
      const content = 'Any content';
      const result = truncateContent(content, 0, 'TestHandler');
      
      expect(result).toContain('[Content truncated');
    });

    it('should handle whitespace-only content', () => {
      const content = '   ';
      const result = truncateContent(content, 100, 'TestHandler');
      
      expect(result).toBe('   ');
    });
  });
});

// ============================================================================
// executeAIRequest Tests
// ============================================================================

import { getSettings } from '../../src/shared/utils/storage';
import { executeAIRequest, executeSimpleAIRequest, getAIClientOrError } from '../../src/background/handlers/ai-utils';

// Mock AI client module using hoisted mock
const MockAIClientClass = vi.hoisted(() => {
  return class MockAIClient {
    constructor(_config: any) {}
    generateAtomicTest = vi.fn();
    generateDescription = vi.fn();
  };
});

vi.mock('../../src/shared/api/ai-client', () => ({
  AIClient: MockAIClientClass,
  isAIAvailable: vi.fn(),
}));

// Mock JSON parser
vi.mock('../../src/shared/api/ai/json-parser', () => ({
  parseAIJsonResponse: vi.fn(),
}));

import { isAIAvailable } from '../../src/shared/api/ai-client';
import { parseAIJsonResponse } from '../../src/shared/api/ai/json-parser';

const mockGetSettings = vi.mocked(getSettings);
const mockIsAIAvailable = vi.mocked(isAIAvailable);
const mockParseAIJsonResponse = vi.mocked(parseAIJsonResponse);

describe('executeAIRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when AI is not configured', async () => {
    mockGetSettings.mockResolvedValue({ ai: undefined } as any);
    mockIsAIAvailable.mockReturnValue(false);
    
    const sendResponse = vi.fn();
    await executeAIRequest({
      handlerName: 'TEST',
      request: { text: 'test' },
      executeRequest: vi.fn(),
    }, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'AI not configured',
    }));
  });

  it('should execute request and parse successful JSON response', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    mockParseAIJsonResponse.mockReturnValue({ result: 'success' });
    
    const mockExecuteRequest = vi.fn().mockResolvedValue({
      success: true,
      content: '{"result": "success"}',
    });
    
    const sendResponse = vi.fn();
    await executeAIRequest({
      handlerName: 'TEST',
      request: { text: 'test' },
      executeRequest: mockExecuteRequest,
    }, sendResponse);
    
    expect(mockExecuteRequest).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { result: 'success' },
    }));
  });

  it('should handle AI request failure', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    
    const mockExecuteRequest = vi.fn().mockResolvedValue({
      success: false,
      error: 'AI failed',
    });
    
    const sendResponse = vi.fn();
    await executeAIRequest({
      handlerName: 'TEST',
      request: { text: 'test' },
      executeRequest: mockExecuteRequest,
    }, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'AI failed',
    }));
  });

  it('should handle JSON parsing failure', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    mockParseAIJsonResponse.mockReturnValue(null);
    
    const mockExecuteRequest = vi.fn().mockResolvedValue({
      success: true,
      content: 'invalid json',
    });
    
    const sendResponse = vi.fn();
    await executeAIRequest({
      handlerName: 'TEST',
      request: { text: 'test' },
      executeRequest: mockExecuteRequest,
    }, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
    }));
    expect(sendResponse.mock.calls[0][0].error).toContain('AI response parsing failed');
  });

  it('should call validateResponse and handle validation failure', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    mockParseAIJsonResponse.mockReturnValue({ incomplete: true });
    
    const mockExecuteRequest = vi.fn().mockResolvedValue({
      success: true,
      content: '{"incomplete": true}',
    });
    
    const sendResponse = vi.fn();
    await executeAIRequest({
      handlerName: 'TEST',
      request: { text: 'test' },
      executeRequest: mockExecuteRequest,
      validateResponse: (parsed: any) => parsed.result ? null : 'Missing result field',
    }, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Missing result field',
    }));
  });

  it('should apply transformResponse when provided', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    mockParseAIJsonResponse.mockReturnValue({ original: 'data' });
    
    const mockExecuteRequest = vi.fn().mockResolvedValue({
      success: true,
      content: '{"original": "data"}',
    });
    
    const sendResponse = vi.fn();
    await executeAIRequest({
      handlerName: 'TEST',
      request: { text: 'test' },
      executeRequest: mockExecuteRequest,
      transformResponse: (parsed: any) => ({ transformed: parsed.original }),
    }, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { transformed: 'data' },
    }));
  });

  it('should truncate content field when specified', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    mockParseAIJsonResponse.mockReturnValue({ result: 'ok' });
    
    const longContent = 'X'.repeat(10000);
    const mockExecuteRequest = vi.fn().mockResolvedValue({
      success: true,
      content: '{"result": "ok"}',
    });
    
    const sendResponse = vi.fn();
    await executeAIRequest({
      handlerName: 'TEST',
      request: { text: 'test', pageContent: longContent },
      maxContentLength: 1000,
      truncateField: 'pageContent',
      executeRequest: mockExecuteRequest,
    }, sendResponse);
    
    // Verify the request was called with truncated content
    const calledRequest = mockExecuteRequest.mock.calls[0][1];
    expect(calledRequest.pageContent.length).toBeLessThan(longContent.length);
    expect(calledRequest.pageContent).toContain('[Content truncated');
  });

  it('should handle exceptions during execution', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    
    const mockExecuteRequest = vi.fn().mockRejectedValue(new Error('Network error'));
    
    const sendResponse = vi.fn();
    await executeAIRequest({
      handlerName: 'TEST',
      request: { text: 'test' },
      executeRequest: mockExecuteRequest,
    }, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Network error',
    }));
  });
});

// ============================================================================
// executeSimpleAIRequest Tests
// ============================================================================

describe('executeSimpleAIRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when AI is not configured', async () => {
    mockGetSettings.mockResolvedValue({ ai: undefined } as any);
    mockIsAIAvailable.mockReturnValue(false);
    
    const sendResponse = vi.fn();
    await executeSimpleAIRequest('TEST', { text: 'test' }, vi.fn(), sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'AI not configured',
    }));
  });

  it('should execute request and return raw content', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    
    const mockExecuteRequest = vi.fn().mockResolvedValue({
      success: true,
      content: 'Generated description text',
    });
    
    const sendResponse = vi.fn();
    await executeSimpleAIRequest('TEST', { text: 'test' }, mockExecuteRequest, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: 'Generated description text',
    }));
  });

  it('should handle AI request failure', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    
    const mockExecuteRequest = vi.fn().mockResolvedValue({
      success: false,
      error: 'AI generation failed',
    });
    
    const sendResponse = vi.fn();
    await executeSimpleAIRequest('TEST', { text: 'test' }, mockExecuteRequest, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'AI generation failed',
    }));
  });

  it('should handle exceptions during execution', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    
    const mockExecuteRequest = vi.fn().mockRejectedValue(new Error('Connection timeout'));
    
    const sendResponse = vi.fn();
    await executeSimpleAIRequest('TEST', { text: 'test' }, mockExecuteRequest, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Connection timeout',
    }));
  });
});

// ============================================================================
// getAIClientOrError Tests
// ============================================================================

describe('getAIClientOrError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null and send error when AI is not configured', async () => {
    mockGetSettings.mockResolvedValue({ ai: undefined } as any);
    mockIsAIAvailable.mockReturnValue(false);
    
    const sendResponse = vi.fn();
    const result = await getAIClientOrError(sendResponse);
    
    expect(result).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'AI not configured',
    }));
  });

  it('should return AIClient when AI is configured', async () => {
    mockGetSettings.mockResolvedValue({ 
      ai: { provider: 'test', apiKey: 'key' } 
    } as any);
    mockIsAIAvailable.mockReturnValue(true);
    
    const sendResponse = vi.fn();
    const result = await getAIClientOrError(sendResponse);
    
    expect(result).not.toBeNull();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
