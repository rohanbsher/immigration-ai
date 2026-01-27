-- Immigration AI Database Schema
-- This migration creates the initial database structure

-- Note: Using gen_random_uuid() which is built into PostgreSQL 13+
-- No extension required

-- Enum Types
CREATE TYPE user_role AS ENUM ('attorney', 'client', 'admin');
CREATE TYPE case_status AS ENUM (
  'intake',
  'document_collection',
  'in_review',
  'forms_preparation',
  'ready_for_filing',
  'filed',
  'pending_response',
  'approved',
  'denied',
  'closed'
);
CREATE TYPE visa_type AS ENUM (
  'B1B2', 'F1', 'H1B', 'H4', 'L1', 'O1',
  'EB1', 'EB2', 'EB3', 'EB5',
  'I-130', 'I-485', 'I-765', 'I-131', 'N-400',
  'other'
);
CREATE TYPE document_type AS ENUM (
  'passport', 'visa', 'i94', 'birth_certificate',
  'marriage_certificate', 'divorce_certificate',
  'employment_letter', 'pay_stub', 'tax_return', 'w2',
  'bank_statement', 'photo', 'medical_exam',
  'police_clearance', 'diploma', 'transcript',
  'recommendation_letter', 'other'
);
CREATE TYPE document_status AS ENUM (
  'uploaded', 'processing', 'analyzed', 'verified', 'rejected', 'expired'
);
CREATE TYPE form_type AS ENUM (
  'I-130', 'I-485', 'I-765', 'I-131', 'I-140',
  'I-129', 'I-539', 'I-20', 'DS-160', 'N-400', 'G-1145'
);
CREATE TYPE form_status AS ENUM (
  'draft', 'ai_filled', 'in_review', 'approved', 'filed', 'rejected'
);
CREATE TYPE activity_type AS ENUM (
  'case_created', 'case_updated', 'document_uploaded',
  'document_analyzed', 'document_verified', 'form_created',
  'form_ai_filled', 'form_reviewed', 'form_filed',
  'note_added', 'status_changed'
);

-- Users/Profiles Table (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  -- Attorney-specific fields
  bar_number TEXT,
  firm_name TEXT,
  specializations visa_type[],
  -- Client-specific fields
  date_of_birth DATE,
  country_of_birth TEXT,
  nationality TEXT,
  alien_number TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cases Table
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visa_type visa_type NOT NULL,
  status case_status NOT NULL DEFAULT 'intake',
  title TEXT NOT NULL,
  description TEXT,
  priority_date DATE,
  deadline DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents Table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  document_type document_type NOT NULL DEFAULT 'other',
  status document_status NOT NULL DEFAULT 'uploaded',
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  ai_extracted_data JSONB,
  ai_confidence_score REAL,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  expiration_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forms Table
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  form_type form_type NOT NULL,
  status form_status NOT NULL DEFAULT 'draft',
  form_data JSONB DEFAULT '{}',
  ai_filled_data JSONB,
  ai_confidence_scores JSONB,
  review_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  filed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Log Table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  activity_type activity_type NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Checklist Templates
CREATE TABLE document_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_type visa_type NOT NULL,
  document_type document_type NOT NULL,
  required BOOLEAN DEFAULT TRUE,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cases_attorney ON cases(attorney_id);
CREATE INDEX idx_cases_client ON cases(client_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_documents_case ON documents(case_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_forms_case ON forms(case_id);
CREATE INDEX idx_activities_case ON activities(case_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE NOT read;

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Profiles: Attorneys can view their clients' profiles
CREATE POLICY "Attorneys can view client profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.attorney_id = auth.uid()
      AND cases.client_id = profiles.id
    )
  );

-- Cases: Attorneys can see their own cases
CREATE POLICY "Attorneys can view their cases"
  ON cases FOR SELECT
  USING (attorney_id = auth.uid());

-- Cases: Clients can see their own cases
CREATE POLICY "Clients can view their cases"
  ON cases FOR SELECT
  USING (client_id = auth.uid());

-- Cases: Attorneys can create cases
CREATE POLICY "Attorneys can create cases"
  ON cases FOR INSERT
  WITH CHECK (
    attorney_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'attorney'
    )
  );

-- Cases: Attorneys can update their cases
CREATE POLICY "Attorneys can update their cases"
  ON cases FOR UPDATE
  USING (attorney_id = auth.uid());

-- Documents: Case participants can view documents
CREATE POLICY "Case participants can view documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = documents.case_id
      AND (cases.attorney_id = auth.uid() OR cases.client_id = auth.uid())
    )
  );

-- Documents: Case participants can upload documents
CREATE POLICY "Case participants can upload documents"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = case_id
      AND (cases.attorney_id = auth.uid() OR cases.client_id = auth.uid())
    )
  );

-- Forms: Case participants can view forms
CREATE POLICY "Case participants can view forms"
  ON forms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = forms.case_id
      AND (cases.attorney_id = auth.uid() OR cases.client_id = auth.uid())
    )
  );

-- Forms: Attorneys can manage forms
CREATE POLICY "Attorneys can manage forms"
  ON forms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = forms.case_id
      AND cases.attorney_id = auth.uid()
    )
  );

-- Activities: Case participants can view activities
CREATE POLICY "Case participants can view activities"
  ON activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = activities.case_id
      AND (cases.attorney_id = auth.uid() OR cases.client_id = auth.uid())
    )
  );

-- Notifications: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Notifications: Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default document checklists for common visa types
INSERT INTO document_checklists (visa_type, document_type, required, description) VALUES
  ('N-400', 'passport', TRUE, 'Current valid passport'),
  ('N-400', 'photo', TRUE, 'Two identical passport-style photos'),
  ('N-400', 'birth_certificate', TRUE, 'Birth certificate with translation if not in English'),
  ('N-400', 'marriage_certificate', FALSE, 'If applicable'),
  ('N-400', 'tax_return', TRUE, 'Last 5 years of tax returns'),
  ('I-485', 'passport', TRUE, 'Current valid passport'),
  ('I-485', 'birth_certificate', TRUE, 'Birth certificate'),
  ('I-485', 'photo', TRUE, 'Two identical passport-style photos'),
  ('I-485', 'medical_exam', TRUE, 'Form I-693 completed by civil surgeon'),
  ('I-485', 'i94', TRUE, 'Most recent I-94'),
  ('I-485', 'employment_letter', FALSE, 'If employment-based'),
  ('H1B', 'passport', TRUE, 'Valid passport with at least 6 months validity'),
  ('H1B', 'diploma', TRUE, 'Bachelor''s degree or higher'),
  ('H1B', 'transcript', TRUE, 'Official transcripts'),
  ('H1B', 'employment_letter', TRUE, 'Job offer letter with details'),
  ('H1B', 'pay_stub', FALSE, 'If currently employed');
