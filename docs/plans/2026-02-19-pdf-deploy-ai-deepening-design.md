# Design: PDF Deployment + AI Extraction Deepening

> Date: 2026-02-19
> Status: Approved
> Scope: WS-PDF (deploy) + WS-AI-MAPPING (deepen) + Smart Document Prompting

## Goal

Enable end-to-end attorney workflow: upload documents → AI extracts deeply → autofill forms at 60-70% coverage → download filing-ready USCIS PDFs.

## Current State

- **PDF pipeline:** Code complete. XFA filler, Railway microservice, 7 USCIS templates, 141+ field mappings. Not deployed.
- **AI autofill:** 16 document extraction prompts. 30-50% field coverage. Extracts basic bio (name, DOB, passport #) but misses address history, employment history, family details.
- **Form scope:** 7 forms with XFA templates (I-130, I-485, I-765, I-131, I-140, N-400, G-1145). Remaining 4 (I-129, I-539, I-20, DS-160) deferred — use summary PDF fallback.

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Launch scope | Full end-to-end (filing-ready PDFs + deep AI extraction) | Attorneys need to see complete value proposition |
| Form scope | 7 existing XFA forms only | Covers family-based, employment-based, naturalization. Add others later. |
| AI depth | Maximum extraction from uploaded docs + prompt for missing docs | If user uploads it, we should extract everything from it |
| Repeatable sections | Array model + flatten for PDF | Clean data model, natural for AI extraction, easy UI, trivial PDF flatten |
| PDF service deployment | Same Railway project (splendid-flow) as worker | One dashboard, isolated containers, simpler ops |
| Phasing | Deploy first → deepen second → smart prompting third | Each phase independently testable and shippable |

---

## Phase 1: Deploy Railway PDF Service

**Effort:** ~1 session (infrastructure only, no code changes)

### What We Do

1. Add `pdf-service` as new service in `splendid-flow` Railway project
2. Docker image: `services/pdf-service/Dockerfile` (Python 3.11 + FastAPI + pikepdf)
3. Set env vars on Railway: `PDF_SERVICE_SECRET`
4. Set env vars on Vercel: `PDF_SERVICE_URL`, `PDF_SERVICE_SECRET`
5. Smoke test: hit `/health`, then download I-130 PDF through the app

### No Code Changes

The XFA filler client (`xfa-filler.ts`), PDF orchestrator (`index.ts`), and API route are all built and tested. We're just turning it on.

### Verification

- `/health` returns 200 with template list
- Download I-130 → get official USCIS PDF with fields filled (not DRAFT summary)
- Download form for type without XFA map (e.g., I-129) → still gets summary PDF fallback

---

## Phase 2: Deepen AI Extraction + Field Mapping

**Effort:** ~2-3 sessions

### Overview

Enhance extraction prompts to pull ALL available data from uploaded documents, not just basic bio. Update field mappings to route new data to form fields. Add array model for repeatable sections.

### 5 Extraction Enhancements

| # | Document Type | Currently Extracted | Adding | Forms Impacted |
|---|--------------|--------------------|----|----------------|
| 1 | W-2 / Tax Returns | Employee name, wages, AGI | Employer name+address+EIN, employment dates, state wages, multiple W-2s for job history | I-485, N-400, I-140 |
| 2 | Utility Bills / Leases | (nothing) | Address, date range, account holder — build 5-year address history from multiple docs | I-485, N-400, I-130 |
| 3 | Birth/Marriage Certs | Names, dates | Parents' full details (DOB, nationality), spouse details, place of marriage (city/state/country) | I-130, I-485 |
| 4 | I-94 / Visa Stamps | I-94 number, admission date | All prior entries (history), visa class, port of entry, status expiry | I-485, I-765 |
| 5 | Diplomas / Transcripts | Name, degree, institution | Institution address+country, field of study, graduation date, GPA, all degrees | I-140 |

### Repeatable Sections — Array Model

**New types:**

```typescript
interface AddressHistoryEntry {
  street: string;
  apt?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  from_date: string;   // YYYY-MM
  to_date: string;     // YYYY-MM or "present"
}

interface EmploymentHistoryEntry {
  employer_name: string;
  employer_address?: string;
  job_title: string;
  from_date: string;
  to_date: string;
  duties?: string;
}
```

**Storage:** Arrays stored in `form_data` JSON column (e.g., `form_data.address_history: AddressHistoryEntry[]`).

**PDF flattening:** New `flattenRepeatingFields()` utility maps arrays to numbered XFA field names:
- `address_history[0].street` → `form1.Pt3Line8a_StreetNumberAndName`
- `address_history[1].street` → `form1.Pt3Line9a_StreetNumberAndName`
- If entries exceed USCIS form slots → data preserved in form but only N slots filled in PDF (continuation sheet support is future work)

### Files Modified

| File | Change |
|------|--------|
| `src/lib/ai/prompts.ts` | Enhance 5 extraction prompt categories |
| `src/lib/ai/form-autofill.ts` | Update `mapExtractedFieldToFormField()` with new field mappings; update autofill logic to produce arrays |
| `src/lib/ai/anthropic.ts` | Update autofill prompt to handle array data |
| `src/lib/forms/definitions/*.ts` | Add `aiFieldKey` for new fields; add array field group definitions |
| `src/lib/pdf/uscis-fields/*.ts` | Map new fields to XFA field names |
| `src/lib/pdf/xfa-filler.ts` | Add `flattenRepeatingFields()` |
| `src/types/index.ts` | Add `AddressHistoryEntry`, `EmploymentHistoryEntry` types |

### Target Coverage

| Form | Current | Target | Improvement |
|------|---------|--------|-------------|
| I-130 | 48% | 70% | +family details, address |
| I-485 | 42% | 70% | +address history, employment history, immigration |
| I-765 | 80% | 85% | +immigration history |
| I-131 | 38% | 55% | +address, travel history |
| I-140 | 57% | 75% | +education, employer details |
| N-400 | 18% | 55% | +address history, employment, tax data |
| G-1145 | 63% | 63% | (minimal form, already good) |

---

## Phase 3: Smart Document Prompting

**Effort:** ~1 session

### Overview

When autofill can't fill certain fields because required documents haven't been uploaded, tell the attorney exactly what's missing and what it would unlock.

### Technical Design

**New function:** `getAutofillGaps(formType, filledFields, uploadedDocTypes)`

```typescript
interface AutofillGap {
  missingDocType: DocumentType;
  description: string;           // "Utility bills or lease agreements (last 5 years)"
  fieldsItWouldFill: string[];   // ["address_history", "address_from_date", ...]
  fieldCount: number;            // 10
  priority: 'high' | 'medium' | 'low';
}
```

**No new AI calls.** This is a static cross-reference:
1. For each unfilled field, look up which document type provides that data
2. Check which document types the user has already uploaded
3. Return the gaps with descriptions

**Response update:** Autofill API returns `gaps: AutofillGap[]` alongside filled data.

**Frontend component:** `<DocumentPrompt>` on the form page:
```
⚠️ 12 fields could not be auto-filled. Upload these documents to improve coverage:

📄 Utility bills or lease agreements (last 5 years)
   → Would auto-fill: 5-year address history (10 fields)

📄 W-2 forms (last 5 years)
   → Would auto-fill: employment history, employer details (8 fields)
```

### Files Modified

| File | Change |
|------|--------|
| `src/lib/ai/form-autofill.ts` | Add `getAutofillGaps()` function |
| `src/app/api/forms/[id]/autofill/route.ts` | Include gaps in response |
| `src/components/forms/document-prompt.tsx` | New component |
| `src/app/dashboard/forms/[id]/page.tsx` | Render `<DocumentPrompt>` |

---

## Architecture Diagram

```
Attorney uploads documents
    ↓
Claude Vision extracts ALL fields (enhanced prompts)
    ↓
Extracted data stored as structured JSON (with arrays for history)
    ↓
Attorney clicks "Autofill"
    ↓
Claude reasons over ALL extracted data → suggests field values
    ↓
Array data (address/employment history) stored in form_data
    ↓
Gap analysis: what documents are missing?
    ↓
UI shows: filled fields + review warnings + "upload X to fill Y more fields"
    ↓
Attorney reviews, corrects, approves
    ↓
Attorney downloads PDF
    ↓
flattenRepeatingFields() maps arrays → numbered XFA fields
    ↓
Railway PDF service fills official USCIS template
    ↓
Filing-ready PDF returned
```

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Railway PDF service has cold start latency | Slow first PDF download | Health check keeps container warm; timeout set to 30s |
| Enhanced prompts extract wrong data | Bad autofill suggestions | All fields have confidence scores; `requires_review` flag on low-confidence |
| Array flattening exceeds USCIS form slots | Data loss in PDF | Log warning; preserve all data in form_data; fill up to max slots |
| Extraction prompts too verbose → token cost increase | Higher AI costs | Monitor token usage; prompts already use prompt caching |

## Out of Scope

- XFA field maps for I-129, I-539, I-20, DS-160 (deferred — summary PDF fallback works)
- Continuation sheets for overflow data
- PDF preview in UI (separate work stream)
- Stripe live mode activation
- Custom domain
