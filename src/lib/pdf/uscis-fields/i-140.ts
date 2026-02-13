/**
 * AcroForm field mappings for Form I-140 — Immigrant Petition for
 * Alien Workers.
 *
 * Field names verified against USCIS XFA PDFs downloaded Feb 2026.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

export const I140_ACRO_FIELDS: AcroFormFieldMap[] = [
  // -----------------------------------------------------------------------
  // Part 1 — Information About the Petitioner (Employer / Self)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Line2_CompanyName',
    dataPath: 'petitioner.companyName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line6b_StreetNumberName',
    dataPath: 'petitioner.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line6c_AptSteFlrNumber',
    dataPath: 'petitioner.address.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line6d_CityOrTown',
    dataPath: 'petitioner.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line6e_State',
    dataPath: 'petitioner.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line6f_ZipCode',
    dataPath: 'petitioner.address.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line3_TaxNumber',
    dataPath: 'petitioner.ein',
    type: 'text',
  },
  {
    formFieldName: 'form1.Part10_Item3_DayPhone',
    dataPath: 'petitioner.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Part10_Item5_Email',
    dataPath: 'petitioner.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // -----------------------------------------------------------------------
  // Part 2 — Petition Type / Classification (radio/checkbox)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.prt2PetitionType',
    dataPath: 'classification',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Part 3 — Information About the Beneficiary (Worker)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt3Line1a_FamilyName',
    dataPath: 'beneficiary.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line1b_GivenName',
    dataPath: 'beneficiary.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line1c_MiddleName',
    dataPath: 'beneficiary.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line11_Alien.Pt3Line8_AlienNumber',
    dataPath: 'beneficiary.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Line5_DateOfBirth',
    dataPath: 'beneficiary.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Line8_Country',
    dataPath: 'beneficiary.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line9_Country',
    dataPath: 'beneficiary.nationality',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line2b_StreetNumberName',
    dataPath: 'beneficiary.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line2d_CityOrTown',
    dataPath: 'beneficiary.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line2e_State',
    dataPath: 'beneficiary.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line2f_ZipCode',
    dataPath: 'beneficiary.address.zipCode',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Part 6 — Job Offer / Proffered Position
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Line1_JobTitle',
    dataPath: 'job.title',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line2_SOCCode1',
    dataPath: 'job.socCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line8_Wages',
    dataPath: 'job.wageOffered',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line3a_Occupation',
    dataPath: 'job.prevailingWage',
    type: 'text',
  },
];
