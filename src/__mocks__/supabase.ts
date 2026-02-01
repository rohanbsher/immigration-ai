import { vi } from 'vitest';

export interface MockUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface MockSession {
  user: MockUser;
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

// Default mock user for testing
export const mockUser: MockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
  app_metadata: { role: 'attorney' },
};

// Default mock session
export const mockSession: MockSession = {
  user: mockUser,
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Date.now() + 3600000,
};

// Mock Supabase Auth
export const mockAuth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
  signInWithPassword: vi.fn().mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null }),
  signUp: vi.fn().mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
  updateUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  mfa: {
    enroll: vi.fn().mockResolvedValue({ data: null, error: null }),
    challenge: vi.fn().mockResolvedValue({ data: null, error: null }),
    verify: vi.fn().mockResolvedValue({ data: null, error: null }),
    unenroll: vi.fn().mockResolvedValue({ data: null, error: null }),
    listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
  },
};

// Mock query builder for chaining
export const createMockQueryBuilder = <T = unknown>(data: T[] = [], count?: number) => {
  const builder = {
    // Basic operations
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),

    // Comparison filters
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),

    // Array/JSON operations
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),

    // Range operations
    range: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),

    // Full-text search
    textSearch: vi.fn().mockReturnThis(),

    // Array overlaps
    overlaps: vi.fn().mockReturnThis(),
    adjacent: vi.fn().mockReturnThis(),

    // Ordering and pagination
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),

    // Result modifiers
    single: vi.fn().mockResolvedValue({ data: data[0] || null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0] || null, error: null }),
    csv: vi.fn().mockReturnThis(),
    geojson: vi.fn().mockReturnThis(),
    explain: vi.fn().mockReturnThis(),
    rollback: vi.fn().mockReturnThis(),
    returns: vi.fn().mockReturnThis(),

    // Thenable
    then: (resolve: (value: { data: T[]; error: null; count: number | null }) => void) =>
      Promise.resolve({ data, error: null, count: count ?? data.length }).then(resolve),
  };
  return builder;
};

// Mock Supabase storage
export const mockStorage = {
  from: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ data: { path: 'mock/path' }, error: null }),
    download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/mock.pdf' } }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
};

// Mock Supabase client factory
export const createMockSupabaseClient = () => ({
  auth: mockAuth,
  from: vi.fn().mockReturnValue(createMockQueryBuilder()),
  storage: mockStorage,
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockResolvedValue('subscribed'),
    unsubscribe: vi.fn().mockResolvedValue('unsubscribed'),
  }),
});

// Mock for @supabase/ssr
export const mockCreateBrowserClient = vi.fn().mockReturnValue(createMockSupabaseClient());
export const mockCreateServerClient = vi.fn().mockReturnValue(createMockSupabaseClient());

// Reset all mocks between tests
export const resetMocks = () => {
  vi.clearAllMocks();
};

export default {
  mockUser,
  mockSession,
  mockAuth,
  mockStorage,
  createMockQueryBuilder,
  createMockSupabaseClient,
  mockCreateBrowserClient,
  mockCreateServerClient,
  resetMocks,
};
