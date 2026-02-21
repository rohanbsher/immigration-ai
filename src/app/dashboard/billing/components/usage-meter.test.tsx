import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageMeter } from './usage-meter';

describe('UsageMeter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const freeLimits = {
    maxCases: 100,
    maxAiRequestsPerMonth: 1000,
    maxTeamMembers: 5,
  };

  describe('basic rendering', () => {
    test('renders card with title and description', () => {
      render(<UsageMeter limits={freeLimits} />);
      expect(screen.getByText('Usage This Period')).toBeInTheDocument();
      expect(screen.getByText('Your current usage against plan limits')).toBeInTheDocument();
    });

    test('renders all three meter labels', () => {
      render(<UsageMeter limits={freeLimits} />);
      expect(screen.getByText('Cases')).toBeInTheDocument();
      expect(screen.getByText('AI Requests')).toBeInTheDocument();
      expect(screen.getByText('Team Members')).toBeInTheDocument();
    });
  });

  describe('usage display', () => {
    test('shows usage counts with formatted limits', () => {
      render(
        <UsageMeter
          limits={freeLimits}
          usage={{ cases: 42, aiRequests: 500, teamMembers: 3 }}
        />
      );
      expect(screen.getByText('42 / 100')).toBeInTheDocument();
      expect(screen.getByText('500 / 1,000')).toBeInTheDocument();
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
    });

    test('defaults to zero/one when usage is not provided', () => {
      render(<UsageMeter limits={freeLimits} />);
      expect(screen.getByText('0 / 100')).toBeInTheDocument();
      expect(screen.getByText('0 / 1,000')).toBeInTheDocument();
      expect(screen.getByText('1 / 5')).toBeInTheDocument();
    });

    test('handles partial usage object', () => {
      render(
        <UsageMeter limits={freeLimits} usage={{ cases: 10 }} />
      );
      expect(screen.getByText('10 / 100')).toBeInTheDocument();
      // aiRequests and teamMembers should fall back to defaults
      expect(screen.getByText('0 / 1,000')).toBeInTheDocument();
      expect(screen.getByText('1 / 5')).toBeInTheDocument();
    });
  });

  describe('unlimited plan handling', () => {
    const unlimitedLimits = {
      maxCases: -1,
      maxAiRequestsPerMonth: -1,
      maxTeamMembers: -1,
    };

    test('shows "Unlimited" for unlimited plan limits', () => {
      render(
        <UsageMeter
          limits={unlimitedLimits}
          usage={{ cases: 500, aiRequests: 10000, teamMembers: 50 }}
        />
      );
      expect(screen.getByText('500 / Unlimited')).toBeInTheDocument();
      expect(screen.getByText('10,000 / Unlimited')).toBeInTheDocument();
      expect(screen.getByText('50 / Unlimited')).toBeInTheDocument();
    });
  });

  describe('zero usage', () => {
    test('handles zero usage without errors', () => {
      render(
        <UsageMeter
          limits={freeLimits}
          usage={{ cases: 0, aiRequests: 0, teamMembers: 0 }}
        />
      );
      expect(screen.getByText('0 / 100')).toBeInTheDocument();
      expect(screen.getByText('0 / 1,000')).toBeInTheDocument();
      expect(screen.getByText('0 / 5')).toBeInTheDocument();
    });
  });

  describe('high usage / at-limit states', () => {
    test('renders at 100% usage without error', () => {
      render(
        <UsageMeter
          limits={freeLimits}
          usage={{ cases: 100, aiRequests: 1000, teamMembers: 5 }}
        />
      );
      expect(screen.getByText('100 / 100')).toBeInTheDocument();
      expect(screen.getByText('1,000 / 1,000')).toBeInTheDocument();
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });

    test('renders over-limit usage (caps progress bar at 100%)', () => {
      render(
        <UsageMeter
          limits={freeLimits}
          usage={{ cases: 150, aiRequests: 1500, teamMembers: 8 }}
        />
      );
      // The numbers should still display honestly
      expect(screen.getByText('150 / 100')).toBeInTheDocument();
      expect(screen.getByText('1,500 / 1,000')).toBeInTheDocument();
      expect(screen.getByText('8 / 5')).toBeInTheDocument();
    });
  });

  describe('large numbers formatting', () => {
    test('formats large numbers with locale separators', () => {
      render(
        <UsageMeter
          limits={{ maxCases: 10000, maxAiRequestsPerMonth: 100000, maxTeamMembers: 500 }}
          usage={{ cases: 5432, aiRequests: 87654, teamMembers: 123 }}
        />
      );
      expect(screen.getByText('5,432 / 10,000')).toBeInTheDocument();
      expect(screen.getByText('87,654 / 100,000')).toBeInTheDocument();
      expect(screen.getByText('123 / 500')).toBeInTheDocument();
    });
  });
});
