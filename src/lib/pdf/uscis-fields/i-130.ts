/**
 * AcroForm field mappings for Form I-130 — Petition for Alien Relative.
 *
 * Field names verified against USCIS XFA PDFs downloaded Feb 2026.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

export const I130_ACRO_FIELDS: AcroFormFieldMap[] = [
  // -----------------------------------------------------------------------
  // Part 2 — Information About You (Petitioner)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line4a_FamilyName',
    dataPath: 'petitioner.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line4b_GivenName',
    dataPath: 'petitioner.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line4c_MiddleName',
    dataPath: 'petitioner.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line1_AlienNumber',
    dataPath: 'petitioner.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.USCISOnlineAcctNumber',
    dataPath: 'petitioner.uscisAccountNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_StreetNumberName',
    dataPath: 'petitioner.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_AptSteFlrNumber',
    dataPath: 'petitioner.address.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_CityOrTown',
    dataPath: 'petitioner.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_State',
    dataPath: 'petitioner.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_ZipCode',
    dataPath: 'petitioner.address.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line8_DateofBirth',
    dataPath: 'petitioner.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line7_CountryofBirth',
    dataPath: 'petitioner.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line11_SSN',
    dataPath: 'petitioner.ssn',
    type: 'ssn',
  },
  {
    formFieldName: 'form1.Pt6Line3_DaytimePhoneNumber',
    dataPath: 'petitioner.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt6Line5_Email',
    dataPath: 'petitioner.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // -----------------------------------------------------------------------
  // Part 4 — Information About Your Relative (Beneficiary)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt4Line4a_FamilyName',
    dataPath: 'beneficiary.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line4b_GivenName',
    dataPath: 'beneficiary.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line4c_MiddleName',
    dataPath: 'beneficiary.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line1_AlienNumber',
    dataPath: 'beneficiary.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Pt4Line9_DateOfBirth',
    dataPath: 'beneficiary.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt4Line8_CountryOfBirth',
    dataPath: 'beneficiary.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line12a_StreetNumberName',
    dataPath: 'beneficiary.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line12c_CityOrTown',
    dataPath: 'beneficiary.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line12d_State',
    dataPath: 'beneficiary.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line11_Country',
    dataPath: 'beneficiary.address.country',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Relationship & Marriage
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt4Line7_Relationship',
    dataPath: 'relationship',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line19_DateOfMarriage',
    dataPath: 'marriageDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line19a_CityTown',
    dataPath: 'marriagePlace',
    type: 'text',
  },
];
