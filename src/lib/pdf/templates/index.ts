/**
 * Form field mappings for PDF generation.
 * Maps form data paths to display labels for each USCIS form type.
 */

import type { FormType } from '@/types';

export interface FormFieldMapping {
  /** Data path in the form data object (dot notation for nested) */
  dataPath: string;
  /** Display label for the field */
  label: string;
  /** Field type for formatting */
  type?: 'text' | 'date' | 'boolean' | 'address' | 'phone' | 'ssn';
  /** Section this field belongs to */
  section?: string;
}

/**
 * Get field mappings for a specific form type.
 */
export function getFieldMappings(formType: FormType): FormFieldMapping[] {
  switch (formType) {
    case 'I-129':
      return I129_FIELDS;
    case 'I-130':
      return I130_FIELDS;
    case 'I-131':
      return I131_FIELDS;
    case 'I-485':
      return I485_FIELDS;
    case 'I-539':
      return I539_FIELDS;
    case 'I-765':
      return I765_FIELDS;
    case 'I-20':
      return I20_FIELDS;
    case 'DS-160':
      return DS160_FIELDS;
    case 'N-400':
      return N400_FIELDS;
    case 'G-1145':
      return G1145_FIELDS;
    default:
      return GENERIC_FIELDS;
  }
}

/**
 * I-130: Petition for Alien Relative
 */
const I130_FIELDS: FormFieldMapping[] = [
  // Part 1: Petitioner Information
  { dataPath: 'petitioner.lastName', label: 'Petitioner Last Name', section: 'Petitioner' },
  { dataPath: 'petitioner.firstName', label: 'Petitioner First Name', section: 'Petitioner' },
  { dataPath: 'petitioner.middleName', label: 'Petitioner Middle Name', section: 'Petitioner' },
  { dataPath: 'petitioner.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Petitioner' },
  { dataPath: 'petitioner.countryOfBirth', label: 'Country of Birth', section: 'Petitioner' },
  { dataPath: 'petitioner.alienNumber', label: 'Alien Registration Number', section: 'Petitioner' },
  { dataPath: 'petitioner.ssn', label: 'Social Security Number', type: 'ssn', section: 'Petitioner' },
  { dataPath: 'petitioner.address.street', label: 'Street Address', section: 'Petitioner Address' },
  { dataPath: 'petitioner.address.city', label: 'City', section: 'Petitioner Address' },
  { dataPath: 'petitioner.address.state', label: 'State', section: 'Petitioner Address' },
  { dataPath: 'petitioner.address.zipCode', label: 'ZIP Code', section: 'Petitioner Address' },
  { dataPath: 'petitioner.phone', label: 'Phone Number', type: 'phone', section: 'Petitioner' },
  { dataPath: 'petitioner.email', label: 'Email Address', section: 'Petitioner' },

  // Part 2: Beneficiary Information
  { dataPath: 'beneficiary.lastName', label: 'Beneficiary Last Name', section: 'Beneficiary' },
  { dataPath: 'beneficiary.firstName', label: 'Beneficiary First Name', section: 'Beneficiary' },
  { dataPath: 'beneficiary.middleName', label: 'Beneficiary Middle Name', section: 'Beneficiary' },
  { dataPath: 'beneficiary.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Beneficiary' },
  { dataPath: 'beneficiary.countryOfBirth', label: 'Country of Birth', section: 'Beneficiary' },
  { dataPath: 'beneficiary.nationality', label: 'Country of Citizenship', section: 'Beneficiary' },
  { dataPath: 'beneficiary.alienNumber', label: 'Alien Registration Number', section: 'Beneficiary' },
  { dataPath: 'beneficiary.address.street', label: 'Street Address', section: 'Beneficiary Address' },
  { dataPath: 'beneficiary.address.city', label: 'City', section: 'Beneficiary Address' },
  { dataPath: 'beneficiary.address.state', label: 'State/Province', section: 'Beneficiary Address' },
  { dataPath: 'beneficiary.address.country', label: 'Country', section: 'Beneficiary Address' },

  // Relationship
  { dataPath: 'relationship', label: 'Relationship to Petitioner', section: 'Relationship' },
  { dataPath: 'marriageDate', label: 'Date of Marriage', type: 'date', section: 'Relationship' },
  { dataPath: 'marriagePlace', label: 'Place of Marriage', section: 'Relationship' },
];

/**
 * I-485: Application to Register Permanent Residence
 */
