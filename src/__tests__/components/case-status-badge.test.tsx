import { render, screen } from '@testing-library/react';
import { CaseStatusBadge, getStatusLabel, getStatusColor } from '@/components/cases/case-status-badge';
import type { CaseStatus } from '@/types';

describe('CaseStatusBadge', () => {
  const testStatuses: CaseStatus[] = [
    'intake',
    'document_collection',
    'in_review',
    'forms_preparation',
    'ready_for_filing',
    'filed',
    'pending_response',
    'approved',
    'denied',
    'closed',
  ];

  it.each(testStatuses)('renders %s status correctly', (status) => {
    render(<CaseStatusBadge status={status} />);
    const badge = screen.getByText(getStatusLabel(status));
    expect(badge).toBeInTheDocument();
  });

  it('renders intake status with correct label', () => {
    render(<CaseStatusBadge status="intake" />);
    expect(screen.getByText('Intake')).toBeInTheDocument();
  });

  it('renders approved status with correct label', () => {
    render(<CaseStatusBadge status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders denied status with correct label', () => {
    render(<CaseStatusBadge status="denied" />);
    expect(screen.getByText('Denied')).toBeInTheDocument();
  });

  it('renders document_collection as "Collecting Docs"', () => {
    render(<CaseStatusBadge status="document_collection" />);
    expect(screen.getByText('Collecting Docs')).toBeInTheDocument();
  });
});

describe('getStatusLabel', () => {
  it('returns correct labels for all statuses', () => {
    expect(getStatusLabel('intake')).toBe('Intake');
    expect(getStatusLabel('document_collection')).toBe('Collecting Docs');
    expect(getStatusLabel('in_review')).toBe('In Review');
    expect(getStatusLabel('forms_preparation')).toBe('Preparing Forms');
    expect(getStatusLabel('ready_for_filing')).toBe('Ready to File');
    expect(getStatusLabel('filed')).toBe('Filed');
    expect(getStatusLabel('pending_response')).toBe('Pending Response');
    expect(getStatusLabel('approved')).toBe('Approved');
    expect(getStatusLabel('denied')).toBe('Denied');
    expect(getStatusLabel('closed')).toBe('Closed');
  });

  it('returns the status itself for unknown status', () => {
    expect(getStatusLabel('unknown_status' as CaseStatus)).toBe('unknown_status');
  });
});

describe('getStatusColor', () => {
  it('returns correct color classes', () => {
    expect(getStatusColor('intake')).toContain('bg-slate-100');
    expect(getStatusColor('approved')).toContain('bg-emerald-100');
    expect(getStatusColor('denied')).toContain('bg-red-100');
  });

  it('returns default color for unknown status', () => {
    const color = getStatusColor('unknown' as CaseStatus);
    expect(color).toContain('bg-slate-100');
  });
});
