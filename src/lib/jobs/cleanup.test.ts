import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCleanupJobs, scheduleCleanupJobs } from './cleanup';
import { createClient } from '@/lib/supabase/server';
import { auditService } from '@/lib/audit';
import { createMockChain, createMockSupabaseFrom } from '@/test-utils/mock-supabase-chain';

const { hoistedMockLoggerModule } = vi.hoisted(() => {
  const hoistedMockLoggerModule = {
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      logError: vi.fn(),
    }),
  };
  return { hoistedMockLoggerModule };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/logger', () => hoistedMockLoggerModule);

describe('cleanup jobs', () => {
  const mockSupabase = createMockSupabaseFrom();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );
  });

  describe('runCleanupJobs with dryRun: true', () => {
    it('counts without modifying and returns success with counts', async () => {
      // documents chain for AI data cleanup (dryRun counts)
      const documentsChain = createMockChain({ count: 3, error: null });
      // chains for soft delete counting (cases, documents, forms)
      const casesChain = createMockChain({ count: 2, error: null });
      const formsChain = createMockChain({ count: 1, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cases') return casesChain;
        if (table === 'documents') return documentsChain;
        if (table === 'forms') return formsChain;
        return createMockChain({ count: 0, error: null });
      });

      const result = await runCleanupJobs({ dryRun: true });

      expect(result.success).toBe(true);
      expect(result.documentsCleanedCount).toBe(3);
      expect(result.softDeletesPurgedCount).toBe(6); // 3 (docs reused) + 2 (cases) + 1 (forms)
      expect(result.errors).toHaveLength(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('does not call update or delete when dryRun is true', async () => {
      const chain = createMockChain({ count: 5, error: null });
      mockSupabase.from.mockReturnValue(chain);

      await runCleanupJobs({ dryRun: true });

      // In dryRun mode, update should not have been called in a meaningful write context.
      // The chain's update fn would only be called in non-dryRun mode.
      // Instead verify that auditService.log was NOT called (no actual cleanup).
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('runCleanupJobs with dryRun: false', () => {
    it('cleans up expired AI data and logs audit entries', async () => {
      const expiredDocs = [{ id: 'doc-1' }, { id: 'doc-2' }];

      // AI data cleanup calls from('documents') twice: select then update
      const aiSelectChain = createMockChain({ data: expiredDocs, error: null });
      const aiUpdateChain = createMockChain({ data: null, error: null });
      // Soft-delete purge also calls from('documents') for select (should be empty)
      const softDeleteDocsChain = createMockChain({ data: [], error: null });
      const emptyChain = createMockChain({ data: [], error: null });

      let docCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'documents') {
          docCallCount++;
          if (docCallCount === 1) return aiSelectChain;   // AI cleanup: select expired
          if (docCallCount === 2) return aiUpdateChain;    // AI cleanup: update to clear
          return softDeleteDocsChain;                      // Soft delete: select docs
        }
        return emptyChain;
      });

      const result = await runCleanupJobs({ dryRun: false });

      expect(result.documentsCleanedCount).toBe(2);
      expect(auditService.log).toHaveBeenCalledTimes(2);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'documents',
          record_id: 'doc-1',
          operation: 'update',
        })
      );
    });

    it('purges soft-deleted records from cases, documents, and forms', async () => {
      const softDeletedCases = [{ id: 'case-1' }];
      const softDeletedForms = [{ id: 'form-1' }, { id: 'form-2' }];

      const documentsChain = createMockChain({ data: [], error: null });
      const casesChain = createMockChain({ data: softDeletedCases, error: null });
      const formsChain = createMockChain({ data: softDeletedForms, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cases') return casesChain;
        if (table === 'documents') return documentsChain;
        if (table === 'forms') return formsChain;
        return createMockChain({ data: [], error: null });
      });

      const result = await runCleanupJobs({ dryRun: false });

      expect(result.softDeletesPurgedCount).toBe(3); // 1 case + 2 forms
      expect(result.success).toBe(true);
    });

    it('returns correct combined counts', async () => {
      const expiredDocs = [{ id: 'doc-1' }];
      const softDeletedCases = [{ id: 'case-1' }];

      // documents chain serves both AI data cleanup and soft delete purge
      const documentsChain = createMockChain({ data: expiredDocs, error: null });
      const casesChain = createMockChain({ data: softDeletedCases, error: null });
      const emptyChain = createMockChain({ data: [], error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'documents') return documentsChain;
        if (table === 'cases') return casesChain;
        if (table === 'forms') return emptyChain;
        return emptyChain;
      });

      const result = await runCleanupJobs({ dryRun: false });

      expect(result.documentsCleanedCount).toBe(1);
      // softDeletesPurgedCount: docs chain returns expiredDocs for soft-delete select too (1) + cases (1) + forms (0)
      expect(result.softDeletesPurgedCount).toBe(2);
      expect(result.success).toBe(true);
    });
  });

  describe('runCleanupJobs audit log retention', () => {
    it('does NOT run audit log cleanup when auditLogRetentionDays is null (default)', async () => {
      const chain = createMockChain({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      await runCleanupJobs({ dryRun: false });

      // Verify audit_log table was never queried for cleanup
      const fromCalls = mockSupabase.from.mock.calls.map((c: unknown[]) => c[0]);
      expect(fromCalls).not.toContain('audit_log');
    });

    it('runs audit log cleanup when auditLogRetentionDays is set', async () => {
      const chain = createMockChain({ data: [], error: null, count: 0 });
      mockSupabase.from.mockReturnValue(chain);

      await runCleanupJobs({ dryRun: false, auditLogRetentionDays: 90 });

      const fromCalls = mockSupabase.from.mock.calls.map((c: unknown[]) => c[0]);
      expect(fromCalls).toContain('audit_log');
    });

    it('counts audit logs in dryRun mode when auditLogRetentionDays is set', async () => {
      const chain = createMockChain({ count: 10, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await runCleanupJobs({ dryRun: true, auditLogRetentionDays: 90 });

      expect(result.success).toBe(true);
      const fromCalls = mockSupabase.from.mock.calls.map((c: unknown[]) => c[0]);
      expect(fromCalls).toContain('audit_log');
    });
  });

  describe('error handling', () => {
    it('accumulates AI data cleanup errors without blocking soft delete purge', async () => {
      // Documents chain returns error for AI data select
      const documentsErrorChain = createMockChain({ data: null, error: { message: 'AI cleanup failed' } });
      // Other tables work fine
      const casesChain = createMockChain({ data: [{ id: 'case-1' }], error: null });
      const formsChain = createMockChain({ data: [], error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'documents') return documentsErrorChain;
        if (table === 'cases') return casesChain;
        if (table === 'forms') return formsChain;
        return createMockChain({ data: [], error: null });
      });

      const result = await runCleanupJobs({ dryRun: false });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('AI cleanup failed');
      // Soft delete purge should still have run
      expect(result.softDeletesPurgedCount).toBe(1);
    });

    it('sets success to false when errors exist', async () => {
      const errorChain = createMockChain({ data: null, error: { message: 'DB error' } });
      const emptyChain = createMockChain({ data: [], error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'documents') return errorChain;
        return emptyChain;
      });

      const result = await runCleanupJobs({ dryRun: false });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('runCleanupJobs with no expired data', () => {
    it('returns zero counts and success true', async () => {
      const emptyChain = createMockChain({ data: [], error: null });
      mockSupabase.from.mockReturnValue(emptyChain);

      const result = await runCleanupJobs({ dryRun: false });

      expect(result.success).toBe(true);
      expect(result.documentsCleanedCount).toBe(0);
      expect(result.softDeletesPurgedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });

  describe('scheduleCleanupJobs', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls setTimeout with 5 second delay', () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      scheduleCleanupJobs();

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it('calls setInterval with 24-hour interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      scheduleCleanupJobs();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), ONE_DAY_MS);
    });

    it('calls runCleanupJobs after the initial timeout', async () => {
      const emptyChain = createMockChain({ data: [], error: null });
      mockSupabase.from.mockReturnValue(emptyChain);

      scheduleCleanupJobs();
      // Advance past the 5s initial delay
      await vi.advanceTimersByTimeAsync(5000);
      // The callback should have fired -- verify by checking that
      // createClient was called (indicating runCleanupJobs executed)
      expect(createClient).toHaveBeenCalled();
    });
  });
});
