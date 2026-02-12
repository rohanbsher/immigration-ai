// Form Definitions Index
// Exports all form definitions and types

export * from './types';
export { I130_FORM } from './i-130';
export { I131_FORM } from './i-131';
export { I140_FORM } from './i-140';
export { I485_FORM } from './i-485';
export { I765_FORM } from './i-765';
export { N400_FORM } from './n-400';

import { FormDefinition } from './types';
import { I130_FORM } from './i-130';
import { I131_FORM } from './i-131';
import { I140_FORM } from './i-140';
import { I485_FORM } from './i-485';
import { I765_FORM } from './i-765';
import { N400_FORM } from './n-400';

// Map of all available form definitions
export const FORM_DEFINITIONS: Record<string, FormDefinition> = {
  'I-130': I130_FORM,
  'I-131': I131_FORM,
  'I-140': I140_FORM,
  'I-485': I485_FORM,
  'I-765': I765_FORM,
  'N-400': N400_FORM,
};

// Get form definition by type
export function getFormDefinition(formType: string): FormDefinition | null {
  return FORM_DEFINITIONS[formType] || null;
}

// Get all available form types
export function getAvailableFormTypes(): string[] {
  return Object.keys(FORM_DEFINITIONS);
}

// Get form summary info for UI
export function getFormSummaries(): Array<{
  formType: string;
  title: string;
  filingFee?: number;
  estimatedTime?: string;
}> {
  return Object.values(FORM_DEFINITIONS).map((form) => ({
    formType: form.formType,
    title: form.title,
    filingFee: form.filingFee,
    estimatedTime: form.estimatedTime,
  }));
}

// Calculate total required fields in a form
export function countRequiredFields(formType: string): number {
  const form = FORM_DEFINITIONS[formType];
  if (!form) return 0;

  return form.sections.reduce((count, section) => {
    return (
      count +
      section.fields.filter((field) => field.validation?.required).length
    );
  }, 0);
}

// Get AI-mappable fields for a form (for auto-fill)
export function getAIMappableFields(formType: string): Array<{
  fieldId: string;
  aiFieldKey: string;
  fieldLabel: string;
}> {
  const form = FORM_DEFINITIONS[formType];
  if (!form) return [];

  const mappableFields: Array<{
    fieldId: string;
    aiFieldKey: string;
    fieldLabel: string;
  }> = [];

  for (const section of form.sections) {
    for (const field of section.fields) {
      if (field.aiMappable && field.aiFieldKey) {
        mappableFields.push({
          fieldId: field.id,
          aiFieldKey: field.aiFieldKey,
          fieldLabel: field.label,
        });
      }
    }
  }

  return mappableFields;
}
