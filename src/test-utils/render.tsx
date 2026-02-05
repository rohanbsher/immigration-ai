/**
 * Custom render function with providers for React component testing.
 * Wraps components with necessary context providers.
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import type { UserRole } from '@/types';
import * as useUserModule from '@/hooks/use-user';

// Mock user context value type
interface MockUserContextValue {
  profile: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    firmId: string | null;
  } | null;
  isLoading: boolean;
  error: Error | null;
}

// Create a default mock user context
const defaultUserContext: MockUserContextValue = {
  profile: null,
  isLoading: false,
  error: null,
};

// Mock the useUser hook
vi.mock('@/hooks/use-user', () => ({
  useUser: vi.fn(() => defaultUserContext),
}));

/**
 * Create a test query client with default options for testing
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * Wrapper component that provides all necessary context providers
 */
function AllProviders({ children, queryClient }: AllProvidersProps): ReactElement {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  userContext?: Partial<MockUserContextValue>;
}

/**
 * Custom render function that wraps components with all providers
 *
 * @example
 * ```tsx
 * import { renderWithProviders, screen } from '@/test-utils/render';
 *
 * test('renders component', () => {
 *   renderWithProviders(<MyComponent />, {
 *     userContext: {
 *       profile: { id: '1', role: 'attorney', ... },
 *     },
 *   });
 *
 *   expect(screen.getByText('My Component')).toBeInTheDocument();
 * });
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const { queryClient = createTestQueryClient(), userContext, ...renderOptions } = options;

  // Update the mock user context if provided
  if (userContext) {
    (useUserModule.useUser as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultUserContext,
      ...userContext,
    });
  }

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllProviders queryClient={queryClient}>{children}</AllProviders>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

/**
 * Create a mock user profile for testing
 */
export function createMockUserProfile(
  role: UserRole,
  overrides: Partial<MockUserContextValue['profile']> = {}
): MockUserContextValue['profile'] {
  return {
    id: `user-${Date.now()}`,
    email: `${role}@test.example.com`,
    name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    role,
    firmId: role === 'attorney' ? `firm-${Date.now()}` : null,
    ...overrides,
  };
}

/**
 * Helper to setup user context with a specific role
 */
export function setupUserContext(role: UserRole | null): MockUserContextValue {
  if (!role) {
    return {
      profile: null,
      isLoading: false,
      error: null,
    };
  }

  return {
    profile: createMockUserProfile(role),
    isLoading: false,
    error: null,
  };
}

/**
 * Helper to setup loading state for user context
 */
export function setupLoadingUserContext(): MockUserContextValue {
  return {
    profile: null,
    isLoading: true,
    error: null,
  };
}

/**
 * Helper to setup error state for user context
 */
export function setupErrorUserContext(error: Error): MockUserContextValue {
  return {
    profile: null,
    isLoading: false,
    error,
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Export the custom render as default
export { renderWithProviders as render };
