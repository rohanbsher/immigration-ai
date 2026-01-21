// Form I-765: Application for Employment Authorization

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const I765_FORM: FormDefinition = {
  formType: 'I-765',
  title: 'Application for Employment Authorization',
  version: '2024-03',
  uscisFormNumber: 'I-765',
  estimatedTime: '1 hour',
  filingFee: 410,
  instructions: `Form I-765 is used to request an Employment Authorization Document (EAD)
    or to renew or replace an existing EAD. An EAD allows you to work legally in the United States.`,
  sections: [
    {
      id: 'reason_for_applying',
      title: 'Part 1. Reason for Applying',
      fields: [
        selectField(
          'application_reason',
          'I am applying for:',
          [
            { value: 'initial', label: 'Initial EAD (Permission to accept employment)' },
            { value: 'renewal', label: 'Renewal of EAD (Renewal of permission to accept employment)' },
            { value: 'replacement', label: 'Replacement EAD (Replace lost, stolen, or damaged EAD)' },
          ],
          true
        ),
      ],
    },
    {
      id: 'applicant_info',
      title: 'Part 2. Information About You',
      fields: [
        requiredText('last_name', 'Family Name (Last Name)', {
          aiFieldKey: 'full_name',
          width: 'half',
        }),
        requiredText('first_name', 'Given Name (First Name)', { width: 'half' }),
        optionalText('middle_name', 'Middle Name', { width: 'half' }),
        optionalText('other_names', 'Other Names Used', {
          helpText: 'Include maiden name, aliases',
        }),
        dateField('dob', 'Date of Birth', true, { aiFieldKey: 'date_of_birth' }),
        requiredText('birth_city', 'City/Town of Birth', { width: 'half' }),
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
            { value: 'divorced', label: 'Divorced' },
            { value: 'widowed', label: 'Widowed' },
          ],
          true,
          { width: 'half' }
        ),
        optionalText('ssn', 'U.S. Social Security Number', { type: 'ssn' }),
        optionalText('alien_number', 'Alien Registration Number (A-Number)', {
          type: 'alien_number',
          aiFieldKey: 'alien_number',
        }),
        optionalText('uscis_account', 'USCIS Online Account Number'),
        optionalText('i94_number', 'I-94 Arrival/Departure Record Number'),
        optionalText('passport_number', 'Passport Number', { aiFieldKey: 'passport_number' }),
        optionalText('passport_country', 'Country that Issued Passport', { type: 'country' }),
        dateField('passport_expiry', 'Passport Expiration Date', false, {
          aiFieldKey: 'expiry_date',
        }),
      ],
    },
    {
      id: 'mailing_address',
      title: 'Part 2 (continued). Mailing Address',
      fields: [
        requiredText('mail_street', 'Street Number and Name', { type: 'address' }),
        selectField(
          'mail_address_type',
          'Address Type',
          [
            { value: 'apt', label: 'Apt.' },
            { value: 'ste', label: 'Ste.' },
            { value: 'flr', label: 'Flr.' },
          ],
          false,
          { width: 'third' }
        ),
        optionalText('mail_apt_number', 'Number', { width: 'third' }),
        requiredText('mail_city', 'City or Town', { width: 'half' }),
        requiredText('mail_state', 'State', { type: 'state', width: 'third' }),
        requiredText('mail_zip', 'ZIP Code', { width: 'third' }),
        optionalText('mail_province', 'Province (if outside U.S.)', { width: 'half' }),
        optionalText('mail_postal_code', 'Postal Code', { width: 'half' }),
        optionalText('mail_country', 'Country', { type: 'country' }),
      ],
    },
    {
      id: 'physical_address',
      title: 'Part 2 (continued). Physical Address',
      fields: [
        yesNoField('same_as_mailing', 'Same as mailing address?', true),
        requiredText('phys_street', 'Street Number and Name', {
          type: 'address',
          conditional: { field: 'same_as_mailing', value: 'no' },
        }),
        selectField(
          'phys_address_type',
          'Address Type',
          [
            { value: 'apt', label: 'Apt.' },
            { value: 'ste', label: 'Ste.' },
            { value: 'flr', label: 'Flr.' },
          ],
          false,
          {
            width: 'third',
            conditional: { field: 'same_as_mailing', value: 'no' },
          }
        ),
        optionalText('phys_apt_number', 'Number', {
          width: 'third',
          conditional: { field: 'same_as_mailing', value: 'no' },
        }),
        requiredText('phys_city', 'City or Town', {
          width: 'half',
          conditional: { field: 'same_as_mailing', value: 'no' },
        }),
        requiredText('phys_state', 'State', {
          type: 'state',
          width: 'third',
          conditional: { field: 'same_as_mailing', value: 'no' },
        }),
        requiredText('phys_zip', 'ZIP Code', {
          width: 'third',
          conditional: { field: 'same_as_mailing', value: 'no' },
        }),
      ],
    },
    {
      id: 'contact_info',
      title: 'Part 2 (continued). Contact Information',
      fields: [
        requiredText('phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('mobile', 'Mobile Phone Number', { type: 'phone' }),
        optionalText('email', 'Email Address', { type: 'email' }),
      ],
    },
    {
      id: 'last_entry',
      title: 'Part 2 (continued). Information About Your Last Entry',
      fields: [
        dateField('last_entry_date', 'Date of Your Last Arrival in the U.S.', true),
        requiredText('last_entry_place', 'Place of Your Last Arrival', {
          helpText: 'City/Town, State',
        }),
        selectField(
          'last_entry_status',
          'Immigration Status at Last Arrival',
          [
            { value: 'b1_b2', label: 'B-1/B-2 Visitor' },
            { value: 'f1', label: 'F-1 Student' },
            { value: 'j1', label: 'J-1 Exchange Visitor' },
            { value: 'h1b', label: 'H-1B Worker' },
            { value: 'h4', label: 'H-4 Dependent' },
            { value: 'l1', label: 'L-1 Transferee' },
            { value: 'l2', label: 'L-2 Dependent' },
            { value: 'k1', label: 'K-1 Fiance(e)' },
            { value: 'parolee', label: 'Parolee' },
            { value: 'refugee', label: 'Refugee' },
            { value: 'asylee', label: 'Asylee' },
            { value: 'other', label: 'Other' },
          ],
          true
        ),
        selectField(
          'current_status',
          'Your Current Immigration Status or Category',
          [
            { value: 'b1_b2', label: 'B-1/B-2 Visitor' },
            { value: 'f1', label: 'F-1 Student' },
            { value: 'j1', label: 'J-1 Exchange Visitor' },
            { value: 'h4', label: 'H-4 Dependent' },
            { value: 'l2', label: 'L-2 Dependent' },
            { value: 'pending_aos', label: 'Pending Adjustment of Status' },
            { value: 'asylum_pending', label: 'Pending Asylum Application' },
            { value: 'tps', label: 'Temporary Protected Status' },
            { value: 'daca', label: 'DACA' },
            { value: 'refugee', label: 'Refugee' },
            { value: 'asylee', label: 'Asylee' },
            { value: 'other', label: 'Other' },
          ],
          true
        ),
        dateField('status_expires', 'Date Your Status Expires/Expired'),
        yesNoField('sevis_violation', 'Have you ever violated any F or J nonimmigrant status?', false),
      ],
    },
    {
      id: 'eligibility_category',
      title: 'Part 3. Eligibility Category',
      description: 'Select the category that applies to you.',
      fields: [
        selectField(
          'eligibility_category',
          'Eligibility Category',
          [
            { value: 'c09', label: '(c)(9) - Pending Adjustment of Status' },
            { value: 'c10', label: '(c)(10) - Pending Asylum' },
            { value: 'a03', label: '(a)(3) - Refugee' },
            { value: 'a05', label: '(a)(5) - Asylee' },
            { value: 'c26', label: '(c)(26) - H-4 Dependent of H-1B' },
            { value: 'a17', label: '(a)(17) - L-2 Dependent' },
            { value: 'c33', label: '(c)(33) - DACA' },
            { value: 'a12', label: '(a)(12) - TPS' },
            { value: 'a18', label: '(a)(18) - M-1/F-1 Student, Post-Completion OPT' },
            { value: 'c03a', label: '(c)(3)(A) - F-1 Student, Severe Economic Hardship' },
            { value: 'c03b', label: '(c)(3)(B) - J-2 Dependent' },
            { value: 'other', label: 'Other' },
          ],
          true
        ),
        optionalText('other_eligibility', 'If other, specify your eligibility category', {
          conditional: { field: 'eligibility_category', value: 'other' },
        }),
      ],
    },
    {
      id: 'previous_ead',
      title: 'Part 4. Information About Your Previous EAD (for Renewal/Replacement)',
      fields: [
        optionalText('previous_ead_number', 'EAD Card Number from Previous EAD'),
        dateField('previous_ead_expiry', 'Expiration Date of Previous EAD'),
        optionalText('previous_category', 'Previous Eligibility Category'),
      ],
    },
    {
      id: 'ssn_request',
      title: 'Part 5. Social Security Card Request',
      fields: [
        yesNoField('request_ssn', 'Do you want SSA to issue you a Social Security card?', true),
        yesNoField(
          'consent_disclosure',
          'Do you consent to disclosure of information to SSA?',
          true,
          { conditional: { field: 'request_ssn', value: 'yes' } }
        ),
        optionalText('father_last_name', "Father's Last Name", {
          conditional: { field: 'request_ssn', value: 'yes' },
        }),
        optionalText('father_first_name', "Father's First Name", {
          conditional: { field: 'request_ssn', value: 'yes' },
        }),
        optionalText('mother_last_name', "Mother's Last Name at Birth", {
          conditional: { field: 'request_ssn', value: 'yes' },
        }),
        optionalText('mother_first_name', "Mother's First Name", {
          conditional: { field: 'request_ssn', value: 'yes' },
        }),
      ],
    },
    {
      id: 'signature',
      title: 'Part 6. Applicant Signature',
      fields: [
        requiredText('signature', 'Signature', {
          helpText:
            'By signing, you certify that all information is complete, true, and correct.',
        }),
        dateField('signature_date', 'Date of Signature', true),
        requiredText('signature_phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('signature_email', 'Email Address', { type: 'email' }),
      ],
    },
  ],
};
