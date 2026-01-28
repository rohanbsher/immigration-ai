# Immigration AI - AI-Native Features Implementation TODO

> Master TODO list for AI-native features implementation.
> **Created:** 2026-01-27
> **Timeline:** 12-17 days (~100-136 hours)
> **Goal:** Transform from "AI-powered" to "truly AI-native"

---

## How to Use This File

### For Agents
1. **Claim a feature** by adding your agent ID to the "Assigned" field
2. **Only work on files in your feature** to avoid conflicts
3. **Update status** as you complete tasks: `[ ]` → `[x]`
4. **Write session summary** when done

### Parallel Execution
- **Features 1-5 can run in parallel** (no interdependencies)
- **Feature 6 must wait** until Features 1-5 are complete (it uses them all)

### Agent Assignment Strategy
- **Agent A:** Features 1 + 2 (Completeness + Scoring - closely related)
- **Agent B:** Feature 3 (Recommendations - uses existing `suggestNextSteps()`)
- **Agent C:** Feature 4 (Deadline Alerts - independent background job)
- **Agent D:** Feature 5 (Natural Language Search - independent)
- **Agent E:** Feature 6 (Chat - depends on all above, do last)

---

## Current Status Overview

| Feature | Status | Assigned | Est. Days | Dependencies |
|---------|--------|----------|-----------|--------------|
| 0: Shared Infrastructure | **COMPLETE** | - | 0.5 | None |
| 1: Document Completeness | **COMPLETE** | - | 2-3 | None |
| 2: Success Probability Scoring | **COMPLETE** | - | 1-2 | Feature 1 |
| 3: AI Case Recommendations | **COMPLETE** | - | 1-2 | Feature 1 |
| 4: Predictive Deadline Alerts | **COMPLETE** | - | 2-3 | None |
| 5: Natural Language Case Search | **COMPLETE** | - | 2-3 | None |
| 6: AI Chat Assistant | **COMPLETE** | - | 4-5 | Features 1-5 |

### UI Integration Status (2026-01-27)

| Integration Point | Status | Description |
|-------------------|--------|-------------|
| Dashboard Layout + Chat | **COMPLETE** | ChatButton and ChatPanel added |
| Dashboard Page + Widgets | **COMPLETE** | DeadlineWidget added, SuccessScoreBadge on cases |
| Case Card + Badges | **COMPLETE** | SuccessScoreBadge added |
| Header + AI Search | **COMPLETE** | AISearchInput replaces basic search |
| Case Detail + AI Panels | **COMPLETE** | All AI panels integrated (Completeness, Score, Recommendations) |

---

## SHARED INFRASTRUCTURE (Do First)

**Status:** READY
**Priority:** CRITICAL (required by all features)
**Assigned Agent:** _none_

### File Ownership
```
/src/lib/rate-limit/index.ts      # MODIFY - Add new AI rate limits
/src/components/ai/ai-badge.tsx   # NEW - Shared AI visual language
/src/lib/ai/utils.ts              # NEW - Shared AI utilities
```

### Tasks

#### 0.1 Rate Limiting Updates (1h)
- [ ] Add new rate limits to `/src/lib/rate-limit/index.ts`:
  ```typescript
  'ai:recommendations': { limit: 20, window: '1h' }
  'ai:success-score': { limit: 20, window: '1h' }
  'ai:search': { limit: 30, window: '1m' }
  'ai:chat': { limit: 50, window: '1h' }
  'ai:completeness': { limit: 30, window: '1h' }
  ```

#### 0.2 AI Visual Language Components (1h)
- [ ] Create `/src/components/ai/ai-badge.tsx`
  - Purple gradient badge with Sparkles icon
  - Props: `size: 'sm' | 'md' | 'lg'`
- [ ] Create `/src/components/ai/ai-content-box.tsx`
  - Dashed purple left border
  - Subtle background tint
