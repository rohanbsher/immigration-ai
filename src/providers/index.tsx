'use client';

import { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryProvider>
  );
}
