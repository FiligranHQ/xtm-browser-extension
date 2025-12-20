/**
 * Unit Tests for Handler Types and Utilities
 * 
 * Tests response helpers and handler context creation.
 */

import { describe, it, expect } from 'vitest';
import {
  successResponse,
  errorResponse,
  createHandlerContext,
} from '../../src/background/handlers/types';

describe('Handler Types', () => {
  describe('successResponse', () => {
    it('should create a success response with data', () => {
      const data = { foo: 'bar', count: 42 };
      const response = successResponse(data);
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
    });

    it('should handle null data', () => {
      const response = successResponse(null);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it('should handle undefined data', () => {
      const response = successResponse(undefined);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeUndefined();
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const response = successResponse(data);
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual([1, 2, 3]);
    });

    it('should preserve complex nested data', () => {
      const data = {
        nested: {
          deeply: {
            value: 'test',
          },
        },
        array: [{ id: 1 }, { id: 2 }],
      };
      const response = successResponse(data);
      
      expect(response.data).toEqual(data);
    });
  });

  describe('errorResponse', () => {
    it('should create an error response with message', () => {
      const response = errorResponse('Something went wrong');
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
      expect(response.data).toBeUndefined();
    });

    it('should handle empty error message', () => {
      const response = errorResponse('');
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('');
    });

    it('should preserve error message exactly', () => {
      const errorMsg = 'Error: Network timeout (code: 408)';
      const response = errorResponse(errorMsg);
      
      expect(response.error).toBe(errorMsg);
    });
  });

  describe('createHandlerContext', () => {
    it('should return a valid context object', () => {
      const context = createHandlerContext();
      
      expect(context).toBeDefined();
      expect(typeof context.successResponse).toBe('function');
      expect(typeof context.errorResponse).toBe('function');
    });

    it('should have working successResponse function', () => {
      const context = createHandlerContext();
      const response = context.successResponse({ test: true });
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ test: true });
    });

    it('should have working errorResponse function', () => {
      const context = createHandlerContext();
      const response = context.errorResponse('Test error');
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Test error');
    });
  });
});

describe('Response Type Safety', () => {
  it('successResponse should be typed correctly', () => {
    // TypeScript should infer the correct type
    const response = successResponse<{ id: number; name: string }>({ id: 1, name: 'test' });
    
    expect(response.success).toBe(true);
    expect(response.data?.id).toBe(1);
    expect(response.data?.name).toBe('test');
  });

  it('should support generic data types', () => {
    // String data
    const strResponse = successResponse('string data');
    expect(strResponse.data).toBe('string data');
    
    // Number data
    const numResponse = successResponse(42);
    expect(numResponse.data).toBe(42);
    
    // Boolean data
    const boolResponse = successResponse(true);
    expect(boolResponse.data).toBe(true);
  });
});

