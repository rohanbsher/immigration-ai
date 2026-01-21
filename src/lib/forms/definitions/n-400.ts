// Form N-400: Application for Naturalization

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const N400_FORM: FormDefinition = {
  formType: 'N-400',
  title: 'Application for Naturalization',
  version: '2024-03',
  uscisFormNumber: 'N-400',
  estimatedTime: '2-3 hours',
  filingFee: 760,
  instructions: `Form N-400 is used to apply to become a naturalized U.S. citizen.
    You must be a lawful permanent resident to apply.`,
  sections: [
    {
      id: 'eligibility',
      title: 'Part 1. Eligibility',
      description: 'Determine your basis for applying for naturalization.',
      fields: [
        selectField(
          'eligibility_basis',
          'I am applying for naturalization on the basis of:',
          [
            {
              value: '5_years',
              label:
                'I have been a lawful permanent resident for at least 5 years',
            },
            {
              value: '3_years_married',
              label:
                'I have been a lawful permanent resident for 3+ years and married to a U.S. citizen for 3+ years',
            },
            {
              value: 'military_peacetime',
              label: 'I am a current member of the U.S. armed forces',
            },
            {
              value: 'military_wartime',
              label: 'I served in the U.S. armed forces during a period of hostilities',
            },
            { value: 'other', label: 'Other basis for eligibility' },
          ],
          true
        ),
      ],
    },
    {
      id: 'applicant_info',
      title: 'Part 2. Information About You',
      fields: [
        requiredText('last_name', 'Current Legal Family Name (Last Name)', {
          aiFieldKey: 'full_name',
          width: 'half',
        }),
        requiredText('first_name', 'Current Legal Given Name (First Name)', { width: 'half' }),
        optionalText('middle_name', 'Current Legal Middle Name', { width: 'half' }),
        optionalText('other_names', 'Other Names You Have Used', {
          helpText: 'Include maiden name, aliases, nicknames',
        }),
        yesNoField('name_change', 'Do you want to legally change your name?', true),
        requiredText('new_last_name', 'New Family Name (if changing)', {
          width: 'half',
          conditional: { field: 'name_change', value: 'yes' },
        }),
        requiredText('new_first_name', 'New Given Name (if changing)', {
          width: 'half',
          conditional: { field: 'name_change', value: 'yes' },
        }),
        optionalText('new_middle_name', 'New Middle Name (if changing)', {
          width: 'half',
          conditional: { field: 'name_change', value: 'yes' },
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
        optionalText('ssn', 'U.S. Social Security Number', { type: 'ssn' }),
        requiredText('alien_number', 'Alien Registration Number (A-Number)', {
          type: 'alien_number',
          aiFieldKey: 'alien_number',
        }),
        optionalText('uscis_account', 'USCIS Online Account Number'),
        requiredText('nationality', 'Country of Citizenship/Nationality', {
          type: 'country',
          aiFieldKey: 'nationality',
        }),
        yesNoField('dual_citizen', 'Do you have citizenship in any other country?', true),
        optionalText('other_nationality', 'Other Country of Citizenship', {
          type: 'country',
          conditional: { field: 'dual_citizen', value: 'yes' },
        }),
        yesNoField('disability_accommodation', 'Do you have a physical or developmental disability?', false),
      ],
    },
    {
      id: 'mailing_address',
      title: 'Part 3. Mailing Address',
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
      ],
    },
    {
      id: 'physical_address',
      title: 'Part 3 (continued). Physical Address',
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
          { width: 'third', conditional: { field: 'same_as_mailing', value: 'no' } }
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
      title: 'Part 3 (continued). Contact Information',
      fields: [
        requiredText('phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('mobile', 'Mobile Phone Number', { type: 'phone' }),
        optionalText('email', 'Email Address', { type: 'email' }),
      ],
    },
    {
      id: 'lpr_info',
      title: 'Part 4. Lawful Permanent Resident Information',
      fields: [
        dateField('lpr_date', 'Date You Became a Lawful Permanent Resident', true),
        requiredText('green_card_number', 'Green Card Number'),
        optionalText('receipt_number', 'USCIS Receipt Number of Immigrant Petition'),
      ],
    },
    {
      id: 'residence_history',
      title: 'Part 5. Information About Your Residence',
      description: 'List all places where you have lived during the last 5 years.',
      repeatable: true,
      maxRepeat: 10,
      fields: [
        requiredText('res_street', 'Street Number and Name', { type: 'address' }),
        requiredText('res_city', 'City or Town', { width: 'half' }),
        requiredText('res_state', 'State', { type: 'state', width: 'third' }),
        requiredText('res_zip', 'ZIP Code', { width: 'third' }),
        optionalText('res_country', 'Country (if outside U.S.)', { type: 'country' }),
        dateField('res_from', 'From Date', true),
        dateField('res_to', 'To Date (leave blank if current)'),
      ],
    },
    {
      id: 'marital_history',
      title: 'Part 6. Marital History',
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
        requiredText('marriage_count', 'How many times have you been married?', {
          type: 'number',
          validation: { required: true, min: 0, max: 10 },
        }),
      ],
    },
    {
      id: 'current_spouse',
      title: 'Part 6 (continued). Current Spouse Information',
      description: 'If currently married, provide information about your spouse.',
      fields: [
        requiredText('spouse_last_name', 'Spouse Family Name (Last Name)', { width: 'half' }),
        requiredText('spouse_first_name', 'Spouse Given Name (First Name)', { width: 'half' }),
        optionalText('spouse_middle_name', 'Spouse Middle Name', { width: 'half' }),
        dateField('spouse_dob', 'Spouse Date of Birth'),
        requiredText('spouse_birth_country', 'Spouse Country of Birth', { type: 'country' }),
        requiredText('spouse_nationality', 'Spouse Country of Citizenship', { type: 'country' }),
        dateField('marriage_date', 'Date of Current Marriage'),
        yesNoField('spouse_us_citizen', 'Is your spouse a U.S. citizen?', true),
        optionalText('spouse_alien_number', "Spouse's A-Number (if applicable)", {
          type: 'alien_number',
        }),
      ],
    },
    {
      id: 'children',
      title: 'Part 7. Children',
      fields: [
        requiredText('total_children', 'Total number of children', {
          type: 'number',
          validation: { required: true, min: 0, max: 20 },
        }),
      ],
    },
    {
      id: 'employment_history',
      title: 'Part 8. Employment History',
      description: 'List your employment for the past 5 years.',
      repeatable: true,
      maxRepeat: 10,
      fields: [
        requiredText('employer_name', 'Employer or Business Name'),
        requiredText('occupation', 'Your Occupation'),
        requiredText('emp_street', 'Employer Street Address', { type: 'address' }),
        requiredText('emp_city', 'City', { width: 'half' }),
        requiredText('emp_state', 'State', { type: 'state', width: 'third' }),
        requiredText('emp_zip', 'ZIP Code', { width: 'third' }),
        dateField('emp_from', 'From Date', true),
        dateField('emp_to', 'To Date (leave blank if current)'),
      ],
    },
    {
      id: 'travel_history',
      title: 'Part 9. Time Outside the United States',
      fields: [
        requiredText('total_days_outside', 'Total days outside the U.S. in the past 5 years', {
          type: 'number',
          validation: { required: true, min: 0 },
        }),
        requiredText('total_trips', 'Total number of trips outside the U.S.', {
          type: 'number',
          validation: { required: true, min: 0 },
        }),
        yesNoField('trip_6_months', 'Have you taken a trip of 6 months or more?', true),
      ],
    },
    {
      id: 'good_moral_character',
      title: 'Part 10. General Eligibility Requirements',
      description: 'Answer the following questions about your moral character.',
      fields: [
        yesNoField('claim_citizen', 'Have you EVER claimed to be a U.S. citizen (in writing or any other way)?', true),
        yesNoField('registered_vote', 'Have you EVER registered to vote in any Federal, State, or local election in the United States?', true),
        yesNoField('voted', 'Have you EVER voted in any Federal, State, or local election in the United States?', true),
        yesNoField('title_nobility', 'Do you now have, or did you EVER have, a hereditary title or order of nobility?', true),
        yesNoField('legally_incompetent', 'Have you EVER been declared legally incompetent?', true),
        yesNoField('failed_tax', 'Have you failed to file a required Federal, State, or local tax return since becoming a lawful permanent resident?', true),
        yesNoField('owe_taxes', 'Do you owe any overdue Federal, State, or local taxes?', true),
        yesNoField('called_incompetent', 'Have you called yourself a "nonresident" on a tax return since becoming a permanent resident?', true),
      ],
    },
    {
      id: 'criminal_history',
      title: 'Part 10 (continued). Criminal History',
      fields: [
        yesNoField('crime_arrested', 'Have you EVER been arrested, cited, or detained?', true),
        yesNoField('crime_charged', 'Have you EVER been charged with committing a crime or offense?', true),
        yesNoField('crime_convicted', 'Have you EVER been convicted of a crime or offense?', true),
        yesNoField('probation', 'Have you EVER been placed on probation, parole, or given a suspended sentence?', true),
        yesNoField('jail', 'Have you EVER been in jail or prison?', true),
        yesNoField('crime_moral_turpitude', 'Have you EVER committed a crime for which you were NOT arrested?', true),
        yesNoField('prostitution', 'Have you EVER been a prostitute or procured anyone for prostitution?', true),
        yesNoField('smuggling', 'Have you EVER knowingly helped anyone enter the U.S. illegally?', true),
        yesNoField('drug_use', 'Have you EVER illegally used or sold controlled substances?', true),
        yesNoField('married_two', 'Have you EVER been married to more than one person at the same time?', true),
        yesNoField('gambling', 'Have you EVER received income from illegal gambling?', true),
        yesNoField('support_failure', 'Have you EVER failed to support your dependents or pay alimony?', true),
      ],
    },
    {
      id: 'attachment',
      title: 'Part 11. Attachment to the Constitution',
      fields: [
        yesNoField('support_constitution', 'Do you support the Constitution and form of government of the United States?', true),
        yesNoField('understand_oath', 'Do you understand the full Oath of Allegiance to the United States?', true),
        yesNoField('willing_oath', 'Are you willing to take the full Oath of Allegiance?', true),
        yesNoField('bear_arms', 'If required by law, are you willing to bear arms on behalf of the United States?', true),
        yesNoField('noncombatant_service', 'If required by law, are you willing to perform noncombatant services in the U.S. Armed Forces?', true),
        yesNoField('national_importance', 'If required by law, are you willing to perform work of national importance under civilian direction?', true),
      ],
    },
    {
      id: 'organizations',
      title: 'Part 12. Organizations and Associations',
      fields: [
        yesNoField('communist_party', 'Have you EVER been a member of the Communist Party?', true),
        yesNoField('totalitarian_party', 'Have you EVER been a member of any totalitarian party?', true),
        yesNoField('terrorist_org', 'Have you EVER been a member of a terrorist organization?', true),
        yesNoField('persecution', 'Have you EVER advocated persecution based on race, religion, national origin, or political opinion?', true),
        yesNoField('genocide', 'Have you EVER participated in genocide, torture, or killing?', true),
        yesNoField('nazi', 'Were you EVER involved in Nazi persecution or the Holocaust?', true),
      ],
    },
    {
      id: 'removal',
      title: 'Part 12 (continued). Removal and Deportation',
      fields: [
        yesNoField('removal_proceedings', 'Are you now in removal, exclusion, rescission, or deportation proceedings?', true),
        yesNoField('previous_removal', 'Have you EVER been removed, excluded, or deported from the United States?', true),
        yesNoField('removal_order', 'Have you EVER been ordered removed, excluded, or deported?', true),
        yesNoField('immigration_fraud', 'Have you EVER applied for any benefit by fraud or willful misrepresentation?', true),
      ],
    },
    {
      id: 'military',
      title: 'Part 13. Military Service',
      fields: [
        yesNoField('us_military', 'Have you EVER served in the U.S. Armed Forces?', true),
        yesNoField('draft_registered', 'Have you registered with the Selective Service System?', false, {
          conditional: { field: 'sex', value: 'male' },
        }),
        optionalText('selective_service_number', 'Selective Service Number', {
          conditional: { field: 'draft_registered', value: 'yes' },
        }),
        yesNoField('deserted', 'Have you EVER left the U.S. to avoid military service?', true),
        yesNoField('court_martial', 'Have you EVER been court-martialed or discharged dishonorably?', true),
      ],
    },
    {
      id: 'signature',
      title: 'Part 14. Applicant Signature',
      fields: [
        requiredText('signature', 'Signature', {
          helpText:
            'I certify, under penalty of perjury, that all of the information in my application is complete, true, and correct.',
        }),
        dateField('signature_date', 'Date of Signature', true),
        requiredText('signature_phone', 'Daytime Phone Number', { type: 'phone' }),
        optionalText('signature_email', 'Email Address', { type: 'email' }),
      ],
    },
  ],
};
