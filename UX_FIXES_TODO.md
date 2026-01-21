# Immigration AI - UX Fixes Master To-Do List

## Summary
- **Total Issues Found:** 94
- **Critical:** 22 | **High:** 35 | **Medium:** 27 | **Low:** 10
- **Estimated Total Effort:** 93-122.5 hours

---

## Quick Wins (Under 1 hour each) - Start Here

### 1. Fix Broken Navigation Routes
- [ ] **Create /dashboard/notifications page** (30 min)
  - File: `src/app/dashboard/notifications/page.tsx`
  - Currently 404s from header bell icon

- [ ] **Replace window.location.href with router.push** (15 min)
  - File: `src/app/dashboard/cases/[id]/page.tsx:280`
  - File: `src/components/cases/case-card.tsx`
  - Prevents full page reload, maintains state

### 2. Accessibility Quick Fixes
- [ ] **Add ARIA labels to icon-only buttons** (45 min)
  - Files: All components with icon buttons
  ```tsx
  // Before
  <Button variant="ghost" size="icon">
    <Bell className="h-5 w-5" />
  </Button>

  // After
  <Button variant="ghost" size="icon" aria-label="View notifications">
    <Bell className="h-5 w-5" />
  </Button>
  ```

- [ ] **Add prefers-reduced-motion CSS** (15 min)
  - File: `src/app/globals.css`
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

### 3. Form UX Quick Fixes
- [ ] **Standardize required field indicators** (30 min)
  - Add red asterisk after all required field labels
  - File: Create wrapper in `src/components/ui/form-field.tsx`

---

## Week 1: Critical Foundation (Priority Order)

### Phase 1A: Error Handling Infrastructure (4-5 hours)

#### 1. Add React Query Retry Logic
- [ ] **Configure global retry settings** (1 hour)
  - File: `src/lib/query-client.ts`
  ```typescript
  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 5 * 60 * 1000,
      },
      mutations: {
        retry: 1,
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'An error occurred');
        },
      },
    },
  });
  ```

#### 2. Create Confirmation Dialog Component
- [ ] **Build reusable confirmation dialog** (2 hours)
  - File: `src/components/ui/confirmation-dialog.tsx`
  - Replace all `window.confirm()` calls
  - Add keyboard support (Escape to cancel)
  - Files to update:
    - `src/components/documents/document-list.tsx:70`
    - `src/components/cases/case-card.tsx`

#### 3. Add Global Error Boundary
- [ ] **Create error boundary component** (1.5 hours)
  - File: `src/components/error-boundary.tsx`
  - Wrap in `src/app/dashboard/layout.tsx`

### Phase 1B: Navigation Fixes (3-4 hours)

#### 4. Create Notifications Page
- [ ] **Build notifications list page** (2 hours)
  - File: `src/app/dashboard/notifications/page.tsx`
  - Use existing notification data from header

#### 5. Add Breadcrumb Navigation
- [ ] **Create breadcrumbs component** (1.5 hours)
  - File: `src/components/ui/breadcrumbs.tsx`
  - Add to case detail, form editor, document pages
  ```tsx
  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        {items.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
            {item.href ? (
              <Link href={item.href} className="text-blue-600 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-600">{item.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
    );
  }
  ```

---

## Week 2: Form Validation & User Feedback

### Phase 2A: Real-time Form Validation (8-10 hours)

#### 6. Create Form Validation Foundation
- [ ] **Build validation wrapper component** (3 hours)
  - File: `src/components/ui/validated-input.tsx`
  ```tsx
  interface ValidatedInputProps extends InputProps {
    error?: string;
    touched?: boolean;
    required?: boolean;
    helpText?: string;
  }

  export function ValidatedInput({
    error,
    touched,
    required,
    helpText,
    ...props
  }: ValidatedInputProps) {
    const showError = touched && error;
    return (
      <div className="space-y-1">
        <Input
          {...props}
          className={cn(props.className, showError && 'border-red-500 focus:ring-red-500')}
          aria-invalid={showError}
          aria-describedby={showError ? `${props.id}-error` : undefined}
        />
        {showError && (
          <p id={`${props.id}-error`} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {helpText && !showError && (
          <p className="text-sm text-slate-500">{helpText}</p>
        )}
      </div>
    );
  }
  ```

