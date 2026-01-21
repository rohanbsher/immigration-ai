'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

// Custom error handler for mutations
const handleMutationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'An error occurred';

  // Don't toast if error is already handled by the component
  // Components can pass onError to override this
  console.error('Mutation error:', message);
};

// Determine if an error should trigger a retry
const shouldRetry = (failureCount: number, error: unknown) => {
  // Don't retry client errors (4xx) except for rate limiting (429)
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found') ||
      message.includes('validation')
    ) {
      return false;
    }
  }

  // Retry up to 3 times for server errors and network issues
  return failureCount < 3;
};

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            refetchOnWindowFocus: false,
            retry: shouldRetry,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            retry: 1,
            retryDelay: 1000,
            onError: handleMutationError,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
