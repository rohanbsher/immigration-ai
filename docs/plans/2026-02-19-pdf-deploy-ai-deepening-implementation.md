# PDF Deployment + AI Extraction Deepening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy filing-ready PDF generation and increase AI autofill coverage from 30-50% to 60-70% across 7 USCIS forms.

**Architecture:** 3 phases — (1) deploy Railway PDF microservice, (2) deepen AI extraction prompts + add array model for repeatable sections + update field mappings, (3) add smart document prompting that tells attorneys what to upload.

**Tech Stack:** Railway (Docker), Python/FastAPI/pikepdf (PDF service), Claude structured output (extraction), TypeScript/Next.js (app)

---

## Phase 1: Deploy Railway PDF Service

### Task 1: Deploy PDF service to Railway

**Files:**
- No code changes — infrastructure only

**Step 1: Add pdf-service to Railway project**

```bash
# Login to Railway (if needed)
railway login

# Link to the splendid-flow project
railway link --project 43380856-f300-444d-a9ea-dd990f938d65

# Create a new service called pdf-service
railway service create pdf-service
```

If the CLI doesn't support `service create`, use the Railway dashboard:
- Go to splendid-flow project → "New Service" → "Deploy from repo"
- Root directory: `services/pdf-service`
- Dockerfile path: `services/pdf-service/Dockerfile`

**Step 2: Set Railway env vars**

```bash
# Switch to the pdf-service
railway service pdf-service

# Set the shared secret (use the value from .env.production)
railway variables set PDF_SERVICE_SECRET=50460fabcdfe7d6f14abeb024e09539f
railway variables set PORT=8000
```

**Step 3: Trigger deploy and verify health**

```bash
# After deployment completes, get the public URL
railway status

# Test health endpoint
curl https://<pdf-service-url>/health
```

Expected response:
```json
{"status": "ok", "pikepdf_version": "9.0.0", "templates": ["G-1145","I-130","I-131","I-140","I-485","I-765","N-400"]}
```

**Step 4: Set Vercel env vars**

```bash
# Use printf to avoid trailing newline bug
printf 'https://<pdf-service-url>' | vercel env add PDF_SERVICE_URL production
printf '50460fabcdfe7d6f14abeb024e09539f' | vercel env add PDF_SERVICE_SECRET production
```

**Step 5: Trigger Vercel redeploy and verify end-to-end**

```bash
vercel --prod
```

Test: Log into the app → open a case with an I-130 form → click Download PDF → verify you get an official USCIS PDF (not a DRAFT summary).

**Step 6: Commit (no code changes — just document the deployment)**

```bash
git commit --allow-empty -m "deploy: Railway PDF service live, Vercel env vars set"
```

---

## Phase 2: Deepen AI Extraction + Field Mapping

### Task 2: Add repeatable section types

**Files:**
- Modify: `src/types/index.ts`
- Test: `src/types/index.test.ts` (if exists, else skip)

**Step 1: Add types to `src/types/index.ts`**

Add after the existing `DocumentType` type (around line 56):

```typescript
/** Entry in a 5-year address history (repeatable section on USCIS forms). */
export interface AddressHistoryEntry {
  street: string;
  apt?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  from_date: string;   // YYYY-MM format
  to_date: string;     // YYYY-MM or "present"
}

/** Entry in employment history (repeatable section on USCIS forms). */
export interface EmploymentHistoryEntry {
  employer_name: string;
  employer_address?: string;
  employer_city?: string;
  employer_state?: string;
  employer_zip?: string;
  employer_country?: string;
  job_title: string;
  from_date: string;   // YYYY-MM format
  to_date: string;     // YYYY-MM or "present"
  duties?: string;
}

/** Entry in education history. */
export interface EducationHistoryEntry {
  institution_name: string;
  institution_city?: string;
  institution_state?: string;
  institution_country?: string;
  degree_type: string;
  field_of_study: string;
  graduation_date: string;  // YYYY-MM format
  gpa?: string;
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add AddressHistoryEntry, EmploymentHistoryEntry, EducationHistoryEntry types"
```

