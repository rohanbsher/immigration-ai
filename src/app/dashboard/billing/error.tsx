'use client';

import { DashboardErrorBoundary } from '@/components/layout/dashboard-error-boundary';

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardErrorBoundary area="billing" {...props} />;
}
