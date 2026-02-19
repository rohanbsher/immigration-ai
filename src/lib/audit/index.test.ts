import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditService } from './index';

const mockSupabaseInsert = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseOrder = vi.fn();
const mockSupabaseLimit = vi.fn();
const mockSupabaseSingle = vi.fn();
const mockGetUser = vi.fn();

const mockSupabaseChain = {
  insert: mockSupabaseInsert,
  select: mockSupabaseSelect,
  eq: mockSupabaseEq,
  order: mockSupabaseOrder,
  limit: mockSupabaseLimit,
  single: mockSupabaseSingle,
};

mockSupabaseInsert.mockReturnValue(mockSupabaseChain);
mockSupabaseSelect.mockReturnValue(mockSupabaseChain);
mockSupabaseEq.mockReturnValue(mockSupabaseChain);
mockSupabaseOrder.mockReturnValue(mockSupabaseChain);
mockSupabaseLimit.mockReturnValue(mockSupabaseChain);

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: vi.fn(() => mockSupabaseChain),
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    mockSupabaseSingle.mockResolvedValue({
      data: {
        id: 'audit-log-1',
        table_name: 'cases',
        record_id: 'record-1',
        operation: 'create',
        old_values: null,
        new_values: { name: 'Test' },
        changed_by: 'user-123',
        changed_at: '2024-01-01T00:00:00Z',
      },
      error: null,
    });
  });

  describe('log', () => {
    it('should create audit log entry for create operation', async () => {
      const result = await auditService.log({
        table_name: 'cases',
        record_id: 'record-1',
        operation: 'create',
        new_values: { name: 'Test Case', status: 'active' },
      });

      expect(result).not.toBeNull();
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'cases',
          record_id: 'record-1',
          operation: 'create',
          changed_by: 'user-123',
        })
      );
    });

    it('should redact sensitive fields', async () => {
      await auditService.log({
        table_name: 'profiles',
        record_id: 'profile-1',
        operation: 'create',
        new_values: {
          name: 'John Doe',
          password_hash: 'secret123',
          ssn: '123-45-6789',
          api_key: 'key-abc',
        },
      });

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          new_values: expect.objectContaining({
            name: 'John Doe',
            password_hash: '[REDACTED]',
            ssn: '[REDACTED]',
            api_key: '[REDACTED]',
          }),
        })
      );
    });

    it('should redact nested sensitive fields', async () => {
      await auditService.log({
        table_name: 'profiles',
        record_id: 'profile-1',
        operation: 'update',
        old_values: null,
        new_values: {
          user_info: {
            name: 'Jane',
            social_security_number: '987-65-4321',
          },
        },
      });

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          new_values: expect.objectContaining({
            user_info: expect.objectContaining({
              name: 'Jane',
              social_security_number: '[REDACTED]',
            }),
          }),
        })
      );
    });

    it('should return null when no user is authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
      });

      const result = await auditService.log({
        table_name: 'cases',
        record_id: 'record-1',
        operation: 'create',
        new_values: { name: 'Test' },
      });

      expect(result).toBeNull();
    });

    it('should compute changed fields for update operation', async () => {
      await auditService.log({
        table_name: 'cases',
        record_id: 'record-1',
        operation: 'update',
        old_values: { name: 'Old Name', status: 'draft' },
        new_values: { name: 'New Name', status: 'draft' },
      });

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update',
          old_values: { name: 'Old Name' },
          new_values: { name: 'New Name' },
        })
      );
    });

    it('should skip logging when no actual changes for update', async () => {
      const result = await auditService.log({
        table_name: 'cases',
        record_id: 'record-1',
        operation: 'update',
        old_values: { name: 'Same', status: 'active', updated_at: '2024-01-01' },
        new_values: { name: 'Same', status: 'active', updated_at: '2024-01-02' },
      });

      expect(result).toBeNull();
      expect(mockSupabaseInsert).not.toHaveBeenCalled();
    });

    it('should include ip_address and user_agent', async () => {
      await auditService.log({
        table_name: 'documents',
        record_id: 'doc-1',
        operation: 'access',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      });

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
        })
      );
    });

    it('should include additional_context', async () => {
      await auditService.log({
        table_name: 'documents',
        record_id: 'doc-1',
        operation: 'export',
        additional_context: { format: 'pdf', reason: 'client request' },
      });

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          additional_context: { format: 'pdf', reason: 'client request' },
        })
      );
    });

    it('should handle database insert error', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await auditService.log({
        table_name: 'cases',
        record_id: 'record-1',
        operation: 'create',
        new_values: { name: 'Test' },
      });

      expect(result).toBeNull();
    });

    it('should handle exceptions gracefully', async () => {
      mockGetUser.mockRejectedValueOnce(new Error('Auth service down'));

      const result = await auditService.log({
        table_name: 'cases',
        record_id: 'record-1',
        operation: 'create',
        new_values: { name: 'Test' },
      });

      expect(result).toBeNull();
    });
  });

  describe('logCreate', () => {
    it('should create audit log for create operation', async () => {
      const result = await auditService.logCreate(
        'cases',
        'case-123',
        { name: 'New Case', client_id: 'client-1' },
        { ip_address: '10.0.0.1' }
      );

      expect(result).not.toBeNull();
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'cases',
          record_id: 'case-123',
          operation: 'create',
          ip_address: '10.0.0.1',
        })
      );
    });
  });

  describe('logUpdate', () => {
    it('should create audit log for update operation', async () => {
      await auditService.logUpdate(
        'documents',
        'doc-1',
        { status: 'pending' },
        { status: 'approved' }
      );

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'documents',
          operation: 'update',
        })
      );
    });
  });

  describe('logDelete', () => {
    it('should create audit log for delete operation', async () => {
      await auditService.logDelete('cases', 'case-123', {
        name: 'Deleted Case',
        status: 'active',
      });

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'cases',
          operation: 'delete',
          old_values: expect.objectContaining({
            name: 'Deleted Case',
          }),
        })
      );
    });
  });

  describe('logRestore', () => {
    it('should create audit log for restore operation', async () => {
      await auditService.logRestore('cases', 'case-123', {
        ip_address: '192.168.1.100',
      });

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'cases',
          operation: 'restore',
          ip_address: '192.168.1.100',
        })
      );
    });
  });

  describe('logAccess', () => {
    it('should create audit log for access operation', async () => {
      await auditService.logAccess('documents', 'doc-1', {
        additional_context: { purpose: 'case review' },
      });

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'documents',
          operation: 'access',
          additional_context: { purpose: 'case review' },
        })
      );
    });
  });

  describe('logExport', () => {
    it('should create audit log for export operation', async () => {
      await auditService.logExport(
        'cases',
        'case-123',
        { format: 'csv', fields: ['name', 'status'] },
        { user_agent: 'ExportBot/1.0' }
      );

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'cases',
          operation: 'export',
          additional_context: { format: 'csv', fields: ['name', 'status'] },
          user_agent: 'ExportBot/1.0',
        })
      );
    });
  });

  describe('getLogsForRecord', () => {
    it('should retrieve logs for a specific record', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          table_name: 'cases',
          record_id: 'case-123',
          operation: 'create',
          changed_at: '2024-01-01',
        },
        {
          id: 'log-2',
          table_name: 'cases',
          record_id: 'case-123',
          operation: 'update',
          changed_at: '2024-01-02',
        },
      ];

      mockSupabaseLimit.mockResolvedValueOnce({ data: mockLogs, error: null });

      const result = await auditService.getLogsForRecord('cases', 'case-123');

      expect(result).toEqual(mockLogs);
      expect(mockSupabaseSelect).toHaveBeenCalledWith('*');
      expect(mockSupabaseEq).toHaveBeenCalledWith('table_name', 'cases');
      expect(mockSupabaseOrder).toHaveBeenCalledWith('changed_at', {
        ascending: false,
      });
      expect(mockSupabaseLimit).toHaveBeenCalledWith(50);
    });

    it('should use custom limit', async () => {
      mockSupabaseLimit.mockResolvedValueOnce({ data: [], error: null });

      await auditService.getLogsForRecord('cases', 'case-123', 100);

      expect(mockSupabaseLimit).toHaveBeenCalledWith(100);
    });

    it('should return empty array on error', async () => {
      mockSupabaseLimit.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await auditService.getLogsForRecord('cases', 'case-123');

      expect(result).toEqual([]);
    });
  });

  describe('getLogsByUser', () => {
    it('should retrieve logs by user ID', async () => {
      const mockLogs = [
        { id: 'log-1', changed_by: 'user-123' },
        { id: 'log-2', changed_by: 'user-123' },
      ];

      mockSupabaseLimit.mockResolvedValueOnce({ data: mockLogs, error: null });

      const result = await auditService.getLogsByUser('user-123');

      expect(result).toEqual(mockLogs);
      expect(mockSupabaseEq).toHaveBeenCalledWith('changed_by', 'user-123');
      expect(mockSupabaseLimit).toHaveBeenCalledWith(100);
    });

    it('should use custom limit', async () => {
      mockSupabaseLimit.mockResolvedValueOnce({ data: [], error: null });

      await auditService.getLogsByUser('user-123', 50);

      expect(mockSupabaseLimit).toHaveBeenCalledWith(50);
    });

    it('should return empty array on error', async () => {
      mockSupabaseLimit.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await auditService.getLogsByUser('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getRecentLogs', () => {
    it('should retrieve recent logs', async () => {
      const mockLogs = [
        { id: 'log-3', changed_at: '2024-01-03' },
        { id: 'log-2', changed_at: '2024-01-02' },
        { id: 'log-1', changed_at: '2024-01-01' },
      ];

      mockSupabaseLimit.mockResolvedValueOnce({ data: mockLogs, error: null });

      const result = await auditService.getRecentLogs();

      expect(result).toEqual(mockLogs);
      expect(mockSupabaseSelect).toHaveBeenCalledWith('*');
      expect(mockSupabaseOrder).toHaveBeenCalledWith('changed_at', {
        ascending: false,
      });
      expect(mockSupabaseLimit).toHaveBeenCalledWith(100);
    });

    it('should use custom limit', async () => {
      mockSupabaseLimit.mockResolvedValueOnce({ data: [], error: null });

      await auditService.getRecentLogs(25);

      expect(mockSupabaseLimit).toHaveBeenCalledWith(25);
    });

    it('should return empty array on error', async () => {
      mockSupabaseLimit.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await auditService.getRecentLogs();

      expect(result).toEqual([]);
    });
  });
});
