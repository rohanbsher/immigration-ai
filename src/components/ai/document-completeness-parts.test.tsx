import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  CompletenessBadge,
  CompactnessBar,
  ProgressRing,
  FilingReadinessBadge,
  DocumentSection,
  UploadedDocumentsSection,
  RecommendationsSection,
} from './document-completeness-parts';
import type { CompletenessResult, DocumentRequirement, UploadedDocumentInfo } from '@/lib/ai/document-completeness';

vi.mock('@/hooks/use-document-completeness', () => ({
  getCompletenessColor: (completeness: number) => {
    if (completeness >= 100) return { bg: 'bg-success/10', text: 'text-success', ring: 'ring-success' };
    if (completeness >= 70) return { bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning' };
    return { bg: 'bg-destructive/10', text: 'text-destructive', ring: 'ring-destructive' };
  },
  getFilingReadinessInfo: (readiness: string) => {
    if (readiness === 'ready') return { label: 'Ready to File', color: 'text-success', bgColor: 'bg-success/10' };
    if (readiness === 'needs_review') return { label: 'Needs Review', color: 'text-warning', bgColor: 'bg-warning/10' };
    return { label: 'Incomplete', color: 'text-destructive', bgColor: 'bg-destructive/10' };
  },
}));

const mockMissingRequired: DocumentRequirement[] = [
  { documentType: 'passport' as any, displayName: 'Passport', required: true, description: 'Valid passport' },
  { documentType: 'birth_certificate' as any, displayName: 'Birth Certificate', required: true, description: null },
];

const mockMissingOptional: DocumentRequirement[] = [
  { documentType: 'utility_bill' as any, displayName: 'Utility Bill', required: false, description: 'Proof of address' },
];

const mockUploadedDocs: UploadedDocumentInfo[] = [
  {
    id: 'doc-1',
    type: 'i94' as any,
    displayName: 'I-94 Record',
    quality: 0.95,
    status: 'verified',
    expirationDate: null,
    isExpired: false,
    isExpiringSoon: false,
  },
  {
    id: 'doc-2',
    type: 'visa_stamp' as any,
    displayName: 'Visa Stamp',
    quality: 0.72,
    status: 'needs_review',
    expirationDate: '2026-06-01',
    isExpired: false,
    isExpiringSoon: true,
  },
  {
    id: 'doc-3',
    type: 'passport' as any,
    displayName: 'Passport',
    quality: 0.5,
    status: 'rejected',
    expirationDate: '2024-01-01',
    isExpired: true,
    isExpiringSoon: false,
  },
];

const mockCompletenessData: CompletenessResult = {
  overallCompleteness: 65,
  filingReadiness: 'incomplete',
  missingRequired: mockMissingRequired,
  missingOptional: mockMissingOptional,
  uploadedDocs: mockUploadedDocs,
  recommendations: ['Upload passport', 'Verify visa status'],
  totalRequired: 5,
  uploadedRequired: 3,
  analyzedAt: '2026-02-20T00:00:00Z',
};

describe('CompletenessBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders completeness percentage', () => {
    render(<CompletenessBadge completeness={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  test('renders 100% completeness', () => {
    render(<CompletenessBadge completeness={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(<CompletenessBadge completeness={50} className="extra" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('extra');
  });

  test('has rounded-full class', () => {
    const { container } = render(<CompletenessBadge completeness={50} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('rounded-full');
  });
});

describe('CompactnessBar', () => {
  const onToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders "Documents" label', () => {
    render(<CompactnessBar data={mockCompletenessData} isExpanded={false} onToggle={onToggle} />);
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  test('renders percentage', () => {
    render(<CompactnessBar data={mockCompletenessData} isExpanded={false} onToggle={onToggle} />);
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  test('calls onToggle when button is clicked', () => {
    render(<CompactnessBar data={mockCompletenessData} isExpanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('shows expanded details when isExpanded is true', () => {
    render(<CompactnessBar data={mockCompletenessData} isExpanded={true} onToggle={onToggle} />);
    expect(screen.getByText('3/5 required uploaded')).toBeInTheDocument();
  });

  test('shows missing required documents when expanded', () => {
    render(<CompactnessBar data={mockCompletenessData} isExpanded={true} onToggle={onToggle} />);
    expect(screen.getByText(/Missing: Passport, Birth Certificate/)).toBeInTheDocument();
  });

  test('does not show expanded details when collapsed', () => {
    render(<CompactnessBar data={mockCompletenessData} isExpanded={false} onToggle={onToggle} />);
    expect(screen.queryByText('3/5 required uploaded')).not.toBeInTheDocument();
  });
});

describe('ProgressRing', () => {
  test('renders SVG circle elements', () => {
    const { container } = render(<ProgressRing completeness={75} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  test('renders percentage text', () => {
    render(<ProgressRing completeness={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  test('renders 0% completeness', () => {
    render(<ProgressRing completeness={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  test('renders 100% completeness', () => {
    render(<ProgressRing completeness={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  test('uses green stroke for 100% completeness', () => {
    const { container } = render(<ProgressRing completeness={100} />);
    const circles = container.querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle.getAttribute('stroke')).toBe('#22c55e');
  });

  test('uses yellow stroke for 70-99% completeness', () => {
    const { container } = render(<ProgressRing completeness={75} />);
    const circles = container.querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle.getAttribute('stroke')).toBe('#eab308');
  });

  test('uses red stroke for <70% completeness', () => {
    const { container } = render(<ProgressRing completeness={50} />);
    const circles = container.querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle.getAttribute('stroke')).toBe('#ef4444');
  });

  test('accepts custom size', () => {
    const { container } = render(<ProgressRing completeness={50} size={120} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('120');
    expect(svg?.getAttribute('height')).toBe('120');
  });
});

describe('FilingReadinessBadge', () => {
  test('renders "Ready to File" for ready status', () => {
    render(<FilingReadinessBadge readiness="ready" />);
    expect(screen.getByText('Ready to File')).toBeInTheDocument();
  });

  test('renders "Needs Review" for needs_review status', () => {
    render(<FilingReadinessBadge readiness="needs_review" />);
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
  });

  test('renders "Incomplete" for incomplete status', () => {
    render(<FilingReadinessBadge readiness="incomplete" />);
    expect(screen.getByText('Incomplete')).toBeInTheDocument();
  });

  test('has rounded-full class', () => {
    const { container } = render(<FilingReadinessBadge readiness="ready" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('rounded-full');
  });
});

describe('DocumentSection', () => {
  const mockDocs: DocumentRequirement[] = [
    { documentType: 'passport' as any, displayName: 'Passport', required: true, description: 'Valid passport' },
    { documentType: 'i94' as any, displayName: 'I-94', required: true, description: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders section title', () => {
    render(
      <DocumentSection
        title="Missing Required"
        documents={mockDocs}
        icon={<span data-testid="icon" />}
        type="missing"
        caseId="case-1"
      />
    );
    expect(screen.getByText('Missing Required')).toBeInTheDocument();
  });

  test('shows document count', () => {
    render(
      <DocumentSection
        title="Missing"
        documents={mockDocs}
        icon={<span />}
        type="missing"
        caseId="case-1"
      />
    );
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  test('shows document names when not collapsed', () => {
    render(
      <DocumentSection
        title="Missing"
        documents={mockDocs}
        icon={<span />}
        type="missing"
        caseId="case-1"
        collapsed={false}
      />
    );
    expect(screen.getByText('Passport')).toBeInTheDocument();
    expect(screen.getByText('I-94')).toBeInTheDocument();
  });

  test('hides document names when collapsed', () => {
    render(
      <DocumentSection
        title="Missing"
        documents={mockDocs}
        icon={<span />}
        type="missing"
        caseId="case-1"
        collapsed={true}
      />
    );
    expect(screen.queryByText('Passport')).not.toBeInTheDocument();
  });

  test('toggles collapsed state on click', () => {
    render(
      <DocumentSection
        title="Missing"
        documents={mockDocs}
        icon={<span />}
        type="missing"
        caseId="case-1"
        collapsed={true}
      />
    );
    // Initially collapsed - click to expand
    fireEvent.click(screen.getByText('Missing'));
    expect(screen.getByText('Passport')).toBeInTheDocument();

    // Click to collapse again
    fireEvent.click(screen.getByText('Missing'));
    expect(screen.queryByText('Passport')).not.toBeInTheDocument();
  });

  test('renders description when available', () => {
    render(
      <DocumentSection
        title="Missing"
        documents={mockDocs}
        icon={<span />}
        type="missing"
        caseId="case-1"
      />
    );
    expect(screen.getByText('Valid passport')).toBeInTheDocument();
  });

  test('calls onUploadClick when upload button is clicked', () => {
    const onUploadClick = vi.fn();
    render(
      <DocumentSection
        title="Missing"
        documents={mockDocs}
        icon={<span />}
        type="missing"
        caseId="case-1"
        onUploadClick={onUploadClick}
      />
    );
    const uploadButtons = screen.getAllByText('Upload');
    fireEvent.click(uploadButtons[0]);
    expect(onUploadClick).toHaveBeenCalledWith('passport');
  });

  test('renders upload link when no onUploadClick handler', () => {
    render(
      <DocumentSection
        title="Missing"
        documents={mockDocs}
        icon={<span />}
        type="missing"
        caseId="case-1"
      />
    );
    const links = screen.getAllByText('Upload');
    const link = links[0].closest('a');
    expect(link).toHaveAttribute('href', '/dashboard/cases/case-1/documents?upload=passport');
  });
});

describe('UploadedDocumentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders "Uploaded Documents" title', () => {
    render(<UploadedDocumentsSection documents={mockUploadedDocs} caseId="case-1" />);
    expect(screen.getByText('Uploaded Documents')).toBeInTheDocument();
  });

  test('shows document count', () => {
    render(<UploadedDocumentsSection documents={mockUploadedDocs} caseId="case-1" />);
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  test('renders document names', () => {
    render(<UploadedDocumentsSection documents={mockUploadedDocs} caseId="case-1" />);
    expect(screen.getByText('I-94 Record')).toBeInTheDocument();
    expect(screen.getByText('Visa Stamp')).toBeInTheDocument();
    expect(screen.getByText('Passport')).toBeInTheDocument();
  });

  test('shows quality percentage', () => {
    render(<UploadedDocumentsSection documents={mockUploadedDocs} caseId="case-1" />);
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  test('shows expired badge for expired document', () => {
    render(<UploadedDocumentsSection documents={mockUploadedDocs} caseId="case-1" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  test('shows expiring soon badge', () => {
    render(<UploadedDocumentsSection documents={mockUploadedDocs} caseId="case-1" />);
    expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
  });

  test('toggles collapsed state on click', () => {
    render(<UploadedDocumentsSection documents={mockUploadedDocs} caseId="case-1" />);
    expect(screen.getByText('I-94 Record')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText('Uploaded Documents'));
    expect(screen.queryByText('I-94 Record')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Uploaded Documents'));
    expect(screen.getByText('I-94 Record')).toBeInTheDocument();
  });

  test('renders view links to document detail pages', () => {
    const { container } = render(
      <UploadedDocumentsSection documents={mockUploadedDocs} caseId="case-1" />
    );
    const links = container.querySelectorAll('a');
    expect(links[0]).toHaveAttribute('href', '/dashboard/cases/case-1/documents/doc-1');
  });
});

describe('RecommendationsSection', () => {
  test('renders "Recommendations" heading', () => {
    render(<RecommendationsSection recommendations={['Upload passport']} />);
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
  });

  test('renders all recommendations', () => {
    const recs = ['Upload passport', 'Verify visa status', 'Check expiration'];
    render(<RecommendationsSection recommendations={recs} />);
    recs.forEach((rec) => {
      expect(screen.getByText(rec)).toBeInTheDocument();
    });
  });

  test('renders empty list with no items', () => {
    const { container } = render(<RecommendationsSection recommendations={[]} />);
    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBe(0);
  });

  test('renders bullet points for each recommendation', () => {
    const { container } = render(
      <RecommendationsSection recommendations={['Rec 1', 'Rec 2']} />
    );
    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBe(2);
  });
});
