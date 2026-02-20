# Phase 4: Citations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a second-pass Claude API call with Anthropic Citations to attach exact source-document quotes to every AI-autofilled form field.

**Architecture:** Two-pass design. Pass 1 (existing `callClaudeStructured`) generates field values. Pass 2 (new `generateFieldCitations`) sends document raw text as `document` content blocks with `citations: { enabled: true }` and maps the returned citation annotations to fields. Feature-flagged behind `AI_CITATIONS_ENABLED`.

**Tech Stack:** Anthropic SDK `@anthropic-ai/sdk@^0.72`, TypeScript, Vitest

**Design doc:** `docs/plans/2026-02-19-citations-design.md`

---

## Task 1: Update `parseCitationsFromResponse()` for Real API Format

The current implementation uses a custom `RawCitationAnnotation` type that doesn't match the actual Anthropic Citations API response format. The real API returns `char_location`, `page_location`, or `content_block_location` citation types with different field names (`start_char_index` / `end_char_index` vs the current `start_index` / `end_index`).

**Files:**
- Modify: `src/lib/ai/citations.ts:19-43` (raw types) and `src/lib/ai/citations.ts:58-89` (parse function)
- Test: `src/lib/ai/citations.test.ts` (create)

### Step 1: Write the failing tests

Create `src/lib/ai/citations.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), logError: vi.fn(),
  }),
}));

import {
  parseCitationsFromResponse,
  mapCitationsToFields,
  hasCitations,
  countCitations,
} from './citations';
import type { FormFieldWithCitations } from './types';

describe('parseCitationsFromResponse', () => {
  it('parses char_location citations from plain text documents', () => {
    const response = {
      content: [
        { type: 'text', text: 'The name is ' },
        {
          type: 'text',
          text: 'JOHN DOE',
          citations: [
            {
              type: 'char_location',
              cited_text: 'JOHN DOE',
              document_index: 0,
              document_title: 'passport (doc-abc)',
              start_char_index: 42,
              end_char_index: 50,
            },
          ],
        },
      ],
    };

    const docMap = new Map([[0, { documentId: 'doc-abc', documentType: 'passport' }]]);
    const citations = parseCitationsFromResponse(response, docMap);

    expect(citations).toHaveLength(1);
    expect(citations[0]).toEqual({
      type: 'document',
      citedText: 'JOHN DOE',
      startIndex: 42,
      endIndex: 50,
      pageNumber: undefined,
      documentId: 'doc-abc',
      documentType: 'passport',
    });
  });

  it('parses page_location citations from PDF documents', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'born on January 15',
          citations: [
            {
              type: 'page_location',
              cited_text: 'Date of Birth: January 15, 1990',
              document_index: 0,
              document_title: 'birth_certificate',
              start_page_number: 1,
              end_page_number: 2,
            },
          ],
        },
      ],
    };

    const docMap = new Map([[0, { documentId: 'doc-xyz', documentType: 'birth_certificate' }]]);
    const citations = parseCitationsFromResponse(response, docMap);

    expect(citations).toHaveLength(1);
    expect(citations[0].pageNumber).toBe(1);
    expect(citations[0].citedText).toBe('Date of Birth: January 15, 1990');
  });

  it('parses content_block_location citations from custom content documents', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'employer is Acme Corp',
          citations: [
            {
              type: 'content_block_location',
              cited_text: 'Employer: Acme Corp LLC',
              document_index: 1,
              document_title: 'employment_letter',
              start_block_index: 2,
              end_block_index: 3,
            },
          ],
        },
      ],
    };

    const docMap = new Map([[1, { documentId: 'doc-emp', documentType: 'employment_letter' }]]);
    const citations = parseCitationsFromResponse(response, docMap);

    expect(citations).toHaveLength(1);
    expect(citations[0].documentType).toBe('employment_letter');
    expect(citations[0].documentId).toBe('doc-emp');
  });

  it('returns empty array for response with no content', () => {
    expect(parseCitationsFromResponse({})).toEqual([]);
    expect(parseCitationsFromResponse({ content: [] })).toEqual([]);
  });

  it('skips text blocks without citations', () => {
    const response = {
      content: [
        { type: 'text', text: 'No citations here' },
        {
          type: 'text',
          text: 'has citation',
          citations: [
            {
              type: 'char_location',
              cited_text: 'source text',
              document_index: 0,
              start_char_index: 0,
              end_char_index: 11,
            },
          ],
        },
      ],
    };

    const citations = parseCitationsFromResponse(response);
    expect(citations).toHaveLength(1);
  });

  it('falls back to document_title when no docMap entry', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'value',
          citations: [
            {
              type: 'char_location',
              cited_text: 'source value',
              document_index: 5,
              document_title: 'some_doc_title',
              start_char_index: 0,
              end_char_index: 12,
            },
          ],
        },
      ],
    };

    const citations = parseCitationsFromResponse(response);
    expect(citations[0].documentType).toBe('some_doc_title');
    expect(citations[0].documentId).toBeUndefined();
  });

  it('handles multiple citations on a single text block', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'combined data',
          citations: [
            { type: 'char_location', cited_text: 'first', document_index: 0, start_char_index: 0, end_char_index: 5 },
            { type: 'char_location', cited_text: 'second', document_index: 1, start_char_index: 10, end_char_index: 16 },
          ],
        },
      ],
    };

    const citations = parseCitationsFromResponse(response);
    expect(citations).toHaveLength(2);
  });
});

describe('mapCitationsToFields', () => {
  const makeField = (id: string, name: string, value?: string): FormFieldWithCitations => ({
    field_id: id,
    field_name: name,
    field_type: 'text',
    suggested_value: value,
  });

  it('maps citation to field when cited_text matches suggested_value', () => {
    const citations = [
      { type: 'document' as const, citedText: 'JOHN DOE', documentType: 'passport' },
    ];
    const fields = [makeField('name', 'full_name', 'JOHN DOE')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toHaveLength(1);
    expect(result[0].citations![0].citedText).toBe('JOHN DOE');
  });

  it('matches case-insensitively', () => {
    const citations = [
      { type: 'document' as const, citedText: 'john doe', documentType: 'passport' },
    ];
    const fields = [makeField('name', 'full_name', 'JOHN DOE')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toHaveLength(1);
  });

  it('rejects matches shorter than 3 characters', () => {
    const citations = [
      { type: 'document' as const, citedText: 'M', documentType: 'passport' },
    ];
    const fields = [makeField('sex', 'sex', 'M')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toBeUndefined();
  });

  it('rejects partial-word matches below 40% ratio', () => {
    const citations = [
      { type: 'document' as const, citedText: 'Johnson & Johnson LLC International', documentType: 'employment_letter' },
    ];
    const fields = [makeField('name', 'employer_name', 'John')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toBeUndefined();
  });

  it('skips fields with no suggested_value', () => {
    const citations = [
      { type: 'document' as const, citedText: 'some text', documentType: 'passport' },
    ];
    const fields = [makeField('empty', 'empty_field')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toBeUndefined();
  });

  it('returns fields unchanged when no citations', () => {
    const fields = [makeField('name', 'full_name', 'JOHN DOE')];
    const result = mapCitationsToFields([], fields);
    expect(result).toEqual(fields);
  });
});

describe('hasCitations', () => {
  it('returns true when at least one field has citations', () => {
    const fields: FormFieldWithCitations[] = [
      { field_id: 'a', field_name: 'a', field_type: 'text', citations: [{ type: 'document', citedText: 'x' }] },
    ];
    expect(hasCitations(fields)).toBe(true);
  });

  it('returns false when no fields have citations', () => {
    const fields: FormFieldWithCitations[] = [
      { field_id: 'a', field_name: 'a', field_type: 'text' },
    ];
    expect(hasCitations(fields)).toBe(false);
  });
});

describe('countCitations', () => {
  it('sums citations across all fields', () => {
    const fields: FormFieldWithCitations[] = [
      { field_id: 'a', field_name: 'a', field_type: 'text', citations: [{ type: 'document', citedText: 'x' }, { type: 'document', citedText: 'y' }] },
      { field_id: 'b', field_name: 'b', field_type: 'text', citations: [{ type: 'document', citedText: 'z' }] },
    ];
    expect(countCitations(fields)).toBe(3);
  });
});
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run src/lib/ai/citations.test.ts`
Expected: Some tests FAIL because `parseCitationsFromResponse` doesn't handle `char_location` / `page_location` / `content_block_location` format.

