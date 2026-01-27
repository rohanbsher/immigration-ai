/**
 * Centralized logging utility for the Immigration AI application.
 *
 * Provides structured, context-aware logging with support for different
 * log levels and environments. Designed to be easily extended for
 * integration with external logging services (Sentry, LogRocket, etc.).
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * // Basic logging
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Failed to process document', { error, documentId: '456' });
 *
 * // With request context
 * const log = logger.withContext({ requestId: 'abc', userId: '123' });
 * log.info('Processing request');
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  environment: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Log level priority (higher = more important)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level based on environment
function getMinLogLevel(): LogLevel {
  if (process.env.NODE_ENV === 'production') {
    return 'info';
  }
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL as LogLevel;
  }
  return 'debug';
}

/**
 * Serialize an error object for logging.
 */
function serializeError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

/**
 * Format a log entry for output.
 */
function formatLogEntry(entry: LogEntry): string {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Pretty format for development
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level];

    let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  ${entry.error.stack.split('\n').slice(1).join('\n  ')}`;
      }
    }

    return output;
  }

  // JSON format for production (better for log aggregation)
  return JSON.stringify(entry);
}

/**
 * Output a log entry to the appropriate destination.
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Check if a log level should be output based on minimum level.
 */
function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

/**
 * Create a log entry and output it.
 */
function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  baseContext?: LogContext
): void {
  if (!shouldLog(level)) return;

  // Extract error from context if present
  let error: unknown;
  let cleanContext = context;

  if (context?.error) {
    error = context.error;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { error: _, ...rest } = context;
    cleanContext = Object.keys(rest).length > 0 ? rest : undefined;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    context: { ...baseContext, ...cleanContext },
    error: serializeError(error),
  };

  // Clean up empty context
  if (entry.context && Object.keys(entry.context).length === 0) {
    delete entry.context;
  }

  outputLog(entry);
}

/**
 * Logger instance with context support.
 */
class Logger {
  private baseContext?: LogContext;

  constructor(baseContext?: LogContext) {
    this.baseContext = baseContext;
  }

  /**
   * Create a new logger with additional context.
   */
  withContext(context: LogContext): Logger {
    return new Logger({ ...this.baseContext, ...context });
  }

  /**
   * Log a debug message (development only by default).
   */
  debug(message: string, context?: LogContext): void {
    log('debug', message, context, this.baseContext);
  }

  /**
   * Log an informational message.
   */
  info(message: string, context?: LogContext): void {
    log('info', message, context, this.baseContext);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, context?: LogContext): void {
    log('warn', message, context, this.baseContext);
  }

  /**
   * Log an error message.
   */
  error(message: string, context?: LogContext): void {
    log('error', message, context, this.baseContext);
  }

  /**
   * Log an error with the error object.
   */
  logError(message: string, error: unknown, context?: LogContext): void {
    log('error', message, { ...context, error }, this.baseContext);
  }
}

/**
 * Default logger instance.
 */
export const logger = new Logger();

/**
 * Create a logger with a specific component/module name.
 */
export function createLogger(component: string): Logger {
  return new Logger({ component });
}

/**
 * Create a request-scoped logger with request ID.
 */
export function createRequestLogger(requestId: string, userId?: string): Logger {
  return new Logger({
    requestId,
    ...(userId && { userId }),
  });
}

export default logger;
