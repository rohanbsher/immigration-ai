/**
 * AcroForm field mappings for Form G-1145 — e-Notification of
 * Application/Petition Acceptance.
 *
 * Field names verified against USCIS XFA PDFs downloaded Feb 2026.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

export const G1145_ACRO_FIELDS: AcroFormFieldMap[] = [
  {
    formFieldName: 'form1.LastName',
    dataPath: 'applicant.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.FirstName',
    dataPath: 'applicant.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.MiddleName',
    dataPath: 'applicant.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Email',
    dataPath: 'email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.MobilePhoneNumber',
    dataPath: 'mobilePhone',
    type: 'phone',
  },
];
