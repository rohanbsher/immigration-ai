import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface WelcomeEmailProps {
  userName: string;
  loginUrl: string;
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

const list = {
  marginTop: '16px',
  marginBottom: '16px',
  paddingLeft: '24px',
};

const listItem = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#484848',
  marginBottom: '8px',
};

export function WelcomeEmail({ userName, loginUrl }: WelcomeEmailProps) {
  const previewText = `Welcome to Immigration AI, ${userName}!`;

  return (
    <BaseEmail previewText={previewText}>
      <Heading style={heading}>Welcome to Immigration AI!</Heading>

      <Text style={paragraph}>Hi {userName},</Text>

      <Text style={paragraph}>
        Thank you for joining Immigration AI. We&apos;re excited to help you streamline your
        immigration case management with the power of artificial intelligence.
      </Text>

      <Text style={paragraph}>Here&apos;s what you can do with Immigration AI:</Text>

      <ul style={list}>
        <li style={listItem}>AI-powered document analysis and data extraction</li>
        <li style={listItem}>Intelligent form auto-fill for immigration applications</li>
        <li style={listItem}>Case tracking with deadline reminders</li>
        <li style={listItem}>Secure document storage and management</li>
      </ul>

      <Button href={loginUrl} style={button}>
        Get Started
      </Button>

      <Text style={paragraph}>
        If you have any questions or need assistance, don&apos;t hesitate to reach out to our
        support team.
      </Text>

      <Text style={paragraph}>
        Best regards,
        <br />
        The Immigration AI Team
      </Text>
    </BaseEmail>
  );
}
