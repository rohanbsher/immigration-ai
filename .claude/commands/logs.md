---
description: Analyze logs to fix issues (Boris tip #5)
---

Point me at logs to diagnose and fix issues.

$ARGUMENTS

Steps:
1. Check specified log source (docker logs, server output, browser console, etc.)
2. Identify errors, warnings, or unusual patterns
3. Trace the root cause in the codebase
4. Propose and implement a fix
5. Verify the fix resolves the issue

Log sources to check:
- Dev server: `npm run dev` output
- Build errors: `npm run build 2>&1`
- Test failures: `npm run test:run`
- Docker: `docker logs <container>`
- Vercel: Check deployment logs in dashboard

Don't just report what you see - fix it.
