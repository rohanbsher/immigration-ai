// Form I-131: Application for Travel Document

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const I131_FORM: FormDefinition = {
  formType: 'I-131',
  title: 'Application for Travel Document',
  version: '2024-02',
  uscisFormNumber: 'I-131',
  estimatedTime: '30-60 minutes',
  filingFee: 590,
  instructions: `Form I-131 is used to apply for a travel document (Advance Parole, Refugee Travel Document, or Reentry Permit) to allow travel outside the United States.`,
  sections: [
    {
      id: 'document_type',
      title: 'Part 1. Type of Travel Document',
      description: 'Select the type of travel document you are applying for.',
      fields: [
        selectField(
          'document_type',
          'What travel document are you applying for?',
          [
            { value: 'reentry_permit', label: 'Reentry Permit' },
            { value: 'refugee_travel', label: 'Refugee Travel Document' },
            { value: 'advance_parole', label: 'Advance Parole' },
          ],
          true
        ),
      ],
    },
    {
      id: 'applicant_info',
      title: 'Part 2. Information About You',
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
        optionalText('mailing_province', 'Province (if applicable)', { width: 'half' }),
        optionalText('mailing_postal_code', 'Postal Code', { width: 'half' }),
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
      id: 'immigration_status',
      title: 'Part 2 (continued). Immigration Information',
      fields: [
        selectField(
          'immigration_status',
          'What is your current immigration status?',
          [
            { value: 'lpr', label: 'Lawful Permanent Resident' },
            { value: 'conditional_pr', label: 'Conditional Permanent Resident' },
            { value: 'refugee', label: 'Refugee' },
            { value: 'asylee', label: 'Asylee' },
            { value: 'pending_aos', label: 'Pending Adjustment of Status (I-485)' },
            { value: 'tps', label: 'Temporary Protected Status' },
            { value: 'daca', label: 'DACA' },
            { value: 'other', label: 'Other' },
          ],
          true
        ),
        dateField('status_granted_date', 'Date Status Was Granted', false),
        optionalText('class_of_admission', 'Class of Admission', { width: 'half' }),
      ],
    },
    {
      id: 'travel_info',
      title: 'Part 3. Travel Information',
      description: 'Provide details about your planned travel.',
      fields: [
        requiredText('countries_to_visit', 'Countries You Intend to Visit', {
          helpText: 'List all countries you plan to travel to',
        }),
        requiredText('purpose_of_trip', 'Purpose of Trip'),
        dateField('intended_departure', 'Intended Departure Date', false),
        optionalText('trip_duration', 'Expected Length of Trip', {
          helpText: 'e.g., "2 weeks", "3 months"',
        }),
      ],
    },
    {
      id: 'previous_travel',
      title: 'Part 3 (continued). Previous Travel Documents',
      fields: [
        yesNoField(
          'previously_issued_travel_doc',
          'Have you ever been issued a travel document?',
          true
        ),
        optionalText('previous_doc_details', 'If yes, provide details', {
          conditional: { field: 'previously_issued_travel_doc', value: 'yes' },
          helpText: 'Include document type and date issued',
        }),
        yesNoField(
          'filed_i485',
          'Have you filed an Application to Register Permanent Residence (Form I-485)?',
          true
        ),
        optionalText('i485_receipt_number', 'I-485 Receipt Number', {
          conditional: { field: 'filed_i485', value: 'yes' },
        }),
      ],
    },
    {
      id: 'signature',
      title: 'Part 8. Applicant Signature',
      description: 'Read the statement and sign below.',
      fields: [
        requiredText('applicant_signature', 'Signature of Applicant', {
          helpText:
            'By signing, you certify that all information is true and correct to the best of your knowledge.',
        }),
        dateField('signature_date', 'Date of Signature', true),
        requiredText('signature_phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('signature_email', 'Email Address', { type: 'email' }),
      ],
    },
  ],
};
