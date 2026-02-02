import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMessage } from './conversations';

// Mock modules - factory functions can't reference external variables
vi.mock('@/lib/supabase/server', () => {
  const mockEq = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ update: mockUpdate }));

  return {
    createClient: vi.fn().mockResolvedValue({
      from: mockFrom,
    }),
    // Expose mocks for test access
    __mocks: { mockFrom, mockUpdate, mockEq },
  };
});

vi.mock('@/lib/ai/chat', () => ({
  generateConversationTitle: vi.fn().mockResolvedValue('Test Title'),
}));

// Get mock references after import
const getMocks = async () => {
  const supabaseModule = await import('@/lib/supabase/server');
  return (supabaseModule as unknown as { __mocks: { mockFrom: ReturnType<typeof vi.fn>; mockUpdate: ReturnType<typeof vi.fn>; mockEq: ReturnType<typeof vi.fn> } }).__mocks;
};

describe('Conversations DB', () => {
  let mocks: Awaited<ReturnType<typeof getMocks>>;

  beforeEach(async () => {
    mocks = await getMocks();
    vi.clearAllMocks();
    mocks.mockEq.mockResolvedValue({ error: null });
  });

  describe('updateMessage', () => {
    it('should update content only', async () => {
      await updateMessage('msg-123', { content: 'Hello world' });

      expect(mocks.mockUpdate).toHaveBeenCalledWith({ content: 'Hello world' });
      expect(mocks.mockEq).toHaveBeenCalledWith('id', 'msg-123');
    });

    it('should update status only', async () => {
      await updateMessage('msg-123', { status: 'complete' });

      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        metadata: { status: 'complete' },
      });
      expect(mocks.mockEq).toHaveBeenCalledWith('id', 'msg-123');
    });

    it('should update both content and status', async () => {
      await updateMessage('msg-123', {
        content: 'Full response',
        status: 'complete',
      });

      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        content: 'Full response',
        metadata: { status: 'complete' },
      });
    });

    it('should throw on database error', async () => {
      mocks.mockEq.mockResolvedValue({
        error: { message: 'Connection failed' },
      });

      await expect(
        updateMessage('msg-123', { status: 'error' })
      ).rejects.toThrow('Failed to update message: Connection failed');
    });

    it('should handle empty updates', async () => {
      await updateMessage('msg-123', {});

      expect(mocks.mockUpdate).toHaveBeenCalledWith({});
    });

    it('should handle error status with partial content', async () => {
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
