import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface CaseUpdateEmailProps {
  userName: string;
  caseTitle: string;
  updateType: 'status_change' | 'document_added' | 'form_updated' | 'note_added';
  updateDescription: string;
  caseUrl: string;
  updatedBy?: string;
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

const updateBox = {
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  marginBottom: '16px',
  borderLeft: '4px solid #2563eb',
};

const updateTitle = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#1e40af',
  marginBottom: '8px',
};

const updateText = {
  fontSize: '14px',
  color: '#1e3a5f',
  marginBottom: '0',
};

const UPDATE_TYPE_LABELS: Record<string, string> = {
  status_change: 'Status Updated',
  document_added: 'New Document',
  form_updated: 'Form Updated',
  note_added: 'New Note',
};

export function CaseUpdateEmail({
  userName,
  caseTitle,
  updateType,
  updateDescription,
  caseUrl,
  updatedBy,
}: CaseUpdateEmailProps) {
  const updateLabel = UPDATE_TYPE_LABELS[updateType] || 'Update';
  const previewText = `Case update: ${updateLabel} for ${caseTitle}`;

  return (
    <BaseEmail previewText={previewText}>
      <Heading style={heading}>Case Update</Heading>

      <Text style={paragraph}>Hi {userName},</Text>

      <Text style={paragraph}>
        There's been an update to your case: <strong>{caseTitle}</strong>
      </Text>

      <div style={updateBox}>
        <Text style={updateTitle}>{updateLabel}</Text>
        <Text style={updateText}>{updateDescription}</Text>
        {updatedBy && (
          <Text style={{ ...updateText, marginTop: '8px', fontStyle: 'italic' }}>
            Updated by: {updatedBy}
          </Text>
        )}
      </div>

      <Button href={caseUrl} style={button}>
        View Case
      </Button>

      <Text style={paragraph}>
        Best regards,
        <br />
        The Immigration AI Team
      </Text>
    </BaseEmail>
  );
}
