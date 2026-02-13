/**
 * AcroForm field mappings for Form I-131 — Application for Travel Document
 * (Advance Parole / Re-entry Permit / Refugee Travel Document).
 *
 * Field names verified against USCIS XFA PDFs downloaded Feb 2026.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

export const I131_ACRO_FIELDS: AcroFormFieldMap[] = [
  // -----------------------------------------------------------------------
  // Part 2 — Information About You (Applicant)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.P4.Part2_Line1_FamilyName',
    dataPath: 'applicant.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4.Part2_Line1_GivenName',
    dataPath: 'applicant.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4.Part2_Line1_MiddleName',
    dataPath: 'applicant.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.P5.Part2_Line5_AlienNumber',
    dataPath: 'applicant.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.P5.Part2_Line9_DateOfBirth',
    dataPath: 'applicant.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.P5.Part2_Line6_CountryOfBirth',
    dataPath: 'applicant.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.P5.Part2_Line7_CountryOfCitizenshiporNationality',
    dataPath: 'applicant.nationality',
    type: 'text',
  },
  {
    formFieldName: 'form1.P5.Part2_Line12_ClassofAdmission',
    dataPath: 'applicant.classOfAdmission',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Mailing Address
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.P5.Part2_Line3_StreetNumberName',
    dataPath: 'address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.P5.Part2_Line3_CityTown',
    dataPath: 'address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.P5.Part2_Line3_State',
    dataPath: 'address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.P5.Part2_Line3_ZipCode',
    dataPath: 'address.zipCode',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Part 1 — Travel Document Information
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.P1.P1_Line4',
    dataPath: 'travelDocument.type',
    type: 'text',
  },
  {
    formFieldName: 'form1.P2.P1_Line6A',
    dataPath: 'travelDocument.purpose',
    type: 'text',
  },
  {
    formFieldName: 'form1.P3.P1_Line6B_1',
    dataPath: 'travelDocument.countries',
    type: 'text',
  },
  {
    formFieldName: 'form1.P3.P1_Line8A_1',
    dataPath: 'travelDocument.departureDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.P3.P1_Line8B',
    dataPath: 'travelDocument.returnDate',
    type: 'date',
  },
];
