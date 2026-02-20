'use server';

import { createClient } from '@/lib/supabase/server';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import { calculateSuccessScore } from '@/lib/ai/success-probability';

/**
 * Chat context types.
 */
export interface CaseContext {
  caseId: string;
  title: string;
  visaType: string;
  status: string;
  priority: string;
  client: {
    name: string;
    email?: string;
  };
  deadline?: string;
  completeness?: {
    percentage: number;
    missingRequired: string[];
  };
  successScore?: {
    score: number;
    riskFactors: string[];
  };
  recentDocuments: Array<{
    name: string;
    type: string;
    uploadedAt: string;
  }>;
  recentForms: Array<{
    name: string;
    status: string;
  }>;
}

export interface ChatContext {
  type: 'case' | 'general';
  case?: CaseContext;
  user: {
    name: string;
    role: string;
  };
  timestamp: string;
}

/**
 * Return the static system prompt prefix -- cached via prompt caching (Phase 2).
 * Wrapped in an async function because this file uses 'use server'.
 */
export async function getChatSystemPrefix(): Promise<string> {
  return `You are an AI assistant for immigration attorneys using the Immigration AI platform.

Your role:
- Help attorneys manage immigration cases
- Answer questions about case status, documents, and requirements
- Provide guidance on next steps and deadlines
- Be professional, concise, and helpful

Guidelines:
- When case context is provided below, always answer in the context of that case
- Do NOT ask the user for the case ID or case details when they are already provided in the context
- Never provide legal advice; instead, provide factual information
- Always refer to official USCIS guidelines when relevant
- Be clear about what you can and cannot help with
- If you don't know something, say so`;
}

/**
 * Build context for a specific case.
 */
export async function buildCaseContext(caseId: string, userId: string): Promise<CaseContext | null> {
  const supabase = await createClient();

  // Fetch case details
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select(`
      id,
      title,
      visa_type,
      status,
      priority,
      deadline,
      client:clients!cases_client_id_fkey (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('id', caseId)
    .eq('attorney_id', userId)
    .single();

  if (caseError || !caseData) {
    return null;
  }

  // Handle Supabase join return type
  const clientArr = caseData.client as unknown as Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  }> | null;
  const clientData = clientArr?.[0];

  // Fetch recent documents (exclude soft-deleted)
  const { data: documents } = await supabase
    .from('documents')
    .select('id, file_name, document_type, created_at')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch recent forms (exclude soft-deleted)
  const { data: forms } = await supabase
    .from('forms')
    .select('id, form_type, status')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(5);

  // Try to get completeness (non-blocking)
  let completeness: CaseContext['completeness'];
  try {
    const completenessResult = await analyzeDocumentCompleteness(caseId);
    completeness = {
      percentage: completenessResult.overallCompleteness,
      missingRequired: completenessResult.missingRequired.map(d => d.documentType),
    };
  } catch {
    // Silently fail - context is optional
  }

  // Try to get success score (non-blocking)
  let successScore: CaseContext['successScore'];
  try {
    const scoreResult = await calculateSuccessScore(caseId);
    successScore = {
      score: scoreResult.overallScore,
      riskFactors: scoreResult.riskFactors,
    };
  } catch {
    // Silently fail - context is optional
  }

  return {
    caseId: caseData.id,
    title: caseData.title,
    visaType: caseData.visa_type,
    status: caseData.status,
    priority: caseData.priority,
    deadline: caseData.deadline || undefined,
    client: {
      name: clientData ? `${clientData.first_name} ${clientData.last_name}` : 'Unknown Client',
      email: clientData?.email,
    },
    completeness,
    successScore,
    recentDocuments: (documents || []).map(doc => ({
      name: doc.file_name,
      type: doc.document_type || 'unknown',
      uploadedAt: doc.created_at,
    })),
    recentForms: (forms || []).map(form => ({
      name: form.form_type,
      status: form.status,
    })),
  };
}

/**
 * Build full chat context.
 */
export async function buildChatContext(
  userId: string,
  caseId?: string
): Promise<ChatContext> {
  const supabase = await createClient();

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', userId)
    .single();

  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : 'User';

  const context: ChatContext = {
    type: caseId ? 'case' : 'general',
    user: {
      name: userName,
      role: profile?.role || 'attorney',
    },
    timestamp: new Date().toISOString(),
  };

  if (caseId) {
    const caseContext = await buildCaseContext(caseId, userId);
    if (caseContext) {
      context.case = caseContext;
    }
  }

  return context;
}

/**
 * Format only the dynamic (per-request) portion of the context.
 * This is NOT cached since it changes per request.
 */
export async function formatDynamicContext(context: ChatContext): Promise<string> {
  let prompt = `Today's date: ${new Date().toLocaleDateString()}
User: ${context.user.name} (${context.user.role})

`;

  if (context.case) {
    const c = context.case;
    prompt += `CURRENT CASE CONTEXT:
---------------------
Case: ${c.title}
Case ID: ${c.caseId}
Visa Type: ${c.visaType}
Status: ${c.status}
Priority: ${c.priority}
Client: ${c.client.name}
${c.deadline ? `Deadline: ${c.deadline}` : ''}

`;

    if (c.completeness) {
      prompt += `Document Completeness: ${c.completeness.percentage}%
`;
      if (c.completeness.missingRequired.length > 0) {
        prompt += `Missing Required Documents: ${c.completeness.missingRequired.join(', ')}
`;
      }
    }

    if (c.successScore) {
      prompt += `Success Probability: ${c.successScore.score}%
`;
      if (c.successScore.riskFactors.length > 0) {
        prompt += `Risk Factors: ${c.successScore.riskFactors.join(', ')}
`;
      }
    }

    if (c.recentDocuments.length > 0) {
      prompt += `
Recent Documents:
${c.recentDocuments.map(d => `- ${d.name} (${d.type})`).join('\n')}
`;
    }

    if (c.recentForms.length > 0) {
      prompt += `
Forms:
${c.recentForms.map(f => `- ${f.name}: ${f.status}`).join('\n')}
`;
    }
  } else {
    prompt += `No specific case context. The user may ask general questions about immigration law or the platform.
`;
  }

  return prompt;
}

/**
 * Format context as system prompt (backward-compatible).
 * Combines static prefix + dynamic context into a single string.
 *
 * @deprecated Use `getChatSystemPrefix()` + `formatDynamicContext()` separately
 * and pass them as distinct content blocks to enable prompt caching on the
 * static prefix. This combined form prevents caching since the dynamic portion
 * changes every request.
 */
export async function formatContextForPrompt(context: ChatContext): Promise<string> {
  const prefix = await getChatSystemPrefix();
  const dynamic = await formatDynamicContext(context);
  return prefix + '\n\n' + dynamic;
}
