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
    dataPath: 'applicant.otherNames.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line2_GivenName',
    dataPath: 'applicant.otherNames.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line2_MiddleName',
    dataPath: 'applicant.otherNames.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.AlienNumber',
    dataPath: 'applicant.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Pt1Line4_AlienNumber',
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

  // -- Sex checkbox (male/female) --
  {
    formFieldName: 'form1.Pt1Line6_CB_Sex',
    dataPath: 'applicant.sex',
    type: 'checkbox',
    checkValue: 'male',
  },

  // -- Birth city/state (Part 9 biographic details) --
  {
    formFieldName: 'form1.Pt9Line7_CityTownOfBirth',
    dataPath: 'applicant.birthCity',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt9Line7_State',
    dataPath: 'applicant.birthState',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt9Line7_Country',
    dataPath: 'applicant.countryOfBirth',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt9Line86_Nationality',
    dataPath: 'applicant.nationality',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Address — Current Mailing
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
    formFieldName: 'form1.Pt1Line18US_Unit',
    dataPath: 'applicant.address.unitType',
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
  {
    formFieldName: 'form1.Part1_Item18_InCareOfName',
    dataPath: 'applicant.address.inCareOf',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_Date',
    dataPath: 'applicant.address.dateSince',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt1Line18_YN',
    dataPath: 'applicant.address.safeMailing',
    type: 'checkbox',
    checkValue: 'yes',
  },

  // -----------------------------------------------------------------------
  // Address — Prior Address 1
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line18_PriorStreetName',
    dataPath: 'priorAddress1.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorAddress_Number',
    dataPath: 'priorAddress1.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorAddress_Unit',
    dataPath: 'priorAddress1.unitType',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorCity',
    dataPath: 'priorAddress1.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorState',
    dataPath: 'priorAddress1.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorZipCode',
    dataPath: 'priorAddress1.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorProvince',
    dataPath: 'priorAddress1.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorPostalCode',
    dataPath: 'priorAddress1.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorCountry',
    dataPath: 'priorAddress1.country',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorDateFrom',
    dataPath: 'priorAddress1.dateFrom',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt1Line18PriorDateTo',
    dataPath: 'priorAddress1.dateTo',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt1Line18_PriorInCareOfName',
    dataPath: 'priorAddress1.inCareOf',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Address — Prior Address 2 (most recent)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line18_RecentStreetName',
    dataPath: 'priorAddress2.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_RecentCity',
    dataPath: 'priorAddress2.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_RecentState',
    dataPath: 'priorAddress2.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line18_RecentZipCode',
    dataPath: 'priorAddress2.zipCode',
    type: 'text',
  },

  // -- Lived outside US in last 5 years --
  {
    formFieldName: 'form1.Pt1Line18_last5yrs_YN',
    dataPath: 'applicant.livedOutsideUS5Years',
    type: 'checkbox',
    checkValue: 'yes',
  },

  // -----------------------------------------------------------------------
  // SSN & SSA Consent
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt1Line19_YN',
    dataPath: 'applicant.hasSSN',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt1Line19_SSA_YN',
    dataPath: 'applicant.wantsSSA',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt1Line19_Consent_YN',
    dataPath: 'applicant.ssaConsent',
    type: 'checkbox',
    checkValue: 'yes',
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
    formFieldName: 'form1.P3_Line4_DaytimeTelePhoneNumber',
    dataPath: 'applicant.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.P3_Line5_MobileTelePhoneNumber',
    dataPath: 'applicant.mobile',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Pt3Line5_Email',
    dataPath: 'applicant.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.P3_Line6_Email',
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
    formFieldName: 'form1.Pt1Line10_State',
    dataPath: 'lastEntry.state',
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
  {
    formFieldName: 'form1.Pt1Line10_Passport',
    dataPath: 'passportCountry',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line10_NonImmDate',
    dataPath: 'lastEntry.nonImmigrantVisaDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.P1Line12_I94',
    dataPath: 'i94Number',
    type: 'text',
  },

  // -- Manner of arrival checkboxes --
  {
    formFieldName: 'form1.Pt1Line11_Admitted',
    dataPath: 'lastEntry.mannerOfArrival',
    type: 'checkbox',
    checkValue: 'admitted',
  },
  {
    formFieldName: 'form1.Pt1Line11_Paroled',
    dataPath: 'lastEntry.mannerOfArrival',
    type: 'checkbox',
    checkValue: 'paroled',
  },
  {
    formFieldName: 'form1.Pt1Line11_Other',
    dataPath: 'lastEntry.mannerOfArrival',
    type: 'checkbox',
    checkValue: 'other',
  },

  // -- Status at last entry & current status --
  {
    formFieldName: 'form1.Pt1Line12_Status',
    dataPath: 'lastEntry.status',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line12_Date',
    dataPath: 'lastEntry.statusDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt1Line14_Status',
    dataPath: 'currentStatus',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt1Line15_Date',
    dataPath: 'currentStatusExpires',
    type: 'date',
  },

  // -- Have you ever been in immigration proceedings? --
  {
    formFieldName: 'form1.Pt1Line16_YN',
    dataPath: 'applicant.priorProceedings',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt1Line17_YN',
    dataPath: 'applicant.priorPetitionFiled',
    type: 'checkbox',
    checkValue: 'yes',
  },

  // -----------------------------------------------------------------------
  // Part 2 — Application Type / Basis for Adjustment
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line1_YN',
    dataPath: 'applicationBasis.hasPetition',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt2Line1g_DV',
    dataPath: 'applicationBasis.diversityVisa',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt2Line1g_OtherEligibility',
    dataPath: 'applicationBasis.otherEligibility',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line2_Receipt',
    dataPath: 'applicationBasis.receiptNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line2_Date',
    dataPath: 'applicationBasis.priorityDate',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt2Line2_FamilyName',
    dataPath: 'applicationBasis.petitioner.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line2_GivenName',
    dataPath: 'applicationBasis.petitioner.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line2_MiddleName',
    dataPath: 'applicationBasis.petitioner.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line2_AlienNumber',
    dataPath: 'applicationBasis.petitioner.alienNumber',
    type: 'alien_number',
  },

  // -----------------------------------------------------------------------
  // Part 3 — Processing Information
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt3Line1_CB',
    dataPath: 'processing.type',
    type: 'checkbox',
    checkValue: 'adjustment',
  },

  // -----------------------------------------------------------------------
  // Part 4 — Employment (current employer)
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
  {
    formFieldName: 'form1.Part4Line7_StreetName',
    dataPath: 'employment.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line7_City',
    dataPath: 'employment.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line7_State',
    dataPath: 'employment.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line7_ZipCode',
    dataPath: 'employment.address.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line7_Country',
    dataPath: 'employment.address.country',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line7_Province',
    dataPath: 'employment.address.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line7_PostalCode',
    dataPath: 'employment.address.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line7_Unit',
    dataPath: 'employment.address.unitType',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line7_Number',
    dataPath: 'employment.address.unitNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line7_DateFrom',
    dataPath: 'employment.dateFrom',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt4Line7_DateTo',
    dataPath: 'employment.dateTo',
    type: 'date',
  },

  // -- Prior employer (Pt4Line8) --
  {
    formFieldName: 'form1.Pt4Line8_EmployerName',
    dataPath: 'priorEmployment.employer',
    type: 'text',
  },
  {
    formFieldName: 'form1.Part4Line8_StreetName',
    dataPath: 'priorEmployment.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line8_City',
    dataPath: 'priorEmployment.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line8_State',
    dataPath: 'priorEmployment.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line8_ZipCode',
    dataPath: 'priorEmployment.address.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line8_Country',
    dataPath: 'priorEmployment.address.country',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line8_Province',
    dataPath: 'priorEmployment.address.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line8_PostalCode',
    dataPath: 'priorEmployment.address.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line8_Unit',
    dataPath: 'priorEmployment.address.unitType',
    type: 'text',
  },
  {
    formFieldName: 'form1.P4Line8_Number',
    dataPath: 'priorEmployment.address.unitNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt4Line8_DateFrom',
    dataPath: 'priorEmployment.dateFrom',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt4Line8_DateTo',
    dataPath: 'priorEmployment.dateTo',
    type: 'date',
  },

  // -----------------------------------------------------------------------
  // Part 5 — Parent Information
  // -----------------------------------------------------------------------
  // Parent 1
  {
    formFieldName: 'form1.Pt5Line1_FamilyName',
    dataPath: 'parent1.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line1_GivenName',
    dataPath: 'parent1.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line1_MiddleName',
    dataPath: 'parent1.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line3_DateofBirth',
    dataPath: 'parent1.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt5Line6_FamilyName',
    dataPath: 'parent1.maidenLastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line6_GivenName',
    dataPath: 'parent1.maidenFirstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line6_MiddleName',
    dataPath: 'parent1.maidenMiddleName',
    type: 'text',
  },

  // Parent 2
  {
    formFieldName: 'form1.Pt5Line2_FamilyName',
    dataPath: 'parent2.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line2_GivenName',
    dataPath: 'parent2.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line2_MiddleName',
    dataPath: 'parent2.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line2_YNNA',
    dataPath: 'parent2.isAlive',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt5Line8_DateofBirth',
    dataPath: 'parent2.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt5Line7_FamilyName',
    dataPath: 'parent2.maidenLastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line7_GivenName',
    dataPath: 'parent2.maidenFirstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line7_MiddleName',
    dataPath: 'parent2.maidenMiddleName',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Part 6 — Marital Status
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt6Line1_MaritalStatus',
    dataPath: 'marital.status',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line1_TotalChildren',
    dataPath: 'marital.totalChildren',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line3_TimesMarried',
    dataPath: 'marital.timesMarried',
    type: 'text',
  },

  // -- Current spouse --
  {
    formFieldName: 'form1.Pt6Line4_FamilyName',
    dataPath: 'spouse.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line4_GivenName',
    dataPath: 'spouse.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line4_MiddleName',
    dataPath: 'spouse.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line5_AlienNumber',
    dataPath: 'spouse.alienNumber',
    type: 'alien_number',
  },
  {
    formFieldName: 'form1.Pt6Line8_StreetName',
    dataPath: 'spouse.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.P6Line8_City',
    dataPath: 'spouse.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.P6Line8_State',
    dataPath: 'spouse.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.P6Line8_ZipCode',
    dataPath: 'spouse.address.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.P6Line8_Country',
    dataPath: 'spouse.address.country',
    type: 'text',
  },
  {
    formFieldName: 'form1.P6Line8_Province',
    dataPath: 'spouse.address.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.P6Line8_PostalCode',
    dataPath: 'spouse.address.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.P6Line8_Unit',
    dataPath: 'spouse.address.unitType',
    type: 'text',
  },
  {
    formFieldName: 'form1.P6Line8_Number',
    dataPath: 'spouse.address.unitNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line11_YN',
    dataPath: 'spouse.isImmigrant',
    type: 'checkbox',
    checkValue: 'yes',
  },

  // -- Prior spouse --
  {
    formFieldName: 'form1.Pt6Line12_FamilyName',
    dataPath: 'priorSpouse.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line12_GivenName',
    dataPath: 'priorSpouse.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line12_MiddleName',
    dataPath: 'priorSpouse.middleName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line15_Country',
    dataPath: 'priorSpouse.country',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line16_DateofBirth',
    dataPath: 'priorSpouse.dateOfBirth',
    type: 'date',
  },
  {
    formFieldName: 'form1.Pt6Line19_MaritalStatus',
    dataPath: 'priorSpouse.howMarriageEnded',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line19_HowMarriageEndedOther',
    dataPath: 'priorSpouse.howMarriageEndedOther',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Part 7 — Biographic Information
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt7Line1_Ethnicity',
    dataPath: 'biographic.ethnicity',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt7Line2_Race',
    dataPath: 'biographic.race',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt7Line3_HeightFeet',
    dataPath: 'biographic.heightFeet',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt7Line3_HeightInches',
    dataPath: 'biographic.heightInches',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt7Line4_Weight1',
    dataPath: 'biographic.weightPounds',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt7Line5_Eyecolor',
    dataPath: 'biographic.eyeColor',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt7Line6_Haircolor',
    dataPath: 'biographic.hairColor',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Part 8 — General Eligibility & Inadmissibility (Yes/No questions)
  // -----------------------------------------------------------------------
  // Criminal grounds
  {
    formFieldName: 'form1.Pt8Line1_YesNo',
    dataPath: 'eligibility.crimeMoralTurpitude',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line2_YesNo',
    dataPath: 'eligibility.drugViolation',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line3_YesNo',
    dataPath: 'eligibility.multipleCrimes',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line4_YesNo',
    dataPath: 'eligibility.drugTrafficker',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line5_YesNo',
    dataPath: 'eligibility.prostitution',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line6_YesNo',
    dataPath: 'eligibility.moneyLaundering',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line7_YesNo',
    dataPath: 'eligibility.humanTrafficking',
    type: 'checkbox',
    checkValue: 'yes',
  },
  // Immigration violation grounds
  {
    formFieldName: 'form1.Pt8Line8_YesNo',
    dataPath: 'eligibility.assistedTrafficking',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line9_YesNo',
    dataPath: 'eligibility.polygamy',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line10_YesNo',
    dataPath: 'eligibility.kidnapping',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line11_YesNo',
    dataPath: 'eligibility.illegalGambling',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line12_YesNo',
    dataPath: 'eligibility.exercisedImmunity',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line13_YesNo',
    dataPath: 'eligibility.incitedTerrorism',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line14_YesNo',
    dataPath: 'eligibility.terroristOrganization',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line15_YesNo',
    dataPath: 'eligibility.terroristActivity',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line16_YesNo',
    dataPath: 'eligibility.memberTerroristOrg',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line17_YesNo',
    dataPath: 'eligibility.endorseTerrorism',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line18_YesNo',
    dataPath: 'eligibility.spouseTerrorist',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line19_YesNo',
    dataPath: 'eligibility.receivedMilitaryTraining',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line20_YesNo',
    dataPath: 'eligibility.intendToEngageTerrorism',
    type: 'checkbox',
    checkValue: 'yes',
  },
  // Public charge / health grounds
  {
    formFieldName: 'form1.Pt8Line21_YesNo',
    dataPath: 'eligibility.publicCharge',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line22_YesNo',
    dataPath: 'eligibility.healthGround',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line23_YesNo',
    dataPath: 'eligibility.communicableDisease',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line24_YesNo',
    dataPath: 'eligibility.physicalMentalDisorder',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line25_YesNo',
    dataPath: 'eligibility.drugAbuser',
    type: 'checkbox',
    checkValue: 'yes',
  },
  // Fraud / misrepresentation
  {
    formFieldName: 'form1.Pt8Line26_YesNo',
    dataPath: 'eligibility.fraudMisrepresentation',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line27_YesNo',
    dataPath: 'eligibility.falseCitizenship',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line28_YesNo',
    dataPath: 'eligibility.stowaway',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line29_YesNo',
    dataPath: 'eligibility.smuggling',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line30_YesNo',
    dataPath: 'eligibility.priorRemoval',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line31_YesNo',
    dataPath: 'eligibility.unlawfulPresence',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line32_YesNo',
    dataPath: 'eligibility.unlawfulPresence1Year',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line33_YesNo',
    dataPath: 'eligibility.reenteredAfterRemoval',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line34_YesNo',
    dataPath: 'eligibility.finalOrderOfRemoval',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line35_YesNo',
    dataPath: 'eligibility.votedUnlawfully',
    type: 'checkbox',
    checkValue: 'yes',
  },
  // National security
  {
    formFieldName: 'form1.Pt8Line36_YesNo',
    dataPath: 'eligibility.espionage',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line37_YesNo',
    dataPath: 'eligibility.overthrowGovernment',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line38_YesNo',
    dataPath: 'eligibility.totalitarianParty',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line39_YesNo',
    dataPath: 'eligibility.naziPersecution',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line40_YesNo',
    dataPath: 'eligibility.genocide',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line41_YesNo',
    dataPath: 'eligibility.torture',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line42_YesNo',
    dataPath: 'eligibility.extrajudicialKillings',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line43_YesNo',
    dataPath: 'eligibility.childSoldier',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line44_YesNo',
    dataPath: 'eligibility.religiousFreedomViolation',
    type: 'checkbox',
    checkValue: 'yes',
  },
  // Selective Service / tax
  {
    formFieldName: 'form1.Pt8Line45_YesNo',
    dataPath: 'eligibility.selectiveService',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line46_YesNo',
    dataPath: 'eligibility.permanentResidentStatus',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line47_YesNo',
    dataPath: 'eligibility.failedToAttendRemoval',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line48_YesNo',
    dataPath: 'eligibility.withheldCustody',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line49_YesNo',
    dataPath: 'eligibility.renouncedCitizenship',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line50_YesNo',
    dataPath: 'eligibility.militaryDeserter',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line51_YesNo',
    dataPath: 'eligibility.foreignMilitary',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line52_YesNo',
    dataPath: 'eligibility.appliedForExemption',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line53_YesNo',
    dataPath: 'eligibility.foreignGovernmentOfficial',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line54_YesNo',
    dataPath: 'eligibility.waiverRequired',
    type: 'checkbox',
    checkValue: 'yes',
  },
  {
    formFieldName: 'form1.Pt8Line55_YesNo',
    dataPath: 'eligibility.taxEvader',
    type: 'checkbox',
    checkValue: 'yes',
  },

  // -----------------------------------------------------------------------
  // Part 3 — Address History (up to 5 previous addresses)
  // -----------------------------------------------------------------------
  // Address slot 0 (most recent previous)
  { formFieldName: 'form1[0].#subform[5].Pt3Line8a_StreetNumberAndName[0]', dataPath: 'address_history_0_street', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line8b_Apt[0]', dataPath: 'address_history_0_apt', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line8c_CityOrTown[0]', dataPath: 'address_history_0_city', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line8d_State[0]', dataPath: 'address_history_0_state', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line8e_ZipCode[0]', dataPath: 'address_history_0_zip', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line8f_Country[0]', dataPath: 'address_history_0_country', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line8g_DateFrom[0]', dataPath: 'address_history_0_from_date', type: 'date' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line8h_DateTo[0]', dataPath: 'address_history_0_to_date', type: 'date' as const },
  // Address slot 1
  { formFieldName: 'form1[0].#subform[5].Pt3Line9a_StreetNumberAndName[0]', dataPath: 'address_history_1_street', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line9b_Apt[0]', dataPath: 'address_history_1_apt', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line9c_CityOrTown[0]', dataPath: 'address_history_1_city', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line9d_State[0]', dataPath: 'address_history_1_state', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line9e_ZipCode[0]', dataPath: 'address_history_1_zip', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line9f_Country[0]', dataPath: 'address_history_1_country', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line9g_DateFrom[0]', dataPath: 'address_history_1_from_date', type: 'date' as const },
  { formFieldName: 'form1[0].#subform[5].Pt3Line9h_DateTo[0]', dataPath: 'address_history_1_to_date', type: 'date' as const },

  // -----------------------------------------------------------------------
  // Part 4 — Employment History (up to 5 employers)
  // -----------------------------------------------------------------------
  // Employer slot 0
  { formFieldName: 'form1[0].#subform[6].Pt4Line1a_EmployerName[0]', dataPath: 'employment_history_0_employer_name', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line1b_StreetNumberAndName[0]', dataPath: 'employment_history_0_employer_address', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line1c_CityOrTown[0]', dataPath: 'employment_history_0_employer_city', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line1d_State[0]', dataPath: 'employment_history_0_employer_state', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line1e_ZipCode[0]', dataPath: 'employment_history_0_employer_zip', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line1f_Occupation[0]', dataPath: 'employment_history_0_job_title', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line1g_DateFrom[0]', dataPath: 'employment_history_0_from_date', type: 'date' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line1h_DateTo[0]', dataPath: 'employment_history_0_to_date', type: 'date' as const },
  // Employer slot 1
  { formFieldName: 'form1[0].#subform[6].Pt4Line2a_EmployerName[0]', dataPath: 'employment_history_1_employer_name', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line2b_StreetNumberAndName[0]', dataPath: 'employment_history_1_employer_address', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line2c_CityOrTown[0]', dataPath: 'employment_history_1_employer_city', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line2d_State[0]', dataPath: 'employment_history_1_employer_state', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line2e_ZipCode[0]', dataPath: 'employment_history_1_employer_zip', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line2f_Occupation[0]', dataPath: 'employment_history_1_job_title', type: 'text' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line2g_DateFrom[0]', dataPath: 'employment_history_1_from_date', type: 'date' as const },
  { formFieldName: 'form1[0].#subform[6].Pt4Line2h_DateTo[0]', dataPath: 'employment_history_1_to_date', type: 'date' as const },
];
