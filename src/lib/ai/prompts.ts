// AI prompt templates for document analysis and form autofill

export const DOCUMENT_ANALYSIS_SYSTEM_PROMPT = `You are an expert document analyst specializing in immigration documents. Your task is to extract information from documents with high accuracy.

Guidelines:
1. Extract all visible text and data fields
2. For each field, provide a confidence score from 0 to 1
3. Flag any fields that may need human verification
4. Identify the document type if not specified
5. Note any quality issues (blurry text, partial visibility, etc.)
6. Be conservative - if you're unsure, indicate lower confidence
7. Return null for fields that cannot be determined

Use the provided tool to return structured output.`;

export const PASSPORT_EXTRACTION_PROMPT = `Analyze this passport image and extract the following information:

Required fields:
- full_name: Complete name as shown on passport
- given_name: First/given name(s)
- surname: Family/last name
- nationality: Country of citizenship
- date_of_birth: Format as YYYY-MM-DD
- place_of_birth: City/country of birth
- passport_number: Document number
- issue_date: Format as YYYY-MM-DD
- expiry_date: Format as YYYY-MM-DD
- issuing_authority: Issuing country/authority
- sex: M, F, or X
- mrz_line_1: First line of Machine Readable Zone (if visible)
- mrz_line_2: Second line of Machine Readable Zone (if visible)

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "passport",
  "extracted_fields": [
    {
      "field_name": "full_name",
      "value": "JOHN DOE",
      "confidence": 0.95,
      "source_location": "Name field",
      "requires_verification": false
    }
  ],
  "overall_confidence": 0.90,
  "warnings": ["List any issues found"],
  "raw_text": "Optional: full text if requested"
}`;

export const BIRTH_CERTIFICATE_EXTRACTION_PROMPT = `Analyze this birth certificate and extract the following information:

Required fields:
- full_name: Complete name of the person
- date_of_birth: Format as YYYY-MM-DD
- place_of_birth: City, state/province, country
- father_name: Father's full name
- mother_name: Mother's full name (maiden name if shown)
- certificate_number: Registration/certificate number
- registration_date: Date certificate was registered (YYYY-MM-DD)
- father_date_of_birth: Father's date of birth if shown (YYYY-MM-DD), or null
- father_place_of_birth: Father's place of birth if shown, or null
- father_nationality: Father's nationality/citizenship if shown, or null
- mother_date_of_birth: Mother's date of birth if shown (YYYY-MM-DD), or null
- mother_place_of_birth: Mother's place of birth if shown, or null
- mother_maiden_name: Mother's maiden name if shown separately from mother_name, or null
- birth_city: City of birth
- birth_state: State/province of birth
- birth_country: Country of birth
- registration_number: Registration number if shown separately from certificate_number, or null

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "birth_certificate",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const MARRIAGE_CERTIFICATE_EXTRACTION_PROMPT = `Analyze this marriage certificate and extract the following information:

Required fields:
- spouse_1_name: First spouse's full name
- spouse_2_name: Second spouse's full name
- date_of_marriage: Format as YYYY-MM-DD
- place_of_marriage: City, state/province, country
- certificate_number: Registration/certificate number
- officiant_name: Name of the officiant/registrar
- marriage_city: City where the marriage took place
- marriage_state: State/province where the marriage took place
- marriage_country: Country where the marriage took place
- spouse_1_date_of_birth: First spouse's date of birth if shown (YYYY-MM-DD), or null
- spouse_2_date_of_birth: Second spouse's date of birth if shown (YYYY-MM-DD), or null

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "marriage_certificate",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const EMPLOYMENT_LETTER_EXTRACTION_PROMPT = `Analyze this employment verification letter and extract the following information:

Required fields:
- employee_name: Full name of the employee
- employer_name: Company/organization name
- job_title: Position/title held
- start_date: Employment start date (YYYY-MM-DD)
- salary: Annual salary or hourly rate with currency
- employment_type: Full-time, Part-time, Contract, etc.
- letter_date: Date the letter was written (YYYY-MM-DD)

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "employment_letter",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const BANK_STATEMENT_EXTRACTION_PROMPT = `Analyze this bank statement and extract the following information:

