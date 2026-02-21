import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CompletenessResult } from '@/lib/ai/document-completeness';

// Mock logger (avoids circular dependency with crypto)
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
    withContext: vi.fn().mockReturnThis(),
  },
}));

import { DocumentCompletenessPanel } from './document-completeness-panel';

// Mock the hook
const mockUseDocumentCompleteness = vi.fn();
vi.mock('@/hooks/use-document-completeness', () => ({
  useDocumentCompleteness: (...args: unknown[]) => mockUseDocumentCompleteness(...args),
  getCompletenessColor: (completeness: number) => {
    if (completeness >= 100) return { bg: 'bg-success/10', text: 'text-success', ring: 'ring-success' };
    if (completeness >= 70) return { bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning' };
    if (completeness >= 40) return { bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning' };
    return { bg: 'bg-destructive/10', text: 'text-destructive', ring: 'ring-destructive' };
  },
  getFilingReadinessInfo: (readiness: string) => {
    switch (readiness) {
      case 'ready':
        return { label: 'Ready to File', color: 'text-success', bgColor: 'bg-success/10' };
      case 'needs_review':
        return { label: 'Needs Review', color: 'text-warning', bgColor: 'bg-warning/10' };
      default:
        return { label: 'Incomplete', color: 'text-destructive', bgColor: 'bg-destructive/10' };
    }
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

function makeCompletenessResult(overrides: Partial<CompletenessResult> = {}): CompletenessResult {
  return {
    overallCompleteness: 60,
    filingReadiness: 'incomplete',
    missingRequired: [],
    missingOptional: [],
    uploadedDocs: [],
    recommendations: [],
    totalRequired: 5,
    uploadedRequired: 3,
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('DocumentCompletenessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    test('renders loading indicator', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Analyzing documents')).toBeInTheDocument();
    });
  });

  describe('error / degraded state', () => {
    test('renders degraded fallback on error', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Fail'),
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Document Completeness')).toBeInTheDocument();
      expect(
        screen.getByText('Upload documents to see completeness analysis and filing readiness.')
      ).toBeInTheDocument();
    });

    test('renders degraded fallback when data is null', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Upload documents to see completeness analysis and filing readiness.')
      ).toBeInTheDocument();
    });

    test('renders degraded fallback when data has degraded flag', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: { ...makeCompletenessResult(), degraded: true },
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Upload documents to see completeness analysis and filing readiness.')
      ).toBeInTheDocument();
    });
  });

  describe('mini variant', () => {
    test('renders completeness badge with percentage', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({ overallCompleteness: 75 }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" variant="mini" />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    test('renders progress bar and documents label', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({ overallCompleteness: 80 }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" variant="compact" />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('full variant', () => {
    test('renders progress ring with percentage', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({ overallCompleteness: 60 }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    test('renders filing readiness badge', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({ filingReadiness: 'ready' }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Ready to File')).toBeInTheDocument();
    });

    test('renders uploaded and total required counts', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({ uploadedRequired: 3, totalRequired: 5 }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('3 of 5 required documents uploaded')).toBeInTheDocument();
    });

    test('renders missing required documents section', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({
          missingRequired: [
            {
              documentType: 'passport',
              displayName: 'Passport',
              required: true,
              description: 'Valid passport copy',
            },
            {
              documentType: 'birth_certificate',
              displayName: 'Birth Certificate',
              required: true,
              description: null,
            },
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Missing Required')).toBeInTheDocument();
      expect(screen.getByText('Passport')).toBeInTheDocument();
      expect(screen.getByText('Birth Certificate')).toBeInTheDocument();
      expect(screen.getByText('Valid passport copy')).toBeInTheDocument();
    });

    test('renders uploaded documents section', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({
          uploadedDocs: [
            {
              id: 'doc-1',
              type: 'passport',
              displayName: 'Passport Copy',
              quality: 0.92,
              status: 'verified',
              expirationDate: null,
              isExpired: false,
              isExpiringSoon: false,
            },
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.getByText('Uploaded Documents')).toBeInTheDocument();
      expect(screen.getByText('Passport Copy')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    test('renders recommendations when present and enabled', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({
          recommendations: [
            'Upload missing passport',
            'Provide recent tax returns',
          ],
        }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" showRecommendations />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Upload missing passport')).toBeInTheDocument();
      expect(screen.getByText('Provide recent tax returns')).toBeInTheDocument();
    });

    test('does not render recommendations when disabled', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({
          recommendations: ['Upload missing passport'],
        }),
        isLoading: false,
        error: null,
      });

      render(
        <DocumentCompletenessPanel caseId="case-1" showRecommendations={false} />,
        { wrapper: createWrapper() }
      );
      expect(screen.queryByText('Recommendations')).not.toBeInTheDocument();
    });

    test('does not render missing required section when array is empty', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({ missingRequired: [] }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.queryByText('Missing Required')).not.toBeInTheDocument();
    });

    test('does not render uploaded section when array is empty', () => {
      mockUseDocumentCompleteness.mockReturnValue({
        data: makeCompletenessResult({ uploadedDocs: [] }),
        isLoading: false,
        error: null,
      });

      render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      expect(screen.queryByText('Uploaded Documents')).not.toBeInTheDocument();
    });
  });

  describe('handles undefined array properties gracefully', () => {
    test('does not crash when missingRequired is undefined', () => {
      const data = makeCompletenessResult();
      // Simulate undefined array (as can happen from API)
      (data as Record<string, unknown>).missingRequired = undefined;

      mockUseDocumentCompleteness.mockReturnValue({
        data,
        isLoading: false,
        error: null,
      });

      // Should not throw
      expect(() => {
        render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      }).not.toThrow();
    });

    test('does not crash when uploadedDocs is undefined', () => {
      const data = makeCompletenessResult();
      (data as Record<string, unknown>).uploadedDocs = undefined;

      mockUseDocumentCompleteness.mockReturnValue({
        data,
        isLoading: false,
        error: null,
      });

      expect(() => {
        render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      }).not.toThrow();
    });

    test('does not crash when recommendations is undefined', () => {
      const data = makeCompletenessResult();
      (data as Record<string, unknown>).recommendations = undefined;

      mockUseDocumentCompleteness.mockReturnValue({
        data,
        isLoading: false,
        error: null,
      });

      expect(() => {
        render(<DocumentCompletenessPanel caseId="case-1" />, { wrapper: createWrapper() });
      }).not.toThrow();
    });
  });
});