### Step 3: Update the raw types and parse function

Replace the raw types and update `parseCitationsFromResponse` in `src/lib/ai/citations.ts:19-89`:

```typescript
// ---------------------------------------------------------------------------
// Types for raw Anthropic citation annotations (real API format)
// ---------------------------------------------------------------------------

/** Union of all citation location types returned by the Anthropic Citations API. */
interface RawCitation {
  type: 'char_location' | 'page_location' | 'content_block_location';
  /** The exact text being cited (not counted towards output tokens). */
  cited_text: string;
  /** 0-indexed document index in the request's document list. */
  document_index: number;
  /** Document title from the request. */
  document_title?: string;
  // char_location fields
  start_char_index?: number;
  end_char_index?: number;
  // page_location fields
  start_page_number?: number;
  end_page_number?: number;
  // content_block_location fields
  start_block_index?: number;
  end_block_index?: number;
}

interface RawContentBlock {
  type: string;
  text?: string;
  citations?: RawCitation[];
}

interface RawCitationResponse {
  content?: RawContentBlock[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse citation annotations from a raw Anthropic response.
 *
 * The Citations API returns text content blocks with `citations` arrays.
 * Each citation can be a `char_location`, `page_location`, or
 * `content_block_location` depending on the source document type.
 *
 * This function normalizes all citation types into our `Citation` type.
 */
export function parseCitationsFromResponse(
  response: RawCitationResponse,
  documentMap?: Map<number, { documentId: string; documentType: string }>
): Citation[] {
  const citations: Citation[] = [];

  if (!response.content) return citations;

  for (const block of response.content) {
    if (block.type !== 'text' || !block.citations) continue;

    for (const raw of block.citations) {
      if (!raw.cited_text) continue;

      const docInfo = documentMap?.get(raw.document_index);

      // Normalize location fields across citation types
      let startIndex: number | undefined;
      let endIndex: number | undefined;
      let pageNumber: number | undefined;

      if (raw.type === 'char_location') {
        startIndex = raw.start_char_index;
        endIndex = raw.end_char_index;
      } else if (raw.type === 'page_location') {
        pageNumber = raw.start_page_number;
      } else if (raw.type === 'content_block_location') {
        startIndex = raw.start_block_index;
        endIndex = raw.end_block_index;
      }

      citations.push({
        type: 'document',
        citedText: raw.cited_text,
        startIndex,
        endIndex,
        pageNumber,
        documentId: docInfo?.documentId,
        documentType: docInfo?.documentType || raw.document_title,
      });
    }
  }

  return citations;
}
```

