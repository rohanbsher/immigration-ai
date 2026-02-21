import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentPrompt } from './document-prompt';
import type { AutofillGap } from '@/lib/ai';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockGaps: AutofillGap[] = [
  {
    missingDocType: 'passport',
    description: 'Valid passport (biodata page)',
    fieldsItWouldFill: ['given_name', 'family_name', 'date_of_birth'],
    fieldCount: 3,
    priority: 'high',
  },
  {
    missingDocType: 'w2',
    description: 'W-2 forms (last 5 years)',
    fieldsItWouldFill: ['employer_name', 'job_title'],
    fieldCount: 2,
    priority: 'medium',
  },
  {
    missingDocType: 'utility_bill',
    description: 'Utility bills for address verification',
    fieldsItWouldFill: ['address_street'],
    fieldCount: 1,
    priority: 'low',
  },
];

describe('DocumentPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns null when gaps is empty', () => {
    const { container } = render(<DocumentPrompt gaps={[]} caseId="case-1" />);
    expect(container.firstChild).toBeNull();
  });

  test('renders total field count in title', () => {
    render(<DocumentPrompt gaps={mockGaps} caseId="case-1" />);
    // Total: 3 + 2 + 1 = 6
    expect(screen.getByText(/6 fields could not be auto-filled/)).toBeInTheDocument();
  });

  test('renders singular "field" when only 1 total', () => {
    const singleGap: AutofillGap[] = [
      {
        missingDocType: 'passport',
        description: 'Passport',
        fieldsItWouldFill: ['name'],
        fieldCount: 1,
        priority: 'high',
      },
    ];
    render(<DocumentPrompt gaps={singleGap} caseId="case-1" />);
    expect(screen.getByText(/1 field could not be auto-filled/)).toBeInTheDocument();
  });

  test('renders gap descriptions', () => {
    render(<DocumentPrompt gaps={mockGaps} caseId="case-1" />);
    expect(screen.getByText('Valid passport (biodata page)')).toBeInTheDocument();
    expect(screen.getByText('W-2 forms (last 5 years)')).toBeInTheDocument();
    expect(screen.getByText('Utility bills for address verification')).toBeInTheDocument();
  });

  test('renders field count for each gap', () => {
    render(<DocumentPrompt gaps={mockGaps} caseId="case-1" />);
    expect(screen.getByText(/Would auto-fill 3 additional fields/)).toBeInTheDocument();
    expect(screen.getByText(/Would auto-fill 2 additional fields/)).toBeInTheDocument();
    expect(screen.getByText(/Would auto-fill 1 additional field$/)).toBeInTheDocument();
  });

  test('renders singular "field" for gap with 1 field', () => {
    render(<DocumentPrompt gaps={mockGaps} caseId="case-1" />);
    // utility_bill has fieldCount=1, should say "field" not "fields"
    const singleFieldText = screen.getByText(/Would auto-fill 1 additional field$/);
    expect(singleFieldText).toBeInTheDocument();
  });

  test('shows "High impact" badge for high priority gaps', () => {
    render(<DocumentPrompt gaps={mockGaps} caseId="case-1" />);
    expect(screen.getByText('High impact')).toBeInTheDocument();
  });

  test('does not show "High impact" for non-high priority gaps', () => {
    const lowGaps: AutofillGap[] = [
      {
        missingDocType: 'utility_bill',
        description: 'Utility bill',
        fieldsItWouldFill: ['address'],
        fieldCount: 1,
        priority: 'low',
      },
    ];
    render(<DocumentPrompt gaps={lowGaps} caseId="case-1" />);
    expect(screen.queryByText('High impact')).not.toBeInTheDocument();
  });

  test('renders "Upload Documents" link button', () => {
    render(<DocumentPrompt gaps={mockGaps} caseId="case-1" />);
    expect(screen.getByText('Upload Documents')).toBeInTheDocument();
  });

  test('link navigates to correct case documents tab', () => {
    render(<DocumentPrompt gaps={mockGaps} caseId="abc-123" />);
    const link = screen.getByText('Upload Documents').closest('a');
    expect(link).toHaveAttribute('href', '/dashboard/cases/abc-123?tab=documents');
  });

  test('renders upload guidance text', () => {
    render(<DocumentPrompt gaps={mockGaps} caseId="case-1" />);
    expect(screen.getByText('Upload these documents to improve coverage:')).toBeInTheDocument();
  });

  test('renders warning icon in header', () => {
    const { container } = render(<DocumentPrompt gaps={mockGaps} caseId="case-1" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