---

### Task 3: Enhance extraction prompts for deeper data

**Files:**
- Modify: `src/lib/ai/prompts.ts` (lines 488-518 for W2, 149-170 for tax, 55-76 for birth cert, 79-110 for marriage cert, 462-486 for I-94, 551-576 for diploma, 578-610 for transcript)

**Step 1: Enhance W2_EXTRACTION_PROMPT (line 488)**

Replace the existing prompt with a deeper version that also extracts employment dates and employer details for building employment history. Add fields:
- `employment_start_date`: Approximate start (can derive from tax year if first W-2)
- `employment_end_date`: Approximate end or "present"
- `employer_city`: City from employer address
- `employer_state`: State from employer address
- `employer_zip`: ZIP from employer address

**Step 2: Enhance TAX_RETURN_EXTRACTION_PROMPT (line 149)**

Add fields for:
- `filing_address_street`: Home address on return
- `filing_address_city`: City
- `filing_address_state`: State
- `filing_address_zip`: ZIP
- `tax_year`: Year of filing (for placing in timeline)
- `spouse_name`: If married filing jointly
- `self_employment_income`: Schedule C net profit (if applicable)

**Step 3: Add UTILITY_BILL_EXTRACTION_PROMPT (new — after line 610)**

This is a **new prompt** — utility bills / lease agreements don't have extraction prompts yet.

