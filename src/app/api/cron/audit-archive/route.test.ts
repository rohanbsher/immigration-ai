import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock function references
// ---------------------------------------------------------------------------
const mockRpc = vi.fn();

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
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
  return new NextRequest('http://localhost:3000/api/cron/audit-archive', {
    method: 'GET',
    headers: { ...headers },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/cron/audit-archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(features).cronJobs = true;
    vi.mocked(serverEnv).CRON_SECRET = 'test-cron-secret';
    vi.mocked(safeCompare).mockReturnValue(true);

    // Default: all RPC calls succeed
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'archive_audit_log') {
        return Promise.resolve({ data: 42, error: null });
      }
      if (fnName === 'cleanup_audit_log') {
        return Promise.resolve({ data: 5, error: null });
      }
      if (fnName === 'cleanup_document_access_log') {
        return Promise.resolve({ data: 3, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 500 when cronJobs feature is disabled', async () => {
    vi.mocked(features).cronJobs = false;

    const response = await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));
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

    const response = await GET(createRequest({ authorization: 'Bearer wrong-secret' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should accept x-vercel-cron-secret header', async () => {
    vi.mocked(safeCompare).mockImplementation((_a: string, _b: string) => {
      // Only the vercel cron header comparison returns true
      return _a === 'test-cron-secret';
    });

    const response = await GET(createRequest({ 'x-vercel-cron-secret': 'test-cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 200 with archive and cleanup counts on success', async () => {
    const response = await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.archived).toBe(42);
    expect(data.deleted).toBe(5);
    expect(data.docLogDeleted).toBe(3);
    expect(data.timestamp).toBeDefined();
    expect(data.message).toBe('Audit archive and cleanup complete');
  });

  it('should call archive_audit_log with correct params', async () => {
    await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));

    expect(mockRpc).toHaveBeenCalledWith('archive_audit_log', {
      p_archive_after_years: 1,
      p_batch_size: 5000,
    });
  });

  it('should call cleanup_audit_log with correct params', async () => {
    await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));

    expect(mockRpc).toHaveBeenCalledWith('cleanup_audit_log', {
      p_retention_years: 7,
      p_batch_size: 10000,
    });
  });

  it('should call cleanup_document_access_log with correct params', async () => {
    await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));

    expect(mockRpc).toHaveBeenCalledWith('cleanup_document_access_log', {
      p_retention_years: 7,
      p_batch_size: 10000,
    });
  });

  it('should return 500 when archive phase fails', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'archive_audit_log') {
        return Promise.resolve({ data: null, error: { message: 'Archive DB error' } });
      }
      return Promise.resolve({ data: 0, error: null });
    });

    const response = await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Archive phase failed');
    expect(data.details).toBe('Archive DB error');
  });

  it('should return 500 with partial success when cleanup phase fails', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'archive_audit_log') {
        return Promise.resolve({ data: 10, error: null });
      }
      if (fnName === 'cleanup_audit_log') {
        return Promise.resolve({ data: null, error: { message: 'Cleanup DB error' } });
      }
      return Promise.resolve({ data: 0, error: null });
    });

    const response = await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toBe('Archive succeeded but cleanup failed');
    expect(data.archived).toBe(10);
    expect(data.deleted).toBe(0);
    expect(data.cleanupError).toBe('Cleanup DB error');
  });

  it('should still succeed when document access log cleanup fails (non-fatal)', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'archive_audit_log') {
        return Promise.resolve({ data: 10, error: null });
      }
      if (fnName === 'cleanup_audit_log') {
        return Promise.resolve({ data: 5, error: null });
      }
      if (fnName === 'cleanup_document_access_log') {
        return Promise.resolve({ data: null, error: { message: 'Doc log error' } });
      }
      return Promise.resolve({ data: 0, error: null });
    });

    const response = await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.archived).toBe(10);
    expect(data.deleted).toBe(5);
    expect(data.docLogDeleted).toBe(0);
  });

  it('should default null RPC results to 0', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const response = await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.archived).toBe(0);
    expect(data.deleted).toBe(0);
    expect(data.docLogDeleted).toBe(0);
  });

  it('should return 500 when an unexpected error is thrown', async () => {
    mockRpc.mockImplementation(() => {
      throw new Error('Unexpected crash');
    });

    const response = await GET(createRequest({ authorization: 'Bearer test-cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to run audit archive');
  });
});
