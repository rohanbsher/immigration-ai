import { BaseService, sanitizeSearchInput } from './base-service';
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

class ProfilesService extends BaseService {
  constructor() {
    super('profiles');
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return null;
      }

      return data;
    }, 'getProfile', { userId });
  }

  async getCurrentProfile(): Promise<Profile | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      return this.getProfile(user.id);
    }, 'getCurrentProfile');
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<Profile | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: profile, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return profile;
    }, 'updateProfile', { userId });
  }

  async getClientsByAttorney(attorneyId: string): Promise<Profile[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

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

      if (error) throw error;

      return profiles || [];
    }, 'getClientsByAttorney', { attorneyId });
  }

  async searchProfiles(query: string, role?: UserRole): Promise<Profile[]> {
    try {
      const sanitized = sanitizeSearchInput(query);
      if (sanitized.length === 0) return [];

      const supabase = await this.getSupabaseClient();

      let queryBuilder = supabase
        .from('profiles')
        .select('*')
        .or(`first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);

      if (role) {
        queryBuilder = queryBuilder.eq('role', role);
      }

      const { data, error } = await queryBuilder.limit(20);

      if (error) {
        this.logger.logError('Error in searchProfiles', error, { query, role });
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.logError('Error in searchProfiles', error, { query, role });
      return [];
    }
  }
}

// Export singleton instance
export const profilesService = new ProfilesService();