```typescript
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

Respond with a JSON object in this format:
{
  "document_type": "utility_bill",
  "extracted_fields": [...],
  "overall_confidence": 0.85,
  "warnings": []
}`;
```

**Step 4: Enhance BIRTH_CERTIFICATE_EXTRACTION_PROMPT (line 55)**

Add fields for parents' full details:
- `father_date_of_birth`: Father's DOB
- `father_place_of_birth`: Father's birthplace (city, state/country)
- `father_nationality`: Father's nationality/citizenship
- `mother_date_of_birth`: Mother's DOB
- `mother_place_of_birth`: Mother's birthplace
- `mother_maiden_name`: Mother's maiden name
- `birth_city`: City of birth
- `birth_state`: State/province
- `birth_country`: Country of birth
- `registration_number`: Certificate/registration number

**Step 5: Enhance MARRIAGE_CERTIFICATE_EXTRACTION_PROMPT (line 79)**

Add fields:
- `marriage_city`: City where married
- `marriage_state`: State/province
- `marriage_country`: Country
- `officiant_name`: Name of officiant (if shown)
- `spouse_1_date_of_birth`: First spouse DOB
- `spouse_2_date_of_birth`: Second spouse DOB
- `certificate_number`: Certificate number

**Step 6: Enhance I94_EXTRACTION_PROMPT (line 462)**

Add fields for prior entry history:
- `travel_document_number`: Travel document number (may differ from passport)
- `gender`: M or F
- `prior_entries`: Array of previous entries if this is an extended I-94 history (most online I-94s show travel history)

**Step 7: Enhance DIPLOMA_EXTRACTION_PROMPT (line 551) and TRANSCRIPT_EXTRACTION_PROMPT (line 578)**

Add to diploma:
- `institution_city`: City of institution
- `institution_state`: State/province
- `institution_country`: Country

Add to transcript:
- `institution_city`, `institution_state`, `institution_country`
- `enrollment_start_date`: When student started
- `enrollment_end_date`: When student finished

**Step 8: Register utility_bill in getExtractionPrompt() (line 663)**

Add a new case for `'utility_bill'` that returns `UTILITY_BILL_EXTRACTION_PROMPT`.

**Step 9: Add 'utility_bill' to DocumentType union in `src/types/index.ts` (line 36)**

**Step 10: Verify build**

```bash
npx tsc --noEmit
```

**Step 11: Commit**

```bash
git add src/lib/ai/prompts.ts src/types/index.ts
git commit -m "feat: deepen extraction prompts for W-2, tax, birth/marriage cert, I-94, diploma, transcript; add utility_bill prompt"
```

---

### Task 4: Update field mappings for new extracted fields

**Files:**
- Modify: `src/lib/ai/form-autofill.ts:271-483` (mapExtractedFieldToFormField)
- Modify: `src/lib/ai/form-autofill.ts:164-256` (getRequiredDocuments)

**Step 1: Expand mapExtractedFieldToFormField (line 271)**

For each form's mapping object, add new field mappings from the enhanced extraction prompts. Key additions:

**I-485 additions:**
```typescript
// From utility bills — address history
service_address_street: 'pt3_current_address_street',
service_address_city: 'pt3_current_address_city',
service_address_state: 'pt3_current_address_state',
service_address_zip: 'pt3_current_address_zip',
// From W-2 — employment history
employer_address: 'pt4_employer_address',
employer_ein: 'pt4_employer_ein',
// From birth cert — enhanced
birth_city: 'pt1_pob_city',
birth_country: 'pt1_country_of_birth',
// From marriage cert — enhanced
marriage_city: 'pt3_marriage_city',
marriage_state: 'pt3_marriage_state',
marriage_country: 'pt3_marriage_country',
```

**N-400 additions:**
```typescript
// From utility bills
service_address_street: 'pt2_current_address_street',
service_address_city: 'pt2_current_address_city',
service_address_state: 'pt2_current_address_state',
service_address_zip: 'pt2_current_address_zip',
// From tax returns
filing_address_street: 'pt2_current_address_street',
spouse_name: 'pt3_spouse_name',
// From W-2
employer_address: 'pt4_employer_address',
```

**I-130 additions:**
```typescript
// From birth cert
father_date_of_birth: 'pt3_father_dob',
mother_date_of_birth: 'pt3_mother_dob',
mother_maiden_name: 'pt3_mother_maiden_name',
// From marriage cert
marriage_city: 'pt2_marriage_city',
marriage_state: 'pt2_marriage_state',
marriage_country: 'pt2_marriage_country',
```

**I-140 additions:**
```typescript
// From diploma/transcript
institution_city: 'pt7_institution_city',
institution_state: 'pt7_institution_state',
institution_country: 'pt7_institution_country',
enrollment_start_date: 'pt7_study_start_date',
// From W-2
employer_ein: 'pt1_employer_ein',
employer_address: 'pt1_employer_address',
```

Apply similar patterns for I-765, I-131, and G-1145 where applicable.

**Step 2: Update getRequiredDocuments (line 164)**

Add utility bills / lease documents to forms that need address history:

```typescript
'I-485': [
  // ... existing items ...
  'Utility bills or lease agreements (last 5 years) — for address history',
  'W-2 forms (last 5 years) — for employment history',
],
'N-400': [
  // ... existing items ...
  'Utility bills or lease agreements (last 5 years)',
  'W-2 forms (last 5 years)',
],
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/ai/form-autofill.ts
git commit -m "feat: expand field mappings for address, employment, family, education data"
```

---

### Task 5: Add array-based autofill for repeatable sections

**Files:**
- Modify: `src/lib/ai/form-autofill.ts:34-140` (autofillForm function)
- Modify: `src/lib/ai/anthropic.ts:32-91` (generateFormAutofill)
- Create: `src/lib/ai/history-builder.ts` (new — builds address/employment arrays from multiple documents)

**Step 1: Create history-builder.ts**

This module takes multiple document extractions and builds sorted arrays:

```typescript
// src/lib/ai/history-builder.ts

import type { AddressHistoryEntry, EmploymentHistoryEntry, EducationHistoryEntry } from '@/types';
import type { DocumentAnalysisResult } from './types';

/**
 * Build address history from utility bills, leases, and tax returns.
 * Sorts by from_date descending (most recent first, as USCIS requires).
 */
