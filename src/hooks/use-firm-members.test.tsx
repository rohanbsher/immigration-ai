import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock fetch-with-timeout
const mockFetchWithTimeout = vi.fn();
vi.mock('@/lib/api/fetch-with-timeout', () => {
  class MockTimeoutError extends Error {
    constructor(timeout: number) {
      super(`Request timed out after ${timeout / 1000} seconds`);
      this.name = 'TimeoutError';
    }
  }
  return {
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
    TimeoutError: MockTimeoutError,
  };
});

// Mock parse-response
const mockParseApiResponse = vi.fn();
const mockParseApiVoidResponse = vi.fn();
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
  parseApiVoidResponse: (...args: unknown[]) => mockParseApiVoidResponse(...args),
}));

import {
  useFirmMembers,
  useUpdateMember,
  useRemoveMember,
  useFirmInvitations,
  useInviteMember,
  useRevokeInvitation,
  useInvitation,
  useAcceptInvitation,
} from './use-firm-members';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = 'TestQueryWrapper';
  return { Wrapper, queryClient };
}

const mockMember = {
  id: 'member-1',
  firmId: 'firm-1',
  userId: 'user-1',
  role: 'attorney' as const,
  title: 'Senior Attorney',
  permissions: {},
  joinedAt: '2026-01-01T00:00:00Z',
  invitedBy: 'owner-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  user: {
    id: 'user-1',
    email: 'attorney@firm.com',
    firstName: 'Jane',
    lastName: 'Smith',
    avatarUrl: null,
  },
};

const mockMembersList = [
  mockMember,
  {
    ...mockMember,
    id: 'member-2',
    userId: 'user-2',
    role: 'staff' as const,
    title: 'Paralegal',
    user: {
      id: 'user-2',
      email: 'staff@firm.com',
      firstName: 'Bob',
      lastName: 'Jones',
      avatarUrl: null,
    },
  },
];

const mockInvitation = {
  id: 'inv-1',
  firmId: 'firm-1',
  email: 'new@firm.com',
  role: 'attorney' as const,
  token: 'invite-token-123',
  status: 'pending' as const,
  invitedBy: 'owner-1',
  acceptedBy: null,
  expiresAt: '2026-03-01T00:00:00Z',
  acceptedAt: null,
  revokedAt: null,
  metadata: {},
  createdAt: '2026-02-20T00:00:00Z',
  updatedAt: '2026-02-20T00:00:00Z',
};

describe('useFirmMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches firm members', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockMembersList);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirmMembers('firm-1'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockMembersList);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1/members');
  });

  test('does not fetch when firmId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirmMembers(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles fetch errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirmMembers('firm-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useUpdateMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates a member role and invalidates queries', async () => {
    const updatedMember = { ...mockMember, role: 'admin' as const };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedMember);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateMember(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        firmId: 'firm-1',
        input: { userId: 'user-1', role: 'admin' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', role: 'admin' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['firm-members', 'firm-1'] });
  });

  test('handles update errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 403 });
    mockParseApiResponse.mockRejectedValue(new Error('Forbidden'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateMember(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        firmId: 'firm-1',
        input: { userId: 'user-1', role: 'admin' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Forbidden');
  });
});

describe('useRemoveMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('removes a member and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRemoveMember(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ firmId: 'firm-1', userId: 'user-2' });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['firm-members', 'firm-1'] });
  });

  test('handles remove errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Member not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRemoveMember(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ firmId: 'firm-1', userId: 'nonexistent' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Member not found');
  });
});

describe('useFirmInvitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches firm invitations', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([mockInvitation]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirmInvitations('firm-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([mockInvitation]);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1/invitations');
  });

  test('does not fetch when firmId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirmInvitations(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });
});

describe('useInviteMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates an invitation and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockInvitation);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInviteMember(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        firmId: 'firm-1',
        input: { email: 'new@firm.com', role: 'attorney' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@firm.com', role: 'attorney' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['firm-invitations', 'firm-1'],
    });
  });

  test('handles invitation errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 409 });
    mockParseApiResponse.mockRejectedValue(new Error('Already invited'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInviteMember(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        firmId: 'firm-1',
        input: { email: 'existing@firm.com', role: 'attorney' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Already invited');
  });
});

describe('useRevokeInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('revokes an invitation and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRevokeInvitation(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ firmId: 'firm-1', invitationId: 'inv-1' });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1/invitations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: 'inv-1' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['firm-invitations', 'firm-1'],
    });
  });
});

describe('useInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches an invitation by token', async () => {
    const invitationDetails = {
      id: 'inv-1',
      email: 'new@firm.com',
      role: 'attorney' as const,
      expiresAt: '2026-03-01T00:00:00Z',
      firm: { id: 'firm-1', name: 'Test Firm', slug: 'test-firm' },
      inviter: { id: 'owner-1', firstName: 'Admin', lastName: 'User', email: 'admin@firm.com' },
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(invitationDetails);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInvitation('invite-token-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(invitationDetails);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/firms/invitations/invite-token-123'
    );
  });

  test('does not fetch when token is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInvitation(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });
});

describe('useAcceptInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('accepts an invitation and invalidates firms queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockMember);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('invite-token-123');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/firms/invitations/invite-token-123',
      { method: 'POST' }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['firms'] });
  });

  test('handles accept errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 410 });
    mockParseApiResponse.mockRejectedValue(new Error('Invitation expired'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('expired-token');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Invitation expired');
  });
});
