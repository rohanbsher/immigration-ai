/**
 * AcroForm field mappings for Form I-765 — Application for Employment
 * Authorization Document (EAD).
 *
 * Field names verified against USCIS XFA PDFs downloaded Feb 2026.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

export const I765_ACRO_FIELDS: AcroFormFieldMap[] = [
  // -----------------------------------------------------------------------
  // Part 1 — Reason for Applying (checkbox-based, mapped to section text)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page3.section_1',
    dataPath: 'eligibilityCategory',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Part 2 — Information About You (Applicant)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page1.Line1a_FamilyName',
    dataPath: 'applicant.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page1.Line1b_GivenName',
    dataPath: 'applicant.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page1.Line1c_MiddleName',
    dataPath: 'applicant.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page1.Line2a_FamilyName',
    dataPath: 'applicant.otherNames',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Line7_AlienNumber',
    dataPath: 'applicant.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Page2.Line12b_SSN',
    dataPath: 'applicant.ssn',
    type: 'ssn',
  },
  {
    formFieldName: 'form1.Page3.Line20a_I94Number',
    dataPath: 'applicant.i94Number',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line19_DOB',
    dataPath: 'applicant.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Page3.Line18c_CountryOfBirth',
    dataPath: 'applicant.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Line17b_CountryOfBirth',
    dataPath: 'applicant.nationality',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Mailing Address
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page2.Line4b_StreetNumberName',
    dataPath: 'mailingAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Pt2Line5_AptSteFlrNumber',
    dataPath: 'mailingAddress.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Pt2Line5_CityOrTown',
    dataPath: 'mailingAddress.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Pt2Line5_State',
    dataPath: 'mailingAddress.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Pt2Line5_ZipCode',
    dataPath: 'mailingAddress.zipCode',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Basis for Filing
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page3.Line28_ReceiptNumber',
    dataPath: 'basis.receiptNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.section_2',
    dataPath: 'categoryDescription',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line18a_Receipt.Line30a_ReceiptNumber',
    dataPath: 'basis.previousEAD',
    type: 'text',
  },
];
