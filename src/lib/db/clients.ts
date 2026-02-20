import { BaseService, sanitizeSearchInput } from './base-service';
import { getAdminClient } from '@/lib/supabase/admin';
import type { CaseStatus } from '@/types';

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

export interface ClientPaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

// Single source of truth for inactive case statuses.
// A case is "active" if its status is NOT in this list.
// Keep in sync with CaseStatus in src/types/index.ts.
const INACTIVE_CASE_STATUSES: readonly CaseStatus[] = ['closed', 'denied', 'approved'];

function isCaseActive(status: string): boolean {
  return !INACTIVE_CASE_STATUSES.includes(status as CaseStatus);
}

class ClientsService extends BaseService {
  constructor() {
    super('clients');
  }

  /**
   * Resolve the attorney's firm_id from their profile or firm_members fallback.
   * Returns null if no firm association exists. Uses admin client to bypass RLS.
   */
  private async resolveFirmId(admin: ReturnType<typeof getAdminClient>, userId: string): Promise<string | null> {
    const { data: profile } = await admin
      .from('profiles')
      .select('primary_firm_id')
      .eq('id', userId)
      .single();

    const profileRow = profile as { primary_firm_id: string | null } | null;
    let firmId = profileRow?.primary_firm_id;

    if (!firmId) {
      const { data: membership } = await admin
        .from('firm_members')
        .select('firm_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      const memberRow = membership as { firm_id: string } | null;
      firmId = memberRow?.firm_id ?? null;
    }

    return firmId ?? null;
  }

  async getClients(
    options: ClientPaginationOptions = {},
    userId?: string
  ): Promise<{ data: ClientWithCases[]; total: number }> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();
      const { page = 1, limit = 20, search } = options;

      if (!userId) {
        throw new Error('userId is required');
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
        .eq('attorney_id', userId)
        .is('deleted_at', null);

      if (error) {
        throw error;
      }

      // Aggregate case counts per client in memory
      const clientMap = new Map<string, {
        client: Client;
        total: number;
        active: number;
      }>();

      if (casesWithClients && casesWithClients.length > 0) {
        for (const row of casesWithClients) {
          // The client object from the join - Supabase returns object for singular FK relations
          // Use unknown first for safe type narrowing
          const clientRaw = row.client as unknown;
          if (!clientRaw || typeof clientRaw !== 'object') continue;
          const clientData = clientRaw as Client;

          const existing = clientMap.get(clientData.id);
          const isActive = isCaseActive(row.status);

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
      }

      // Include caseless clients who belong to the attorney's firm.
      // These are clients created via createClient() who have primary_firm_id set
      // but no cases yet. Without this, newly created clients are invisible.
      const admin = getAdminClient();
      const firmId = await this.resolveFirmId(admin, userId);

      if (firmId) {
        const { data: firmClients } = await admin
          .from('profiles')
          .select('id, email, first_name, last_name, phone, date_of_birth, country_of_birth, nationality, avatar_url, created_at, updated_at')
          .eq('role', 'client')
          .eq('primary_firm_id', firmId);

        if (firmClients) {
          for (const row of firmClients) {
            const c = row as Client;
            if (!clientMap.has(c.id)) {
              clientMap.set(c.id, { client: c, total: 0, active: 0 });
            }
          }
        }
      }

      // Convert map to array and sort by first_name
      let allClients = Array.from(clientMap.values())
        .map(({ client, total, active }) => ({
          ...client,
          cases_count: total,
          active_cases_count: active,
        }))
        .sort((a, b) => a.first_name.localeCompare(b.first_name));

      // Apply search filter in memory
      if (search) {
        const searchLower = search.toLowerCase();
        allClients = allClients.filter((c) =>
          c.first_name.toLowerCase().includes(searchLower) ||
          c.last_name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower)
        );
      }

      const total = allClients.length;

      // Apply pagination
      const offset = (page - 1) * limit;
      const paginated = allClients.slice(offset, offset + limit);

      return { data: paginated, total };
    }, 'getClients');
  }

  async getClientById(id: string, userId?: string): Promise<ClientWithCases | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      if (!userId) {
        throw new Error('userId is required');
      }

      // Check that the client has cases belonging to the current attorney
      const { data: cases } = await supabase
        .from('cases')
        .select('status')
        .eq('client_id', id)
        .eq('attorney_id', userId)
        .is('deleted_at', null);

      if (cases && cases.length > 0) {
        // Client has cases with this attorney — authorized via case relationship
        const { data: client, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) return null;

        const activeCases = cases.filter((c) => isCaseActive(c.status)).length;
        return {
          ...client,
          cases_count: cases.length,
          active_cases_count: activeCases,
        };
      }

      // Fallback: allow access if the client belongs to the same firm (caseless client).
      // This covers newly created clients who don't have cases yet.
      const admin = getAdminClient();
      const firmId = await this.resolveFirmId(admin, userId);

      if (firmId) {
        const { data: clientProfile } = await admin
          .from('profiles')
          .select('id, email, first_name, last_name, phone, date_of_birth, country_of_birth, nationality, avatar_url, created_at, updated_at')
          .eq('id', id)
          .eq('role', 'client')
          .eq('primary_firm_id', firmId)
          .single();

        if (clientProfile) {
          return {
            ...(clientProfile as Client),
            cases_count: 0,
            active_cases_count: 0,
          };
        }
      }

      return null;
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

  async updateClient(id: string, data: UpdateClientData, userId?: string): Promise<Client> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      if (!userId) {
        throw new Error('userId is required');
      }

      // Check that the client has cases belonging to the current attorney
      const { data: linkedCases } = await supabase
        .from('cases')
        .select('id')
        .eq('client_id', id)
        .eq('attorney_id', userId)
        .is('deleted_at', null)
        .limit(1);

      // Fallback: allow update if the client belongs to the same firm (caseless client)
      if (!linkedCases || linkedCases.length === 0) {
        const admin = getAdminClient();
        const firmId = await this.resolveFirmId(admin, userId);

        if (!firmId) {
          throw new Error('Unauthorized: no relationship to this client');
        }

        const { data: clientProfile } = await admin
          .from('profiles')
          .select('id')
          .eq('id', id)
          .eq('role', 'client')
          .eq('primary_firm_id', firmId)
          .single();

        if (!clientProfile) {
          throw new Error('Unauthorized: no relationship to this client');
        }
      }

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

  async createClient(data: CreateClientData, creatorUserId?: string): Promise<Client> {
    return this.withErrorHandling(async () => {
      const admin = getAdminClient();

      // Create the auth user — the handle_new_user() DB trigger auto-creates the profile.
      // Supabase auth enforces email uniqueness atomically, so we rely on that
      // instead of a separate SELECT check (which has a TOCTOU race condition).
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
        // Supabase returns a specific error for duplicate emails
        if (authError.message?.includes('already been registered') ||
            authError.message?.includes('already exists')) {
          throw new Error('A user with this email already exists');
        }
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

      // Set primary_firm_id on the new client so they're visible to the firm
      // even before any cases are created (fixes caseless client visibility).
      if (creatorUserId && profile) {
        const firmId = await this.resolveFirmId(admin, creatorUserId);
        if (firmId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('profiles') as any)
            .update({ primary_firm_id: firmId })
            .eq('id', profile.id);
        }
      }

      return profile!;
    }, 'createClient', { email: data.email });
  }

  async searchClients(query: string, userId?: string): Promise<Client[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();
      const admin = getAdminClient();

      if (!userId) {
        throw new Error('userId is required');
      }

      const sanitizedQuery = sanitizeSearchInput(query);
      if (sanitizedQuery.length === 0) {
        return [];
      }

      // Strategy 1: Find all clients visible to the attorney's firm.
      // This includes newly created clients who don't have cases yet.
      const firmClients = await this.searchClientsByFirm(admin, userId, sanitizedQuery);
      if (firmClients !== null) {
        return firmClients;
      }

      // Strategy 2 (fallback): Search clients from the attorney's own cases.
      // Used when firm lookup fails (e.g., attorney has no firm).
      return this.searchClientsByCases(supabase, userId, sanitizedQuery);
    }, 'searchClients', { query });
  }

  /**
   * Search clients scoped to the attorney's firm.
   * Finds clients who have cases within the firm OR have no cases yet
   * (newly created clients with primary_firm_id set). Uses admin client to bypass RLS.
   * Returns null if firm lookup fails.
   */
  private async searchClientsByFirm(
    admin: ReturnType<typeof getAdminClient>,
    userId: string,
    sanitizedQuery: string
  ): Promise<Client[] | null> {
    const firmId = await this.resolveFirmId(admin, userId);

    if (!firmId) {
      return null;
    }

    // Get all client IDs from cases belonging to this firm
    const { data: firmCases } = await admin
      .from('cases')
      .select('client_id')
      .eq('firm_id', firmId)
      .is('deleted_at', null);

    const firmCaseRows = (firmCases || []) as { client_id: string }[];
    const firmClientIds = [...new Set(firmCaseRows.map((c) => c.client_id))];

    const searchFilter = `first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`;

    // Search clients linked via cases
    let caseClients: Client[] = [];
    if (firmClientIds.length > 0) {
      const { data: firmMatches, error: firmError } = await admin
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .in('id', firmClientIds)
        .or(searchFilter)
        .limit(10);

      if (firmError) throw firmError;
      caseClients = (firmMatches || []) as Client[];
    }

    // Also search caseless clients who belong to this firm via primary_firm_id
    const { data: firmProfileMatches, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .eq('primary_firm_id', firmId)
      .or(searchFilter)
      .limit(10);

    if (profileError) throw profileError;
    const firmProfileClients = (firmProfileMatches || []) as Client[];

    // Merge results, deduplicating by id
    const seen = new Set<string>();
    const merged: Client[] = [];
    for (const c of [...caseClients, ...firmProfileClients]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        merged.push(c);
      }
    }

    return merged.slice(0, 10);
  }

  /**
   * Fallback: search clients from the attorney's own cases.
   * Used when the attorney has no firm association.
   */
  private async searchClientsByCases(
    supabase: Awaited<ReturnType<typeof this.getSupabaseClient>>,
    userId: string,
    sanitizedQuery: string
  ): Promise<Client[]> {
    const { data: cases } = await supabase
      .from('cases')
      .select('client_id')
      .eq('attorney_id', userId)
      .is('deleted_at', null);

    const clientIds = [...new Set((cases || []).map((c) => c.client_id))];

    if (clientIds.length === 0) {
      return [];
    }

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
  }
}

// Export singleton instance
export const clientsService = new ClientsService();
