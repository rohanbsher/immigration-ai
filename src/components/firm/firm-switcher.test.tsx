import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FirmSwitcher } from './firm-switcher';
import type { Firm } from '@/types/firms';

// Mock useFirms
let mockUseFirmsReturn: {
  data: Firm[] | undefined;
  isLoading: boolean;
} = { data: undefined, isLoading: true };

vi.mock('@/hooks/use-firm', () => ({
  useFirms: () => mockUseFirmsReturn,
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeFirm(overrides: Partial<Firm> = {}): Firm {
  return {
    id: 'firm-1',
    name: 'Smith & Associates',
    slug: 'smith-associates',
    ownerId: 'user-1',
    logoUrl: null,
    website: null,
    phone: null,
    address: {},
    settings: {},
    subscriptionId: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('FirmSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFirmsReturn = { data: undefined, isLoading: true };
  });

  test('returns null while loading', () => {
    mockUseFirmsReturn = { data: undefined, isLoading: true };
    const { container } = render(<FirmSwitcher />, { wrapper: createWrapper() });
    expect(container.innerHTML).toBe('');
  });

  test('returns null when no firms', () => {
    mockUseFirmsReturn = { data: [], isLoading: false };
    const { container } = render(<FirmSwitcher />, { wrapper: createWrapper() });
    expect(container.innerHTML).toBe('');
  });

  test('returns null when firms data is undefined', () => {
    mockUseFirmsReturn = { data: undefined, isLoading: false };
    const { container } = render(<FirmSwitcher />, { wrapper: createWrapper() });
    expect(container.innerHTML).toBe('');
  });

  test('renders firm name when single firm exists', () => {
    mockUseFirmsReturn = {
      data: [makeFirm()],
      isLoading: false,
    };
    render(<FirmSwitcher />, { wrapper: createWrapper() });
    expect(screen.getByText('Smith & Associates')).toBeInTheDocument();
  });

  test('returns null when collapsed with single firm', () => {
    mockUseFirmsReturn = {
      data: [makeFirm()],
      isLoading: false,
    };
    const { container } = render(<FirmSwitcher collapsed />, {
      wrapper: createWrapper(),
    });
    expect(container.innerHTML).toBe('');
  });

  test('renders selected firm when selectedFirmId matches', () => {
    mockUseFirmsReturn = {
      data: [
        makeFirm({ id: 'firm-1', name: 'Firm Alpha' }),
        makeFirm({ id: 'firm-2', name: 'Firm Beta' }),
      ],
      isLoading: false,
    };
    render(<FirmSwitcher selectedFirmId="firm-2" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Firm Beta')).toBeInTheDocument();
  });

  test('defaults to first firm when selectedFirmId does not match', () => {
    mockUseFirmsReturn = {
      data: [
        makeFirm({ id: 'firm-1', name: 'Firm Alpha' }),
        makeFirm({ id: 'firm-2', name: 'Firm Beta' }),
      ],
      isLoading: false,
    };
    render(<FirmSwitcher selectedFirmId="nonexistent" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Firm Alpha')).toBeInTheDocument();
  });

  test('renders trigger button for dropdown with multiple firms', () => {
    mockUseFirmsReturn = {
      data: [
        makeFirm({ id: 'firm-1', name: 'Alpha Law' }),
        makeFirm({ id: 'firm-2', name: 'Beta Legal' }),
      ],
      isLoading: false,
    };
    render(<FirmSwitcher />, { wrapper: createWrapper() });

    // The trigger button should show the first firm name
    const trigger = screen.getByText('Alpha Law');
    expect(trigger).toBeInTheDocument();
    // Should have a dropdown trigger role
    expect(trigger.closest('button')).toHaveAttribute('aria-haspopup', 'menu');
  });

  test('hides firm name in collapsed mode with multiple firms', () => {
    mockUseFirmsReturn = {
      data: [
        makeFirm({ id: 'firm-1', name: 'Alpha' }),
        makeFirm({ id: 'firm-2', name: 'Beta' }),
      ],
      isLoading: false,
    };
    render(<FirmSwitcher collapsed />, { wrapper: createWrapper() });
    // When collapsed, the name text span is not rendered
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  test('renders Building2 icon in collapsed mode', () => {
    mockUseFirmsReturn = {
      data: [
        makeFirm({ id: 'firm-1', name: 'A' }),
        makeFirm({ id: 'firm-2', name: 'B' }),
      ],
      isLoading: false,
    };
    const { container } = render(<FirmSwitcher collapsed />, {
      wrapper: createWrapper(),
    });
    // Should still render an SVG icon
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
