import { BaseService, sanitizeSearchInput } from './base-service';
import type { CaseStatus, VisaType } from '@/types';

export interface Case {
  id: string;
  attorney_id: string;
  client_id: string;
  visa_type: VisaType;
  status: CaseStatus;
  title: string;
  description: string | null;
  priority_date: string | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseWithRelations extends Case {
  attorney: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  client: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  documents_count: number;
  forms_count: number;
}

export interface CreateCaseData {
  client_id: string;
  visa_type: VisaType;
  title: string;
  description?: string;
  priority_date?: string;
  deadline?: string;
  notes?: string;
}

export interface UpdateCaseData {
  visa_type?: VisaType;
  status?: CaseStatus;
  title?: string;
  description?: string | null;
  priority_date?: string | null;
  deadline?: string | null;
  notes?: string | null;
}

export interface CaseFilters {
  status?: CaseStatus | CaseStatus[];
  visa_type?: VisaType | VisaType[];
  client_id?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class CasesService extends BaseService {
  constructor() {
    super('cases');
  }

  async getCases(
    filters: CaseFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<{ cases: CaseWithRelations[]; total: number }> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();
      const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      let query = supabase
        .from('cases')
        .select(`
          *,
          attorney:profiles!cases_attorney_id_fkey(id, first_name, last_name, email),
          client:profiles!cases_client_id_fkey(id, first_name, last_name, email),
          documents(count),
          forms(count)
        `, { count: 'exact' })
        .is('deleted_at', null);

      // Apply filters
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.visa_type) {
        if (Array.isArray(filters.visa_type)) {
          query = query.in('visa_type', filters.visa_type);
        } else {
          query = query.eq('visa_type', filters.visa_type);
        }
      }

      if (filters.client_id) {
        query = query.eq('client_id', filters.client_id);
      }

      if (filters.search) {
        const search = sanitizeSearchInput(filters.search);
        if (search.length > 0) {
          query = query.or(`title.ilike.%${search}%`);
        }
      }

      // Apply pagination and sorting
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform the data to include counts
      const cases = (data || []).map((c: Record<string, unknown>) => ({
        ...c,
        documents_count: (c.documents as Array<{count: number}>)?.[0]?.count || 0,
        forms_count: (c.forms as Array<{count: number}>)?.[0]?.count || 0,
      })) as CaseWithRelations[];

      return { cases, total: count || 0 };
    }, 'getCases', { filters });
  }

  async getCase(id: string): Promise<CaseWithRelations | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          attorney:profiles!cases_attorney_id_fkey(id, first_name, last_name, email),
          client:profiles!cases_client_id_fkey(id, first_name, last_name, email),
          documents(count),
          forms(count)
        `)
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        return null;
      }

      return {
        ...data,
        documents_count: data.documents?.[0]?.count || 0,
        forms_count: data.forms?.[0]?.count || 0,
      } as CaseWithRelations;
    }, 'getCase', { caseId: id });
  }

  async createCase(data: CreateCaseData): Promise<Case> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data: newCase, error } = await supabase
        .from('cases')
        .insert({
          ...data,
          attorney_id: user.id,
          status: 'intake',
        })
        .select()
        .single();

      if (error) throw error;

      return newCase;
    }, 'createCase');
  }

  async updateCase(id: string, data: UpdateCaseData): Promise<Case> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: updatedCase, error } = await supabase
        .from('cases')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedCase;
    }, 'updateCase', { caseId: id });
  }

  async deleteCase(id: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('cases')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    }, 'deleteCase', { caseId: id });
  }

  async restoreCase(id: string): Promise<Case> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: restoredCase, error } = await supabase
        .from('cases')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return restoredCase;
    }, 'restoreCase', { caseId: id });
  }

  async getCaseStats(): Promise<{
    total: number;
    byStatus: Record<CaseStatus, number>;
    pendingDeadlines: number;
  }> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: cases, error } = await supabase
        .from('cases')
        .select('status, deadline')
        .is('deleted_at', null);

      if (error) throw error;

      const byStatus = (cases || []).reduce((acc, c) => {
        acc[c.status as CaseStatus] = (acc[c.status as CaseStatus] || 0) + 1;
        return acc;
      }, {} as Record<CaseStatus, number>);

      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const pendingDeadlines = (cases || []).filter(c => {
        if (!c.deadline) return false;
        const deadline = new Date(c.deadline);
        return deadline >= now && deadline <= nextWeek;
      }).length;

      return {
        total: cases?.length || 0,
        byStatus,
        pendingDeadlines,
      };
    }, 'getCaseStats');
  }
}

// Export singleton instance
export const casesService = new CasesService();
