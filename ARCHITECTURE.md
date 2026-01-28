# Immigration AI - Architecture Document

> Comprehensive technical architecture for the AI-powered immigration case management platform.
> **Last Updated:** 2026-01-27

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Architecture](#database-architecture)
5. [Authentication & Authorization](#authentication--authorization)
6. [API Architecture](#api-architecture)
7. [AI Integration](#ai-integration)
8. [Frontend Architecture](#frontend-architecture)
9. [Security Model](#security-model)
10. [External Services](#external-services)
11. [Data Flow Diagrams](#data-flow-diagrams)
12. [File Structure](#file-structure)
13. [Deployment Architecture](#deployment-architecture)

---

## Executive Overview

### What This Application Does

Immigration AI is a SaaS platform that helps immigration attorneys manage cases more efficiently through AI-powered document analysis and form filling. The platform:

1. **Manages Immigration Cases** - Attorneys create cases for clients, track status, deadlines, and required documentation
2. **Analyzes Documents with AI** - Upload passports, birth certificates, etc. and AI extracts relevant data using vision models
3. **Auto-fills USCIS Forms** - AI uses extracted document data to pre-populate immigration forms (I-130, I-485, I-765, etc.)
4. **Ensures Compliance** - Audit trails, confidence thresholds, and attorney review requirements for legal compliance
5. **Generates PDFs** - Creates filled PDF summaries of USCIS forms for review

### Target Users

| Role | Description | Capabilities |
|------|-------------|--------------|
| **Attorney** | Immigration lawyer managing multiple clients | Full case management, AI features, form filing |
| **Client** | Person going through immigration process | View case status, upload documents, see deadlines |
| **Admin** | System administrator | User management, system settings, analytics |

### Business Model (Planned)

- **Free Tier**: 1 case, basic document analysis
- **Pro Tier**: Unlimited cases, all AI features, priority support
- **Enterprise**: Multi-attorney firms, organization billing, dedicated support

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Web Browser   │  │  Mobile (PWA)   │  │  Client Portal  │              │
│  │   (Next.js)     │  │   (Future)      │  │   (Future)      │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
└───────────┼─────────────────────┼─────────────────────┼─────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Next.js App Router (Server)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Middleware │  │ API Routes  │  │   Server    │  │   Edge      │  │   │
│  │  │   (Auth,    │  │ (/api/*)    │  │  Components │  │  Functions  │  │   │
│  │  │   CSRF,     │  │             │  │             │  │             │  │   │
│  │  │   Rate Limit│  │             │  │             │  │             │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICES LAYER                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Supabase   │  │   OpenAI    │  │  Anthropic  │  │   Upstash   │         │
│  │  (Auth,DB,  │  │  GPT-4o     │  │   Claude    │  │   Redis     │         │
│  │  Storage)   │  │  (Vision)   │  │  (Reasoning)│  │  (Rate Lim) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Sentry    │  │   Stripe    │  │   Resend    │  │  ClamAV/    │         │
│  │  (Errors)   │  │  (Payments) │  │  (Email)    │  │  VirusTotal │         │
│  │             │  │  [PLANNED]  │  │  [PLANNED]  │  │  (Scanning) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Supabase PostgreSQL                                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ profiles │ │  cases   │ │documents │ │  forms   │ │audit_log │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │   │
│  │  │  firms   │ │firm_     │ │pending_  │ │deadlines │               │   │
│  │  │          │ │members   │ │invitations│ │         │               │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Supabase Storage                                   │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    documents bucket                             │  │   │
│  │  │  /{user_id}/{case_id}/{document_id}/{filename}                 │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.x | React framework with App Router |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **React** | 19.x | UI component library |
| **Node.js** | 20.x | Server runtime |

### Frontend

| Technology | Purpose |
|------------|---------|
| **Tailwind CSS v4** | Utility-first styling |
| **shadcn/ui** | Pre-built accessible components (Radix primitives) |
| **Zustand** | Client-side state management |
| **TanStack React Query** | Server state management, caching |
| **React Hook Form** | Form state management |
| **Zod** | Schema validation |

### Backend & Infrastructure

| Technology | Purpose |
|------------|---------|
| **Supabase** | PostgreSQL database, Auth, Storage, Realtime |
| **Upstash Redis** | Rate limiting (serverless Redis) |
| **Vercel** | Hosting, Edge functions, CDN |

### AI Services

| Service | Model | Purpose |
|---------|-------|---------|
| **OpenAI** | GPT-4o | Document vision/OCR, data extraction |
| **Anthropic** | Claude 3.5 Sonnet | Form reasoning, complex field mapping |

### Monitoring & Security

| Technology | Purpose |
|------------|---------|
| **Sentry** | Error tracking, performance monitoring |
| **pdf-lib** | PDF generation and manipulation |
| **ClamAV / VirusTotal** | Malware scanning for uploads |

---

## Database Architecture

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  profiles   │       │    firms    │       │   cases     │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id (PK)     │──┐    │ id (PK)     │
│ email       │  │    │ name        │  │    │ client_id   │──┐
│ full_name   │  │    │ owner_id(FK)│──┤    │ attorney_id │──┤
│ role        │  │    │ settings    │  │    │ firm_id(FK) │──┤
│ firm_id(FK) │──┤    │ created_at  │  │    │ case_type   │  │
│ avatar_url  │  │    └─────────────┘  │    │ status      │  │
│ created_at  │  │                     │    │ priority    │  │
└─────────────┘  │    ┌─────────────┐  │    │ created_at  │  │
                 │    │firm_members │  │    └─────────────┘  │
                 │    ├─────────────┤  │           │         │
                 │    │ id (PK)     │  │           │         │
                 │    │ firm_id(FK) │──┘           │         │
                 └────│ user_id(FK) │              │         │
                      │ role        │              │         │
                      │ joined_at   │              │         │
                      └─────────────┘              │         │
                                                   │         │
┌─────────────┐       ┌─────────────┐              │         │
│  documents  │       │   forms     │              │         │
├─────────────┤       ├─────────────┤              │         │
│ id (PK)     │       │ id (PK)     │              │         │
│ case_id(FK) │───────│ case_id(FK) │──────────────┘         │
│ type        │       │ form_type   │                        │
│ file_path   │       │ data (JSON) │                        │
│ file_name   │       │ status      │                        │
│ ai_extracted│       │ ai_reviewed │                        │
│ confidence  │       │ field_reviews│                       │
│ created_at  │       │ created_at  │                        │
└─────────────┘       └─────────────┘                        │
                                                             │
┌─────────────┐       ┌─────────────┐       ┌─────────────┐ │
│  deadlines  │       │ audit_log   │       │notifications│ │
├─────────────┤       ├─────────────┤       ├─────────────┤ │
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │ │
│ case_id(FK) │───────│ user_id(FK) │───────│ user_id(FK) │─┘
│ title       │       │ entity_type │       │ type        │
│ due_date    │       │ entity_id   │       │ title       │
│ status      │       │ operation   │       │ message     │
│ reminder_at │       │ changes     │       │ read        │
└─────────────┘       │ ip_address  │       │ data (JSON) │
                      │ user_agent  │       │ created_at  │
                      │ created_at  │       └─────────────┘
                      └─────────────┘
```

### Key Tables

#### `profiles`
Extends Supabase Auth users with application-specific data.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'attorney', 'admin')),
  firm_id UUID REFERENCES firms(id),
  avatar_url TEXT,
  phone TEXT,
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `cases`
Core entity - represents an immigration case for a client.

```sql
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id),
  attorney_id UUID REFERENCES profiles(id),
  firm_id UUID REFERENCES firms(id),
  case_type TEXT NOT NULL,  -- 'family_based', 'employment', 'naturalization', etc.
  status TEXT DEFAULT 'intake' CHECK (status IN ('intake', 'documents', 'forms', 'review', 'filed', 'approved', 'denied')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `documents`
Uploaded documents with AI-extracted data.

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'passport', 'birth_certificate', 'marriage_certificate', etc.
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  ai_extracted_data JSONB,
  confidence_score NUMERIC(3,2),
  extraction_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `forms`
USCIS forms with AI-filled data and review tracking.

```sql
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL,  -- 'I-130', 'I-485', 'I-765', etc.
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'ready', 'filed')),
  ai_filled_at TIMESTAMPTZ,
  field_reviews JSONB DEFAULT '{}',  -- Tracks which fields attorney reviewed
  filed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `audit_log`
Immutable audit trail for compliance.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  entity_type TEXT NOT NULL,  -- 'case', 'document', 'form'
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL,  -- 'create', 'update', 'delete', 'access', 'export'
  changes JSONB,  -- { field: { old: x, new: y } }
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable: no UPDATE or DELETE allowed
```

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:

```sql
-- Attorneys can see their firm's cases
CREATE POLICY "Attorneys see firm cases" ON cases
  FOR SELECT USING (
    attorney_id = auth.uid() OR
    firm_id IN (SELECT firm_id FROM profiles WHERE id = auth.uid())
  );

-- Clients can only see their own cases
CREATE POLICY "Clients see own cases" ON cases
  FOR SELECT USING (client_id = auth.uid());

-- Documents inherit case access
CREATE POLICY "Documents follow case access" ON documents
  FOR SELECT USING (
    case_id IN (SELECT id FROM cases WHERE
      client_id = auth.uid() OR
      attorney_id = auth.uid() OR
      firm_id IN (SELECT firm_id FROM profiles WHERE id = auth.uid())
    )
  );
```

---

## Authentication & Authorization

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │   Next.js   │     │  Supabase   │     │  Database   │
│             │     │  Middleware │     │    Auth     │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. Login Request  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │ 2. Auth Request   │                   │
       │                   │──────────────────>│                   │
       │                   │                   │ 3. Verify Creds   │
       │                   │                   │──────────────────>│
       │                   │                   │<──────────────────│
       │                   │ 4. JWT + Refresh  │                   │
       │                   │<──────────────────│                   │
       │ 5. Set Cookies    │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │ 6. API Request    │                   │                   │
       │──────────────────>│                   │                   │
       │                   │ 7. Verify JWT     │                   │
       │                   │──────────────────>│                   │
       │                   │<──────────────────│                   │
       │                   │ 8. RLS Query      │                   │
       │                   │─────────────────────────────────────>│
       │                   │<─────────────────────────────────────│
       │ 9. Response       │                   │                   │
       │<──────────────────│                   │                   │
```

### Authorization Layers

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         AUTHORIZATION LAYERS                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Layer 1: MIDDLEWARE (Edge)                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ • Session validation (Supabase JWT)                                   │ │
│  │ • CSRF token validation                                               │ │
│  │ • Admin route protection (/admin/* requires role=admin)               │ │
│  │ • Redirect unauthenticated users to /login                            │ │
│  │ File: /src/lib/supabase/middleware.ts                                 │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                    ↓                                       │
│  Layer 2: API ROUTES (Server)                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ • Verify user owns resource or has access                             │ │
│  │ • Check role for operations (e.g., only attorneys can file forms)     │ │
│  │ • Rate limiting via Upstash Redis                                     │ │
│  │ File: /src/app/api/*/route.ts                                         │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                    ↓                                       │
│  Layer 3: DATABASE RLS (Supabase)                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ • Row-level policies enforce data isolation                           │ │
│  │ • Clients see only their cases                                        │ │
│  │ • Attorneys see their firm's cases                                    │ │
│  │ • Admins have broader access (via service role key)                   │ │
│  │ File: /supabase/migrations/*                                          │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                    ↓                                       │
│  Layer 4: FRONTEND GUARDS (Client)                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ • useRoleGuard() hook for page-level protection                       │ │
│  │ • RoleGuard component for route wrapping                              │ │
│  │ • RoleOnly component for conditional rendering                        │ │
│  │ Files: /src/hooks/use-role-guard.ts, /src/components/auth/role-guard │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Role Permissions

| Permission | Client | Attorney | Admin |
|------------|--------|----------|-------|
| View own cases | ✓ | ✓ | ✓ |
| View firm cases | - | ✓ | ✓ |
| Upload documents | ✓ | ✓ | ✓ |
| Analyze documents (AI) | - | ✓ | ✓ |
| Fill forms (AI) | - | ✓ | ✓ |
| Review & file forms | - | ✓ | ✓ |
| Manage clients | - | ✓ | ✓ |
| Access admin panel | - | - | ✓ |
| Manage users | - | - | ✓ |
| View system settings | - | - | ✓ |

---

## API Architecture

### Route Structure

```
/api/
├── auth/
│   ├── callback/           # OAuth callback
│   └── mfa/               # MFA setup/verify
├── cases/
│   ├── route.ts           # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts       # GET, PATCH, DELETE
│       ├── documents/
│       │   └── route.ts   # GET, POST (upload)
│       └── forms/
│           └── route.ts   # GET, POST
├── documents/
│   └── [id]/
│       ├── route.ts       # GET, DELETE
│       └── analyze/
│           └── route.ts   # POST (AI analysis)
├── forms/
│   └── [id]/
│       ├── route.ts       # GET, PATCH, DELETE
│       ├── autofill/
│       │   └── route.ts   # POST (AI fill)
│       ├── file/
│       │   └── route.ts   # POST (mark as filed)
│       ├── pdf/
│       │   └── route.ts   # GET (download PDF)
│       ├── review-status/
│       │   └── route.ts   # GET (review status)
│       └── review-field/
│           └── route.ts   # POST (mark field reviewed)
├── clients/
│   └── route.ts           # GET (list), POST (create)
├── firms/
│   ├── route.ts           # GET (current firm)
│   └── members/
│       └── route.ts       # GET, POST, DELETE
├── notifications/
│   └── route.ts           # GET, PATCH (mark read)
└── health/
    └── route.ts           # GET (system health)
```

### API Response Format

```typescript
// Success response
{
  data: T,
  meta?: {
    page?: number,
    limit?: number,
    total?: number
  }
}

// Error response
{
  error: string,
  code?: string,
  details?: Record<string, string>
}
```

### Rate Limiting

```typescript
// Configuration in /src/lib/rate-limit/index.ts
const RATE_LIMITS = {
  'api': { limit: 100, window: '1m' },      // General API calls
  'auth': { limit: 5, window: '15m' },      // Login attempts
  'upload': { limit: 20, window: '1h' },    // File uploads
  'ai': { limit: 50, window: '1h' },        // AI operations
};
```

**Production behavior**: Fail-closed (returns 503) if Redis unavailable.

---

## AI Integration

### Document Analysis Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Upload     │     │   Validate   │     │   Store      │     │   Queue      │
│   Document   │────>│   File       │────>│   in S3      │────>│   Analysis   │
│              │     │ (type,virus) │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Store      │     │   Map to     │     │   Claude     │     │   GPT-4o     │
│   Results    │<────│   Form       │<────│   Reason     │<────│   Extract    │
│   + Score    │     │   Fields     │     │   + Validate │     │   (Vision)   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### AI Service Architecture

```typescript
// /src/lib/ai/index.ts

// Document Analysis (Vision)
export async function analyzeDocument(
  fileBuffer: Buffer,
  documentType: DocumentType
): Promise<DocumentAnalysisResult> {
  // 1. Convert to base64
  // 2. Send to GPT-4o with document-specific prompt
  // 3. Parse structured response
  // 4. Calculate confidence scores
  return {
    extractedData: { ... },
    confidence: 0.95,
    warnings: []
  };
}

// Form Auto-fill (Reasoning)
export async function autofillForm(
  caseData: CaseData,
  documents: Document[],
  formType: FormType
): Promise<AutofillResult> {
  // 1. Gather all extracted document data
  // 2. Send to Claude with form schema
  // 3. Claude maps data to form fields
  // 4. Returns filled form with confidence per field
  return {
    filledData: { ... },
    fieldConfidences: { ... },
    warnings: []
  };
}
```

### AI Confidence Thresholds

```typescript
// /src/lib/form-validation/index.ts

const MIN_CONFIDENCE_THRESHOLD = 0.8;

const MANDATORY_REVIEW_FIELDS = [
  'ssn', 'socialSecurityNumber',
  'alienNumber', 'uscisAccountNumber',
  'passportNumber', 'dateOfBirth',
  // ... other sensitive fields
];

// Forms cannot be filed until:
// 1. All fields with confidence < 0.8 are reviewed
// 2. All mandatory review fields are reviewed
// 3. Attorney has marked form as "ready"
```

---

## Frontend Architecture

### Component Hierarchy

```
App
├── Providers
│   ├── AuthProvider (Supabase session)
│   ├── QueryProvider (TanStack Query)
│   └── ThemeProvider (dark/light mode)
│
├── Layout
│   ├── Sidebar (navigation by role)
│   ├── Header (user menu, notifications)
│   └── MainContent
│
└── Pages (App Router)
    ├── Dashboard
    │   ├── CaseList
    │   ├── StatsCards
    │   └── RecentActivity
    │
    ├── Cases
    │   ├── CaseDetail
    │   │   ├── CaseHeader
    │   │   ├── DocumentsTab
    │   │   ├── FormsTab
    │   │   └── TimelineTab
    │   └── NewCase
    │
    ├── Documents
    │   ├── DocumentViewer
    │   ├── UploadModal
    │   └── AIAnalysisPanel
    │
    └── Forms
        ├── FormEditor
        ├── FormReview
        └── FormSections
```

### State Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STATE MANAGEMENT                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SERVER STATE (TanStack Query)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Cases, Documents, Forms data                                       │   │
│  │ • Automatic caching, refetching, invalidation                        │   │
│  │ • Optimistic updates for mutations                                   │   │
│  │ File: /src/hooks/use-cases.ts, use-documents.ts, use-forms.ts        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  CLIENT STATE (Zustand)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • UI state (modals, sidebars, selected items)                        │   │
│  │ • Form draft state (unsaved changes)                                 │   │
│  │ • Notification preferences                                           │   │
│  │ File: /src/store/*.ts                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  URL STATE (Next.js)                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Current page, filters, search params                               │   │
│  │ • Shareable state via URL                                            │   │
│  │ Usage: useSearchParams(), usePathname()                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Custom Hooks

| Hook | Purpose | File |
|------|---------|------|
| `useCases()` | CRUD operations for cases | `/src/hooks/use-cases.ts` |
| `useDocuments()` | Document upload, analysis | `/src/hooks/use-documents.ts` |
| `useForms()` | Form CRUD, autofill | `/src/hooks/use-forms.ts` |
| `useRole()` | Current user role & permissions | `/src/hooks/use-role.ts` |
| `useRoleGuard()` | Page-level role protection | `/src/hooks/use-role-guard.ts` |
| `useNotifications()` | Notification management | `/src/hooks/use-notifications.ts` |
| `useFirm()` | Firm/organization data | `/src/hooks/use-firm.ts` |

---

## Security Model

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. NETWORK LAYER                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • HTTPS everywhere (TLS 1.3)                                         │   │
│  │ • Vercel Edge Network (DDoS protection)                              │   │
│  │ • Rate limiting at edge                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  2. APPLICATION LAYER                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • CSRF token validation                                              │   │
│  │ • XSS prevention (React's default escaping)                          │   │
│  │ • Content Security Policy headers                                    │   │
│  │ • Secure cookie settings (HttpOnly, SameSite=Strict)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  3. FILE UPLOAD LAYER                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Magic byte validation (actual type vs claimed)                     │   │
│  │ • File size limits (10MB)                                            │   │
│  │ • Virus scanning (ClamAV or VirusTotal)                              │   │
│  │ • Fail-closed in production without scanner                          │   │
│  │ File: /src/lib/file-validation/index.ts                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  4. DATA LAYER                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Row Level Security (PostgreSQL)                                    │   │
│  │ • Encrypted at rest (Supabase)                                       │   │
│  │ • PII handling (masked in logs, Sentry)                              │   │
│  │ • Immutable audit log                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  5. AUDIT LAYER                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • All modifications logged with user, timestamp, changes             │   │
│  │ • Document access logged                                             │   │
│  │ • Form reviews tracked per field                                     │   │
│  │ • IP address and user agent captured                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sensitive Data Handling

| Data Type | Storage | Masking | Access |
|-----------|---------|---------|--------|
| SSN | Encrypted JSONB | Masked in logs/Sentry | Case owner only |
| Passport # | Encrypted JSONB | Masked in logs/Sentry | Case owner only |
| Documents | Supabase Storage | Path obfuscated | RLS enforced |
| API Keys | Environment vars | Never logged | Server only |

---

## External Services

### Service Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ACTIVE (Configured)                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SUPABASE                                                             │   │
│  │ • PostgreSQL database                                                │   │
│  │ • Authentication (email, OAuth, MFA)                                 │   │
│  │ • Storage (document files)                                           │   │
│  │ • Realtime subscriptions                                             │   │
│  │ Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ OPENAI                                                               │   │
│  │ • GPT-4o for document vision/OCR                                     │   │
│  │ • Data extraction from images                                        │   │
│  │ Env: OPENAI_API_KEY                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ANTHROPIC                                                            │   │
│  │ • Claude 3.5 Sonnet for form reasoning                               │   │
│  │ • Complex field mapping and validation                               │   │
│  │ Env: ANTHROPIC_API_KEY                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ UPSTASH REDIS                                                        │   │
│  │ • Rate limiting                                                      │   │
│  │ • Session caching (optional)                                         │   │
│  │ Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  CONFIGURED BUT OPTIONAL                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SENTRY - Error tracking and monitoring                               │   │
│  │ Env: SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN                              │   │
│  │                                                                       │   │
│  │ CLAMAV / VIRUSTOTAL - Malware scanning                               │   │
│  │ Env: VIRUS_SCANNER_PROVIDER, CLAMAV_API_URL or VIRUSTOTAL_API_KEY   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PLANNED (Not Implemented)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STRIPE - Payments, subscriptions                                     │   │
│  │ RESEND - Transactional emails                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Case Creation Flow

```
User                    Frontend                API                   Database
 │                         │                     │                       │
 │ 1. Fill case form       │                     │                       │
 │────────────────────────>│                     │                       │
 │                         │ 2. POST /api/cases  │                       │
 │                         │────────────────────>│                       │
 │                         │                     │ 3. Validate auth      │
 │                         │                     │ 4. Check role         │
 │                         │                     │ 5. INSERT case        │
 │                         │                     │──────────────────────>│
 │                         │                     │<──────────────────────│
 │                         │                     │ 6. Log to audit_log   │
 │                         │                     │──────────────────────>│
 │                         │                     │<──────────────────────│
 │                         │<────────────────────│                       │
 │<────────────────────────│                     │                       │
 │ 7. Redirect to case     │                     │                       │
```

### Document Analysis Flow

```
User          Frontend        API           Storage        OpenAI       Claude
 │               │             │               │             │            │
 │ 1. Upload     │             │               │             │            │
 │──────────────>│             │               │             │            │
 │               │ 2. POST     │               │             │            │
 │               │ /documents  │               │             │            │
 │               │────────────>│               │             │            │
 │               │             │ 3. Validate   │             │            │
 │               │             │ (type, virus) │             │            │
 │               │             │ 4. Store file │             │            │
 │               │             │──────────────>│             │            │
 │               │             │<──────────────│             │            │
 │               │<────────────│ 5. Return doc │             │            │
 │<──────────────│ ID          │               │             │            │
 │               │             │               │             │            │
 │ 6. Analyze    │             │               │             │            │
 │──────────────>│             │               │             │            │
 │               │ 7. POST     │               │             │            │
 │               │ /analyze    │               │             │            │
 │               │────────────>│               │             │            │
 │               │             │ 8. Get file   │             │            │
 │               │             │──────────────>│             │            │
 │               │             │<──────────────│             │            │
 │               │             │ 9. Vision API │             │            │
 │               │             │──────────────────────────>│            │
 │               │             │<──────────────────────────│            │
 │               │             │ 10. Reasoning│             │            │
 │               │             │──────────────────────────────────────>│
 │               │             │<──────────────────────────────────────│
 │               │             │ 11. Save results            │            │
 │               │<────────────│               │             │            │
 │<──────────────│ 12. Show    │               │             │            │
 │               │ extracted   │               │             │            │
```

---

## File Structure

```
immigration-ai/
├── .claude/
│   └── agents/                    # Multi-agent coordination
│       ├── TODO.md                # Master task list
│       ├── README.md              # Agent instructions
│       └── sessions/              # Session summaries
│
├── public/                        # Static assets
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/               # Auth pages (grouped)
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   │
│   │   ├── dashboard/            # Protected routes
│   │   │   ├── page.tsx          # Dashboard home
│   │   │   ├── cases/
│   │   │   │   ├── page.tsx      # Case list
│   │   │   │   ├── new/
│   │   │   │   └── [id]/         # Case detail
│   │   │   ├── clients/
│   │   │   ├── settings/
│   │   │   └── billing/
│   │   │
│   │   ├── admin/                # Admin-only routes
│   │   │
│   │   ├── api/                  # API routes
│   │   │   ├── cases/
│   │   │   ├── documents/
│   │   │   ├── forms/
│   │   │   ├── clients/
│   │   │   ├── firms/
│   │   │   ├── notifications/
│   │   │   └── health/
│   │   │
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Landing page
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn/ui (don't modify)
│   │   ├── layout/               # Header, Sidebar, etc.
│   │   ├── auth/                 # Role guards, auth forms
│   │   ├── cases/                # Case-related components
│   │   ├── documents/            # Document components
│   │   ├── forms/                # Form components
│   │   └── error/                # Error boundary
│   │
│   ├── hooks/
│   │   ├── use-cases.ts
│   │   ├── use-documents.ts
│   │   ├── use-forms.ts
│   │   ├── use-role.ts
│   │   ├── use-role-guard.ts
│   │   ├── use-notifications.ts
│   │   ├── use-firm.ts
│   │   └── use-firm-members.ts
│   │
│   ├── lib/
│   │   ├── ai/                   # AI integration
│   │   │   ├── index.ts
│   │   │   ├── prompts/
│   │   │   └── document-types.ts
│   │   │
│   │   ├── api/
│   │   │   └── fetch-with-timeout.ts
│   │   │
│   │   ├── file-validation/      # Upload validation
│   │   │   └── index.ts
│   │   │
│   │   ├── form-validation/      # AI confidence checks
│   │   │   └── index.ts
│   │   │
│   │   ├── forms/                # Form definitions
│   │   │   └── definitions/
│   │   │       ├── index.ts
│   │   │       ├── i-130.ts
│   │   │       ├── i-485.ts
│   │   │       └── ...
│   │   │
│   │   ├── pdf/                  # PDF generation
│   │   │   ├── index.ts
│   │   │   └── templates/
│   │   │
│   │   ├── rate-limit/           # Rate limiting
│   │   │   ├── index.ts
│   │   │   └── health.ts
│   │   │
│   │   ├── rbac/                 # Role-based access
│   │   │   └── index.ts
│   │   │
│   │   ├── sentry/               # Error tracking
│   │   │   └── index.ts
│   │   │
│   │   ├── supabase/             # Supabase clients
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   │
│   │   ├── csrf.ts               # CSRF protection
│   │   ├── audit.ts              # Audit logging
│   │   └── utils.ts              # Utilities (cn, etc.)
│   │
│   ├── providers/                # React context providers
│   │   ├── auth-provider.tsx
│   │   ├── query-provider.tsx
│   │   └── theme-provider.tsx
│   │
│   ├── store/                    # Zustand stores
│   │   └── ui-store.ts
│   │
│   └── types/                    # TypeScript types
│       ├── database.ts
│       ├── forms.ts
│       └── ...
│
├── supabase/
│   └── migrations/               # SQL migrations
│
├── tests/
│   └── e2e/                      # Playwright E2E tests
│
├── sentry.client.config.ts
├── sentry.server.config.ts
├── sentry.edge.config.ts
├── next.config.ts
├── tailwind.config.ts
├── playwright.config.ts
├── CLAUDE.md                     # Project instructions
├── ARCHITECTURE.md               # This file
└── package.json
```

---

## Deployment Architecture

### Vercel Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VERCEL DEPLOYMENT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EDGE NETWORK                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Global CDN (static assets, ISR pages)                              │   │
│  │ • Edge Middleware (auth, rate limiting, redirects)                   │   │
│  │ • DDoS protection                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SERVERLESS FUNCTIONS                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • API Routes (/api/*)                                                │   │
│  │ • Server Components (SSR)                                            │   │
│  │ • Automatic scaling                                                  │   │
│  │ • 10s default timeout, 60s max for AI operations                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ENVIRONMENT VARIABLES                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Production:    Encrypted, scoped to production                       │   │
│  │ Preview:       Separate values for PR previews                       │   │
│  │ Development:   Local .env.local                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Environment Variables

```bash
# Required for all environments
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx  # Server only

# AI Services
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# Rate Limiting (Required for production)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Error Tracking (Optional but recommended)
SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=immigration-ai

# File Scanning (Production)
VIRUS_SCANNER_PROVIDER=clamav  # or 'virustotal'
CLAMAV_API_URL=http://clamav:3310
# or
VIRUSTOTAL_API_KEY=xxx

# Development bypass (NOT for production)
ALLOW_IN_MEMORY_RATE_LIMIT=true
```

---

## Appendix: Key Decisions

### Why Next.js 16 App Router?

- Server Components reduce client bundle size
- Built-in API routes eliminate need for separate backend
- Excellent TypeScript support
- Vercel deployment is seamless
- React 19 features (use, Server Actions)

### Why Supabase over Firebase/Auth0?

- PostgreSQL with full SQL support
- Built-in Row Level Security
- Self-hostable if needed
- Generous free tier
- Realtime subscriptions out of the box

### Why Two AI Providers?

- **OpenAI GPT-4o**: Best-in-class vision/OCR capabilities for document extraction
- **Claude**: Superior reasoning and instruction-following for form mapping
- Using both leverages their respective strengths

### Why Upstash Redis vs Cloudflare Rate Limit?

- Upstash is purpose-built for rate limiting
- Works with any deployment platform
- @upstash/ratelimit library is production-ready
- Fail-closed behavior is critical for security

### Why pdf-lib vs Puppeteer?

- pdf-lib is pure JavaScript (no browser dependency)
- Works in serverless environments
- Smaller bundle size
- Can fill existing PDF forms (future: USCIS templates)

---

*This document should be updated as the architecture evolves.*
