import { createLogger } from '@/lib/logger';

const log = createLogger('ai:audit');

export type AIOperation =
  | 'document_analysis'
  | 'form_autofill'
  | 'chat'
  | 'data_consistency'
  | 'next_steps';

export type AIProvider = 'openai' | 'anthropic';

export interface AIAuditEntry {
  operation: AIOperation;
  provider: AIProvider;
  userId: string;
  caseId?: string;
  documentId?: string;
  formId?: string;
  dataFieldsSent: string[];
  model: string;
  processingTimeMs?: number;
  /** Tokens written to the prompt cache (Anthropic prompt caching). */
  cacheCreationInputTokens?: number;
  /** Tokens read from the prompt cache (Anthropic prompt caching). */
  cacheReadInputTokens?: number;
}

export function logAIRequest(entry: AIAuditEntry): void {
  log.info('AI API request', {
    operation: entry.operation,
    provider: entry.provider,
    userId: entry.userId,
    caseId: entry.caseId,
    documentId: entry.documentId,
    formId: entry.formId,
    dataFieldsSent: entry.dataFieldsSent,
    model: entry.model,
    processingTimeMs: entry.processingTimeMs,
    cacheCreationInputTokens: entry.cacheCreationInputTokens,
    cacheReadInputTokens: entry.cacheReadInputTokens,
  });

  // Persist to audit_log table (fire-and-forget)
  persistAuditLog(entry).catch((err) => {
    log.warn('Failed to persist AI audit log', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

async function persistAuditLog(entry: AIAuditEntry): Promise<void> {
  try {
    const { getAdminClient } = await import('@/lib/supabase/admin');
    const admin = getAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('audit_log') as any).insert({
      table_name: 'ai_requests',
      record_id: entry.caseId || entry.documentId || entry.formId || 'unknown',
      operation: entry.operation,
      changed_by: entry.userId,
      new_values: {
        provider: entry.provider,
        model: entry.model,
        dataFieldsSent: entry.dataFieldsSent,
        processingTimeMs: entry.processingTimeMs,
        documentId: entry.documentId,
        formId: entry.formId,
        caseId: entry.caseId,
        cacheCreationInputTokens: entry.cacheCreationInputTokens,
        cacheReadInputTokens: entry.cacheReadInputTokens,
      },
      additional_context: { source: 'ai_audit' },
    });
  } catch {
    // Silently fail — console logging already captured the entry
  }
}
