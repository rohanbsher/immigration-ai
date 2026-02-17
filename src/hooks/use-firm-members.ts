'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FirmMember, FirmInvitation, FirmRole } from '@/types/firms';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';

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
  return parseApiResponse<FirmMember[]>(response);
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
  return parseApiResponse<FirmMember>(response);
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
  await parseApiVoidResponse(response);
}

async function fetchInvitations(firmId: string): Promise<FirmInvitation[]> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}/invitations`);
  return parseApiResponse<FirmInvitation[]>(response);
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
  return parseApiResponse<FirmInvitation>(response);
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
  await parseApiVoidResponse(response);
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
  return parseApiResponse(response);
}

async function acceptInvitation(token: string): Promise<FirmMember> {
  const response = await fetchWithTimeout(`/api/firms/invitations/${token}`, {
    method: 'POST',
  });
  return parseApiResponse<FirmMember>(response);
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