Required fields:
- account_holder: Name on the account
- bank_name: Financial institution name
- account_number: Last 4 digits only (for privacy)
- statement_period: Date range of the statement
- ending_balance: Closing balance with currency
- average_balance: Average daily balance if shown

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "bank_statement",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const TAX_RETURN_EXTRACTION_PROMPT = `Analyze this tax return document and extract the following information:

Required fields:
- taxpayer_name: Full name of the primary taxpayer
- spouse_name: Spouse's name (if joint return), or null
- filing_status: Single, Married Filing Jointly, Married Filing Separately, Head of Household, Qualifying Widow(er)
- tax_year: The tax year (e.g., 2024)
- form_type: Type of form (1040, 1040-NR, W-2, etc.)
- total_income: Total income/gross income with currency
- adjusted_gross_income: AGI amount with currency
- tax_paid: Total tax paid with currency
- ssn_last_four: Last 4 digits of SSN only (for privacy)
- address: Address shown on the return
- filing_address_street: Street address from the return
- filing_address_city: City from the filing address
- filing_address_state: State from the filing address
- filing_address_zip: ZIP code from the filing address
- self_employment_income: Schedule C net profit if present, or null

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "tax_return",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const MEDICAL_EXAM_EXTRACTION_PROMPT = `Analyze this medical examination document (Form I-693 or equivalent) and extract the following information:

Required fields:
- patient_name: Full name of the patient/applicant
- date_of_birth: Format as YYYY-MM-DD
- examination_date: Date of the medical exam (YYYY-MM-DD)
- physician_name: Name of the civil surgeon/physician
- physician_address: Physician's practice address
- vaccination_status: Complete, Incomplete, or list of missing vaccinations
- tb_test_result: Negative, Positive, or further testing required
- mental_health_status: No issues found, or description of findings
- substance_abuse_status: No issues found, or description of findings
- form_number: I-693 or other form identifier
- expiration_date: When the exam results expire (YYYY-MM-DD)

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "medical_exam",
  "extracted_fields": [...],
  "overall_confidence": 0.80,
  "warnings": []
}`;

export const POLICE_CLEARANCE_EXTRACTION_PROMPT = `Analyze this police clearance certificate and extract the following information:

Required fields:
- subject_name: Full name of the person
- date_of_birth: Format as YYYY-MM-DD
- issuing_authority: Police department/agency name
- issuing_country: Country that issued the certificate
- issue_date: Date of issuance (YYYY-MM-DD)
- certificate_number: Reference/certificate number
- result: Clear/No record, or details of records found
- coverage_period: Time period covered by the clearance

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "police_clearance",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const DIVORCE_CERTIFICATE_EXTRACTION_PROMPT = `Analyze this divorce certificate/decree and extract the following information:

Required fields:
- spouse_1_name: First spouse's full name
- spouse_2_name: Second spouse's full name
- date_of_divorce: Date the divorce was finalized (YYYY-MM-DD)
- place_of_divorce: Court/jurisdiction where divorce was granted
- case_number: Court case number
- date_of_marriage: Original marriage date if shown (YYYY-MM-DD)
- court_name: Name of the issuing court

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "divorce_certificate",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const UTILITY_BILL_EXTRACTION_PROMPT = `Analyze this utility bill, lease agreement, or proof of residence and extract the following information:

Required fields:
- account_holder_name: Full name of the account holder or lessee
- service_address_street: Street address where service is provided
- service_address_apt: Apartment/unit number if any
- service_address_city: City
- service_address_state: State
- service_address_zip: ZIP code
- service_address_country: Country (default "United States" if not shown)
- bill_date: Date of the bill or lease start date (YYYY-MM-DD)
- service_start_date: When service started at this address, if shown (YYYY-MM-DD)
- service_end_date: When service ended at this address, if shown (YYYY-MM-DD), or null if current
- document_subtype: Type of document — "utility_bill", "lease", "mortgage_statement", "bank_statement_with_address"
- utility_provider: Name of utility company or landlord

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "utility_bill",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const GENERIC_DOCUMENT_EXTRACTION_PROMPT = `Analyze this document and extract all relevant information.

1. First, identify the document type
2. Extract all visible text fields and their values
3. Note any dates, numbers, names, or addresses
4. Identify any official stamps, signatures, or seals

For each field found, provide:
- field_name: A descriptive name for the field
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "identified_type",
  "extracted_fields": [...],
  "overall_confidence": 0.80,
  "warnings": []
}`;

