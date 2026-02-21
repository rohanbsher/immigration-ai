import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VisaTypeChart } from './visa-type-chart';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-count={data?.length}>
      {children}
    </div>
  ),
  Bar: ({ children }: any) => <div data-testid="bar">{children}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
}));

const mockData = [
  { name: 'H-1B', count: 15, fill: '#3b82f6' },
  { name: 'L-1', count: 8, fill: '#8b5cf6' },
  { name: 'O-1', count: 4, fill: '#f59e0b' },
  { name: 'EB-2', count: 12, fill: '#22c55e' },
];

describe('VisaTypeChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders ResponsiveContainer', () => {
    render(<VisaTypeChart data={mockData} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  test('renders BarChart', () => {
    render(<VisaTypeChart data={mockData} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  test('passes correct data count to BarChart', () => {
    render(<VisaTypeChart data={mockData} />);
    const chart = screen.getByTestId('bar-chart');
    expect(chart.getAttribute('data-count')).toBe('4');
  });

  test('renders XAxis', () => {
    render(<VisaTypeChart data={mockData} />);
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
  });

  test('renders YAxis', () => {
    render(<VisaTypeChart data={mockData} />);
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
  });

  test('renders Tooltip', () => {
    render(<VisaTypeChart data={mockData} />);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  test('renders Bar', () => {
    render(<VisaTypeChart data={mockData} />);
    expect(screen.getByTestId('bar')).toBeInTheDocument();
  });

  test('renders Cell for each data item', () => {
    render(<VisaTypeChart data={mockData} />);
    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBe(4);
  });

  test('renders Cells with correct fill colors', () => {
    render(<VisaTypeChart data={mockData} />);
    const cells = screen.getAllByTestId('cell');
    expect(cells[0].getAttribute('data-fill')).toBe('#3b82f6');
    expect(cells[1].getAttribute('data-fill')).toBe('#8b5cf6');
    expect(cells[2].getAttribute('data-fill')).toBe('#f59e0b');
    expect(cells[3].getAttribute('data-fill')).toBe('#22c55e');
  });

  test('handles empty data array', () => {
    render(<VisaTypeChart data={[]} />);
    const chart = screen.getByTestId('bar-chart');
    expect(chart.getAttribute('data-count')).toBe('0');
  });

  test('handles single data item', () => {
    const singleData = [{ name: 'H-1B', count: 10, fill: '#3b82f6' }];
    render(<VisaTypeChart data={singleData} />);
    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBe(1);
  });

  test('chart container has fixed height', () => {
    const { container } = render(<VisaTypeChart data={mockData} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('h-64');
  });
});
