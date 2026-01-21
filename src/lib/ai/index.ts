// AI Services Index - Exports all AI functionality

// Types
export * from './types';

// OpenAI Vision services (document OCR)
export {
  analyzeDocumentWithVision,
  detectDocumentType,
  validateDocumentImage,
  extractTextFromImage,
  openaiClient,
} from './openai';

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
  type FormAutofillInput,
  type AutofillProgress,
} from './form-autofill';

// Prompts (for customization if needed)
export {
  getExtractionPrompt,
  getAutofillPrompt,
  DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
  FORM_AUTOFILL_SYSTEM_PROMPT,
} from './prompts';
