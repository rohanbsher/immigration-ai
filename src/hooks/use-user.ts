'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types';

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

interface UseUserReturn {
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);
    } catch (err) {
      setError(err as Error);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    profile,
    isLoading,
    error,
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
