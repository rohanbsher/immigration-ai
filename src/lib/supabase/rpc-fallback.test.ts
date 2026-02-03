import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rpcWithFallback } from './rpc-fallback';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

describe('rpcWithFallback', () => {
  let mockSupabase: Partial<SupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns RPC result when function exists', async () => {
    const expectedData = { id: 'test-123', updated: true };

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: expectedData, error: null }),
    };

    const result = await rpcWithFallback({
      supabase: mockSupabase as SupabaseClient,
      rpcName: 'update_message_with_metadata',
      rpcParams: { p_message_id: 'msg-1', p_content: 'Hello' },
      fallback: async () => ({ id: 'fallback', updated: false }),
    });

    expect(result).toEqual(expectedData);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_message_with_metadata', {
      p_message_id: 'msg-1',
      p_content: 'Hello',
    });
  });

  it('uses fallback when function does not exist (42883)', async () => {
    const fallbackResult = { id: 'fallback-123', updated: true };

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42883',
          message: 'function update_message_with_metadata does not exist',
        },
      }),
    };

    const fallback = vi.fn().mockResolvedValue(fallbackResult);

    const result = await rpcWithFallback({
      supabase: mockSupabase as SupabaseClient,
      rpcName: 'update_message_with_metadata',
      rpcParams: { p_message_id: 'msg-1' },
      fallback,
      logContext: { messageId: 'msg-1' },
    });

    expect(result).toEqual(fallbackResult);
    expect(fallback).toHaveBeenCalled();
  });

  it('uses fallback when error message indicates missing function', async () => {
    const fallbackResult = { success: true };

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function update_message_with_metadata in the schema cache',
        },
      }),
    };

    const fallback = vi.fn().mockResolvedValue(fallbackResult);

    const result = await rpcWithFallback({
      supabase: mockSupabase as SupabaseClient,
      rpcName: 'update_message_with_metadata',
      rpcParams: {},
      fallback,
    });

    expect(result).toEqual(fallbackResult);
    expect(fallback).toHaveBeenCalled();
  });

  it('throws non-missing-function errors', async () => {
    const dbError = {
      code: '23503',
      message: 'violates foreign key constraint',
    };

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: dbError,
      }),
    };

    const fallback = vi.fn();

    await expect(
      rpcWithFallback({
        supabase: mockSupabase as SupabaseClient,
        rpcName: 'update_message_with_metadata',
        rpcParams: {},
        fallback,
      })
    ).rejects.toEqual(dbError);

    expect(fallback).not.toHaveBeenCalled();
  });

  it('throws when fallback throws', async () => {
    const fallbackError = new Error('Fallback failed');

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42883',
          message: 'function does not exist',
        },
      }),
    };

    await expect(
      rpcWithFallback({
        supabase: mockSupabase as SupabaseClient,
        rpcName: 'missing_function',
        rpcParams: {},
        fallback: async () => {
          throw fallbackError;
        },
      })
    ).rejects.toThrow('Fallback failed');
  });

  it('passes correct parameters to RPC', async () => {
    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
    };

    await rpcWithFallback({
      supabase: mockSupabase as SupabaseClient,
      rpcName: 'complex_function',
      rpcParams: {
        p_id: 'abc',
        p_name: 'test',
        p_nested: { foo: 'bar' },
      },
      fallback: async () => ({}),
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('complex_function', {
      p_id: 'abc',
      p_name: 'test',
      p_nested: { foo: 'bar' },
    });
  });
});
