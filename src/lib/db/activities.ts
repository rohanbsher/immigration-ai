import { BaseService } from './base-service';
import type { ActivityType } from '@/types';

export interface Activity {
  id: string;
  case_id: string;
  user_id: string;
  activity_type: ActivityType;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityWithUser extends Activity {
  user: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export interface CreateActivityData {
  case_id: string;
  activity_type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}

class ActivitiesService extends BaseService {
  constructor() {
    super('activities');
  }

  async getActivitiesByCase(
    caseId: string,
    limit: number = 50
  ): Promise<ActivityWithUser[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          user:profiles!activities_user_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data as ActivityWithUser[];
    }, 'getActivitiesByCase', { caseId });
  }

  async getRecentActivities(limit: number = 20): Promise<ActivityWithUser[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          user:profiles!activities_user_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data as ActivityWithUser[];
    }, 'getRecentActivities', { limit });
  }

  async createActivity(data: CreateActivityData): Promise<Activity> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data: newActivity, error } = await supabase
        .from('activities')
        .insert({
          ...data,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      return newActivity;
    }, 'createActivity', { activityType: data.activity_type, caseId: data.case_id });
  }

  async logCaseCreated(caseId: string, caseTitle: string): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'case_created',
      description: `Case "${caseTitle}" was created`,
    });
  }

  async logCaseUpdated(caseId: string, changes: string): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'case_updated',
      description: changes,
    });
  }

  async logStatusChanged(
    caseId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'status_changed',
      description: `Status changed from ${oldStatus} to ${newStatus}`,
      metadata: { old_status: oldStatus, new_status: newStatus },
    });
  }

  async logDocumentUploaded(
    caseId: string,
    documentName: string,
    documentId: string
  ): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'document_uploaded',
      description: `Document "${documentName}" was uploaded`,
      metadata: { document_id: documentId },
    });
  }

  async logDocumentAnalyzed(
    caseId: string,
    documentName: string,
    documentId: string
  ): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'document_analyzed',
      description: `Document "${documentName}" was analyzed by AI`,
      metadata: { document_id: documentId },
    });
  }

  async logDocumentVerified(
    caseId: string,
    documentName: string,
    documentId: string
  ): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'document_verified',
      description: `Document "${documentName}" was verified`,
      metadata: { document_id: documentId },
    });
  }

  async logFormCreated(
    caseId: string,
    formType: string,
    formId: string
  ): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'form_created',
      description: `Form ${formType} was created`,
      metadata: { form_id: formId, form_type: formType },
    });
  }

  async logFormAiFilled(
    caseId: string,
    formType: string,
    formId: string
  ): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'form_ai_filled',
      description: `Form ${formType} was auto-filled by AI`,
      metadata: { form_id: formId, form_type: formType },
    });
  }

  async logFormReviewed(
    caseId: string,
    formType: string,
    formId: string
  ): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'form_reviewed',
      description: `Form ${formType} was reviewed and approved`,
      metadata: { form_id: formId, form_type: formType },
    });
  }

  async logFormFiled(
    caseId: string,
    formType: string,
    formId: string
  ): Promise<Activity> {
    return this.createActivity({
      case_id: caseId,
      activity_type: 'form_filed',
      description: `Form ${formType} was filed`,
      metadata: { form_id: formId, form_type: formType },
    });
  }
}

// Export singleton instance
export const activitiesService = new ActivitiesService();
