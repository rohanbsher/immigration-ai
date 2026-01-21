// Form I-130: Petition for Alien Relative

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const I130_FORM: FormDefinition = {
  formType: 'I-130',
  title: 'Petition for Alien Relative',
  version: '2024-03',
  uscisFormNumber: 'I-130',
  estimatedTime: '1-2 hours',
  filingFee: 535,
  instructions: `Form I-130 is used to establish the relationship between a U.S. citizen or
    lawful permanent resident and a relative who wishes to immigrate to the United States.`,
  sections: [
    {
      id: 'petitioner_info',
      title: 'Part 1. Information About You (The Petitioner)',
      description: 'Provide information about yourself as the petitioner.',
      fields: [
        selectField(
          'petitioner_classification',
          'I am a:',
          [
            { value: 'citizen', label: 'U.S. Citizen' },
            { value: 'lpr', label: 'Lawful Permanent Resident' },
          ],
          true
        ),
        requiredText('petitioner_last_name', 'Family Name (Last Name)', {
          aiFieldKey: 'petitioner_last_name',
          width: 'half',
        }),
        requiredText('petitioner_first_name', 'Given Name (First Name)', {
          aiFieldKey: 'petitioner_first_name',
          width: 'half',
        }),
        optionalText('petitioner_middle_name', 'Middle Name', { width: 'half' }),
        optionalText('petitioner_other_names', 'Other Names Used', {
          helpText: 'List any maiden names, aliases, or nicknames',
        }),
        dateField('petitioner_dob', 'Date of Birth', true, {
          aiFieldKey: 'date_of_birth',
        }),
        selectField(
          'petitioner_sex',
          'Sex',
          [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ],
          true,
          { width: 'half' }
        ),
        requiredText('petitioner_birth_city', 'City/Town of Birth', { width: 'half' }),
        requiredText('petitioner_birth_country', 'Country of Birth', {
          type: 'country',
          width: 'half',
          aiFieldKey: 'country_of_birth',
        }),
        requiredText('petitioner_ssn', 'Social Security Number', {
          type: 'ssn',
          width: 'half',
        }),
        optionalText('petitioner_alien_number', 'Alien Registration Number (A-Number)', {
          type: 'alien_number',
          width: 'half',
          aiFieldKey: 'alien_number',
        }),
      ],
    },
    {
      id: 'petitioner_address',
      title: 'Part 1 (continued). Petitioner Mailing Address',
      fields: [
        requiredText('petitioner_street', 'Street Number and Name', {
          type: 'address',
          aiFieldKey: 'address_street',
        }),
        selectField(
          'petitioner_address_type',
          'Address Type',
          [
            { value: 'apt', label: 'Apt.' },
            { value: 'ste', label: 'Ste.' },
            { value: 'flr', label: 'Flr.' },
          ],
          false,
          { width: 'third' }
        ),
        optionalText('petitioner_apt_number', 'Number', { width: 'third' }),
        requiredText('petitioner_city', 'City or Town', { width: 'half' }),
        requiredText('petitioner_state', 'State', { type: 'state', width: 'third' }),
        requiredText('petitioner_zip', 'ZIP Code', { width: 'third' }),
        optionalText('petitioner_province', 'Province (if applicable)', { width: 'half' }),
        optionalText('petitioner_postal_code', 'Postal Code', { width: 'half' }),
        requiredText('petitioner_country', 'Country', { type: 'country' }),
      ],
    },
    {
      id: 'petitioner_contact',
      title: 'Part 1 (continued). Petitioner Contact Information',
      fields: [
        requiredText('petitioner_phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('petitioner_mobile', 'Mobile Phone Number', { type: 'phone' }),
        optionalText('petitioner_email', 'Email Address', { type: 'email' }),
      ],
    },
    {
      id: 'petitioner_marital',
      title: 'Part 1 (continued). Petitioner Marital Information',
      fields: [
        selectField(
          'petitioner_marital_status',
          'Current Marital Status',
          [
            { value: 'single', label: 'Single, Never Married' },
            { value: 'married', label: 'Married' },
            { value: 'divorced', label: 'Divorced' },
            { value: 'widowed', label: 'Widowed' },
            { value: 'annulled', label: 'Marriage Annulled' },
            { value: 'separated', label: 'Legally Separated' },
          ],
          true
        ),
        requiredText('petitioner_marriage_count', 'How many times have you been married?', {
          type: 'number',
          validation: { required: true, min: 0, max: 10 },
        }),
      ],
    },
    {
      id: 'beneficiary_info',
      title: 'Part 2. Information About Your Relative (The Beneficiary)',
      description: 'Provide information about the relative you are petitioning for.',
      fields: [
        selectField(
          'relationship',
          'Your relationship to the beneficiary',
          [
            { value: 'spouse', label: 'Spouse' },
            { value: 'parent', label: 'Parent' },
            { value: 'sibling', label: 'Brother/Sister' },
            { value: 'child', label: 'Child (unmarried, under 21)' },
            { value: 'adult_child_unmarried', label: 'Unmarried Adult Child (21+)' },
            { value: 'adult_child_married', label: 'Married Adult Child' },
          ],
          true
        ),
        requiredText('beneficiary_last_name', 'Family Name (Last Name)', {
          aiFieldKey: 'full_name',
          width: 'half',
        }),
        requiredText('beneficiary_first_name', 'Given Name (First Name)', { width: 'half' }),
        optionalText('beneficiary_middle_name', 'Middle Name', { width: 'half' }),
        optionalText('beneficiary_other_names', 'Other Names Used'),
        dateField('beneficiary_dob', 'Date of Birth', true, {
          aiFieldKey: 'date_of_birth',
        }),
        selectField(
          'beneficiary_sex',
          'Sex',
          [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ],
          true,
          { width: 'half' }
        ),
        requiredText('beneficiary_birth_city', 'City/Town of Birth', { width: 'half' }),
        requiredText('beneficiary_birth_country', 'Country of Birth', {
          type: 'country',
          width: 'half',
          aiFieldKey: 'country_of_birth',
        }),
        requiredText('beneficiary_nationality', 'Country of Citizenship/Nationality', {
          type: 'country',
          aiFieldKey: 'nationality',
        }),
        optionalText('beneficiary_alien_number', 'Alien Registration Number (A-Number)', {
          type: 'alien_number',
          aiFieldKey: 'alien_number',
        }),
        optionalText('beneficiary_ssn', 'Social Security Number (if any)', { type: 'ssn' }),
        optionalText('beneficiary_online_account', 'USCIS Online Account Number (if any)'),
      ],
    },
    {
      id: 'beneficiary_address',
      title: 'Part 2 (continued). Beneficiary Current Address',
      fields: [
        requiredText('beneficiary_street', 'Street Number and Name', { type: 'address' }),
        selectField(
          'beneficiary_address_type',
          'Address Type',
          [
            { value: 'apt', label: 'Apt.' },
            { value: 'ste', label: 'Ste.' },
            { value: 'flr', label: 'Flr.' },
          ],
          false,
          { width: 'third' }
        ),
        optionalText('beneficiary_apt_number', 'Number', { width: 'third' }),
        requiredText('beneficiary_city', 'City or Town', { width: 'half' }),
        optionalText('beneficiary_state', 'State', { type: 'state', width: 'third' }),
        optionalText('beneficiary_zip', 'ZIP Code', { width: 'third' }),
        optionalText('beneficiary_province', 'Province', { width: 'half' }),
        optionalText('beneficiary_postal_code', 'Postal Code', { width: 'half' }),
        requiredText('beneficiary_country', 'Country', { type: 'country' }),
        dateField('beneficiary_address_since', 'Living at this address since'),
      ],
    },
    {
      id: 'beneficiary_marital',
      title: 'Part 2 (continued). Beneficiary Marital Information',
      fields: [
        selectField(
          'beneficiary_marital_status',
          'Current Marital Status',
          [
            { value: 'single', label: 'Single, Never Married' },
            { value: 'married', label: 'Married' },
            { value: 'divorced', label: 'Divorced' },
            { value: 'widowed', label: 'Widowed' },
            { value: 'annulled', label: 'Marriage Annulled' },
            { value: 'separated', label: 'Legally Separated' },
          ],
          true
        ),
        requiredText('beneficiary_marriage_count', 'How many times married?', {
          type: 'number',
          validation: { required: true, min: 0, max: 10 },
        }),
      ],
    },
    {
      id: 'beneficiary_entry',
      title: 'Part 2 (continued). Beneficiary Entry Information',
      description: 'Information about how the beneficiary last entered the U.S. (if applicable)',
      fields: [
        yesNoField('beneficiary_ever_in_us', 'Has the beneficiary ever been in the U.S.?', true),
        dateField('beneficiary_last_arrival', 'Date of Last Arrival', false, {
          conditional: { field: 'beneficiary_ever_in_us', value: 'yes' },
        }),
        optionalText('beneficiary_i94_number', 'I-94 Arrival/Departure Record Number', {
          conditional: { field: 'beneficiary_ever_in_us', value: 'yes' },
        }),
        optionalText('beneficiary_passport_number', 'Passport Number Used at Entry', {
          conditional: { field: 'beneficiary_ever_in_us', value: 'yes' },
          aiFieldKey: 'passport_number',
        }),
        optionalText('beneficiary_travel_doc_country', 'Country that Issued Passport', {
          type: 'country',
          conditional: { field: 'beneficiary_ever_in_us', value: 'yes' },
        }),
        dateField('beneficiary_passport_expiry', 'Passport Expiration Date', false, {
          conditional: { field: 'beneficiary_ever_in_us', value: 'yes' },
          aiFieldKey: 'expiry_date',
        }),
        selectField(
          'beneficiary_current_status',
          'Current Immigration Status',
          [
            { value: 'none', label: 'No status/Undocumented' },
            { value: 'tourist', label: 'Tourist (B-2)' },
            { value: 'business', label: 'Business (B-1)' },
            { value: 'student', label: 'Student (F-1)' },
            { value: 'exchange', label: 'Exchange Visitor (J-1)' },
            { value: 'h1b', label: 'H-1B Worker' },
            { value: 'other', label: 'Other' },
          ],
          false,
          { conditional: { field: 'beneficiary_ever_in_us', value: 'yes' } }
        ),
        dateField('beneficiary_status_expiry', 'Date Status Expires', false, {
          conditional: { field: 'beneficiary_ever_in_us', value: 'yes' },
        }),
      ],
    },
    {
      id: 'employment_info',
      title: 'Part 2 (continued). Beneficiary Employment',
      fields: [
        optionalText('beneficiary_employer', 'Current Employer Name'),
        requiredText('beneficiary_occupation', 'Occupation'),
      ],
    },
    {
      id: 'additional_info',
      title: 'Part 3. Additional Information',
      fields: [
        yesNoField(
          'filed_before',
          'Have you EVER previously filed a petition for this beneficiary or any other alien?',
          true
        ),
        optionalText('previous_petition_result', 'If yes, what was the result?', {
          conditional: { field: 'filed_before', value: 'yes' },
        }),
        yesNoField(
          'beneficiary_immigration_proceeding',
          'Is the beneficiary in removal/deportation proceedings?',
          true
        ),
        yesNoField(
          'beneficiary_denied_admission',
          'Has the beneficiary ever been denied admission to the U.S.?',
          true
        ),
        yesNoField(
          'beneficiary_worked_without_auth',
          'Has the beneficiary worked in the U.S. without authorization?',
          true
        ),
        yesNoField(
          'beneficiary_violated_status',
          'Has the beneficiary violated the terms of their visa/status?',
          true
        ),
      ],
    },
    {
      id: 'signature',
      title: 'Part 8. Petitioner Signature',
      description: 'Read the statement and sign below.',
      fields: [
        requiredText('petitioner_signature', 'Signature of Petitioner', {
          helpText:
            'By signing, you certify that all information is true and correct to the best of your knowledge.',
        }),
        dateField('signature_date', 'Date of Signature', true),
        requiredText('petitioner_signature_phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('petitioner_signature_email', 'Email Address', { type: 'email' }),
      ],
    },
  ],
};
