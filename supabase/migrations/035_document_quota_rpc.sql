-- Optimized document quota check: returns the maximum document count
-- across all cases for a given attorney.
-- Replaces N+1 in-memory counting with single SQL aggregation.
CREATE OR REPLACE FUNCTION get_max_documents_per_case(p_attorney_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(MAX(doc_count), 0)::integer
  FROM (
    SELECT COUNT(d.id) as doc_count
    FROM cases c
    LEFT JOIN documents d ON d.case_id = c.id AND d.deleted_at IS NULL
    WHERE c.attorney_id = p_attorney_id
      AND c.deleted_at IS NULL
    GROUP BY c.id
  ) sub;
$$;
