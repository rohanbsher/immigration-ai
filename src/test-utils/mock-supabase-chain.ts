import { vi } from 'vitest';

interface ChainResolvedValue {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

/**
 * Creates a chainable mock that mimics Supabase's query builder.
 * Every method returns the chain itself, and the chain is thenable
 * (resolves to the configured value).
 */
export function createMockChain(resolvedValue: ChainResolvedValue = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'is', 'not', 'or', 'in', 'order', 'limit',
    'gte', 'lte', 'lt', 'gt', 'like', 'ilike', 'contains',
    'overlaps', 'match', 'filter',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  // Make the chain thenable (await-able)
  (chain as Record<string, unknown>).then = (resolve: (value: ChainResolvedValue) => void) =>
    Promise.resolve(resolvedValue).then(resolve);
  return chain;
}

/**
 * Creates a minimal mock Supabase client with typed `from` and `rpc` methods.
 */
export function createMockSupabaseFrom() {
  return {
    from: vi.fn(),
    rpc: vi.fn(),
  };
}
