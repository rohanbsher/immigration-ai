# RFE Prevention Engine - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a proactive RFE (Request for Evidence) risk assessment engine that analyzes cases before filing and flags weaknesses that commonly trigger USCIS RFEs — the #1 unbuilt feature ($100-200/mo value, no competitor has it).

**Architecture:** Rule-based engine with typed rules per visa type. Phase 1 uses deterministic structural rules (document presence, math checks, date validation) — no AI calls needed, runs in <100ms. Integrates alongside existing success score and document completeness as a third AI panel on the case detail page. Follows the exact same patterns: lib module + API route + React Query hook + AI component panel.

**Tech Stack:** TypeScript, Supabase (PostgreSQL), Next.js API routes, React Query, BullMQ (Phase 2 only), Zod validation

---

## Background

### What is an RFE?
USCIS issues Requests for Evidence when a petition has weaknesses. RFEs delay cases by 2-6 months and cost attorneys 5-15 hours of additional work per case. Prevention is worth $100-200/mo to firms.

### Competitive Advantage
No competitor offers proactive, visa-type-specific RFE risk scoring. Imagility has RFE *response* tools (after the fact). immiONE's RFE Copilot helps draft responses. Nobody prevents RFEs before filing.

### Top RFE Triggers by Visa Type (from research)

**H-1B:** Specialty occupation proof (SOC code vs OOH), wage level inconsistency, employer-employee relationship for staffing firms, LCA-petition mismatches
**I-130:** Insufficient bona fide marriage evidence (< 4 categories), missing joint financials, no co-habitation proof
**I-485:** Missing I-693 medical exam (hard block since Dec 2024), affidavit of support income below 125% FPG, unlawful presence
**I-140:** Employer ability to pay (net income < proffered wage), vague experience letter dates, degree field mismatch

