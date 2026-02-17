'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { CommandPalette } from './command-palette';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useUser } from '@/hooks/use-user';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { SessionExpiryWarning } from '@/components/session/session-expiry-warning';
import { IdleTimeoutProvider } from './idle-timeout';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist';

const ChatButton = dynamic(
  () => import('@/components/chat/chat-button').then(m => ({ default: m.ChatButton })),
  { ssr: false }
);
const ChatPanel = dynamic(
  () => import('@/components/chat/chat-panel').then(m => ({ default: m.ChatPanel })),
  { ssr: false }
);

/** Master timeout to prevent infinite loading spinner (5 seconds) */
const AUTH_LOADING_TIMEOUT_MS = 5_000;

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const { profile, isLoading, error, authError, profileError, refetch } = useUser();
  const { shortcuts, dialogOpen, setDialogOpen } = useKeyboardShortcuts();

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);

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
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Loading Taking Too Long
          </h2>
          <p className="text-muted-foreground mb-6">
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
              onClick={handleSignOut}
              className="w-full"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (authError || error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {authError ? 'Connection Issue' : 'Session Expired'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {authError
              ? 'We couldn\u2019t verify your session in time. This may be a connection issue \u2014 try again.'
              : 'Your session could not be verified. Please log in again to continue.'}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => refetch()}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <AlertCircle className="h-12 w-12 text-warning" />
        <h2 className="text-xl font-bold">Unable to Load Profile</h2>
        <p className="text-muted-foreground text-center max-w-md">
          We couldn&apos;t load your profile data. This is usually temporary.
        </p>
        <Button onClick={() => refetch()}>
          Try Again
        </Button>
        <Button variant="outline" onClick={handleSignOut}>
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <IdleTimeoutProvider>
      <div className="flex h-screen bg-background">
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
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <OnboardingChecklist />
            {children}
          </main>
        </div>

        {/* AI Chat Assistant */}
        <ChatButton />
        <ChatPanel />

        {/* Session Expiry Warning */}
        <SessionExpiryWarning />

        {/* Command Palette (Cmd+K) */}
        <CommandPalette />

        {/* Keyboard Shortcuts Help Dialog */}
        <KeyboardShortcutsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          shortcuts={shortcuts}
        />
      </div>
    </IdleTimeoutProvider>
  );
}
