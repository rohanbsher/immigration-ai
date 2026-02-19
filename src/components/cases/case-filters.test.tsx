import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseFilters, getStatusesForFilter } from './case-filters';

const defaultProps = {
  search: '',
  onSearchChange: vi.fn(),
  statusFilter: 'all' as const,
  onStatusFilterChange: vi.fn(),
};

describe('CaseFilters', () => {
  it('renders search input with correct placeholder', () => {
    render(<CaseFilters {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('Search cases by title...'),
    ).toBeInTheDocument();
  });

  it('fires onSearchChange when typing', async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('Search cases by title...');
    await user.type(input, 'visa');

    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange).toHaveBeenLastCalledWith(expect.stringContaining('a'));
  });

  it('renders all status filter tabs', () => {
    render(<CaseFilters {...defaultProps} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Filed')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });
});

describe('getStatusesForFilter', () => {
  it('returns 6 active statuses for "active"', () => {
    expect(getStatusesForFilter('active')).toEqual([
      'intake',
      'document_collection',
      'in_review',
      'forms_preparation',
      'ready_for_filing',
      'pending_response',
    ]);
  });

  it('returns filed statuses for "filed"', () => {
    expect(getStatusesForFilter('filed')).toEqual([
      'filed',
      'approved',
      'denied',
    ]);
  });

  it('returns closed status for "closed"', () => {
    expect(getStatusesForFilter('closed')).toEqual(['closed']);
  });

  it('returns undefined for "all"', () => {
    expect(getStatusesForFilter('all')).toBeUndefined();
  });
});
