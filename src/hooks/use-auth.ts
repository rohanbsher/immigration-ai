'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { fetchWithTimeout, TimeoutError } from '@/lib/api/fetch-with-timeout';
import type { UserRole } from '@/types';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
}

interface SignUpData {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  barNumber?: string;
  firmName?: string;
}

interface SignInData {
  email: string;
  password: string;
  returnUrl?: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  });
  const router = useRouter();
  // Memoize Supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Track if component is mounted to prevent state updates after unmount
    let isMounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (isMounted) {
          setState({
            user: session?.user ?? null,
            session,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error as Error,
          }));
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (isMounted) {
          setState({
            user: session?.user ?? null,
            session,
            isLoading: false,
            error: null,
          });

          if (event === 'SIGNED_OUT') {
            router.push('/login');
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const signUp = useCallback(async (data: SignUpData) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetchWithTimeout('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        timeout: 'STANDARD',
      });

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      if (result.requiresConfirmation) {
        return { requiresConfirmation: true, message: result.message };
      }

      router.push('/dashboard');
      router.refresh();
      return { success: true };
    } catch (error) {
      if (error instanceof TimeoutError) {
        const timeoutError = new Error('Registration timed out. Please try again.');
        setState(prev => ({ ...prev, error: timeoutError, isLoading: false }));
        throw timeoutError;
      }
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [router]);

  const signIn = useCallback(async (data: SignInData) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetchWithTimeout('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
        timeout: 'STANDARD',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      // Redirect to returnUrl if provided, otherwise dashboard
      const redirectTo = data.returnUrl || '/dashboard';
      router.push(redirectTo);
      router.refresh();
      return { success: true };
    } catch (error) {
      if (error instanceof TimeoutError) {
        const timeoutError = new Error('Login timed out. Please try again.');
        setState(prev => ({ ...prev, error: timeoutError, isLoading: false }));
        throw timeoutError;
      }
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      throw error;
    }
  }, [router]);

  const signInWithOAuth = useCallback(async (provider: 'google' | 'azure') => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === 'azure' ? 'azure' : 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      throw error;
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetchWithTimeout('/api/auth/logout', {
        method: 'POST',
        timeout: 'QUICK',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Logout failed');
      }

      router.push('/login');
      router.refresh();
    } catch (error) {
      if (error instanceof TimeoutError) {
        router.push('/login');
        router.refresh();
        return;
      }
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      throw error;
    }
  }, [router]);

  const resetPassword = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      throw error;
    }
  }, [supabase]);

  const updatePassword = useCallback(async (newPassword: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      throw error;
    }
  }, [supabase]);

  return {
    user: state.user,
    session: state.session,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user,
    error: state.error,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    resetPassword,
    updatePassword,
  };
}
