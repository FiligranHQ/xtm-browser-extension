/**
 * Unit Tests for Logger Utility
 * 
 * Tests the logging utility functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  configureLogger,
  setLogLevel,
  setLoggingEnabled,
  getLoggerConfig,
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
    
    // Reset to default config
    configureLogger({
      prefix: '[XTM]',
      minLevel: 'debug',
      enabled: true,
    });
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

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      setLogLevel('debug');
      const log = createLogger();
      
      log.debug('debug message');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should log info messages when level is debug', () => {
      setLogLevel('debug');
      const log = createLogger();
      
      log.info('info message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should not log debug messages when level is info', () => {
      setLogLevel('info');
      const log = createLogger();
      
      log.debug('debug message');
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('should log warn messages when level is warn', () => {
      setLogLevel('warn');
      const log = createLogger();
      
      log.warn('warn message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should not log info messages when level is warn', () => {
      setLogLevel('warn');
      const log = createLogger();
      
      log.info('info message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should log error messages regardless of level', () => {
      setLogLevel('error');
      const log = createLogger();
      
      log.error('error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('logging enabled/disabled', () => {
    it('should not log when logging is disabled', () => {
      setLoggingEnabled(false);
      const log = createLogger();
      
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it('should log when logging is re-enabled', () => {
      setLoggingEnabled(false);
      setLoggingEnabled(true);
      const log = createLogger();
      
      log.info('info message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('configureLogger', () => {
    it('should update logger configuration', () => {
      configureLogger({
        prefix: '[CUSTOM]',
        minLevel: 'error',
      });
      
      const config = getLoggerConfig();
      expect(config.prefix).toBe('[CUSTOM]');
      expect(config.minLevel).toBe('error');
    });

    it('should preserve existing config values when not specified', () => {
      configureLogger({ minLevel: 'info' });
      configureLogger({ prefix: '[NEW]' });
      
      const config = getLoggerConfig();
      expect(config.minLevel).toBe('info');
      expect(config.prefix).toBe('[NEW]');
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
  });
});
