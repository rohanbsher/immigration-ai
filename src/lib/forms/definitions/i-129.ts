// Form I-129: Petition for a Nonimmigrant Worker

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const I129_FORM: FormDefinition = {
  formType: 'I-129',
  title: 'Petition for a Nonimmigrant Worker',
  version: '2024-04',
  uscisFormNumber: 'I-129',
  estimatedTime: '2-4 hours',
  filingFee: 780,
  instructions: `Form I-129 is used by an employer to petition for a nonimmigrant worker to come to, or remain in, the United States temporarily. This includes H-1B specialty occupation workers, L-1 intracompany transferees, O-1 individuals with extraordinary ability, and other nonimmigrant worker classifications.`,
  sections: [
    {
      id: 'classification',
      title: 'Part 1. Classification Requested',
      description: 'Select the nonimmigrant classification you are requesting.',
      fields: [
        selectField(
          'classification_requested',
          'Nonimmigrant Classification',
          [
            { value: 'h1b', label: 'H-1B: Specialty Occupation' },
            { value: 'h1b1', label: 'H-1B1: Free Trade Agreement' },
            { value: 'h2a', label: 'H-2A: Temporary Agricultural Worker' },
            { value: 'h2b', label: 'H-2B: Temporary Non-Agricultural Worker' },
            { value: 'h3', label: 'H-3: Trainee or Special Education Visitor' },
            { value: 'l1a', label: 'L-1A: Intracompany Transferee (Manager/Executive)' },
            { value: 'l1b', label: 'L-1B: Intracompany Transferee (Specialized Knowledge)' },
            { value: 'o1a', label: 'O-1A: Extraordinary Ability (Sciences, Business, Education, Athletics)' },
            { value: 'o1b', label: 'O-1B: Extraordinary Ability (Arts, Motion Picture, Television)' },
            { value: 'o2', label: 'O-2: Accompanying Worker for O-1' },
            { value: 'p1a', label: 'P-1A: Internationally Recognized Athlete' },
            { value: 'p1b', label: 'P-1B: Internationally Recognized Entertainment Group' },
            { value: 'q1', label: 'Q-1: International Cultural Exchange' },
            { value: 'r1', label: 'R-1: Religious Worker' },
            { value: 'tn', label: 'TN: NAFTA/USMCA Professional' },
            { value: 'e1', label: 'E-1: Treaty Trader' },
            { value: 'e2', label: 'E-2: Treaty Investor' },
          ],
          true
        ),
        selectField(
          'petition_basis',
          'Basis for Petition',
          [
            { value: 'new_employment', label: 'New Employment' },
            { value: 'continuation', label: 'Continuation of Previously Approved Employment' },
            { value: 'change_employer', label: 'Change of Employer' },
            { value: 'amended_petition', label: 'Amended Petition' },
            { value: 'concurrent', label: 'Concurrent Employment' },
          ],
          true
        ),
        yesNoField(
          'requested_premium_processing',
          'Are you requesting premium processing? (Form I-907)',
          false
        ),
      ],
    },
    {
      id: 'petitioner_info',
      title: 'Part 2. Petitioner (Employer) Information',
      description: 'Information about the U.S. employer filing this petition.',
      fields: [
        requiredText('petitioner_company_name', 'Company/Organization Name', {
          aiFieldKey: 'employer_name',
          width: 'full',
        }),
        requiredText('petitioner_street', 'Street Address', {
          type: 'address',
          width: 'full',
        }),
        selectField(
          'petitioner_address_type',
          'Address Type',
          [
            { value: 'ste', label: 'Ste.' },
            { value: 'flr', label: 'Flr.' },
          ],
          false,
          { width: 'third' }
        ),
        optionalText('petitioner_suite_number', 'Suite/Floor Number', { width: 'third' }),
        requiredText('petitioner_city', 'City or Town', { width: 'third' }),
        requiredText('petitioner_state', 'State', { type: 'state', width: 'third' }),
        requiredText('petitioner_zip', 'ZIP Code', { width: 'third' }),
        optionalText('petitioner_province', 'Province (if outside U.S.)', { width: 'half' }),
        requiredText('petitioner_country', 'Country', { type: 'country', width: 'half' }),
        requiredText('petitioner_ein', 'IRS Tax Number (EIN)', {
          helpText: 'Employer Identification Number',
          width: 'half',
        }),
        requiredText('petitioner_phone', 'Phone Number', { type: 'phone', width: 'half' }),
        optionalText('petitioner_fax', 'Fax Number', { type: 'phone', width: 'half' }),
        optionalText('petitioner_email', 'Email Address', { type: 'email', width: 'half' }),
        requiredText('petitioner_num_employees', 'Current Number of U.S. Employees', {
          type: 'number',
          width: 'half',
        }),
        requiredText('petitioner_gross_annual_income', 'Gross Annual Income', {
          width: 'half',
        }),
        requiredText('petitioner_net_annual_income', 'Net Annual Income', {
          width: 'half',
        }),
        optionalText('petitioner_naics_code', 'NAICS Code', {
          helpText: 'North American Industry Classification System code',
          width: 'half',
        }),
      ],
    },
    {
      id: 'beneficiary_info',
      title: 'Part 3. Beneficiary (Worker) Information',
      description: 'Information about the nonimmigrant worker.',
      fields: [
        requiredText('beneficiary_last_name', 'Family Name (Last Name)', {
          aiFieldKey: 'surname',
          width: 'half',
        }),
        requiredText('beneficiary_first_name', 'Given Name (First Name)', {
          aiFieldKey: 'given_name',
          width: 'half',
        }),
        optionalText('beneficiary_middle_name', 'Middle Name', { width: 'half' }),
        optionalText('beneficiary_other_names', 'Other Names Used', { width: 'half' }),
        dateField('beneficiary_dob', 'Date of Birth', true, {
          aiFieldKey: 'date_of_birth',
          width: 'half',
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
        requiredText('beneficiary_nationality', 'Country of Citizenship', {
          type: 'country',
          width: 'half',
          aiFieldKey: 'nationality',
        }),
        optionalText('beneficiary_alien_number', 'Alien Registration Number (A-Number)', {
          type: 'alien_number',
          width: 'half',
          aiFieldKey: 'alien_number',
        }),
        optionalText('beneficiary_uscis_account', 'USCIS Online Account Number', {
          width: 'half',
        }),
        optionalText('beneficiary_ssn', 'Social Security Number', {
          type: 'ssn',
          width: 'half',
        }),
        requiredText('beneficiary_passport_number', 'Passport Number', {
          width: 'half',
          aiFieldKey: 'passport_number',
        }),
        requiredText('beneficiary_passport_country', 'Passport Issuing Country', {
          type: 'country',
          width: 'half',
        }),
        dateField('beneficiary_passport_expiry', 'Passport Expiration Date', true, {
          width: 'half',
          aiFieldKey: 'expiry_date',
        }),
      ],
    },
    {
      id: 'beneficiary_address',
      title: 'Part 3 (continued). Beneficiary Address',
      fields: [
        requiredText('beneficiary_current_address', 'Current Residence Address', {
          type: 'address',
          width: 'full',
        }),
        requiredText('beneficiary_address_city', 'City or Town', { width: 'third' }),
        optionalText('beneficiary_address_state', 'State/Province', { width: 'third' }),
        requiredText('beneficiary_address_country', 'Country', {
          type: 'country',
          width: 'third',
        }),
        optionalText('beneficiary_address_postal', 'Postal Code', { width: 'third' }),
      ],
    },
    {
      id: 'beneficiary_last_entry',
      title: 'Part 3 (continued). Last Arrival in the U.S.',
      fields: [
        optionalText('beneficiary_i94_number', 'I-94 Arrival/Departure Record Number', {
          width: 'half',
        }),
        dateField('beneficiary_last_arrival_date', 'Date of Last Arrival', false, {
          width: 'half',
        }),
        optionalText('beneficiary_last_arrival_status', 'Status at Last Entry', {
          width: 'half',
        }),
        dateField('beneficiary_status_expires', 'Current Status Expires On', false, {
          width: 'half',
        }),
        optionalText('beneficiary_port_of_entry', 'Port of Entry', { width: 'half' }),
      ],
    },
    {
      id: 'job_details',
      title: 'Part 4. Job Offer Details',
      description: 'Information about the position offered to the beneficiary.',
      fields: [
        requiredText('job_title', 'Job Title', {
          aiFieldKey: 'job_title',
          width: 'full',
        }),
        requiredText('job_soc_code', 'SOC/O*NET Code', {
          helpText: 'Standard Occupational Classification code',
          width: 'half',
        }),
        requiredText('job_description', 'Full Job Description', {
          type: 'textarea',
          helpText: 'Describe the duties and responsibilities',
          width: 'full',
        }),
        requiredText('job_address', 'Work Location Address', {
          type: 'address',
          width: 'full',
        }),
        requiredText('job_city', 'Work Location City', { width: 'third' }),
        requiredText('job_state', 'Work Location State', { type: 'state', width: 'third' }),
        requiredText('job_zip', 'Work Location ZIP Code', { width: 'third' }),
      ],
    },
    {
      id: 'wages',
      title: 'Part 4 (continued). Wages and Hours',
      fields: [
        requiredText('offered_wage', 'Offered Wage', {
          aiFieldKey: 'salary',
          helpText: 'Amount offered to the worker',
          width: 'half',
        }),
        selectField(
          'wage_type',
          'Wage Type',
          [
            { value: 'annual', label: 'Per Year' },
            { value: 'monthly', label: 'Per Month' },
            { value: 'biweekly', label: 'Biweekly' },
            { value: 'weekly', label: 'Per Week' },
            { value: 'hourly', label: 'Per Hour' },
          ],
          true,
          { width: 'half' }
        ),
        requiredText('prevailing_wage', 'Prevailing Wage', {
          helpText: 'DOL prevailing wage for this position',
          width: 'half',
        }),
        requiredText('hours_per_week', 'Hours Per Week', {
          type: 'number',
          width: 'half',
        }),
      ],
    },
    {
      id: 'lca',
      title: 'Part 5. Labor Condition Application (H-1B Only)',
      description: 'Provide LCA details for H-1B petitions.',
      fields: [
        optionalText('lca_case_number', 'LCA/ETA Case Number', {
          helpText: 'Certified Labor Condition Application number',
          conditional: { field: 'classification_requested', value: ['h1b', 'h1b1'] },
          width: 'half',
        }),
        dateField('lca_validity_start', 'LCA Validity Start Date', false, {
          conditional: { field: 'classification_requested', value: ['h1b', 'h1b1'] },
          width: 'half',
        }),
        dateField('lca_validity_end', 'LCA Validity End Date', false, {
          conditional: { field: 'classification_requested', value: ['h1b', 'h1b1'] },
          width: 'half',
        }),
      ],
    },
    {
      id: 'requested_dates',
      title: 'Part 6. Requested Period of Stay',
      fields: [
        dateField('requested_start_date', 'Requested Start Date', true, { width: 'half' }),
        dateField('requested_end_date', 'Requested End Date', true, { width: 'half' }),
      ],
    },
    {
      id: 'signature',
      title: 'Part 8. Petitioner Signature',
      description: 'Authorized signatory of the petitioning organization.',
      fields: [
        requiredText('signatory_name', 'Name of Authorized Signatory', { width: 'half' }),
        requiredText('signatory_title', 'Title of Authorized Signatory', { width: 'half' }),
        requiredText('signatory_phone', 'Phone Number', { type: 'phone', width: 'half' }),
        optionalText('signatory_email', 'Email Address', { type: 'email', width: 'half' }),
        dateField('signature_date', 'Date of Signature', true),
      ],
    },
  ],
};
