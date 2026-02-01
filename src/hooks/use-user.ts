'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types';

const AUTH_TIMEOUT_MS = 10_000;

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  mfa_enabled: boolean;
  avatar_url: string | null;
  bar_number: string | null;
  firm_name: string | null;
  specializations: string[] | null;
  date_of_birth: string | null;
  country_of_birth: string | null;
  nationality: string | null;
  alien_number: string | null;
  created_at: string;
  updated_at: string;
}

export class AuthTimeoutError extends Error {
  constructor() {
    super('Authentication check timed out. Please refresh the page or log in again.');
    this.name = 'AuthTimeoutError';
  }
}

interface UseUserReturn {
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  authError: AuthTimeoutError | null;
  refetch: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [authError, setAuthError] = useState<AuthTimeoutError | null>(null);

  // Memoize Supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAuthError(null);

    try {
      const userResult = await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new AuthTimeoutError()), AUTH_TIMEOUT_MS)
        ),
      ]);

      const { data: { user }, error: userError } = userResult;

      if (userError) throw userError;

      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const profileResult = await Promise.race([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new AuthTimeoutError()), AUTH_TIMEOUT_MS)
        ),
      ]);

      const { data: profileData, error: profileError } = profileResult;

      if (profileError) throw profileError;

      setProfile(profileData);
    } catch (err) {
      if (err instanceof AuthTimeoutError) {
        setAuthError(err);
        setProfile(null);
      } else {
        setError(err as Error);
        setProfile(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfile();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          fetchProfile();
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    authError,
    refetch: fetchProfile,
  };
}

export function useUserFullName() {
  const { profile, isLoading } = useUser();

  if (isLoading || !profile) {
    return { fullName: '', isLoading };
  }

  return {
    fullName: `${profile.first_name} ${profile.last_name}`.trim(),
    isLoading,
  };
}

export function useUserInitials() {
  const { profile, isLoading } = useUser();

  if (isLoading || !profile) {
    return { initials: '', isLoading };
  }

  const firstInitial = profile.first_name?.[0] || '';
  const lastInitial = profile.last_name?.[0] || '';

  return {
    initials: `${firstInitial}${lastInitial}`.toUpperCase(),
    isLoading,
  };
}
