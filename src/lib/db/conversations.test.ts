import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMessage } from './conversations';
import { createClient } from '@/lib/supabase/server';

// Mock modules
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai/chat', () => ({
  generateConversationTitle: vi.fn().mockResolvedValue('Test Title'),
}));

describe('Conversations DB', () => {
  let mockRpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createClient).mockResolvedValue({ rpc: mockRpc } as unknown as ReturnType<typeof createClient>);
  });

  describe('updateMessage', () => {
    it('should call RPC with content only', async () => {
      await updateMessage('msg-123', { content: 'Hello world' });

      expect(mockRpc).toHaveBeenCalledWith('update_message_with_metadata', {
        p_message_id: 'msg-123',
        p_content: 'Hello world',
        p_status: null,
      });
    });

    it('should call RPC with status only', async () => {
      await updateMessage('msg-123', { status: 'complete' });

      expect(mockRpc).toHaveBeenCalledWith('update_message_with_metadata', {
        p_message_id: 'msg-123',
        p_content: null,
        p_status: 'complete',
      });
    });

    it('should call RPC with both content and status', async () => {
      await updateMessage('msg-123', { content: 'Full response', status: 'complete' });

      expect(mockRpc).toHaveBeenCalledWith('update_message_with_metadata', {
        p_message_id: 'msg-123',
        p_content: 'Full response',
        p_status: 'complete',
      });
    });

    it('should skip RPC when no updates provided', async () => {
      await updateMessage('msg-123', {});

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('should throw on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Message not found' },
      });

      await expect(updateMessage('msg-123', { status: 'error' }))
        .rejects.toThrow('Message not found');
    });

    it('should handle error status with partial content', async () => {
      await updateMessage('msg-123', {
        content: 'Partial response before failure...',
        status: 'error',
      });

      expect(mockRpc).toHaveBeenCalledWith('update_message_with_metadata', {
        p_message_id: 'msg-123',
        p_content: 'Partial response before failure...',
        p_status: 'error',
      });
    });

    it('should handle streaming status', async () => {
      await updateMessage('msg-123', { status: 'streaming' });

      expect(mockRpc).toHaveBeenCalledWith('update_message_with_metadata', {
        p_message_id: 'msg-123',
        p_content: null,
        p_status: 'streaming',
      });
    });

    describe('RPC fallback behavior', () => {
      it('should fall back when RPC function does not exist', async () => {
        mockRpc.mockResolvedValue({
          data: null,
          error: { code: '42883', message: 'function update_message_with_metadata does not exist' }
        });

        const mockMetadata = { existingKey: 'value' };
        const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { metadata: mockMetadata }, error: null })
          })
        });
        const mockUpdate = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        });
        const mockFrom = vi.fn().mockReturnValue({
          select: mockSelect,
          update: mockUpdate
        });

        vi.mocked(createClient).mockResolvedValue({
          rpc: mockRpc,
          from: mockFrom
        } as unknown as Awaited<ReturnType<typeof createClient>>);

        await updateMessage('msg-123', { status: 'complete' });

        expect(mockFrom).toHaveBeenCalledWith('conversation_messages');
        expect(mockSelect).toHaveBeenCalledWith('metadata');
      });

      it('should throw on fallback fetch error', async () => {
        mockRpc.mockResolvedValue({
          data: null,
          error: { code: '42883', message: 'function does not exist' }
        });

        const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Message not found' }
            })
          })
        });
        const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

        vi.mocked(createClient).mockResolvedValue({
          rpc: mockRpc,
          from: mockFrom
        } as unknown as Awaited<ReturnType<typeof createClient>>);

        await expect(updateMessage('msg-123', { status: 'complete' }))
          .rejects.toThrow('Message not found');
      });
    });
  });
});