const I485_FIELDS: FormFieldMapping[] = [
  // Part 1: Applicant Information
  { dataPath: 'applicant.lastName', label: 'Last Name', section: 'Applicant' },
  { dataPath: 'applicant.firstName', label: 'First Name', section: 'Applicant' },
  { dataPath: 'applicant.middleName', label: 'Middle Name', section: 'Applicant' },
  { dataPath: 'applicant.otherNames', label: 'Other Names Used', section: 'Applicant' },
  { dataPath: 'applicant.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Applicant' },
  { dataPath: 'applicant.countryOfBirth', label: 'Country of Birth', section: 'Applicant' },
  { dataPath: 'applicant.nationality', label: 'Country of Citizenship', section: 'Applicant' },
  { dataPath: 'applicant.alienNumber', label: 'Alien Registration Number', section: 'Applicant' },
  { dataPath: 'applicant.ssn', label: 'Social Security Number', type: 'ssn', section: 'Applicant' },
  { dataPath: 'applicant.uscisAccountNumber', label: 'USCIS Online Account Number', section: 'Applicant' },

  // Address
  { dataPath: 'applicant.address.street', label: 'Street Address', section: 'Address' },
  { dataPath: 'applicant.address.apt', label: 'Apartment/Suite', section: 'Address' },
  { dataPath: 'applicant.address.city', label: 'City', section: 'Address' },
  { dataPath: 'applicant.address.state', label: 'State', section: 'Address' },
  { dataPath: 'applicant.address.zipCode', label: 'ZIP Code', section: 'Address' },

  // Contact
  { dataPath: 'applicant.phone', label: 'Phone Number', type: 'phone', section: 'Contact' },
  { dataPath: 'applicant.email', label: 'Email Address', section: 'Contact' },

  // Immigration Information
  { dataPath: 'lastEntry.date', label: 'Date of Last Entry', type: 'date', section: 'Immigration' },
  { dataPath: 'lastEntry.port', label: 'Port of Entry', section: 'Immigration' },
  { dataPath: 'lastEntry.status', label: 'Status at Entry', section: 'Immigration' },
  { dataPath: 'currentStatus', label: 'Current Immigration Status', section: 'Immigration' },
  { dataPath: 'i94Number', label: 'I-94 Number', section: 'Immigration' },
  { dataPath: 'passportNumber', label: 'Passport Number', section: 'Immigration' },
  { dataPath: 'passportExpiration', label: 'Passport Expiration', type: 'date', section: 'Immigration' },

  // Employment
  { dataPath: 'employment.employer', label: 'Current Employer', section: 'Employment' },
  { dataPath: 'employment.occupation', label: 'Occupation', section: 'Employment' },
];

/**
 * I-765: Application for Employment Authorization
 */
const I765_FIELDS: FormFieldMapping[] = [
  // Applicant Information
  { dataPath: 'applicant.lastName', label: 'Last Name', section: 'Applicant' },
  { dataPath: 'applicant.firstName', label: 'First Name', section: 'Applicant' },
  { dataPath: 'applicant.middleName', label: 'Middle Name', section: 'Applicant' },
  { dataPath: 'applicant.otherNames', label: 'Other Names Used', section: 'Applicant' },
  { dataPath: 'applicant.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Applicant' },
  { dataPath: 'applicant.countryOfBirth', label: 'Country of Birth', section: 'Applicant' },
  { dataPath: 'applicant.nationality', label: 'Country of Citizenship', section: 'Applicant' },
  { dataPath: 'applicant.alienNumber', label: 'Alien Registration Number', section: 'Applicant' },
  { dataPath: 'applicant.ssn', label: 'Social Security Number', type: 'ssn', section: 'Applicant' },
  { dataPath: 'applicant.i94Number', label: 'I-94 Number', section: 'Applicant' },

  // Address
  { dataPath: 'mailingAddress.street', label: 'Mailing Street Address', section: 'Mailing Address' },
  { dataPath: 'mailingAddress.apt', label: 'Apartment/Suite', section: 'Mailing Address' },
  { dataPath: 'mailingAddress.city', label: 'City', section: 'Mailing Address' },
  { dataPath: 'mailingAddress.state', label: 'State', section: 'Mailing Address' },
  { dataPath: 'mailingAddress.zipCode', label: 'ZIP Code', section: 'Mailing Address' },

  // EAD Category
  { dataPath: 'eligibilityCategory', label: 'Eligibility Category', section: 'Eligibility' },
  { dataPath: 'categoryDescription', label: 'Category Description', section: 'Eligibility' },

  // Basis Information
  { dataPath: 'basis.receiptNumber', label: 'Receipt Number (if any)', section: 'Basis' },
  { dataPath: 'basis.previousEAD', label: 'Previous EAD Information', section: 'Basis' },
];