// Form autofill prompts using Claude for reasoning

export const FORM_AUTOFILL_SYSTEM_PROMPT = `You are an expert immigration attorney assistant. Your task is to help fill out USCIS immigration forms based on extracted document data.

Guidelines:
1. Map extracted data to the correct form fields
2. Apply appropriate formatting for each field type
3. Flag fields that need attorney review
4. Identify any missing required documents
5. Note any potential issues or inconsistencies
6. Be conservative - only fill fields where you have high confidence

Common form types:
- I-129: Petition for a Nonimmigrant Worker
- I-130: Petition for Alien Relative
- I-131: Application for Travel Document
- I-140: Immigrant Petition for Alien Workers
- I-485: Application to Register Permanent Residence
- I-539: Application to Extend/Change Nonimmigrant Status
- I-765: Application for Employment Authorization
- I-20: Certificate of Eligibility for Student Visa
- DS-160: Online Nonimmigrant Visa Application
- N-400: Application for Naturalization
- G-1145: E-Notification of Application/Petition Acceptance

Use the provided tool to return structured output.`;

export const I130_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the I-130 (Petition for Alien Relative) form fields.

Key fields to map:
- Petitioner information (US citizen/LPR)
- Beneficiary information (relative being petitioned)
- Relationship to beneficiary
- Marriage information (if applicable)
- Address history
- Employment history

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "I-130",
  "fields": [...],
  "overall_confidence": 0.85,
  "missing_documents": ["List any documents needed but not provided"],
  "warnings": ["Any issues found"]
}`;

export const I485_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the I-485 (Application to Register Permanent Residence) form fields.

Key fields to map:
- Applicant biographical information
- Immigration history
- Address history (5 years)
- Employment history (5 years)
- Family information
- Travel history

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "I-485",
  "fields": [...],
  "overall_confidence": 0.85,
  "missing_documents": [],
  "warnings": []
}`;

export const I765_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the I-765 (Application for Employment Authorization) form fields.

Key fields to map:
- Applicant information
- Current immigration status
- Eligibility category
- Previous EAD information (if any)

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "I-765",
  "fields": [...],
  "overall_confidence": 0.85,
  "missing_documents": [],
  "warnings": []
}`;

export const N400_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the N-400 (Application for Naturalization) form fields.

Key fields to map:
- Applicant information
- Residency history
- Employment history
- Marital history
- Children information
- Travel history

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "N-400",
  "fields": [...],
  "overall_confidence": 0.85,
  "missing_documents": [],
  "warnings": []
}`;

export const I131_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the I-131 (Application for Travel Document) form fields.

Key fields to map:
- Applicant information (name, DOB, citizenship)
- Immigration status (LPR, refugee, asylee, DACA, TPS)
- Travel document type requested (reentry permit, refugee travel document, advance parole)
- Travel plans (countries, purpose, departure/return dates)
- Previous travel documents issued
- I-485 pending status (if applicable)

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "I-131",
  "fields": [...],
  "overall_confidence": 0.85,
  "missing_documents": [],
  "warnings": []
}`;

export const I140_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the I-140 (Immigrant Petition for Alien Workers) form fields.

Key fields to map:
- Petitioner (employer) information
- Beneficiary (worker) information
- Job offer details (title, duties, requirements, salary)
- Immigrant category (EB-1A, EB-1B, EB-1C, EB-2, EB-2 NIW, EB-3)
- Labor certification information (if applicable)
- Beneficiary education and qualifications
- Prevailing wage information

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "I-140",
  "fields": [...],
  "overall_confidence": 0.80,
  "missing_documents": [],
  "warnings": []
}`;

