// Form G-1145: E-Notification of Application/Petition Acceptance

import {
  FormDefinition,
  requiredText,
  optionalText,
} from './types';

export const G1145_FORM: FormDefinition = {
  formType: 'G-1145',
  title: 'E-Notification of Application/Petition Acceptance',
  version: '2024-01',
  uscisFormNumber: 'G-1145',
  estimatedTime: '5 minutes',
  filingFee: 0,
  instructions: `Form G-1145 is a simple, optional form that you can attach to the front of your application or petition package. If you file this form, USCIS will send you an email and/or text message notifying you that your application or petition has been accepted. There is no filing fee for this form.`,
  sections: [
    {
      id: 'applicant_info',
      title: 'Part 1. Applicant/Petitioner Information',
      description: 'Provide your name and contact information for e-notification.',
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
      ],
    },
    {
      id: 'contact_info',
      title: 'Part 2. Contact Information',
      description: 'Provide the email address and/or mobile phone number where you want to receive the e-notification.',
      fields: [
        requiredText('email_address', 'Email Address', {
          type: 'email',
          helpText: 'USCIS will send an email notification to this address',
          width: 'full',
        }),
        optionalText('mobile_phone', 'Mobile Phone Number (for text message)', {
          type: 'phone',
          helpText: 'USCIS will send a text message notification to this number',
          width: 'half',
        }),
      ],
    },
    {
      id: 'application_info',
      title: 'Part 3. Application/Petition Information',
      description: 'Identify the application or petition this notification is for.',
      fields: [
        optionalText('form_number', 'Form Number Being Filed', {
          helpText: 'e.g., I-130, I-485, I-765',
          width: 'half',
        }),
        optionalText('applicant_name_on_form', 'Name of Applicant/Petitioner (as shown on form)', {
          width: 'full',
        }),
        optionalText('beneficiary_name', 'Name of Beneficiary (if applicable)', {
          width: 'full',
        }),
        optionalText('receipt_number', 'Receipt Number (if known)', {
          helpText: 'If you already have a receipt number for a related filing',
          width: 'half',
        }),
      ],
    },
  ],
};
