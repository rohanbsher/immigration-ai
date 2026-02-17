import { createClient as createServerClient } from '@/lib/supabase/server';

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
