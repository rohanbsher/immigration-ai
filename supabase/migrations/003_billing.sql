-- Migration: 003_billing.sql
-- Description: Subscription-based billing with Stripe integration
-- Created: 2024

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'paused',
  'incomplete',
  'incomplete_expired'
);

CREATE TYPE plan_type AS ENUM (
  'free',
  'pro',
  'enterprise'
);

CREATE TYPE billing_period AS ENUM (
  'monthly',
  'yearly'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'disputed'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Customers table: Links Supabase users to Stripe customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table: Tracks active subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan_type plan_type NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'trialing',
  billing_period billing_period,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan limits: Defines limits for each plan
CREATE TABLE plan_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_type plan_type NOT NULL UNIQUE,
  max_cases INTEGER NOT NULL,
  max_documents_per_case INTEGER NOT NULL,
  max_ai_requests_per_month INTEGER NOT NULL,
  max_storage_gb DECIMAL(10, 2) NOT NULL,
  max_team_members INTEGER NOT NULL DEFAULT 1,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage records: Tracks resource usage for billing
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, metric_name, period_start)
);

-- Payments table: Records payment history
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method_type TEXT,
  receipt_url TEXT,
  failure_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table: Stores invoice data
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE,
  stripe_invoice_url TEXT,
  stripe_invoice_pdf TEXT,
  amount_due_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_stripe_customer_id ON customers(stripe_customer_id);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_usage_records_subscription_id ON usage_records(subscription_id);
CREATE INDEX idx_usage_records_period ON usage_records(period_start, period_end);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Customers: Users can see their own customer record, admins see all
CREATE POLICY "Users can view own customer record"
  ON customers FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can manage customers"
  ON customers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Subscriptions: Users can see subscriptions for their customer record
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = subscriptions.customer_id
      AND customers.user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Plan limits: Everyone can read (public pricing info)
CREATE POLICY "Anyone can view plan limits"
  ON plan_limits FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage plan limits"
  ON plan_limits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Usage records: Users can see their own usage
CREATE POLICY "Users can view own usage records"
  ON usage_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions s
      JOIN customers c ON c.id = s.customer_id
      WHERE s.id = usage_records.subscription_id
      AND c.user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can manage usage records"
  ON usage_records FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Payments: Users can see their own payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = payments.customer_id
      AND customers.user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can manage payments"
  ON payments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Invoices: Users can see their own invoices
CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = invoices.customer_id
      AND customers.user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can manage invoices"
  ON invoices FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_plan_limits_updated_at
  BEFORE UPDATE ON plan_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_usage_records_updated_at
  BEFORE UPDATE ON usage_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SEED DATA: Default plan limits
-- ============================================================================

INSERT INTO plan_limits (plan_type, max_cases, max_documents_per_case, max_ai_requests_per_month, max_storage_gb, max_team_members, features) VALUES
  ('free', 3, 10, 25, 1.0, 1, '{"document_analysis": true, "form_autofill": false, "priority_support": false, "api_access": false}'),
  ('pro', 50, 50, 500, 25.0, 5, '{"document_analysis": true, "form_autofill": true, "priority_support": true, "api_access": false}'),
  ('enterprise', -1, -1, -1, 500.0, -1, '{"document_analysis": true, "form_autofill": true, "priority_support": true, "api_access": true}')
ON CONFLICT (plan_type) DO UPDATE SET
  max_cases = EXCLUDED.max_cases,
  max_documents_per_case = EXCLUDED.max_documents_per_case,
  max_ai_requests_per_month = EXCLUDED.max_ai_requests_per_month,
  max_storage_gb = EXCLUDED.max_storage_gb,
  max_team_members = EXCLUDED.max_team_members,
  features = EXCLUDED.features;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get current usage for a subscription
CREATE OR REPLACE FUNCTION get_current_usage(p_subscription_id UUID)
RETURNS TABLE (
  metric_name TEXT,
  quantity INTEGER,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT ur.metric_name, ur.quantity, ur.period_start, ur.period_end
  FROM usage_records ur
  WHERE ur.subscription_id = p_subscription_id
    AND ur.period_start <= NOW()
    AND ur.period_end >= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(
  p_subscription_id UUID,
  p_metric_name TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS usage_records AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_result usage_records%ROWTYPE;
BEGIN
  -- Get subscription details
  SELECT * INTO v_subscription FROM subscriptions WHERE id = p_subscription_id;

  IF v_subscription IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Upsert usage record
  INSERT INTO usage_records (
    subscription_id,
    metric_name,
    quantity,
    period_start,
    period_end
  ) VALUES (
    p_subscription_id,
    p_metric_name,
    p_quantity,
    v_subscription.current_period_start,
    v_subscription.current_period_end
  )
  ON CONFLICT (subscription_id, metric_name, period_start)
  DO UPDATE SET
    quantity = usage_records.quantity + p_quantity,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has quota available
CREATE OR REPLACE FUNCTION check_quota(
  p_user_id UUID,
  p_metric_name TEXT,
  p_required_quantity INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan_type plan_type;
  v_limit INTEGER;
  v_current_usage INTEGER;
BEGIN
  -- Get user's plan type
  SELECT s.plan_type INTO v_plan_type
  FROM subscriptions s
  JOIN customers c ON c.id = s.customer_id
  WHERE c.user_id = p_user_id
    AND s.status IN ('trialing', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Default to free if no subscription
  IF v_plan_type IS NULL THEN
    v_plan_type := 'free';
  END IF;

  -- Get the limit for this metric
  SELECT
    CASE p_metric_name
      WHEN 'cases' THEN max_cases
      WHEN 'documents' THEN max_documents_per_case
      WHEN 'ai_requests' THEN max_ai_requests_per_month
      ELSE 0
    END INTO v_limit
  FROM plan_limits
  WHERE plan_limits.plan_type = v_plan_type;

  -- Unlimited if -1
  IF v_limit = -1 THEN
    RETURN TRUE;
  END IF;

  -- Get current usage
  SELECT COALESCE(SUM(quantity), 0) INTO v_current_usage
  FROM usage_records ur
  JOIN subscriptions s ON s.id = ur.subscription_id
  JOIN customers c ON c.id = s.customer_id
  WHERE c.user_id = p_user_id
    AND ur.metric_name = p_metric_name
    AND ur.period_start <= NOW()
    AND ur.period_end >= NOW();

  RETURN (v_current_usage + p_required_quantity) <= v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create or get customer for user
CREATE OR REPLACE FUNCTION get_or_create_customer(p_user_id UUID)
RETURNS customers AS $$
DECLARE
  v_customer customers%ROWTYPE;
  v_profile profiles%ROWTYPE;
BEGIN
  -- Check if customer exists
  SELECT * INTO v_customer FROM customers WHERE user_id = p_user_id;

  IF v_customer IS NOT NULL THEN
    RETURN v_customer;
  END IF;

  -- Get profile for email/name
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Create customer
  INSERT INTO customers (user_id, email, name)
  VALUES (p_user_id, v_profile.email, v_profile.first_name || ' ' || v_profile.last_name)
  RETURNING * INTO v_customer;

  RETURN v_customer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