export function buildAddressHistory(
  documents: DocumentAnalysisResult[]
): AddressHistoryEntry[] {
  const entries: AddressHistoryEntry[] = [];

  for (const doc of documents) {
    if (!doc.extracted_fields) continue;
    const fields = toFieldMap(doc.extracted_fields);

    // Utility bills / leases have service_address_* fields
    if (fields.service_address_street) {
      entries.push({
        street: fields.service_address_street,
        apt: fields.service_address_apt || undefined,
        city: fields.service_address_city || '',
        state: fields.service_address_state || '',
        zip: fields.service_address_zip || '',
        country: fields.service_address_country || 'United States',
        from_date: fields.service_start_date || fields.bill_date?.slice(0, 7) || '',
        to_date: fields.service_end_date?.slice(0, 7) || 'present',
      });
    }

    // Tax returns have filing_address_* fields
    if (fields.filing_address_street) {
      entries.push({
        street: fields.filing_address_street,
        city: fields.filing_address_city || '',
        state: fields.filing_address_state || '',
        zip: fields.filing_address_zip || '',
        country: 'United States',
        from_date: `${fields.tax_year || ''}-01`,
        to_date: `${fields.tax_year || ''}-12`,
      });
    }
  }

  // Deduplicate by street+city, merge date ranges
  return deduplicateAndSort(entries);
}

/**
 * Build employment history from W-2s, pay stubs, and employment letters.
 */
export function buildEmploymentHistory(
  documents: DocumentAnalysisResult[]
): EmploymentHistoryEntry[] {
  const entries: EmploymentHistoryEntry[] = [];

  for (const doc of documents) {
    if (!doc.extracted_fields) continue;
    const fields = toFieldMap(doc.extracted_fields);

    if (fields.employer_name) {
      entries.push({
        employer_name: fields.employer_name,
        employer_address: fields.employer_address || undefined,
        employer_city: fields.employer_city || undefined,
        employer_state: fields.employer_state || undefined,
        job_title: fields.job_title || '',
        from_date: fields.employment_start_date || fields.tax_year ? `${fields.tax_year}-01` : '',
        to_date: fields.employment_end_date || 'present',
      });
    }
  }

  return deduplicateAndSort(entries);
}

/**
 * Build education history from diplomas and transcripts.
 */
export function buildEducationHistory(
  documents: DocumentAnalysisResult[]
): EducationHistoryEntry[] {
  const entries: EducationHistoryEntry[] = [];

  for (const doc of documents) {
    if (!doc.extracted_fields) continue;
    const fields = toFieldMap(doc.extracted_fields);

    if (fields.institution_name && (fields.degree_type || fields.degree_program)) {
      entries.push({
        institution_name: fields.institution_name,
        institution_city: fields.institution_city || undefined,
        institution_country: fields.institution_country || undefined,
        degree_type: fields.degree_type || fields.degree_program || '',
        field_of_study: fields.field_of_study || '',
        graduation_date: fields.graduation_date?.slice(0, 7) || '',
        gpa: fields.cumulative_gpa || undefined,
      });
    }
  }

  return entries.sort((a, b) => b.graduation_date.localeCompare(a.graduation_date));
}

/** Convert extracted_fields array to a flat Record for easy access. */
function toFieldMap(fields: { field_name: string; value: string | null }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    if (f.value) map[f.field_name] = f.value;
  }
  return map;
}