### Scoring Methodology
Additive risk penalty scoring (different from success probability's weighted average):
```
RFERiskScore = 100 - sum(rule.severity_penalty * rule.confidence)
  critical: 30 points | high: 15 points | medium: 8 points | low: 3 points
```

---

## Existing Patterns to Follow

### AI Module Pattern (`src/lib/ai/`)
```typescript
// Each AI feature is a standalone module that:
// 1. Exports a main analysis function
// 2. Queries Supabase for case data
// 3. Returns a typed result interface
// 4. Has a resolveClient() pattern for worker compatibility
// See: src/lib/ai/document-completeness.ts, src/lib/ai/success-probability.ts
```

### API Route Pattern (`src/app/api/cases/[id]/`)
```typescript
// Each AI API route:
// 1. Auth check → AI consent → rate limit → case access (IDOR) check
// 2. Check DB cache (cases.ai_* columns) — serve if fresh
// 3. If WORKER_ENABLED: enqueue job, return 202 with jobId
// 4. Else: run analysis synchronously, cache result, return 200
// 5. On error: return { ..., degraded: true } not 500
// See: src/app/api/cases/[id]/success-score/route.ts
```

### Hook Pattern (`src/hooks/`)
```typescript
// Each AI hook:
// 1. useQuery with fetchJobAware (handles 200 sync + 202 async polling)
// 2. Configurable staleTime (5min for completeness, 1hr for success score)
// 3. Returns { data, isLoading, error }
// 4. Companion invalidation hook
// See: src/hooks/use-success-score.ts
```

### Component Pattern (`src/components/ai/`)
```typescript
// Each AI panel:
// 1. Supports variant prop: 'full' | 'compact' | 'mini'
// 2. Shows AILoading while fetching
// 3. Shows gentle empty state when degraded: true
// 4. Wraps in AIContentBox
// See: src/components/ai/document-completeness-panel.tsx
```

---

## Task 1: Database Migration — RFE Assessment Tables

**Files:**
- Create: `supabase/migrations/064_rfe_assessments.sql`

**Step 1: Write the migration**

```sql
-- RFE Assessment tracking table
CREATE TABLE public.rfe_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  visa_type TEXT NOT NULL,
  rfe_risk_score INTEGER NOT NULL CHECK (rfe_risk_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  estimated_rfe_probability NUMERIC(4,3) NOT NULL CHECK (estimated_rfe_probability BETWEEN 0 AND 1),
  triggered_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  safe_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_confidence NUMERIC(4,3) NOT NULL CHECK (data_confidence BETWEEN 0 AND 1),
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'document_uploaded', 'form_filled', 'manual', 'case_created', 'status_changed'
  )),
  assessment_version TEXT NOT NULL DEFAULT '1.0',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rfe_assessments_case_id ON public.rfe_assessments(case_id);
CREATE INDEX idx_rfe_assessments_risk_level ON public.rfe_assessments(risk_level);
CREATE INDEX idx_rfe_assessments_latest ON public.rfe_assessments(case_id, assessed_at DESC);

-- RLS
ALTER TABLE public.rfe_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view RFE assessments for their cases"
  ON public.rfe_assessments FOR SELECT
  USING (public.can_access_case(case_id));

CREATE POLICY "Service role can manage RFE assessments"
  ON public.rfe_assessments FOR ALL
  USING (auth.role() = 'service_role');

-- Cache columns on cases table (mirrors pattern from migration 055)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS rfe_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS rfe_risk_level TEXT CHECK (rfe_risk_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS rfe_assessment JSONB,
  ADD COLUMN IF NOT EXISTS rfe_assessed_at TIMESTAMPTZ;

-- Index for dashboard queries filtering by risk level
CREATE INDEX idx_cases_rfe_risk_level
  ON public.cases(rfe_risk_level)
  WHERE deleted_at IS NULL AND rfe_risk_level IS NOT NULL;

COMMENT ON TABLE public.rfe_assessments IS 'Historical RFE risk assessments per case. Latest cached on cases table.';
COMMENT ON COLUMN public.cases.rfe_risk_score IS 'Cached RFE risk score (0-100, 100=no risk). Updated by assessment engine.';
COMMENT ON COLUMN public.cases.rfe_risk_level IS 'Cached risk level: low/medium/high/critical.';
```

**Step 2: Apply migration to production**

```bash
# Mark as applied if running manually via Supabase SQL editor:
supabase migration repair --status applied 064 --linked
# Or push:
supabase db push --linked
```

**Step 3: Commit**

```bash
git add supabase/migrations/064_rfe_assessments.sql
git commit -m "feat(db): add rfe_assessments table and cache columns on cases"
```

---

## Task 2: RFE Rule Engine Types and Interface

**Files:**
- Create: `src/lib/ai/rfe/types.ts`

**Step 1: Write the type definitions**

```typescript
/**
 * RFE Prevention Engine — Type definitions.
 *
 * Rules are deterministic checks that evaluate specific RFE risk factors
 * per visa type. Each rule is self-contained and independently testable.
 */

import type { VisaType, DocumentType } from '@/types';

// ---------------------------------------------------------------------------
// Risk Categories
// ---------------------------------------------------------------------------

export type RFERiskCategory =
  | 'document_presence'    // Required doc is missing
  | 'document_content'     // Doc exists but content is weak (Phase 2)
  | 'cross_document'       // Inconsistency between docs (Phase 2)
  | 'form_consistency'     // Form field issues
  | 'financial'            // Income/wage calculations
  | 'timeline'             // Date/deadline issues
  | 'procedural';          // Process requirements (e.g., I-693 policy)

export type RFESeverity = 'critical' | 'high' | 'medium' | 'low';

export type RFERiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Rule Interface
// ---------------------------------------------------------------------------

export interface RFERuleResult {
  triggered: boolean;
  confidence: number;       // 0-1: how certain the evaluation is correct
  evidence: string[];       // Human-readable evidence strings
  details?: string;         // Extended explanation for the attorney
}

export interface RFERule {
  id: string;               // e.g., "H1B-SPECIALTY-001"
  visaTypes: VisaType[];    // Which visa types this rule applies to
  category: RFERiskCategory;
  severity: RFESeverity;
  title: string;            // Short title for display
  description: string;      // What USCIS looks for
  recommendation: string;   // Specific attorney action to take
  evaluate: (context: RFEAnalysisContext) => RFERuleResult;
}

// ---------------------------------------------------------------------------
// Analysis Context (data gathered for rule evaluation)
// ---------------------------------------------------------------------------

export interface RFEAnalysisContext {
  caseId: string;
  visaType: VisaType;
  caseStatus: string;
  deadline: string | null;

  /** Document types that have been uploaded (non-deleted) */
  uploadedDocumentTypes: Set<DocumentType>;

  /** Required document types from the checklist */
  requiredDocumentTypes: Set<DocumentType>;

  /** AI-extracted data from each uploaded document, keyed by document type */
  extractedData: Map<DocumentType, Record<string, unknown>>;

  /** Form data from USCIS forms associated with this case */
  formData: Map<string, Record<string, unknown>>;

  /** Form types present on the case */
  formTypes: string[];

  /** Total number of bona fide marriage evidence categories (for I-130) */
  bonaFideEvidenceCount: number;

  /** Employer info extracted from forms or documents */
  employerInfo: {
    companyName?: string;
    industry?: string;
    employeeCount?: number;
    annualIncome?: number;
    netIncome?: number;
    companyAge?: number;      // years
    isStaffingFirm?: boolean;
  };

  /** Beneficiary info */
  beneficiaryInfo: {
    yearsOfExperience?: number;
    degreeField?: string;
    degreeType?: string;
    countryOfBirth?: string;
  };

  /** Financial info (for I-485 affidavit of support) */
  financialInfo: {
    sponsorIncome?: number;
    householdSize?: number;
    federalPovertyGuideline?: number;
  };
}

// ---------------------------------------------------------------------------
// Assessment Result
// ---------------------------------------------------------------------------

export interface TriggeredRule {
  ruleId: string;
  severity: RFESeverity;
  category: RFERiskCategory;
  title: string;
  description: string;
  recommendation: string;
  evidence: string[];
  confidence: number;
}

export interface RFEAssessmentResult {
  caseId: string;
  visaType: VisaType;
  rfeRiskScore: number;         // 0-100 (100 = no risk)
  riskLevel: RFERiskLevel;
  estimatedRFEProbability: number; // 0.0-1.0
  triggeredRules: TriggeredRule[];
  safeRuleIds: string[];        // Rules checked but not triggered
  priorityActions: string[];    // Ordered recommendations
  dataConfidence: number;       // 0-1: how much data was available
  assessedAt: string;
  assessmentVersion: string;
}

// ---------------------------------------------------------------------------
// Severity Penalty Constants
// ---------------------------------------------------------------------------

export const SEVERITY_PENALTIES: Record<RFESeverity, number> = {
  critical: 30,
  high: 15,
  medium: 8,
  low: 3,
};
```

**Step 2: Commit**

```bash
git add src/lib/ai/rfe/types.ts
git commit -m "feat(rfe): add RFE rule engine type definitions"
```

---

## Task 3: Phase 1 Rule Library (Structural Rules)

**Files:**
- Create: `src/lib/ai/rfe/rules/index.ts`
- Create: `src/lib/ai/rfe/rules/h1b-rules.ts`
- Create: `src/lib/ai/rfe/rules/i130-rules.ts`
- Create: `src/lib/ai/rfe/rules/i485-rules.ts`
- Create: `src/lib/ai/rfe/rules/i140-rules.ts`
- Create: `src/lib/ai/rfe/rules/common-rules.ts`

**Step 1: Write H-1B rules**

File: `src/lib/ai/rfe/rules/h1b-rules.ts`

```typescript
import type { RFERule } from '../types';

export const h1bRules: RFERule[] = [
  {
    id: 'H1B-EER-001',
    visaTypes: ['H1B'],
    category: 'document_presence',
    severity: 'high',
    title: 'No end-client documentation for staffing/consulting employer',
    description:
      'USCIS requires evidence of employer-employee relationship when the worksite is a third-party client. Staffing, consulting, and IT services firms must provide end-client letters, SOWs, or project itineraries.',
    recommendation:
      'Upload an end-client letter or Statement of Work (SOW) that names the beneficiary, describes the role, and confirms the petitioner controls the employee\'s day-to-day work.',
    evaluate: (ctx) => {
      if (!ctx.employerInfo.isStaffingFirm) {
        return { triggered: false, confidence: 0.9, evidence: [] };
      }

      const hasEndClientLetter = ctx.uploadedDocumentTypes.has('employment_letter');
      // Check for SOW-like documents in extracted data
      const hasSow = Array.from(ctx.extractedData.values()).some(
        (data) =>
          typeof data.document_subtype === 'string' &&
          ['sow', 'statement_of_work', 'client_letter', 'end_client'].some((t) =>
            (data.document_subtype as string).toLowerCase().includes(t)
          )
      );

      if (!hasEndClientLetter && !hasSow) {
        return {
          triggered: true,
          confidence: 0.8,
          evidence: [
            'Employer appears to be a staffing/consulting firm',
            'No end-client letter or Statement of Work found in uploaded documents',
          ],
          details:
            'USCIS uses the Neufeld Memo criteria to evaluate employer-employee relationships for third-party placement. Without a client letter, the petition is very likely to receive an RFE.',
        };
      }

      return { triggered: false, confidence: 0.8, evidence: [] };
    },
  },
  {
    id: 'H1B-WAGE-001',
    visaTypes: ['H1B'],
    category: 'form_consistency',
    severity: 'medium',
    title: 'Wage Level I with experienced beneficiary',
    description:
      'A Level I (entry-level) wage paired with a beneficiary who has 5+ years of experience raises USCIS scrutiny about whether the position truly requires only entry-level skills.',
    recommendation:
      'If the beneficiary has significant experience, consider whether the wage level should be Level II or higher. If Level I is correct (e.g., new role in a different specialty), document the justification clearly in the support letter.',
    evaluate: (ctx) => {
      const yearsExp = ctx.beneficiaryInfo.yearsOfExperience;
      if (yearsExp === undefined || yearsExp < 5) {
        return { triggered: false, confidence: 0.7, evidence: [] };
      }

      // Check form data for wage level
      const i129Data = ctx.formData.get('I-129');
      const lcaWageLevel = i129Data?.wage_level as string | undefined;

      if (lcaWageLevel && lcaWageLevel.toLowerCase().includes('level i') && !lcaWageLevel.toLowerCase().includes('level ii')) {
        return {
          triggered: true,
          confidence: 0.75,
          evidence: [
            `Beneficiary has ${yearsExp} years of experience`,
            `Wage level is set to Level I (entry-level)`,
          ],
          details:
            'USCIS may question why an experienced professional is being offered an entry-level wage, suggesting the position may not be a true specialty occupation.',
        };
      }

      return { triggered: false, confidence: 0.6, evidence: [] };
    },
  },
  {
    id: 'H1B-LCA-001',
    visaTypes: ['H1B'],
    category: 'form_consistency',
    severity: 'medium',
    title: 'LCA job title may differ from petition job title',
    description:
      'The job title on the Labor Condition Application (LCA) must match the I-129 petition exactly. Mismatches trigger RFEs.',
    recommendation:
      'Verify that the job title in Part 2 of the I-129 exactly matches the LCA job title. Even minor differences (e.g., "Software Engineer" vs. "Software Developer") can trigger an RFE.',
    evaluate: (ctx) => {
      const i129Data = ctx.formData.get('I-129');
      if (!i129Data?.job_title) {
        return { triggered: false, confidence: 0.3, evidence: ['No I-129 form data available'] };
      }
      // Phase 1: flag as informational if we can't cross-check LCA
      // (LCA data not yet in system — future enhancement)
      return {
        triggered: false,
        confidence: 0.3,
        evidence: ['LCA cross-check requires LCA document upload (not yet supported)'],
      };
    },
  },
];
```

**Step 2: Write I-130 rules**

File: `src/lib/ai/rfe/rules/i130-rules.ts`

```typescript
import type { RFERule } from '../types';

const BONA_FIDE_DOCUMENT_TYPES = [
  'marriage_certificate',
  'bank_statement',        // Joint bank account
  'tax_return',            // Joint tax return
  'utility_bill',          // Shared address proof
] as const;

export const i130Rules: RFERule[] = [
  {
    id: 'I130-BONA-001',
    visaTypes: ['I-130'],
    category: 'document_presence',
    severity: 'high',
    title: 'Insufficient bona fide marriage evidence',
    description:
      'USCIS requires substantial evidence of a genuine marriage. Petitions with fewer than 4 categories of evidence (joint finances, shared residence, photos, affidavits) are very likely to receive an RFE.',
    recommendation:
      'Upload at least 4 categories of evidence: (1) joint bank statements, (2) joint tax return, (3) shared lease or mortgage, (4) photos together across multiple time periods. Also consider affidavits from friends/family and joint insurance policies.',
    evaluate: (ctx) => {
      const evidenceCount = ctx.bonaFideEvidenceCount;

      if (evidenceCount < 4) {
        const missing: string[] = [];
        if (!ctx.uploadedDocumentTypes.has('bank_statement')) missing.push('Joint bank statements');
        if (!ctx.uploadedDocumentTypes.has('tax_return')) missing.push('Joint tax return');
        if (!ctx.uploadedDocumentTypes.has('utility_bill')) missing.push('Shared address proof (lease/utility)');

        return {
          triggered: true,
          confidence: 0.9,
          evidence: [
            `Only ${evidenceCount} category(ies) of bona fide marriage evidence found`,
            `USCIS expects at least 4 categories`,
            ...missing.map((m) => `Missing: ${m}`),
          ],
          details:
            'The marriage certificate alone is never sufficient. USCIS requires corroborating evidence from multiple independent sources to establish the marriage is genuine.',
        };
      }

      return { triggered: false, confidence: 0.9, evidence: [] };
    },
  },
  {
    id: 'I130-BONA-002',
    visaTypes: ['I-130'],
    category: 'document_presence',
    severity: 'medium',
    title: 'No joint financial account evidence',
    description:
      'Joint bank accounts are one of the strongest indicators of a bona fide marriage. Their absence is a common RFE trigger.',
    recommendation:
      'Upload recent joint bank statements (last 3-6 months) showing both spouses\' names. If no joint account exists, provide a letter explaining why and substitute with other financial commingling evidence.',
    evaluate: (ctx) => {
      if (!ctx.uploadedDocumentTypes.has('bank_statement')) {
        return {
          triggered: true,
          confidence: 0.85,
          evidence: ['No bank statements found in uploaded documents'],
        };
      }
      return { triggered: false, confidence: 0.85, evidence: [] };
    },
  },
  {
    id: 'I130-PRIOR-001',
    visaTypes: ['I-130'],
    category: 'document_presence',
    severity: 'medium',
    title: 'Possible prior marriage without dissolution proof',
    description:
      'If either spouse was previously married, USCIS requires proof of legal termination (divorce decree, death certificate, annulment) of all prior marriages.',
    recommendation:
      'Upload divorce decrees or other legal dissolution documents for all prior marriages of both spouses.',
    evaluate: (ctx) => {
      // Check if divorce certificate is in the checklist but not uploaded
      if (
        ctx.requiredDocumentTypes.has('divorce_certificate') &&
        !ctx.uploadedDocumentTypes.has('divorce_certificate')
      ) {
        return {
          triggered: true,
          confidence: 0.8,
          evidence: [
            'Divorce certificate is listed as required but not uploaded',
            'Prior marriage dissolution must be documented',
          ],
        };
      }
      return { triggered: false, confidence: 0.6, evidence: [] };
    },
  },
];
```

**Step 3: Write I-485 rules**

File: `src/lib/ai/rfe/rules/i485-rules.ts`

```typescript
import type { RFERule } from '../types';

// 2025 Federal Poverty Guidelines (48 contiguous states)
// Source: HHS. Updated annually in January.
const FPG_2025: Record<number, number> = {
  1: 15_650, 2: 21_150, 3: 26_650, 4: 32_150,
  5: 37_650, 6: 43_150, 7: 48_650, 8: 54_150,
};
const FPG_PER_ADDITIONAL = 5_500;

function getFPG125(householdSize: number): number {
  const base = FPG_2025[Math.min(householdSize, 8)] ??
    FPG_2025[8]! + FPG_PER_ADDITIONAL * (householdSize - 8);
  return Math.ceil(base * 1.25);
}

export const i485Rules: RFERule[] = [
  {
    id: 'I485-MED-001',
    visaTypes: ['I-485'],
    category: 'procedural',
    severity: 'critical',
    title: 'Medical exam (I-693) not uploaded',
    description:
      'Since December 2, 2024, USCIS REJECTS (not just RFEs) I-485 applications filed without a sealed I-693 medical exam. This is a hard block.',
    recommendation:
      'The I-693 medical exam from a USCIS-designated civil surgeon MUST be included with the I-485 filing. Schedule the medical exam immediately and upload the sealed I-693.',
    evaluate: (ctx) => {
      if (!ctx.uploadedDocumentTypes.has('medical_exam')) {
        return {
          triggered: true,
          confidence: 0.95,
          evidence: [
            'I-693 medical exam not found in uploaded documents',
            'Since Dec 2024, USCIS rejects I-485 filings without I-693 (not just RFE)',
          ],
          details:
            'This is the single most critical document for I-485. USCIS changed their policy in December 2024 to reject applications outright rather than issuing RFEs for missing medical exams.',
        };
      }
      return { triggered: false, confidence: 0.95, evidence: [] };
    },
  },
  {
    id: 'I485-SUPPORT-001',
    visaTypes: ['I-485'],
    category: 'financial',
    severity: 'high',
    title: 'Sponsor income may be below 125% Federal Poverty Guidelines',
    description:
      'The I-864 affidavit of support requires the sponsor\'s income to be at least 125% of the Federal Poverty Guidelines for the declared household size.',
    recommendation:
      'Verify the sponsor\'s income exceeds the 125% FPG threshold. If below, add a joint sponsor with sufficient income or include evidence of assets worth 3x the income gap.',
    evaluate: (ctx) => {
      const { sponsorIncome, householdSize } = ctx.financialInfo;
      if (sponsorIncome === undefined || householdSize === undefined) {
        return {
          triggered: false,
          confidence: 0.3,
          evidence: ['Insufficient financial data to evaluate — upload tax returns and I-864'],
        };
      }

      const threshold = getFPG125(householdSize);
      if (sponsorIncome < threshold) {
        return {
          triggered: true,
          confidence: 0.85,
          evidence: [
            `Sponsor income: $${sponsorIncome.toLocaleString()}`,
            `Required (125% FPG for household of ${householdSize}): $${threshold.toLocaleString()}`,
            `Shortfall: $${(threshold - sponsorIncome).toLocaleString()}`,
          ],
          details:
            'The sponsor must demonstrate ability to maintain the intending immigrant at 125% of FPG. If income is insufficient, a joint sponsor or assets (3x the shortfall) are required.',
        };
      }

      return { triggered: false, confidence: 0.85, evidence: [] };
    },
  },
  {
    id: 'I485-SUPPORT-002',
    visaTypes: ['I-485'],
    category: 'document_presence',
    severity: 'medium',
    title: 'Tax return may be outdated',
    description:
      'USCIS requires the most recent tax return. Filing early in the year without the prior year\'s return is a common RFE trigger.',
    recommendation:
      'Ensure the most recent tax return is uploaded. If filing between January and April, include a letter explaining the prior year return is not yet available, along with W-2s and recent pay stubs.',
    evaluate: (ctx) => {
      if (!ctx.uploadedDocumentTypes.has('tax_return')) {
        return {
          triggered: true,
          confidence: 0.8,
          evidence: ['No tax return found in uploaded documents'],
        };
      }
      return { triggered: false, confidence: 0.7, evidence: [] };
    },
  },
  {
    id: 'I485-POLICE-001',
    visaTypes: ['I-485'],
    category: 'document_presence',
    severity: 'medium',
    title: 'Police clearance certificate may be missing',
    description:
      'Applicants who lived in certain countries for 6+ months after age 16 must provide police clearance certificates. Missing clearances trigger RFEs.',
    recommendation:
      'Review the applicant\'s residence history. For each country where they lived 6+ months after age 16, obtain a police clearance certificate.',
    evaluate: (ctx) => {
      if (
        ctx.requiredDocumentTypes.has('police_clearance') &&
        !ctx.uploadedDocumentTypes.has('police_clearance')
      ) {
        return {
          triggered: true,
          confidence: 0.8,
          evidence: ['Police clearance certificate is required but not uploaded'],
        };
      }
      return { triggered: false, confidence: 0.6, evidence: [] };
    },
  },
];
```

**Step 4: Write I-140 rules**

File: `src/lib/ai/rfe/rules/i140-rules.ts`

```typescript
import type { RFERule } from '../types';

export const i140Rules: RFERule[] = [
  {
    id: 'I140-PAY-001',
    visaTypes: ['EB1', 'EB2', 'EB3'],
    category: 'financial',
    severity: 'high',
    title: 'Employer net income may not support the proffered wage',
    description:
      'USCIS requires the petitioning employer to demonstrate ability to pay the proffered wage from the priority date onward. If the employer\'s net income is below the proffered wage, an RFE is likely.',
    recommendation:
      'Upload the employer\'s most recent 2-3 years of tax returns (IRS Form 1120 or 1120S). If net income is below the proffered wage, also provide audited financial statements and payroll records showing the beneficiary is already being paid.',
    evaluate: (ctx) => {
      const { netIncome } = ctx.employerInfo;
      if (netIncome === undefined) {
        return {
          triggered: false,
          confidence: 0.3,
          evidence: ['Employer financial data not available — upload corporate tax returns'],
        };
      }

      // We'd need the proffered wage from the PERM/I-140 form
      // For now, flag if net income seems low relative to company size
      if (netIncome <= 0) {
        return {
          triggered: true,
          confidence: 0.7,
          evidence: [
            `Employer reported net income: $${netIncome.toLocaleString()}`,
            'Negative or zero net income makes ability-to-pay difficult to prove',
          ],
          details:
            'USCIS uses three tests for ability to pay: (1) net income >= proffered wage, (2) net current assets >= proffered wage, or (3) employee is already being paid the wage. Supplement with payroll records if net income is low.',
        };
      }

      return { triggered: false, confidence: 0.5, evidence: [] };
    },
  },
  {
    id: 'I140-EDU-001',
    visaTypes: ['EB2', 'EB3', 'H1B'],
    category: 'document_presence',
    severity: 'medium',
    title: 'Degree/diploma not uploaded',
    description:
      'Employment-based petitions require evidence of the beneficiary\'s educational qualifications. Missing diploma or transcript is a common RFE trigger.',
    recommendation:
      'Upload the beneficiary\'s diploma and official transcripts. For foreign degrees, also include a NACES-accredited credential evaluation.',
    evaluate: (ctx) => {
      const hasDiploma = ctx.uploadedDocumentTypes.has('diploma');
      const hasTranscript = ctx.uploadedDocumentTypes.has('transcript');

      if (!hasDiploma && !hasTranscript) {
        return {
          triggered: true,
          confidence: 0.85,
          evidence: [
            'Neither diploma nor transcript found in uploaded documents',
            'Educational credential evidence is required for employment-based petitions',
          ],
        };
      }

      if (!hasDiploma) {
        return {
          triggered: true,
          confidence: 0.7,
          evidence: ['Diploma not found — transcript alone may be insufficient'],
        };
      }

      return { triggered: false, confidence: 0.85, evidence: [] };
    },
  },
];
```

**Step 5: Write common rules and barrel export**

File: `src/lib/ai/rfe/rules/common-rules.ts`

```typescript
import type { RFERule, RFEAnalysisContext } from '../types';

export const commonRules: RFERule[] = [
  {
    id: 'COMMON-PASSPORT-001',
    visaTypes: ['H1B', 'H4', 'L1', 'O1', 'F1', 'B1B2', 'EB1', 'EB2', 'EB3', 'EB5', 'I-130', 'I-485', 'I-765', 'I-131', 'N-400'],
    category: 'document_presence',
    severity: 'high',
    title: 'Passport not uploaded',
    description:
      'A valid passport is required for virtually all immigration petitions. Missing passport is one of the simplest RFE triggers to prevent.',
    recommendation: 'Upload a copy of the beneficiary\'s valid passport (biographical page). Ensure the passport has at least 6 months validity beyond the intended stay.',
    evaluate: (ctx) => {
      if (ctx.requiredDocumentTypes.has('passport') && !ctx.uploadedDocumentTypes.has('passport')) {
        return {
          triggered: true,
          confidence: 0.95,
          evidence: ['Passport is required but not found in uploaded documents'],
        };
      }
      return { triggered: false, confidence: 0.95, evidence: [] };
    },
  },
  {
    id: 'COMMON-PHOTO-001',
    visaTypes: ['H1B', 'L1', 'O1', 'I-485', 'I-765', 'I-131', 'N-400'],
    category: 'document_presence',
    severity: 'low',
    title: 'Passport-style photos not uploaded',
    description: 'Most USCIS forms require passport-style photographs meeting specific technical requirements.',
    recommendation: 'Upload 2 passport-style photographs (2x2 inches, white background, taken within 6 months).',
    evaluate: (ctx) => {
      if (ctx.requiredDocumentTypes.has('photo') && !ctx.uploadedDocumentTypes.has('photo')) {
        return {
          triggered: true,
          confidence: 0.7,
          evidence: ['Passport photos required but not uploaded'],
        };
      }
      return { triggered: false, confidence: 0.7, evidence: [] };
    },
  },
  {
    id: 'COMMON-DEADLINE-001',
    visaTypes: ['H1B', 'H4', 'L1', 'O1', 'F1', 'B1B2', 'EB1', 'EB2', 'EB3', 'EB5', 'I-130', 'I-485', 'I-765', 'I-131', 'N-400'],
    category: 'timeline',
    severity: 'medium',
    title: 'Filing deadline is approaching with incomplete documents',
    description: 'Cases filed under time pressure with incomplete documentation are more likely to contain errors that trigger RFEs.',
    recommendation: 'Prioritize completing all required documents before the deadline. If documents cannot be obtained in time, consider filing with a cover letter explaining what will be supplemented.',
    evaluate: (ctx) => {
      if (!ctx.deadline) {
        return { triggered: false, confidence: 0.3, evidence: [] };
      }

      const daysUntilDeadline = Math.ceil(
        (new Date(ctx.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const missingRequired = [...ctx.requiredDocumentTypes].filter(
        (t) => !ctx.uploadedDocumentTypes.has(t)
      );

      if (daysUntilDeadline <= 14 && missingRequired.length > 0) {
        return {
          triggered: true,
          confidence: 0.7,
          evidence: [
            `Filing deadline in ${daysUntilDeadline} days`,
            `${missingRequired.length} required document(s) still missing`,
          ],
        };
      }

      return { triggered: false, confidence: 0.7, evidence: [] };
    },
  },
];
```

File: `src/lib/ai/rfe/rules/index.ts`

```typescript
import { commonRules } from './common-rules';
import { h1bRules } from './h1b-rules';
import { i130Rules } from './i130-rules';
import { i485Rules } from './i485-rules';
import { i140Rules } from './i140-rules';
import type { RFERule } from '../types';
import type { VisaType } from '@/types';

/** All registered rules. */
export const ALL_RULES: RFERule[] = [
  ...commonRules,
  ...h1bRules,
  ...i130Rules,
  ...i485Rules,
  ...i140Rules,
];

/**
 * Get rules applicable to a specific visa type.
 */
export function getRulesForVisaType(visaType: VisaType): RFERule[] {
  return ALL_RULES.filter((rule) => rule.visaTypes.includes(visaType));
}
```

**Step 6: Commit**

```bash
git add src/lib/ai/rfe/rules/
git commit -m "feat(rfe): add Phase 1 structural rules for H-1B, I-130, I-485, I-140"
```

---

## Task 4: RFE Assessment Engine (Core Module)

**Files:**
- Create: `src/lib/ai/rfe/assessment.ts`
- Create: `src/lib/ai/rfe/index.ts`

**Step 1: Write the assessment engine**

File: `src/lib/ai/rfe/assessment.ts`

```typescript
/**
 * RFE Assessment Engine
 *
 * Gathers case data, runs applicable rules, and produces
 * a risk assessment. Phase 1: structural/deterministic rules only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentType, VisaType } from '@/types';
import { createLogger } from '@/lib/logger';
import { getRulesForVisaType } from './rules';
import {
  SEVERITY_PENALTIES,
  type RFEAnalysisContext,
  type RFEAssessmentResult,
  type RFERiskLevel,
  type TriggeredRule,
} from './types';

const log = createLogger('rfe-assessment');

const ASSESSMENT_VERSION = '1.0';

// Bona fide evidence types for I-130 counting
const BONA_FIDE_TYPES: DocumentType[] = [
  'marriage_certificate',
  'bank_statement',
  'tax_return',
  'utility_bill',
  'photo',
];

/**
 * Resolve a Supabase client: use the provided one, or lazily import
 * the cookie-based server client (Next.js only).
 */
async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient> {
  if (client) return client;
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * Build the analysis context by gathering case data from the database.
 */
async function buildContext(
  caseId: string,
  supabase: SupabaseClient
): Promise<RFEAnalysisContext> {
  // Fetch case
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('visa_type, status, deadline')
    .eq('id', caseId)
    .is('deleted_at', null)
    .single();

  if (caseError || !caseData) throw new Error('Case not found');

  // Fetch documents
  const { data: documents } = await supabase
    .from('documents')
    .select('document_type, ai_extracted_data, status')
    .eq('case_id', caseId)
    .is('deleted_at', null);

  // Fetch document checklist
  const { data: checklist } = await supabase
    .from('document_checklists')
    .select('document_type, required')
    .eq('visa_type', caseData.visa_type);

  // Fetch forms
  const { data: forms } = await supabase
    .from('forms')
    .select('form_type, form_data, ai_filled_data')
    .eq('case_id', caseId)
    .is('deleted_at', null);

  // Build uploaded document types set
  const uploadedDocumentTypes = new Set<DocumentType>(
    (documents || []).map((d) => d.document_type as DocumentType)
  );

  // Build required document types set
  const requiredDocumentTypes = new Set<DocumentType>(
    (checklist || [])
      .filter((c) => c.required)
      .map((c) => c.document_type as DocumentType)
  );

  // Build extracted data map
  const extractedData = new Map<DocumentType, Record<string, unknown>>();
  for (const doc of documents || []) {
    if (doc.ai_extracted_data) {
      extractedData.set(
        doc.document_type as DocumentType,
        doc.ai_extracted_data as Record<string, unknown>
      );
    }
  }

  // Build form data map
  const formData = new Map<string, Record<string, unknown>>();
  for (const form of forms || []) {
    const data = (form.form_data || form.ai_filled_data) as Record<string, unknown> | null;
    if (data) {
      formData.set(form.form_type, data);
    }
  }

  // Count bona fide marriage evidence categories
  const bonaFideEvidenceCount = BONA_FIDE_TYPES.filter((t) =>
    uploadedDocumentTypes.has(t)
  ).length;

  // Extract employer info from forms or documents
  const i129Data = formData.get('I-129') as Record<string, unknown> | undefined;
  const empLetterData = extractedData.get('employment_letter');

  return {
    caseId,
    visaType: caseData.visa_type as VisaType,
    caseStatus: caseData.status,
    deadline: caseData.deadline,
    uploadedDocumentTypes,
    requiredDocumentTypes,
    extractedData,
    formData,
    formTypes: (forms || []).map((f) => f.form_type),
    bonaFideEvidenceCount,
    employerInfo: {
      companyName: i129Data?.company_name as string | undefined,
      employeeCount: i129Data?.number_of_employees
        ? Number(i129Data.number_of_employees)
        : undefined,
      annualIncome: i129Data?.gross_annual_income
        ? Number(i129Data.gross_annual_income)
        : undefined,
      netIncome: i129Data?.net_annual_income
        ? Number(i129Data.net_annual_income)
        : undefined,
      isStaffingFirm: false, // Default; enriched in Phase 2
    },
    beneficiaryInfo: {
      degreeField: extractedData.get('diploma')?.field_of_study as string | undefined,
      degreeType: extractedData.get('diploma')?.degree_type as string | undefined,
    },
    financialInfo: {
      sponsorIncome: extractedData.get('tax_return')?.adjusted_gross_income
        ? Number(extractedData.get('tax_return')?.adjusted_gross_income)
        : undefined,
      householdSize: i129Data?.household_size
        ? Number(i129Data.household_size)
        : undefined,
    },
  };
}

/**
 * Calculate risk level from score.
 */
function scoreToRiskLevel(score: number): RFERiskLevel {
  if (score >= 85) return 'low';
  if (score >= 65) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

/**
 * Estimate RFE probability from risk score.
 */
function scoreToRFEProbability(score: number): number {
  // Inverse mapping: high score = low probability
  return Math.round((1 - score / 100) * 1000) / 1000;
}

/**
 * Run RFE assessment for a case.
 */
export async function assessRFERisk(
  caseId: string,
  triggerEvent: string = 'manual',
  supabaseClient?: SupabaseClient
): Promise<RFEAssessmentResult> {
  const supabase = await resolveClient(supabaseClient);
  const context = await buildContext(caseId, supabase);

  // Get applicable rules
  const rules = getRulesForVisaType(context.visaType);

  // Evaluate each rule
  const triggeredRules: TriggeredRule[] = [];
  const safeRuleIds: string[] = [];

  for (const rule of rules) {
    try {
      const result = rule.evaluate(context);
      if (result.triggered) {
        triggeredRules.push({
          ruleId: rule.id,
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          description: rule.description,
          recommendation: rule.recommendation,
          evidence: result.evidence,
          confidence: result.confidence,
        });
      } else {
        safeRuleIds.push(rule.id);
      }
    } catch (error) {
      log.warn(`Rule ${rule.id} failed to evaluate`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Skip failed rules — don't let one broken rule tank the whole assessment
    }
  }

  // Calculate risk score
  const totalPenalty = triggeredRules.reduce(
    (sum, r) => sum + SEVERITY_PENALTIES[r.severity] * r.confidence,
    0
  );
  const rfeRiskScore = Math.max(0, Math.round(100 - totalPenalty));

  // Calculate data confidence (what % of context fields were available)
  const contextFields = [
    context.uploadedDocumentTypes.size > 0,
    context.requiredDocumentTypes.size > 0,
    context.formData.size > 0,
    context.employerInfo.companyName !== undefined,
    context.beneficiaryInfo.degreeField !== undefined,
    context.financialInfo.sponsorIncome !== undefined,
  ];
  const dataConfidence = Math.round(
    (contextFields.filter(Boolean).length / contextFields.length) * 1000
  ) / 1000;

  // Sort triggered rules by severity (critical first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  triggeredRules.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Build priority actions from triggered rules
  const priorityActions = triggeredRules
    .slice(0, 5)
    .map((r) => r.recommendation);

  const assessment: RFEAssessmentResult = {
    caseId,
    visaType: context.visaType,
    rfeRiskScore,
    riskLevel: scoreToRiskLevel(rfeRiskScore),
    estimatedRFEProbability: scoreToRFEProbability(rfeRiskScore),
    triggeredRules,
    safeRuleIds,
    priorityActions,
    dataConfidence,
    assessedAt: new Date().toISOString(),
    assessmentVersion: ASSESSMENT_VERSION,
  };

  // Cache on cases table
  await supabase
    .from('cases')
    .update({
      rfe_risk_score: rfeRiskScore,
      rfe_risk_level: assessment.riskLevel,
      rfe_assessment: assessment as unknown as Record<string, unknown>,
      rfe_assessed_at: assessment.assessedAt,
    })
    .eq('id', caseId);

  // Store in history table (fire-and-forget)
  supabase
    .from('rfe_assessments')
    .insert({
      case_id: caseId,
      visa_type: context.visaType,
      rfe_risk_score: rfeRiskScore,
      risk_level: assessment.riskLevel,
      estimated_rfe_probability: assessment.estimatedRFEProbability,
      triggered_rules: triggeredRules,
      safe_rules: safeRuleIds,
      priority_actions: priorityActions,
      data_confidence: dataConfidence,
      trigger_event: triggerEvent,
      assessment_version: ASSESSMENT_VERSION,
    })
    .then(({ error }) => {
      if (error) log.warn('Failed to store RFE assessment history', { error: error.message });
    });

  return assessment;
}
```

File: `src/lib/ai/rfe/index.ts`

```typescript
export { assessRFERisk } from './assessment';
export type {
  RFEAssessmentResult,
  RFEAnalysisContext,
  RFERule,
  RFERuleResult,
  TriggeredRule,
  RFERiskLevel,
  RFESeverity,
} from './types';
export { getRulesForVisaType, ALL_RULES } from './rules';
```

**Step 2: Commit**

```bash
git add src/lib/ai/rfe/
git commit -m "feat(rfe): implement RFE assessment engine with rule evaluation and caching"
```

---

## Task 5: API Route

**Files:**
- Create: `src/app/api/cases/[id]/rfe-assessment/route.ts`

**Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assessRFERisk } from '@/lib/ai/rfe';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { verifyCaseAccess, successResponse, errorResponse } from '@/lib/auth/api-helpers';

