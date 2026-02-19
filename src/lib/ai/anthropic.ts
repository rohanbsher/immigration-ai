// Anthropic Claude client for text reasoning and form autofill logic

import Anthropic from '@anthropic-ai/sdk';
import { FormAutofillResult, ExtractedField } from './types';
import { FORM_AUTOFILL_SYSTEM_PROMPT, getAutofillPrompt } from './prompts';
import { extractTextContent } from './utils';
import { filterPiiFromExtractedData, filterPiiFromRecord } from './pii-filter';
import { withRetry, AI_RETRY_OPTIONS, RetryExhaustedError } from '@/lib/utils/retry';
import { getAnthropicClient, CLAUDE_MODEL } from './client';
import { callClaudeStructured } from './structured-output';
import {
  FormAutofillResultSchema,
  FormValidationResultSchema,
  DataConsistencyResultSchema,
  NextStepsResultSchema,
} from './schemas';

export interface AutofillInput {
  formType: string;
  extractedData: ExtractedField[];
  existingFormData?: Record<string, string>;
  caseContext?: {
    visa_type?: string;
    petitioner_relationship?: string;
    filing_type?: string;
  };
}

/**
 * Generate form autofill suggestions using Claude (structured output).
 */
export async function generateFormAutofill(
  input: AutofillInput
): Promise<FormAutofillResult> {
  const startTime = Date.now();

  const autofillPrompt = getAutofillPrompt(input.formType);

  // Filter PII before sending to external AI API
  const safeExtractedData = filterPiiFromExtractedData(input.extractedData);
  const safeExistingFormData = input.existingFormData
    ? filterPiiFromRecord(input.existingFormData)
    : undefined;

  // Build the data context for Claude
  const dataContext = `
## Extracted Document Data
${JSON.stringify(safeExtractedData, null, 2)}

## Case Context
${input.caseContext ? JSON.stringify(input.caseContext, null, 2) : 'No additional context provided'}

## Existing Form Data
${safeExistingFormData ? JSON.stringify(safeExistingFormData, null, 2) : 'No existing data'}
`;

  try {
    const result = await callClaudeStructured({
      toolName: 'form_autofill',
      toolDescription: 'Generate form autofill suggestions based on extracted document data.',
      schema: FormAutofillResultSchema,
      system: [
        {
          type: 'text' as const,
          text: FORM_AUTOFILL_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      userMessage: `${autofillPrompt}\n\n${dataContext}`,
      cacheableSystem: false, // already manually cached above
    });

    return {
      ...result,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    // Unwrap RetryExhaustedError to check the original API error
    const cause = error instanceof RetryExhaustedError ? error.lastError : error;

    if (cause instanceof Anthropic.APIError) {
      if (cause.status === 401) {
        throw new Error('Invalid Anthropic API key');
      }
      if (cause.status === 429) {
        throw new Error('Anthropic rate limit exceeded. Please try again later.');
      }
    }

    throw error;
  }
}

/**
 * Validate form data and identify potential issues (structured output).
 */
export async function validateFormData(
  formType: string,
  formData: Record<string, string>,
  caseContext?: Record<string, string>
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}> {
  // Filter PII before sending to external AI API
  const safeFormData = filterPiiFromRecord(formData);

  try {
    return await callClaudeStructured({
      toolName: 'form_validation',
      toolDescription: 'Validate immigration form data and identify potential issues.',
      schema: FormValidationResultSchema,
      system: [
        {
          type: 'text' as const,
          text: 'You are an expert immigration attorney reviewing form data for errors and inconsistencies. Be thorough but practical.',
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      userMessage: `Review this ${formType} form data for potential issues:

Form Data:
${JSON.stringify(safeFormData, null, 2)}

Case Context:
${caseContext ? JSON.stringify(caseContext, null, 2) : 'None provided'}

Identify:
1. Errors: Critical issues that would cause form rejection
2. Warnings: Potential problems that should be reviewed
3. Suggestions: Improvements or missing optional information`,
    });
  } catch {
    return {
      isValid: true,
      errors: [],
      warnings: ['Unable to validate form data'],
      suggestions: [],
    };
  }
}

/**
 * Generate natural language explanation of form requirements.
 * Returns free text, so no structured output needed.
 */
export async function explainFormRequirements(
  formType: string,
  visaType: string
): Promise<string> {
  const message = await withRetry(
    () => getAnthropicClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text' as const,
          text: 'You are an expert immigration attorney assistant. Provide clear, accurate guidance on USCIS form requirements.',
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Explain the requirements for completing form ${formType} for a ${visaType} case.

Include:
1. Purpose of the form
2. Who should file this form
3. Required supporting documents
4. Common mistakes to avoid
5. Current filing fees
6. Processing times (approximate)

Keep the explanation clear and concise, suitable for an attorney reviewing with their client.`,
        },
      ],
    }),
    AI_RETRY_OPTIONS
  );

  return extractTextContent(message.content);
}

/**
 * Analyze document data for consistency across multiple documents (structured output).
 */
export async function analyzeDataConsistency(
  documents: Array<{
    type: string;
    extractedFields: ExtractedField[];
  }>
): Promise<{
  consistencyScore: number;
  discrepancies: Array<{
    field: string;
    values: Array<{ document: string; value: string }>;
    recommendation: string;
  }>;
}> {
  // Filter PII before sending to external AI API
  const safeDocuments = documents.map((doc) => ({
    ...doc,
    extractedFields: filterPiiFromExtractedData(doc.extractedFields),
  }));

  try {
    return await callClaudeStructured({
      toolName: 'data_consistency',
      toolDescription: 'Analyze immigration documents for data consistency and identify discrepancies.',
      schema: DataConsistencyResultSchema,
      system: [
        {
          type: 'text' as const,
          text: 'You are an expert at identifying data discrepancies in immigration documents.',
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      userMessage: `Analyze these documents for data consistency:

${JSON.stringify(safeDocuments, null, 2)}

Compare common fields across documents (name, date of birth, addresses, etc.) and identify any discrepancies.`,
    });
  } catch {
    return {
      consistencyScore: 1,
      discrepancies: [],
    };
  }
}

/**
 * Suggest next steps based on case status and documents (structured output).
 */
export async function suggestNextSteps(
  caseData: {
    visa_type: string;
    status: string;
    documents: string[];
    forms_completed: string[];
  }
): Promise<{
  nextSteps: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
  }>;
}> {
  try {
    return await callClaudeStructured({
      toolName: 'next_steps',
      toolDescription: 'Suggest next steps for an immigration case based on its current status.',
      schema: NextStepsResultSchema,
      system: [
        {
          type: 'text' as const,
          text: 'You are an expert immigration case advisor. Suggest actionable next steps based on the current case status.',
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      userMessage: `Based on this immigration case status, suggest the next steps:

Visa Type: ${caseData.visa_type}
Current Status: ${caseData.status}
Documents Collected: ${caseData.documents.join(', ') || 'None'}
Forms Completed: ${caseData.forms_completed.join(', ') || 'None'}`,
    });
  } catch {
    return { nextSteps: [] };
  }
}

export const anthropicClient = getAnthropicClient;
