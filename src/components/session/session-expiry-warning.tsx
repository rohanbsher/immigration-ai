'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, LogOut } from 'lucide-react';

const WARNING_TIME_MS = 5 * 60 * 1000; // 5 minutes before expiry
const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

export function SessionExpiryWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExtending, setIsExtending] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const checkSessionExpiry = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const expiresAt = session.expires_at;
      if (!expiresAt) return;

      const expiryTime = expiresAt * 1000; // Convert to milliseconds
      const now = Date.now();
      const remaining = expiryTime - now;

      if (remaining <= 0) {
        // Session expired, redirect to login with return URL
        const returnUrl = encodeURIComponent(pathname);
        router.push(`/login?returnUrl=${returnUrl}&expired=true`);
        return;
      }

      if (remaining <= WARNING_TIME_MS && !showWarning) {
        setShowWarning(true);
        setTimeRemaining(remaining);
      } else if (remaining > WARNING_TIME_MS && showWarning) {
        setShowWarning(false);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  }, [pathname, router, showWarning, supabase.auth]);

  useEffect(() => {
    checkSessionExpiry();
    const interval = setInterval(checkSessionExpiry, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [checkSessionExpiry]);

  useEffect(() => {
    if (!showWarning || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const newValue = prev - 1000;
        if (newValue <= 0) {
          clearInterval(timer);
          const returnUrl = encodeURIComponent(pathname);
          router.push(`/login?returnUrl=${returnUrl}&expired=true`);
        }
        return newValue;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showWarning, timeRemaining, pathname, router]);

  const handleExtendSession = async () => {
    setIsExtending(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        throw error;
      }

      if (data.session) {
        setShowWarning(false);
        setTimeRemaining(0);
      }
    } catch (error) {
      console.error('Error extending session:', error);
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?returnUrl=${returnUrl}&expired=true`);
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
              <p className="text-2xl font-bold text-amber-600 tabular-nums">
                {formatTime(timeRemaining)}
              </p>
            </div>
          </div>
          <AlertDialogDescription>
            Your session will expire in {formatTime(timeRemaining)}. Would you like to stay logged in?
            Any unsaved changes may be lost if you don&apos;t extend your session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut size={16} />
            Log Out
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleExtendSession}
            disabled={isExtending}
          >
            {isExtending ? 'Extending...' : 'Stay Logged In'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