#### 7. Add Input Masking for Special Fields
- [ ] **Install and configure input masking** (2 hours)
  - `npm install react-input-mask`
  - Create masked input components for:
    - Phone numbers: `(XXX) XXX-XXXX`
    - SSN: `XXX-XX-XXXX`
    - Dates: `MM/DD/YYYY`
  - File: `src/components/ui/masked-input.tsx`

#### 8. Improve Form Error Messages
- [ ] **Update Zod schemas with user-friendly messages** (3 hours)
  - Files: All validation schemas in `src/lib/validations/`
  ```typescript
  // Before
  z.string().min(1)

  // After
  z.string().min(1, 'This field is required')
  ```

### Phase 2B: Loading States & Progress (6-8 hours)

#### 9. Add File Upload Progress
- [ ] **Implement upload progress indicator** (3 hours)
  - File: `src/components/documents/document-upload.tsx`
  - Track XMLHttpRequest progress or use Supabase upload options
  ```tsx
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // In upload handler
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      onUploadProgress: (progress) => {
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: (progress.loaded / progress.total) * 100
        }));
      },
    });
  ```

#### 10. Add AI Processing Progress
- [ ] **Show detailed AI processing status** (2.5 hours)
  - File: `src/components/ai/processing-status.tsx`
  - Update document analysis and form autofill to show stages:
    - "Uploading document..."
    - "Analyzing with AI..."
    - "Extracting fields..."
    - "Validating results..."

#### 11. Add Missing Loading Skeletons
- [ ] **Create skeleton components for all data views** (2 hours)
  - File: `src/components/ui/skeletons.tsx`
  - Add to: Cases grid, Documents list, Forms list, Client list
  ```tsx
  export function CaseCardSkeleton() {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="h-3 bg-slate-200 rounded w-1/4" />
          </div>
        </CardContent>
      </Card>
    );
  }
  ```

---

## Week 3: Accessibility & UI Consistency

### Phase 3A: Accessibility Compliance (6-8 hours)

#### 12. Fix Heading Hierarchy
- [ ] **Audit and fix heading levels** (2 hours)
  - Ensure single h1 per page
  - Sequential heading levels (no h1 → h3 jumps)
  - Files to check:
    - `src/app/dashboard/page.tsx`
    - `src/app/dashboard/cases/[id]/page.tsx`
    - All page components

#### 13. Add aria-live Regions
- [ ] **Announce dynamic content changes** (2 hours)
  - File: `src/components/ui/live-region.tsx`
  ```tsx
  export function LiveRegion({ message, priority = 'polite' }: {
    message: string;
    priority?: 'polite' | 'assertive';
  }) {
    return (
      <div
        aria-live={priority}
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    );
  }
  ```
  - Add to toast notifications, form submissions, data updates

#### 14. Increase Touch Targets
- [ ] **Ensure 44x44px minimum for all interactive elements** (2 hours)
  - Update button sizes in mobile views
  - Add padding to icon-only buttons
  - Files: All button components, dropdown triggers

#### 15. Add Skip Links
- [ ] **Create skip to main content link** (1 hour)
  - File: `src/app/dashboard/layout.tsx`
  ```tsx
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded"
  >
    Skip to main content
  </a>
  ```

### Phase 3B: UI Consistency (5-6 hours)

