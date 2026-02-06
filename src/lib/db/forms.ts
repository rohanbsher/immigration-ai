import { BaseService } from './base-service';
import type { FormType, FormStatus } from '@/types';

export interface Form {
  id: string;
  case_id: string;
  form_type: FormType;
  status: FormStatus;
  form_data: Record<string, unknown>;
  ai_filled_data: Record<string, unknown> | null;
  ai_confidence_scores: Record<string, number> | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  filed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormWithReviewer extends Form {
  reviewer?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface CreateFormData {
  case_id: string;
  form_type: FormType;
  form_data?: Record<string, unknown>;
}

export interface UpdateFormData {
  status?: FormStatus;
  form_data?: Record<string, unknown>;
  ai_filled_data?: Record<string, unknown>;
  ai_confidence_scores?: Record<string, number>;
  review_notes?: string | null;
}

const FORM_SELECT = `
  *,
  reviewer:profiles!forms_reviewed_by_fkey(id, first_name, last_name)
`;

class FormsService extends BaseService {
  constructor() {
    super('forms');
  }

  async getFormsByCase(caseId: string): Promise<FormWithReviewer[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('forms')
        .select(FORM_SELECT)
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data as FormWithReviewer[];
    }, 'getFormsByCase', { caseId });
  }

  async getForm(id: string): Promise<FormWithReviewer | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('forms')
        .select(FORM_SELECT)
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        return null;
      }

      return data as FormWithReviewer;
    }, 'getForm', { formId: id });
  }

  async createForm(data: CreateFormData): Promise<Form> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: newForm, error } = await supabase
        .from('forms')
        .insert({
          ...data,
          form_data: data.form_data || {},
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      return newForm;
    }, 'createForm', { caseId: data.case_id, formType: data.form_type });
  }

  async updateForm(id: string, data: UpdateFormData): Promise<Form> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: updatedForm, error } = await supabase
        .from('forms')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedForm;
    }, 'updateForm', { formId: id });
  }

  async reviewForm(id: string, notes: string): Promise<Form> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data: updatedForm, error } = await supabase
        .from('forms')
        .update({
          status: 'approved',
          review_notes: notes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedForm;
    }, 'reviewForm', { formId: id });
  }

  async markAsFiled(id: string): Promise<Form> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: updatedForm, error } = await supabase
        .from('forms')
        .update({
          status: 'filed',
          filed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedForm;
    }, 'markAsFiled', { formId: id });
  }

  async deleteForm(id: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('forms')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    }, 'deleteForm', { formId: id });
  }

  async restoreForm(id: string): Promise<Form> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: restoredForm, error } = await supabase
        .from('forms')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return restoredForm;
    }, 'restoreForm', { formId: id });
  }
}

// Export singleton instance
export const formsService = new FormsService();
