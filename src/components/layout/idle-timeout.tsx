'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // Show warning 2 minutes before logout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Monitors user activity and logs out after prolonged inactivity.
 * Required for PII protection in legal applications.
 */
export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const lastActivityRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push('/login?reason=idle');
  }, [router]);

  // Initialize lastActivity on mount (avoids impure call during render)
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    // Register activity listeners
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    // Check idle state every 30 seconds
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= IDLE_TIMEOUT_MS) {
        handleLogout();
      } else if (elapsed >= IDLE_TIMEOUT_MS - WARNING_BEFORE_MS) {
        setShowWarning(true);
      }
    }, 30_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [resetTimer, handleLogout]);

  return (
    <>
      {children}
      {showWarning && (
        <div
          role="alertdialog"
          aria-label="Session timeout warning"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Session Expiring Soon
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Your session will expire in less than 2 minutes due to inactivity.
              Move your mouse or press any key to stay logged in.
            </p>
            <button
              onClick={resetTimer}
              className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      )}
    </>
  );
}
