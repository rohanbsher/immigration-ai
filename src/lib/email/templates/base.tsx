import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface BaseEmailProps {
  previewText: string;
  children: React.ReactNode;
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const header = {
  padding: '32px 48px',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto',
};

const content = {
  padding: '0 48px',
};

const footer = {
  padding: '32px 48px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
};

const footerLink = {
  color: '#8898aa',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

export function BaseEmail({ previewText, children }: BaseEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://immigrationai.app';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={`${appUrl}/logo.png`}
              width="150"
              height="40"
              alt="Immigration AI"
              style={logo}
            />
          </Section>

          <Section style={content}>{children}</Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              Immigration AI - Intelligent Immigration Case Management
            </Text>
            <Text style={footerText}>
              <Link href={`${appUrl}/dashboard/settings/notifications`} style={footerLink}>
                Manage notification preferences
              </Link>
              {' | '}
              <Link href={`${appUrl}/privacy`} style={footerLink}>
                Privacy Policy
              </Link>
              {' | '}
              <Link href={`${appUrl}/terms`} style={footerLink}>
                Terms of Service
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
