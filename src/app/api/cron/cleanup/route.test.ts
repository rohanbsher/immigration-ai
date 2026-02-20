import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock function references — chainable Supabase query builder
// ---------------------------------------------------------------------------
function createChainMock(resolvedData: unknown[] | null = [], error: { message: string } | null = null) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: resolvedData, error }),
  };
  return chain;
}

let documentChain: ReturnType<typeof createChainMock>;
let messageChain: ReturnType<typeof createChainMock>;
let formChain: ReturnType<typeof createChainMock>;

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      if (table === 'documents') return documentChain;
      if (table === 'conversation_messages') return messageChain;
      if (table === 'forms') return formChain;
      return createChainMock();
    },
  }),
}));

vi.mock('@/lib/config', () => ({
  serverEnv: {
    CRON_SECRET: 'test-cron-secret',
  },
  features: {
    cronJobs: true,
  },
}));

vi.mock('@/lib/security/timing-safe', () => ({
  safeCompare: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { GET } from './route';
import { features, serverEnv } from '@/lib/config';
import { safeCompare } from '@/lib/security/timing-safe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRequest(headers?: Record<string, string>) {
  return new NextRequest('http://localhost:3000/api/cron/cleanup', {
    method: 'GET',
    headers: { ...headers },
  });
}

function authedRequest() {
  return createRequest({ authorization: 'Bearer test-cron-secret' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/cron/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(features).cronJobs = true;
    vi.mocked(serverEnv).CRON_SECRET = 'test-cron-secret';
    vi.mocked(safeCompare).mockReturnValue(true);

    // Default: no stuck records
    documentChain = createChainMock([]);
    messageChain = createChainMock([]);
    formChain = createChainMock([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Auth tests --------------------------------------------------------

  it('should return 500 when cronJobs feature is disabled', async () => {
    vi.mocked(features).cronJobs = false;

    const response = await GET(authedRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Server configuration error');
  });

  it('should return 401 when no authorization header', async () => {
    vi.mocked(safeCompare).mockReturnValue(false);

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 when invalid authorization token', async () => {
    vi.mocked(safeCompare).mockReturnValue(false);

    const response = await GET(createRequest({ authorization: 'Bearer wrong' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should accept x-vercel-cron-secret header', async () => {
    vi.mocked(safeCompare).mockImplementation((_a: string, _b: string) => {
      return _a === 'test-cron-secret';
    });

    const response = await GET(createRequest({ 'x-vercel-cron-secret': 'test-cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  // ---- Happy path --------------------------------------------------------

  it('should return 200 with zero counts when no stuck records', async () => {
    const response = await GET(authedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.documentsReset).toBe(0);
    expect(data.messagesReset).toBe(0);
    expect(data.formsReset).toBe(0);
    expect(data.message).toBe('Cleanup complete');
    expect(data.timestamp).toBeDefined();
  });

  it('should return counts of reset records', async () => {
    documentChain = createChainMock([{ id: 'd1' }, { id: 'd2' }]);
    messageChain = createChainMock([{ id: 'm1' }]);
    formChain = createChainMock([{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }]);

    const response = await GET(authedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documentsReset).toBe(2);
    expect(data.messagesReset).toBe(1);
    expect(data.formsReset).toBe(3);
  });

  // ---- Query builder assertions ------------------------------------------

  it('should reset documents stuck in processing', async () => {
    await GET(authedRequest());

    expect(documentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'uploaded' })
    );
    expect(documentChain.eq).toHaveBeenCalledWith('status', 'processing');
    expect(documentChain.lt).toHaveBeenCalledWith('updated_at', expect.any(String));
    expect(documentChain.select).toHaveBeenCalledWith('id');
  });

  it('should mark stuck chat messages as error', async () => {
    await GET(authedRequest());

    expect(messageChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { status: 'error' },
        content: '[Error: Response generation timed out]',
      })
    );
    expect(messageChain.eq).toHaveBeenCalledWith('metadata->>status', 'streaming');
    expect(messageChain.lt).toHaveBeenCalledWith('created_at', expect.any(String));
  });

  it('should reset forms stuck in autofilling', async () => {
    await GET(authedRequest());

    expect(formChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' })
    );
    expect(formChain.eq).toHaveBeenCalledWith('status', 'autofilling');
    expect(formChain.or).toHaveBeenCalledWith(expect.stringContaining('updated_at'));
  });

  // ---- Error handling ----------------------------------------------------

  it('should still succeed when document cleanup fails', async () => {
    documentChain = createChainMock(null, { message: 'doc error' });
    messageChain = createChainMock([{ id: 'm1' }]);
    formChain = createChainMock([]);

    const response = await GET(authedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.documentsReset).toBe(0);
    expect(data.messagesReset).toBe(1);
  });

  it('should still succeed when message cleanup fails', async () => {
    messageChain = createChainMock(null, { message: 'msg error' });

    const response = await GET(authedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.messagesReset).toBe(0);
  });

  it('should still succeed when form cleanup fails', async () => {
    formChain = createChainMock(null, { message: 'form error' });

    const response = await GET(authedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.formsReset).toBe(0);
  });

  it('should handle null data from queries gracefully', async () => {
    documentChain = createChainMock(null);
    messageChain = createChainMock(null);
    formChain = createChainMock(null);

    const response = await GET(authedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documentsReset).toBe(0);
    expect(data.messagesReset).toBe(0);
    expect(data.formsReset).toBe(0);
  });

  it('should return 500 when an unexpected error is thrown', async () => {
    // Force an error by making the chain throw
    documentChain.update = vi.fn(() => { throw new Error('Unexpected crash'); });

    const response = await GET(authedRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to run cleanup');
  });
});