- [ ] Create `/src/components/ai/ai-loading.tsx`
  - "AI is thinking..." with animated dots

#### 0.3 AI Utility Functions (1h)
- [ ] Create `/src/lib/ai/utils.ts`
  ```typescript
  // Fallback wrapper for AI calls
  async function withAIFallback<T>(
    aiCall: () => Promise<T>,
    fallback: () => T
  ): Promise<{ result: T; source: 'ai' | 'fallback' }>

  // Parse Claude JSON response (handles markdown code blocks)
  function parseClaudeJSON<T>(content: string): T
  ```

---

## FEATURE 1: Document Completeness Analysis

**Status:** READY
**Priority:** HIGH
**Impact:** HIGH | Complexity: LOW
**Estimated Effort:** 2-3 days (16-24h)
**Assigned Agent:** _none_

### What It Does
Analyzes what documents are missing for a specific visa type, compares uploaded docs against requirements, and shows progress toward "filing ready."

### File Ownership
```
/src/lib/ai/document-completeness.ts        # NEW - Core analysis logic
/src/app/api/cases/[id]/completeness/route.ts   # NEW - API endpoint
/src/components/ai/document-completeness-panel.tsx  # NEW - UI widget
/src/hooks/use-document-completeness.ts     # NEW - React Query hook
```

### Tasks

#### 1.1 Backend: Core Logic (4h)
- [ ] Create `/src/lib/ai/document-completeness.ts`
  - Interface `CompletenessResult`:
    ```typescript
    interface CompletenessResult {
      overallCompleteness: number;  // 0-100%
      filingReadiness: 'ready' | 'needs_review' | 'incomplete';
      missingRequired: string[];
      missingOptional: string[];
      uploadedDocs: Array<{
        type: string;
        quality: number;
        status: 'verified' | 'needs_review' | 'rejected';
      }>;
      recommendations: string[];
    }
    ```
  - Function `analyzeDocumentCompleteness(caseId: string): Promise<CompletenessResult>`
  - Query `document_checklists` table for visa requirements
  - Compare against `documents` table for case
  - Calculate completeness percentage

#### 1.2 Backend: API Endpoint (2h)
- [ ] Create `/src/app/api/cases/[id]/completeness/route.ts`
  - GET handler with auth check
  - Rate limit: `ai:completeness`
  - Return `CompletenessResult` JSON
  - Handle errors gracefully

#### 1.3 Backend: Database Helper (1h)
- [ ] Create `/src/lib/db/document-checklists.ts`
  - `getChecklistForVisaType(visaType: string)`
  - Return required and optional documents

#### 1.4 Frontend: Hook (2h)
- [ ] Create `/src/hooks/use-document-completeness.ts`
  - React Query hook with caching
  - Auto-refetch on document upload
  - Loading and error states

#### 1.5 Frontend: UI Widget (4h)
- [ ] Create `/src/components/ai/document-completeness-panel.tsx`
  - Progress ring showing percentage
  - Checklist with required/optional grouping
  - Document type icons
  - "Upload" action buttons for missing docs
  - AI badge decoration

#### 1.6 Frontend: Integration (3h)
- [ ] Add to Case Detail Page Overview tab
  - Progress ring in header
  - Checklist below case info
- [ ] Add mini widget to Dashboard
  - Show cases with incomplete docs
- [ ] Add small badge to Case Cards
  - Color-coded completion status

#### 1.7 Testing (2h)
- [ ] Unit tests for `analyzeDocumentCompleteness()`
- [ ] API endpoint tests
- [ ] Component tests for panel
- [ ] Integration test: upload doc → completeness updates

### Verification Checklist
- [ ] Create case with I-485 visa type
- [ ] Upload 2-3 documents
- [ ] Call `GET /api/cases/[id]/completeness`
- [ ] Verify missing docs list matches visa requirements
- [ ] Verify UI shows progress ring and checklist
- [ ] Build passes

---

