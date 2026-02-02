import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('db:clients');

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

export const clientsService = {
  async getClients(): Promise<ClientWithCases[]> {
    const supabase = await createClient();

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
      logger.logError('Error fetching clients with cases', error, { userId: user.id });
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
  },

  async getClient(id: string): Promise<ClientWithCases | null> {
    const supabase = await createClient();

    const { data: client, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.logError('Error fetching client', error, { clientId: id });
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
  },

  async getClientCases(clientId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.logError('Error fetching client cases', error, { clientId });
      throw error;
    }

    return data || [];
  },

  async updateClient(id: string, data: UpdateClientData): Promise<Client> {
    const supabase = await createClient();

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.logError('Error updating client', error, { clientId: id });
      throw error;
    }

    return updated;
  },

  async searchClients(query: string): Promise<Client[]> {
    const supabase = await createClient();

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

    // Search within those clients
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', clientIds)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) {
      logger.logError('Error searching clients', error, { query });
      throw error;
    }

    return data || [];
  },
};
