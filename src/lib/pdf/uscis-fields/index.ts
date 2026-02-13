/**
 * Barrel export for USCIS AcroForm field mappings.
 *
 * Verified against USCIS XFA PDFs downloaded Feb 2026.
 */

import type { FormType } from '@/types';
import type { AcroFormFieldMap } from '../acroform-filler';

import { G1145_ACRO_FIELDS } from './g-1145';
import { I130_ACRO_FIELDS } from './i-130';
import { I485_ACRO_FIELDS } from './i-485';
import { I765_ACRO_FIELDS } from './i-765';
import { I131_ACRO_FIELDS } from './i-131';
import { N400_ACRO_FIELDS } from './n-400';
import { I140_ACRO_FIELDS } from './i-140';

export { G1145_ACRO_FIELDS } from './g-1145';
export { I130_ACRO_FIELDS } from './i-130';
export { I485_ACRO_FIELDS } from './i-485';
export { I765_ACRO_FIELDS } from './i-765';
export { I131_ACRO_FIELDS } from './i-131';
export { N400_ACRO_FIELDS } from './n-400';
export { I140_ACRO_FIELDS } from './i-140';

const FIELD_MAP_REGISTRY: Partial<Record<FormType, AcroFormFieldMap[]>> = {
  'G-1145': G1145_ACRO_FIELDS,
  'I-130': I130_ACRO_FIELDS,
  'I-485': I485_ACRO_FIELDS,
  'I-765': I765_ACRO_FIELDS,
  'I-131': I131_ACRO_FIELDS,
  'N-400': N400_ACRO_FIELDS,
  'I-140': I140_ACRO_FIELDS,
};

/**
 * Retrieve the AcroForm field map for a given USCIS form type.
 * Returns undefined if no mapping exists for the form type.
 */
export function getUSCISFieldMap(
  formType: FormType
): AcroFormFieldMap[] | undefined {
  return FIELD_MAP_REGISTRY[formType];
}

/**
 * Check whether an AcroForm field mapping is available for a form type.
 */
export function hasUSCISFieldMap(formType: FormType): boolean {
  return formType in FIELD_MAP_REGISTRY;
}
