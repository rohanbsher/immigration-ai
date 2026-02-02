import { vi } from 'vitest';

// Mock rate limit result
export const mockRateLimitSuccess = {
  success: true,
  limit: 100,
  remaining: 99,
  reset: Date.now() + 60000,
  pending: Promise.resolve(),
};

export const mockRateLimitExceeded = {
  success: false,
  limit: 100,
  remaining: 0,
  reset: Date.now() + 60000,
  pending: Promise.resolve(),
};

// Mock Redis client
export const mockRedisClient = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(-1),
  incr: vi.fn().mockResolvedValue(1),
  decr: vi.fn().mockResolvedValue(0),
  hget: vi.fn().mockResolvedValue(null),
  hset: vi.fn().mockResolvedValue(1),
  hdel: vi.fn().mockResolvedValue(1),
  hgetall: vi.fn().mockResolvedValue({}),
  lpush: vi.fn().mockResolvedValue(1),
  rpush: vi.fn().mockResolvedValue(1),
  lpop: vi.fn().mockResolvedValue(null),
  rpop: vi.fn().mockResolvedValue(null),
  lrange: vi.fn().mockResolvedValue([]),
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  sismember: vi.fn().mockResolvedValue(0),
  zadd: vi.fn().mockResolvedValue(1),
  zrem: vi.fn().mockResolvedValue(1),
  zrange: vi.fn().mockResolvedValue([]),
  zscore: vi.fn().mockResolvedValue(null),
  multi: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue([]),
  }),
  pipeline: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue([]),
  }),
};

// Mock Ratelimit class
export const mockRatelimit = {
  limit: vi.fn().mockResolvedValue(mockRateLimitSuccess),
  blockUntilReady: vi.fn().mockResolvedValue(mockRateLimitSuccess),
  getRemaining: vi.fn().mockResolvedValue(99),
  resetUsedTokens: vi.fn().mockResolvedValue(undefined),
};

// Factory for mock Redis
export const createMockRedis = () => mockRedisClient;

// Factory for mock Ratelimit
export const createMockRatelimit = () => mockRatelimit;

// Helper to simulate rate limit exceeded
export const simulateRateLimitExceeded = () => {
  mockRatelimit.limit.mockResolvedValueOnce(mockRateLimitExceeded);
};

// Helper to set custom remaining count
export const setRateLimitRemaining = (remaining: number) => {
  mockRatelimit.limit.mockResolvedValueOnce({
    ...mockRateLimitSuccess,
    remaining,
  });
};

// Helper to set cached value
export const setCachedValue = (value: unknown) => {
  mockRedisClient.get.mockResolvedValueOnce(
    typeof value === 'string' ? value : JSON.stringify(value)
  );
};

// Reset all mocks
export const resetMocks = () => {
  vi.clearAllMocks();
};

const upstashMocks = {
  mockRateLimitSuccess,
  mockRateLimitExceeded,
  mockRedisClient,
  mockRatelimit,
  createMockRedis,
  createMockRatelimit,
  simulateRateLimitExceeded,
  setRateLimitRemaining,
  setCachedValue,
  resetMocks,
};

export default upstashMocks;
