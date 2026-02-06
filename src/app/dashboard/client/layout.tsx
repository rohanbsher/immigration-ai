'use client';

import { useRoleGuard } from '@/hooks/use-role-guard';
import { Loader2 } from 'lucide-react';

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, hasAccess } = useRoleGuard({
    requiredRoles: ['client'],
    redirectTo: '/dashboard',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!hasAccess) return null;

  return <>{children}</>;
}
