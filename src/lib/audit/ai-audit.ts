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
  });
}