## FEATURE 2: Success Probability Scoring

**Status:** READY
**Priority:** HIGH
**Impact:** HIGH | Complexity: LOW
**Estimated Effort:** 1-2 days (8-16h)
**Assigned Agent:** _none_
**Depends On:** Feature 1 (uses completeness score)

### What It Does
Calculates case approval likelihood (0-100%) based on document quality, form confidence, and completeness. **Rule-based algorithm** (no AI calls), with optional AI explanation.

### Scoring Algorithm
| Factor | Weight | Source |
|--------|--------|--------|
| Document Completeness | 30% | Feature 1 |
| Document Quality | 15% | Average ai_confidence_score |
| Form Field Confidence | 20% | Average from ai_confidence_scores |
| Field Validation | 15% | % of fields passing validation |
| Timeline | 10% | Days remaining vs processing time |
| Historical | 10% | Placeholder for future ML |

### File Ownership
```
/src/lib/scoring/success-probability.ts     # NEW - Rule-based calculation
/src/app/api/cases/[id]/success-score/route.ts  # NEW - API endpoint
/src/components/ai/success-score-badge.tsx  # NEW - Small badge for cards
/src/components/ai/success-score-breakdown.tsx  # NEW - Detailed view
/src/hooks/use-success-score.ts             # NEW - React Query hook
```

### Tasks

#### 2.1 Backend: Scoring Logic (3h)
- [ ] Create `/src/lib/scoring/success-probability.ts`
  - Interface `SuccessScore`:
    ```typescript
    interface SuccessScore {
      overallScore: number;  // 0-100
      confidence: number;    // 0-1 (how confident we are in the score)
      factors: Array<{
        name: string;
        score: number;
        weight: number;
        rawValue?: number | string;
      }>;
      riskFactors: string[];
      improvements: string[];
    }
    ```
  - Function `calculateSuccessScore(caseId: string): Promise<SuccessScore>`
  - Collect all factor data
  - Apply weights and calculate

#### 2.2 Backend: API Endpoint (2h)
- [ ] Create `/src/app/api/cases/[id]/success-score/route.ts`
  - GET handler with auth check
  - Rate limit: `ai:success-score`
  - Return `SuccessScore` JSON
  - Cache result for 1 hour

#### 2.3 Frontend: Hook (1h)
- [ ] Create `/src/hooks/use-success-score.ts`
  - React Query hook with caching
  - Auto-refetch on case changes

#### 2.4 Frontend: Badge Component (2h)
- [ ] Create `/src/components/ai/success-score-badge.tsx`
  - Color-coded: green (70+), yellow (40-69), red (<40)
  - Show percentage with tooltip
  - AI sparkle decoration

#### 2.5 Frontend: Breakdown Component (3h)
- [ ] Create `/src/components/ai/success-score-breakdown.tsx`
  - Expandable/collapsible detail view
  - Factor bars with weights
  - Risk factors list
  - Improvement suggestions
  - AI content box styling

#### 2.6 Frontend: Integration (2h)
- [ ] Add badge to Case Cards in list view
- [ ] Add prominent score in Case Detail header
  - Click to expand breakdown

#### 2.7 Testing (1h)
- [ ] Unit tests for scoring algorithm
- [ ] API endpoint tests
- [ ] Component tests

### Verification Checklist
- [ ] Use case from Feature 1
- [ ] Call `GET /api/cases/[id]/success-score`
- [ ] Verify score is between 0-100
- [ ] Verify factors sum correctly with weights
- [ ] Verify badge appears on case card
- [ ] Build passes

---

## FEATURE 3: AI Case Recommendations

**Status:** READY
**Priority:** HIGH
**Impact:** HIGH | Complexity: LOW
**Estimated Effort:** 1-2 days (8-16h)
**Assigned Agent:** _none_
**Depends On:** Feature 1 (uses completeness data)

### What It Does
Generates prioritized "next steps" based on case state.

