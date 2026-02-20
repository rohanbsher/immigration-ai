export type FirmRole = 'owner' | 'admin' | 'attorney' | 'staff';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Firm {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  logoUrl: string | null;
  website: string | null;
  phone: string | null;
  address: FirmAddress;
  settings: FirmSettings;
  subscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FirmAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface FirmSettings {
  timezone?: string;
  defaultCaseAssignment?: 'owner' | 'round_robin' | 'manual';
  notificationsEnabled?: boolean;
  [key: string]: unknown;
}

export interface FirmMember {
  id: string;
  firmId: string;
  userId: string;
  role: FirmRole;
  title: string | null;
  permissions: Record<string, boolean>;
  joinedAt: string;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
}

export interface FirmInvitation {
  id: string;
  firmId: string;
  email: string;
  role: FirmRole;
  token: string;
  status: InvitationStatus;
  invitedBy: string;
  acceptedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  firm?: {
    id: string;
    name: string;
    slug: string;
  };
  inviter?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export interface CreateFirmInput {
  name: string;
  logoUrl?: string;
  website?: string;
  phone?: string;
  address?: FirmAddress;
}

export interface UpdateFirmInput {
  name?: string;
  logoUrl?: string;
  website?: string;
  phone?: string;
  address?: FirmAddress;
  settings?: FirmSettings;
}

export interface InviteMemberInput {
  email: string;
  role: FirmRole;
}

export interface UpdateMemberInput {
  role?: FirmRole;
  title?: string;
  permissions?: Record<string, boolean>;
}

export const FIRM_ROLE_LABELS: Record<FirmRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  attorney: 'Attorney',
  staff: 'Staff',
};

export function canManageMembers(role: FirmRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageCases(role: FirmRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'attorney';
}

export function canViewAllCases(role: FirmRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'attorney';
}

export function canAccessBilling(role: FirmRole): boolean {
  return role === 'owner';
}

export function canDeleteFirm(role: FirmRole): boolean {
  return role === 'owner';
}
