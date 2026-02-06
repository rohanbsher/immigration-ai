import { BaseService, sanitizeSearchInput } from './base-service';
import { getAdminClient } from '@/lib/supabase/admin';

export interface Client {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  date_of_birth: string | null;
  country_of_birth: string | null;
  nationality: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientWithCases extends Client {
  cases_count: number;
  active_cases_count: number;
}

export interface CreateClientData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  country_of_birth?: string;
  nationality?: string;
}

export interface UpdateClientData {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  date_of_birth?: string | null;
  country_of_birth?: string | null;
  nationality?: string | null;
}

// Statuses that indicate an inactive/completed case
const INACTIVE_STATUSES = ['closed', 'denied', 'approved'] as const;

class ClientsService extends BaseService {
  constructor() {
    super('clients');
  }

  async getClients(): Promise<ClientWithCases[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      // Get the current user to filter clients they're associated with
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Unauthorized');
      }

      // Single query: fetch cases with client profile data using Supabase's join syntax
      // This replaces the previous 2-query approach (N+1 fix)
      const { data: casesWithClients, error } = await supabase
        .from('cases')
        .select(`
          client_id,
          status,
          client:profiles!cases_client_id_fkey(
            id,
            email,
            first_name,
            last_name,
            phone,
            date_of_birth,
            country_of_birth,
            nationality,
            avatar_url,
            created_at,
            updated_at
          )
        `)
        .eq('attorney_id', user.id)
        .is('deleted_at', null);

      if (error) {
        throw error;
      }

      if (!casesWithClients || casesWithClients.length === 0) {
        return [];
      }

      // Aggregate case counts per client in memory
      const clientMap = new Map<string, {
        client: Client;
        total: number;
        active: number;
      }>();

      for (const row of casesWithClients) {
        // The client object from the join - Supabase returns object for singular FK relations
        // Use unknown first for safe type narrowing
        const clientRaw = row.client as unknown;
        if (!clientRaw || typeof clientRaw !== 'object') continue;
        const clientData = clientRaw as Client;

        const existing = clientMap.get(clientData.id);
        const isActive = !INACTIVE_STATUSES.includes(row.status as typeof INACTIVE_STATUSES[number]);

        if (existing) {
          existing.total++;
          if (isActive) existing.active++;
        } else {
          clientMap.set(clientData.id, {
            client: clientData,
            total: 1,
            active: isActive ? 1 : 0,
          });
        }
      }

      // Convert map to array and sort by first_name
      return Array.from(clientMap.values())
        .map(({ client, total, active }) => ({
          ...client,
          cases_count: total,
          active_cases_count: active,
        }))
        .sort((a, b) => a.first_name.localeCompare(b.first_name));
    }, 'getClients');
  }

  async getClientById(id: string): Promise<ClientWithCases | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: client, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return null;
      }

      // Get case counts
      const { data: cases } = await supabase
        .from('cases')
        .select('status')
        .eq('client_id', id)
        .is('deleted_at', null);

      const activeStatuses = ['intake', 'document_collection', 'in_review', 'forms_preparation', 'ready_for_filing', 'filed', 'pending_response'];
      const activeCases = (cases || []).filter((c) => activeStatuses.includes(c.status)).length;

      return {
        ...client,
        cases_count: cases?.length || 0,
        active_cases_count: activeCases,
      };
    }, 'getClient', { clientId: id });
  }

  async getClientCases(clientId: string) {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('client_id', clientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    }, 'getClientCases', { clientId });
  }

  async updateClient(id: string, data: UpdateClientData): Promise<Client> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return updated;
    }, 'updateClient', { clientId: id });
  }

  async createClient(data: CreateClientData): Promise<Client> {
    return this.withErrorHandling(async () => {
      const admin = getAdminClient();

      // Check for duplicate email
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();

      if (existing) {
        throw new Error('A user with this email already exists');
      }

      // Create the auth user — the handle_new_user() DB trigger auto-creates the profile
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        user_metadata: {
          first_name: data.first_name,
          last_name: data.last_name,
          role: 'client',
        },
      });

      if (authError) {
        throw authError;
      }

      // Fetch the profile created by the trigger (retry for trigger propagation delay)
      let profile: Client | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error: profileError } = await admin
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (data) {
          profile = data as Client;
          break;
        }
        if (attempt === 2 || (profileError && profileError.code !== 'PGRST116')) {
          throw profileError || new Error('Profile not found after user creation');
        }
        // Wait briefly for the DB trigger to complete
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      return profile!;
    }, 'createClient', { email: data.email });
  }

  async searchClients(query: string): Promise<Client[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Unauthorized');
      }

      // First get client IDs from cases for this attorney
      const { data: cases } = await supabase
        .from('cases')
        .select('client_id')
        .eq('attorney_id', user.id)
        .is('deleted_at', null);

      const clientIds = [...new Set((cases || []).map((c) => c.client_id))];

      if (clientIds.length === 0) {
        return [];
      }

      const sanitizedQuery = sanitizeSearchInput(query);
      if (sanitizedQuery.length === 0) {
        return [];
      }

      // Search within those clients
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', clientIds)
        .or(`first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`)
        .limit(10);

      if (error) {
        throw error;
      }

      return data || [];
    }, 'searchClients', { query });
  }
}

// Export singleton instance
export const clientsService = new ClientsService();