export const I94_EXTRACTION_PROMPT = `Analyze this I-94 Arrival/Departure Record and extract the following information:

Required fields:
- full_name: Complete name as shown on the I-94
- i94_number: The 11-digit I-94 admission number
- admission_date: Date of admission/arrival (YYYY-MM-DD)
- class_of_admission: Nonimmigrant class (e.g., B-1, F-1, H-1B, L-1)
- admitted_until: Date status expires or "D/S" for Duration of Status
- port_of_entry: City/airport where admitted
- passport_number: Passport number associated with this record
- country_of_citizenship: Country of citizenship
- date_of_birth: Format as YYYY-MM-DD
- travel_document_number: Travel document number if different from passport number, or null
- gender: Gender as shown on the I-94 (M or F), or null
- prior_entries: Summary of prior U.S. entries if travel history is shown (e.g., "3 prior entries, most recent: 2024-01-15 via JFK"), or null

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "i94",
  "extracted_fields": [...],
  "overall_confidence": 0.90,
  "warnings": []
}`;

export const W2_EXTRACTION_PROMPT = `Analyze this W-2 Wage and Tax Statement and extract the following information:

Required fields:
- employee_name: Employee's full name (Box e)
- employee_ssn_last_four: Last 4 digits of SSN only (Box a, for privacy)
- employer_name: Employer's name (Box c)
- employer_ein: Employer's EIN (Box b)
- employer_address: Employer's address (Box c)
- wages_tips: Wages, tips, other compensation (Box 1)
- federal_tax_withheld: Federal income tax withheld (Box 2)
- social_security_wages: Social security wages (Box 3)
- social_security_tax: Social security tax withheld (Box 4)
- medicare_wages: Medicare wages and tips (Box 5)
- medicare_tax: Medicare tax withheld (Box 6)
- state: State abbreviation (Box 15)
- state_wages: State wages, tips, etc. (Box 16)
- state_tax_withheld: State income tax (Box 17)
- tax_year: Tax year for this W-2
- employment_start_date: Approximate employment start date if determinable (YYYY-MM-DD), or null
- employment_end_date: Approximate employment end date (YYYY-MM-DD), or "present" if current
- employer_city: City from employer address (Box c)
- employer_state: State from employer address (Box c)
- employer_zip: ZIP code from employer address (Box c)
- employer_country: Country of employer (default "United States" if not shown)

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "w2",
  "extracted_fields": [...],
  "overall_confidence": 0.90,
  "warnings": []
}`;

export const PAY_STUB_EXTRACTION_PROMPT = `Analyze this pay stub and extract the following information:

Required fields:
- employee_name: Full name of the employee
- employer_name: Company/organization name
- pay_period_start: Start date of pay period (YYYY-MM-DD)
- pay_period_end: End date of pay period (YYYY-MM-DD)
- pay_date: Date of payment (YYYY-MM-DD)
- gross_pay: Gross pay amount for this period
- net_pay: Net pay (take-home) amount
- federal_tax: Federal tax withheld this period
- state_tax: State tax withheld this period
- ytd_gross: Year-to-date gross earnings
- ytd_net: Year-to-date net earnings
- hourly_rate: Hourly rate if applicable, or null
- hours_worked: Hours worked this period if applicable
- pay_frequency: Weekly, Biweekly, Semi-Monthly, Monthly

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "pay_stub",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const DIPLOMA_EXTRACTION_PROMPT = `Analyze this diploma or degree certificate and extract the following information:

Required fields:
- graduate_name: Full name of the graduate
- institution_name: Name of the educational institution
- institution_address: Address or location of the institution
- degree_type: Type of degree (Bachelor of Science, Master of Arts, Ph.D., etc.)
- field_of_study: Major or field of study
- graduation_date: Date of graduation or degree conferral (YYYY-MM-DD)
- honors: Any honors (cum laude, magna cum laude, summa cum laude), or null
- institution_country: Country where the institution is located
- accreditation: Accreditation body if mentioned, or null
- diploma_number: Certificate or diploma number if shown
- institution_city: City where the institution is located
- institution_state: State/province where the institution is located

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "diploma",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;

