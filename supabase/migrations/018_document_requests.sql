-- Migration 018: Document Requests
-- Allows attorneys to request specific documents from clients

-- Create document request status enum
CREATE TYPE document_request_status AS ENUM (
  'pending',
  'uploaded',
  'fulfilled',
  'expired',
  'cancelled'
);

-- Create document_requests table
CREATE TABLE IF NOT EXISTS document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES profiles(id),
  document_type document_type NOT NULL,
  status document_request_status DEFAULT 'pending',
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  fulfilled_by_document_id UUID REFERENCES documents(id),
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_requests_case_id ON document_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_requested_by ON document_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status);
CREATE INDEX IF NOT EXISTS idx_document_requests_due_date ON document_requests(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_document_requests_pending ON document_requests(case_id, status)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- Enable RLS
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Attorneys can view requests for their cases
CREATE POLICY "Attorneys can view document requests for their cases"
  ON document_requests FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requests.case_id
      AND c.deleted_at IS NULL
      AND c.attorney_id = auth.uid()
    )
  );

-- Clients can view requests for their cases
CREATE POLICY "Clients can view document requests for their cases"
  ON document_requests FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requests.case_id
      AND c.deleted_at IS NULL
      AND c.client_id = auth.uid()
    )
  );

-- Admins can view all requests
CREATE POLICY "Admins can view all document requests"
  ON document_requests FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Attorneys can create requests for their cases
CREATE POLICY "Attorneys can create document requests"
  ON document_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requests.case_id
      AND c.deleted_at IS NULL
      AND c.attorney_id = auth.uid()
    )
  );

-- Attorneys can update their own requests
CREATE POLICY "Attorneys can update their document requests"
  ON document_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requests.case_id
      AND c.deleted_at IS NULL
      AND c.attorney_id = auth.uid()
    )
  );

-- Clients can update requests for their cases (to mark as uploaded)
CREATE POLICY "Clients can update document requests for their cases"
  ON document_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requests.case_id
      AND c.deleted_at IS NULL
      AND c.client_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Clients can only change status to 'uploaded' and set fulfilled fields
    status IN ('pending', 'uploaded')
  );

-- Create function to update updated_at on changes
CREATE OR REPLACE FUNCTION update_document_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_document_requests_updated_at
  BEFORE UPDATE ON document_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_document_requests_updated_at();

-- Add comment for documentation
COMMENT ON TABLE document_requests IS 'Document requests from attorneys to clients for case documentation';
