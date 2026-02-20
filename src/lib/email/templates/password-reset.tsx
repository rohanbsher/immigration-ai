import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
  expiresIn: string;
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

const warningText = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#64748b',
  marginTop: '24px',
};

export function PasswordResetEmail({ userName, resetUrl, expiresIn }: PasswordResetEmailProps) {
  const previewText = 'Reset your CaseFill password';

  return (
    <BaseEmail previewText={previewText}>
      <Heading style={heading}>Reset Your Password</Heading>

      <Text style={paragraph}>Hi {userName},</Text>

      <Text style={paragraph}>
        We received a request to reset your CaseFill password. Click the button below to
        create a new password.
      </Text>

      <Button href={resetUrl} style={button}>
        Reset Password
      </Button>

      <Text style={paragraph}>
        This link will expire in {expiresIn}. If you did not request a password reset, you can
        safely ignore this email.
      </Text>

      <Text style={warningText}>
        For security reasons, never share this link with anyone. CaseFill will never ask you
        for your password via email.
      </Text>

      <Text style={paragraph}>
        Best regards,
        <br />
        The CaseFill Team
      </Text>
    </BaseEmail>
  );
}
