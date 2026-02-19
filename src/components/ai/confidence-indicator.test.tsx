import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceIndicator, ConfidenceBar } from './confidence-indicator';

vi.mock('@/lib/ai/utils', () => ({
  getConfidenceLevel: (confidence: number) => {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  },
}));

describe('ConfidenceIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders percentage text', () => {
    render(<ConfidenceIndicator confidence={0.95} />);
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  test('high confidence applies green color class', () => {
    const { container } = render(<ConfidenceIndicator confidence={0.95} />);
    const indicator = container.firstChild as HTMLElement;
    expect(indicator.className).toContain('text-success');
  });

  test('medium confidence applies warning color class', () => {
    const { container } = render(<ConfidenceIndicator confidence={0.75} />);
    const indicator = container.firstChild as HTMLElement;
    expect(indicator.className).toContain('text-warning');
  });

  test('low confidence applies destructive color class', () => {
    const { container } = render(<ConfidenceIndicator confidence={0.5} />);
    const indicator = container.firstChild as HTMLElement;
    expect(indicator.className).toContain('text-destructive');
  });

  test('hides percentage text when showLabel is false', () => {
    render(<ConfidenceIndicator confidence={0.95} showLabel={false} />);
    expect(screen.queryByText('95%')).not.toBeInTheDocument();
  });

  test('hides icon when showIcon is false', () => {
    const { container } = render(
      <ConfidenceIndicator confidence={0.95} showIcon={false} />
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  test('size sm applies text-xs class', () => {
    const { container } = render(
      <ConfidenceIndicator confidence={0.95} size="sm" />
    );
    const indicator = container.firstChild as HTMLElement;
    expect(indicator.className).toContain('text-xs');
  });
});

describe('ConfidenceBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders "Confidence" label', () => {
    render(<ConfidenceBar confidence={0.85} />);
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  test('renders percentage text', () => {
    render(<ConfidenceBar confidence={0.85} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  test('bar width matches percentage', () => {
    const { container } = render(<ConfidenceBar confidence={0.75} />);
    const track = container.querySelector('.bg-muted.rounded-full.overflow-hidden');
    const bar = track?.firstChild as HTMLElement;
    expect(bar.style.width).toBe('75%');
  });

  test('uses green color for high confidence', () => {
    const { container } = render(<ConfidenceBar confidence={0.95} />);
    const bar = container.querySelector('.bg-success');
    expect(bar).toBeInTheDocument();
  });
});