/**
 * I-131: Application for Travel Document
 */
const I131_FIELDS: FormFieldMapping[] = [
  // Applicant Information
  { dataPath: 'applicant.lastName', label: 'Last Name', section: 'Applicant' },
  { dataPath: 'applicant.firstName', label: 'First Name', section: 'Applicant' },
  { dataPath: 'applicant.middleName', label: 'Middle Name', section: 'Applicant' },
  { dataPath: 'applicant.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Applicant' },
  { dataPath: 'applicant.countryOfBirth', label: 'Country of Birth', section: 'Applicant' },
  { dataPath: 'applicant.nationality', label: 'Country of Citizenship', section: 'Applicant' },
  { dataPath: 'applicant.alienNumber', label: 'Alien Registration Number', section: 'Applicant' },
  { dataPath: 'applicant.classOfAdmission', label: 'Class of Admission', section: 'Applicant' },

  // Address
  { dataPath: 'address.street', label: 'Street Address', section: 'Address' },
  { dataPath: 'address.city', label: 'City', section: 'Address' },
  { dataPath: 'address.state', label: 'State', section: 'Address' },
  { dataPath: 'address.zipCode', label: 'ZIP Code', section: 'Address' },

  // Travel Information
  { dataPath: 'travelDocument.type', label: 'Type of Document Requested', section: 'Travel' },
  { dataPath: 'travelDocument.purpose', label: 'Purpose of Trip', section: 'Travel' },
  { dataPath: 'travelDocument.countries', label: 'Countries to Visit', section: 'Travel' },
  { dataPath: 'travelDocument.departureDate', label: 'Expected Departure', type: 'date', section: 'Travel' },
  { dataPath: 'travelDocument.returnDate', label: 'Expected Return', type: 'date', section: 'Travel' },
];

/**
 * N-400: Application for Naturalization
 */
const N400_FIELDS: FormFieldMapping[] = [
  // Part 1: Eligibility
  { dataPath: 'eligibility.basis', label: 'Basis for Eligibility', section: 'Eligibility' },

  // Part 2: Applicant Information
  { dataPath: 'applicant.lastName', label: 'Current Legal Name - Last', section: 'Applicant' },
  { dataPath: 'applicant.firstName', label: 'Current Legal Name - First', section: 'Applicant' },
  { dataPath: 'applicant.middleName', label: 'Current Legal Name - Middle', section: 'Applicant' },
  { dataPath: 'applicant.otherNames', label: 'Other Names Used', section: 'Applicant' },
  { dataPath: 'applicant.nameChange', label: 'Name After Naturalization', section: 'Applicant' },
  { dataPath: 'applicant.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Applicant' },
  { dataPath: 'applicant.countryOfBirth', label: 'Country of Birth', section: 'Applicant' },
  { dataPath: 'applicant.nationality', label: 'Country of Citizenship', section: 'Applicant' },
  { dataPath: 'applicant.alienNumber', label: 'Alien Registration Number', section: 'Applicant' },
  { dataPath: 'applicant.ssn', label: 'Social Security Number', type: 'ssn', section: 'Applicant' },

  // Contact & Address
  { dataPath: 'address.street', label: 'Street Address', section: 'Address' },
  { dataPath: 'address.apt', label: 'Apartment/Suite', section: 'Address' },
  { dataPath: 'address.city', label: 'City', section: 'Address' },
  { dataPath: 'address.state', label: 'State', section: 'Address' },
  { dataPath: 'address.zipCode', label: 'ZIP Code', section: 'Address' },
  { dataPath: 'phone', label: 'Phone Number', type: 'phone', section: 'Contact' },
  { dataPath: 'email', label: 'Email Address', section: 'Contact' },

  // Immigration History
  { dataPath: 'immigration.greenCardDate', label: 'Date Became Permanent Resident', type: 'date', section: 'Immigration' },
  { dataPath: 'immigration.greenCardNumber', label: 'Green Card Number', section: 'Immigration' },
  { dataPath: 'immigration.continuousResidenceDate', label: 'Continuous Residence Since', type: 'date', section: 'Immigration' },

  // Marital Status
  { dataPath: 'maritalStatus', label: 'Current Marital Status', section: 'Marital' },
  { dataPath: 'spouse.name', label: 'Spouse Name', section: 'Marital' },
  { dataPath: 'spouse.dateOfBirth', label: 'Spouse Date of Birth', type: 'date', section: 'Marital' },
  { dataPath: 'spouse.citizenship', label: 'Spouse Citizenship', section: 'Marital' },

  // Employment
  { dataPath: 'employment.current.employer', label: 'Current Employer', section: 'Employment' },
  { dataPath: 'employment.current.occupation', label: 'Occupation', section: 'Employment' },
];

