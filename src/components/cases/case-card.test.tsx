import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./case-status-badge', () => ({
  CaseStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('@/components/ai/success-score-badge', () => ({
  SuccessScoreBadge: () => <span data-testid="success-score" />,
}));

import { CaseCard } from './case-card';

const defaultProps = {
  id: 'case-123',
  title: 'H-1B Petition for John',
  client: {
    id: 'client-1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
  },
  visaType: 'H1B' as const,
  status: 'in_review' as const,
  documentsCount: 5,
  formsCount: 3,
};

describe('CaseCard', () => {
  it('renders case title as link to /dashboard/cases/{id}', () => {
    render(<CaseCard {...defaultProps} />);
    const link = screen.getByRole('link', { name: defaultProps.title });
    expect(link).toHaveAttribute('href', '/dashboard/cases/case-123');
  });

  it('renders client full name', () => {
    render(<CaseCard {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('renders client initial in avatar', () => {
    render(<CaseCard {...defaultProps} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('renders visa type badge', () => {
    render(<CaseCard {...defaultProps} />);
    expect(screen.getByText('H1B')).toBeInTheDocument();
  });

  it('renders document count and form count', () => {
    render(<CaseCard {...defaultProps} />);
    expect(screen.getByText('5 docs')).toBeInTheDocument();
    expect(screen.getByText('3 forms')).toBeInTheDocument();
  });

  it('renders deadline when provided', () => {
    render(<CaseCard {...defaultProps} deadline="2026-06-15" />);
    expect(screen.getByText(/Due/)).toBeInTheDocument();
  });

  it('hides deadline section when not provided', () => {
    render(<CaseCard {...defaultProps} deadline={null} />);
    expect(screen.queryByText(/Due/)).not.toBeInTheDocument();
  });

  it('shows all 5 menu items in dropdown', async () => {
    const user = userEvent.setup();
    render(<CaseCard {...defaultProps} />);

    const trigger = screen.getByRole('button', { name: /case actions menu/i });
    await user.click(trigger);

    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Edit Case')).toBeInTheDocument();
    expect(screen.getByText('Upload Documents')).toBeInTheDocument();
    expect(screen.getByText('Create Form')).toBeInTheDocument();
    expect(screen.getByText('Archive Case')).toBeInTheDocument();
  });
});
