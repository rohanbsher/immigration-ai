# Phase 4: Citations — Two-Pass Design

## Problem

Attorneys using AI form autofill need to verify each suggested value against source documents. Currently they see the document type (e.g., "passport") and a confidence score, but not the exact passage that supports the value. This forces manual cross-referencing — slow and error-prone.

## Constraint

Anthropic's Citations API is incompatible with Structured Outputs (`output_config.format` returns 400). Our autofill uses `callClaudeStructured()` with forced tool_use, which won't produce citation annotations.

## Solution: Two-Pass Architecture

```
Pass 1: generateFormAutofill()          [EXISTING — no changes]
  → Structured output via tool_choice
  → Returns field values + confidence scores

Pass 2: generateFieldCitations()        [NEW — feature-flagged]
  → Document content blocks with citations: { enabled: true }
  → Asks Claude to quote passages supporting each field value
  → Returns text blocks with citation annotations

Merge: mapCitationsToFields()           [EXISTING — minor updates]
  → Matches citations to fields by value substring
  → Attaches Citation[] to each FormFieldWithCitations
```

### Feature Flag

`AI_CITATIONS_ENABLED=true` env var → `features.citationsEnabled` flag. When false (default), Pass 2 is skipped entirely — zero cost, zero latency impact.

## Data Flow

### Pass 2 Input

```typescript
// Each analyzed document's raw text becomes a document content block
{
  type: "document",
  source: {
    type: "text",
    media_type: "text/plain",
    data: document.raw_text,   // Already extracted by Vision OCR
  },
  title: `${document.document_type} (${document.id})`,
  context: `Document type: ${document.document_type}`,
  citations: { enabled: true },
  cache_control: { type: "ephemeral" },  // Prompt caching
}
```

### Pass 2 Prompt

```
For each of the following form field values, quote the exact passage
from the source documents that supports it. If a value was inferred
rather than directly quoted, say so.

Fields to verify:
- full_name: "JOHN DOE"
- date_of_birth: "1990-01-15"
- passport_number: "AB1234567"
...
```

### Response (Anthropic Citations API format)

```json
{
  "content": [
    { "type": "text", "text": "The name " },
    {
      "type": "text",
      "text": "JOHN DOE",
      "citations": [{
        "type": "char_location",
        "cited_text": "JOHN DOE",
        "document_index": 0,
        "document_title": "passport (doc-abc)",
        "start_char_index": 42,
        "end_char_index": 50
      }]
    },
    { "type": "text", "text": " appears on the passport..." }
  ]
}
```

### Citation Mapping

Existing `mapCitationsToFields()` matches `cited_text` to `suggested_value` via case-insensitive substring with guards:
- Values < 3 chars skipped (too ambiguous)
- Shorter string must be >= 40% of longer string length (prevents false positives)

## Storage

Citations are stored in `ai_filled_data._metadata.citations`:

```json
{
  "_metadata": {
    "generated_at": "2026-02-19T...",
    "model": "claude-sonnet-4",
    "citations": {
      "pt1_given_name": [{
        "type": "document",
        "citedText": "JOHN DOE",
        "documentType": "passport",
        "documentId": "doc-abc",
        "startIndex": 42,
        "endIndex": 50
      }],
      "pt1_dob": [{
        "type": "document",
        "citedText": "15 JAN / JAN 1990",
        "documentType": "passport",
        "documentId": "doc-abc",
        "startIndex": 78,
        "endIndex": 96
      }]
    },
    "citations_model": "claude-sonnet-4-20250514",
    "citations_processing_time_ms": 3200
  }
}
```

## Frontend

The `CitationList` component in `field-verification.tsx` already renders citations:
- Blue card with document icon, document type, page number
- Quoted text in italics, truncated to 120 chars with expand/collapse
- "Show N more" toggle for multiple citations

The autofill API response includes per-field citations so the frontend can display them without additional API calls.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/ai/citations.ts` | Add `generateFieldCitations()`, update `parseCitationsFromResponse()` for real API format |
| `src/lib/ai/form-autofill.ts` | Wire Pass 2 into `autofillForm()` after existing autofill |
| `src/app/api/forms/[id]/autofill/route.ts` | Store citations in `_metadata`, include in response |
| `src/lib/ai/types.ts` | No changes needed (types already exist) |
| `src/components/ai/field-verification.tsx` | No changes needed (CitationList already exists) |
| `src/lib/config/env.ts` | No changes needed (feature flag already exists) |

## Cost & Latency

- **Pass 2 input**: ~500-2000 tokens (document raw text, typically 1-5 pages)
- **Pass 2 output**: ~200-500 tokens (cited passages + connecting text)
- **Estimated cost**: $0.01-0.05 per form autofill (when enabled)
- **Estimated latency**: +5-15 seconds (one additional API call)
- **When disabled**: Zero additional cost or latency

## Testing

- Unit: `generateFieldCitations()` with mocked Anthropic response
- Unit: `parseCitationsFromResponse()` with real API response format (char_location, page_location)
- Unit: End-to-end two-pass flow with feature flag on/off
- Manual: Verify CitationList renders in field verification UI