/** Deduplicate entries by address/employer and sort by from_date descending. */
function deduplicateAndSort<T extends { from_date: string; to_date: string }>(
  entries: T[]
): T[] {
  // Simple dedup: keep the entry with the broader date range for duplicate locations
  const seen = new Map<string, T>();
  for (const entry of entries) {
    const key = JSON.stringify({ ...entry, from_date: '', to_date: '' });
    const existing = seen.get(key);
    if (!existing || entry.from_date < existing.from_date) {
      seen.set(key, entry);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.from_date.localeCompare(a.from_date));
}
```

**Step 2: Integrate history builder into autofillForm (form-autofill.ts:34)**

After the existing mapping step (around line 90), add:

```typescript
import { buildAddressHistory, buildEmploymentHistory, buildEducationHistory } from './history-builder';

// Inside autofillForm, after generating field suggestions:
const addressHistory = buildAddressHistory(input.documentAnalyses);
const employmentHistory = buildEmploymentHistory(input.documentAnalyses);
const educationHistory = buildEducationHistory(input.documentAnalyses);

// Attach to result as extra data
result.address_history = addressHistory;
result.employment_history = employmentHistory;
result.education_history = educationHistory;
```

**Step 3: Update FormAutofillResult type**

In `src/lib/ai/types.ts`, add optional array fields to the result type:

```typescript
address_history?: AddressHistoryEntry[];
employment_history?: EmploymentHistoryEntry[];
education_history?: EducationHistoryEntry[];
```

**Step 4: Write tests for history-builder.ts**

Create `src/lib/ai/history-builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildAddressHistory, buildEmploymentHistory, buildEducationHistory } from './history-builder';

describe('buildAddressHistory', () => {
  it('extracts addresses from utility bills', () => { /* ... */ });
  it('extracts addresses from tax returns', () => { /* ... */ });
  it('deduplicates same address from multiple bills', () => { /* ... */ });
  it('sorts by from_date descending', () => { /* ... */ });
  it('returns empty array when no address data', () => { /* ... */ });
});

describe('buildEmploymentHistory', () => {
  it('extracts employment from W-2s', () => { /* ... */ });
  it('deduplicates same employer across years', () => { /* ... */ });
  it('sorts by from_date descending', () => { /* ... */ });
});

describe('buildEducationHistory', () => {
  it('extracts education from diplomas', () => { /* ... */ });
  it('extracts education from transcripts', () => { /* ... */ });
});
```

**Step 5: Run tests**

```bash
npx vitest run src/lib/ai/history-builder.test.ts
```

**Step 6: Verify build**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/lib/ai/history-builder.ts src/lib/ai/history-builder.test.ts src/lib/ai/form-autofill.ts src/lib/ai/types.ts
git commit -m "feat: add history-builder for address, employment, education arrays from documents"
```

---

### Task 6: Add flattenRepeatingFields for PDF generation

**Files:**
- Modify: `src/lib/pdf/xfa-filler.ts:30-57` (buildFieldData)
- Modify: `src/lib/pdf/uscis-fields/i-485.ts` (add address/employment XFA field names)
- Modify: `src/lib/pdf/uscis-fields/n-400.ts` (add address/employment XFA field names)

**Step 1: Add flattenRepeatingFields to xfa-filler.ts**

Add before `buildFieldData`:

```typescript
/**
 * Flatten array-based repeatable sections into numbered flat fields
 * that map to USCIS XFA field names.
 *
 * Example: address_history[0].street → addressHistory.0.street
 *
 * The actual XFA field names are handled by the field maps — this just
 * puts the array data into the formData object with numbered keys.
 */
export function flattenRepeatingFields(
  formData: Record<string, unknown>
): Record<string, unknown> {
  const flattened = { ...formData };

  // Flatten address_history array
  const addresses = formData.address_history as Array<Record<string, string>> | undefined;
  if (Array.isArray(addresses)) {
    addresses.forEach((addr, i) => {
      Object.entries(addr).forEach(([key, value]) => {
        flattened[`address_history_${i}_${key}`] = value;
      });
    });
  }

  // Flatten employment_history array
  const employment = formData.employment_history as Array<Record<string, string>> | undefined;
  if (Array.isArray(employment)) {
    employment.forEach((emp, i) => {
      Object.entries(emp).forEach(([key, value]) => {
        flattened[`employment_history_${i}_${key}`] = value;
      });
    });
  }

  // Flatten education_history array
  const education = formData.education_history as Array<Record<string, string>> | undefined;
  if (Array.isArray(education)) {
    education.forEach((edu, i) => {
      Object.entries(edu).forEach(([key, value]) => {
        flattened[`education_history_${i}_${key}`] = value;
      });
    });
  }

  return flattened;
}
```

