'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FirmMember, FirmInvitation, FirmRole } from '@/types/firms';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

interface UpdateMemberInput {
  userId: string;
  role?: FirmRole;
  title?: string;
  permissions?: Record<string, boolean>;
}

interface InviteMemberInput {
  email: string;
  role: FirmRole;
}

async function fetchMembers(firmId: string): Promise<FirmMember[]> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}/members`);

  if (!response.ok) {
    throw new Error('Failed to fetch members');
  }

  const data = await response.json();
  return data.data;
}

async function updateMember({
  firmId,
  input,
}: {
  firmId: string;
  input: UpdateMemberInput;
}): Promise<FirmMember> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}/members`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update member');
  }

  const data = await response.json();
  return data.data;
}

async function removeMember({
  firmId,
  userId,
}: {
  firmId: string;
  userId: string;
}): Promise<void> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}/members`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove member');
  }
}

async function fetchInvitations(firmId: string): Promise<FirmInvitation[]> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}/invitations`);

  if (!response.ok) {
    throw new Error('Failed to fetch invitations');
  }

  const data = await response.json();
  return data.data;
}

async function createInvitation({
  firmId,
  input,
}: {
  firmId: string;
  input: InviteMemberInput;
}): Promise<FirmInvitation> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create invitation');
  }

  const data = await response.json();
  return data.data;
}

async function revokeInvitation({
  firmId,
  invitationId,
}: {
  firmId: string;
  invitationId: string;
}): Promise<void> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}/invitations`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to revoke invitation');
  }
}

async function fetchInvitation(token: string): Promise<{
  id: string;
  email: string;
  role: FirmRole;
  expiresAt: string;
  firm: { id: string; name: string; slug: string };
  inviter: { id: string; firstName: string | null; lastName: string | null; email: string };
}> {
  const response = await fetchWithTimeout(`/api/firms/invitations/${token}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch invitation');
  }

  const data = await response.json();
  return data.data;
}

async function acceptInvitation(token: string): Promise<FirmMember> {
  const response = await fetchWithTimeout(`/api/firms/invitations/${token}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept invitation');
  }

  const data = await response.json();
  return data.data;
}

export function useFirmMembers(firmId: string | undefined) {
  return useQuery({
    queryKey: ['firm-members', firmId],
    queryFn: () => fetchMembers(firmId!),
    enabled: !!firmId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMember,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['firm-members', variables.firmId] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeMember,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['firm-members', variables.firmId] });
    },
  });
}

export function useFirmInvitations(firmId: string | undefined) {
  return useQuery({
    queryKey: ['firm-invitations', firmId],
    queryFn: () => fetchInvitations(firmId!),
    enabled: !!firmId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInvitation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['firm-invitations', variables.firmId] });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeInvitation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['firm-invitations', variables.firmId] });
    },
  });
}

export function useInvitation(token: string | undefined) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () => fetchInvitation(token!),
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firms'] });
    },
  });
}
