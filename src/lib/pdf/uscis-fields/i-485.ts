/**
 * AcroForm field mappings for Form I-485 — Application to Register
 * Permanent Residence or Adjust Status.
 *
 * Field names verified against USCIS XFA PDFs downloaded Feb 2026.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

export const I485_ACRO_FIELDS: AcroFormFieldMap[] = [
  // -----------------------------------------------------------------------
  // Part 1 — Information About You (Applicant)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line1_FamilyName',
    dataPath: 'applicant.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line1_GivenName',
    dataPath: 'applicant.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line1_MiddleName',
    dataPath: 'applicant.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line2_FamilyName',
    dataPath: 'applicant.otherNames',
    type: 'text',
  },
  {
    formFieldName: 'form1.AlienNumber',
    dataPath: 'applicant.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Pt1Line9_USCISAccountNumber',
    dataPath: 'applicant.uscisAccountNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line19_SSN',
    dataPath: 'applicant.ssn',
    type: 'ssn',
  },
  {
    formFieldName: 'form1.Pt1Line3_DOB',
    dataPath: 'applicant.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt1Line7_CountryOfBirth',
    dataPath: 'applicant.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_CountryofCitizenshipNationality',
    dataPath: 'applicant.nationality',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Address
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line18_StreetNumberName',
    dataPath: 'applicant.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18US_AptSteFlrNumber',
    dataPath: 'applicant.address.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_CityOrTown',
    dataPath: 'applicant.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_State',
    dataPath: 'applicant.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_ZipCode',
    dataPath: 'applicant.address.zipCode',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Contact
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt3Line3_DaytimePhoneNumber1',
    dataPath: 'applicant.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt3Line5_Email',
    dataPath: 'applicant.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // -----------------------------------------------------------------------
  // Immigration Information
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line10_DateofArrival',
    dataPath: 'lastEntry.date',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt1Line10_CityTown',
    dataPath: 'lastEntry.port',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line12_Status',
    dataPath: 'lastEntry.status',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line14_Status',
    dataPath: 'currentStatus',
    type: 'text',
  },
  {
    formFieldName: 'form1.P1Line12_I94',
    dataPath: 'i94Number',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line10_PassportNum',
    dataPath: 'passportNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line10_ExpDate',
    dataPath: 'passportExpiration',
    type: 'date',
  },

  // -----------------------------------------------------------------------
  // Employment
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt4Line7_EmployerName',
    dataPath: 'employment.employer',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line8_Occupation',
    dataPath: 'employment.occupation',
    type: 'text',
  },
];