const log = createLogger('api:rfe-assessment');
const rateLimiter = createRateLimiter(RATE_LIMITS.AI_ANALYSIS);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/rfe-assessment
 *
 * Returns RFE risk assessment for a case.
 * Serves cached result if fresh (< 1 hour), otherwise runs new assessment.
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id: caseId } = await params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Rate limiting
    const limitResult = await rateLimiter.limit(request, user.id);
    if (!limitResult.allowed) return limitResult.response;

    // Case access check (IDOR protection)
    const accessResult = await verifyCaseAccess(caseId, user.id);
    if (!accessResult.hasAccess) {
      return errorResponse('Case not found', 404);
    }

    // Check for cached assessment
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    if (!forceRefresh) {
      const { data: caseData } = await supabase
        .from('cases')
        .select('rfe_assessment, rfe_assessed_at')
        .eq('id', caseId)
        .single();

      if (caseData?.rfe_assessment && caseData.rfe_assessed_at) {
        const assessedAt = new Date(caseData.rfe_assessed_at);
        const ageMs = Date.now() - assessedAt.getTime();
        const ONE_HOUR = 60 * 60 * 1000;

        if (ageMs < ONE_HOUR) {
          return successResponse(caseData.rfe_assessment, {
            'Cache-Control': 'private, max-age=3600',
          });
        }
      }
    }

    // Run fresh assessment
    const result = await assessRFERisk(caseId, 'manual', supabase);

    return successResponse(result, {
      'Cache-Control': 'private, max-age=3600',
    });
  } catch (error) {
    log.logError('RFE assessment failed', error);

    // Degraded response — don't crash the UI
    return successResponse({
      rfeRiskScore: 0,
      riskLevel: 'low',
      triggeredRules: [],
      safeRuleIds: [],
      priorityActions: [],
      degraded: true,
    });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cases/[id]/rfe-assessment/route.ts
git commit -m "feat(rfe): add API route for RFE risk assessment"
```

---

## Task 6: React Query Hook

**Files:**
- Create: `src/hooks/use-rfe-assessment.ts`

**Step 1: Write the hook**

```typescript
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJobAware } from '@/lib/api/job-aware-fetch';
import type { RFEAssessmentResult } from '@/lib/ai/rfe';