### Step 4: Run tests to verify they pass

Run: `npx vitest run src/lib/ai/citations.test.ts`
Expected: ALL PASS

### Step 5: Commit

```bash
git add src/lib/ai/citations.ts src/lib/ai/citations.test.ts
git commit -m "feat(citations): update parser for real Anthropic Citations API format

Support char_location, page_location, and content_block_location citation
types. Add comprehensive unit tests for parsing and field mapping."
```

---

## Task 2: Add `generateFieldCitations()` — the Pass 2 API Call

This is the core new function. It takes document raw text + filled field values, calls the Anthropic API with document content blocks and citations enabled, and returns the raw response for citation parsing.

**Files:**
- Modify: `src/lib/ai/citations.ts` (add function after `parseCitationsFromResponse`)
- Test: `src/lib/ai/citations.test.ts` (add tests)

### Step 1: Write the failing test

Add to `src/lib/ai/citations.test.ts`:

```typescript
// Add at top of file, after existing mocks:
vi.mock('./client', () => ({
  getAnthropicClient: vi.fn(),
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
}));

vi.mock('./circuit-breaker', () => ({
  anthropicBreaker: { execute: (fn: () => Promise<unknown>) => fn() },
}));

vi.mock('@/lib/utils/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
  AI_RETRY_OPTIONS: {},
}));

// Add import:
import { generateFieldCitations } from './citations';
import { getAnthropicClient } from './client';

describe('generateFieldCitations', () => {
  it('calls Anthropic API with document content blocks and citations enabled', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'JOHN DOE',
          citations: [
            {
              type: 'char_location',
              cited_text: 'JOHN DOE',
              document_index: 0,
              document_title: 'passport (doc-abc)',
              start_char_index: 42,
              end_char_index: 50,
            },
          ],
        },
      ],
    });

    vi.mocked(getAnthropicClient).mockReturnValue({
      messages: { create: mockCreate },
    } as never);

    const result = await generateFieldCitations({
      documents: [
        { documentId: 'doc-abc', documentType: 'passport', rawText: 'Name: JOHN DOE\nDOB: 1990-01-15' },
      ],
      fields: [
        { fieldId: 'pt1_name', fieldName: 'full_name', suggestedValue: 'JOHN DOE' },
      ],
    });

    // Verify the API was called with document content blocks
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];

    // Check that messages contain document blocks with citations enabled
    const userContent = callArgs.messages[0].content;
    const docBlock = userContent.find((b: Record<string, unknown>) => b.type === 'document');
    expect(docBlock).toBeDefined();
    expect(docBlock.citations).toEqual({ enabled: true });
    expect(docBlock.source.data).toBe('Name: JOHN DOE\nDOB: 1990-01-15');

    // Check result has parsed citations
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].citedText).toBe('JOHN DOE');
    expect(result.citations[0].documentId).toBe('doc-abc');
  });

  it('returns empty citations when documents have no raw text', async () => {
    const result = await generateFieldCitations({
      documents: [],
      fields: [
        { fieldId: 'pt1_name', fieldName: 'full_name', suggestedValue: 'JOHN DOE' },
      ],
    });

    expect(result.citations).toEqual([]);
  });

  it('filters out documents with empty rawText', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ content: [] });

    vi.mocked(getAnthropicClient).mockReturnValue({
      messages: { create: mockCreate },
    } as never);

    await generateFieldCitations({
      documents: [
        { documentId: 'doc-1', documentType: 'passport', rawText: '' },
        { documentId: 'doc-2', documentType: 'birth_certificate', rawText: 'Some text' },
      ],
      fields: [{ fieldId: 'f1', fieldName: 'name', suggestedValue: 'test' }],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    const docBlocks = userContent.filter((b: Record<string, unknown>) => b.type === 'document');
    expect(docBlocks).toHaveLength(1); // Only doc-2
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/lib/ai/citations.test.ts`
Expected: FAIL — `generateFieldCitations` is not exported from `./citations`

