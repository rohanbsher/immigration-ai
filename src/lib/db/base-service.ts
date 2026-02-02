import { createClient } from '@/lib/supabase/server';
import { createLogger, Logger, type LogContext } from '@/lib/logger';

/**
 * Base service class that provides common functionality for all database services.
 *
 * Eliminates duplicate Supabase client initialization and error handling
 * patterns across 15+ service files.
 *
 * @example
 * ```typescript
 * class ExampleService extends BaseService {
 *   constructor() {
 *     super('example');
 *   }
 *
 *   async getItem(id: string) {
 *     return this.withErrorHandling(async () => {
 *       const supabase = await this.getClient();
 *       const { data, error } = await supabase.from('items').select().eq('id', id).single();
 *       if (error) throw error;
 *       return data;
 *     }, 'getItem', { id });
 *   }
 * }
 * ```
 */
export abstract class BaseService {
  protected logger: Logger;
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = createLogger(`db:${serviceName}`);
  }

  /**
   * Get a Supabase client instance.
   * Centralizes client creation for all services.
   */
  protected async getClient() {
    return createClient();
  }

  /**
   * Wrap an operation with consistent error handling and logging.
   *
   * @param operation - Async function to execute
   * @param context - Error context string for logging
   * @param logContext - Additional context for log entries
   */
  protected async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
    logContext?: LogContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.logError(`Error in ${context}`, error, logContext);
      throw error;
    }
  }

  /**
   * Execute a query and handle null result gracefully.
   * Useful for getById operations where not finding is not an error.
   *
   * @param operation - Async function returning data or null
   * @param context - Error context string for logging
   * @param logContext - Additional context for log entries
   */
  protected async withNullableResult<T>(
    operation: () => Promise<{ data: T | null; error: Error | null }>,
    context: string,
    logContext?: LogContext
  ): Promise<T | null> {
    try {
      const { data, error } = await operation();
      if (error) {
        this.logger.logError(`Error in ${context}`, error, logContext);
        return null;
      }
      return data;
    } catch (error) {
      this.logger.logError(`Error in ${context}`, error, logContext);
      return null;
    }
  }

  /**
   * Execute a query and throw on error.
   * For operations where errors should propagate.
   */
  protected async withRequiredResult<T>(
    operation: () => Promise<{ data: T | null; error: Error | null }>,
    context: string,
    logContext?: LogContext
  ): Promise<T> {
    const { data, error } = await operation();
    if (error) {
      this.logger.logError(`Error in ${context}`, error, logContext);
      throw error;
    }
    if (data === null) {
      const notFoundError = new Error(`${context}: Not found`);
      this.logger.logError(`Error in ${context}`, notFoundError, logContext);
      throw notFoundError;
    }
    return data;
  }
}
