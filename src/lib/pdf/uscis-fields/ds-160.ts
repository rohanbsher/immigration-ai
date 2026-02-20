/**
 * AcroForm field mappings for Form DS-160 — Online Nonimmigrant Visa
 * Application (U.S. Department of State).
 *
 * Note: The DS-160 is an online-only form submitted via the CEAC website.
 * These field maps provide a structured data contract for summary PDF
 * generation and for future template filling if a printable DS-160
 * confirmation becomes fillable.
 *
 * Data paths are consistent with the summary PDF field mappings in
 * `src/lib/pdf/templates/index.ts` and the form definition in
 * `src/lib/forms/definitions/ds-160.ts`.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

/**
 * Helper: returns "1" when the data value matches the expected string,
 * empty string otherwise. Used for XFA checkbox groups.
 */
const checkWhen =
  (expected: string) =>
  (v: unknown): string =>
    String(v ?? '').toLowerCase() === expected.toLowerCase() ? '1' : '';

export const DS160_ACRO_FIELDS: AcroFormFieldMap[] = [
  // =======================================================================
  // Part 1 — Personal Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt1Line1_Surname',
    dataPath: 'personal.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line2_GivenNames',
    dataPath: 'personal.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line3_DateOfBirth',
    dataPath: 'personal.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt1Line4_BirthCity',
    dataPath: 'personal.birthCity',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line5_BirthCountry',
    dataPath: 'personal.birthCountry',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line6_Male',
    dataPath: 'personal.sex',
    type: 'checkbox',
    checkValue: 'male',
    format: checkWhen('male'),
  },
  {
    formFieldName: 'form1.Pt1Line6_Female',
    dataPath: 'personal.sex',
    type: 'checkbox',
    checkValue: 'female',
    format: checkWhen('female'),
  },
  {
    formFieldName: 'form1.Pt1Line7_MaritalStatus',
    dataPath: 'personal.maritalStatus',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_Nationality',
    dataPath: 'personal.nationality',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line9_NationalIdNumber',
    dataPath: 'personal.nationalIdNumber',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // =======================================================================
  // Part 2 — Passport Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt2Line1_PassportNumber',
    dataPath: 'passport.number',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt2Line2_IssuingCountry',
    dataPath: 'passport.issuingCountry',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line3_IssueDate',
    dataPath: 'passport.issueDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line4_ExpiryDate',
    dataPath: 'passport.expiryDate',
    type: 'date',
  },

  // =======================================================================
  // Part 3 — Travel Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt3Line1_VisaType',
    dataPath: 'travel.visaType',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line2_ArrivalDate',
    dataPath: 'travel.arrivalDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt3Line3_LengthOfStay',
    dataPath: 'travel.lengthOfStay',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line4_USAddress',
    dataPath: 'travel.usAddress',
    type: 'text',
  },

  // =======================================================================
  // Part 4 — U.S. Point of Contact
  // =======================================================================
  {
    formFieldName: 'form1.Pt4Line1_ContactLastName',
    dataPath: 'usContact.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line2_ContactFirstName',
    dataPath: 'usContact.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line3_ContactPhone',
    dataPath: 'usContact.phone',
    type: 'phone',
  },

  // =======================================================================
  // Part 5 — Family Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt5Line1_FatherName',
    dataPath: 'family.fatherName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line2_MotherName',
    dataPath: 'family.motherName',
    type: 'text',
  },

  // =======================================================================
  // Part 6 — Work / Education
  // =======================================================================
  {
    formFieldName: 'form1.Pt6Line1_Employer',
    dataPath: 'employment.employer',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line2_JobTitle',
    dataPath: 'employment.jobTitle',
    type: 'text',
  },

  // =======================================================================
  // Part 7 — Contact Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt7Line1_Phone',
    dataPath: 'contact.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt7Line2_Email',
    dataPath: 'contact.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt7Line3_Address',
    dataPath: 'contact.address',
    type: 'text',
  },
];
