'use client';

import { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/error';
import { CookieConsentBanner } from '@/components/consent/cookie-consent-banner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
        <Toaster position="top-right" />
        <CookieConsentBanner />
      </AuthProvider>
    </QueryProvider>
  );
}