**Note:** `suggestNextSteps()` already exists in `/src/lib/ai/anthropic.ts` - just needs API exposure and caching.

### File Ownership
```
/src/app/api/cases/[id]/recommendations/route.ts  # NEW - API endpoint
/src/lib/db/recommendations.ts              # NEW - Caching layer
/src/components/ai/next-steps-panel.tsx     # NEW - Recommendations widget
/src/hooks/use-recommendations.ts           # NEW - React Query hook
```

### Tasks

#### 3.1 Backend: Caching Layer (2h)
- [ ] Create `/src/lib/db/recommendations.ts`
  - Store in Redis: `recommendations:{caseId}` with 1-hour TTL
  - Interface for cache operations:
    ```typescript
    interface CachedRecommendations {
      recommendations: Array<{
        id: string;
        priority: 'high' | 'medium' | 'low';
        action: string;
        reason: string;
        category: 'document' | 'form' | 'deadline' | 'review';
        actionUrl?: string;
      }>;
      generatedAt: string;
      expiresAt: string;
    }
    ```
  - Invalidation triggers: document upload, form change, status change

#### 3.2 Backend: API Endpoint (2h)
- [ ] Create `/src/app/api/cases/[id]/recommendations/route.ts`
  - GET handler with auth check
  - Rate limit: `ai:recommendations`
  - Check cache first, call `suggestNextSteps()` if miss
  - Return cached or fresh recommendations

#### 3.3 Frontend: Hook (1h)
- [ ] Create `/src/hooks/use-recommendations.ts`
  - React Query hook
  - Manual refetch option
  - Loading state

#### 3.4 Frontend: Panel Component (4h)
- [ ] Create `/src/components/ai/next-steps-panel.tsx`
  - Priority-sorted list
  - Color-coded priority indicators
  - Action buttons (link to action URL)
  - "Complete" and "Dismiss" buttons
  - AI content box styling
  - Empty state

#### 3.5 Frontend: Dashboard Widget (2h)
- [ ] Create "Next Steps" widget for Dashboard
  - Show top actions across all cases
  - Group by case
  - Quick navigation

#### 3.6 Frontend: Case Detail Integration (2h)
- [ ] Add recommendations panel to Case Detail page
  - Dedicated tab or sidebar section
  - Refresh button

#### 3.7 Testing (1h)
- [ ] API endpoint tests
- [ ] Cache hit/miss tests
- [ ] Component tests

### Verification Checklist
- [ ] Use case from Feature 1
- [ ] Call `GET /api/cases/[id]/recommendations`
- [ ] Verify recommendations include missing documents
- [ ] Verify caching works (second call is faster)
- [ ] Verify UI panel shows prioritized actions
- [ ] Build passes

---

## FEATURE 4: Predictive Deadline Alerts

**Status:** READY
**Priority:** HIGH
**Impact:** HIGH | Complexity: MEDIUM
**Estimated Effort:** 2-3 days (16-24h)
**Assigned Agent:** _none_

### What It Does
Proactively notifies attorneys about upcoming deadlines and document expirations via notifications and email.

### File Ownership
```
/src/lib/deadline/index.ts                  # NEW - Deadline calculation logic
/src/lib/deadline/processing-times.ts       # NEW - USCIS processing estimates
/src/app/api/cron/deadline-alerts/route.ts  # NEW - Vercel Cron endpoint
/src/app/api/cases/deadlines/route.ts       # NEW - User-facing endpoint
/src/components/dashboard/deadline-widget.tsx   # NEW - Dashboard widget
/src/hooks/use-deadlines.ts                 # NEW - React Query hook
/supabase/migrations/012_deadline_alerts.sql    # NEW - Database migration
```

### Tasks

