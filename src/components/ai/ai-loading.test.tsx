import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AILoading, AISkeleton } from './ai-loading';

describe('AILoading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders default message "AI is thinking"', () => {
    render(<AILoading />);
    expect(screen.getByText('AI is thinking')).toBeInTheDocument();
  });

  test('renders custom message', () => {
    render(<AILoading message="Analyzing document" />);
    expect(screen.getByText('Analyzing document')).toBeInTheDocument();
  });

  test('renders animated dots', () => {
    const { container } = render(<AILoading />);
    const dots = container.querySelectorAll('span.inline-flex > span');
    expect(dots.length).toBe(3);
  });

  test('default variant renders helper text', () => {
    render(<AILoading />);
    expect(screen.getByText('This may take a few seconds')).toBeInTheDocument();
  });

  test('minimal variant does not render helper text', () => {
    render(<AILoading variant="minimal" />);
    expect(screen.queryByText('This may take a few seconds')).not.toBeInTheDocument();
  });

  test('inline variant does not render helper text', () => {
    render(<AILoading variant="inline" />);
    expect(screen.queryByText('This may take a few seconds')).not.toBeInTheDocument();
  });

  test('inline variant renders as span', () => {
    const { container } = render(<AILoading variant="inline" />);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  test('minimal variant renders as div', () => {
    const { container } = render(<AILoading variant="minimal" />);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  test('default variant renders as div', () => {
    const { container } = render(<AILoading />);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  test('sm size applies text-xs class', () => {
    const { container } = render(<AILoading variant="inline" size="sm" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('text-xs');
  });

  test('md size applies text-sm class', () => {
    const { container } = render(<AILoading variant="inline" size="md" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('text-sm');
  });

  test('lg size applies text-base class', () => {
    const { container } = render(<AILoading variant="inline" size="lg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('text-base');
  });

  test('applies custom className', () => {
    const { container } = render(<AILoading className="my-class" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('my-class');
  });

  test('default variant has dashed border', () => {
    const { container } = render(<AILoading />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('border-dashed');
  });
});

describe('AISkeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders 3 skeleton lines by default', () => {
    const { container } = render(<AISkeleton />);
    const lines = container.querySelectorAll('.animate-pulse');
    // 2 header items + 3 lines = 5 pulse elements
    expect(lines.length).toBe(5);
  });

  test('renders specified number of lines', () => {
    const { container } = render(<AISkeleton lines={5} />);
    const lines = container.querySelectorAll('.animate-pulse');
    // 2 header + 5 lines = 7
    expect(lines.length).toBe(7);
  });

  test('renders single line', () => {
    const { container } = render(<AISkeleton lines={1} />);
    const lines = container.querySelectorAll('.animate-pulse');
    // 2 header + 1 line = 3
    expect(lines.length).toBe(3);
  });

  test('applies custom className', () => {
    const { container } = render(<AISkeleton className="custom-skeleton" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('custom-skeleton');
  });

  test('has dashed border class', () => {
    const { container } = render(<AISkeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('border-dashed');
  });

  test('skeleton lines have varying widths', () => {
    const { container } = render(<AISkeleton lines={3} />);
    const allPulseElements = container.querySelectorAll('.animate-pulse');
    // The last 3 are the skeleton lines (after 2 header items)
    const lines = Array.from(allPulseElements).slice(2);
    const widths = lines.map((el) => (el as HTMLElement).style.width);
    // First 3 widths from SKELETON_WIDTHS: '85%', '72%', '90%'
    expect(widths[0]).toBe('85%');
    expect(widths[1]).toBe('72%');
    expect(widths[2]).toBe('90%');
  });
});
