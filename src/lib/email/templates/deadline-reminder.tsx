import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface DeadlineReminderEmailProps {
  userName: string;
  caseTitle: string;
  deadline: string;
  daysUntil: number;
  caseUrl: string;
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

const urgentParagraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#dc2626',
  fontWeight: '600',
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

const caseBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  marginBottom: '16px',
  border: '1px solid #e2e8f0',
};

const caseTitle = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1a1a1a',
  marginBottom: '8px',
};

const caseDetail = {
  fontSize: '14px',
  color: '#64748b',
  marginBottom: '4px',
};

export function DeadlineReminderEmail({
  userName,
  caseTitle: title,
  deadline,
  daysUntil,
  caseUrl,
}: DeadlineReminderEmailProps) {
  const previewText = `Deadline reminder: ${title} is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
  const isUrgent = daysUntil <= 3;

  return (
    <BaseEmail previewText={previewText}>
      <Heading style={heading}>Deadline Reminder</Heading>

      <Text style={paragraph}>Hi {userName},</Text>

      {isUrgent ? (
        <Text style={urgentParagraph}>
          URGENT: You have a case deadline approaching in {daysUntil} day
          {daysUntil === 1 ? '' : 's'}!
        </Text>
      ) : (
        <Text style={paragraph}>
          This is a friendly reminder that you have an upcoming case deadline.
        </Text>
      )}

      <div style={caseBox}>
        <Text style={caseTitle}>{title}</Text>
        <Text style={caseDetail}>
          Deadline: <strong>{deadline}</strong>
        </Text>
        <Text style={caseDetail}>
          Days remaining: <strong>{daysUntil}</strong>
        </Text>
      </div>

      <Button href={caseUrl} style={button}>
        View Case Details
      </Button>

      <Text style={paragraph}>
        Make sure all required documents are uploaded and forms are completed before the
        deadline.
      </Text>

      <Text style={paragraph}>
        Best regards,
        <br />
        The CaseFill Team
      </Text>
    </BaseEmail>
  );
}
