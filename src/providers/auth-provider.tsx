'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { setUserContext, clearUserContext } from '@/lib/sentry/context';
import type { UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        // Set Sentry user context if logged in
        if (session?.user) {
          await updateSentryContext(session.user.id);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch user profile and update Sentry context
    const updateSentryContext = async (userId: string) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (profile) {
          setUserContext({
            id: userId,
            role: profile.role as UserRole,
          });
        }
      } catch {
        // Silently fail - Sentry context is non-critical
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Update Sentry context on auth changes
        if (event === 'SIGNED_IN' && session?.user) {
          await updateSentryContext(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          clearUserContext();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