export const TRANSCRIPT_EXTRACTION_PROMPT = `Analyze this academic transcript and extract the following information:

Required fields:
- student_name: Full name of the student
- student_id: Student identification number if shown
- institution_name: Name of the educational institution
- institution_country: Country where the institution is located
- degree_program: Degree program (e.g., B.S. Computer Science)
- enrollment_date: Date of first enrollment (YYYY-MM-DD)
- graduation_date: Graduation or expected graduation date (YYYY-MM-DD), or null
- cumulative_gpa: Cumulative GPA and scale (e.g., "3.75/4.0")
- total_credits: Total credits earned
- degree_status: Conferred, In Progress, or Withdrawn
- courses: Summary of key courses (list up to 10 relevant courses with grades)
- institution_city: City where the institution is located
- institution_state: State/province where the institution is located
- institution_country: Country where the institution is located (if not already captured above)
- enrollment_start_date: Date enrollment began (YYYY-MM-DD), or null
- enrollment_end_date: Date enrollment ended or expected to end (YYYY-MM-DD), or null

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "transcript",
  "extracted_fields": [...],
  "overall_confidence": 0.80,
  "warnings": []
}`;

export const RECOMMENDATION_LETTER_EXTRACTION_PROMPT = `Analyze this recommendation or reference letter and extract the following information:

Required fields:
- subject_name: Name of the person being recommended
- recommender_name: Full name of the letter writer
- recommender_title: Title/position of the recommender
- recommender_organization: Organization/company of the recommender
- recommender_relationship: Professional relationship to the subject (supervisor, colleague, professor, etc.)
- letter_date: Date the letter was written (YYYY-MM-DD)
- years_known: How long the recommender has known the subject
- key_achievements: List of key achievements or qualifications mentioned
- field_of_expertise: Subject's field of expertise as described
- contact_info: Recommender's contact information if provided

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "recommendation_letter",
  "extracted_fields": [...],
  "overall_confidence": 0.75,
  "warnings": []
}`;

export const PHOTO_VALIDATION_PROMPT = `Analyze this photograph for immigration document compliance and extract the following information:

Required fields:
- face_visible: Whether a clear face is visible (true/false)
- face_centered: Whether the face is centered in the frame (true/false)
- background_color: Background color (white, off-white, other)
- background_uniform: Whether the background is uniform/plain (true/false)
- eyes_open: Whether both eyes are open and visible (true/false)
- glasses_present: Whether the subject is wearing glasses (true/false)
- head_covering: Whether there is a head covering (true/false, note if religious)
- expression_neutral: Whether the expression is neutral (true/false)
- image_quality: Sharp, Slightly Blurry, or Blurry
- lighting_adequate: Whether lighting is adequate and even (true/false)
- shadows_on_face: Whether there are shadows on the face (true/false)
- estimated_dimensions: Estimated aspect ratio (should be close to 2x2 inches / 51x51mm)
- overall_compliance: Compliant, Minor Issues, or Non-Compliant

For each field, provide:
- value: The extracted value or null if not determined
- confidence: A score from 0 to 1
- requires_verification: true if the assessment is uncertain

Return the extracted data via the tool with this structure:
{
  "document_type": "photo",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": ["List any compliance issues found"]
}`;

export function getExtractionPrompt(documentType: string): string {
  const prompts: Record<string, string> = {
    passport: PASSPORT_EXTRACTION_PROMPT,
    birth_certificate: BIRTH_CERTIFICATE_EXTRACTION_PROMPT,
    marriage_certificate: MARRIAGE_CERTIFICATE_EXTRACTION_PROMPT,
    employment_letter: EMPLOYMENT_LETTER_EXTRACTION_PROMPT,
    bank_statement: BANK_STATEMENT_EXTRACTION_PROMPT,
    tax_return: TAX_RETURN_EXTRACTION_PROMPT,
    medical_exam: MEDICAL_EXAM_EXTRACTION_PROMPT,
    police_clearance: POLICE_CLEARANCE_EXTRACTION_PROMPT,
    divorce_certificate: DIVORCE_CERTIFICATE_EXTRACTION_PROMPT,
    i94: I94_EXTRACTION_PROMPT,
    w2: W2_EXTRACTION_PROMPT,
    pay_stub: PAY_STUB_EXTRACTION_PROMPT,
    diploma: DIPLOMA_EXTRACTION_PROMPT,
    transcript: TRANSCRIPT_EXTRACTION_PROMPT,
    recommendation_letter: RECOMMENDATION_LETTER_EXTRACTION_PROMPT,
    photo: PHOTO_VALIDATION_PROMPT,
    utility_bill: UTILITY_BILL_EXTRACTION_PROMPT,
  };

  return prompts[documentType] || GENERIC_DOCUMENT_EXTRACTION_PROMPT;
}

