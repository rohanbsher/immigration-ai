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

Always respond in valid JSON format.`;

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

Respond with a JSON object in this format:
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

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Respond with a JSON object in this format:
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

For each field, provide:
- value: The extracted value or null if not found
- confidence: A score from 0 to 1
- requires_verification: true if the value is unclear or uncertain

Respond with a JSON object in this format:
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

Respond with a JSON object in this format:
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

Respond with a JSON object in this format:
{
  "document_type": "bank_statement",
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

Respond with a JSON object in this format:
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
- I-130: Petition for Alien Relative
- I-485: Application to Register Permanent Residence
- I-765: Application for Employment Authorization
- N-400: Application for Naturalization

Always respond in valid JSON format.`;

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

export function getExtractionPrompt(documentType: string): string {
  const prompts: Record<string, string> = {
    passport: PASSPORT_EXTRACTION_PROMPT,
    birth_certificate: BIRTH_CERTIFICATE_EXTRACTION_PROMPT,
    marriage_certificate: MARRIAGE_CERTIFICATE_EXTRACTION_PROMPT,
    employment_letter: EMPLOYMENT_LETTER_EXTRACTION_PROMPT,
    bank_statement: BANK_STATEMENT_EXTRACTION_PROMPT,
  };

  return prompts[documentType] || GENERIC_DOCUMENT_EXTRACTION_PROMPT;
}

export function getAutofillPrompt(formType: string): string {
  const prompts: Record<string, string> = {
    'I-130': I130_AUTOFILL_PROMPT,
    'I-485': I485_AUTOFILL_PROMPT,
    'I-765': I765_AUTOFILL_PROMPT,
    'N-400': N400_AUTOFILL_PROMPT,
  };

  return prompts[formType] || I130_AUTOFILL_PROMPT;
}