#### 4.1 Database: Migration (1h)
- [ ] Create `/supabase/migrations/012_deadline_alerts.sql`
  ```sql
  CREATE TABLE deadline_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,  -- 'case_deadline', 'document_expiry', 'processing_estimate'
    deadline_date DATE NOT NULL,
    severity TEXT NOT NULL,    -- 'critical', 'warning', 'info'
    message TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(case_id, alert_type, deadline_date)
  );

  CREATE INDEX idx_deadline_alerts_user ON deadline_alerts(user_id);
  CREATE INDEX idx_deadline_alerts_unack ON deadline_alerts(user_id) WHERE NOT acknowledged;

  ALTER TABLE deadline_alerts ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can view their alerts"
    ON deadline_alerts FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY "Users can update their alerts"
    ON deadline_alerts FOR UPDATE
    USING (user_id = auth.uid());
  ```

#### 4.2 Backend: Processing Times Data (1h)
- [ ] Create `/src/lib/deadline/processing-times.ts`
  - USCIS processing time estimates by form type
  - Function `getProcessingTime(formType: string): { min: number, max: number, unit: 'days' | 'months' }`

#### 4.3 Backend: Deadline Logic (3h)
- [ ] Create `/src/lib/deadline/index.ts`
  - Interface `DeadlineAlert`:
    ```typescript
    interface DeadlineAlert {
      id: string;
      caseId: string;
      alertType: 'case_deadline' | 'document_expiry' | 'processing_estimate';
      deadlineDate: Date;
      severity: 'critical' | 'warning' | 'info';
      message: string;
      daysRemaining: number;
    }
    ```
  - Function `calculateDeadlines(caseId: string): DeadlineAlert[]`
  - Function `getUpcomingDeadlines(userId: string, days: number): DeadlineAlert[]`
  - Alert windows: Critical (<7 days), Warning (7-30 days), Info (30-60 days)

#### 4.4 Backend: Cron Job (3h)
- [ ] Create `/src/app/api/cron/deadline-alerts/route.ts`
  - Vercel Cron endpoint (daily at 6 AM UTC)
  - Query all cases with upcoming deadlines
  - Create/update alerts in database
  - Create notifications for new alerts
  - (Future: trigger emails)
