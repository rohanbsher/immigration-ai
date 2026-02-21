import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIContentBox, AICard, AIHighlight } from './ai-content-box';

describe('AIContentBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders children', () => {
    render(<AIContentBox>Test content</AIContentBox>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  test('renders title when provided', () => {
    render(<AIContentBox title="AI Analysis">Content</AIContentBox>);
    expect(screen.getByText('AI Analysis')).toBeInTheDocument();
  });

  test('does not render title section when title is not provided', () => {
    const { container } = render(<AIContentBox>Content</AIContentBox>);
    // No title means no header row with sparkles icon
    const headerDivs = container.querySelectorAll('.flex.items-center.gap-2.mb-3');
    expect(headerDivs.length).toBe(0);
  });

  test('shows sparkles icon with title when showIcon is true (default)', () => {
    const { container } = render(<AIContentBox title="AI Analysis">Content</AIContentBox>);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  test('hides sparkles icon when showIcon is false', () => {
    const { container } = render(
      <AIContentBox title="AI Analysis" showIcon={false}>Content</AIContentBox>
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  test('applies default variant classes', () => {
    const { container } = render(<AIContentBox>Content</AIContentBox>);
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('border-l-2');
    expect(box.className).toContain('border-dashed');
  });

  test('applies subtle variant classes', () => {
    const { container } = render(<AIContentBox variant="subtle">Content</AIContentBox>);
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('border-l-2');
    expect(box.className).toContain('border-ai-accent/30');
  });

  test('applies bordered variant classes', () => {
    const { container } = render(<AIContentBox variant="bordered">Content</AIContentBox>);
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('rounded-lg');
  });

  test('applies custom className', () => {
    const { container } = render(<AIContentBox className="my-custom">Content</AIContentBox>);
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('my-custom');
  });

  test('applies padding class', () => {
    const { container } = render(<AIContentBox>Content</AIContentBox>);
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('p-4');
  });
});

describe('AICard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders children', () => {
    render(<AICard>Card content</AICard>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  test('renders title', () => {
    render(<AICard title="Analysis">Content</AICard>);
    expect(screen.getByText('Analysis')).toBeInTheDocument();
  });

  test('renders description', () => {
    render(<AICard title="Title" description="Some description">Content</AICard>);
    expect(screen.getByText('Some description')).toBeInTheDocument();
  });

  test('renders default sparkles icon when no custom icon', () => {
    const { container } = render(<AICard title="Title">Content</AICard>);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  test('renders custom icon when provided', () => {
    render(
      <AICard title="Title" icon={<span data-testid="custom-icon">*</span>}>
        Content
      </AICard>
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  test('does not render header when no title or description', () => {
    const { container } = render(<AICard>Just content</AICard>);
    const headerBorder = container.querySelector('.border-b');
    expect(headerBorder).not.toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(<AICard className="custom-card">Content</AICard>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('custom-card');
  });

  test('has rounded border', () => {
    const { container } = render(<AICard>Content</AICard>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-lg');
  });
});

describe('AIHighlight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders children', () => {
    render(<AIHighlight>highlighted text</AIHighlight>);
    expect(screen.getByText('highlighted text')).toBeInTheDocument();
  });

  test('applies highlight background classes', () => {
    const { container } = render(<AIHighlight>text</AIHighlight>);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('bg-ai-accent-muted');
    expect(span.className).toContain('text-ai-accent');
  });

  test('applies custom className', () => {
    const { container } = render(<AIHighlight className="extra">text</AIHighlight>);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('extra');
  });

  test('renders as span element', () => {
    const { container } = render(<AIHighlight>text</AIHighlight>);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });
});
