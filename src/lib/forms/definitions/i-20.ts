// Form I-20: Certificate of Eligibility for Nonimmigrant Student Status

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const I20_FORM: FormDefinition = {
  formType: 'I-20',
  title: 'Certificate of Eligibility for Nonimmigrant Student Status',
  version: '2024-01',
  uscisFormNumber: 'I-20',
  estimatedTime: '30-60 minutes',
  filingFee: 0,
  instructions: `Form I-20 is issued by a SEVP-certified school to prospective F-1 or M-1 students after acceptance to a full-time study program. The school generates this form, and the student uses it to apply for a visa and enter the United States. There is no filing fee as the school issues this document.`,
  sections: [
    {
      id: 'school_info',
      title: 'Part 1. School Information',
      description: 'Information about the SEVP-certified school issuing this form.',
      fields: [
        requiredText('school_name', 'School Name', {
          width: 'full',
        }),
        requiredText('school_code', 'School Code (SEVP School Code)', {
          helpText: 'The SEVP-assigned school code',
          width: 'half',
        }),
        requiredText('school_address', 'School Address', {
          type: 'address',
          width: 'full',
        }),
        requiredText('school_city', 'City', { width: 'third' }),
        requiredText('school_state', 'State', { type: 'state', width: 'third' }),
        requiredText('school_zip', 'ZIP Code', { width: 'third' }),
        requiredText('dso_name', 'Designated School Official (DSO) Name', { width: 'half' }),
        requiredText('dso_phone', 'DSO Phone Number', { type: 'phone', width: 'half' }),
        optionalText('dso_email', 'DSO Email Address', { type: 'email', width: 'half' }),
      ],
    },
    {
      id: 'student_info',
      title: 'Part 2. Student Information',
      description: 'Personal information of the student.',
      fields: [
        requiredText('student_last_name', 'Family Name (Last Name)', {
          aiFieldKey: 'surname',
          width: 'half',
        }),
        requiredText('student_first_name', 'Given Name (First Name)', {
          aiFieldKey: 'given_name',
          width: 'half',
        }),
        optionalText('student_middle_name', 'Middle Name', { width: 'half' }),
        dateField('student_dob', 'Date of Birth', true, {
          aiFieldKey: 'date_of_birth',
          width: 'half',
        }),
        requiredText('student_birth_country', 'Country of Birth', {
          type: 'country',
          width: 'half',
          aiFieldKey: 'country_of_birth',
        }),
        requiredText('student_nationality', 'Country of Citizenship', {
          type: 'country',
          width: 'half',
          aiFieldKey: 'nationality',
        }),
        optionalText('student_sevis_number', 'SEVIS ID Number', {
          helpText: 'N followed by 10 digits (e.g., N0012345678)',
          width: 'half',
        }),
        optionalText('student_passport_number', 'Passport Number', {
          width: 'half',
          aiFieldKey: 'passport_number',
        }),
        optionalText('student_email', 'Email Address', { type: 'email', width: 'half' }),
        optionalText('student_phone', 'Phone Number', { type: 'phone', width: 'half' }),
      ],
    },
    {
      id: 'student_address',
      title: 'Part 2 (continued). Student Address',
      description: 'The student\'s address in their home country or current U.S. address.',
      fields: [
        requiredText('student_address_street', 'Street Address', { type: 'address' }),
        requiredText('student_address_city', 'City', { width: 'third' }),
        optionalText('student_address_state', 'State/Province', { width: 'third' }),
        requiredText('student_address_country', 'Country', { type: 'country', width: 'third' }),
        optionalText('student_address_postal', 'Postal Code', { width: 'third' }),
      ],
    },
    {
      id: 'admission_info',
      title: 'Part 3. Admission Category',
      fields: [
        selectField(
          'admission_category',
          'Nonimmigrant Category',
          [
            { value: 'f1', label: 'F-1: Academic Student' },
            { value: 'm1', label: 'M-1: Vocational Student' },
          ],
          true,
          { width: 'half' }
        ),
        selectField(
          'student_level',
          'Level of Education',
          [
            { value: 'secondary', label: 'Secondary (High School)' },
            { value: 'associate', label: 'Associate Degree' },
            { value: 'bachelor', label: 'Bachelor\'s Degree' },
            { value: 'master', label: 'Master\'s Degree' },
            { value: 'doctorate', label: 'Doctorate' },
            { value: 'language_training', label: 'Language Training' },
            { value: 'flight_training', label: 'Flight Training' },
            { value: 'vocational', label: 'Vocational/Non-Academic' },
            { value: 'other', label: 'Other' },
          ],
          true,
          { width: 'half' }
        ),
      ],
    },
    {
      id: 'program_info',
      title: 'Part 4. Program Information',
      description: 'Details about the academic or vocational program.',
      fields: [
        requiredText('program_name', 'Program Name/Major', {
          width: 'full',
        }),
        requiredText('education_level', 'Degree or Certificate Being Sought', {
          width: 'half',
        }),
        dateField('program_start_date', 'Program Start Date', true, { width: 'half' }),
        dateField('program_end_date', 'Program End Date', true, { width: 'half' }),
        optionalText('english_proficiency_required', 'English Proficiency Required?', {
          helpText: 'Whether the student has met English proficiency requirements',
          width: 'half',
        }),
      ],
    },
    {
      id: 'financial_info',
      title: 'Part 5. Financial Information',
      description: 'Financial support details for the student.',
      fields: [
        requiredText('estimated_tuition', 'Estimated Tuition and Fees (per year)', {
          helpText: 'Annual cost of tuition and fees in USD',
          width: 'half',
        }),
        requiredText('estimated_living', 'Estimated Living Expenses (per year)', {
          helpText: 'Annual cost of room, board, and personal expenses in USD',
          width: 'half',
        }),
        optionalText('estimated_other', 'Other Estimated Expenses', {
          helpText: 'Books, insurance, transportation, etc.',
          width: 'half',
        }),
        optionalText('personal_funds', 'Personal Funds Available', {
          helpText: 'Amount the student has available',
          width: 'half',
        }),
        optionalText('family_funds', 'Funds from Family', {
          helpText: 'Amount provided by the student\'s family',
          width: 'half',
        }),
        optionalText('school_funds', 'Funds from School', {
          helpText: 'Scholarships, assistantships, etc.',
          width: 'half',
        }),
        optionalText('other_funds', 'Other Funding Sources', {
          helpText: 'Government sponsorship, other organizations, etc.',
          width: 'half',
        }),
        yesNoField(
          'employment_authorized',
          'Has the student been granted on-campus employment authorization?',
          false
        ),
      ],
    },
    {
      id: 'dso_certification',
      title: 'Part 6. School Certification',
      description: 'Certification by the Designated School Official.',
      fields: [
        requiredText('certifying_official_name', 'Name of DSO', { width: 'half' }),
        requiredText('certifying_official_title', 'Title', { width: 'half' }),
        dateField('certification_date', 'Date of Certification', true),
      ],
    },
  ],
};
