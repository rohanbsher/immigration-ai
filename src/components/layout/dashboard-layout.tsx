'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useUser } from '@/hooks/use-user';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { ChatButton } from '@/components/chat/chat-button';
import { ChatPanel } from '@/components/chat/chat-panel';
import { SessionExpiryWarning } from '@/components/session/session-expiry-warning';
import { IdleTimeoutProvider } from './idle-timeout';
import { Button } from '@/components/ui/button';
import { createBrowserClient } from '@supabase/ssr';

/** Master timeout to prevent infinite loading spinner (5 seconds) */
const AUTH_LOADING_TIMEOUT_MS = 5_000;

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const { profile, isLoading, authError, profileError, refetch } = useUser();
  const router = useRouter();

  // Master timeout to prevent infinite loading state
  useEffect(() => {
    // Reset timedOut when loading completes (via cleanup)
    if (!isLoading) {
      return;
    }

    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, AUTH_LOADING_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      // Reset timedOut during cleanup when isLoading changes
      setTimedOut(false);
    };
  }, [isLoading]);

  const user = profile
    ? {
        name: `${profile.first_name} ${profile.last_name}`,
        email: profile.email,
        role: profile.role,
        avatarUrl: profile.avatar_url || undefined,
      }
    : undefined;

  if (isLoading && !timedOut) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Loading Taking Too Long
          </h2>
          <p className="text-slate-600 mb-6">
            We&apos;re having trouble loading your session. This could be a connection issue.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => {
                setTimedOut(false);
                refetch();
              }}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const supabase = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="w-full"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Session Expired
          </h2>
          <p className="text-slate-600 mb-6">
            Your session has timed out or could not be verified. Please log in again to continue.
          </p>
          <div className="space-y-3">
            <Button
              onClick={async () => {
                const supabase = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="w-full"
            >
              Go to Login
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <AlertCircle className="h-12 w-12 text-orange-500" />
        <h2 className="text-xl font-bold">Unable to Load Profile</h2>
        <p className="text-slate-600 text-center max-w-md">
          We couldn&apos;t load your profile data. This is usually temporary.
        </p>
        <Button onClick={() => refetch()}>
          Try Again
        </Button>
        <Button variant="outline" onClick={async () => {
          const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );
          await supabase.auth.signOut();
          router.push('/login');
        }}>
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <IdleTimeoutProvider>
      <div className="flex h-screen bg-slate-50">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar user={user} />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar user={user} />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title={title}
            user={user}
            onMenuClick={() => setMobileMenuOpen(true)}
          />
          <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
        </div>

        {/* AI Chat Assistant */}
        <ChatButton />
        <ChatPanel />

        {/* Session Expiry Warning */}
        <SessionExpiryWarning />
      </div>
    </IdleTimeoutProvider>
  );
}
