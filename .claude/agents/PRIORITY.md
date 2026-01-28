# What Matters Most Right Now

## Context
Based on comprehensive strategy + codebase audit (2026-01-27):
- Product is 70% complete (4 forms working, AI solid)
- Legal protection layer has critical gaps
- Billing not wired up
- Market opportunity is real ($1.5B, 20K attorneys)

---

## HUMAN-ONLY Tasks (AI Cannot Do These)

### Week 1: Legal Foundation

1. **Lawyer Review of Terms of Service**
   - Current ToS missing critical sections
   - Need real lawyer to draft: professional judgment clause,
     AI liability waiver, immigration consequences disclaimer
   - Budget: ~$500-1000 for legal review

2. **Set Up Production Infrastructure**
   - Upstash Redis account (rate limiting)
   - Sentry account (error tracking)
   - ClamAV or VirusTotal for virus scanning
   - These require account creation + billing

3. **Stripe Account Setup**
   - Create Stripe account
   - Configure webhook endpoints
   - Set up pricing tiers ($79/$119/$179)

### Week 2: Go-to-Market Prep

4. **AILA Membership**
   - Join American Immigration Lawyers Association
   - Essential for credibility + leads

5. **Domain/Email Setup**
   - Professional email (not gmail)
   - DNS for transactional emails (Resend)

6. **First 5 Beta Attorneys**
   - Personal outreach to immigration attorneys you know
   - AI can draft messages, but you send them

---

## AI CAN Handle (Current TODO.md)

Phase 1 & 2: COMPLETE
Phase 3: In progress (accessibility, i18n, test coverage)

See TODO.md for full technical backlog.

---

## Decision Points Requiring Human Input

| Decision | Options | Deadline |
|----------|---------|----------|
| Virus scanner | ClamAV (self-host) vs VirusTotal (API) | Before launch |
| Pricing finalization | $79/119/179 or adjust? | Before Stripe setup |
| Beta strategy | Invite-only vs public waitlist | Week 2 |
| First marketing channel | AILA vs content vs paid | Week 3 |

---

## The One Metric

**Attorney Certification Rate** - What % of AI-filled forms get
attorney-certified within 48 hours?

Target: >80%

This single metric captures:
- AI quality (bad fills = attorney rejects)
- UX quality (confusing UI = attorney abandons)
- Trust (attorneys won't certify if they don't trust)

---

## Quick Reference: Who Does What

| Task Type | Owner |
|-----------|-------|
| Code changes | AI agents |
| Test coverage | AI agents |
| Legal documents | Human + lawyer |
| Account creation | Human |
| Payments/billing | Human |
| Strategic decisions | Human |
| Outreach/sales | Human |

---

*Last Updated: 2026-01-27*
*Next Review: After legal shield complete*
