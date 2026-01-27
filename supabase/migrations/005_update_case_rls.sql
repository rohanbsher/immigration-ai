-- Migration: 005_update_case_rls.sql
-- Description: Update RLS policies to support firm-based case access
-- Created: 2024

-- ============================================================================
-- DROP EXISTING CASE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own cases" ON cases;
DROP POLICY IF EXISTS "Attorneys can create cases" ON cases;
DROP POLICY IF EXISTS "Users can update their own cases" ON cases;
DROP POLICY IF EXISTS "Users can soft delete their own cases" ON cases;

-- ============================================================================
-- NEW CASE POLICIES WITH FIRM SUPPORT
-- ============================================================================

-- Cases: Users can view cases they're involved in or firm cases they have access to
CREATE POLICY "Users can view accessible cases"
  ON cases FOR SELECT
  USING (
    -- Direct ownership/involvement
    attorney_id = auth.uid() OR
    client_id = auth.uid() OR
    -- Firm-based access (owner, admin, attorney see all firm cases)
    (
      firm_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM firm_members
        WHERE firm_id = cases.firm_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'attorney')
      )
    ) OR
    -- Staff can see assigned cases only
    (
      firm_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM firm_members fm
        JOIN case_assignments ca ON ca.user_id = fm.user_id
        WHERE fm.firm_id = cases.firm_id
          AND fm.user_id = auth.uid()
          AND fm.role = 'staff'
          AND ca.case_id = cases.id
      )
    ) OR
    -- Admin access
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cases: Attorneys and firm members with appropriate roles can create cases
CREATE POLICY "Authorized users can create cases"
  ON cases FOR INSERT
  WITH CHECK (
    -- Direct attorney
    (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'attorney') AND
      attorney_id = auth.uid()
    ) OR
    -- Firm member with create permission
    (
      firm_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM firm_members
        WHERE firm_id = cases.firm_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'attorney')
      )
    ) OR
    -- Admin
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cases: Users can update their own cases or firm cases they have access to
CREATE POLICY "Authorized users can update cases"
  ON cases FOR UPDATE
  USING (
    -- Direct ownership
    attorney_id = auth.uid() OR
    -- Firm-based update access
    (
      firm_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM firm_members
        WHERE firm_id = cases.firm_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'attorney')
      )
    ) OR
    -- Admin
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cases: Attorneys can soft delete their cases
CREATE POLICY "Authorized users can soft delete cases"
  ON cases FOR DELETE
  USING (
    -- Direct ownership
    attorney_id = auth.uid() OR
    -- Firm-based delete access (owner/admin only)
    (
      firm_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM firm_members
        WHERE firm_id = cases.firm_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    ) OR
    -- Admin
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- UPDATE DOCUMENT POLICIES FOR FIRM ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can upload documents" ON documents;
DROP POLICY IF EXISTS "Document uploaders can update" ON documents;
DROP POLICY IF EXISTS "Document uploaders can delete" ON documents;
DROP POLICY IF EXISTS "Case participants can view documents" ON documents;
DROP POLICY IF EXISTS "Case participants can upload documents" ON documents;

-- Documents: Users can view documents for cases they have access to
CREATE POLICY "Users can view accessible documents"
  ON documents FOR SELECT
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND c.deleted_at IS NULL
        AND (
          c.attorney_id = auth.uid() OR
          c.client_id = auth.uid() OR
          (
            c.firm_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM firm_members fm
              WHERE fm.firm_id = c.firm_id
                AND fm.user_id = auth.uid()
                AND (
                  fm.role IN ('owner', 'admin', 'attorney') OR
                  EXISTS (
                    SELECT 1 FROM case_assignments ca
                    WHERE ca.case_id = c.id AND ca.user_id = auth.uid()
                  )
                )
            )
          )
        )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Documents: Case participants can upload
CREATE POLICY "Case participants can upload documents"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND c.deleted_at IS NULL
        AND (
          c.attorney_id = auth.uid() OR
          c.client_id = auth.uid() OR
          (
            c.firm_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM firm_members fm
              WHERE fm.firm_id = c.firm_id
                AND fm.user_id = auth.uid()
            )
          )
        )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Documents: Authorized users can update
CREATE POLICY "Authorized users can update documents"
  ON documents FOR UPDATE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND (
          c.attorney_id = auth.uid() OR
          (
            c.firm_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM firm_members fm
              WHERE fm.firm_id = c.firm_id
                AND fm.user_id = auth.uid()
                AND fm.role IN ('owner', 'admin', 'attorney')
            )
          )
        )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Documents: Attorneys can delete
CREATE POLICY "Authorized users can delete documents"
  ON documents FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND (
          c.attorney_id = auth.uid() OR
          (
            c.firm_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM firm_members fm
              WHERE fm.firm_id = c.firm_id
                AND fm.user_id = auth.uid()
                AND fm.role IN ('owner', 'admin', 'attorney')
            )
          )
        )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- UPDATE FORM POLICIES FOR FIRM ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "Attorneys can manage forms" ON forms;
DROP POLICY IF EXISTS "Case participants can view forms" ON forms;

-- Forms: Authorized users can view forms
CREATE POLICY "Authorized users can view forms"
  ON forms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = forms.case_id
        AND c.deleted_at IS NULL
        AND (
          c.attorney_id = auth.uid() OR
          c.client_id = auth.uid() OR
          (
            c.firm_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM firm_members fm
              WHERE fm.firm_id = c.firm_id
                AND fm.user_id = auth.uid()
            )
          )
        )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Forms: Attorneys and firm attorneys can manage forms
CREATE POLICY "Attorneys can manage forms"
  ON forms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = forms.case_id
        AND (
          c.attorney_id = auth.uid() OR
          (
            c.firm_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM firm_members fm
              WHERE fm.firm_id = c.firm_id
                AND fm.user_id = auth.uid()
                AND fm.role IN ('owner', 'admin', 'attorney')
            )
          )
        )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- UPDATE ACTIVITY POLICIES FOR FIRM ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "Case participants can view activities" ON activities;

CREATE POLICY "Authorized users can view activities"
  ON activities FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = activities.case_id
        AND c.deleted_at IS NULL
        AND (
          c.attorney_id = auth.uid() OR
          c.client_id = auth.uid() OR
          (
            c.firm_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM firm_members fm
              WHERE fm.firm_id = c.firm_id
                AND fm.user_id = auth.uid()
            )
          )
        )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