### Step 3: Implement `generateFieldCitations()`

Add to `src/lib/ai/citations.ts` after `parseCitationsFromResponse`:

```typescript
import { getAnthropicClient, CLAUDE_MODEL } from './client';
import { withRetry, AI_RETRY_OPTIONS } from '@/lib/utils/retry';
import { anthropicBreaker } from './circuit-breaker';

// ---------------------------------------------------------------------------
// Pass 2: Generate citations via Anthropic Citations API
// ---------------------------------------------------------------------------

export interface CitationDocument {
  documentId: string;
  documentType: string;
  rawText: string;
}

export interface CitationField {
  fieldId: string;
  fieldName: string;
  suggestedValue: string;
}

export interface CitationInput {
  documents: CitationDocument[];
  fields: CitationField[];
}

export interface CitationResult {
  citations: Citation[];
  processingTimeMs: number;
}

/**
 * Generate citations for autofilled field values by sending document
 * raw text to the Anthropic Citations API.
 *
 * This is "Pass 2" of the two-pass autofill architecture. Pass 1
 * (structured output) generates field values; this function finds
 * the exact source passages that support those values.
 *
 * Feature-gated: only called when `features.citationsEnabled` is true.
 */
export async function generateFieldCitations(
  input: CitationInput
): Promise<CitationResult> {
  const startTime = Date.now();

  // Filter documents with actual text content
  const docsWithText = input.documents.filter((d) => d.rawText.trim().length > 0);

  if (docsWithText.length === 0 || input.fields.length === 0) {
    return { citations: [], processingTimeMs: Date.now() - startTime };
  }

  // Build the document map for citation parsing
  const documentMap = new Map<number, { documentId: string; documentType: string }>();
  docsWithText.forEach((doc, index) => {
    documentMap.set(index, { documentId: doc.documentId, documentType: doc.documentType });
  });

  // Build document content blocks
  const documentBlocks = docsWithText.map((doc) => ({
    type: 'document' as const,
    source: {
      type: 'text' as const,
      media_type: 'text/plain' as const,
      data: doc.rawText,
    },
    title: `${doc.documentType} (${doc.documentId})`,
    context: `Document type: ${doc.documentType}`,
    citations: { enabled: true as const },
    cache_control: { type: 'ephemeral' as const },
  }));

  // Build the field list for the prompt
  const fieldList = input.fields
    .map((f) => `- ${f.fieldName}: "${f.suggestedValue}"`)
    .join('\n');

  const userContent = [
    ...documentBlocks,
    {
      type: 'text' as const,
      text: `For each of the following form field values, quote the exact passage from the source documents that supports it. Reference each value by citing the relevant text.

