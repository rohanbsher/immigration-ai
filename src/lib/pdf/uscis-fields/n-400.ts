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

  // -----------------------------------------------------------------------
  // Part 6 — Address History (up to 5 previous addresses)
  // -----------------------------------------------------------------------
  // Address slot 0 (most recent previous)
  { formFieldName: 'form1[0].#subform[5].P6_Line2a_StreetNumberAndName[0]', dataPath: 'address_history_0_street', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line2b_Apt[0]', dataPath: 'address_history_0_apt', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line2c_CityOrTown[0]', dataPath: 'address_history_0_city', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line2d_State[0]', dataPath: 'address_history_0_state', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line2e_ZipCode[0]', dataPath: 'address_history_0_zip', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line2f_Country[0]', dataPath: 'address_history_0_country', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line2g_DateFrom[0]', dataPath: 'address_history_0_from_date', type: 'date' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line2h_DateTo[0]', dataPath: 'address_history_0_to_date', type: 'date' as const },
  // Address slot 1
  { formFieldName: 'form1[0].#subform[5].P6_Line3a_StreetNumberAndName[0]', dataPath: 'address_history_1_street', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line3b_Apt[0]', dataPath: 'address_history_1_apt', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line3c_CityOrTown[0]', dataPath: 'address_history_1_city', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line3d_State[0]', dataPath: 'address_history_1_state', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line3e_ZipCode[0]', dataPath: 'address_history_1_zip', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line3f_Country[0]', dataPath: 'address_history_1_country', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line3g_DateFrom[0]', dataPath: 'address_history_1_from_date', type: 'date' as const },
  { formFieldName: 'form1[0].#subform[5].P6_Line3h_DateTo[0]', dataPath: 'address_history_1_to_date', type: 'date' as const },

  // -----------------------------------------------------------------------
  // Part 7 — Employment History (up to 5 employers)
  // -----------------------------------------------------------------------
  // Employer slot 0
  { formFieldName: 'form1[0].#subform[6].P7_Line2a_EmployerName[0]', dataPath: 'employment_history_0_employer_name', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line2b_StreetNumberAndName[0]', dataPath: 'employment_history_0_employer_address', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line2c_CityOrTown[0]', dataPath: 'employment_history_0_employer_city', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line2d_State[0]', dataPath: 'employment_history_0_employer_state', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line2e_ZipCode[0]', dataPath: 'employment_history_0_employer_zip', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line2f_Occupation[0]', dataPath: 'employment_history_0_job_title', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line2g_DateFrom[0]', dataPath: 'employment_history_0_from_date', type: 'date' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line2h_DateTo[0]', dataPath: 'employment_history_0_to_date', type: 'date' as const },
  // Employer slot 1
  { formFieldName: 'form1[0].#subform[6].P7_Line3a_EmployerName[0]', dataPath: 'employment_history_1_employer_name', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line3b_StreetNumberAndName[0]', dataPath: 'employment_history_1_employer_address', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line3c_CityOrTown[0]', dataPath: 'employment_history_1_employer_city', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line3d_State[0]', dataPath: 'employment_history_1_employer_state', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line3e_ZipCode[0]', dataPath: 'employment_history_1_employer_zip', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line3f_Occupation[0]', dataPath: 'employment_history_1_job_title', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line3g_DateFrom[0]', dataPath: 'employment_history_1_from_date', type: 'date' as const },
  { formFieldName: 'form1[0].#subform[6].P7_Line3h_DateTo[0]', dataPath: 'employment_history_1_to_date', type: 'date' as const },
];
