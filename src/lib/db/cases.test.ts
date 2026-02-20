import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockQueryBuilder,
  mockUser,
  resetMocks,
} from '@/__mocks__/supabase';

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

import { casesService } from './cases';

// Test data factories
const createMockCase = (overrides = {}) => ({
  id: 'case-123',
  attorney_id: 'attorney-456',
  client_id: 'client-789',
  firm_id: 'firm-001',
  visa_type: 'H1B',
  status: 'intake',
  title: 'H1B Visa Application',
  description: 'Test case description',
  priority_date: '2024-01-15',
  deadline: '2024-06-15',
  notes: 'Test notes',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  attorney: {
    id: 'attorney-456',
    first_name: 'John',
    last_name: 'Attorney',
    email: 'john@law.com',
  },
  client: {
    id: 'client-789',
    first_name: 'Jane',
    last_name: 'Client',
    email: 'jane@client.com',
  },
  documents: [{ count: 5 }],
  forms: [{ count: 2 }],
  ...overrides,
});

describe('CasesService', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  describe('getCases', () => {
    it('should fetch cases with default pagination', async () => {
      const mockCases = [createMockCase(), createMockCase({ id: 'case-456' })];
      const queryBuilder = createMockQueryBuilder(mockCases);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCases();

      expect(mockSupabase.from).toHaveBeenCalledWith('cases');
      expect(queryBuilder.select).toHaveBeenCalled();
      expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(queryBuilder.range).toHaveBeenCalledWith(0, 9);
      expect(result.cases).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should transform documents and forms counts', async () => {
      const mockCases = [
        createMockCase({ documents: [{ count: 10 }], forms: [{ count: 3 }] }),
      ];
      const queryBuilder = createMockQueryBuilder(mockCases);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCases();

      expect(result.cases[0].documents_count).toBe(10);
      expect(result.cases[0].forms_count).toBe(3);
    });

    it('should handle missing documents/forms arrays gracefully', async () => {
      const mockCases = [
        createMockCase({ documents: undefined, forms: undefined }),
      ];
      const queryBuilder = createMockQueryBuilder(mockCases);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCases();

      expect(result.cases[0].documents_count).toBe(0);
      expect(result.cases[0].forms_count).toBe(0);
    });

    it('should handle empty documents/forms arrays', async () => {
      const mockCases = [
        createMockCase({ documents: [], forms: [] }),
      ];
      const queryBuilder = createMockQueryBuilder(mockCases);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCases();

      expect(result.cases[0].documents_count).toBe(0);
      expect(result.cases[0].forms_count).toBe(0);
    });

    describe('filters', () => {
      it('should apply single status filter', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ status: 'intake' });

        expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'intake');
      });

      it('should apply array status filter', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ status: ['intake', 'in_review'] });

        expect(queryBuilder.in).toHaveBeenCalledWith('status', ['intake', 'in_review']);
      });

      it('should apply single visa_type filter', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ visa_type: 'H1B' });

        expect(queryBuilder.eq).toHaveBeenCalledWith('visa_type', 'H1B');
      });

      it('should apply array visa_type filter', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ visa_type: ['H1B', 'L1'] });

        expect(queryBuilder.in).toHaveBeenCalledWith('visa_type', ['H1B', 'L1']);
      });

      it('should apply client_id filter', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ client_id: 'client-123' });

        expect(queryBuilder.eq).toHaveBeenCalledWith('client_id', 'client-123');
      });

      it('should apply search filter with sanitized input', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ search: 'visa' });

        expect(queryBuilder.or).toHaveBeenCalledWith('title.ilike.%visa%');
      });

      it('should skip empty search filter', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ search: '' });

        expect(queryBuilder.or).not.toHaveBeenCalled();
      });

      it('should combine multiple filters', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({
          status: 'intake',
          visa_type: 'H1B',
          client_id: 'client-789',
        });

        expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'intake');
        expect(queryBuilder.eq).toHaveBeenCalledWith('visa_type', 'H1B');
        expect(queryBuilder.eq).toHaveBeenCalledWith('client_id', 'client-789');
      });
    });

    describe('pagination', () => {
      it('should use custom page and limit', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({}, { page: 3, limit: 25 });

        expect(queryBuilder.range).toHaveBeenCalledWith(50, 74);
      });

      it('should use custom sort options', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({}, { sortBy: 'title', sortOrder: 'asc' });

        expect(queryBuilder.order).toHaveBeenCalledWith('title', { ascending: true });
      });

      it('should default to page 1, limit 10, descending created_at', async () => {
        const queryBuilder = createMockQueryBuilder([createMockCase()]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases();

        expect(queryBuilder.range).toHaveBeenCalledWith(0, 9);
        expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      });
    });

    it('should return total count from Supabase', async () => {
      const queryBuilder = createMockQueryBuilder([createMockCase()], 42);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCases();

      expect(result.total).toBe(42);
    });

    it('should throw error when query fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.range = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(casesService.getCases()).rejects.toThrow();
    });

    it('should return empty cases when data is null', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.range = vi.fn().mockResolvedValue({
        data: null,
        error: null,
        count: 0,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      // null data should not throw, but map over null/empty
      // Actually the code does `if (error) throw error` then maps over `data || []`
      // so null data without error returns empty array
      const result = await casesService.getCases();
      expect(result.cases).toEqual([]);
    });
  });

  describe('getCase', () => {
    it('should fetch a single case by id', async () => {
      const mockCase = createMockCase();
      const queryBuilder = createMockQueryBuilder([mockCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCase('case-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('cases');
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'case-123');
      expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(queryBuilder.single).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.documents_count).toBe(5);
      expect(result?.forms_count).toBe(2);
    });

    it('should return null when case is not found', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCase('non-existent');

      expect(result).toBeNull();
    });

    it('should handle missing documents/forms in single case', async () => {
      const mockCase = createMockCase({ documents: null, forms: null });
      const queryBuilder = createMockQueryBuilder([mockCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCase('case-123');

      expect(result?.documents_count).toBe(0);
      expect(result?.forms_count).toBe(0);
    });
  });

  describe('createCase', () => {
    it('should create a new case with required fields', async () => {
      const mockCase = createMockCase();
      const queryBuilder = createMockQueryBuilder([mockCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const createData = {
        client_id: 'client-789',
        visa_type: 'H1B' as const,
        title: 'New H1B Case',
      };

      const result = await casesService.createCase(createData, mockUser.id);

      expect(mockSupabase.from).toHaveBeenCalledWith('cases');
      expect(queryBuilder.insert).toHaveBeenCalledWith({
        ...createData,
        attorney_id: mockUser.id,
        firm_id: null,
        status: 'intake',
      });
      expect(queryBuilder.select).toHaveBeenCalled();
      expect(queryBuilder.single).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should set the firm_id when provided', async () => {
      const mockCase = createMockCase();
      const queryBuilder = createMockQueryBuilder([mockCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await casesService.createCase(
        { client_id: 'c', visa_type: 'H1B', title: 'Test' },
        mockUser.id,
        'firm-123'
      );

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ firm_id: 'firm-123' })
      );
    });

    it('should default firm_id to null when not provided', async () => {
      const mockCase = createMockCase();
      const queryBuilder = createMockQueryBuilder([mockCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await casesService.createCase(
        { client_id: 'c', visa_type: 'H1B', title: 'Test' },
        mockUser.id
      );

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ firm_id: null })
      );
    });

    it('should always set initial status to intake', async () => {
      const mockCase = createMockCase();
      const queryBuilder = createMockQueryBuilder([mockCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await casesService.createCase(
        { client_id: 'c', visa_type: 'H1B', title: 'Test' },
        mockUser.id
      );

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'intake' })
      );
    });

    it('should include optional fields when provided', async () => {
      const mockCase = createMockCase();
      const queryBuilder = createMockQueryBuilder([mockCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await casesService.createCase(
        {
          client_id: 'c',
          visa_type: 'H1B',
          title: 'Test',
          description: 'A description',
          priority_date: '2024-06-01',
          deadline: '2024-12-31',
          notes: 'Some notes',
        },
        mockUser.id
      );

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'A description',
          priority_date: '2024-06-01',
          deadline: '2024-12-31',
          notes: 'Some notes',
        })
      );
    });

    it('should throw error when insert fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint violation' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        casesService.createCase(
          { client_id: 'c', visa_type: 'H1B', title: 'Test' },
          mockUser.id
        )
      ).rejects.toThrow();
    });
  });

  describe('updateCase', () => {
    it('should update an existing case', async () => {
      const updatedCase = createMockCase({ title: 'Updated Title' });
      const queryBuilder = createMockQueryBuilder([updatedCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.updateCase('case-123', {
        title: 'Updated Title',
        status: 'in_review',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('cases');
      expect(queryBuilder.update).toHaveBeenCalledWith({
        title: 'Updated Title',
        status: 'in_review',
      });
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'case-123');
      expect(queryBuilder.select).toHaveBeenCalled();
      expect(queryBuilder.single).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should allow nullable fields in update', async () => {
      const updatedCase = createMockCase({ description: null });
      const queryBuilder = createMockQueryBuilder([updatedCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await casesService.updateCase('case-123', {
        description: null,
        notes: null,
        deadline: null,
      });

      expect(queryBuilder.update).toHaveBeenCalledWith({
        description: null,
        notes: null,
        deadline: null,
      });
    });

    it('should throw error when update fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Row not found' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        casesService.updateCase('case-123', { title: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('deleteCase', () => {
    it('should soft-delete a case by setting deleted_at', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await casesService.deleteCase('case-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('cases');
      expect(queryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'case-123');
    });

    it('should set deleted_at to a valid ISO timestamp', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await casesService.deleteCase('case-123');

      const updateCall = queryBuilder.update.mock.calls[0][0];
      expect(new Date(updateCall.deleted_at).toISOString()).toBe(updateCall.deleted_at);
    });

    it('should throw error when delete fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(casesService.deleteCase('case-123')).rejects.toThrow();
    });
  });

  describe('restoreCase', () => {
    it('should restore a soft-deleted case by setting deleted_at to null', async () => {
      const restoredCase = createMockCase({ deleted_at: null });
      const queryBuilder = createMockQueryBuilder([restoredCase]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.restoreCase('case-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('cases');
      expect(queryBuilder.update).toHaveBeenCalledWith({ deleted_at: null });
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'case-123');
      expect(result).toBeDefined();
    });

    it('should throw error when restore fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Row not found' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(casesService.restoreCase('case-123')).rejects.toThrow();
    });
  });

  describe('getCaseStats', () => {
    it('should calculate correct stats', async () => {
      const now = new Date();
      const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      const mockCases = [
        { status: 'intake', deadline: inThreeDays.toISOString() },
        { status: 'intake', deadline: null },
        { status: 'in_review', deadline: inTenDays.toISOString() },
        { status: 'approved', deadline: null },
      ];
      const queryBuilder = createMockQueryBuilder(mockCases);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCaseStats();

      expect(result.total).toBe(4);
      expect(result.byStatus.intake).toBe(2);
      expect(result.byStatus.in_review).toBe(1);
      expect(result.byStatus.approved).toBe(1);
      // Only within next 7 days counts
      expect(result.pendingDeadlines).toBe(1);
    });

    it('should handle empty case list', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCaseStats();

      expect(result.total).toBe(0);
      expect(result.byStatus).toEqual({});
      expect(result.pendingDeadlines).toBe(0);
    });

    it('should exclude deadlines in the past', async () => {
      const pastDate = new Date('2020-01-01').toISOString();
      const mockCases = [{ status: 'intake', deadline: pastDate }];
      const queryBuilder = createMockQueryBuilder(mockCases);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCaseStats();

      expect(result.pendingDeadlines).toBe(0);
    });

    it('should exclude deadlines beyond 7 days', async () => {
      const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const mockCases = [{ status: 'intake', deadline: farFuture }];
      const queryBuilder = createMockQueryBuilder(mockCases);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await casesService.getCaseStats();

      expect(result.pendingDeadlines).toBe(0);
    });

    it('should throw error when query fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.is = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(casesService.getCaseStats()).rejects.toThrow();
    });
  });
});