**Step 2: Call flattenRepeatingFields in buildFieldData**

Update `buildFieldData` (line 30) to flatten before mapping:

```typescript
export function buildFieldData(
  fieldMaps: AcroFormFieldMap[],
  formData: Record<string, unknown>
): { fieldData: Record<string, string>; skippedFields: string[] } {
  // Flatten repeatable sections before field mapping
  const flatData = flattenRepeatingFields(formData);

  const fieldData: Record<string, string> = {};
  const skippedFields: string[] = [];

  for (const mapping of fieldMaps) {
    const rawValue = getNestedValue(flatData, mapping.dataPath);
    // ... rest unchanged
```

**Step 3: Add address history XFA field names to I-485**

In `src/lib/pdf/uscis-fields/i-485.ts`, add fields for Part 3 address history:

```typescript
// Part 3 — Address History (slots for up to 5 addresses)
// Most recent address (slot 0)
{ formFieldName: 'form1.Pt3Line8a_StreetNumberAndName', dataPath: 'address_history_0_street', type: 'text' },
{ formFieldName: 'form1.Pt3Line8b_Apt', dataPath: 'address_history_0_apt', type: 'text' },
{ formFieldName: 'form1.Pt3Line8c_CityOrTown', dataPath: 'address_history_0_city', type: 'text' },
{ formFieldName: 'form1.Pt3Line8d_State', dataPath: 'address_history_0_state', type: 'text' },
{ formFieldName: 'form1.Pt3Line8e_ZipCode', dataPath: 'address_history_0_zip', type: 'text' },
{ formFieldName: 'form1.Pt3Line8g_DateFrom', dataPath: 'address_history_0_from_date', type: 'date' },
{ formFieldName: 'form1.Pt3Line8h_DateTo', dataPath: 'address_history_0_to_date', type: 'date' },
// Second address (slot 1)
{ formFieldName: 'form1.Pt3Line9a_StreetNumberAndName', dataPath: 'address_history_1_street', type: 'text' },
// ... (repeat pattern for slots 1-4)
```

**Note:** The exact XFA field names (e.g., `Pt3Line8a_StreetNumberAndName`) must be verified against the actual I-485 PDF. Use the PDF service's health endpoint or pikepdf to dump field names:

```bash
# On the Railway service or locally with pikepdf:
python3 -c "
import pikepdf
pdf = pikepdf.open('templates/i-485.pdf')
xfa = pdf.Root.AcroForm.XFA
# Extract and print field names from XFA datasets
"
```

Apply the same pattern for N-400 employment/address history fields.

**Step 4: Write tests for flattenRepeatingFields**

Add to existing `src/lib/pdf/xfa-filler.test.ts`:

```typescript
describe('flattenRepeatingFields', () => {
  it('flattens address_history array into numbered keys', () => {
    const data = {
      name: 'John',
      address_history: [
        { street: '123 Main St', city: 'Boston', state: 'MA' },
        { street: '456 Oak Ave', city: 'Cambridge', state: 'MA' },
      ],
    };
    const flat = flattenRepeatingFields(data);
    expect(flat.address_history_0_street).toBe('123 Main St');
    expect(flat.address_history_1_city).toBe('Cambridge');
    expect(flat.name).toBe('John'); // non-array fields preserved
  });

  it('handles missing arrays gracefully', () => {
    const flat = flattenRepeatingFields({ name: 'John' });
    expect(flat.name).toBe('John');
  });
});
```

**Step 5: Run tests**

```bash
npx vitest run src/lib/pdf/xfa-filler.test.ts
```

