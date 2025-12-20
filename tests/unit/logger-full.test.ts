/**
 * Unit Tests for Logger Module
 * 
 * Tests the structured logging utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, loggers, type Logger, type LogLevel } from '../../src/shared/utils/logger';

// ============================================================================
// Test Setup
// ============================================================================

describe('Logger', () => {
  let consoleMock: {
    debug: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    consoleMock = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // createLogger Tests
  // ============================================================================

  describe('createLogger', () => {
    it('should create a logger with all log methods', () => {
      const logger = createLogger();
      
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should create a logger with context', () => {
      const logger = createLogger('TestContext');
      logger.error('test message');
      
      expect(consoleMock.error).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        // No additional args
      );
    });

    it('should create a logger without context', () => {
      const logger = createLogger();
      logger.error('test message');
      
      // Should have XTM prefix but no context
      expect(consoleMock.error).toHaveBeenCalledWith(
        expect.stringContaining('[XTM]'),
      );
    });
  });

  // ============================================================================
  // Logger Methods Tests
  // ============================================================================

  describe('Logger Methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = createLogger('Test');
    });

    describe('debug', () => {
      it('should call console.debug with formatted message', () => {
        logger.debug('test debug message');
        
        // In development mode, debug should be called
        // Note: If minLevel is set higher, this won't be called
        expect(consoleMock.debug).toHaveBeenCalledWith(
          expect.stringContaining('test debug message'),
        );
      });

      it('should pass additional arguments', () => {
        logger.debug('message', { key: 'value' }, 123);
        
        expect(consoleMock.debug).toHaveBeenCalledWith(
          expect.any(String),
          { key: 'value' },
          123,
        );
      });
    });

    describe('info', () => {
      it('should call console.log with formatted message', () => {
        logger.info('test info message');
        
        expect(consoleMock.log).toHaveBeenCalledWith(
          expect.stringContaining('test info message'),
        );
      });

      it('should pass additional arguments', () => {
        logger.info('message', 'arg1', 'arg2');
        
        expect(consoleMock.log).toHaveBeenCalledWith(
          expect.any(String),
          'arg1',
          'arg2',
        );
      });
    });

    describe('warn', () => {
      it('should call console.warn with formatted message', () => {
        logger.warn('test warning message');
        
        expect(consoleMock.warn).toHaveBeenCalledWith(
          expect.stringContaining('test warning message'),
        );
      });

      it('should pass additional arguments', () => {
        const error = new Error('test error');
        logger.warn('warning', error);
        
        expect(consoleMock.warn).toHaveBeenCalledWith(
          expect.any(String),
          error,
        );
      });
    });

    describe('error', () => {
      it('should call console.error with formatted message', () => {
        logger.error('test error message');
        
        expect(consoleMock.error).toHaveBeenCalledWith(
          expect.stringContaining('test error message'),
        );
      });

      it('should pass additional arguments', () => {
        const error = new Error('test error');
        logger.error('error occurred', error);
        
        expect(consoleMock.error).toHaveBeenCalledWith(
          expect.any(String),
          error,
        );
      });

      it('should include context in error messages', () => {
        const contextLogger = createLogger('ErrorContext');
        contextLogger.error('critical error');
        
        expect(consoleMock.error).toHaveBeenCalledWith(
          expect.stringContaining('[ErrorContext]'),
        );
      });
    });
  });

  // ============================================================================
  // Message Formatting Tests
  // ============================================================================

  describe('Message Formatting', () => {
    it('should include XTM prefix', () => {
      const logger = createLogger();
      logger.error('test');
      
      expect(consoleMock.error).toHaveBeenCalledWith(
        expect.stringContaining('[XTM]'),
      );
    });

    it('should include context in brackets', () => {
      const logger = createLogger('MyContext');
      logger.error('test');
      
      const callArg = consoleMock.error.mock.calls[0][0];
      expect(callArg).toContain('[MyContext]');
    });

    it('should handle empty message', () => {
      const logger = createLogger('Test');
      logger.error('');
      
      expect(consoleMock.error).toHaveBeenCalled();
    });

    it('should handle special characters in message', () => {
      const logger = createLogger();
      logger.error('Message with special chars: <>&"\'');
      
      expect(consoleMock.error).toHaveBeenCalledWith(
        expect.stringContaining("<>&\"'"),
      );
    });
  });

  // ============================================================================
  // Pre-configured Loggers Tests
  // ============================================================================

  describe('Pre-configured Loggers', () => {
    it('should have background logger', () => {
      expect(loggers.background).toBeDefined();
      expect(loggers.background.debug).toBeDefined();
      expect(loggers.background.info).toBeDefined();
      expect(loggers.background.warn).toBeDefined();
      expect(loggers.background.error).toBeDefined();
    });

    it('should have opencti logger', () => {
      expect(loggers.opencti).toBeDefined();
    });

    it('should have openaev logger', () => {
      expect(loggers.openaev).toBeDefined();
    });

    it('should have cache logger', () => {
      expect(loggers.cache).toBeDefined();
    });

    it('should have detection logger', () => {
      expect(loggers.detection).toBeDefined();
    });

    it('should have content logger', () => {
      expect(loggers.content).toBeDefined();
    });

    it('should have storage logger', () => {
      expect(loggers.storage).toBeDefined();
    });

    it('should have popup logger', () => {
      expect(loggers.popup).toBeDefined();
    });

    it('should have panel logger', () => {
      expect(loggers.panel).toBeDefined();
    });

    it('should have options logger', () => {
      expect(loggers.options).toBeDefined();
    });

    it('should have api logger', () => {
      expect(loggers.api).toBeDefined();
    });

    it('should have extraction logger', () => {
      expect(loggers.extraction).toBeDefined();
    });

    it('should have ai logger', () => {
      expect(loggers.ai).toBeDefined();
    });

    it('should log with correct context for each logger', () => {
      loggers.background.error('test');
      expect(consoleMock.error).toHaveBeenCalledWith(
        expect.stringContaining('[Background]'),
      );
      
      consoleMock.error.mockClear();
      
      loggers.opencti.error('test');
      expect(consoleMock.error).toHaveBeenCalledWith(
        expect.stringContaining('[OpenCTI]'),
      );
    });
  });

  // ============================================================================
  // Multiple Arguments Tests
  // ============================================================================

  describe('Multiple Arguments', () => {
    it('should handle no additional arguments', () => {
      const logger = createLogger('Test');
      logger.info('simple message');
      
      expect(consoleMock.log).toHaveBeenCalledWith(
        expect.stringContaining('simple message'),
      );
    });

    it('should handle single additional argument', () => {
      const logger = createLogger('Test');
      logger.info('message', { data: 'value' });
      
      expect(consoleMock.log).toHaveBeenCalledWith(
        expect.any(String),
        { data: 'value' },
      );
    });

    it('should handle multiple additional arguments', () => {
      const logger = createLogger('Test');
      logger.info('message', 'arg1', 'arg2', 'arg3');
      
      expect(consoleMock.log).toHaveBeenCalledWith(
        expect.any(String),
        'arg1',
        'arg2',
        'arg3',
      );
    });

    it('should handle mixed argument types', () => {
      const logger = createLogger('Test');
      const error = new Error('test');
      logger.error('error', 123, { key: 'value' }, error, ['array']);
      
      expect(consoleMock.error).toHaveBeenCalledWith(
        expect.any(String),
        123,
        { key: 'value' },
        error,
        ['array'],
      );
    });
  });
});