async function fetchRFEAssessment(caseId: string): Promise<RFEAssessmentResult> {
  return fetchJobAware<RFEAssessmentResult>(`/api/cases/${caseId}/rfe-assessment`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Hook to fetch RFE risk assessment for a case.
 */
export function useRFEAssessment(
  caseId: string | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const { enabled = true, staleTime = 30 * 60 * 1000 } = options || {};

  return useQuery<RFEAssessmentResult, Error>({
    queryKey: ['rfe-assessment', caseId],
    queryFn: () => fetchRFEAssessment(caseId!),
    enabled: enabled && !!caseId,
    staleTime,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to invalidate RFE assessment cache.
 */
export function useInvalidateRFEAssessment() {
  const queryClient = useQueryClient();

  return {
    invalidateCase: (caseId: string) => {
      queryClient.invalidateQueries({ queryKey: ['rfe-assessment', caseId] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['rfe-assessment'] });
    },
  };
}

/**
 * Get risk level display info.
 */
export function getRFERiskInfo(riskLevel: string): {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
} {
  switch (riskLevel) {
    case 'low':
      return { label: 'Low RFE Risk', color: 'text-success', bgColor: 'bg-success/10', emoji: '' };
    case 'medium':
      return { label: 'Medium RFE Risk', color: 'text-warning', bgColor: 'bg-warning/10', emoji: '' };
    case 'high':
      return { label: 'High RFE Risk', color: 'text-orange-600', bgColor: 'bg-orange-600/10', emoji: '' };
    case 'critical':
      return { label: 'Critical RFE Risk', color: 'text-destructive', bgColor: 'bg-destructive/10', emoji: '' };
    default:
      return { label: 'Unknown', color: 'text-muted-foreground', bgColor: 'bg-muted', emoji: '' };
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-rfe-assessment.ts
git commit -m "feat(rfe): add React Query hook for RFE assessment"
```

---

## Task 7: RFE Risk Panel Component

**Files:**
- Create: `src/components/ai/rfe-risk-panel.tsx`
- Modify: `src/components/ai/index.ts` (add export)

**Step 1: Write the panel component**

File: `src/components/ai/rfe-risk-panel.tsx`

```typescript
'use client';

import { cn } from '@/lib/utils';
import { useRFEAssessment, getRFERiskInfo } from '@/hooks/use-rfe-assessment';
import { AIContentBox, AIBadge, AILoading } from '@/components/ai';
import { AlertTriangle, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { RFEAssessmentResult, TriggeredRule } from '@/lib/ai/rfe';

interface RFERiskPanelProps {
  caseId: string;
  variant?: 'full' | 'compact' | 'mini';
  className?: string;
}

function RiskScoreGauge({ score, riskLevel }: { score: number; riskLevel: string }) {
  const info = getRFERiskInfo(riskLevel);
  const circumference = 2 * Math.PI * 36;
  // Invert: 100 score = full ring (no risk), 0 score = empty ring
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor"
          className="text-muted/20" strokeWidth="6" />
        <circle cx="40" cy="40" r="36" fill="none"
          className={info.color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-lg font-bold', info.color)}>{score}</span>
      </div>
    </div>
  );
}

function RiskBadge({ riskLevel }: { riskLevel: string }) {
  const info = getRFERiskInfo(riskLevel);
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', info.color, info.bgColor)}>
      {info.label}
    </Badge>
  );
}

function TriggeredRuleItem({ rule }: { rule: TriggeredRule }) {
  const [expanded, setExpanded] = useState(false);
  const severityColors = {
    critical: 'border-l-destructive',
    high: 'border-l-orange-500',
    medium: 'border-l-warning',
    low: 'border-l-muted-foreground',
  };

  return (
    <div
      className={cn(
        'border-l-4 pl-3 py-2 cursor-pointer hover:bg-muted/50 rounded-r',
        severityColors[rule.severity]
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={14} className={
            rule.severity === 'critical' ? 'text-destructive' :
            rule.severity === 'high' ? 'text-orange-500' :
            'text-warning'
          } />
          <span className="text-sm font-medium truncate">{rule.title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] ml-2 flex-shrink-0">
          {rule.severity}
        </Badge>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <ul className="list-disc pl-4 space-y-1">
            {rule.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
            <strong>Action:</strong> {rule.recommendation}
          </div>
        </div>
      )}
    </div>
  );
}

export function RFERiskPanel({ caseId, variant = 'full', className }: RFERiskPanelProps) {
  const { data, isLoading, error } = useRFEAssessment(caseId);

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <AILoading message="Assessing RFE risk" variant="minimal" />
      </div>
    );
  }

  const isDegraded = error || !data || (data as RFEAssessmentResult & { degraded?: boolean }).degraded;

  if (isDegraded) {
    return (
      <div className={cn('p-4 rounded-lg border border-dashed border-border bg-muted/50', className)}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield size={20} />
          <div>
            <p className="text-sm font-medium">RFE Risk Assessment</p>
            <p className="text-xs text-muted-foreground/70">
              Upload documents to see RFE risk analysis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'mini') {
    return <RiskBadge riskLevel={data.riskLevel} />;
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg border', className)}>
        <RiskScoreGauge score={data.rfeRiskScore} riskLevel={data.riskLevel} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <RiskBadge riskLevel={data.riskLevel} />
            <AIBadge size="sm" label="AI" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.triggeredRules?.length || 0} risk factor(s) found
          </p>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <AIContentBox title="RFE Risk Assessment" variant="bordered" className={className}>
      {/* Score Overview */}
      <div className="flex items-center gap-6 mb-4">
        <RiskScoreGauge score={data.rfeRiskScore} riskLevel={data.riskLevel} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <RiskBadge riskLevel={data.riskLevel} />
            <AIBadge size="sm" label="AI" showTooltip tooltipText="Rule-based RFE risk analysis" />
          </div>
          <p className="text-sm text-muted-foreground">
            {data.triggeredRules?.length === 0
              ? 'No RFE risk factors detected'
              : `${data.triggeredRules.length} risk factor(s) identified`}
          </p>
        </div>
      </div>

      {/* Triggered Rules */}
      {data.triggeredRules?.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" />
            Risk Factors
          </h4>
          <div className="space-y-1">
            {data.triggeredRules.map((rule) => (
              <TriggeredRuleItem key={rule.ruleId} rule={rule} />
            ))}
          </div>
        </div>
      )}

      {/* Priority Actions */}
      {data.priorityActions?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Shield size={14} className="text-success" />
            Priority Actions
          </h4>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            {data.priorityActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ol>
        </div>
      )}
    </AIContentBox>
  );
}
```

**Step 2: Export from index**

Add to `src/components/ai/index.ts`:
```typescript
export { RFERiskPanel } from './rfe-risk-panel';
```

**Step 3: Commit**

```bash
git add src/components/ai/rfe-risk-panel.tsx src/components/ai/index.ts
git commit -m "feat(rfe): add RFE Risk Panel component with full/compact/mini variants"
```

---

## Task 8: Integrate into Case Detail Page

**Files:**
- Modify: `src/app/dashboard/cases/[id]/page.tsx` (add RFERiskPanel to Overview tab)

**Step 1: Add the RFERiskPanel to the case detail Overview tab**

In the case detail page, the Overview tab currently shows:
1. `SuccessScoreBreakdown` (full width, compact)
2. Left column: Case Details + Client Info
3. Right column: `DocumentCompletenessPanel` + `NextStepsPanel`

Add `RFERiskPanel` below the `SuccessScoreBreakdown` in the right column, above `DocumentCompletenessPanel`:

```typescript
// Add import at top of file:
import { RFERiskPanel } from '@/components/ai';

// In the Overview tab's right column, add ABOVE DocumentCompletenessPanel:
<RFERiskPanel caseId={id} variant="full" />
```

The exact insertion point depends on the current file structure. Look for the `TabsContent value="overview"` section and add the panel in the right column div.

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/dashboard/cases/[id]/page.tsx
git commit -m "feat(rfe): integrate RFE Risk Panel into case detail Overview tab"
```

---

## Task 9: Tests

**Files:**
- Create: `src/lib/ai/rfe/__tests__/rules.test.ts`
- Create: `src/lib/ai/rfe/__tests__/assessment.test.ts`

**Step 1: Write rule unit tests**

File: `src/lib/ai/rfe/__tests__/rules.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { h1bRules } from '../rules/h1b-rules';
import { i130Rules } from '../rules/i130-rules';
import { i485Rules } from '../rules/i485-rules';
import { i140Rules } from '../rules/i140-rules';
import { commonRules } from '../rules/common-rules';
import { getRulesForVisaType } from '../rules';
import type { RFEAnalysisContext } from '../types';

function makeContext(overrides: Partial<RFEAnalysisContext> = {}): RFEAnalysisContext {
  return {
    caseId: 'test-case-id',
    visaType: 'H1B',
    caseStatus: 'document_collection',
    deadline: null,
    uploadedDocumentTypes: new Set(),
    requiredDocumentTypes: new Set(['passport', 'diploma', 'transcript']),
    extractedData: new Map(),
    formData: new Map(),
    formTypes: [],
    bonaFideEvidenceCount: 0,
    employerInfo: {},
    beneficiaryInfo: {},
    financialInfo: {},
    ...overrides,
  };
}

describe('getRulesForVisaType', () => {
  it('returns H-1B specific and common rules for H1B', () => {
    const rules = getRulesForVisaType('H1B');
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.id.startsWith('H1B-'))).toBe(true);
    expect(rules.some((r) => r.id.startsWith('COMMON-'))).toBe(true);
  });

  it('returns I-130 specific and common rules for I-130', () => {
    const rules = getRulesForVisaType('I-130');
    expect(rules.some((r) => r.id.startsWith('I130-'))).toBe(true);
  });

  it('returns I-485 rules for I-485', () => {
    const rules = getRulesForVisaType('I-485');
    expect(rules.some((r) => r.id === 'I485-MED-001')).toBe(true);
  });
});

describe('I485-MED-001: Medical exam missing', () => {
  const rule = i485Rules.find((r) => r.id === 'I485-MED-001')!;

  it('triggers when medical_exam is not uploaded', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      requiredDocumentTypes: new Set(['medical_exam']),
      uploadedDocumentTypes: new Set(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('does not trigger when medical_exam is uploaded', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      requiredDocumentTypes: new Set(['medical_exam']),
      uploadedDocumentTypes: new Set(['medical_exam']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

describe('I130-BONA-001: Bona fide marriage evidence', () => {
  const rule = i130Rules.find((r) => r.id === 'I130-BONA-001')!;

  it('triggers when fewer than 4 evidence categories', () => {
    const ctx = makeContext({
      visaType: 'I-130',
      bonaFideEvidenceCount: 2,
      uploadedDocumentTypes: new Set(['marriage_certificate', 'photo']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger with 4+ evidence categories', () => {
    const ctx = makeContext({
      visaType: 'I-130',
      bonaFideEvidenceCount: 4,
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

describe('COMMON-PASSPORT-001: Passport missing', () => {
  const rule = commonRules.find((r) => r.id === 'COMMON-PASSPORT-001')!;

  it('triggers when passport is required but not uploaded', () => {
    const ctx = makeContext({
      requiredDocumentTypes: new Set(['passport']),
      uploadedDocumentTypes: new Set(),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger when passport is uploaded', () => {
    const ctx = makeContext({
      requiredDocumentTypes: new Set(['passport']),
      uploadedDocumentTypes: new Set(['passport']),
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });
});

describe('I485-SUPPORT-001: Income below FPG', () => {
  const rule = i485Rules.find((r) => r.id === 'I485-SUPPORT-001')!;

  it('triggers when income is below 125% FPG', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      financialInfo: {
        sponsorIncome: 20000,
        householdSize: 3,
      },
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(true);
    expect(result.evidence.some((e) => e.includes('Shortfall'))).toBe(true);
  });

  it('does not trigger when income is sufficient', () => {
    const ctx = makeContext({
      visaType: 'I-485',
      financialInfo: {
        sponsorIncome: 80000,
        householdSize: 2,
      },
    });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when financial data is missing', () => {
    const ctx = makeContext({ visaType: 'I-485', financialInfo: {} });
    const result = rule.evaluate(ctx);
    expect(result.triggered).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
```

**Step 2: Run tests**

```bash
npx vitest run src/lib/ai/rfe/__tests__/rules.test.ts
```

**Step 3: Commit**

```bash
git add src/lib/ai/rfe/__tests__/
git commit -m "test(rfe): add unit tests for RFE rule evaluation"
```

---

## Task 10: Build Verification

**Step 1: Type check**
```bash
npx tsc --noEmit
```

**Step 2: Run all tests**
```bash
npx vitest run
```

**Step 3: Build**
```bash
npm run build
```

**Step 4: Final commit and push**
```bash
git add -A
git commit -m "feat: RFE Prevention Engine Phase 1 — structural rules, assessment engine, API, UI panel

Adds proactive RFE risk assessment with 15+ rules covering H-1B, I-130, I-485, and I-140 visa types.
Deterministic structural rules (no AI calls) run in <100ms. Integrates as a new panel on the
case detail page alongside existing success score and document completeness."
git push origin main
```

---

## Future: Phase 2 (Content Rules via AI)

After Phase 1 is live and validated:

1. **New BullMQ job type**: `RFEAssessmentJob` in `src/lib/jobs/types.ts`
2. **Worker processor**: `services/worker/src/processors/rfe-assessment.ts`
3. **Content rules** that use Claude to compare extracted document text:
   - Degree field vs. SOC code occupation requirements
   - Experience letter dates vs. PERM requirements
   - LCA title vs. petition title (actual text comparison)
4. **Cross-document consistency rules**:
   - Employment dates across W-2, experience letter, and I-129
   - Address consistency across documents and forms
   - Income consistency between tax return and I-864

## Future: USCIS Case Status Tracking

Separate plan needed. Key components:
1. **New tables**: `uscis_receipt_numbers`, `uscis_case_status_history`
2. **USCIS status polling**: Daily cron job checking case status via USCIS API
3. **Status change notifications**: In-app + email when USCIS updates status
4. **Processing time estimates**: Link to existing `processing_times` reference table
5. **Dashboard widget**: Shows all cases with their USCIS status in one view
