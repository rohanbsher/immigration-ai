import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { QuotaCheck, QuotaMetric } from '@/hooks/use-quota';
import {
  UpgradePromptDialog,
  UpgradePromptBanner,
  QuotaUsageIndicator,
} from './upgrade-prompt';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() })),
  usePathname: vi.fn(() => '/dashboard'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

function makeQuota(overrides: Partial<QuotaCheck> = {}): QuotaCheck {
  return {
    allowed: true,
    current: 5,
    limit: 100,
    remaining: 95,
    isUnlimited: false,
    ...overrides,
  };
}

describe('UpgradePromptDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    metric: 'cases' as QuotaMetric,
    quota: makeQuota({ current: 100, limit: 100, remaining: 0, allowed: false }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders "Limit Reached" title when open', () => {
    render(<UpgradePromptDialog {...defaultProps} />);
    expect(screen.getByText('Limit Reached')).toBeInTheDocument();
  });

  test('shows current/limit usage text', () => {
    render(<UpgradePromptDialog {...defaultProps} />);
    expect(screen.getByText('100 / 100 cases')).toBeInTheDocument();
  });

  test('contains "Upgrade Plan" link to /dashboard/billing', () => {
    render(<UpgradePromptDialog {...defaultProps} />);
    const link = screen.getByRole('link', { name: /Upgrade Plan/i });
    expect(link).toHaveAttribute('href', '/dashboard/billing');
  });
});

describe('UpgradePromptBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns null when usage is below 80%', () => {
    const quota = makeQuota({ current: 70, limit: 100, remaining: 30 });
    const { container } = render(
      <UpgradePromptBanner metric="cases" quota={quota} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders "Approaching Limit" at 80-99% usage', () => {
    const quota = makeQuota({ current: 85, limit: 100, remaining: 15 });
    render(<UpgradePromptBanner metric="cases" quota={quota} />);
    expect(screen.getByText('Approaching Limit')).toBeInTheDocument();
  });

  test('renders "Limit Reached" at 100% usage', () => {
    const quota = makeQuota({ current: 100, limit: 100, remaining: 0, allowed: false });
    render(<UpgradePromptBanner metric="cases" quota={quota} />);
    expect(screen.getByText('Limit Reached')).toBeInTheDocument();
  });

  test('contains Upgrade link to /dashboard/billing', () => {
    const quota = makeQuota({ current: 90, limit: 100, remaining: 10 });
    render(<UpgradePromptBanner metric="cases" quota={quota} />);
    const link = screen.getByRole('link', { name: /Upgrade/i });
    expect(link).toHaveAttribute('href', '/dashboard/billing');
  });
});

describe('QuotaUsageIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows "Unlimited" text when isUnlimited and showLabel is true', () => {
    const quota = makeQuota({ isUnlimited: true });
    render(<QuotaUsageIndicator metric="cases" quota={quota} />);
    expect(screen.getByText('Unlimited cases')).toBeInTheDocument();
  });

  test('returns null when isUnlimited and showLabel is false', () => {
    const quota = makeQuota({ isUnlimited: true });
    const { container } = render(
      <QuotaUsageIndicator metric="cases" quota={quota} showLabel={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders green progress bar when usage is below 80%', () => {
    const quota = makeQuota({ current: 50, limit: 100, remaining: 50 });
    const { container } = render(
      <QuotaUsageIndicator metric="cases" quota={quota} />
    );
    const bar = container.querySelector('.bg-success');
    expect(bar).toBeInTheDocument();
  });

  test('renders yellow progress bar when usage is 80-99%', () => {
    const quota = makeQuota({ current: 85, limit: 100, remaining: 15 });
    const { container } = render(
      <QuotaUsageIndicator metric="cases" quota={quota} />
    );
    const bar = container.querySelector('.bg-warning');
    expect(bar).toBeInTheDocument();
  });

  test('renders red progress bar when usage is at or above 100%', () => {
    const quota = makeQuota({ current: 100, limit: 100, remaining: 0 });
    const { container } = render(
      <QuotaUsageIndicator metric="cases" quota={quota} />
    );
    const bar = container.querySelector('.bg-destructive');
    expect(bar).toBeInTheDocument();
  });
});
