import { createClient } from '@/lib/supabase/server';
import type {
  Firm,
  FirmMember,
  FirmInvitation,
  CreateFirmInput,
  UpdateFirmInput,
  FirmRole,
} from '@/types/firms';

function mapFirmFromDb(row: Record<string, unknown>): Firm {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    ownerId: row.owner_id as string,
    logoUrl: row.logo_url as string | null,
    website: row.website as string | null,
    phone: row.phone as string | null,
    address: (row.address as Record<string, string>) || {},
    settings: (row.settings as Record<string, unknown>) || {},
    subscriptionId: row.subscription_id as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: row.deleted_at as string | null,
  };
}

function mapMemberFromDb(row: Record<string, unknown>): FirmMember {
  const user = row.profiles as Record<string, unknown> | null;
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    userId: row.user_id as string,
    role: row.role as FirmRole,
    title: row.title as string | null,
    permissions: (row.permissions as Record<string, boolean>) || {},
    joinedAt: row.joined_at as string,
    invitedBy: row.invited_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    user: user
      ? {
          id: user.id as string,
          email: user.email as string,
          firstName: user.first_name as string | null,
          lastName: user.last_name as string | null,
          avatarUrl: user.avatar_url as string | null,
        }
      : undefined,
  };
}

function mapInvitationFromDb(row: Record<string, unknown>): FirmInvitation {
  const firm = row.firms as Record<string, unknown> | null;
  const inviter = row.inviter as Record<string, unknown> | null;
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    email: row.email as string,
    role: row.role as FirmRole,
    token: row.token as string,
    status: row.status as FirmInvitation['status'],
    invitedBy: row.invited_by as string,
    acceptedBy: row.accepted_by as string | null,
    expiresAt: row.expires_at as string,
    acceptedAt: row.accepted_at as string | null,
    revokedAt: row.revoked_at as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    firm: firm
      ? {
          id: firm.id as string,
          name: firm.name as string,
          slug: firm.slug as string,
        }
      : undefined,
    inviter: inviter
      ? {
          id: inviter.id as string,
          firstName: inviter.first_name as string | null,
          lastName: inviter.last_name as string | null,
          email: inviter.email as string,
        }
      : undefined,
  };
}

export async function createFirm(input: CreateFirmInput, ownerId: string): Promise<Firm> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_firm_with_owner', {
    p_name: input.name,
    p_owner_id: ownerId,
    p_logo_url: input.logoUrl || null,
    p_website: input.website || null,
    p_phone: input.phone || null,
  });

  if (error) {
    throw new Error(`Failed to create firm: ${error.message}`);
  }

  return mapFirmFromDb(data);
}

export async function getFirmById(firmId: string): Promise<Firm | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('firms')
    .select('*')
    .eq('id', firmId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return null;
  }

  return mapFirmFromDb(data);
}

export async function getFirmBySlug(slug: string): Promise<Firm | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('firms')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return null;
  }

  return mapFirmFromDb(data);
}

export async function getUserFirms(userId: string): Promise<Firm[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('firm_members')
    .select(`
      firm_id,
      firms (*)
    `)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch user firms: ${error.message}`);
  }

  return (data || [])
    .filter((row) => {
      const firm = row.firms as unknown as Record<string, unknown> | null;
      return firm && !firm.deleted_at;
    })
    .map((row) => mapFirmFromDb(row.firms as unknown as Record<string, unknown>));
}

export async function updateFirm(firmId: string, input: UpdateFirmInput): Promise<Firm> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.logoUrl !== undefined) updateData.logo_url = input.logoUrl;
  if (input.website !== undefined) updateData.website = input.website;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.settings !== undefined) updateData.settings = input.settings;

  const { data, error } = await supabase
    .from('firms')
    .update(updateData)
    .eq('id', firmId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update firm: ${error.message}`);
  }

  return mapFirmFromDb(data);
}

export async function deleteFirm(firmId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('firms')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', firmId);

  if (error) {
    throw new Error(`Failed to delete firm: ${error.message}`);
  }
}

export async function getFirmMembers(firmId: string): Promise<FirmMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('firm_members')
    .select(`
      *,
      profiles (
        id,
        email,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('firm_id', firmId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch firm members: ${error.message}`);
  }

  return (data || []).map(mapMemberFromDb);
}

export async function getFirmMember(firmId: string, userId: string): Promise<FirmMember | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('firm_members')
    .select(`
      *,
      profiles (
        id,
        email,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('firm_id', firmId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapMemberFromDb(data);
}

export async function updateFirmMember(
  firmId: string,
  userId: string,
  updates: { role?: FirmRole; title?: string; permissions?: Record<string, boolean> }
): Promise<FirmMember> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {};
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.permissions !== undefined) updateData.permissions = updates.permissions;

  const { data, error } = await supabase
    .from('firm_members')
    .update(updateData)
    .eq('firm_id', firmId)
    .eq('user_id', userId)
    .select(`
      *,
      profiles (
        id,
        email,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update member: ${error.message}`);
  }

  return mapMemberFromDb(data);
}

export async function removeFirmMember(firmId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('firm_members')
    .delete()
    .eq('firm_id', firmId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }
}

export async function createInvitation(
  firmId: string,
  email: string,
  role: FirmRole,
  invitedBy: string
): Promise<FirmInvitation> {
  const supabase = await createClient();

  const { data: tokenData } = await supabase.rpc('generate_invitation_token');
  const token = tokenData as string;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from('firm_invitations')
    .insert({
      firm_id: firmId,
      email: email.trim().toLowerCase(),
      role,
      token,
      invited_by: invitedBy,
      expires_at: expiresAt.toISOString(),
    })
    .select(`
      *,
      firms (
        id,
        name,
        slug
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return mapInvitationFromDb(data);
}

export async function getInvitationByToken(token: string): Promise<FirmInvitation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('firm_invitations')
    .select(`
      *,
      firms (
        id,
        name,
        slug
      ),
      inviter:profiles!firm_invitations_invited_by_fkey (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('token', token)
    .single();

  if (error || !data) {
    return null;
  }

  return mapInvitationFromDb(data);
}

export async function acceptInvitation(token: string, userId: string): Promise<FirmMember> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('accept_firm_invitation', {
    p_token: token,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to accept invitation: ${error.message}`);
  }

  return mapMemberFromDb(data);
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('firm_invitations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    })
    .eq('id', invitationId);

  if (error) {
    throw new Error(`Failed to revoke invitation: ${error.message}`);
  }
}

export async function getPendingInvitations(firmId: string): Promise<FirmInvitation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('firm_invitations')
    .select(`
      *,
      inviter:profiles!firm_invitations_invited_by_fkey (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('firm_id', firmId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch invitations: ${error.message}`);
  }

  return (data || []).map(mapInvitationFromDb);
}

export async function getUserRole(userId: string, firmId: string): Promise<FirmRole | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_user_firm_role', {
    p_user_id: userId,
    p_firm_id: firmId,
  });

  if (error || !data) {
    return null;
  }

  return data as FirmRole;
}
