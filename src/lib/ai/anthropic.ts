// Anthropic Claude client for text reasoning and form autofill logic

import Anthropic from '@anthropic-ai/sdk';
import { FormAutofillResult, ExtractedField, FormField } from './types';
import { FORM_AUTOFILL_SYSTEM_PROMPT, getAutofillPrompt } from './prompts';

// Lazy-initialize Anthropic client to avoid errors during build
let anthropicInstance: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicInstance) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicInstance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicInstance;
}

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
 * Generate form autofill suggestions using Claude
 */
export async function generateFormAutofill(
  input: AutofillInput
): Promise<FormAutofillResult> {
  const startTime = Date.now();

  const autofillPrompt = getAutofillPrompt(input.formType);

  // Build the data context for Claude
  const dataContext = `
## Extracted Document Data
${JSON.stringify(input.extractedData, null, 2)}

## Case Context
${input.caseContext ? JSON.stringify(input.caseContext, null, 2) : 'No additional context provided'}

## Existing Form Data
${input.existingFormData ? JSON.stringify(input.existingFormData, null, 2) : 'No existing data'}
`;

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: FORM_AUTOFILL_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${autofillPrompt}\n\n${dataContext}`,
        },
      ],
    });

    // Extract text content from the response
    const textContent = message.content.find((block) => block.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    if (!content) {
      throw new Error('No response content from Claude');
    }

    // Parse JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
      content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not parse JSON response from Claude');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    let parsed: FormAutofillResult;
    try {
      parsed = JSON.parse(jsonStr) as FormAutofillResult;
    } catch (parseError) {
      throw new Error(
        `Failed to parse Claude response as JSON: ${parseError instanceof Error ? parseError.message : 'unknown error'}`
      );
    }

    return {
      ...parsed,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        throw new Error('Invalid Anthropic API key');
      }
      if (error.status === 429) {
        throw new Error('Anthropic rate limit exceeded. Please try again later.');
      }
    }

    throw error;
  }
}

/**
 * Validate form data and identify potential issues
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
  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are an expert immigration attorney reviewing form data for errors and inconsistencies. Be thorough but practical.`,
    messages: [
      {
        role: 'user',
        content: `Review this ${formType} form data for potential issues:

Form Data:
${JSON.stringify(formData, null, 2)}

Case Context:
${caseContext ? JSON.stringify(caseContext, null, 2) : 'None provided'}

Identify:
1. Errors: Critical issues that would cause form rejection
2. Warnings: Potential problems that should be reviewed
3. Suggestions: Improvements or missing optional information

Respond with JSON:
{
  "isValid": true/false,
  "errors": ["list of critical errors"],
  "warnings": ["list of warnings"],
  "suggestions": ["list of suggestions"]
}`,
      },
    ],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  const content = textContent?.type === 'text' ? textContent.text : '';

  if (!content) {
    return {
      isValid: true,
      errors: [],
      warnings: ['Unable to validate form data'],
      suggestions: [],
    };
  }

  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
    content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      isValid: true,
      errors: [],
      warnings: ['Unable to parse validation response'],
      suggestions: [],
    };
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {
      isValid: true,
      errors: [],
      warnings: ['Failed to parse validation response'],
      suggestions: [],
    };
  }
}

/**
 * Generate natural language explanation of form requirements
 */
export async function explainFormRequirements(
  formType: string,
  visaType: string
): Promise<string> {
  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
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
  });

  const textContent = message.content.find((block) => block.type === 'text');
  return textContent?.type === 'text' ? textContent.text : '';
}

/**
 * Analyze document data for consistency across multiple documents
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
  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are an expert at identifying data discrepancies in immigration documents.`,
    messages: [
      {
        role: 'user',
        content: `Analyze these documents for data consistency:

${JSON.stringify(documents, null, 2)}

Compare common fields across documents (name, date of birth, addresses, etc.) and identify any discrepancies.

Respond with JSON:
{
  "consistencyScore": 0.95,
  "discrepancies": [
    {
      "field": "full_name",
      "values": [
        { "document": "passport", "value": "JOHN DOE" },
        { "document": "birth_certificate", "value": "John Doe" }
      ],
      "recommendation": "Minor formatting difference, acceptable"
    }
  ]
}`,
      },
    ],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  const content = textContent?.type === 'text' ? textContent.text : '';

  if (!content) {
    return {
      consistencyScore: 1,
      discrepancies: [],
    };
  }

  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
    content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      consistencyScore: 1,
      discrepancies: [],
    };
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {
      consistencyScore: 1,
      discrepancies: [],
    };
  }
}

/**
 * Suggest next steps based on case status and documents
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
  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Based on this immigration case status, suggest the next steps:

Visa Type: ${caseData.visa_type}
Current Status: ${caseData.status}
Documents Collected: ${caseData.documents.join(', ') || 'None'}
Forms Completed: ${caseData.forms_completed.join(', ') || 'None'}

Respond with JSON:
{
  "nextSteps": [
    {
      "priority": "high",
      "action": "Collect passport copy",
      "reason": "Required for all immigration applications"
    }
  ]
}`,
      },
    ],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  const content = textContent?.type === 'text' ? textContent.text : '';

  if (!content) {
    return { nextSteps: [] };
  }

  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
    content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return { nextSteps: [] };
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { nextSteps: [] };
  }
}

export const anthropicClient = getAnthropicClient;