export const I129_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the I-129 (Petition for a Nonimmigrant Worker) form fields.

Key fields to map:
- Petitioner (employer) information (company name, EIN, address, financials)
- Beneficiary (worker) information (name, DOB, citizenship, passport)
- Nonimmigrant classification requested (H-1B, L-1, O-1, etc.)
- Job offer details (title, description, SOC code, work location)
- Wages (offered wage, prevailing wage, hours per week)
- Labor Condition Application details (for H-1B)
- Requested period of stay

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "I-129",
  "fields": [...],
  "overall_confidence": 0.80,
  "missing_documents": [],
  "warnings": []
}`;

export const I539_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the I-539 (Application to Extend/Change Nonimmigrant Status) form fields.

Key fields to map:
- Applicant information (name, DOB, citizenship, passport)
- Current nonimmigrant status and expiration date
- Requested status (extension or change)
- I-94 arrival/departure information
- Reason for extension or change of status
- Co-applicant/dependent information (if any)
- Employment information (if applicable)

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "I-539",
  "fields": [...],
  "overall_confidence": 0.85,
  "missing_documents": [],
  "warnings": []
}`;

export const I20_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the I-20 (Certificate of Eligibility for Nonimmigrant Student Status) form fields.

Key fields to map:
- School information (name, code, address, DSO)
- Student information (name, DOB, citizenship, passport, SEVIS ID)
- Admission category (F-1 or M-1)
- Program details (name, degree level, start/end dates)
- Financial information (tuition, living expenses, funding sources)

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "I-20",
  "fields": [...],
  "overall_confidence": 0.80,
  "missing_documents": [],
  "warnings": []
}`;

export const DS160_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the DS-160 (Online Nonimmigrant Visa Application) form fields.

Key fields to map:
- Personal information (name, DOB, birth place, sex, marital status)
- Nationality and identification numbers
- Passport details (number, issuing country, dates)
- Travel plans (visa type, arrival date, U.S. address)
- U.S. point of contact
- Family information (parents, relatives in U.S.)
- Work and education history
- Security and background questions

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "DS-160",
  "fields": [...],
  "overall_confidence": 0.75,
  "missing_documents": [],
  "warnings": []
}`;

export const G1145_AUTOFILL_PROMPT = `Based on the provided extracted document data, fill out the G-1145 (E-Notification of Application/Petition Acceptance) form fields.

Key fields to map:
- Applicant/petitioner name
- Email address for notification
- Mobile phone number for text notification
- Form number being filed
- Beneficiary name (if applicable)

For each field, provide:
- field_id: The form field identifier
- field_name: Human-readable field name
- suggested_value: The value to fill
- confidence: Score from 0 to 1
- source_document: Which document provided this data
- requires_review: true if attorney should verify

Respond with JSON:
{
  "form_type": "G-1145",
  "fields": [...],
  "overall_confidence": 0.95,
  "missing_documents": [],
  "warnings": []
}`;

export function getAutofillPrompt(formType: string): string {
  const prompts: Record<string, string> = {
    'I-129': I129_AUTOFILL_PROMPT,
    'I-130': I130_AUTOFILL_PROMPT,
    'I-131': I131_AUTOFILL_PROMPT,
    'I-140': I140_AUTOFILL_PROMPT,
    'I-485': I485_AUTOFILL_PROMPT,
    'I-539': I539_AUTOFILL_PROMPT,
    'I-765': I765_AUTOFILL_PROMPT,
    'I-20': I20_AUTOFILL_PROMPT,
    'DS-160': DS160_AUTOFILL_PROMPT,
    'N-400': N400_AUTOFILL_PROMPT,
    'G-1145': G1145_AUTOFILL_PROMPT,
  };

  return prompts[formType] || FORM_AUTOFILL_SYSTEM_PROMPT;
}
