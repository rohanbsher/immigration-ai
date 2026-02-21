import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChart } from './status-chart';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, children }: any) => (
    <div data-testid="pie" data-count={data?.length}>
      {children}
    </div>
  ),
  Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

// Mock motion/react
vi.mock('motion/react', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const MockDiv = React.forwardRef(({ children, initial, animate, transition, className, ...props }: any, ref: any) => (
    <div ref={ref} className={className} {...props}>{children}</div>
  ));
  MockDiv.displayName = 'MockMotionDiv';
  return {
    motion: {
      div: MockDiv,
    },
    useInView: () => true,
  };
});

const mockData = [
  { name: 'Active', value: 10, color: '#22c55e' },
  { name: 'Pending', value: 5, color: '#eab308' },
  { name: 'Closed', value: 3, color: '#ef4444' },
];

describe('StatusChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders ResponsiveContainer', () => {
    render(<StatusChart data={mockData} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  test('renders PieChart', () => {
    render(<StatusChart data={mockData} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  test('renders Pie with correct data count', () => {
    render(<StatusChart data={mockData} />);
    const pie = screen.getByTestId('pie');
    expect(pie.getAttribute('data-count')).toBe('3');
  });

  test('renders Cell for each data item', () => {
    render(<StatusChart data={mockData} />);
    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBe(3);
  });

  test('renders Cells with correct fill colors', () => {
    render(<StatusChart data={mockData} />);
    const cells = screen.getAllByTestId('cell');
    expect(cells[0].getAttribute('data-fill')).toBe('#22c55e');
    expect(cells[1].getAttribute('data-fill')).toBe('#eab308');
    expect(cells[2].getAttribute('data-fill')).toBe('#ef4444');
  });

  test('shows legend by default', () => {
    render(<StatusChart data={mockData} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  test('shows values in legend', () => {
    render(<StatusChart data={mockData} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('hides legend when showLegend is false', () => {
    render(<StatusChart data={mockData} showLegend={false} />);
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed')).not.toBeInTheDocument();
  });

  test('renders color dots in legend', () => {
    const { container } = render(<StatusChart data={mockData} />);
    const colorDots = container.querySelectorAll('.w-3.h-3.rounded-full');
    expect(colorDots.length).toBe(3);
  });

  test('legend dots have correct background colors', () => {
    const { container } = render(<StatusChart data={mockData} />);
    const colorDots = container.querySelectorAll('.w-3.h-3.rounded-full');
    expect((colorDots[0] as HTMLElement).style.backgroundColor).toBe('rgb(34, 197, 94)');
    expect((colorDots[1] as HTMLElement).style.backgroundColor).toBe('rgb(234, 179, 8)');
    expect((colorDots[2] as HTMLElement).style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  test('applies custom className', () => {
    const { container } = render(<StatusChart data={mockData} className="custom-chart" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-chart');
  });

  test('handles empty data array', () => {
    render(<StatusChart data={[]} />);
    const pie = screen.getByTestId('pie');
    expect(pie.getAttribute('data-count')).toBe('0');
  });

  test('handles single data item', () => {
    const singleData = [{ name: 'Active', value: 10, color: '#22c55e' }];
    render(<StatusChart data={singleData} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