/**
 * I-129: Petition for a Nonimmigrant Worker
 */
const I129_FIELDS: FormFieldMapping[] = [
  // Petitioner (Employer) Information
  { dataPath: 'petitioner.companyName', label: 'Company/Organization Name', section: 'Petitioner' },
  { dataPath: 'petitioner.ein', label: 'IRS Tax Number (EIN)', section: 'Petitioner' },
  { dataPath: 'petitioner.address.street', label: 'Street Address', section: 'Petitioner Address' },
  { dataPath: 'petitioner.address.city', label: 'City', section: 'Petitioner Address' },
  { dataPath: 'petitioner.address.state', label: 'State', section: 'Petitioner Address' },
  { dataPath: 'petitioner.address.zipCode', label: 'ZIP Code', section: 'Petitioner Address' },
  { dataPath: 'petitioner.phone', label: 'Phone Number', type: 'phone', section: 'Petitioner' },
  { dataPath: 'petitioner.email', label: 'Email Address', section: 'Petitioner' },
  { dataPath: 'petitioner.numEmployees', label: 'Number of Employees', section: 'Petitioner' },
  { dataPath: 'petitioner.grossAnnualIncome', label: 'Gross Annual Income', section: 'Petitioner' },
  { dataPath: 'petitioner.netAnnualIncome', label: 'Net Annual Income', section: 'Petitioner' },

  // Classification
  { dataPath: 'classification', label: 'Nonimmigrant Classification', section: 'Classification' },
  { dataPath: 'petitionBasis', label: 'Basis for Petition', section: 'Classification' },

  // Beneficiary (Worker) Information
  { dataPath: 'beneficiary.lastName', label: 'Last Name', section: 'Beneficiary' },
  { dataPath: 'beneficiary.firstName', label: 'First Name', section: 'Beneficiary' },
  { dataPath: 'beneficiary.middleName', label: 'Middle Name', section: 'Beneficiary' },
  { dataPath: 'beneficiary.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Beneficiary' },
  { dataPath: 'beneficiary.countryOfBirth', label: 'Country of Birth', section: 'Beneficiary' },
  { dataPath: 'beneficiary.nationality', label: 'Country of Citizenship', section: 'Beneficiary' },
  { dataPath: 'beneficiary.passportNumber', label: 'Passport Number', section: 'Beneficiary' },
  { dataPath: 'beneficiary.passportExpiry', label: 'Passport Expiration', type: 'date', section: 'Beneficiary' },
  { dataPath: 'beneficiary.alienNumber', label: 'Alien Registration Number', section: 'Beneficiary' },

  // Job Details
  { dataPath: 'job.title', label: 'Job Title', section: 'Job Offer' },
  { dataPath: 'job.socCode', label: 'SOC/O*NET Code', section: 'Job Offer' },
  { dataPath: 'job.description', label: 'Job Description', section: 'Job Offer' },
  { dataPath: 'job.offeredWage', label: 'Offered Wage', section: 'Wages' },
  { dataPath: 'job.prevailingWage', label: 'Prevailing Wage', section: 'Wages' },
  { dataPath: 'job.hoursPerWeek', label: 'Hours Per Week', section: 'Wages' },
  { dataPath: 'job.workCity', label: 'Work Location City', section: 'Job Offer' },
  { dataPath: 'job.workState', label: 'Work Location State', section: 'Job Offer' },

  // Dates
  { dataPath: 'requestedStartDate', label: 'Requested Start Date', type: 'date', section: 'Period of Stay' },
  { dataPath: 'requestedEndDate', label: 'Requested End Date', type: 'date', section: 'Period of Stay' },
];

/**
 * I-539: Application to Extend/Change Nonimmigrant Status
 */
