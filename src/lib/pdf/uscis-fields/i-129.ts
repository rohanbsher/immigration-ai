/**
 * AcroForm field mappings for Form I-129 — Petition for a Nonimmigrant Worker.
 *
 * Field names follow the `form1.PtXLineY_Description` XFA convention used
 * by official USCIS fillable PDFs. Data paths are consistent with the
 * summary PDF field mappings in `src/lib/pdf/templates/index.ts`.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

/**
 * Helper: returns "1" when the data value matches the expected string,
 * empty string otherwise.  Used for XFA checkbox groups where each
 * option is a separate field (e.g. H-1B / L-1 / O-1).
 */
const checkWhen =
  (expected: string) =>
  (v: unknown): string =>
    String(v ?? '').toLowerCase() === expected.toLowerCase() ? '1' : '';

export const I129_ACRO_FIELDS: AcroFormFieldMap[] = [
  // =======================================================================
  // Part 1 — Information About the Petitioner (Employer)
  // =======================================================================

  // -- Company identifiers ------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line1_CompanyName',
    dataPath: 'petitioner.companyName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line2_TaxNumber',
    dataPath: 'petitioner.ein',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line3_SSN',
    dataPath: 'petitioner.ssn',
    type: 'ssn',
  },

  // -- Petitioner address -------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line4_StreetNumberName',
    dataPath: 'petitioner.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line4_AptSteFlrNumber',
    dataPath: 'petitioner.address.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line4_CityOrTown',
    dataPath: 'petitioner.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line4_State',
    dataPath: 'petitioner.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line4_ZipCode',
    dataPath: 'petitioner.address.zipCode',
    type: 'zip_code',
  },

  // -- Company details ----------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line5_NumEmployees',
    dataPath: 'petitioner.numEmployees',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt1Line6_GrossAnnualIncome',
    dataPath: 'petitioner.grossAnnualIncome',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt1Line7_NetAnnualIncome',
    dataPath: 'petitioner.netAnnualIncome',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt1Line8_NAICSCode',
    dataPath: 'petitioner.naicsCode',
    type: 'text',
  },

  // =======================================================================
  // Part 2 — Requested Nonimmigrant Classification
  // =======================================================================
  {
    formFieldName: 'form1.Pt2Line1_Classification',
    dataPath: 'classification',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line1_H1B',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'H-1B',
    format: checkWhen('H-1B'),
  },
  {
    formFieldName: 'form1.Pt2Line1_H1B1',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'H-1B1',
    format: checkWhen('H-1B1'),
  },
  {
    formFieldName: 'form1.Pt2Line1_L1A',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'L-1A',
    format: checkWhen('L-1A'),
  },
  {
    formFieldName: 'form1.Pt2Line1_L1B',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'L-1B',
    format: checkWhen('L-1B'),
  },
  {
    formFieldName: 'form1.Pt2Line1_O1A',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'O-1A',
    format: checkWhen('O-1A'),
  },
  {
    formFieldName: 'form1.Pt2Line1_O1B',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'O-1B',
    format: checkWhen('O-1B'),
  },
  {
    formFieldName: 'form1.Pt2Line1_TN',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'TN',
    format: checkWhen('TN'),
  },
  {
    formFieldName: 'form1.Pt2Line1_E1',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'E-1',
    format: checkWhen('E-1'),
  },
  {
    formFieldName: 'form1.Pt2Line1_E2',
    dataPath: 'classification',
    type: 'checkbox',
    checkValue: 'E-2',
    format: checkWhen('E-2'),
  },

  // -- Basis for petition -------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line2_PetitionBasis',
    dataPath: 'petitionBasis',
    type: 'text',
  },

  // =======================================================================
  // Part 3 — Beneficiary Information (the Worker)
  // =======================================================================

  // -- Legal name ---------------------------------------------------------
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

  // -- Birth info ---------------------------------------------------------
  {
    formFieldName: 'form1.Pt3Line2_DateOfBirth',
    dataPath: 'beneficiary.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt3Line3_CountryOfBirth',
    dataPath: 'beneficiary.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line4_CountryOfCitizenship',
    dataPath: 'beneficiary.nationality',
    type: 'text',
  },

  // -- Identifiers --------------------------------------------------------
  {
    formFieldName: 'form1.Pt3Line5_AlienNumber',
    dataPath: 'beneficiary.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Pt3Line6_PassportNumber',
    dataPath: 'beneficiary.passportNumber',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt3Line7_PassportExpiry',
    dataPath: 'beneficiary.passportExpiry',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt3Line8_CountryOfIssuance',
    dataPath: 'beneficiary.passportCountry',
    type: 'text',
  },

  // -- Beneficiary address ------------------------------------------------
  {
    formFieldName: 'form1.Pt3Line9_StreetNumberName',
    dataPath: 'beneficiary.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line9_CityOrTown',
    dataPath: 'beneficiary.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line9_State',
    dataPath: 'beneficiary.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line9_ZipCode',
    dataPath: 'beneficiary.address.zipCode',
    type: 'zip_code',
  },
  {
    formFieldName: 'form1.Pt3Line9_Country',
    dataPath: 'beneficiary.address.country',
    type: 'text',
  },

  // =======================================================================
  // Part 4 — Processing Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt4Line1_ClassOfAdmission',
    dataPath: 'beneficiary.currentStatus',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line2_I94Number',
    dataPath: 'beneficiary.i94Number',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line3_DateOfArrival',
    dataPath: 'beneficiary.dateOfArrival',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt4Line4_StatusExpires',
    dataPath: 'beneficiary.statusExpires',
    type: 'date',
  },

  // =======================================================================
  // Part 5 — Basic Information About the Proposed Employment
  // =======================================================================
  {
    formFieldName: 'form1.Pt5Line1_JobTitle',
    dataPath: 'job.title',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line2_SOCCode',
    dataPath: 'job.socCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line3_JobDescription',
    dataPath: 'job.description',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line4_OfferedWage',
    dataPath: 'job.offeredWage',
    type: 'currency',
  },
  {
    formFieldName: 'form1.Pt5Line5_PrevailingWage',
    dataPath: 'job.prevailingWage',
    type: 'currency',
  },
  {
    formFieldName: 'form1.Pt5Line6_HoursPerWeek',
    dataPath: 'job.hoursPerWeek',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // -- Work location ------------------------------------------------------
  {
    formFieldName: 'form1.Pt5Line7_WorkStreet',
    dataPath: 'job.workAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line7_WorkCity',
    dataPath: 'job.workCity',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line7_WorkState',
    dataPath: 'job.workState',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line7_WorkZipCode',
    dataPath: 'job.workZipCode',
    type: 'zip_code',
  },

  // -- Employment dates ---------------------------------------------------
  {
    formFieldName: 'form1.Pt5Line8_StartDate',
    dataPath: 'requestedStartDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt5Line9_EndDate',
    dataPath: 'requestedEndDate',
    type: 'date',
  },

  // =======================================================================
  // Part 7 — Petitioner's Statement, Contact, Signature
  // =======================================================================
  {
    formFieldName: 'form1.Pt7Line1_DaytimePhoneNumber',
    dataPath: 'petitioner.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt7Line2_MobileNumber',
    dataPath: 'petitioner.mobile',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt7Line3_Email',
    dataPath: 'petitioner.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt7Line4_DateOfSignature',
    dataPath: 'signatureDate',
    type: 'date',
  },
];
