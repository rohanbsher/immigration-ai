import { createClient } from '@/lib/supabase/server';
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

export const formsService = {
  async getFormsByCase(caseId: string): Promise<FormWithReviewer[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('forms')
      .select(`
        *,
        reviewer:profiles!forms_reviewed_by_fkey(id, first_name, last_name)
      `)
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching forms:', error);
      throw error;
    }

    return data as FormWithReviewer[];
  },

  async getForm(id: string): Promise<FormWithReviewer | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('forms')
      .select(`
        *,
        reviewer:profiles!forms_reviewed_by_fkey(id, first_name, last_name)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('Error fetching form:', error);
      return null;
    }

    return data as FormWithReviewer;
  },

  async createForm(data: CreateFormData): Promise<Form> {
    const supabase = await createClient();

    const { data: newForm, error } = await supabase
      .from('forms')
      .insert({
        ...data,
        form_data: data.form_data || {},
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating form:', error);
      throw error;
    }

    return newForm;
  },

  async updateForm(id: string, data: UpdateFormData): Promise<Form> {
    const supabase = await createClient();

    const { data: updatedForm, error } = await supabase
      .from('forms')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating form:', error);
      throw error;
    }

    return updatedForm;
  },

  async reviewForm(id: string, notes: string): Promise<Form> {
    const supabase = await createClient();

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

    if (error) {
      console.error('Error reviewing form:', error);
      throw error;
    }

    return updatedForm;
  },

  async markAsFiled(id: string): Promise<Form> {
    const supabase = await createClient();

    const { data: updatedForm, error } = await supabase
      .from('forms')
      .update({
        status: 'filed',
        filed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error marking form as filed:', error);
      throw error;
    }

    return updatedForm;
  },

  /**
   * Soft delete a form by setting deleted_at timestamp.
   * The form is not permanently removed from the database.
   */
  async deleteForm(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('forms')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting form:', error);
      throw error;
    }
  },

  /**
   * Restore a soft-deleted form.
   */
  async restoreForm(id: string): Promise<Form> {
    const supabase = await createClient();

    const { data: restoredForm, error } = await supabase
      .from('forms')
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error restoring form:', error);
      throw error;
    }

    return restoredForm;
  },
};
