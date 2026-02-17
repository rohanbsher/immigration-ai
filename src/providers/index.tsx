'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from './query-provider';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/error';
import { CookieConsentBanner } from '@/components/consent/cookie-consent-banner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
        <Toaster position="top-right" />
        <CookieConsentBanner />
      </QueryProvider>
    </ThemeProvider>
  );
}
