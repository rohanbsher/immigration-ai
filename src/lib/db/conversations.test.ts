import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMessage } from './conversations';

// Mock modules - factory functions can't reference external variables
vi.mock('@/lib/supabase/server', () => {
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockSelectEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));
  const mockUpdate = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn((table: string) => ({
    update: mockUpdate,
    select: mockSelect,
  }));

  return {
    createClient: vi.fn().mockResolvedValue({
      from: mockFrom,
    }),
    // Expose mocks for test access
    __mocks: { mockFrom, mockUpdate, mockEq, mockSelect, mockSelectEq, mockSingle },
  };
});

vi.mock('@/lib/ai/chat', () => ({
  generateConversationTitle: vi.fn().mockResolvedValue('Test Title'),
}));

// Get mock references after import
const getMocks = async () => {
  const supabaseModule = await import('@/lib/supabase/server');
  return (supabaseModule as unknown as {
    __mocks: {
      mockFrom: ReturnType<typeof vi.fn>;
      mockUpdate: ReturnType<typeof vi.fn>;
      mockEq: ReturnType<typeof vi.fn>;
      mockSelect: ReturnType<typeof vi.fn>;
      mockSelectEq: ReturnType<typeof vi.fn>;
      mockSingle: ReturnType<typeof vi.fn>;
    };
  }).__mocks;
};

describe('Conversations DB', () => {
  let mocks: Awaited<ReturnType<typeof getMocks>>;

  beforeEach(async () => {
    mocks = await getMocks();
    vi.clearAllMocks();
    // Default: successful update, no existing metadata
    mocks.mockEq.mockResolvedValue({ error: null });
    mocks.mockSingle.mockResolvedValue({ data: { metadata: null }, error: null });
  });

  describe('updateMessage', () => {
    it('should update content only without fetching metadata', async () => {
      await updateMessage('msg-123', { content: 'Hello world' });

      // Should NOT call select when only updating content
      expect(mocks.mockSelect).not.toHaveBeenCalled();
      expect(mocks.mockUpdate).toHaveBeenCalledWith({ content: 'Hello world' });
      expect(mocks.mockEq).toHaveBeenCalledWith('id', 'msg-123');
    });

    it('should update status and merge with empty existing metadata', async () => {
      mocks.mockSingle.mockResolvedValue({ data: { metadata: null }, error: null });

      await updateMessage('msg-123', { status: 'complete' });

      expect(mocks.mockSelect).toHaveBeenCalledWith('metadata');
      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        metadata: { status: 'complete' },
      });
      expect(mocks.mockEq).toHaveBeenCalledWith('id', 'msg-123');
    });

    it('should preserve existing metadata fields when updating status', async () => {
      // Simulate existing metadata with additional fields
      mocks.mockSingle.mockResolvedValue({
        data: { metadata: { status: 'streaming', tokens: 100, model: 'gpt-4' } },
        error: null,
      });

      await updateMessage('msg-123', { status: 'complete' });

      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        metadata: { status: 'complete', tokens: 100, model: 'gpt-4' },
      });
    });

    it('should update both content and status with metadata merge', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: { metadata: { status: 'streaming' } },
        error: null,
      });

      await updateMessage('msg-123', {
        content: 'Full response',
        status: 'complete',
      });

      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        content: 'Full response',
        metadata: { status: 'complete' },
      });
    });

    it('should throw on metadata fetch error', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Message not found' },
      });

      await expect(
        updateMessage('msg-123', { status: 'error' })
      ).rejects.toThrow('Failed to fetch message for update: Message not found');
    });

    it('should throw on database update error', async () => {
      mocks.mockSingle.mockResolvedValue({ data: { metadata: null }, error: null });
      mocks.mockEq.mockResolvedValue({
        error: { message: 'Connection failed' },
      });

      await expect(
        updateMessage('msg-123', { status: 'error' })
      ).rejects.toThrow('Failed to update message: Connection failed');
    });

    it('should skip update when no changes provided', async () => {
      await updateMessage('msg-123', {});

      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });

    it('should handle error status with partial content', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: { metadata: { status: 'streaming' } },
        error: null,
      });

      await updateMessage('msg-123', {
        content: 'Partial response before failure...',
        status: 'error',
      });

      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        content: 'Partial response before failure...',
        metadata: { status: 'error' },
      });
    });
  });
});
