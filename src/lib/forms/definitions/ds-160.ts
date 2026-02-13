// Form DS-160: Online Nonimmigrant Visa Application

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const DS160_FORM: FormDefinition = {
  formType: 'DS-160',
  title: 'Online Nonimmigrant Visa Application',
  version: '2024-06',
  uscisFormNumber: 'DS-160',
  estimatedTime: '2-3 hours',
  filingFee: 185,
  instructions: `Form DS-160 is the Online Nonimmigrant Visa Application form used by the U.S. Department of State. All nonimmigrant visa applicants must complete this form before their visa interview at a U.S. Embassy or Consulate. The form collects biographical, travel, and security-related information.`,
  sections: [
    {
      id: 'personal_info',
      title: 'Part 1. Personal Information',
      description: 'Provide your personal biographical information.',
      fields: [
        requiredText('last_name', 'Surname (Family Name)', {
          aiFieldKey: 'surname',
          width: 'half',
        }),
        requiredText('first_name', 'Given Names (First and Middle)', {
          aiFieldKey: 'given_name',
          width: 'half',
        }),
        optionalText('full_name_native', 'Full Name in Native Alphabet', { width: 'full' }),
        optionalText('other_names_used', 'Other Names Used (maiden, aliases, etc.)'),
        yesNoField(
          'has_telecode_name',
          'Do you have a telecode that represents your name?',
          false
        ),
        dateField('dob', 'Date of Birth', true, {
          aiFieldKey: 'date_of_birth',
          width: 'half',
        }),
        requiredText('birth_city', 'City of Birth', {
          width: 'half',
        }),
        requiredText('birth_state_province', 'State/Province of Birth', { width: 'half' }),
        requiredText('birth_country', 'Country of Birth', {
          type: 'country',
          width: 'half',
          aiFieldKey: 'country_of_birth',
        }),
        selectField(
          'sex',
          'Sex',
          [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ],
          true,
          { width: 'half' }
        ),
        selectField(
          'marital_status',
          'Marital Status',
          [
            { value: 'single', label: 'Single' },
            { value: 'married', label: 'Married' },
            { value: 'common_law', label: 'Common Law Marriage' },
            { value: 'civil_union', label: 'Civil Union/Domestic Partnership' },
            { value: 'divorced', label: 'Divorced' },
            { value: 'widowed', label: 'Widowed' },
            { value: 'separated', label: 'Separated' },
          ],
          true,
          { width: 'half' }
        ),
      ],
    },
    {
      id: 'nationality_info',
      title: 'Part 1 (continued). Nationality',
      fields: [
        requiredText('nationality', 'Country of Citizenship/Nationality', {
          type: 'country',
          aiFieldKey: 'nationality',
          width: 'half',
        }),
        yesNoField(
          'has_other_nationality',
          'Do you hold or have you held any nationality other than the one above?',
          true
        ),
        optionalText('other_nationality', 'Other Country of Citizenship/Nationality', {
          type: 'country',
          conditional: { field: 'has_other_nationality', value: 'yes' },
          width: 'half',
        }),
        yesNoField(
          'is_permanent_resident_other',
          'Are you a permanent resident of a country other than your nationality?',
          true
        ),
        optionalText('permanent_resident_country', 'Country of Permanent Residence', {
          type: 'country',
          conditional: { field: 'is_permanent_resident_other', value: 'yes' },
          width: 'half',
        }),
        optionalText('national_id_number', 'National Identification Number', { width: 'half' }),
        optionalText('us_ssn', 'U.S. Social Security Number (if applicable)', {
          type: 'ssn',
          width: 'half',
        }),
        optionalText('us_taxpayer_id', 'U.S. Taxpayer ID Number (if applicable)', {
          width: 'half',
        }),
      ],
    },
    {
      id: 'passport_info',
      title: 'Part 2. Passport Information',
      fields: [
        requiredText('passport_number', 'Passport/Travel Document Number', {
          width: 'half',
          aiFieldKey: 'passport_number',
        }),
        requiredText('passport_book_number', 'Passport Book Number (if applicable)', {
          width: 'half',
        }),
        requiredText('passport_issuing_country', 'Country That Issued Passport', {
          type: 'country',
          width: 'half',
        }),
        requiredText('passport_issuing_city', 'City Where Passport Was Issued', { width: 'half' }),
        dateField('passport_issue_date', 'Passport Issue Date', true, {
          width: 'half',
        }),
        dateField('passport_expiry_date', 'Passport Expiration Date', true, {
          width: 'half',
          aiFieldKey: 'expiry_date',
        }),
        yesNoField(
          'has_lost_passport',
          'Have you ever lost a passport or had one stolen?',
          true
        ),
        optionalText('lost_passport_details', 'If yes, provide details', {
          conditional: { field: 'has_lost_passport', value: 'yes' },
          type: 'textarea',
        }),
      ],
    },
    {
      id: 'travel_info',
      title: 'Part 3. Travel Information',
      description: 'Details about your planned trip to the United States.',
      fields: [
        selectField(
          'visa_type',
          'Purpose of Trip / Visa Type',
          [
            { value: 'b1', label: 'B-1: Business' },
            { value: 'b2', label: 'B-2: Tourism/Medical' },
            { value: 'b1b2', label: 'B-1/B-2: Business and Tourism' },
            { value: 'f1', label: 'F-1: Student (Academic)' },
            { value: 'h1b', label: 'H-1B: Specialty Occupation Worker' },
            { value: 'j1', label: 'J-1: Exchange Visitor' },
            { value: 'l1', label: 'L-1: Intracompany Transferee' },
            { value: 'o1', label: 'O-1: Extraordinary Ability' },
            { value: 'k1', label: 'K-1: Fiance(e)' },
            { value: 'other', label: 'Other' },
          ],
          true
        ),
        requiredText('specific_travel_plans', 'Specific Travel Plans', {
          type: 'textarea',
          helpText: 'Describe the specific purpose of your trip',
          width: 'full',
        }),
        dateField('intended_arrival_date', 'Intended Date of Arrival', true, { width: 'half' }),
        optionalText('intended_length_of_stay', 'Intended Length of Stay', {
          helpText: 'e.g., 2 weeks, 6 months, 3 years',
          width: 'half',
        }),
        optionalText('us_address_street', 'U.S. Street Address (where you will stay)', {
          type: 'address',
          width: 'full',
        }),
        optionalText('us_address_city', 'City', { width: 'third' }),
        optionalText('us_address_state', 'State', { type: 'state', width: 'third' }),
        optionalText('us_address_zip', 'ZIP Code', { width: 'third' }),
      ],
    },
    {
      id: 'travel_companions',
      title: 'Part 3 (continued). Travel Companions',
      fields: [
        yesNoField(
          'has_travel_companions',
          'Are there other persons traveling with you?',
          true
        ),
        optionalText('companion_names', 'Names of Travel Companions', {
          conditional: { field: 'has_travel_companions', value: 'yes' },
          helpText: 'List names and relationships',
          type: 'textarea',
        }),
        yesNoField(
          'is_part_of_group',
          'Are you traveling as part of an organized group?',
          true
        ),
        optionalText('group_name', 'Name of Group/Organization', {
          conditional: { field: 'is_part_of_group', value: 'yes' },
          width: 'half',
        }),
      ],
    },
    {
      id: 'previous_us_travel',
      title: 'Part 4. Previous U.S. Travel',
      fields: [
        yesNoField(
          'previously_visited_us',
          'Have you ever been in the United States?',
          true
        ),
        dateField('last_us_visit_arrival', 'Date of Last Arrival', false, {
          conditional: { field: 'previously_visited_us', value: 'yes' },
          width: 'half',
        }),
        optionalText('last_us_visit_duration', 'Length of Last Stay', {
          conditional: { field: 'previously_visited_us', value: 'yes' },
          width: 'half',
        }),
        yesNoField(
          'has_us_visa',
          'Have you ever been issued a U.S. visa?',
          true
        ),
        dateField('last_visa_issue_date', 'Date Last Visa Was Issued', false, {
          conditional: { field: 'has_us_visa', value: 'yes' },
          width: 'half',
        }),
        optionalText('last_visa_number', 'Visa Number', {
          conditional: { field: 'has_us_visa', value: 'yes' },
          width: 'half',
        }),
        yesNoField(
          'visa_ever_refused',
          'Have you ever been refused a U.S. visa, or denied entry at a U.S. port of entry?',
          true
        ),
        optionalText('visa_refusal_details', 'If yes, provide details', {
          conditional: { field: 'visa_ever_refused', value: 'yes' },
          type: 'textarea',
        }),
      ],
    },
    {
      id: 'us_contact',
      title: 'Part 5. U.S. Point of Contact',
      description: 'Provide a person or organization in the U.S. who can verify your trip.',
      fields: [
        requiredText('us_contact_last_name', 'Contact Last Name', { width: 'half' }),
        requiredText('us_contact_first_name', 'Contact First Name', { width: 'half' }),
        optionalText('us_contact_organization', 'Organization Name', { width: 'full' }),
        requiredText('us_contact_relationship', 'Relationship to You', { width: 'half' }),
        requiredText('us_contact_phone', 'Phone Number', { type: 'phone', width: 'half' }),
        optionalText('us_contact_email', 'Email Address', { type: 'email', width: 'half' }),
        optionalText('us_contact_address', 'Address', { type: 'address', width: 'full' }),
      ],
    },
    {
      id: 'family_info',
      title: 'Part 6. Family Information',
      description: 'Information about your immediate family.',
      fields: [
        requiredText('father_last_name', 'Father\'s Last Name', { width: 'half' }),
        requiredText('father_first_name', 'Father\'s First Name', { width: 'half' }),
        dateField('father_dob', 'Father\'s Date of Birth', false, { width: 'half' }),
        yesNoField('father_in_us', 'Is your father in the U.S.?', false),
        requiredText('mother_last_name', 'Mother\'s Last Name', { width: 'half' }),
        requiredText('mother_first_name', 'Mother\'s First Name', { width: 'half' }),
        dateField('mother_dob', 'Mother\'s Date of Birth', false, { width: 'half' }),
        yesNoField('mother_in_us', 'Is your mother in the U.S.?', false),
        yesNoField(
          'has_us_relatives',
          'Do you have any immediate relatives in the United States?',
          true
        ),
        optionalText('us_relatives_details', 'If yes, provide names and status', {
          conditional: { field: 'has_us_relatives', value: 'yes' },
          type: 'textarea',
        }),
      ],
    },
    {
      id: 'work_education',
      title: 'Part 7. Work/Education/Training',
      description: 'Provide your current and past work and education information.',
      fields: [
        selectField(
          'primary_occupation',
          'Primary Occupation',
          [
            { value: 'employed', label: 'Employed' },
            { value: 'self_employed', label: 'Self-Employed' },
            { value: 'student', label: 'Student' },
            { value: 'retired', label: 'Retired' },
            { value: 'unemployed', label: 'Not Employed' },
            { value: 'homemaker', label: 'Homemaker' },
            { value: 'other', label: 'Other' },
          ],
          true
        ),
        optionalText('current_employer_name', 'Current Employer/School Name', {
          width: 'full',
        }),
        optionalText('current_employer_address', 'Employer/School Address', {
          type: 'address',
          width: 'full',
        }),
        optionalText('current_employer_city', 'City', { width: 'third' }),
        optionalText('current_employer_country', 'Country', {
          type: 'country',
          width: 'third',
        }),
        optionalText('current_employer_phone', 'Phone Number', { type: 'phone', width: 'third' }),
        optionalText('job_title', 'Job Title', { width: 'half' }),
        dateField('employment_start_date', 'Start Date', false, { width: 'half' }),
        optionalText('monthly_salary', 'Monthly Salary (in local currency)', { width: 'half' }),
        optionalText('job_duties', 'Brief Description of Duties', {
          type: 'textarea',
          width: 'full',
        }),
      ],
    },
    {
      id: 'address_phone',
      title: 'Part 8. Address and Phone',
      fields: [
        requiredText('home_address_street', 'Home Street Address', {
          type: 'address',
          width: 'full',
        }),
        requiredText('home_address_city', 'City', { width: 'third' }),
        optionalText('home_address_state', 'State/Province', { width: 'third' }),
        requiredText('home_address_country', 'Country', { type: 'country', width: 'third' }),
        optionalText('home_address_postal', 'Postal Code', { width: 'third' }),
        requiredText('primary_phone', 'Primary Phone Number', { type: 'phone', width: 'half' }),
        optionalText('secondary_phone', 'Secondary Phone Number', { type: 'phone', width: 'half' }),
        requiredText('email_address', 'Email Address', { type: 'email', width: 'half' }),
      ],
    },
    {
      id: 'security_questions',
      title: 'Part 9. Security and Background',
      description: 'Answer the following security-related questions truthfully.',
      fields: [
        yesNoField(
          'communicable_disease',
          'Do you have a communicable disease of public health significance?',
          true
        ),
        yesNoField(
          'mental_physical_disorder',
          'Do you have a mental or physical disorder that poses a threat to the safety of yourself or others?',
          true
        ),
        yesNoField(
          'drug_abuser',
          'Are you or have you ever been a drug abuser or addict?',
          true
        ),
        yesNoField(
          'criminal_arrest',
          'Have you ever been arrested or convicted for any offense or crime?',
          true
        ),
        yesNoField(
          'visa_violation',
          'Have you ever violated the terms of a U.S. visa?',
          true
        ),
        yesNoField(
          'immigration_fraud',
          'Have you ever committed fraud or misrepresentation to obtain a visa?',
          true
        ),
        yesNoField(
          'unlawful_presence',
          'Have you ever been unlawfully present in the United States?',
          true
        ),
        yesNoField(
          'deported',
          'Have you ever been deported or removed from the United States?',
          true
        ),
      ],
    },
  ],
};
