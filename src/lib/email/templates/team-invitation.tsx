import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface TeamInvitationEmailProps {
  inviterName: string;
  firmName: string;
  role: string;
  invitationUrl: string;
  expiresAt: string;
}

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#1a1a1a',
  marginBottom: '24px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#484848',
  marginBottom: '16px',
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  marginTop: '24px',
  marginBottom: '24px',
};

const invitationBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  marginBottom: '16px',
  border: '1px solid #e2e8f0',
  textAlign: 'center' as const,
};

const firmNameStyle = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#1a1a1a',
  marginBottom: '8px',
};

const roleStyle = {
  fontSize: '14px',
  color: '#64748b',
  marginBottom: '4px',
};

const expiryStyle = {
  fontSize: '12px',
  color: '#94a3b8',
  marginTop: '16px',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  attorney: 'Attorney',
  staff: 'Staff Member',
};

export function TeamInvitationEmail({
  inviterName,
  firmName,
  role,
  invitationUrl,
  expiresAt,
}: TeamInvitationEmailProps) {
  const roleLabel = ROLE_LABELS[role] || role;
  const previewText = `${inviterName} has invited you to join ${firmName} on Immigration AI`;

  return (
    <BaseEmail previewText={previewText}>
      <Heading style={heading}>You&apos;re Invited!</Heading>

      <Text style={paragraph}>
        <strong>{inviterName}</strong> has invited you to join their team on Immigration AI.
      </Text>

      <div style={invitationBox}>
        <Text style={firmNameStyle}>{firmName}</Text>
        <Text style={roleStyle}>Role: {roleLabel}</Text>
      </div>

      <Text style={paragraph}>
        As a team member, you&apos;ll be able to collaborate on immigration cases, share
        documents, and work together more efficiently.
      </Text>

      <Button href={invitationUrl} style={button}>
        Accept Invitation
      </Button>

      <Text style={expiryStyle}>
        This invitation will expire on {expiresAt}. If you don&apos;t have an account yet, you&apos;ll
        be prompted to create one when you accept.
      </Text>

      <Text style={paragraph}>
        If you weren&apos;t expecting this invitation, you can safely ignore this email.
      </Text>

      <Text style={paragraph}>
        Best regards,
        <br />
        The Immigration AI Team
      </Text>
    </BaseEmail>
  );
}
