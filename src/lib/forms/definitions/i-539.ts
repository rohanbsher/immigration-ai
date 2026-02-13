// Form I-539: Application to Extend/Change Nonimmigrant Status

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const I539_FORM: FormDefinition = {
  formType: 'I-539',
  title: 'Application to Extend/Change Nonimmigrant Status',
  version: '2024-03',
  uscisFormNumber: 'I-539',
  estimatedTime: '1-2 hours',
  filingFee: 370,
  instructions: `Form I-539 is used by nonimmigrant visa holders to apply for an extension of stay or a change to another nonimmigrant status. This form covers the applicant and any co-applicants (dependents) included in the same request.`,
  sections: [
    {
      id: 'request_type',
      title: 'Part 1. Type of Request',
      description: 'Indicate whether you are requesting an extension or change of status.',
      fields: [
        selectField(
          'request_type',
          'I am applying for:',
          [
            { value: 'extension', label: 'Extension of Stay' },
            { value: 'change', label: 'Change of Status' },
            { value: 'both', label: 'Extension of Stay and Change of Status' },
          ],
          true
        ),
        requiredText('current_status', 'Current Nonimmigrant Status', {
          helpText: 'e.g., B-1, B-2, F-1, H-4, L-2',
          width: 'half',
        }),
        requiredText('requested_status', 'Requested Nonimmigrant Status', {
          helpText: 'Status you want to change to or extend',
          width: 'half',
        }),
      ],
    },
    {
      id: 'applicant_info',
      title: 'Part 2. Applicant Information',
      description: 'Provide your personal information.',
      fields: [
        requiredText('applicant_last_name', 'Family Name (Last Name)', {
          aiFieldKey: 'last_name',
          width: 'half',
        }),
        requiredText('applicant_first_name', 'Given Name (First Name)', {
          aiFieldKey: 'first_name',
          width: 'half',
        }),
        optionalText('applicant_middle_name', 'Middle Name', { width: 'half' }),
        optionalText('applicant_other_names', 'Other Names Used'),
        dateField('applicant_dob', 'Date of Birth', true, {
          aiFieldKey: 'date_of_birth',
          width: 'half',
        }),
        selectField(
          'applicant_sex',
          'Sex',
          [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ],
          true,
          { width: 'half' }
        ),
        requiredText('applicant_birth_city', 'City/Town of Birth', { width: 'half' }),
        requiredText('applicant_birth_country', 'Country of Birth', {
          type: 'country',
          width: 'half',
          aiFieldKey: 'country_of_birth',
        }),
        requiredText('applicant_nationality', 'Country of Citizenship/Nationality', {
          type: 'country',
          aiFieldKey: 'nationality',
          width: 'half',
        }),
        optionalText('applicant_alien_number', 'Alien Registration Number (A-Number)', {
          type: 'alien_number',
          width: 'half',
          aiFieldKey: 'alien_number',
        }),
        optionalText('applicant_uscis_account', 'USCIS Online Account Number', { width: 'half' }),
        optionalText('applicant_ssn', 'Social Security Number', { type: 'ssn', width: 'half' }),
      ],
    },
    {
      id: 'applicant_address',
      title: 'Part 2 (continued). Mailing Address',
      fields: [
        requiredText('mailing_street', 'Street Number and Name', { type: 'address' }),
        selectField(
          'mailing_address_type',
          'Address Type',
          [
            { value: 'apt', label: 'Apt.' },
            { value: 'ste', label: 'Ste.' },
            { value: 'flr', label: 'Flr.' },
          ],
          false,
          { width: 'third' }
        ),
        optionalText('mailing_apt_number', 'Number', { width: 'third' }),
        requiredText('mailing_city', 'City or Town', { width: 'half' }),
        requiredText('mailing_state', 'State', { type: 'state', width: 'third' }),
        requiredText('mailing_zip', 'ZIP Code', { width: 'third' }),
        requiredText('mailing_country', 'Country', { type: 'country' }),
      ],
    },
    {
      id: 'contact_info',
      title: 'Part 2 (continued). Contact Information',
      fields: [
        requiredText('applicant_phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('applicant_mobile', 'Mobile Phone Number', { type: 'phone' }),
        optionalText('applicant_email', 'Email Address', { type: 'email' }),
      ],
    },
    {
      id: 'passport_info',
      title: 'Part 2 (continued). Passport and Travel Document',
      fields: [
        requiredText('passport_number', 'Passport Number', {
          width: 'half',
          aiFieldKey: 'passport_number',
        }),
        requiredText('passport_country', 'Country That Issued Passport', {
          type: 'country',
          width: 'half',
        }),
        dateField('passport_expiry', 'Passport Expiration Date', true, {
          width: 'half',
          aiFieldKey: 'expiry_date',
        }),
        optionalText('i94_number', 'I-94 Arrival/Departure Record Number', { width: 'half' }),
      ],
    },
    {
      id: 'current_status_info',
      title: 'Part 3. Current Immigration Status',
      description: 'Details about your current nonimmigrant status.',
      fields: [
        dateField('date_of_last_arrival', 'Date of Last Arrival in the U.S.', true, {
          width: 'half',
        }),
        optionalText('port_of_entry', 'Place of Last Entry (Port of Entry)', { width: 'half' }),
        requiredText('status_at_entry', 'Status at Last Entry', {
          helpText: 'Nonimmigrant class of admission',
          width: 'half',
        }),
        dateField('current_status_expires', 'Date Current Status Expires', true, {
          helpText: 'As shown on I-94 or approval notice',
          width: 'half',
        }),
        optionalText('receipt_number', 'USCIS Receipt Number (if any pending application)', {
          width: 'half',
        }),
      ],
    },
    {
      id: 'requested_stay',
      title: 'Part 4. Requested Extension/Change of Status',
      fields: [
        dateField('requested_stay_from', 'Requested Stay From', true, { width: 'half' }),
        dateField('requested_stay_until', 'Requested Stay Until', true, { width: 'half' }),
        requiredText('reason_for_request', 'Reason for Extension or Change of Status', {
          type: 'textarea',
          helpText: 'Explain why you need to extend your stay or change your status',
          width: 'full',
        }),
      ],
    },
    {
      id: 'employment_info',
      title: 'Part 4 (continued). Employment Information',
      fields: [
        yesNoField(
          'currently_employed',
          'Are you currently employed in the United States?',
          true
        ),
        optionalText('employer_name', 'Employer Name', {
          conditional: { field: 'currently_employed', value: 'yes' },
          width: 'half',
        }),
        optionalText('employer_address', 'Employer Address', {
          conditional: { field: 'currently_employed', value: 'yes' },
          type: 'address',
          width: 'full',
        }),
      ],
    },
    {
      id: 'co_applicants',
      title: 'Part 5. Co-Applicants (Dependents)',
      description: 'List any dependents included in this application.',
      repeatable: true,
      maxRepeat: 5,
      fields: [
        optionalText('co_applicant_last_name', 'Family Name (Last Name)', { width: 'half' }),
        optionalText('co_applicant_first_name', 'Given Name (First Name)', { width: 'half' }),
        dateField('co_applicant_dob', 'Date of Birth', false, { width: 'half' }),
        optionalText('co_applicant_nationality', 'Country of Citizenship', {
          type: 'country',
          width: 'half',
        }),
        selectField(
          'co_applicant_relationship',
          'Relationship to Applicant',
          [
            { value: 'spouse', label: 'Spouse' },
            { value: 'child', label: 'Child' },
          ],
          false,
          { width: 'half' }
        ),
      ],
    },
    {
      id: 'signature',
      title: 'Part 7. Applicant Signature',
      description: 'Read the statement and sign below.',
      fields: [
        requiredText('applicant_signature', 'Signature of Applicant', {
          helpText:
            'By signing, you certify that all information is true and correct.',
        }),
        dateField('signature_date', 'Date of Signature', true),
        requiredText('signature_phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('signature_email', 'Email Address', { type: 'email' }),
      ],
    },
  ],
};
