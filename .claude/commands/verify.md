---
description: Verify recent changes work correctly (Boris's verification loop)
---

Run the verification loop for recent changes:

1. **Build check**: Run `npm run build` and check for errors
2. **Lint check**: Run `npm run lint` and check for issues
3. **Review changes**: Use `git diff` to see what changed
4. **Report findings**: Summarize what was verified and any issues found

This is the critical verification loop - use after every significant change.

$ARGUMENTS