Fields to verify:
${fieldList}`,
    },
  ];

  try {
    const response = await anthropicBreaker.execute(() =>
      withRetry(
        () =>
          getAnthropicClient().messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 2048,
            messages: [{ role: 'user', content: userContent }],
          }),
        AI_RETRY_OPTIONS
      )
    );

    const citations = parseCitationsFromResponse(
      response as RawCitationResponse,
      documentMap
    );

    log.info('Generated field citations', {
      documentCount: docsWithText.length,
      fieldCount: input.fields.length,
      citationCount: citations.length,
      processingTimeMs: Date.now() - startTime,
    });

    return {
      citations,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    log.logError('Citation generation failed', error);
    // Citations are best-effort — return empty rather than failing the autofill
    return { citations: [], processingTimeMs: Date.now() - startTime };
  }
}
```

### Step 4: Export from index

Add `generateFieldCitations` to the exports in `src/lib/ai/index.ts:69-74`:

```typescript
// Citations (Phase 4)
export {
  parseCitationsFromResponse,
  mapCitationsToFields,
  hasCitations,
  countCitations,
  generateFieldCitations,
  type CitationDocument,
  type CitationField,
  type CitationInput,
  type CitationResult,
} from './citations';
```

### Step 5: Run tests to verify they pass

Run: `npx vitest run src/lib/ai/citations.test.ts`
Expected: ALL PASS

### Step 6: Commit

```bash
git add src/lib/ai/citations.ts src/lib/ai/citations.test.ts src/lib/ai/index.ts
git commit -m "feat(citations): add generateFieldCitations() for Pass 2 API call

Sends document raw text as document content blocks with citations
enabled. Returns parsed citations mapped to document metadata.
Best-effort: returns empty on failure rather than blocking autofill."
```

---

## Task 3: Wire Citations into `autofillForm()`

Add the optional Pass 2 call into the main autofill pipeline, gated behind `features.citationsEnabled`.

**Files:**
- Modify: `src/lib/ai/form-autofill.ts:34-139` (autofillForm function)
- Modify: `src/lib/ai/form-autofill.ts:1-14` (imports)
- No new test file — existing test mocks `anthropic` module; the integration is tested via the route test in Task 4

