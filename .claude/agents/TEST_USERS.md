# Test Users

> Reference for test credentials used in development and E2E testing.
> Last updated: 2026-01-28

## Test Attorney

| Field | Value |
|-------|-------|
| **Email** | `test-attorney@immigration-ai.dev` |
| **Password** | `TestAttorney123!` |
| **User ID** | `5b6b1a50-fe1e-4577-b291-782f3d6f05dd` |
| **Role** | `attorney` |
| **Bar Number** | `TEST-12345` |
| **First Name** | `Test` |
| **Last Name** | `Attorney` |
| **Created Via** | Direct SQL (GoTrue admin API has a bug) |

### How This User Was Created

The Supabase Auth admin API (`auth.admin.createUser()`) fails with "Database error creating new user" due to a GoTrue bug. The user was created via direct SQL INSERT into `auth.users` and `auth.identities` tables using the Supabase Management API SQL endpoint.

**Critical:** After direct SQL INSERT, token columns (`confirmation_token`, `recovery_token`, etc.) default to NULL, which causes GoTrue to crash with "converting NULL to string is unsupported" ([GitHub issue #1940](https://github.com/supabase/auth/issues/1940)). These must be set to empty strings:

```sql
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE id = '<user-id>';
```

### Verification Status

| Page | localhost | Production |
|------|-----------|------------|
| Login | Working | Working |
| Dashboard | Working (stats cards, sidebar) | Working |
| Billing (`/dashboard/billing`) | Working (plan cards, usage meters) | 404 (not deployed) |
| Firm (`/dashboard/firm`) | Working (Create Your Firm UI) | 404 (not deployed) |

> Production 404s are because 141+ files haven't been committed/pushed to trigger Vercel deployment.
