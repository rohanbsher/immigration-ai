// AI Services Index - Exports all AI functionality

// Types
export * from './types';

// Shared client and model constant
export { getAnthropicClient, CLAUDE_MODEL } from './client';

// Structured output helper
export { callClaudeStructured } from './structured-output';

// Zod schemas for AI responses
export * from './schemas';

// OpenAI Vision services (document OCR)
export {
  analyzeDocumentWithVision,
  detectDocumentType,
  validateDocumentImage,
  extractTextFromImage,
  openaiClient,
} from './openai';

// Claude Vision services (document OCR alternative)
export {
  analyzeDocumentWithClaude,
  extractTextWithClaude,
  detectDocumentTypeWithClaude,
  validateDocumentImageWithClaude,
} from './claude-vision';

// Anthropic Claude services (text reasoning)
export {
  generateFormAutofill,
  validateFormData,
  explainFormRequirements,
  analyzeDataConsistency,
  suggestNextSteps,
  anthropicClient,
} from './anthropic';

// Document analysis (high-level API)
export {
  analyzeDocument,
  analyzeDocuments,
  extractSpecificFields,
  getDocumentText,
  compareDocuments,
  validateDocumentForVisa,
  type DocumentAnalysisInput,
  type AnalysisProgress,
} from './document-analysis';

// Form autofill (high-level API)
export {
  autofillForm,
  validateAutofill,
  getRequiredDocuments,
  mapExtractedFieldToFormField,
  getUnfilledRequiredFields,
  calculateFormCompletion,
  getAutofillGaps,
  type FormAutofillInput,
  type AutofillProgress,
  type AutofillGap,
} from './form-autofill';

// Citations (Phase 4)
export {
  parseCitationsFromResponse,
  mapCitationsToFields,
  hasCitations,
  countCitations,
  generateFieldCitations,
  type CitationDocument,
  type CitationField,
  type CitationInput,
  type CitationResult,
} from './citations';

// Prompts (for customization if needed)
export {
  getExtractionPrompt,
  getAutofillPrompt,
  DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
  FORM_AUTOFILL_SYSTEM_PROMPT,
} from './prompts';