### Step 1: Update imports in `src/lib/ai/form-autofill.ts`

Add at the top, alongside existing imports:

```typescript
import { features } from '@/lib/config';
import { generateFieldCitations, mapCitationsToFields } from './citations';
import type { FormFieldWithCitations, FormAutofillResultWithCitations } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('ai:form-autofill');
```

### Step 2: Update `autofillForm()` return type and add Pass 2

Change the function signature to return `FormAutofillResult | FormAutofillResultWithCitations`.

After the existing `reportProgress('complete', 100, ...)` line (around line 124), but BEFORE the return, add:

```typescript
    // -----------------------------------------------------------------------
    // Pass 2: Citation generation (optional, feature-flagged)
    // -----------------------------------------------------------------------
    if (features.citationsEnabled && input.documentAnalyses.length > 0) {
      reportProgress('validating', 90, 'Generating source citations...');

      try {
        // Collect raw text from document analyses
        const citationDocs = input.documentAnalyses
          .filter((a) => a.raw_text && a.raw_text.trim().length > 0)
          .map((a, index) => ({
            documentId: `doc-${index}`,
            documentType: a.document_type,
            rawText: a.raw_text!,
          }));

        // Collect filled fields for citation matching
        const citationFields = fieldsWithReviewFlags
          .filter((f) => f.suggested_value)
          .map((f) => ({
            fieldId: f.field_id,
            fieldName: f.field_name,
            suggestedValue: f.suggested_value!,
          }));

        if (citationDocs.length > 0 && citationFields.length > 0) {
          const citationResult = await generateFieldCitations({
            documents: citationDocs,
            fields: citationFields,
          });

          if (citationResult.citations.length > 0) {
            // Map citations to fields
            const fieldsAsCitable: FormFieldWithCitations[] = fieldsWithReviewFlags;
            const fieldsWithCitations = mapCitationsToFields(
              citationResult.citations,
              fieldsAsCitable
            );

            reportProgress('complete', 100, 'Autofill complete with citations');

            return {
              ...autofillResult,
              fields: fieldsWithCitations,
              warnings,
            } as FormAutofillResultWithCitations;
          }
        }
      } catch (citationError) {
        // Citations are best-effort — log and continue without them
        log.warn('Citation generation failed, returning results without citations', {
          error: citationError instanceof Error ? citationError.message : String(citationError),
        });
      }
    }

    reportProgress('complete', 100, 'Autofill complete');
```

### Step 3: Run build to verify no type errors

Run: `npx tsc --noEmit`
Expected: Clean (0 errors)

### Step 4: Run existing tests to verify no regressions

