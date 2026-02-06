import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Chat message type.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

/**
 * Conversation type.
 */
export interface Conversation {
  id: string;
  caseId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat store state.
 */
interface ChatState {
  // UI state
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Conversation state
  currentConversationId: string | null;
  caseId: string | null;
  messages: ChatMessage[];
  conversations: Conversation[];

  // Actions
  openChat: (caseId?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  setCaseContext: (caseId: string | null) => void;

  // Message actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => string;
  updateMessage: (id: string, content: string) => void;
  setMessageStreaming: (id: string, isStreaming: boolean) => void;
  clearMessages: () => void;

  // Conversation actions
  setConversationId: (id: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  startNewConversation: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Generate unique ID.
 */
function generateId(): string {
  const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
  return `msg_${Date.now()}_${randomPart}`;
}

/**
 * Chat store.
 */
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: false,
      isLoading: false,
      error: null,
      currentConversationId: null,
      caseId: null,
      messages: [],
      conversations: [],

      // UI actions
      openChat: (caseId?: string) => {
        set({
          isOpen: true,
          caseId: caseId || null,
          error: null,
        });
      },

      closeChat: () => {
        set({ isOpen: false });
      },

      toggleChat: () => {
        const { isOpen } = get();
        set({ isOpen: !isOpen });
      },

      setCaseContext: (caseId: string | null) => {
        const { currentConversationId } = get();
        // If changing case context with an existing conversation, start fresh
        if (currentConversationId && caseId !== get().caseId) {
          set({
            caseId,
            currentConversationId: null,
            messages: [],
          });
        } else {
          set({ caseId });
        }
      },

      // Message actions
      addMessage: (message) => {
        const id = generateId();
        const newMessage: ChatMessage = {
          ...message,
          id,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages, newMessage],
        }));

        return id;
      },

      updateMessage: (id: string, content: string) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, content } : msg
          ),
        }));
      },

      setMessageStreaming: (id: string, isStreaming: boolean) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, isStreaming } : msg
          ),
        }));
      },

      clearMessages: () => {
        set({
          messages: [],
          currentConversationId: null,
        });
      },

      // Conversation actions
      setConversationId: (id: string | null) => {
        set({ currentConversationId: id });
      },

      setConversations: (conversations: Conversation[]) => {
        set({ conversations });
      },

      startNewConversation: () => {
        set({
          currentConversationId: null,
          messages: [],
          error: null,
        });
      },

      // Loading state
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error, isLoading: false });
      },
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        // Only persist these fields
        caseId: state.caseId,
        currentConversationId: state.currentConversationId,
        // Don't persist messages - they'll be loaded from server
      }),
    }
  )
);