const I539_FIELDS: FormFieldMapping[] = [
  // Applicant Information
  { dataPath: 'applicant.lastName', label: 'Last Name', section: 'Applicant' },
  { dataPath: 'applicant.firstName', label: 'First Name', section: 'Applicant' },
  { dataPath: 'applicant.middleName', label: 'Middle Name', section: 'Applicant' },
  { dataPath: 'applicant.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Applicant' },
  { dataPath: 'applicant.countryOfBirth', label: 'Country of Birth', section: 'Applicant' },
  { dataPath: 'applicant.nationality', label: 'Country of Citizenship', section: 'Applicant' },
  { dataPath: 'applicant.alienNumber', label: 'Alien Registration Number', section: 'Applicant' },
  { dataPath: 'applicant.ssn', label: 'Social Security Number', type: 'ssn', section: 'Applicant' },
  { dataPath: 'applicant.passportNumber', label: 'Passport Number', section: 'Applicant' },
  { dataPath: 'applicant.passportExpiry', label: 'Passport Expiration', type: 'date', section: 'Applicant' },

  // Address
  { dataPath: 'mailingAddress.street', label: 'Street Address', section: 'Address' },
  { dataPath: 'mailingAddress.city', label: 'City', section: 'Address' },
  { dataPath: 'mailingAddress.state', label: 'State', section: 'Address' },
  { dataPath: 'mailingAddress.zipCode', label: 'ZIP Code', section: 'Address' },

  // Contact
  { dataPath: 'applicant.phone', label: 'Phone Number', type: 'phone', section: 'Contact' },
  { dataPath: 'applicant.email', label: 'Email Address', section: 'Contact' },

  // Status Information
  { dataPath: 'currentStatus', label: 'Current Nonimmigrant Status', section: 'Status' },
  { dataPath: 'requestedStatus', label: 'Requested Status', section: 'Status' },
  { dataPath: 'statusExpires', label: 'Current Status Expires', type: 'date', section: 'Status' },
  { dataPath: 'requestedStayFrom', label: 'Requested Stay From', type: 'date', section: 'Status' },
  { dataPath: 'requestedStayUntil', label: 'Requested Stay Until', type: 'date', section: 'Status' },
  { dataPath: 'reasonForRequest', label: 'Reason for Request', section: 'Status' },
];

/**
 * I-20: Certificate of Eligibility for Nonimmigrant Student Status
 */
const I20_FIELDS: FormFieldMapping[] = [
  // School Information
  { dataPath: 'school.name', label: 'School Name', section: 'School' },
  { dataPath: 'school.code', label: 'School Code', section: 'School' },
  { dataPath: 'school.address', label: 'School Address', type: 'address', section: 'School' },
  { dataPath: 'school.dsoName', label: 'DSO Name', section: 'School' },
  { dataPath: 'school.dsoPhone', label: 'DSO Phone', type: 'phone', section: 'School' },

  // Student Information
  { dataPath: 'student.lastName', label: 'Last Name', section: 'Student' },
  { dataPath: 'student.firstName', label: 'First Name', section: 'Student' },
  { dataPath: 'student.middleName', label: 'Middle Name', section: 'Student' },
  { dataPath: 'student.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Student' },
  { dataPath: 'student.countryOfBirth', label: 'Country of Birth', section: 'Student' },
  { dataPath: 'student.nationality', label: 'Country of Citizenship', section: 'Student' },
  { dataPath: 'student.sevisNumber', label: 'SEVIS ID Number', section: 'Student' },
  { dataPath: 'student.passportNumber', label: 'Passport Number', section: 'Student' },

  // Program Information
  { dataPath: 'program.name', label: 'Program Name/Major', section: 'Program' },
  { dataPath: 'program.degreeLevel', label: 'Degree Level', section: 'Program' },
  { dataPath: 'program.startDate', label: 'Program Start Date', type: 'date', section: 'Program' },
  { dataPath: 'program.endDate', label: 'Program End Date', type: 'date', section: 'Program' },

  // Financial Information
  { dataPath: 'financial.tuition', label: 'Estimated Tuition/Fees', section: 'Financial' },
  { dataPath: 'financial.livingExpenses', label: 'Estimated Living Expenses', section: 'Financial' },
  { dataPath: 'financial.personalFunds', label: 'Personal Funds', section: 'Financial' },
  { dataPath: 'financial.schoolFunds', label: 'School Funds', section: 'Financial' },
];

/**
 * DS-160: Online Nonimmigrant Visa Application
 */