#### 16. Create Design Tokens
- [ ] **Standardize spacing, colors, and sizes** (2 hours)
  - File: `src/styles/tokens.ts`
  ```typescript
  export const tokens = {
    spacing: {
      card: 'p-4 md:p-6',
      section: 'space-y-4 md:space-y-6',
    },
    iconSizes: {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    },
    status: {
      success: 'bg-green-100 text-green-700',
      warning: 'bg-amber-100 text-amber-700',
      error: 'bg-red-100 text-red-700',
      info: 'bg-blue-100 text-blue-700',
    },
  };
  ```

#### 17. Standardize Status Badges
- [ ] **Create consistent status badge component** (1.5 hours)
  - File: `src/components/ui/status-badge.tsx`
  - Use across cases, documents, forms

#### 18. Create Empty State Component
- [ ] **Build reusable empty state** (1.5 hours)
  - File: `src/components/ui/empty-state.tsx`
  ```tsx
  interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
  ```

---

## Week 4: Advanced Features

### Phase 4A: Optimistic Updates (4-5 hours)

#### 19. Implement Optimistic Mutations
- [ ] **Add optimistic updates to common actions** (4 hours)
  - Files: `src/hooks/use-documents.ts`, `src/hooks/use-cases.ts`
  ```typescript
  const { mutate: deleteDocument } = useMutation({
    mutationFn: documentsApi.delete,
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: ['documents', caseId] });
      const previousDocs = queryClient.getQueryData(['documents', caseId]);
      queryClient.setQueryData(['documents', caseId], (old: Document[]) =>
        old.filter((doc) => doc.id !== documentId)
      );
      return { previousDocs };
    },
    onError: (err, documentId, context) => {
      queryClient.setQueryData(['documents', caseId], context?.previousDocs);
      toast.error('Failed to delete document');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', caseId] });
    },
  });
  ```

### Phase 4B: Enhanced Document Workflow (4-5 hours)

#### 20. Add Document Viewer Modal
- [ ] **Create in-app document preview** (3 hours)
  - File: `src/components/documents/document-viewer.tsx`
  - Support PDF preview using react-pdf
  - Support image preview
  - Replace direct file_url links

#### 21. Add Batch Document Actions
- [ ] **Enable selecting multiple documents** (2 hours)
  - File: `src/components/documents/document-list.tsx`
  - Add checkbox selection
  - Add batch delete, batch analyze actions

---

## Backlog (Future Iterations)

### Nice to Have
- [ ] Dark mode support (theme toggle exists but incomplete)
- [ ] Keyboard shortcuts guide modal
- [ ] Offline support with service worker
- [ ] Document version history
- [ ] Activity timeline on case detail page
- [ ] Email notifications integration
- [ ] 2FA setup completion
- [ ] Additional form definitions (I-131, I-140, etc.)

---

## Implementation Order Recommendations

### Sprint 1 (Week 1)
1. Quick wins (all)
2. React Query retry logic
3. Confirmation dialog component
4. Notifications page

### Sprint 2 (Week 2)
1. Form validation foundation
2. File upload progress
3. Loading skeletons
4. Breadcrumbs

### Sprint 3 (Week 3)
1. Accessibility fixes (all)
2. Design tokens
3. Status badge standardization
4. Empty state component

### Sprint 4 (Week 4)
1. Optimistic updates
2. Document viewer
3. Input masking
4. Remaining UI polish

---

## Testing Checklist

After each fix, verify:
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Feature works in browser
- [ ] Mobile responsive
- [ ] Keyboard accessible
- [ ] Screen reader announces properly

---

## Files Most Frequently Modified

| File | Changes |
|------|---------|
| `src/app/dashboard/cases/[id]/page.tsx` | Navigation, breadcrumbs, optimistic updates |
| `src/components/documents/document-list.tsx` | Confirmation dialog, batch actions, viewer |
| `src/components/documents/document-upload.tsx` | Progress, validation, accessibility |
| `src/hooks/use-documents.ts` | Retry logic, optimistic updates |
| `src/app/globals.css` | Reduced motion, design tokens |
| `src/components/ui/*.tsx` | New reusable components |

---

*Generated from UX Audit - 94 issues identified across 5 categories*
