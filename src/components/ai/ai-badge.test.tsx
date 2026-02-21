import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIBadge, AIIconBadge } from './ai-badge';

describe('AIBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders default label "AI"', () => {
    render(<AIBadge />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  test('renders custom label', () => {
    render(<AIBadge label="Auto-filled" />);
    expect(screen.getByText('Auto-filled')).toBeInTheDocument();
  });

  test('renders sparkles icon', () => {
    const { container } = render(<AIBadge />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  test('applies sm size classes', () => {
    const { container } = render(<AIBadge size="sm" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-xs');
  });

  test('applies md size classes by default', () => {
    const { container } = render(<AIBadge />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-sm');
  });

  test('applies lg size classes', () => {
    const { container } = render(<AIBadge size="lg" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-base');
  });

  test('wraps in tooltip by default', () => {
    render(<AIBadge tooltipText="Powered by AI" />);
    // The badge should be wrapped in a tooltip trigger
    const badge = screen.getByText('AI');
    expect(badge).toBeInTheDocument();
  });

  test('does not wrap in tooltip when showTooltip is false', () => {
    const { container } = render(<AIBadge showTooltip={false} />);
    // Without tooltip, the badge span is the direct rendered element
    const badge = container.querySelector('span');
    expect(badge).toBeInTheDocument();
    expect(badge?.className).toContain('inline-flex');
  });

  test('applies custom className', () => {
    const { container } = render(<AIBadge className="custom-class" showTooltip={false} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('custom-class');
  });

  test('renders empty label (no text span)', () => {
    render(<AIBadge label="" showTooltip={false} />);
    const { container } = render(<AIBadge label="" showTooltip={false} />);
    // When label is empty string, the inner span is not rendered (falsy check)
    const innerSpans = container.querySelectorAll('span > span');
    expect(innerSpans.length).toBe(0);
  });

  test('applies gradient background classes', () => {
    const { container } = render(<AIBadge showTooltip={false} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-ai-accent');
  });
});

describe('AIIconBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders without text', () => {
    const { container } = render(<AIIconBadge />);
    const span = container.querySelector('span');
    expect(span).toBeInTheDocument();
    // Should only contain the SVG icon, no text
    expect(span?.textContent).toBe('');
  });

  test('renders sparkles icon', () => {
    const { container } = render(<AIIconBadge />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  test('applies sm size padding', () => {
    const { container } = render(<AIIconBadge size="sm" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('p-0.5');
  });

  test('applies md size padding by default', () => {
    const { container } = render(<AIIconBadge />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('p-1');
  });

  test('applies lg size padding', () => {
    const { container } = render(<AIIconBadge size="lg" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('p-1.5');
  });

  test('applies custom className', () => {
    const { container } = render(<AIIconBadge className="my-custom" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('my-custom');
  });

  test('has rounded-full class', () => {
    const { container } = render(<AIIconBadge />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('rounded-full');
  });
});
