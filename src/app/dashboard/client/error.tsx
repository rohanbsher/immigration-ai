'use client';

import { DashboardErrorBoundary } from '@/components/layout/dashboard-error-boundary';

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <DashboardErrorBoundary
      area="client-portal"
      title="Client Portal Error"
      description="Something went wrong while loading the client portal."
      {...props}
    />
  );
}
