-- Migration 019: Tasks
-- Case-linked task management with assignments and priorities

-- Create task status enum
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create task priority enum
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'pending',
  priority task_priority DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- A task must belong to either a case or a firm (or neither for personal tasks)
  CONSTRAINT tasks_ownership CHECK (
    NOT (case_id IS NOT NULL AND firm_id IS NOT NULL)
  )
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_firm_id ON tasks(firm_id) WHERE firm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_pending ON tasks(status, due_date)
  WHERE status IN ('pending', 'in_progress') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks

-- Users can view tasks they created
CREATE POLICY "Users can view tasks they created"
  ON tasks FOR SELECT
  USING (
    deleted_at IS NULL AND
    created_by = auth.uid()
  );

-- Users can view tasks assigned to them
CREATE POLICY "Users can view tasks assigned to them"
  ON tasks FOR SELECT
  USING (
    deleted_at IS NULL AND
    assigned_to = auth.uid()
  );

-- Users can view tasks for cases they have access to
CREATE POLICY "Users can view tasks for their cases"
  ON tasks FOR SELECT
  USING (
    deleted_at IS NULL AND
    case_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = tasks.case_id
      AND c.deleted_at IS NULL
      AND (c.attorney_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- Firm members can view firm tasks
CREATE POLICY "Firm members can view firm tasks"
  ON tasks FOR SELECT
  USING (
    deleted_at IS NULL AND
    firm_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM firm_members fm
      WHERE fm.firm_id = tasks.firm_id
      AND fm.user_id = auth.uid()
    )
  );

-- Admins can view all tasks
CREATE POLICY "Admins can view all tasks"
  ON tasks FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Attorneys and admins can create tasks
CREATE POLICY "Attorneys and admins can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('attorney', 'admin')
    )
  );

-- Users can update tasks they created or are assigned to
CREATE POLICY "Users can update their tasks"
  ON tasks FOR UPDATE
  USING (
    created_by = auth.uid() OR assigned_to = auth.uid()
  );

-- Users can delete tasks they created
CREATE POLICY "Users can delete tasks they created"
  ON tasks FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for task_comments

-- Users can view comments on tasks they can see
CREATE POLICY "Users can view task comments"
  ON task_comments FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
      AND t.deleted_at IS NULL
      AND (
        t.created_by = auth.uid() OR
        t.assigned_to = auth.uid() OR
        (t.case_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM cases c
          WHERE c.id = t.case_id
          AND (c.attorney_id = auth.uid() OR c.client_id = auth.uid())
        ))
      )
    )
  );

-- Users can add comments to tasks they can see
CREATE POLICY "Users can add task comments"
  ON task_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
      AND t.deleted_at IS NULL
      AND (
        t.created_by = auth.uid() OR
        t.assigned_to = auth.uid() OR
        (t.case_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM cases c
          WHERE c.id = t.case_id
          AND (c.attorney_id = auth.uid() OR c.client_id = auth.uid())
        ))
      )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update their comments"
  ON task_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete their comments"
  ON task_comments FOR DELETE
  USING (user_id = auth.uid());

-- Create function to update updated_at on changes
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

CREATE TRIGGER trigger_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Add comments for documentation
COMMENT ON TABLE tasks IS 'Case-linked or general tasks with assignment and priority';
COMMENT ON TABLE task_comments IS 'Comments on tasks for collaboration';
