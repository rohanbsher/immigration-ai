import { createClient } from '@/lib/supabase/server';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import { calculateSuccessScore } from '@/lib/scoring/success-probability';
import { getRecommendations } from '@/lib/db/recommendations';
import { getUpcomingDeadlines } from '@/lib/deadline';
import { sanitizeSearchInput } from '@/lib/db/base-service';

/**
 * Tool definitions for Claude function calling.
 */
export const CHAT_TOOLS = [
  {
    name: 'get_case_details',
    description: 'Get detailed information about a specific case including client info, status, and timeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        case_id: {
          type: 'string',
          description: 'The UUID of the case to retrieve',
        },
      },
      required: ['case_id'],
    },
  },
  {
    name: 'get_case_documents',
    description: 'List all documents uploaded for a case.',
    input_schema: {
      type: 'object' as const,
      properties: {
        case_id: {
          type: 'string',
          description: 'The UUID of the case',
        },
      },
      required: ['case_id'],
    },
  },
  {
    name: 'get_document_completeness',
    description: 'Analyze document completeness for a case - shows what documents are present and missing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        case_id: {
          type: 'string',
          description: 'The UUID of the case',
        },
      },
      required: ['case_id'],
    },
  },
  {
    name: 'get_success_score',
    description: 'Get the success probability score and risk factors for a case.',
    input_schema: {
      type: 'object' as const,
      properties: {
        case_id: {
          type: 'string',
          description: 'The UUID of the case',
        },
      },
      required: ['case_id'],
    },
  },
  {
    name: 'get_recommendations',
    description: 'Get AI-generated recommendations and next steps for a case.',
    input_schema: {
      type: 'object' as const,
      properties: {
        case_id: {
          type: 'string',
          description: 'The UUID of the case',
        },
      },
      required: ['case_id'],
    },
  },
  {
    name: 'get_upcoming_deadlines',
    description: 'Get upcoming deadlines for the user across all cases or a specific case.',
    input_schema: {
      type: 'object' as const,
      properties: {
        case_id: {
          type: 'string',
          description: 'Optional case ID to filter deadlines',
        },
        days: {
          type: 'number',
          description: 'Number of days to look ahead (default 60)',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_cases',
    description: 'Search for cases matching certain criteria.',
    input_schema: {
      type: 'object' as const,
      properties: {
        visa_type: {
          type: 'string',
          description: 'Filter by visa type (e.g., H1B, L1, EB-2)',
        },
        status: {
          type: 'string',
          description: 'Filter by status (e.g., active, pending_documents, submitted)',
        },
        query: {
          type: 'string',
          description: 'Text search in case title or client name',
        },
      },
      required: [],
    },
  },
];

/**
 * Execute a tool and return the result.
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<string> {
  const supabase = await createClient();

  try {
    switch (toolName) {
      case 'get_case_details': {
        const caseId = toolInput.case_id as string;
        const { data, error } = await supabase
          .from('cases')
          .select(`
            id,
            title,
            visa_type,
            status,
            priority,
            deadline,
            notes,
            created_at,
            updated_at,
            client:clients!cases_client_id_fkey (
              first_name,
              last_name,
              email
            )
          `)
          .eq('id', caseId)
          .eq('user_id', userId)
          .single();

        if (error) throw new Error('Case not found or access denied');

        // Handle Supabase join
        const clientArr = data.client as unknown as Array<{
          first_name: string;
          last_name: string;
          email: string;
        }> | null;
        const clientData = clientArr?.[0];

        return JSON.stringify({
          id: data.id,
          title: data.title,
          visaType: data.visa_type,
          status: data.status,
          priority: data.priority,
          deadline: data.deadline,
          notes: data.notes,
          client: clientData ? {
            name: `${clientData.first_name} ${clientData.last_name}`,
            email: clientData.email,
          } : null,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }, null, 2);
      }

      case 'get_case_documents': {
        const caseId = toolInput.case_id as string;

        // Verify case access
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select('id')
          .eq('id', caseId)
          .eq('user_id', userId)
          .single();

        if (caseError || !caseData) {
          throw new Error('Case not found or access denied');
        }

        const { data, error } = await supabase
          .from('documents')
          .select('id, original_filename, document_type, ai_confidence_score, created_at')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false });

        if (error) throw new Error('Failed to fetch documents');

        return JSON.stringify({
          total: data?.length || 0,
          documents: (data || []).map(doc => ({
            id: doc.id,
            name: doc.original_filename,
            type: doc.document_type,
            confidence: doc.ai_confidence_score,
            uploadedAt: doc.created_at,
          })),
        }, null, 2);
      }

      case 'get_document_completeness': {
        const caseId = toolInput.case_id as string;

        // Verify case access
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select('id')
          .eq('id', caseId)
          .eq('user_id', userId)
          .single();

        if (caseError || !caseData) {
          throw new Error('Case not found or access denied');
        }

        const result = await analyzeDocumentCompleteness(caseId);
        return JSON.stringify({
          overallCompleteness: `${result.overallCompleteness}%`,
          filingReadiness: result.filingReadiness,
          missingRequired: result.missingRequired.map(d => d.documentType),
          missingOptional: result.missingOptional.map(d => d.documentType),
          uploadedCount: result.uploadedDocs.length,
          recommendations: result.recommendations,
        }, null, 2);
      }

      case 'get_success_score': {
        const caseId = toolInput.case_id as string;

        // Verify case access
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select('id')
          .eq('id', caseId)
          .eq('user_id', userId)
          .single();

        if (caseError || !caseData) {
          throw new Error('Case not found or access denied');
        }

        const result = await calculateSuccessScore(caseId);
        return JSON.stringify({
          overallScore: `${result.overallScore}%`,
          confidence: `${Math.round(result.confidence * 100)}%`,
          factors: result.factors.map(f => ({
            name: f.name,
            score: `${f.score}%`,
            weight: `${Math.round(f.weight * 100)}%`,
          })),
          riskFactors: result.riskFactors,
          improvements: result.improvements,
        }, null, 2);
      }

      case 'get_recommendations': {
        const caseId = toolInput.case_id as string;

        // Verify case access
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select('id')
          .eq('id', caseId)
          .eq('user_id', userId)
          .single();

        if (caseError || !caseData) {
          throw new Error('Case not found or access denied');
        }

        const result = await getRecommendations(caseId, userId);
        return JSON.stringify({
          recommendations: result.recommendations
            .filter(r => !r.completed && !r.dismissedAt)
            .map(r => ({
              priority: r.priority,
              action: r.action,
              reason: r.reason,
              category: r.category,
            })),
          source: result.source,
        }, null, 2);
      }

      case 'get_upcoming_deadlines': {
        const caseId = toolInput.case_id as string | undefined;
        const days = (toolInput.days as number) || 60;

        const result = await getUpcomingDeadlines(userId, days);

        // Filter by case if specified
        const deadlines = caseId
          ? result.filter(d => d.caseId === caseId)
          : result;

        return JSON.stringify({
          total: deadlines.length,
          deadlines: deadlines.map(d => ({
            caseId: d.caseId,
            alertType: d.alertType,
            severity: d.severity,
            message: d.message,
            deadlineDate: d.deadlineDate.toISOString().split('T')[0],
            daysRemaining: d.daysRemaining,
          })),
        }, null, 2);
      }

      case 'search_cases': {
        const visaType = toolInput.visa_type as string | undefined;
        const status = toolInput.status as string | undefined;
        const query = toolInput.query as string | undefined;

        let queryBuilder = supabase
          .from('cases')
          .select(`
            id,
            title,
            visa_type,
            status,
            priority,
            deadline,
            client:clients!cases_client_id_fkey (
              first_name,
              last_name
            )
          `)
          .eq('user_id', userId);

        if (visaType) {
          queryBuilder = queryBuilder.eq('visa_type', visaType);
        }
        if (status) {
          queryBuilder = queryBuilder.eq('status', status);
        }
        if (query) {
          const sanitized = sanitizeSearchInput(query);
          if (sanitized.length > 0) {
            queryBuilder = queryBuilder.or(`title.ilike.%${sanitized}%`);
          }
        }

        const { data, error } = await queryBuilder.limit(10);

        if (error) throw new Error('Search failed');

        return JSON.stringify({
          total: data?.length || 0,
          cases: (data || []).map(c => {
            const clientArr = c.client as unknown as Array<{
              first_name: string;
              last_name: string;
            }> | null;
            const clientData = clientArr?.[0];

            return {
              id: c.id,
              title: c.title,
              visaType: c.visa_type,
              status: c.status,
              priority: c.priority,
              deadline: c.deadline,
              clientName: clientData
                ? `${clientData.first_name} ${clientData.last_name}`
                : 'Unknown',
            };
          }),
        }, null, 2);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    return JSON.stringify({ error: message });
  }
}