**Step 6: Verify build**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/lib/pdf/xfa-filler.ts src/lib/pdf/xfa-filler.test.ts src/lib/pdf/uscis-fields/i-485.ts src/lib/pdf/uscis-fields/n-400.ts
git commit -m "feat: add flattenRepeatingFields + address/employment XFA field names for I-485, N-400"
```

---

## Phase 3: Smart Document Prompting

### Task 7: Add autofill gap analysis function

**Files:**
- Modify: `src/lib/ai/form-autofill.ts` (add getAutofillGaps)
- Test: `src/lib/ai/form-autofill.test.ts` (if exists, add tests)

**Step 1: Define the gap analysis types and function**

Add to `src/lib/ai/form-autofill.ts`:

```typescript
export interface AutofillGap {
  missingDocType: string;
  description: string;
  fieldsItWouldFill: string[];
  fieldCount: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Analyze which documents are missing and what fields they would fill.
 * No AI calls — pure static cross-reference.
 */
export function getAutofillGaps(
  formType: string,
  filledFieldIds: string[],
  uploadedDocTypes: string[]
): AutofillGap[] {
  // Define which document types provide which fields per form
  const docFieldProviders: Record<string, { docType: string; description: string; fields: string[]; priority: 'high' | 'medium' | 'low' }[]> = {
    'I-485': [
      {
        docType: 'utility_bill',
        description: 'Utility bills or lease agreements (last 5 years)',
        fields: ['address_history_0_street', 'address_history_0_city', 'address_history_0_state', 'address_history_0_zip', 'address_history_1_street', 'address_history_1_city', 'address_history_1_state', 'address_history_1_zip'],
        priority: 'high',
      },
      {
        docType: 'w2',
        description: 'W-2 forms (last 5 years)',
        fields: ['employment_history_0_employer_name', 'employment_history_0_job_title', 'employment_history_0_from_date', 'employment_history_1_employer_name'],
        priority: 'high',
      },
      {
        docType: 'i94',
        description: 'I-94 Arrival/Departure Record',
        fields: ['pt1_last_entry_date', 'pt1_port_of_entry', 'pt1_status_at_entry', 'pt1_i94_number'],
        priority: 'high',
      },
    ],
    // ... similar for N-400, I-130, I-140, etc.
  };

  const providers = docFieldProviders[formType] || [];
  const gaps: AutofillGap[] = [];

  for (const provider of providers) {
    // Skip if this doc type is already uploaded
    if (uploadedDocTypes.includes(provider.docType)) continue;

    // Count how many of this provider's fields are unfilled
    const unfilledFields = provider.fields.filter(f => !filledFieldIds.includes(f));
    if (unfilledFields.length === 0) continue;

    gaps.push({
      missingDocType: provider.docType,
      description: provider.description,
      fieldsItWouldFill: unfilledFields,
      fieldCount: unfilledFields.length,
      priority: provider.priority,
    });
  }

  return gaps.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority] || b.fieldCount - a.fieldCount;
  });
}
```

**Step 2: Write tests**

```typescript
describe('getAutofillGaps', () => {
  it('identifies missing utility bills for I-485 address history', () => {
    const gaps = getAutofillGaps('I-485', [], ['passport']);
    const utilityGap = gaps.find(g => g.missingDocType === 'utility_bill');
    expect(utilityGap).toBeDefined();
    expect(utilityGap!.priority).toBe('high');
  });

  it('excludes gaps for already-uploaded document types', () => {
    const gaps = getAutofillGaps('I-485', [], ['passport', 'utility_bill', 'w2', 'i94']);
    expect(gaps).toHaveLength(0);
  });

  it('returns empty array for unknown form types', () => {
    expect(getAutofillGaps('UNKNOWN', [], [])).toEqual([]);
  });
});
```

**Step 3: Run tests**

```bash
npx vitest run src/lib/ai/form-autofill.test.ts
```

**Step 4: Commit**

```bash
git add src/lib/ai/form-autofill.ts src/lib/ai/form-autofill.test.ts
git commit -m "feat: add getAutofillGaps for smart document prompting"
```

---

### Task 8: Include gaps in autofill API response

**Files:**
- Modify: `src/app/api/forms/[id]/autofill/route.ts:245-278`

**Step 1: After autofill completes, compute gaps**

In the sync path (around line 245), after saving autofill results:

```typescript
import { getAutofillGaps } from '@/lib/ai/form-autofill';

