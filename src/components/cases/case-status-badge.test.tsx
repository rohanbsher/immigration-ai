import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaseStatusBadge, getStatusLabel, getStatusColor } from './case-status-badge';
import type { CaseStatus } from '@/types';

const statusLabelMap: [CaseStatus, string][] = [
  ['intake', 'Intake'],
  ['document_collection', 'Collecting Docs'],
  ['in_review', 'In Review'],
  ['forms_preparation', 'Preparing Forms'],
  ['ready_for_filing', 'Ready to File'],
  ['filed', 'Filed'],
  ['pending_response', 'Pending Response'],
  ['approved', 'Approved'],
  ['denied', 'Denied'],
  ['closed', 'Closed'],
];

describe('CaseStatusBadge', () => {
  it.each(statusLabelMap)(
    'renders "%s" status with label "%s"',
    (status, expectedLabel) => {
      render(<CaseStatusBadge status={status} />);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    },
  );

  it('falls back to intake config for unknown status', () => {
    render(<CaseStatusBadge status={'unknown' as CaseStatus} />);
    expect(screen.getByText('Intake')).toBeInTheDocument();
  });
});

describe('getStatusLabel', () => {
  it('returns correct label for known status', () => {
    expect(getStatusLabel('approved')).toBe('Approved');
  });

  it('returns raw status string for unknown status', () => {
    expect(getStatusLabel('unknown' as CaseStatus)).toBe('unknown');
  });
});

describe('getStatusColor', () => {
  it('returns correct className for known status', () => {
    expect(getStatusColor('denied')).toBe(
      'bg-destructive/10 text-destructive hover:bg-destructive/10',
    );
  });

  it('returns intake className for unknown status', () => {
    expect(getStatusColor('unknown' as CaseStatus)).toBe(
      'bg-muted text-muted-foreground hover:bg-muted',
    );
  });
});
