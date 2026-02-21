import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressRing } from './progress-ring';

// Mock motion/react
vi.mock('motion/react', () => {
  const React = require('react');
  return {
    motion: {
      span: React.forwardRef(({ children, initial, animate, transition, style, className, ...props }: any, ref: any) => (
        <span ref={ref} className={className} style={style} {...props}>{children}</span>
      )),
      div: React.forwardRef(({ children, initial, animate, transition, className, ...props }: any, ref: any) => (
        <div ref={ref} className={className} {...props}>{children}</div>
      )),
      circle: React.forwardRef(({ style, ...props }: any, ref: any) => (
        <circle ref={ref} {...props} />
      )),
    },
    useInView: () => true,
    useSpring: (initial: number) => ({
      get: () => initial,
      set: vi.fn(),
      on: (_event: string, cb: (v: number) => void) => {
        cb(initial);
        return () => {};
      },
    }),
    useTransform: (source: any, transform: (v: number) => number) => {
      const val = transform(source.get());
      return {
        get: () => val,
        on: (_event: string, cb: (v: number) => void) => {
          cb(val);
          return () => {};
        },
      };
    },
  };
});

describe('ProgressRing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders SVG element', () => {
    const { container } = render(<ProgressRing value={50} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  test('renders two circle elements (bg + progress)', () => {
    const { container } = render(<ProgressRing value={50} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  test('renders percentage text when showValue is true (default)', () => {
    render(<ProgressRing value={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  test('hides percentage text when showValue is false', () => {
    render(<ProgressRing value={75} showValue={false} />);
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  test('renders label when provided', () => {
    render(<ProgressRing value={50} label="Progress" />);
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  test('does not render label when not provided', () => {
    render(<ProgressRing value={50} />);
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
  });

  test('uses custom size for SVG dimensions', () => {
    const { container } = render(<ProgressRing value={50} size={200} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('200');
    expect(svg?.getAttribute('height')).toBe('200');
  });

  test('default size is 120', () => {
    const { container } = render(<ProgressRing value={50} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('120');
    expect(svg?.getAttribute('height')).toBe('120');
  });

  test('clamps value to max', () => {
    render(<ProgressRing value={150} max={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  test('clamps negative value to 0', () => {
    render(<ProgressRing value={-10} max={100} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  test('handles custom max correctly', () => {
    render(<ProgressRing value={50} max={200} />);
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(<ProgressRing value={50} className="my-class" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('my-class');
  });

  test('has flex column layout', () => {
    const { container } = render(<ProgressRing value={50} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('flex-col');
  });
});
