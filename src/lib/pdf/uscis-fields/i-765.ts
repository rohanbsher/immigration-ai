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

  // -----------------------------------------------------------------------
  // Part 1 — Application Type Checkbox (initial / renewal / replacement)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Part1_Checkbox',
    dataPath: 'applicationType',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // USCIS Online Account Number
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page1.USCISELISAcctNumber',
    dataPath: 'applicant.uscisAccountNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Line8_ElisAccountNumber',
    dataPath: 'applicant.uscisAccountNumber',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // In-Care-of Name
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page2.Line4a_InCareofName',
    dataPath: 'mailingAddress.inCareOf',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Physical Address (Line 7 fields)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page2.Pt2Line7_StreetNumberName',
    dataPath: 'physicalAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Pt2Line7_AptSteFlrNumber',
    dataPath: 'physicalAddress.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Pt2Line7_CityOrTown',
    dataPath: 'physicalAddress.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Pt2Line7_State',
    dataPath: 'physicalAddress.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page2.Pt2Line7_ZipCode',
    dataPath: 'physicalAddress.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt2Line7_Unit',
    dataPath: 'physicalAddress.unitType',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Mailing Address — Unit Type checkbox
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt2Line5_Unit',
    dataPath: 'mailingAddress.unitType',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Country of Birth (additional field on Page 2)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page2.Line17a_CountryOfBirth',
    dataPath: 'applicant.countryOfBirth',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Passport / Travel Document Info
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page3.Line20b_Passport',
    dataPath: 'applicant.passportNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line20c_TravelDoc',
    dataPath: 'applicant.travelDocNumber',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line20d_CountryOfIssuance',
    dataPath: 'applicant.passportCountry',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line20e_ExpDate',
    dataPath: 'applicant.passportExpiry',
    type: 'date',
  },

  // -----------------------------------------------------------------------
  // Last Entry Information
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page3.Line21_DateOfLastEntry',
    dataPath: 'lastEntry.date',
    type: 'date',
  },
  {
    formFieldName: 'form1.Page3.place_entry',
    dataPath: 'lastEntry.place',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line23_StatusLastEntry',
    dataPath: 'lastEntry.statusAtEntry',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line24_CurrentStatus',
    dataPath: 'lastEntry.currentStatus',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // SEVIS Number (F/J students)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page3.Line26_SEVISnumber',
    dataPath: 'applicant.sevisNumber',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Education / E-Verify (STEM OPT)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page3.Line27a_Degree',
    dataPath: 'stemOpt.degree',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line27b_Everify',
    dataPath: 'stemOpt.employerName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page3.Line27c_EverifyIDNumber',
    dataPath: 'stemOpt.eVerifyId',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Previous EAD — Receipt Number (alternate field on Page 3)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page3.Line30a_ReceiptNumber',
    dataPath: 'basis.previousEADReceiptNumber',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Previous EAD — Yes/No Questions
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.PtLine29_YesNo',
    dataPath: 'basis.hasPreviousEAD',
    type: 'text',
  },
  {
    formFieldName: 'form1.PtLine30b_YesNo',
    dataPath: 'basis.previousEADReplacement',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Eligibility Category — section_3
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page3.section_3',
    dataPath: 'eligibilityCategoryDetail',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Applicant Contact Information (Part 3 — Applicant's Statement)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page4.Pt3Line3_DaytimePhoneNumber1',
    dataPath: 'contact.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Page4.Pt3Line4_MobileNumber1',
    dataPath: 'contact.mobile',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Page4.Pt3Line5_Email',
    dataPath: 'contact.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },

  // -----------------------------------------------------------------------
  // Applicant Statement — Language & Checkbox
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Pt3Line1Checkbox',
    dataPath: 'applicantStatement.readEnglish',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page4.Pt3Line1b_Language',
    dataPath: 'applicantStatement.language',
    type: 'text',
  },
  {
    formFieldName: 'form1.Part3_Checkbox',
    dataPath: 'applicantStatement.type',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Applicant Signature & Date
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page4.Pt3Line2_RepresentativeName',
    dataPath: 'applicantStatement.representativeName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page4.Pt3Line7b_DateofSignature',
    dataPath: 'signature.date',
    type: 'date',
  },

  // -----------------------------------------------------------------------
  // Interpreter Information (Part 4)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page4.Pt4Line1a_InterpreterFamilyName',
    dataPath: 'interpreter.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page4.Pt4Line1b_InterpreterGivenName',
    dataPath: 'interpreter.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page4.Pt4Line2_InterpreterBusinessorOrg',
    dataPath: 'interpreter.businessName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Part4_NameofLanguage',
    dataPath: 'interpreter.language',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt4Line4_InterpreterDaytimeTelephone',
    dataPath: 'interpreter.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Page5.Pt4Line5_MobileNumber',
    dataPath: 'interpreter.mobile',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Page5.Pt4Line6_Email',
    dataPath: 'interpreter.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Pt4Line6_Checkbox',
    dataPath: 'interpreter.certifyCheckbox',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt4Line6b_DateofSignature',
    dataPath: 'interpreter.signatureDate',
    type: 'date',
  },

  // -----------------------------------------------------------------------
  // Preparer Information (Part 5)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page5.Pt5Line1a_PreparerFamilyName',
    dataPath: 'preparer.lastName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line1b_PreparerGivenName',
    dataPath: 'preparer.firstName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line2_BusinessName',
    dataPath: 'preparer.businessName',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line3a_StreetNumberName',
    dataPath: 'preparer.address.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line3b_AptSteFlrNumber',
    dataPath: 'preparer.address.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt5Line3b_Unit',
    dataPath: 'preparer.address.unitType',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line3c_CityOrTown',
    dataPath: 'preparer.address.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line3d_State',
    dataPath: 'preparer.address.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line3e_ZipCode',
    dataPath: 'preparer.address.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line3f_Province',
    dataPath: 'preparer.address.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line3g_PostalCode',
    dataPath: 'preparer.address.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line3h_Country',
    dataPath: 'preparer.address.country',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line4_DaytimePhoneNumber1',
    dataPath: 'preparer.phone',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line5_PreparerFaxNumber',
    dataPath: 'preparer.fax',
    type: 'phone',
  },
  {
    formFieldName: 'form1.Page5.Pt5Line6_Email',
    dataPath: 'preparer.email',
    type: 'text',
    format: (v) => String(v ?? ''),
  },
  {
    formFieldName: 'form1.Part5Line7_Checkbox',
    dataPath: 'preparer.extendCheckbox',
    type: 'text',
  },
  {
    formFieldName: 'form1.Part5Line7b_Checkbox',
    dataPath: 'preparer.notAttorneyCheckbox',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page6.Pt5Line8b_DateofSignature',
    dataPath: 'preparer.signatureDate',
    type: 'date',
  },

  // -----------------------------------------------------------------------
  // Preparer Mailing Address (Part 6, if different)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page5.Pt6Line3a_StreetNumberName',
    dataPath: 'preparer.mailingAddress.street',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt6Line3b_AptSteFlrNumber',
    dataPath: 'preparer.mailingAddress.apt',
    type: 'text',
  },
  {
    formFieldName: 'form1.Pt6Line3b_Unit',
    dataPath: 'preparer.mailingAddress.unitType',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt6Line3c_CityOrTown',
    dataPath: 'preparer.mailingAddress.city',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt6Line3d_State',
    dataPath: 'preparer.mailingAddress.state',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt6Line3e_ZipCode',
    dataPath: 'preparer.mailingAddress.zipCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt6Line3f_Province',
    dataPath: 'preparer.mailingAddress.province',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt6Line3g_PostalCode',
    dataPath: 'preparer.mailingAddress.postalCode',
    type: 'text',
  },
  {
    formFieldName: 'form1.Page5.Pt6Line3h_Country',
    dataPath: 'preparer.mailingAddress.country',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Attorney Bar Number
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page1.attorneyBarNumber',
    dataPath: 'attorney.barNumber',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Additional Info (Page 7)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page7.Pt6Line4a_PageNumber',
    dataPath: 'additionalInfo.pageNumber',
    type: 'text',
  },

  // -----------------------------------------------------------------------
  // Miscellaneous Checkboxes (page-level selections)
  // -----------------------------------------------------------------------
  {
    formFieldName: 'form1.Page1.CheckBox1',
    dataPath: 'page1Checkbox',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line9_Checkbox',
    dataPath: 'requestSSNCheckbox',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line10_Checkbox',
    dataPath: 'consentDisclosureCheckbox',
    type: 'text',
  },
  {
    formFieldName: 'form1.Line19_Checkbox',
    dataPath: 'sexCheckbox',
    type: 'text',
  },
  {
    formFieldName: 'form1.Part2Line5_Checkbox',
    dataPath: 'mailingAddress.sameAsPhysical',
    type: 'text',
  },
];
