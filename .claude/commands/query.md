---
description: Query Supabase for analytics (Boris tip #9)
---

Use the Supabase CLI to query the database and analyze data.

$ARGUMENTS

Steps:
1. Parse what data the user wants
2. Write the appropriate SQL query
3. Run it using: `npx supabase db query "YOUR_SQL_HERE"`
4. Interpret the results
5. Provide insights or visualizations if useful

Common queries:
- User counts: `SELECT COUNT(*) FROM profiles WHERE role = 'attorney'`
- Case stats: `SELECT status, COUNT(*) FROM cases GROUP BY status`
- Recent activity: `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 20`

If you need to analyze trends, export to CSV and process with code.
