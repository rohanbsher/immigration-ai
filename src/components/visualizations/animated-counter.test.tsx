import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedCounter } from './animated-counter';

// Mock motion/react to avoid animation complexities in tests
vi.mock('motion/react', () => {
  const React = require('react');
  return {
    motion: {
      span: React.forwardRef(({ children, initial, animate, transition, className, ...props }: any, ref: any) => (
        <span ref={ref} className={className} {...props}>{children}</span>
      )),
      div: React.forwardRef(({ children, initial, animate, transition, className, ...props }: any, ref: any) => (
        <div ref={ref} className={className} {...props}>{children}</div>
      )),
      circle: React.forwardRef(({ children, style, ...props }: any, ref: any) => (
        <circle ref={ref} {...props}>{children}</circle>
      )),
    },
    useInView: () => true,
    useSpring: (initial: number) => {
      const listeners: Array<(v: number) => void> = [];
      return {
        get: () => initial,
        set: vi.fn(),
        on: (event: string, cb: (v: number) => void) => {
          listeners.push(cb);
          return () => {};
        },
      };
    },
    useTransform: (source: any, transform: (v: number) => number) => {
      const value = transform(source.get());
      return {
        get: () => value,
        on: (event: string, cb: (v: number) => void) => {
          cb(value);
          return () => {};
        },
      };
    },
  };
});

describe('AnimatedCounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the initial value 0 (spring starts at 0)', () => {
    render(<AnimatedCounter value={100} />);
    // The spring starts at 0, the mock returns 0 immediately
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('renders with prefix', () => {
    render(<AnimatedCounter value={50} prefix="$" />);
    expect(screen.getByText(/\$0/)).toBeInTheDocument();
  });

  test('renders with suffix', () => {
    render(<AnimatedCounter value={50} suffix="%" />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  test('renders with both prefix and suffix', () => {
    render(<AnimatedCounter value={50} prefix="$" suffix="k" />);
    const el = screen.getByText(/\$/);
    expect(el.textContent).toContain('$');
    expect(el.textContent).toContain('k');
  });

  test('applies custom className', () => {
    const { container } = render(<AnimatedCounter value={100} className="text-3xl" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-3xl');
  });

  test('renders as a span element', () => {
    const { container } = render(<AnimatedCounter value={100} />);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  test('renders without prefix when not provided', () => {
    render(<AnimatedCounter value={42} />);
    const el = screen.getByText('0');
    expect(el.textContent).toBe('0');
  });

  test('renders without suffix when not provided', () => {
    render(<AnimatedCounter value={42} />);
    const el = screen.getByText('0');
    expect(el.textContent).toBe('0');
  });
});
