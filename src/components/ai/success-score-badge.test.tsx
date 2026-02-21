import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuccessScoreBadge, SuccessScoreStaticBadge } from './success-score-badge';

// Mock the useSuccessScore hook
const mockUseSuccessScore = vi.fn();

vi.mock('@/hooks/use-success-score', () => ({
  useSuccessScore: (...args: unknown[]) => mockUseSuccessScore(...args),
  getSuccessScoreColors: (score: number) => {
    if (score >= 80) return { bg: 'bg-success/10', text: 'text-success', border: 'border-success', gradient: '' };
    if (score >= 60) return { bg: 'bg-info/10', text: 'text-info', border: 'border-info', gradient: '' };
    if (score >= 40) return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning', gradient: '' };
    return { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive', gradient: '' };
  },
  getSuccessScoreLabel: (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('SuccessScoreBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows loading state with placeholder', () => {
    mockUseSuccessScore.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<SuccessScoreBadge caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText(/—%/)).toBeInTheDocument();
  });

  test('loading state has animate-pulse class', () => {
    mockUseSuccessScore.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { container } = render(<SuccessScoreBadge caseId="case-1" />, { wrapper: createWrapper() });
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('animate-pulse');
  });

  test('returns null on error', () => {
    mockUseSuccessScore.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    const { container } = render(<SuccessScoreBadge caseId="case-1" />, { wrapper: createWrapper() });
    expect(container.firstChild).toBeNull();
  });

  test('returns null when data is undefined', () => {
    mockUseSuccessScore.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const { container } = render(<SuccessScoreBadge caseId="case-1" />, { wrapper: createWrapper() });
    expect(container.firstChild).toBeNull();
  });

  test('returns null when data is degraded', () => {
    mockUseSuccessScore.mockReturnValue({
      data: { overallScore: 75, degraded: true, factors: [], riskFactors: [] },
      isLoading: false,
      error: null,
    });
    const { container } = render(<SuccessScoreBadge caseId="case-1" />, { wrapper: createWrapper() });
    expect(container.firstChild).toBeNull();
  });

  test('displays score percentage when data is available', () => {
    mockUseSuccessScore.mockReturnValue({
      data: { overallScore: 85, factors: [{ name: 'a', status: 'good' }], riskFactors: [] },
      isLoading: false,
      error: null,
    });
    render(<SuccessScoreBadge caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  test('shows label when showLabel is true', () => {
    mockUseSuccessScore.mockReturnValue({
      data: { overallScore: 85, factors: [], riskFactors: [] },
      isLoading: false,
      error: null,
    });
    render(<SuccessScoreBadge caseId="case-1" showLabel />, { wrapper: createWrapper() });
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  test('does not show label by default', () => {
    mockUseSuccessScore.mockReturnValue({
      data: { overallScore: 85, factors: [], riskFactors: [] },
      isLoading: false,
      error: null,
    });
    render(<SuccessScoreBadge caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.queryByText('Excellent')).not.toBeInTheDocument();
  });

  test('hides icon when showIcon is false', () => {
    mockUseSuccessScore.mockReturnValue({
      data: { overallScore: 85, factors: [], riskFactors: [] },
      isLoading: false,
      error: null,
    });
    const { container } = render(
      <SuccessScoreBadge caseId="case-1" showIcon={false} />,
      { wrapper: createWrapper() }
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  test('applies sm size classes', () => {
    mockUseSuccessScore.mockReturnValue({
      data: { overallScore: 85, factors: [], riskFactors: [] },
      isLoading: false,
      error: null,
    });
    const { container } = render(
      <SuccessScoreBadge caseId="case-1" size="sm" />,
      { wrapper: createWrapper() }
    );
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-xs');
  });
});

describe('SuccessScoreStaticBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders score percentage', () => {
    render(<SuccessScoreStaticBadge score={72} />);
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  test('shows label when showLabel is true', () => {
    render(<SuccessScoreStaticBadge score={85} showLabel />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  test('does not show label by default', () => {
    render(<SuccessScoreStaticBadge score={85} />);
    expect(screen.queryByText('Excellent')).not.toBeInTheDocument();
  });

  test('renders sparkles icon by default', () => {
    const { container } = render(<SuccessScoreStaticBadge score={85} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  test('hides icon when showIcon is false', () => {
    const { container } = render(<SuccessScoreStaticBadge score={85} showIcon={false} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  test('applies correct color classes for high score', () => {
    const { container } = render(<SuccessScoreStaticBadge score={90} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-success/10');
  });

  test('applies correct color classes for medium score', () => {
    const { container } = render(<SuccessScoreStaticBadge score={65} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-info/10');
  });

  test('applies correct color classes for low score', () => {
    const { container } = render(<SuccessScoreStaticBadge score={30} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-destructive/10');
  });

  test('applies custom className', () => {
    const { container } = render(<SuccessScoreStaticBadge score={85} className="custom" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('custom');
  });

  test('applies lg size classes', () => {
    const { container } = render(<SuccessScoreStaticBadge score={85} size="lg" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-base');
  });
});
