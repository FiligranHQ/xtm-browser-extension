/**
 * Logger Utility
 * 
 * Provides structured logging with configurable log levels.
 * In production builds, only WARN and ERROR levels are active.
 * In development, all log levels are enabled.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  /** Prefix for all log messages */
  prefix: string;
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether logging is enabled */
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default configuration - in production, only warn and error
const isDevelopment = typeof process !== 'undefined' 
  ? process.env.NODE_ENV !== 'production'
  : true; // Browser extension context - default to development

const config: LoggerConfig = {
  prefix: '[XTM]',
  minLevel: isDevelopment ? 'debug' : 'warn',
  enabled: true,
};

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

/**
 * Format a log message with prefix and optional context
 */
function formatMessage(context: string | undefined, message: string): string {
  const contextStr = context ? ` [${context}]` : '';
  return `${config.prefix}${contextStr} ${message}`;
}

/**
 * Logger interface for a specific context
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Create a logger instance for a specific context
 * @param context - Optional context name (e.g., 'OpenCTI', 'Cache', 'Background')
 */
export function createLogger(context?: string): Logger {
  return {
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog('debug')) {
        console.debug(formatMessage(context, message), ...args);
      }
    },

    info(message: string, ...args: unknown[]): void {
      if (shouldLog('info')) {
        console.log(formatMessage(context, message), ...args);
      }
    },

    warn(message: string, ...args: unknown[]): void {
      if (shouldLog('warn')) {
        console.warn(formatMessage(context, message), ...args);
      }
    },

    error(message: string, ...args: unknown[]): void {
      if (shouldLog('error')) {
        console.error(formatMessage(context, message), ...args);
      }
    },
  };
}

// Pre-configured loggers for common contexts
export const loggers = {
  background: createLogger('Background'),
  opencti: createLogger('OpenCTI'),
  openaev: createLogger('OpenAEV'),
  cache: createLogger('Cache'),
  detection: createLogger('Detection'),
  content: createLogger('Content'),
  storage: createLogger('Storage'),
  popup: createLogger('Popup'),
  panel: createLogger('Panel'),
  options: createLogger('Options'),
  api: createLogger('API'),
  extraction: createLogger('Extraction'),
  ai: createLogger('AI'),
};
