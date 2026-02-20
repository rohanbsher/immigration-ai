/**
 * AcroForm field mappings for Form I-539 — Application to Extend/Change
 * Nonimmigrant Status.
 *
 * Field names follow the `form1.PtXLineY_Description` XFA convention used
 * by official USCIS fillable PDFs. Data paths are consistent with the
 * summary PDF field mappings in `src/lib/pdf/templates/index.ts`.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

/**
 * Helper: returns "1" when the data value matches the expected string,
 * empty string otherwise.  Used for XFA checkbox groups where each
 * option is a separate field (e.g. Extend / Change).
 */
const checkWhen =
  (expected: string) =>
  (v: unknown): string =>
    String(v ?? '').toLowerCase() === expected.toLowerCase() ? '1' : '';

export const I539_ACRO_FIELDS: AcroFormFieldMap[] = [
  // =======================================================================
  // Part 1 — Information About You (Applicant)
  // =======================================================================

  // -- Identifiers --------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line1_AlienNumber',
    dataPath: 'applicant.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Pt1Line2_USCISOnlineActNumber',
    dataPath: 'applicant.uscisAccountNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line3_SSN',
    dataPath: 'applicant.ssn',
    type: 'ssn',
  },

  // -- Legal name ---------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line4a_FamilyName',
    dataPath: 'applicant.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line4b_GivenName',
    dataPath: 'applicant.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line4c_MiddleName',
    dataPath: 'applicant.middleName',
    type: 'text',
  },

  // -- Birth info ---------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line5_DateOfBirth',
    dataPath: 'applicant.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt1Line6_CountryOfBirth',
    dataPath: 'applicant.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line7_CountryOfCitizenship',
    dataPath: 'applicant.nationality',
    type: 'text',
  },

  // -- Mailing address ----------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line8_InCareofName',
    dataPath: 'mailingAddress.inCareOf',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_StreetNumberName',
    dataPath: 'mailingAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_AptSteFlrNumber',
    dataPath: 'mailingAddress.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_CityOrTown',
    dataPath: 'mailingAddress.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_State',
    dataPath: 'mailingAddress.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_ZipCode',
    dataPath: 'mailingAddress.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_Province',
    dataPath: 'mailingAddress.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_PostalCode',
    dataPath: 'mailingAddress.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line8_Country',
    dataPath: 'mailingAddress.country',
    type: 'text',
  },

  // -- Physical address (if different) ------------------------------------
  {
    formFieldName: 'form1.Pt1Line9_StreetNumberName',
    dataPath: 'physicalAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line9_CityOrTown',
    dataPath: 'physicalAddress.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line9_State',
    dataPath: 'physicalAddress.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line9_ZipCode',
    dataPath: 'physicalAddress.zipCode',
    type: 'text',
  },

  // =======================================================================
  // Part 2 — Application Type
  // =======================================================================
  {
    formFieldName: 'form1.Pt2Line1_Extend',
    dataPath: 'applicationType',
    type: 'checkbox',
    checkValue: 'extend',
    format: checkWhen('extend'),
  },
  {
    formFieldName: 'form1.Pt2Line1_Change',
    dataPath: 'applicationType',
    type: 'checkbox',
    checkValue: 'change',
    format: checkWhen('change'),
  },
  {
    formFieldName: 'form1.Pt2Line2_CurrentStatus',
    dataPath: 'currentStatus',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line3_RequestedStatus',
    dataPath: 'requestedStatus',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line4_StatusExpires',
    dataPath: 'statusExpires',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line5_RequestedStayFrom',
    dataPath: 'requestedStayFrom',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line6_RequestedStayUntil',
    dataPath: 'requestedStayUntil',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line7_ReasonForRequest',
    dataPath: 'reasonForRequest',
    type: 'text',
  },

  // =======================================================================
  // Part 3 — Processing Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt3Line1_I94Number',
    dataPath: 'applicant.i94Number',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line2_DateOfLastEntry',
    dataPath: 'applicant.dateOfLastEntry',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt3Line3_PlaceOfLastEntry',
    dataPath: 'applicant.placeOfLastEntry',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line4_StatusAtEntry',
    dataPath: 'applicant.statusAtEntry',
    type: 'text',
  },

  // -- Passport / travel document -----------------------------------------
  {
    formFieldName: 'form1.Pt3Line5_PassportNumber',
    dataPath: 'applicant.passportNumber',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt3Line6_CountryOfIssuance',
    dataPath: 'applicant.passportCountry',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line7_PassportExpiry',
    dataPath: 'applicant.passportExpiry',
    type: 'date',
  },

  // =======================================================================
  // Part 5 — Applicant's Statement, Contact, Signature
  // =======================================================================
  {
    formFieldName: 'form1.Pt5Line1_DaytimePhoneNumber',
    dataPath: 'applicant.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt5Line2_MobileNumber',
    dataPath: 'applicant.mobile',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt5Line3_Email',
    dataPath: 'applicant.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt5Line4_DateOfSignature',
    dataPath: 'signatureDate',
    type: 'date',
  },
];
