// Form I-140: Immigrant Petition for Alien Workers

import {
  FormDefinition,
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

export const I140_FORM: FormDefinition = {
  formType: 'I-140',
  title: 'Immigrant Petition for Alien Workers',
  version: '2024-01',
  uscisFormNumber: 'I-140',
  estimatedTime: '1-2 hours',
  filingFee: 700,
  instructions: `Form I-140 is used by a U.S. employer to petition for a foreign worker to become a lawful permanent resident (green card holder) based on employment.`,
  sections: [
    {
      id: 'immigrant_category',
      title: 'Part 1. Classification Requested',
      description: 'Select the immigrant classification you are requesting.',
      fields: [
        selectField(
          'immigrant_category',
          'Immigrant Category',
          [
            { value: 'eb1a', label: 'EB-1A: Extraordinary Ability' },
            { value: 'eb1b', label: 'EB-1B: Outstanding Professor or Researcher' },
            { value: 'eb1c', label: 'EB-1C: Multinational Manager or Executive' },
            { value: 'eb2', label: 'EB-2: Advanced Degree Professional' },
            { value: 'eb2_niw', label: 'EB-2 NIW: National Interest Waiver' },
            { value: 'eb3_professional', label: 'EB-3: Professional' },
            { value: 'eb3_skilled', label: 'EB-3: Skilled Worker' },
            { value: 'eb3_unskilled', label: 'EB-3: Other Worker' },
          ],
          true
        ),
      ],
    },
    {
      id: 'petitioner_info',
      title: 'Part 2. Petitioner (Employer) Information',
      description: 'Information about the U.S. employer filing this petition.',
      fields: [
        requiredText('pt1_employer_name', 'Company/Organization Name', {
          aiFieldKey: 'employer_name',
          width: 'full',
        }),
        requiredText('pt1_employer_address_street', 'Street Address', {
          width: 'full',
        }),
        requiredText('pt1_employer_address_city', 'City', {
          width: 'third',
        }),
        requiredText('pt1_employer_address_state', 'State', {
          width: 'third',
        }),
        requiredText('pt1_employer_address_zip', 'ZIP Code', {
          width: 'third',
        }),
        requiredText('pt1_employer_ein', 'IRS Tax Number (EIN)', {
          helpText: 'Employer Identification Number',
        }),
        requiredText('pt1_employer_phone', 'Phone Number', {
          type: 'phone',
        }),
        optionalText('pt1_employer_fein', 'NAICS Code', {
          helpText: 'North American Industry Classification System code',
        }),
        requiredText('pt1_num_employees', 'Current Number of Employees', {
          type: 'number',
        }),
        requiredText('pt1_gross_annual_income', 'Gross Annual Income', {
          helpText: 'Employer gross annual income',
        }),
        requiredText('pt1_net_annual_income', 'Net Annual Income', {
          helpText: 'Employer net annual income',
        }),
      ],
    },
    {
      id: 'beneficiary_info',
      title: 'Part 3. Beneficiary (Worker) Information',
      description: 'Information about the foreign worker being petitioned.',
      fields: [
        requiredText('pt4_family_name', 'Family Name (Last Name)', {
          aiFieldKey: 'surname',
          width: 'half',
        }),
        requiredText('pt4_given_name', 'Given Name (First Name)', {
          aiFieldKey: 'given_name',
          width: 'half',
        }),
        optionalText('pt4_middle_name', 'Middle Name', {
          width: 'half',
        }),
        dateField('pt4_dob', 'Date of Birth', true, {
          aiFieldKey: 'date_of_birth',
          width: 'half',
        }),
        requiredText('pt4_country_of_birth', 'Country of Birth', {
          aiFieldKey: 'place_of_birth',
          type: 'country',
          width: 'half',
        }),
        requiredText('pt4_nationality', 'Country of Nationality', {
          aiFieldKey: 'nationality',
          type: 'country',
          width: 'half',
        }),
        optionalText('pt4_alien_number', 'Alien Registration Number (A-Number)', {
          aiFieldKey: 'alien_number',
          type: 'alien_number',
          width: 'half',
        }),
        optionalText('pt4_passport_number', 'Passport Number', {
          aiFieldKey: 'passport_number',
          width: 'half',
        }),
        dateField('pt4_passport_expiry', 'Passport Expiration Date', false, {
          aiFieldKey: 'expiry_date',
          width: 'half',
        }),
        requiredText('pt4_current_address', 'Current Address', {
          width: 'full',
        }),
      ],
    },
    {
      id: 'job_info',
      title: 'Part 4. Job Offer Information',
      description: 'Details about the job being offered to the beneficiary.',
      fields: [
        requiredText('pt5_job_title', 'Job Title', {
          aiFieldKey: 'job_title',
          width: 'full',
        }),
        requiredText('pt5_soc_code', 'SOC/O*NET Code', {
          helpText: 'Standard Occupational Classification code',
          width: 'half',
        }),
        requiredText('pt5_nontechnical_description', 'Job Description', {
          type: 'textarea',
          helpText: 'Describe the duties of the position',
          width: 'full',
        }),
        requiredText('pt5_offered_wage', 'Offered Wage', {
          aiFieldKey: 'salary',
          helpText: 'Annual salary or hourly wage',
          width: 'half',
        }),
        selectField(
          'pt5_wage_type',
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
        requiredText('pt5_prevailing_wage', 'Prevailing Wage', {
          helpText: 'DOL prevailing wage for this position',
          width: 'half',
        }),
        requiredText('pt5_work_location_city', 'Work Location - City', {
          width: 'half',
        }),
        requiredText('pt5_work_location_state', 'Work Location - State', {
          width: 'half',
        }),
      ],
    },
    {
      id: 'labor_cert',
      title: 'Part 5. Labor Certification',
      description: 'Labor certification details (if applicable).',
      fields: [
        yesNoField(
          'pt6_has_labor_cert',
          'Has a labor certification been approved for this position?',
          true
        ),
        optionalText('pt6_labor_cert_number', 'Labor Certification Number (ETA Case Number)', {
          conditional: { field: 'pt6_has_labor_cert', value: 'yes' },
          width: 'half',
        }),
        dateField('pt6_labor_cert_date', 'Labor Certification Filing Date', false, {
          conditional: { field: 'pt6_has_labor_cert', value: 'yes' },
          width: 'half',
        }),
        dateField('pt6_priority_date', 'Priority Date', false, {
          helpText: 'The date the labor certification was filed with DOL',
          width: 'half',
        }),
      ],
    },
    {
      id: 'education',
      title: 'Part 6. Beneficiary Education & Qualifications',
      description: 'Education and qualifications of the beneficiary.',
      fields: [
        selectField(
          'pt7_highest_education',
          'Highest Level of Education',
          [
            { value: 'high_school', label: 'High School Diploma' },
            { value: 'associates', label: "Associate's Degree" },
            { value: 'bachelors', label: "Bachelor's Degree" },
            { value: 'masters', label: "Master's Degree" },
            { value: 'doctorate', label: 'Doctorate (Ph.D.)' },
            { value: 'professional', label: 'Professional Degree (M.D., J.D., etc.)' },
          ],
          true
        ),
        requiredText('pt7_field_of_study', 'Field of Study', {
          width: 'half',
        }),
        requiredText('pt7_institution_name', 'Institution Name', {
          width: 'half',
        }),
        requiredText('pt7_institution_country', 'Country of Institution', {
          type: 'country',
          width: 'half',
        }),
        dateField('pt7_degree_date', 'Date Degree Awarded', false, {
          width: 'half',
        }),
        optionalText('pt7_years_experience', 'Years of Experience in Occupation', {
          type: 'number',
          width: 'half',
        }),
      ],
    },
    {
      id: 'additional_info',
      title: 'Part 7. Additional Information',
      fields: [
        yesNoField(
          'pt8_beneficiary_in_us',
          'Is the beneficiary currently in the United States?',
          true
        ),
        optionalText('pt8_current_status', 'Current Immigration Status', {
          conditional: { field: 'pt8_beneficiary_in_us', value: 'yes' },
          width: 'half',
        }),
        dateField('pt8_status_expires', 'Status Expires On', false, {
          conditional: { field: 'pt8_beneficiary_in_us', value: 'yes' },
          width: 'half',
        }),
        yesNoField(
          'pt8_previous_petition',
          'Has a previous immigrant petition been filed for this beneficiary?',
          true
        ),
      ],
    },
  ],
};
