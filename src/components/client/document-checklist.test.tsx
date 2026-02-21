import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentChecklist } from './document-checklist';

// Mock fetchWithTimeout
vi.mock('@/lib/api/fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

// Mock react-query with controlled data
let mockQueryReturn: {
  data: unknown;
  isLoading: boolean;
  error: unknown;
} = { data: undefined, isLoading: true, error: null };

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => mockQueryReturn,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

describe('DocumentChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryReturn = { data: undefined, isLoading: true, error: null };
  });

  test('renders loading skeletons while loading', () => {
    mockQueryReturn = { data: undefined, isLoading: true, error: null };

    const { container } = render(<DocumentChecklist caseId="case-1" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Document Checklist')).toBeInTheDocument();
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(4);
  });

  test('renders empty state when no requirements', () => {
    mockQueryReturn = { data: [], isLoading: false, error: null };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(
      screen.getByText(
        'No document requirements have been set for this case yet.'
      )
    ).toBeInTheDocument();
  });

  test('renders empty state when requirements is null', () => {
    mockQueryReturn = { data: null, isLoading: false, error: null };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(
      screen.getByText(
        'No document requirements have been set for this case yet.'
      )
    ).toBeInTheDocument();
  });

  test('renders document requirements with labels', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          documentType: 'passport',
          label: 'Valid Passport',
          required: true,
          uploaded: false,
          status: 'pending' as const,
        },
        {
          id: '2',
          documentType: 'visa',
          label: 'Current Visa',
          required: true,
          uploaded: true,
          status: 'uploaded' as const,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Valid Passport')).toBeInTheDocument();
    expect(screen.getByText('Current Visa')).toBeInTheDocument();
  });

  test('renders status badges for each requirement', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          documentType: 'passport',
          label: 'Passport',
          required: true,
          uploaded: false,
          status: 'pending' as const,
        },
        {
          id: '2',
          documentType: 'visa',
          label: 'Visa',
          required: false,
          uploaded: true,
          status: 'verified' as const,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Needed')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  test('renders "Required" badge for required documents', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          documentType: 'passport',
          label: 'Passport',
          required: true,
          uploaded: false,
          status: 'pending' as const,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  test('does not render "Required" badge for optional documents', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          documentType: 'photo',
          label: 'Photo',
          required: false,
          uploaded: false,
          status: 'pending' as const,
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.queryByText('Required')).not.toBeInTheDocument();
  });

  test('renders rejected status with "Needs Revision"', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          documentType: 'passport',
          label: 'Passport',
          required: true,
          uploaded: true,
          status: 'rejected' as const,
          notes: 'Image is blurry',
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Needs Revision')).toBeInTheDocument();
    expect(screen.getByText('Image is blurry')).toBeInTheDocument();
  });

  test('renders verified/total count in header', () => {
    mockQueryReturn = {
      data: [
        { id: '1', documentType: 'passport', label: 'Passport', required: true, uploaded: true, status: 'verified' as const },
        { id: '2', documentType: 'visa', label: 'Visa', required: true, uploaded: true, status: 'uploaded' as const },
        { id: '3', documentType: 'photo', label: 'Photo', required: false, uploaded: false, status: 'pending' as const },
      ],
      isLoading: false,
      error: null,
    };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    // 1 verified / 2 required
    expect(screen.getByText('1 / 2 verified')).toBeInTheDocument();
  });

  test('renders progress summary', () => {
    mockQueryReturn = {
      data: [
        { id: '1', documentType: 'passport', label: 'Passport', required: true, uploaded: true, status: 'verified' as const },
        { id: '2', documentType: 'visa', label: 'Visa', required: true, uploaded: false, status: 'pending' as const },
        { id: '3', documentType: 'photo', label: 'Photo', required: true, uploaded: false, status: 'pending' as const },
      ],
      isLoading: false,
      error: null,
    };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('1 uploaded')).toBeInTheDocument();
    expect(screen.getByText('1 verified')).toBeInTheDocument();
    expect(screen.getByText('2 remaining')).toBeInTheDocument();
  });

  test('renders notes when present', () => {
    mockQueryReturn = {
      data: [
        {
          id: '1',
          documentType: 'passport',
          label: 'Passport',
          required: true,
          uploaded: false,
          status: 'pending' as const,
          notes: 'Must be valid for 6 months',
        },
      ],
      isLoading: false,
      error: null,
    };

    render(<DocumentChecklist caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Must be valid for 6 months')).toBeInTheDocument();
  });
});
