import { createClient } from '@/lib/supabase/server';
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

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  bar_number?: string | null;
  firm_name?: string | null;
  specializations?: string[] | null;
  date_of_birth?: string | null;
  country_of_birth?: string | null;
  nationality?: string | null;
  alien_number?: string | null;
}

export const profilesService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return this.getProfile(user.id);
  },

  async updateProfile(userId: string, data: UpdateProfileData): Promise<Profile | null> {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    return profile;
  },

  async getClientsByAttorney(attorneyId: string): Promise<Profile[]> {
    const supabase = await createClient();

    const { data: cases } = await supabase
      .from('cases')
      .select('client_id')
      .eq('attorney_id', attorneyId);

    if (!cases || cases.length === 0) {
      return [];
    }

    const clientIds = [...new Set(cases.map(c => c.client_id))];

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', clientIds);

    if (error) {
      console.error('Error fetching clients:', error);
      return [];
    }

    return profiles || [];
  },

  async searchProfiles(query: string, role?: UserRole): Promise<Profile[]> {
    const supabase = await createClient();

    let queryBuilder = supabase
      .from('profiles')
      .select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`);

    if (role) {
      queryBuilder = queryBuilder.eq('role', role);
    }

    const { data, error } = await queryBuilder.limit(20);

    if (error) {
      console.error('Error searching profiles:', error);
      return [];
    }

    return data || [];
  },
};