const DS160_FIELDS: FormFieldMapping[] = [
  // Personal Information
  { dataPath: 'personal.lastName', label: 'Surname', section: 'Personal' },
  { dataPath: 'personal.firstName', label: 'Given Names', section: 'Personal' },
  { dataPath: 'personal.dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Personal' },
  { dataPath: 'personal.birthCity', label: 'City of Birth', section: 'Personal' },
  { dataPath: 'personal.birthCountry', label: 'Country of Birth', section: 'Personal' },
  { dataPath: 'personal.sex', label: 'Sex', section: 'Personal' },
  { dataPath: 'personal.maritalStatus', label: 'Marital Status', section: 'Personal' },
  { dataPath: 'personal.nationality', label: 'Nationality', section: 'Personal' },
  { dataPath: 'personal.nationalIdNumber', label: 'National ID Number', section: 'Personal' },

  // Passport
  { dataPath: 'passport.number', label: 'Passport Number', section: 'Passport' },
  { dataPath: 'passport.issuingCountry', label: 'Issuing Country', section: 'Passport' },
  { dataPath: 'passport.issueDate', label: 'Issue Date', type: 'date', section: 'Passport' },
  { dataPath: 'passport.expiryDate', label: 'Expiration Date', type: 'date', section: 'Passport' },

  // Travel Information
  { dataPath: 'travel.visaType', label: 'Visa Type', section: 'Travel' },
  { dataPath: 'travel.arrivalDate', label: 'Intended Arrival Date', type: 'date', section: 'Travel' },
  { dataPath: 'travel.lengthOfStay', label: 'Length of Stay', section: 'Travel' },
  { dataPath: 'travel.usAddress', label: 'U.S. Address', type: 'address', section: 'Travel' },

  // U.S. Contact
  { dataPath: 'usContact.lastName', label: 'Contact Last Name', section: 'U.S. Contact' },
  { dataPath: 'usContact.firstName', label: 'Contact First Name', section: 'U.S. Contact' },
  { dataPath: 'usContact.phone', label: 'Contact Phone', type: 'phone', section: 'U.S. Contact' },

  // Family
  { dataPath: 'family.fatherName', label: 'Father\'s Name', section: 'Family' },
  { dataPath: 'family.motherName', label: 'Mother\'s Name', section: 'Family' },

  // Work/Education
  { dataPath: 'employment.employer', label: 'Current Employer/School', section: 'Work/Education' },
  { dataPath: 'employment.jobTitle', label: 'Job Title', section: 'Work/Education' },

  // Contact
  { dataPath: 'contact.phone', label: 'Phone Number', type: 'phone', section: 'Contact' },
  { dataPath: 'contact.email', label: 'Email Address', section: 'Contact' },
  { dataPath: 'contact.address', label: 'Home Address', type: 'address', section: 'Contact' },
];

/**
 * G-1145: E-Notification of Application/Petition Acceptance
 */
const G1145_FIELDS: FormFieldMapping[] = [
  { dataPath: 'applicant.lastName', label: 'Last Name', section: 'Applicant' },
  { dataPath: 'applicant.firstName', label: 'First Name', section: 'Applicant' },
  { dataPath: 'applicant.middleName', label: 'Middle Name', section: 'Applicant' },
  { dataPath: 'email', label: 'Email Address', section: 'Contact' },
  { dataPath: 'mobilePhone', label: 'Mobile Phone Number', type: 'phone', section: 'Contact' },
  { dataPath: 'formNumber', label: 'Form Number Being Filed', section: 'Application' },
  { dataPath: 'beneficiaryName', label: 'Beneficiary Name', section: 'Application' },
];

/**
 * Generic fields for unsupported form types.
 */
const GENERIC_FIELDS: FormFieldMapping[] = [
  { dataPath: 'lastName', label: 'Last Name' },
  { dataPath: 'firstName', label: 'First Name' },
  { dataPath: 'middleName', label: 'Middle Name' },
  { dataPath: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
  { dataPath: 'countryOfBirth', label: 'Country of Birth' },
  { dataPath: 'nationality', label: 'Nationality' },
  { dataPath: 'alienNumber', label: 'Alien Registration Number' },
  { dataPath: 'ssn', label: 'Social Security Number', type: 'ssn' },
  { dataPath: 'address', label: 'Address', type: 'address' },
  { dataPath: 'phone', label: 'Phone Number', type: 'phone' },
  { dataPath: 'email', label: 'Email Address' },
];