// After autofill results are computed:
const filledFieldIds = autofillResult.fields
  .filter(f => f.suggested_value)
  .map(f => f.field_id);

const uploadedDocTypes = analyzedDocuments.map(d => d.document_type);

const gaps = getAutofillGaps(form.form_type, filledFieldIds, uploadedDocTypes);

// Include in response
return NextResponse.json({
  success: true,
  data: {
    ...existingResponseData,
    gaps,
  },
});
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/forms/[id]/autofill/route.ts
git commit -m "feat: include autofill gaps in API response for smart document prompting"
```

---

### Task 9: Add DocumentPrompt frontend component

**Files:**
- Create: `src/components/forms/document-prompt.tsx`
- Modify: `src/app/dashboard/forms/[id]/page.tsx:228-237` (render DocumentPrompt)

**Step 1: Create the component**

```typescript
// src/components/forms/document-prompt.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface AutofillGap {
  missingDocType: string;
  description: string;
  fieldCount: number;
  priority: 'high' | 'medium' | 'low';
}

interface DocumentPromptProps {
  gaps: AutofillGap[];
  caseId: string;
}

export function DocumentPrompt({ gaps, caseId }: DocumentPromptProps) {
  if (gaps.length === 0) return null;

  const totalFields = gaps.reduce((sum, g) => sum + g.fieldCount, 0);

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600" />
          {totalFields} fields could not be auto-filled
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Upload these documents to improve coverage:
        </p>
        {gaps.map((gap) => (
          <div
            key={gap.missingDocType}
            className="flex items-start gap-3 p-3 rounded-lg bg-white border"
          >
            <FileUp size={18} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{gap.description}</p>
              <p className="text-xs text-muted-foreground">
                Would auto-fill {gap.fieldCount} additional field{gap.fieldCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        ))}
        <Link href={`/dashboard/cases/${caseId}?tab=documents`}>
          <Button variant="outline" size="sm" className="w-full gap-2">
            <FileUp size={16} />
            Upload Documents
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Render in form detail page**

In `src/app/dashboard/forms/[id]/page.tsx`, add the `DocumentPrompt` in the sidebar or above the form tabs, passing the gaps from the autofill response.

**Step 3: Verify build**

```bash
npx tsc --noEmit && npm run build
```

**Step 4: Commit**

```bash
git add src/components/forms/document-prompt.tsx src/app/dashboard/forms/[id]/page.tsx
git commit -m "feat: add DocumentPrompt component for smart document upload guidance"
```

---

### Task 10: Final integration test + build verification

**Step 1: Run full test suite**

```bash
npx vitest run
```

**Step 2: Run production build**

```bash
npm run build
```

**Step 3: Run lint**

```bash
npm run lint
```

**Step 4: Final commit if any cleanup needed**

```bash
git add -A && git commit -m "chore: final cleanup for PDF deploy + AI deepening"
```

---

## Summary

| Task | Phase | Description | Files Changed |
|------|-------|-------------|---------------|
| 1 | 1 | Deploy Railway PDF service | Infrastructure only |
| 2 | 2 | Add repeatable section types | `types/index.ts` |
| 3 | 2 | Enhance extraction prompts | `prompts.ts`, `types/index.ts` |
| 4 | 2 | Update field mappings | `form-autofill.ts` |
| 5 | 2 | Array-based autofill + history builder | `history-builder.ts` (new), `form-autofill.ts`, `anthropic.ts`, `types.ts` |
| 6 | 2 | Flatten arrays for PDF + XFA fields | `xfa-filler.ts`, `uscis-fields/i-485.ts`, `uscis-fields/n-400.ts` |
| 7 | 3 | Autofill gap analysis function | `form-autofill.ts` |
| 8 | 3 | Include gaps in API response | `autofill/route.ts` |
| 9 | 3 | DocumentPrompt frontend component | `document-prompt.tsx` (new), `forms/[id]/page.tsx` |
| 10 | 3 | Final integration test | All |
