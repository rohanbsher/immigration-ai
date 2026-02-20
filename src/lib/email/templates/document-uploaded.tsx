import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface DocumentUploadedEmailProps {
  userName: string;
  caseTitle: string;
  documentName: string;
  documentType: string;
  uploadedBy: string;
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

const documentBox = {
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  marginBottom: '16px',
  borderLeft: '4px solid #22c55e',
};

const documentTitle = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#166534',
  marginBottom: '8px',
};

const documentInfo = {
  fontSize: '14px',
  color: '#15803d',
  marginBottom: '4px',
};

export function DocumentUploadedEmail({
  userName,
  caseTitle,
  documentName,
  documentType,
  uploadedBy,
  caseUrl,
}: DocumentUploadedEmailProps) {
  const previewText = `New document uploaded: ${documentName}`;

  return (
    <BaseEmail previewText={previewText}>
      <Heading style={heading}>New Document Uploaded</Heading>

      <Text style={paragraph}>Hi {userName},</Text>

      <Text style={paragraph}>
        A new document has been uploaded to your case: <strong>{caseTitle}</strong>
      </Text>

      <div style={documentBox}>
        <Text style={documentTitle}>{documentName}</Text>
        <Text style={documentInfo}>Type: {documentType}</Text>
        <Text style={documentInfo}>Uploaded by: {uploadedBy}</Text>
      </div>

      <Text style={paragraph}>
        The document is now available for review. Our AI can analyze it to extract relevant
        information for your immigration forms.
      </Text>

      <Button href={caseUrl} style={button}>
        View Document
      </Button>

      <Text style={paragraph}>
        Best regards,
        <br />
        The CaseFill Team
      </Text>
    </BaseEmail>
  );
}
