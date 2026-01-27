import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types';

// Re-export API helpers for server-side use
export {
  authenticate,
  requireAuth,
  requireAttorney,
  requireAdmin,
  requireAttorneyOrAdmin,
  verifyCaseAccess,
  verifyDocumentAccess,
  verifyFormAccess,
  withAuth,
  withAttorneyAuth,
  withAdminAuth,
  getClientIp,
  errorResponse,
  successResponse,
} from './api-helpers';

export type {
  AuthResult,
  AuthSuccess,
  AuthError,
  AuthOptions,
  Profile,
  ResourceAccess,
  CaseAccessResult,
  DocumentAccessResult,
  FormAccessResult,
} from './api-helpers';

export interface SignUpData {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  barNumber?: string;
  firmName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  barNumber?: string;
  firmName?: string;
  dateOfBirth?: string;
  countryOfBirth?: string;
  nationality?: string;
  avatarUrl?: string;
}

export type OAuthProvider = 'google' | 'azure';

// Client-side auth functions
export const auth = {
  async signUp(data: SignUpData) {
    const supabase = createClient();

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          role: data.role,
          bar_number: data.barNumber,
          firm_name: data.firmName,
        },
      },
    });

    if (error) {
      throw error;
    }

    return authData;
  },

  async signIn(data: SignInData) {
    const supabase = createClient();

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw error;
    }

    return authData;
  },

  async signInWithOAuth(provider: OAuthProvider) {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider === 'azure' ? 'azure' : 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signOut() {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  async getUser() {
    const supabase = createClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user;
  },

  async getSession() {
    const supabase = createClient();

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return session;
  },

  async resetPassword(email: string) {
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw error;
    }
  },

  async updatePassword(newPassword: string) {
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw error;
    }
  },

  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    const supabase = createClient();

    return supabase.auth.onAuthStateChange(callback);
  },
};

// Server-side auth functions
export const serverAuth = {
  async getUser() {
    const supabase = await createServerClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return user;
  },

  async getSession() {
    const supabase = await createServerClient();

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      return null;
    }

    return session;
  },

  async getProfile() {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return null;
    }

    return profile;
  },

  async requireAuth() {
    const user = await this.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    return user;
  },
};
