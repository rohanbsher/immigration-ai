// Form I-485: Application to Register Permanent Residence or Adjust Status

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const I485_FORM: FormDefinition = {
  formType: 'I-485',
  title: 'Application to Register Permanent Residence or Adjust Status',
  version: '2024-03',
  uscisFormNumber: 'I-485',
  estimatedTime: '3-4 hours',
  filingFee: 1225,
  instructions: `Form I-485 is used by a person who is in the United States to apply to adjust
    their status to that of a lawful permanent resident (get a Green Card).`,
  sections: [
    {
      id: 'applicant_info',
      title: 'Part 1. Information About You',
      description: 'Provide your biographical information.',
      fields: [
        requiredText('last_name', 'Family Name (Last Name)', {
          aiFieldKey: 'full_name',
          width: 'half',
        }),
        requiredText('first_name', 'Given Name (First Name)', { width: 'half' }),
        optionalText('middle_name', 'Middle Name', { width: 'half' }),
        optionalText('other_names', 'Other Names Used', {
          helpText: 'Include maiden name, aliases, nicknames',
        }),
        dateField('dob', 'Date of Birth', true, { aiFieldKey: 'date_of_birth' }),
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
        requiredText('birth_city', 'City/Town of Birth', { width: 'half' }),
        requiredText('birth_state_province', 'State/Province of Birth', { width: 'half' }),
        requiredText('birth_country', 'Country of Birth', {
          type: 'country',
          width: 'half',
          aiFieldKey: 'country_of_birth',
        }),
        requiredText('nationality', 'Country of Citizenship/Nationality', {
          type: 'country',
          aiFieldKey: 'nationality',
        }),
        optionalText('alien_number', 'Alien Registration Number (A-Number)', {
          type: 'alien_number',
          aiFieldKey: 'alien_number',
        }),
        optionalText('uscis_account', 'USCIS Online Account Number'),
        optionalText('ssn', 'U.S. Social Security Number', { type: 'ssn' }),
      ],
    },
    {
      id: 'mailing_address',
      title: 'Part 1 (continued). Mailing Address',
      fields: [
        yesNoField('safe_mail', 'Is it safe to send mail to this address?', true),
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
      ],
    },
    {
      id: 'physical_address',
      title: 'Part 1 (continued). Physical Address',
      description: 'Where you physically reside (if different from mailing address)',
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
      title: 'Part 1 (continued). Contact Information',
      fields: [
        requiredText('phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('mobile', 'Mobile Phone Number', { type: 'phone' }),
        optionalText('email', 'Email Address', { type: 'email' }),
      ],
    },
    {
      id: 'marital_status',
      title: 'Part 1 (continued). Marital Information',
      fields: [
        selectField(
          'marital_status',
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
        requiredText('marriage_count', 'Total times you have been married', {
          type: 'number',
          validation: { required: true, min: 0, max: 10 },
        }),
      ],
    },
    {
      id: 'basis_for_adjustment',
      title: 'Part 2. Application Type/Basis for Adjustment',
      fields: [
        selectField(
          'adjustment_basis',
          'I am applying to adjust status based on:',
          [
            {
              value: 'family_citizen',
              label: 'Family-Based: Immediate relative of U.S. citizen',
            },
            { value: 'family_lpr', label: 'Family-Based: Relative of Lawful Permanent Resident' },
            { value: 'employment', label: 'Employment-Based' },
            { value: 'diversity', label: 'Diversity Visa Lottery Winner' },
            { value: 'asylum', label: 'Asylee' },
            { value: 'refugee', label: 'Refugee' },
            { value: 'special', label: 'Special Immigrant' },
            { value: 'other', label: 'Other' },
          ],
          true
        ),
        optionalText('priority_date', 'Priority Date (if applicable)', { type: 'date' }),
        optionalText('receipt_number', 'Underlying Petition Receipt Number'),
      ],
    },
    {
      id: 'immigration_history',
      title: 'Part 3. Immigration History',
      fields: [
        dateField('last_entry_date', 'Date of Last Entry to the U.S.', true),
        requiredText('last_entry_city', 'City of Last Entry', { width: 'half' }),
        requiredText('last_entry_state', 'State of Last Entry', { type: 'state', width: 'half' }),
        optionalText('i94_number', 'I-94 Arrival/Departure Record Number'),
        optionalText('passport_number', 'Passport Number', { aiFieldKey: 'passport_number' }),
        optionalText('passport_country', 'Country that Issued Passport', { type: 'country' }),
        dateField('passport_expiry', 'Passport Expiration Date', false, {
          aiFieldKey: 'expiry_date',
        }),
        selectField(
          'current_status',
          'Current Immigration Status',
          [
            { value: 'visitor', label: 'Visitor (B-1/B-2)' },
            { value: 'student', label: 'Student (F-1/M-1)' },
            { value: 'exchange', label: 'Exchange Visitor (J-1)' },
            { value: 'h1b', label: 'H-1B Worker' },
            { value: 'h4', label: 'H-4 Dependent' },
            { value: 'l1', label: 'L-1 Intracompany Transferee' },
            { value: 'ead', label: 'Employment Authorization' },
            { value: 'parolee', label: 'Parolee' },
            { value: 'other', label: 'Other' },
          ],
          true
        ),
        dateField('status_expiry', 'Date Status Expires'),
      ],
    },
    {
      id: 'employment',
      title: 'Part 4. Employment History',
      description: 'List your employment for the past 5 years',
      repeatable: true,
      maxRepeat: 5,
      fields: [
        requiredText('employer_name', 'Employer Name'),
        requiredText('employer_street', 'Employer Address', { type: 'address' }),
        requiredText('employer_city', 'City', { width: 'half' }),
        requiredText('employer_state', 'State', { type: 'state', width: 'third' }),
        requiredText('employer_zip', 'ZIP Code', { width: 'third' }),
        requiredText('occupation', 'Your Occupation'),
        dateField('employment_from', 'From Date', true),
        dateField('employment_to', 'To Date'),
      ],
    },
    {
      id: 'parents',
      title: 'Part 5. Parent Information',
      fields: [
        requiredText('parent1_last_name', 'Parent 1 - Last Name', { width: 'half' }),
        requiredText('parent1_first_name', 'Parent 1 - First Name', { width: 'half' }),
        optionalText('parent1_middle_name', 'Parent 1 - Middle Name', { width: 'half' }),
        dateField('parent1_dob', 'Parent 1 - Date of Birth'),
        selectField(
          'parent1_sex',
          'Parent 1 - Sex',
          [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ],
          false,
          { width: 'half' }
        ),
        requiredText('parent1_birth_country', 'Parent 1 - Country of Birth', { type: 'country' }),
        requiredText('parent2_last_name', 'Parent 2 - Last Name', { width: 'half' }),
        requiredText('parent2_first_name', 'Parent 2 - First Name', { width: 'half' }),
        optionalText('parent2_middle_name', 'Parent 2 - Middle Name', { width: 'half' }),
        dateField('parent2_dob', 'Parent 2 - Date of Birth'),
        selectField(
          'parent2_sex',
          'Parent 2 - Sex',
          [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ],
          false,
          { width: 'half' }
        ),
        requiredText('parent2_birth_country', 'Parent 2 - Country of Birth', { type: 'country' }),
      ],
    },
    {
      id: 'inadmissibility',
      title: 'Part 6. General Eligibility and Inadmissibility Grounds',
      description:
        'Answer the following questions truthfully. False statements may result in denial.',
      fields: [
        yesNoField('crime_moral_turpitude', 'Have you ever committed a crime involving moral turpitude?', true),
        yesNoField('drug_violation', 'Have you ever violated any controlled substance law?', true),
        yesNoField('multiple_crimes', 'Have you been convicted of 2 or more offenses for which the combined sentences were 5+ years?', true),
        yesNoField('drug_trafficker', 'Have you ever been a drug trafficker?', true),
        yesNoField('prostitution', 'Have you engaged in prostitution or commercialized vice?', true),
        yesNoField('money_laundering', 'Have you been involved in money laundering?', true),
        yesNoField('human_trafficking', 'Have you engaged in human trafficking?', true),
        yesNoField('polygamy', 'Do you intend to practice polygamy in the United States?', true),
        yesNoField('prior_removal', 'Have you ever been removed or deported from the U.S.?', true),
        yesNoField('unlawful_presence', 'Have you been unlawfully present in the U.S. for more than 180 days?', true),
        yesNoField('fraud_misrepresentation', 'Have you ever committed fraud or misrepresentation?', true),
        yesNoField('false_citizenship', 'Have you ever falsely claimed U.S. citizenship?', true),
        yesNoField('public_charge', 'Are you likely to become a public charge?', true),
        yesNoField('terrorist_activity', 'Have you ever engaged in terrorist activity?', true),
        yesNoField('nazi_persecution', 'Have you participated in Nazi persecution or genocide?', true),
        yesNoField('torture', 'Have you committed torture or extrajudicial killings?', true),
        yesNoField('child_soldier', 'Have you recruited child soldiers?', true),
      ],
    },
    {
      id: 'accommodations',
      title: 'Part 7. Accommodations for Disabilities',
      fields: [
        yesNoField('needs_accommodation', 'Do you request accommodations due to a disability?', true),
        yesNoField('deaf_hard_hearing', 'Are you deaf or hard of hearing?', false, {
          conditional: { field: 'needs_accommodation', value: 'yes' },
        }),
        yesNoField('blind_low_vision', 'Are you blind or have low vision?', false, {
          conditional: { field: 'needs_accommodation', value: 'yes' },
        }),
        optionalText('other_accommodation', 'Other accommodation needed', {
          type: 'textarea',
          conditional: { field: 'needs_accommodation', value: 'yes' },
        }),
      ],
    },
    {
      id: 'signature',
      title: 'Part 10. Applicant Signature',
      fields: [
        requiredText('applicant_signature', 'Signature', {
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