- [ ] Add cron config to `vercel.json`:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/deadline-alerts",
        "schedule": "0 6 * * *"
      }
    ]
  }
  ```

#### 4.5 Backend: User-Facing Endpoint (2h)
- [ ] Create `/src/app/api/cases/deadlines/route.ts`
  - GET: Return upcoming deadlines for user
  - Query params: `days` (default 60)
- [ ] Create `/src/app/api/cases/deadlines/[alertId]/route.ts`
  - PATCH: Acknowledge or snooze alert

#### 4.6 Frontend: Hook (1h)
- [ ] Create `/src/hooks/use-deadlines.ts`
  - React Query hook for deadlines
  - Mutation for acknowledge/snooze

#### 4.7 Frontend: Dashboard Widget (4h)
- [ ] Create `/src/components/dashboard/deadline-widget.tsx`
  - Timeline view of upcoming deadlines
  - Severity color coding (red/yellow/blue)
  - Group by case
  - Acknowledge/snooze actions
  - Link to case detail

#### 4.8 Frontend: Integration (2h)
- [ ] Replace "Upcoming Deadlines" stat on dashboard with widget
- [ ] Add deadline notifications to notification dropdown
  - Severity-colored icons
- [ ] Add deadline timeline to Case Detail Overview tab

#### 4.9 Testing (2h)
- [ ] Unit tests for deadline calculation
- [ ] Cron job tests (mock date)
- [ ] API endpoint tests
- [ ] Widget component tests

### Verification Checklist
- [ ] Create case with deadline 5 days away
- [ ] Run cron job manually (POST with secret)
- [ ] Verify notification created with "critical" severity
- [ ] Verify deadline widget shows on dashboard
- [ ] Test snooze functionality
- [ ] Test dismiss functionality
- [ ] Build passes

---

## FEATURE 5: Natural Language Case Search

**Status:** READY
**Priority:** MEDIUM
**Impact:** MEDIUM | Complexity: MEDIUM
**Estimated Effort:** 2-3 days (16-24h)
**Assigned Agent:** _none_

### What It Does
Allows semantic search queries like "cases with missing I-94" or "H1B cases filed last month."

### Architecture Decision
**Use Claude query parsing** (not vector embeddings) for MVP:
- No infrastructure changes required
- Cheaper for low-to-medium volume
- Simpler to implement and maintain

### File Ownership
```
/src/lib/ai/natural-search.ts               # NEW - Query parsing with Claude
/src/app/api/cases/search/route.ts          # NEW - POST endpoint
/src/components/search/ai-search-input.tsx  # NEW - Enhanced search bar
/src/components/search/search-results.tsx   # NEW - Results with explanations
/src/hooks/use-natural-search.ts            # NEW - React Query mutation
```

### Tasks

#### 5.1 Backend: Search Logic (4h)
- [ ] Create `/src/lib/ai/natural-search.ts`
  - Interface `SearchInterpretation`:
    ```typescript
    interface SearchInterpretation {
      understood: string;  // Human-readable interpretation
      filters: {
        visaType?: string[];
        status?: string[];
        dateRange?: { start?: Date; end?: Date };
        documentMissing?: string[];
        documentPresent?: string[];
        clientName?: string;
        priority?: string;
      };
      sortBy?: string;
      confidence: number;
    }

    interface SearchResult {
      case: CaseWithDetails;
      relevanceScore: number;
      matchReason: string;
    }
    ```
  - Function `parseSearchQuery(query: string): Promise<SearchInterpretation>`
    - Call Claude to parse natural language to filters
  - Function `executeSearch(interpretation: SearchInterpretation): Promise<SearchResult[]>`
    - Build SQL query from filters
    - Execute and rank results

#### 5.2 Backend: API Endpoint (2h)
- [ ] Create `/src/app/api/cases/search/route.ts`
  - POST handler with body: `{ query: string }`
  - Rate limit: `ai:search`
  - Return interpretation + results
  - Handle empty results gracefully

#### 5.3 Frontend: Hook (1h)
- [ ] Create `/src/hooks/use-natural-search.ts`
  - React Query mutation (not query - user-triggered)
  - Debounced input handling
  - Loading and error states

#### 5.4 Frontend: Search Input (3h)
- [ ] Create `/src/components/search/ai-search-input.tsx`
  - Text input with AI toggle
  - Placeholder examples
  - Loading indicator
  - AI badge when in semantic mode

#### 5.5 Frontend: Search Results (3h)
- [ ] Create `/src/components/search/search-results.tsx`
  - Show interpretation: "Searching for: ..."
  - Case cards with match reason highlighted
  - Relevance score indicator
  - Suggestions for related searches
  - Empty state with suggestions

#### 5.6 Frontend: Integration (3h)
- [ ] Enhance Header search
  - Toggle between exact and AI search
  - Quick search dropdown
- [ ] Add to Cases page
  - Full search interface
  - Filter chips from interpretation
- [ ] Cmd+K global search modal
  - Natural language support

#### 5.7 Testing (2h)
- [ ] Unit tests for query parsing
- [ ] API endpoint tests
- [ ] Component tests
- [ ] Integration test: search → results

### Verification Checklist
- [ ] Create multiple cases with different visa types
- [ ] Search "H1B cases"
- [ ] Verify Claude parses to `visa_type: ['H1B']` filter
- [ ] Search "cases with missing passport"
- [ ] Verify semantic understanding works
- [ ] Verify results show match reasons
- [ ] Build passes

---

## FEATURE 6: AI Chat Assistant

**Status:** BLOCKED
**Priority:** HIGH
**Impact:** HIGH | Complexity: HIGH
**Estimated Effort:** 4-5 days (32-40h)
**Assigned Agent:** _none_
**Blocked By:** Features 1, 2, 3, 4, 5 (uses all of them for context)

### What It Does
Interactive chat that answers attorney questions about specific cases with streaming responses.

### File Ownership
```
/src/lib/ai/chat/index.ts                   # NEW - Chat orchestration
/src/lib/ai/chat/context-builder.ts         # NEW - Build case context
/src/lib/ai/chat/tools.ts                   # NEW - Function calling definitions
/src/lib/db/conversations.ts                # NEW - Conversation persistence
/src/app/api/chat/route.ts                  # NEW - Streaming endpoint
/src/components/chat/chat-button.tsx        # NEW - Floating button
/src/components/chat/chat-panel.tsx         # NEW - Slide-out panel
/src/components/chat/chat-message.tsx       # NEW - Message bubbles
/src/store/chat-store.ts                    # NEW - Zustand state
/src/hooks/use-chat.ts                      # NEW - Chat hook
/supabase/migrations/016_chat.sql           # NEW - Database migration
```

### Tasks

#### 6.1 Database: Migration (1h)
- [ ] Create `/supabase/migrations/016_chat.sql`
  ```sql
  CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX idx_conversations_user ON conversations(user_id);
  CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id);

  ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their conversations"
    ON conversations FOR ALL
    USING (user_id = auth.uid());

  CREATE POLICY "Users can manage their messages"
    ON conversation_messages FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_messages.conversation_id
        AND conversations.user_id = auth.uid()
      )
    );
  ```

#### 6.2 Backend: Context Builder (3h)
- [ ] Create `/src/lib/ai/chat/context-builder.ts`
  - Function `buildCaseContext(caseId: string): string`
    - Gather case details
    - Include completeness (Feature 1)
    - Include success score (Feature 2)
    - Include recommendations (Feature 3)
    - Include deadlines (Feature 4)
    - Format as structured context for Claude

#### 6.3 Backend: Tool Definitions (2h)
- [ ] Create `/src/lib/ai/chat/tools.ts`
  - Define tools Claude can call:
    - `get_case_details`: Fetch case info
    - `get_documents`: List documents
    - `get_completeness`: Get completeness analysis
    - `get_recommendations`: Get next steps
    - `search_cases`: Search with filters

#### 6.4 Backend: Chat Orchestration (4h)
- [ ] Create `/src/lib/ai/chat/index.ts`
  - Interface `ChatMessage`:
    ```typescript
    interface ChatMessage {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      createdAt: Date;
    }
    ```
  - Function `streamChatResponse(messages: ChatMessage[], caseId?: string)`
    - Build system prompt with context
    - Stream response chunks
    - Handle tool calls

#### 6.5 Backend: Conversation Persistence (2h)
- [ ] Create `/src/lib/db/conversations.ts`
  - `createConversation(userId, caseId?)`
  - `getConversation(id)`
  - `getConversations(userId)`
  - `addMessage(conversationId, role, content)`
  - `deleteConversation(id)`

#### 6.6 Backend: Streaming Endpoint (3h)
- [ ] Create `/src/app/api/chat/route.ts`
  - POST handler with streaming response
  - Rate limit: `ai:chat`
  - Use Server-Sent Events
  - Handle conversation persistence

#### 6.7 Frontend: Zustand Store (1h)
- [ ] Create `/src/store/chat-store.ts`
  - State: `messages`, `isOpen`, `currentConversationId`, `caseId`
  - Actions: `openChat`, `closeChat`, `sendMessage`, `clearMessages`

#### 6.8 Frontend: Chat Hook (2h)
- [ ] Create `/src/hooks/use-chat.ts`
  - Connect to store
  - Handle streaming response
  - Message submission
  - Typing indicator state

#### 6.9 Frontend: Message Component (2h)
- [ ] Create `/src/components/chat/chat-message.tsx`
  - User message bubble (right-aligned)
  - Assistant message bubble (left-aligned, AI styled)
  - Streaming text animation
  - Timestamp

#### 6.10 Frontend: Chat Panel (4h)
- [ ] Create `/src/components/chat/chat-panel.tsx`
  - 400px slide-out from right
  - Header with context indicator ("Discussing: Case #123")
  - Message list with scroll
  - Input area with send button
  - Typing indicator
  - New conversation button

#### 6.11 Frontend: Floating Button (1h)
- [ ] Create `/src/components/chat/chat-button.tsx`
  - Fixed position bottom-right
  - AI sparkle icon
  - Badge for unread/active
  - Click to open panel

#### 6.12 Frontend: Integration (3h)
- [ ] Add floating button to dashboard layout
  - Only show for authenticated users
- [ ] Context awareness on Case Detail page
  - Auto-set case context when opening
  - Clear indicator of which case

#### 6.13 Testing (3h)
- [ ] Streaming endpoint tests
- [ ] Conversation persistence tests
- [ ] Component tests
- [ ] Integration test: send message → receive streamed response

### Verification Checklist
- [ ] Open chat on a case page
- [ ] Ask "What documents are missing?"
- [ ] Verify streaming response
- [ ] Verify context awareness (knows the case)
- [ ] Test conversation persistence
- [ ] Verify new conversation works
- [ ] Build passes

---

## Critical Files to Modify

| File | Changes | Owner |
|------|---------|-------|
| `/src/app/dashboard/page.tsx` | Add AI widgets | Features 1, 3, 4 |
| `/src/components/cases/case-card.tsx` | Add success score badge | Feature 2 |
| `/src/app/dashboard/cases/[id]/page.tsx` | Add recommendations, deadlines | Features 3, 4 |
| `/src/components/layout/header.tsx` | Enhance search | Feature 5 |
| `/src/components/layout/dashboard-layout.tsx` | Add chat button | Feature 6 |
| `/src/lib/rate-limit/index.ts` | Add new AI rate limits | Shared |

---

## Agent Session Log

| Date | Agent | Feature(s) | Summary |
|------|-------|------------|---------|
| 2026-01-27 | - | Planning | Created TODO-ai-features.md |
| 2026-01-27 | Opus | UI Integration | Integrated all 6 AI features into UI: Dashboard (ChatButton, ChatPanel, DeadlineWidget, SuccessScoreBadge), Header (AISearchInput), Case Card (SuccessScoreBadge), Case Detail (DocumentCompletenessPanel, SuccessScoreBreakdown, NextStepsPanel, CaseChatButton). Build passes. |

---

## Environment Variables

No new environment variables required - uses existing:
- `ANTHROPIC_API_KEY` - For Claude API calls
- `UPSTASH_REDIS_REST_URL` - For rate limiting and caching
- `UPSTASH_REDIS_REST_TOKEN` - For rate limiting and caching

---

## Notes

### Visual Language Consistency
All AI features should use:
- **AI Badge**: Purple gradient with Sparkles icon
- **AI Content**: Dashed purple left border, subtle background tint
- **Loading**: "AI is thinking..." with animated dots

### Error Handling
All AI features should use the `withAIFallback()` pattern to gracefully handle failures.

### Caching Strategy
- Completeness: No cache (real-time)
- Success Score: 1-hour cache
- Recommendations: 1-hour cache with invalidation
- Deadlines: Database-persisted
- Search: No cache (per-query)
- Chat: Conversation persistence

---

## Quick Start for Agents

1. **Read this TODO** thoroughly
2. **Claim your feature** by editing "Assigned Agent" field
3. **Read ARCHITECTURE.md** for project context
4. **Do Shared Infrastructure first** if not done
5. **Create files** only in your feature's directories
6. **Run `npm run build`** after each major change
7. **Update this TODO** with task completion
8. **Write session summary** in `/sessions/` when done
