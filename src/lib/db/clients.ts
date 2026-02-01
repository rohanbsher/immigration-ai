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

export const clientsService = {
  async getClients(): Promise<ClientWithCases[]> {
    const supabase = await createClient();

    // Get the current user to filter clients they're associated with
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get all client profiles that have cases with this attorney
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('client_id, status')
      .eq('attorney_id', user.id)
      .is('deleted_at', null);

    if (casesError) {
      logger.logError('Error fetching cases', casesError, { userId: user.id });
      throw casesError;
    }

    // Get unique client IDs and count cases
    const clientCases = (cases || []).reduce((acc, c) => {
      if (!acc[c.client_id]) {
        acc[c.client_id] = { total: 0, active: 0 };
      }
      acc[c.client_id].total++;
      if (!['closed', 'denied', 'approved'].includes(c.status)) {
        acc[c.client_id].active++;
      }
      return acc;
    }, {} as Record<string, { total: number; active: number }>);

    const clientIds = Object.keys(clientCases);

    if (clientIds.length === 0) {
      return [];
    }

    // Get client profiles
    const { data: clients, error: clientsError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', clientIds)
      .order('first_name', { ascending: true });

    if (clientsError) {
      logger.logError('Error fetching clients', clientsError, { clientCount: clientIds.length });
      throw clientsError;
    }

    return (clients || []).map((client) => ({
      ...client,
      cases_count: clientCases[client.id]?.total || 0,
      active_cases_count: clientCases[client.id]?.active || 0,
    }));
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
