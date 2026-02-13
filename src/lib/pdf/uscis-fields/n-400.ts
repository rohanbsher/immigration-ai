/**
 * AcroForm field mappings for Form N-400 — Application for Naturalization.
 *
 * Field names verified against USCIS XFA PDFs downloaded Feb 2026.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

export const N400_ACRO_FIELDS: AcroFormFieldMap[] = [
  // -----------------------------------------------------------------------
  // Part 2 — Information About You (Applicant)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.P2_Line1_FamilyName',
    dataPath: 'applicant.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.P2_Line1_GivenName',
    dataPath: 'applicant.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.P2_Line1_MiddleName',
    dataPath: 'applicant.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line2_FamilyName1',
    dataPath: 'applicant.otherNames',
    type: 'text',
  },
  {
    formFieldName: 'form1.Part2Line3_FamilyName',
    dataPath: 'applicant.nameChange',
    type: 'text',
  },
  {
    formFieldName: 'form1.P2_Line8_DateOfBirth',
    dataPath: 'applicant.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.P2_Line10_CountryOfBirth',
    dataPath: 'applicant.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.P2_Line11_CountryOfNationality',
    dataPath: 'applicant.nationality',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line1_AlienNumber',
    dataPath: 'applicant.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Line12b_SSN',
    dataPath: 'applicant.ssn',
    type: 'ssn',
  },

  // -----------------------------------------------------------------------
  // Contact & Address
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.P4_Line1_StreetName',
    dataPath: 'address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4_Line1_City',
    dataPath: 'address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4_Line1_State',
    dataPath: 'address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4_Line1_ZipCode',
    dataPath: 'address.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.P12_Line3_Telephone',
    dataPath: 'phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.P12_Line5_Email',
    dataPath: 'email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // -----------------------------------------------------------------------
  // Immigration History
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.P2_Line9_DateBecamePermanentResident',
    dataPath: 'immigration.greenCardDate',
    type: 'date',
  },

  // -----------------------------------------------------------------------
  // Marital Status
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.P10_Line4a_FamilyName',
    dataPath: 'spouse.name',
    type: 'text',
  },
  {
    formFieldName: 'form1.P10_Line4d_DateofBirth',
    dataPath: 'spouse.dateOfBirth',
    type: 'date',
  },

  // -----------------------------------------------------------------------
  // Employment
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.P7_EmployerName1',
    dataPath: 'employment.current.employer',
    type: 'text',
  },
  {
    formFieldName: 'form1.P7_OccupationFieldStudy1',
    dataPath: 'employment.current.occupation',
    type: 'text',
  },
];
