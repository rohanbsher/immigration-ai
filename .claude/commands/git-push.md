---
description: Verify, review, and push changes to GitHub with proper PR description
---

Complete git push workflow with verification and review:

## Phase 1: Verification (use subagents)

1. **TypeScript check**: Run `npx tsc --noEmit` to verify compilation
2. **Lint check**: Run `npm run lint` on modified files only
3. **Test discovery**: Run `npx playwright test --list` (for E2E) or `npm test` (for unit tests) to ensure tests are still discoverable
4. **Show diff**: Run `git diff HEAD` to see all changes

## Phase 2: Staff Engineer Review

Use the /grill skill to review the changes as a senior staff engineer would:
- Architectural fit
- Edge cases
- Security implications
- Performance concerns
- Testing adequacy

If issues are found, fix them before proceeding.

## Phase 3: Git Operations

1. **Stage changes**: Add relevant files (prefer specific files over `git add -A`)
2. **Create commit**: Use conventional commit format with descriptive message
3. **Push to remote**: Push to current branch with `-u` flag if needed
4. **Create PR** (if requested): Use `gh pr create` with proper title and description

## PR Description Format

```markdown
## Summary
[1-3 bullet points describing what changed]

## Changes
[List of specific changes made]

## Verification
- [ ] TypeScript compiles
- [ ] ESLint passes
- [ ] Tests discoverable/passing
- [ ] /grill review passed

## Test Plan
[How to verify these changes work]

---
Generated with [Claude Code](https://claude.com/claude-code)
```

$ARGUMENTS
