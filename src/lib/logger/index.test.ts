import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createLogger, createRequestLogger } from './index';
import type { LogLevel } from './index';

describe('Logger Module', () => {
  const originalEnv = { ...process.env };
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe('logger instance', () => {
    describe('log levels', () => {
      it('should log debug messages in development', () => {
        logger.debug('Debug message');

        expect(consoleDebugSpy).toHaveBeenCalled();
      });

      it('should log info messages', () => {
        logger.info('Info message');

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it('should log warning messages', () => {
        logger.warn('Warning message');

        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should log error messages', () => {
        logger.error('Error message');

        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('log level filtering', () => {
      it('should not log debug in production', () => {
        process.env.NODE_ENV = 'production';

        logger.debug('Debug message');

        expect(consoleDebugSpy).not.toHaveBeenCalled();
      });

      it('should respect LOG_LEVEL environment variable', () => {
        process.env.LOG_LEVEL = 'warn';

        logger.info('Info message');
        logger.warn('Warning message');

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should allow error logs at all levels', () => {
        process.env.LOG_LEVEL = 'error';

        logger.debug('Debug');
        logger.info('Info');
        logger.warn('Warn');
        logger.error('Error');

        expect(consoleDebugSpy).not.toHaveBeenCalled();
        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('log context', () => {
      it('should include context in log output', () => {
        logger.info('Message with context', { userId: '123', action: 'login' });

        expect(consoleLogSpy).toHaveBeenCalled();
        const logCall = consoleLogSpy.mock.calls[0][0];
        expect(logCall).toContain('userId');
        expect(logCall).toContain('123');
      });

      it('should handle empty context', () => {
        logger.info('Message without context');

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it('should handle nested context objects', () => {
        logger.info('Nested context', {
          user: { id: '123', name: 'John' },
          metadata: { source: 'api' },
        });

        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should log errors with logError method', () => {
        const error = new Error('Test error');
        logger.logError('Failed operation', error);

        expect(consoleErrorSpy).toHaveBeenCalled();
        const logCall = consoleErrorSpy.mock.calls[0][0];
        expect(logCall).toContain('Test error');
      });

      it('should handle string errors', () => {
        logger.logError('Failed', 'String error message');

        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should handle unknown error types', () => {
        logger.logError('Failed', { custom: 'error object' });

        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should include error in context', () => {
        const error = new Error('Context error');
        logger.error('Error with context', { error, requestId: '456' });

        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });

  describe('withContext', () => {
    it('should create a new logger with merged context', () => {
      const contextLogger = logger.withContext({ requestId: 'req-123' });
      contextLogger.info('Contextual message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('requestId');
      expect(logCall).toContain('req-123');
    });

    it('should preserve context across multiple calls', () => {
      const contextLogger = logger.withContext({ sessionId: 'session-1' });

      contextLogger.info('First message');
      contextLogger.info('Second message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('session-1');
      expect(consoleLogSpy.mock.calls[1][0]).toContain('session-1');
    });

    it('should allow chaining withContext calls', () => {
      const contextLogger = logger
        .withContext({ requestId: 'req-1' })
        .withContext({ userId: 'user-1' });

      contextLogger.info('Chained context message');

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('requestId');
      expect(logCall).toContain('userId');
    });

    it('should merge additional context on individual log calls', () => {
      const contextLogger = logger.withContext({ baseContext: 'base' });
      contextLogger.info('Message', { additionalContext: 'extra' });

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('baseContext');
      expect(logCall).toContain('additionalContext');
    });
  });

  describe('createLogger', () => {
    it('should create logger with component name', () => {
      const componentLogger = createLogger('AuthService');
      componentLogger.info('Component message');

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('AuthService');
    });

    it('should include component in all log levels', () => {
      const componentLogger = createLogger('StorageService');

      componentLogger.debug('Debug');
      componentLogger.info('Info');
      componentLogger.warn('Warn');
      componentLogger.error('Error');

      expect(consoleDebugSpy.mock.calls[0][0]).toContain('StorageService');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('StorageService');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('StorageService');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('StorageService');
    });
  });

  describe('createRequestLogger', () => {
    it('should create logger with request ID', () => {
      const requestLogger = createRequestLogger('req-abc-123');
      requestLogger.info('Request processing');

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('req-abc-123');
    });

    it('should include user ID when provided', () => {
      const requestLogger = createRequestLogger('req-123', 'user-456');
      requestLogger.info('Authenticated request');

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('req-123');
      expect(logCall).toContain('user-456');
    });

    it('should not include user ID when not provided', () => {
      const requestLogger = createRequestLogger('req-789');
      requestLogger.info('Anonymous request');

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('req-789');
      expect(logCall).not.toContain('userId');
    });
  });

  describe('log output format', () => {
    describe('development format', () => {
      it('should use colored output in development', () => {
        process.env.NODE_ENV = 'development';
        logger.info('Development message');

        expect(consoleLogSpy).toHaveBeenCalled();
        const logCall = consoleLogSpy.mock.calls[0][0];
        expect(logCall).toContain('[INFO]');
      });

      it('should include stack trace for errors in development', () => {
        process.env.NODE_ENV = 'development';
        const error = new Error('Test error');
        logger.logError('Error occurred', error);

        const logCall = consoleErrorSpy.mock.calls[0][0];
        expect(logCall).toContain('Error:');
      });
    });

    describe('production format', () => {
      it('should use JSON format in production', () => {
        process.env.NODE_ENV = 'production';
        logger.info('Production message');

        const logCall = consoleLogSpy.mock.calls[0][0];
        expect(() => JSON.parse(logCall)).not.toThrow();
      });

      it('should include all fields in JSON output', () => {
        process.env.NODE_ENV = 'production';
        logger.info('Structured message', { key: 'value' });

        const logCall = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logCall);

        expect(parsed).toHaveProperty('level', 'info');
        expect(parsed).toHaveProperty('message', 'Structured message');
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('environment', 'production');
        expect(parsed.context).toHaveProperty('key', 'value');
      });

      it('should include serialized error in JSON output', () => {
        process.env.NODE_ENV = 'production';
        const error = new Error('Production error');
        logger.logError('Failed', error);

        const logCall = consoleErrorSpy.mock.calls[0][0];
        const parsed = JSON.parse(logCall);

        expect(parsed.error).toHaveProperty('name', 'Error');
        expect(parsed.error).toHaveProperty('message', 'Production error');
        expect(parsed.error).toHaveProperty('stack');
      });
    });
  });

  describe('timestamp', () => {
    it('should include ISO timestamp in logs', () => {
      process.env.NODE_ENV = 'production';
      logger.info('Timestamped message');

      const logCall = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logCall);

      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('edge cases', () => {
    it('should handle null context values', () => {
      logger.info('Message', { nullValue: null, undefinedValue: undefined });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle array context values', () => {
      logger.info('Message', { items: [1, 2, 3] });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle circular references gracefully', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      expect(() => {
        logger.info('Circular', circular);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      logger.info(longMessage);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle special characters in messages', () => {
      logger.info('Message with special chars: \n\t\r"\'\\');

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