Run: `npx vitest run src/lib/ai/form-autofill.test.ts`
Expected: ALL PASS (existing tests shouldn't break because `features.citationsEnabled` defaults to false)

### Step 5: Commit

```bash
git add src/lib/ai/form-autofill.ts
git commit -m "feat(citations): wire Pass 2 into autofillForm() pipeline

When AI_CITATIONS_ENABLED=true, runs generateFieldCitations() after
the structured autofill and maps citation annotations to fields.
Best-effort: failures are logged and autofill continues without citations."
```

---

## Task 4: Store Citations in API Route Response

Update the autofill API route to pass raw_text through `DocumentAnalysisResult`, store per-field citations in `ai_filled_data._metadata`, and include them in the response.

**Files:**
- Modify: `src/app/api/forms/[id]/autofill/route.ts`

### Step 1: Pass `_raw_text` through to DocumentAnalysisResult

In the route (around line 200), the code builds `DocumentAnalysisResult[]`. Add `raw_text`:

Find this block (line ~199):
```typescript
        return {
          document_type: doc.document_type,
          extracted_fields: extractedFields,
          overall_confidence: doc.ai_confidence_score || 0,
          processing_time_ms: 0,
        };
```

Replace with:
```typescript
        return {
          document_type: doc.document_type,
          extracted_fields: extractedFields,
          overall_confidence: doc.ai_confidence_score || 0,
          processing_time_ms: 0,
          raw_text: typeof extractedData['_raw_text'] === 'string'
            ? (extractedData['_raw_text'] as string)
            : undefined,
        };
```

### Step 2: Store citations in `_metadata`

After the autofill result is returned (around line 260), check if the result has citations and store them.

Find (around line 257):
```typescript
    const fieldsRequiringReview = autofillResult.fields
```

Add before the `atomicUpdateData` block:
```typescript
    // Extract per-field citations if available (two-pass citations)
    const fieldCitations: Record<string, unknown[]> = {};
    for (const field of autofillResult.fields) {
      const fieldWithCites = field as { citations?: unknown[] };
      if (fieldWithCites.citations && fieldWithCites.citations.length > 0) {
        fieldCitations[field.field_id] = fieldWithCites.citations;
      }
    }
```

Then in `atomicUpdateData._metadata`, add:
```typescript
          ...(Object.keys(fieldCitations).length > 0 && {
            citations: fieldCitations,
            citations_model: 'claude-sonnet-4-20250514',
          }),
```

### Step 3: Include per-field citations in response

In the response JSON (around line 327), add a `citations` object:

```typescript
    return NextResponse.json({
      form: updatedForm,
      autofill: {
        form_type: autofillResult.form_type,
        overall_confidence: autofillResult.overall_confidence,
        processing_time_ms: autofillResult.processing_time_ms,
        fields_filled: Object.keys(aiFilledData).length,
        fields_requiring_review: fieldsRequiringReview.length,
        missing_documents: autofillResult.missing_documents,
        warnings: autofillResult.warnings,
        citations_count: Object.keys(fieldCitations).length > 0
          ? Object.values(fieldCitations).reduce((sum, c) => sum + c.length, 0)
          : 0,
      },
      gaps,
    });
```

### Step 4: Verify build

Run: `npx tsc --noEmit`
Expected: Clean

### Step 5: Commit

```bash
git add src/app/api/forms/[id]/autofill/route.ts
git commit -m "feat(citations): store citations in ai_filled_data._metadata

Pass raw_text from document analysis through to autofill pipeline.
Store per-field citations in _metadata.citations on the form record.
Include citation count in API response."
```

---

## Task 5: Full Build & Test Verification

Run the complete test suite and build to ensure no regressions.

### Step 1: Run all citation tests

Run: `npx vitest run src/lib/ai/citations.test.ts`
Expected: ALL PASS

### Step 2: Run all AI tests

Run: `npx vitest run src/lib/ai/`
Expected: ALL PASS

### Step 3: Run form autofill route tests

Run: `npx vitest run src/app/api/forms/`
Expected: ALL PASS

### Step 4: Run full test suite

Run: `npx vitest run`
Expected: 2,289+ passed, 0 failures

### Step 5: Run production build

Run: `npm run build`
Expected: Passes with 0 TypeScript errors

### Step 6: Run lint

Run: `npm run lint`
Expected: 0 errors, 0 warnings

### Step 7: Commit (if any test fixes needed)

```bash
git add -A
git commit -m "test: verify citations integration — all tests pass"
```

---

## Task 6: Update Context Docs

Update project context files to reflect the completed Citations phase.

**Files:**
- Modify: `.claude/CONTEXT.md`
- Modify: `.claude/agents/TODO.md`

### Step 1: Update CONTEXT.md

Add under AI Integration notes or a new section:
- Citations feature complete (Phase 4)
- Two-pass architecture: structured autofill + citation generation
- Feature-flagged: `AI_CITATIONS_ENABLED=true`
- Per-field citations stored in `ai_filled_data._metadata.citations`

### Step 2: Update TODO.md

Mark Phase 4 complete. Note that `AI_CITATIONS_ENABLED` needs to be set on Vercel production to activate.

### Step 3: Commit

```bash
git add .claude/CONTEXT.md .claude/agents/TODO.md
git commit -m "docs: update context for Phase 4 Citations completion"
```
