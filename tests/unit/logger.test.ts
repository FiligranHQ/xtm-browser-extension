/**
 * Unit Tests for Logger Utility
 * 
 * Tests the logging utility functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  loggers,
} from '../../src/shared/utils/logger';

describe('Logger Utility', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with all log methods', () => {
      const log = createLogger();
      expect(log.debug).toBeDefined();
      expect(log.info).toBeDefined();
      expect(log.warn).toBeDefined();
      expect(log.error).toBeDefined();
    });

    it('should create a logger with context', () => {
      const log = createLogger('TestContext');
      log.info('test message');
      
      expect(consoleSpy.log).toHaveBeenCalled();
      const callArgs = consoleSpy.log.mock.calls[0][0];
      expect(callArgs).toContain('[TestContext]');
    });
  });

  describe('log methods', () => {
    it('should call console.debug for debug messages', () => {
      const log = createLogger();
      log.debug('debug message');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should call console.log for info messages', () => {
      const log = createLogger();
      log.info('info message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should call console.warn for warn messages', () => {
      const log = createLogger();
      log.warn('warn message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should call console.error for error messages', () => {
      const log = createLogger();
      log.error('error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('pre-configured loggers', () => {
    it('should have all pre-configured loggers', () => {
      expect(loggers.background).toBeDefined();
      expect(loggers.opencti).toBeDefined();
      expect(loggers.openaev).toBeDefined();
      expect(loggers.cache).toBeDefined();
      expect(loggers.detection).toBeDefined();
      expect(loggers.content).toBeDefined();
      expect(loggers.storage).toBeDefined();
      expect(loggers.popup).toBeDefined();
      expect(loggers.panel).toBeDefined();
      expect(loggers.options).toBeDefined();
      expect(loggers.api).toBeDefined();
      expect(loggers.extraction).toBeDefined();
      expect(loggers.ai).toBeDefined();
    });

    it('should log with correct context prefix', () => {
      loggers.background.info('test');
      expect(consoleSpy.log.mock.calls[0][0]).toContain('[Background]');
      
      loggers.opencti.info('test');
      expect(consoleSpy.log.mock.calls[1][0]).toContain('[OpenCTI]');
    });
  });

  describe('log message formatting', () => {
    it('should include prefix in log messages', () => {
      const log = createLogger();
      log.info('test message');
      
      expect(consoleSpy.log.mock.calls[0][0]).toContain('[XTM]');
    });

    it('should pass additional arguments to console', () => {
      const log = createLogger();
      const obj = { key: 'value' };
      log.info('test message', obj);
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.any(String),
        obj
      );
    });

    it('should format message with context correctly', () => {
      const log = createLogger('MyContext');
      log.info('test message');
      
      const callArgs = consoleSpy.log.mock.calls[0][0];
      expect(callArgs).toContain('[XTM]');
      expect(callArgs).toContain('[MyContext]');
      expect(callArgs).toContain('test message');
    });
  });
});
