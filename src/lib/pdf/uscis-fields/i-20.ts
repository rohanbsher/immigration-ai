/**
 * AcroForm field mappings for Form I-20 — Certificate of Eligibility
 * for Nonimmigrant (F-1/M-1) Student Status.
 *
 * Note: The I-20 is school-generated (not a USCIS fillable form filed by
 * the applicant). These field maps provide a structured data contract for
 * summary PDF generation and for future template filling if a fillable
 * I-20 template becomes available.
 *
 * Data paths are consistent with the summary PDF field mappings in
 * `src/lib/pdf/templates/index.ts` and the form definition in
 * `src/lib/forms/definitions/i-20.ts`.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

export const I20_ACRO_FIELDS: AcroFormFieldMap[] = [
  // =======================================================================
  // Part 1 — School Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt1Line1_SchoolName',
    dataPath: 'school.name',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line2_SchoolCode',
    dataPath: 'school.code',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt1Line3_SchoolAddress',
    dataPath: 'school.address',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line4_DSOName',
    dataPath: 'school.dsoName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line5_DSOPhone',
    dataPath: 'school.dsoPhone',
    type: 'phone',
  },

  // =======================================================================
  // Part 2 — Student Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt2Line1a_FamilyName',
    dataPath: 'student.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line1b_GivenName',
    dataPath: 'student.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line1c_MiddleName',
    dataPath: 'student.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line2_DateOfBirth',
    dataPath: 'student.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line3_CountryOfBirth',
    dataPath: 'student.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line4_CountryOfCitizenship',
    dataPath: 'student.nationality',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line5_SEVISNumber',
    dataPath: 'student.sevisNumber',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt2Line6_PassportNumber',
    dataPath: 'student.passportNumber',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // =======================================================================
  // Part 3 — Program Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt3Line1_ProgramName',
    dataPath: 'program.name',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line2_DegreeLevel',
    dataPath: 'program.degreeLevel',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line3_ProgramStartDate',
    dataPath: 'program.startDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt3Line4_ProgramEndDate',
    dataPath: 'program.endDate',
    type: 'date',
  },

  // =======================================================================
  // Part 4 — Financial Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt4Line1_EstimatedTuition',
    dataPath: 'financial.tuition',
    type: 'currency',
  },
  {
    formFieldName: 'form1.Pt4Line2_LivingExpenses',
    dataPath: 'financial.livingExpenses',
    type: 'currency',
  },
  {
    formFieldName: 'form1.Pt4Line3_PersonalFunds',
    dataPath: 'financial.personalFunds',
    type: 'currency',
  },
  {
    formFieldName: 'form1.Pt4Line4_SchoolFunds',
    dataPath: 'financial.schoolFunds',
    type: 'currency',
  },
];
