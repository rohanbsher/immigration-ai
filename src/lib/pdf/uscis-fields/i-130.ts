/**
 * AcroForm field mappings for Form I-130 — Petition for Alien Relative.
 *
 * Field names verified against USCIS XFA PDFs downloaded Feb 2026.
 * Covers 381 XFA field elements across Parts 1-6 of the I-130.
 */

import type { AcroFormFieldMap } from '../acroform-filler';

/**
 * Helper: returns "1" when the data value matches the expected string,
 * empty string otherwise.  Used for XFA checkbox groups where each
 * option is a separate field (e.g. Male / Female).
 */
const checkWhen =
  (expected: string) =>
  (v: unknown): string =>
    String(v ?? '').toLowerCase() === expected.toLowerCase() ? '1' : '';

export const I130_ACRO_FIELDS: AcroFormFieldMap[] = [
  // =======================================================================
  // Part 1 — Relationship (Classification checkboxes)
  // =======================================================================
  {
    formFieldName: 'form1.Pt1Line1_Spouse',
    dataPath: 'relationship',
    type: 'checkbox',
    checkValue: 'spouse',
    format: checkWhen('spouse'),
  },
  {
    formFieldName: 'form1.Pt1Line1_Parent',
    dataPath: 'relationship',
    type: 'checkbox',
    checkValue: 'parent',
    format: checkWhen('parent'),
  },
  {
    formFieldName: 'form1.Pt1Line1_Siblings',
    dataPath: 'relationship',
    type: 'checkbox',
    checkValue: 'sibling',
    format: checkWhen('sibling'),
  },
  {
    formFieldName: 'form1.Pt1Line1_Child',
    dataPath: 'relationship',
    type: 'checkbox',
    checkValue: 'child',
    format: checkWhen('child'),
  },

  // Part 1 Line 2 — child sub-classification
  {
    formFieldName: 'form1.Pt1Line2_InWedlock',
    dataPath: 'childClassification',
    type: 'checkbox',
    checkValue: 'in_wedlock',
    format: checkWhen('in_wedlock'),
  },
  {
    formFieldName: 'form1.Pt1Line2_OutOfWedlock',
    dataPath: 'childClassification',
    type: 'checkbox',
    checkValue: 'out_of_wedlock',
    format: checkWhen('out_of_wedlock'),
  },
  {
    formFieldName: 'form1.Pt1Line2_Stepchild',
    dataPath: 'childClassification',
    type: 'checkbox',
    checkValue: 'stepchild',
    format: checkWhen('stepchild'),
  },
  {
    formFieldName: 'form1.Pt1Line2_AdoptedChild',
    dataPath: 'childClassification',
    type: 'checkbox',
    checkValue: 'adopted',
    format: checkWhen('adopted'),
  },

  // Part 1 Line 3 — beneficiary previously filed?
  {
    formFieldName: 'form1.Pt1Line3_Yes',
    dataPath: 'filed_before',
    type: 'checkbox',
    checkValue: 'yes',
    format: checkWhen('yes'),
  },
  {
    formFieldName: 'form1.Pt1Line3_No',
    dataPath: 'filed_before',
    type: 'checkbox',
    checkValue: 'no',
    format: checkWhen('no'),
  },

  // Part 1 Line 4 — sibling related filing
  {
    formFieldName: 'form1.Pt1Line4_Yes',
    dataPath: 'siblingRelatedFiling',
    type: 'checkbox',
    checkValue: 'yes',
    format: checkWhen('yes'),
  },
  {
    formFieldName: 'form1.Pt1Line4_No',
    dataPath: 'siblingRelatedFiling',
    type: 'checkbox',
    checkValue: 'no',
    format: checkWhen('no'),
  },

  // =======================================================================
  // Part 2 — Information About You (Petitioner)
  // =======================================================================

  // -- Identifiers --------------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line1_AlienNumber',
    dataPath: 'petitioner.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Pt2Line2_USCISOnlineActNumber',
    dataPath: 'petitioner.uscisAccountNumber',
    type: 'text',
  },

  // -- Legal name ---------------------------------------------------------
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

  // -- Other names used ---------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line5a_FamilyName',
    dataPath: 'petitioner.otherNames.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line5b_GivenName',
    dataPath: 'petitioner.otherNames.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line5c_MiddleName',
    dataPath: 'petitioner.otherNames.middleName',
    type: 'text',
  },

  // -- Birth info ---------------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line6_CityTownOfBirth',
    dataPath: 'petitioner.cityOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line7_CountryofBirth',
    dataPath: 'petitioner.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line8_DateofBirth',
    dataPath: 'petitioner.dateOfBirth',
    type: 'date',
  },

  // -- Sex checkboxes -----------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line9_Male',
    dataPath: 'petitioner.sex',
    type: 'checkbox',
    checkValue: 'male',
    format: checkWhen('male'),
  },
  {
    formFieldName: 'form1.Pt2Line9_Female',
    dataPath: 'petitioner.sex',
    type: 'checkbox',
    checkValue: 'female',
    format: checkWhen('female'),
  },

  // -- Mailing address (Line 10) -----------------------------------------
  {
    formFieldName: 'form1.Pt2Line10_InCareofName',
    dataPath: 'petitioner.address.inCareOf',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_StreetNumberName',
    dataPath: 'petitioner.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_Unit',
    dataPath: 'petitioner.address.unitType',
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
    formFieldName: 'form1.Pt2Line10_Province',
    dataPath: 'petitioner.address.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_PostalCode',
    dataPath: 'petitioner.address.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line10_Country',
    dataPath: 'petitioner.address.country',
    type: 'text',
  },

  // -- SSN ----------------------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line11_SSN',
    dataPath: 'petitioner.ssn',
    type: 'ssn',
  },

  // -- Physical address if different (Line 12) ---------------------------
  {
    formFieldName: 'form1.Pt2Line12_StreetNumberName',
    dataPath: 'petitioner.physicalAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line12_CityOrTown',
    dataPath: 'petitioner.physicalAddress.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line12_State',
    dataPath: 'petitioner.physicalAddress.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line12_ZipCode',
    dataPath: 'petitioner.physicalAddress.zipCode',
    type: 'text',
  },

  // -- Address date range (Line 13) --------------------------------------
  {
    formFieldName: 'form1.Pt2Line13a_DateFrom',
    dataPath: 'petitioner.address.dateFrom',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line13b_DateTo',
    dataPath: 'petitioner.address.dateTo',
    type: 'date',
  },

  // -- Prior address (Line 14-15) ----------------------------------------
  {
    formFieldName: 'form1.Pt2Line14_StreetNumberName',
    dataPath: 'petitioner.priorAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line15a_DateFrom',
    dataPath: 'petitioner.priorAddress.dateFrom',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line15b_DateTo',
    dataPath: 'petitioner.priorAddress.dateTo',
    type: 'date',
  },

  // -- Marital info -------------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line16_NumberofMarriages',
    dataPath: 'petitioner.numberOfMarriages',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line17_Single',
    dataPath: 'petitioner.maritalStatus',
    type: 'checkbox',
    checkValue: 'single',
    format: checkWhen('single'),
  },
  {
    formFieldName: 'form1.Pt2Line17_Married',
    dataPath: 'petitioner.maritalStatus',
    type: 'checkbox',
    checkValue: 'married',
    format: checkWhen('married'),
  },
  {
    formFieldName: 'form1.Pt2Line17_Divorced',
    dataPath: 'petitioner.maritalStatus',
    type: 'checkbox',
    checkValue: 'divorced',
    format: checkWhen('divorced'),
  },
  {
    formFieldName: 'form1.Pt2Line17_Widowed',
    dataPath: 'petitioner.maritalStatus',
    type: 'checkbox',
    checkValue: 'widowed',
    format: checkWhen('widowed'),
  },
  {
    formFieldName: 'form1.Pt2Line17_Separated',
    dataPath: 'petitioner.maritalStatus',
    type: 'checkbox',
    checkValue: 'separated',
    format: checkWhen('separated'),
  },
  {
    formFieldName: 'form1.Pt2Line17_Annulled',
    dataPath: 'petitioner.maritalStatus',
    type: 'checkbox',
    checkValue: 'annulled',
    format: checkWhen('annulled'),
  },

  // -- Current marriage ---------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line18_DateOfMarriage',
    dataPath: 'petitioner.currentMarriage.date',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line19a_CityTown',
    dataPath: 'petitioner.currentMarriage.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line19b_State',
    dataPath: 'petitioner.currentMarriage.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line19c_Province',
    dataPath: 'petitioner.currentMarriage.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line19d_Country',
    dataPath: 'petitioner.currentMarriage.country',
    type: 'text',
  },

  // -- Prior spouse 1 (Line 20-21) ----------------------------------------
  {
    formFieldName: 'form1.Pt2Line20b_GivenName',
    dataPath: 'petitioner.priorSpouse1.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line20c_MiddleName',
    dataPath: 'petitioner.priorSpouse1.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line21_DateMarriageEnded',
    dataPath: 'petitioner.priorSpouse1.dateEnded',
    type: 'date',
  },

  // -- Prior spouse 2 (Line 22-23) ----------------------------------------
  {
    formFieldName: 'form1.Pt2Line22a_FamilyName',
    dataPath: 'petitioner.priorSpouse2.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line23_DateMarriageEnded',
    dataPath: 'petitioner.priorSpouse2.dateEnded',
    type: 'date',
  },

  // -- Immigration status -------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line36_USCitizen',
    dataPath: 'petitioner.immigrationStatus',
    type: 'checkbox',
    checkValue: 'citizen',
    format: checkWhen('citizen'),
  },
  {
    formFieldName: 'form1.Pt2Line36_LPR',
    dataPath: 'petitioner.immigrationStatus',
    type: 'checkbox',
    checkValue: 'lpr',
    format: checkWhen('lpr'),
  },

  // -- Current employment (Line 40-43) ------------------------------------
  {
    formFieldName: 'form1.Pt2Line40_EmployerOrCompName',
    dataPath: 'petitioner.employment.employer',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line40a_ClassOfAdmission',
    dataPath: 'petitioner.employment.classOfAdmission',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line40b_DateOfAdmission',
    dataPath: 'petitioner.employment.dateOfAdmission',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line40d_CityOrTown',
    dataPath: 'petitioner.employment.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line40e_State',
    dataPath: 'petitioner.employment.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line41_StreetNumberName',
    dataPath: 'petitioner.employment.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line41_CityOrTown',
    dataPath: 'petitioner.employment.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line41_State',
    dataPath: 'petitioner.employment.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line41_ZipCode',
    dataPath: 'petitioner.employment.address.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line42_Occupation',
    dataPath: 'petitioner.employment.occupation',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line43a_DateFrom',
    dataPath: 'petitioner.employment.dateFrom',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line43b_DateTo',
    dataPath: 'petitioner.employment.dateTo',
    type: 'date',
  },

  // -- Prior employment (Line 44-47) --------------------------------------
  {
    formFieldName: 'form1.Pt2Line44_EmployerOrOrgName',
    dataPath: 'petitioner.priorEmployment.employer',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line47a_DateFrom',
    dataPath: 'petitioner.priorEmployment.dateFrom',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line47b_DateTo',
    dataPath: 'petitioner.priorEmployment.dateTo',
    type: 'date',
  },

  // =======================================================================
  // Part 3 — Biographic Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt3Line1_Ethnicity',
    dataPath: 'biographic.ethnicity',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line2_Race_White',
    dataPath: 'biographic.race',
    type: 'checkbox',
    checkValue: 'white',
    format: checkWhen('white'),
  },
  {
    formFieldName: 'form1.Pt3Line2_Race_Asian',
    dataPath: 'biographic.race',
    type: 'checkbox',
    checkValue: 'asian',
    format: checkWhen('asian'),
  },
  {
    formFieldName: 'form1.Pt3Line2_Race_Black',
    dataPath: 'biographic.race',
    type: 'checkbox',
    checkValue: 'black',
    format: checkWhen('black'),
  },
  {
    formFieldName: 'form1.Pt3Line2_Race_AmericanIndian',
    dataPath: 'biographic.race',
    type: 'checkbox',
    checkValue: 'american_indian',
    format: checkWhen('american_indian'),
  },
  {
    formFieldName: 'form1.Pt3Line2_Race_NativeHawaiian',
    dataPath: 'biographic.race',
    type: 'checkbox',
    checkValue: 'native_hawaiian',
    format: checkWhen('native_hawaiian'),
  },
  {
    formFieldName: 'form1.Pt3Line3_HeightFeet',
    dataPath: 'biographic.heightFeet',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt3Line3_HeightInches',
    dataPath: 'biographic.heightInches',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt3Line4_Pound1',
    dataPath: 'biographic.weightPound1',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt3Line4_Pound2',
    dataPath: 'biographic.weightPound2',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt3Line4_Pound3',
    dataPath: 'biographic.weightPound3',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt3Line5_EyeColor',
    dataPath: 'biographic.eyeColor',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt3Line6_HairColor',
    dataPath: 'biographic.hairColor',
    type: 'text',
  },

  // =======================================================================
  // Part 4 — Information About Your Relative (Beneficiary)
  // =======================================================================

  // -- Identifiers --------------------------------------------------------
  {
    formFieldName: 'form1.Pt4Line1_AlienNumber',
    dataPath: 'beneficiary.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Pt4Line2_USCISOnlineActNumber',
    dataPath: 'beneficiary.uscisAccountNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line3_SSN',
    dataPath: 'beneficiary.ssn',
    type: 'ssn',
  },

  // -- Legal name ---------------------------------------------------------
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

  // -- Other names used (alias 1) ----------------------------------------
  {
    formFieldName: 'form1.Pt4Line5b_GivenName',
    dataPath: 'beneficiary.otherNames.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line5c_MiddleName',
    dataPath: 'beneficiary.otherNames.middleName',
    type: 'text',
  },

  // -- Other names used (alias 2) ----------------------------------------
  {
    formFieldName: 'form1.Pt4Line6a_FamilyName',
    dataPath: 'beneficiary.otherNames2.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line6b_GivenName',
    dataPath: 'beneficiary.otherNames2.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line6c_MiddleName',
    dataPath: 'beneficiary.otherNames2.middleName',
    type: 'text',
  },

  // -- Birth info ---------------------------------------------------------
  {
    formFieldName: 'form1.Pt4Line7_CityTownOfBirth',
    dataPath: 'beneficiary.cityOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line8_CountryOfBirth',
    dataPath: 'beneficiary.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line9_DateOfBirth',
    dataPath: 'beneficiary.dateOfBirth',
    type: 'date',
  },

  // -- Sex checkboxes (Part 4 Line 10) ------------------------------------
  {
    formFieldName: 'form1.Pt4Line10_Yes',
    dataPath: 'beneficiary.sex',
    type: 'checkbox',
    checkValue: 'male',
    format: checkWhen('male'),
  },
  {
    formFieldName: 'form1.Pt4Line10_No',
    dataPath: 'beneficiary.sex',
    type: 'checkbox',
    checkValue: 'female',
    format: checkWhen('female'),
  },

  // -- Overseas address (Line 11) -----------------------------------------
  {
    formFieldName: 'form1.Pt4Line11_StreetNumberName',
    dataPath: 'beneficiary.overseasAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line11_CityOrTown',
    dataPath: 'beneficiary.overseasAddress.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line11_Province',
    dataPath: 'beneficiary.overseasAddress.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line11_PostalCode',
    dataPath: 'beneficiary.overseasAddress.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line11_Country',
    dataPath: 'beneficiary.overseasAddress.country',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line11_ZipCode',
    dataPath: 'beneficiary.overseasAddress.zipCode',
    type: 'text',
  },

  // -- U.S. address (Line 12) --------------------------------------------
  {
    formFieldName: 'form1.Pt4Line12a_StreetNumberName',
    dataPath: 'beneficiary.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line12b_AptSteFlrNumber',
    dataPath: 'beneficiary.address.apt',
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
    formFieldName: 'form1.Pt4Line12e_ZipCode',
    dataPath: 'beneficiary.address.zipCode',
    type: 'text',
  },

  // -- Prior address (Line 13) --------------------------------------------
  {
    formFieldName: 'form1.Pt4Line13_StreetNumberName',
    dataPath: 'beneficiary.priorAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line13_Province',
    dataPath: 'beneficiary.priorAddress.province',
    type: 'text',
  },

  // -- Contact info -------------------------------------------------------
  {
    formFieldName: 'form1.Pt4Line14_DaytimePhoneNumber',
    dataPath: 'beneficiary.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt4Line15_MobilePhoneNumber',
    dataPath: 'beneficiary.mobile',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt4Line16_EmailAddress',
    dataPath: 'beneficiary.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // -- Nationality / Citizenship (Line 16a-c) ----------------------------
  {
    formFieldName: 'form1.Pt4Line16a_FamilyName',
    dataPath: 'beneficiary.nationality.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line16b_GivenName',
    dataPath: 'beneficiary.nationality.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line16c_MiddleName',
    dataPath: 'beneficiary.nationality.middleName',
    type: 'text',
  },

  // -- Marital info -------------------------------------------------------
  {
    formFieldName: 'form1.Pt4Line17_NumberofMarriages',
    dataPath: 'beneficiary.numberOfMarriages',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line18_MaritalStatus',
    dataPath: 'beneficiary.maritalStatus',
    type: 'text',
  },

  // -- Beneficiary spouse info (Line 18a-c) -------------------------------
  {
    formFieldName: 'form1.Pt4Line18a_FamilyName',
    dataPath: 'beneficiary.spouse.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line18b_GivenName',
    dataPath: 'beneficiary.spouse.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line18c_MiddleName',
    dataPath: 'beneficiary.spouse.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line19_DateOfMarriage',
    dataPath: 'beneficiary.spouse.marriageDate',
    type: 'date',
  },

  // -- Immigration proceedings? (Line 20) ---------------------------------
  {
    formFieldName: 'form1.Pt4Line20_Yes',
    dataPath: 'beneficiary.inProceedings',
    type: 'checkbox',
    checkValue: 'yes',
    format: checkWhen('yes'),
  },
  {
    formFieldName: 'form1.Pt4Line20_No',
    dataPath: 'beneficiary.inProceedings',
    type: 'checkbox',
    checkValue: 'no',
    format: checkWhen('no'),
  },
  {
    formFieldName: 'form1.Pt4Line20a_CityTown',
    dataPath: 'beneficiary.proceedings.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line20b_State',
    dataPath: 'beneficiary.proceedings.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line20d_Country',
    dataPath: 'beneficiary.proceedings.country',
    type: 'text',
  },

  // -- Entry information (Line 21) ----------------------------------------
  {
    formFieldName: 'form1.Pt4Line21a_ClassOfAdmission',
    dataPath: 'beneficiary.entry.classOfAdmission',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line21b_ArrivalDeparture',
    dataPath: 'beneficiary.entry.i94Number',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line21c_DateOfArrival',
    dataPath: 'beneficiary.entry.dateOfArrival',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt4Line21d_DateExpired',
    dataPath: 'beneficiary.entry.dateExpired',
    type: 'date',
  },

  // -- Passport / Travel Document -----------------------------------------
  {
    formFieldName: 'form1.Pt4Line22_PassportNumber',
    dataPath: 'beneficiary.passportNumber',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt4Line23_TravelDocNumber',
    dataPath: 'beneficiary.travelDocNumber',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt4Line24_CountryOfIssuance',
    dataPath: 'beneficiary.passportCountry',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line25_ExpDate',
    dataPath: 'beneficiary.passportExpiry',
    type: 'date',
  },

  // -- Beneficiary employment (Line 26-27) --------------------------------
  {
    formFieldName: 'form1.Pt4Line26_NameOfCompany',
    dataPath: 'beneficiary.employment.employer',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line27_DateEmploymentBegan',
    dataPath: 'beneficiary.employment.dateStarted',
    type: 'date',
  },

  // -- Ever in U.S.? (Line 28) -------------------------------------------
  {
    formFieldName: 'form1.Pt4Line28_Yes',
    dataPath: 'beneficiary.everInUS',
    type: 'checkbox',
    checkValue: 'yes',
    format: checkWhen('yes'),
  },
  {
    formFieldName: 'form1.Pt4Line28_No',
    dataPath: 'beneficiary.everInUS',
    type: 'checkbox',
    checkValue: 'no',
    format: checkWhen('no'),
  },

  // -- Children (Child 1: Lines 30-32) ------------------------------------
  {
    formFieldName: 'form1.Pt4Line30a_FamilyName',
    dataPath: 'beneficiary.children.0.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line32_DateOfBirth',
    dataPath: 'beneficiary.children.0.dateOfBirth',
    type: 'date',
  },

  // -- Children (Child 2: Lines 34-37) ------------------------------------
  {
    formFieldName: 'form1.Pt4Line34a_FamilyName',
    dataPath: 'beneficiary.children.1.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line37_CountryOfBirth',
    dataPath: 'beneficiary.children.1.countryOfBirth',
    type: 'text',
  },

  // -- Children (Child 3: Lines 38-41) ------------------------------------
  {
    formFieldName: 'form1.Pt4Line38a_FamilyName',
    dataPath: 'beneficiary.children.2.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line41_CountryOfBirth',
    dataPath: 'beneficiary.children.2.countryOfBirth',
    type: 'text',
  },

  // -- Children (Child 4: Lines 42-45) ------------------------------------
  {
    formFieldName: 'form1.Pt4Line42a_FamilyName',
    dataPath: 'beneficiary.children.3.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line45_CountryOfBirth',
    dataPath: 'beneficiary.children.3.countryOfBirth',
    type: 'text',
  },

  // -- Children (Child 5: Lines 46-49) ------------------------------------
  {
    formFieldName: 'form1.Pt4Line46a_FamilyName',
    dataPath: 'beneficiary.children.4.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line49_CountryOfBirth',
    dataPath: 'beneficiary.children.4.countryOfBirth',
    type: 'text',
  },

  // -- Phone for correspondence (Line 53) ---------------------------------
  {
    formFieldName: 'form1.Pt4Line53_DaytimePhoneNumber',
    dataPath: 'beneficiary.correspondencePhone',
    type: 'phone',
  },

  // -- Proceedings type checkboxes (Line 54) ------------------------------
  {
    formFieldName: 'form1.Pt4Line54_Exclusion',
    dataPath: 'beneficiary.proceedingsType',
    type: 'checkbox',
    checkValue: 'exclusion',
    format: checkWhen('exclusion'),
  },
  {
    formFieldName: 'form1.Pt4Line54_JudicialProceedings',
    dataPath: 'beneficiary.proceedingsType',
    type: 'checkbox',
    checkValue: 'judicial',
    format: checkWhen('judicial'),
  },
  {
    formFieldName: 'form1.Pt4Line54_Removal',
    dataPath: 'beneficiary.proceedingsType',
    type: 'checkbox',
    checkValue: 'removal',
    format: checkWhen('removal'),
  },
  {
    formFieldName: 'form1.Pt4Line54_Rescission',
    dataPath: 'beneficiary.proceedingsType',
    type: 'checkbox',
    checkValue: 'rescission',
    format: checkWhen('rescission'),
  },

  // =======================================================================
  // Part 5 — Previous Petition Information
  // =======================================================================
  {
    formFieldName: 'form1.Pt5Line2a_FamilyName',
    dataPath: 'previousPetition.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line5_Result',
    dataPath: 'previousPetition.result',
    type: 'text',
  },

  // =======================================================================
  // Part 6 — Contact Information, Declaration, Signature
  // =======================================================================
  {
    formFieldName: 'form1.Pt6Line3_DaytimePhoneNumber',
    dataPath: 'petitioner.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt6Line4_MobileNumber',
    dataPath: 'petitioner.mobile',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt6Line5_Email',
    dataPath: 'petitioner.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt6Line6b_DateofSignature',
    dataPath: 'signatureDate',
    type: 'date',
  },

  // =======================================================================
  // Relationship & Marriage (legacy data paths — kept for backward compat)
  // =======================================================================
  {
    formFieldName: 'form1.Pt4Line7_Relationship',
    dataPath: 'relationship',
    type: 'text',
  },
];
