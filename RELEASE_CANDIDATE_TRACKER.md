# KoraForms Release Candidate Tracker

This document tracks the remaining work before KoraForms should be treated as ready for public use. The product north star remains: forms work anywhere, including field-worker and respondent workflows without a reliable network connection.

## P0 - Release Blockers

### 1. Authenticated E2E Coverage

Status: Completed for release-candidate critical coverage

Scope:
- Cover creator signup/signin, form creation, builder editing, publishing, settings, sharing, templates, responses, analytics, backup, and restore.
- Verify that creator flows survive refreshes, reconnects, and tab changes without losing local work.
- Keep public respondent offline tests as the baseline that must stay green.

Acceptance:
- Playwright coverage exists for the critical authenticated creator journeys.
- The current authenticated smoke covers signup, template creation, publish feedback, URL/share/settings/responses/analytics/field-insights/to-do tabs, webhook control discoverability, backup, restore, and tab persistence across refresh.
- `pnpm run check` and the relevant E2E suites pass locally before deployment.

Verification:
- 2026-07-29: `pnpm run check` passed.
- 2026-07-29: `pnpm run test:e2e` passed with 13/13 browser tests.

### 2. Public Respondent Offline UX

Status: Completed for normal respondent diagnostics; broader UX polish remains under accessibility and public-page review

Scope:
- Keep offline diagnostics available for support, but do not show diagnostic cards to normal respondents.
- Normal respondents should see a quiet, confidence-building offline signal only when useful.
- `?diagnostics=1` or `?debug=offline` should expose detailed local readiness and copyable diagnostics.

Acceptance:
- Public form landing stays clean and focused on starting the form.
- Detailed diagnostics are hidden unless explicitly requested through `?diagnostics=1` or `?debug=offline`.
- Public offline E2E remains green.

### 3. Readiness Scoring

Status: Completed for core scoring; optional integration delivery logs remain tracked separately

Scope:
- Separate core response-collection readiness from optional integrations.
- Webhooks and email notifications must not lower readiness when they are not configured.
- Misconfigured active integrations should be visible as add-on warnings, not misleading core readiness failures.

Acceptance:
- A complete form without webhooks/email can show 100% core readiness.
- Optional integration issues are still visible and actionable in settings.

### 4. Email Notifications

Status: Implemented but disabled

Scope:
- Keep notification settings off until Resend is configured.
- Add sender/domain verification instructions and environment validation.
- Show delivery state once the integration is enabled.

Acceptance:
- No user can accidentally rely on email delivery before Resend is configured.
- When enabled, test emails and accepted-response notifications have observable delivery records.

### 5. Webhook Delivery UX

Status: Completed

Scope:
- Keep webhook delivery async and non-blocking for respondent submissions.
- Add owner-visible delivery logs: last attempt, response code, retry count, next retry, and sanitized failure reason.
- Preserve SSRF protections and HTTPS-only public URL gating.

Acceptance:
- Owners can test webhooks and understand recent delivery outcomes without reading server logs.
- Webhook failures never block response acceptance.

Verification:
- 2026-07-29: Webhook test events are processed through the same persisted delivery pipeline as response webhooks and appear in owner-visible delivery history as test events.
- 2026-07-29: Authenticated Playwright coverage verifies webhook test controls are discoverable from form settings.

### 6. Production Observability

Status: Completed for release-candidate protected diagnostics

Scope:
- Add protected diagnostics for rejected submissions, pending side effects, webhook/email failures, and sync health.
- Keep diagnostics support-safe: no raw answers, passwords, tokens, or webhook secrets.

Acceptance:
- Support can diagnose offline queue and side-effect issues without accessing respondent payloads.

Verification:
- 2026-07-29: Protected ops diagnostics aggregates forms, accepted responses, resume links, side-effect delivery health, and analytics event health without raw payloads or visitor/session identifiers.
- 2026-07-29: Added `OPERATIONS_RUNBOOK.md` with deployment checks, diagnostics interpretation, incident response steps, Azure commands, and support-safety boundaries.

## P1 - Product Polish

### 7. Template Library Final Pass

Status: Partially implemented

Scope:
- Verify private pagination, preview modal positioning, start-from-template, and public/private template navigation.
- Ensure cards, filters, and empty states match the current Apple-like product direction.

Acceptance:
- Private template preview stays centered within the app shell.
- Preview/back flows return to the correct public or authenticated template surface.

### 8. Backup And Restore E2E

Status: Completed

Scope:
- Verify workspace backup and restore from the UI.
- Restored forms must become safe draft copies and never overwrite existing published forms.

Acceptance:
- Backup/restore works in authenticated E2E and preserves expected form/response data.

Verification:
- 2026-07-29: Authenticated Playwright coverage downloads a workspace backup and restores it through the UI as a draft copy.

### 9. Accessibility Pass

Status: In progress - primary overlays now share accessible dialog behavior

Scope:
- Audit keyboard navigation, focus states, modal traps, builder sidebars, response tables, public fill flow, and public pages.

Acceptance:
- Core workflows are keyboard accessible and screen-reader labels are accurate.

Verification:
- 2026-07-29: Share, export, response detail, and template preview overlays now expose modal dialog semantics, restore focus on close, trap keyboard focus, and close with Escape.

## P2 - Competitive Enhancements

### 10. Form Version History And Rollback

Status: Not started

Scope:
- Let creators inspect published revisions and restore a prior draft.

### 11. Owner Notifications Inbox

Status: Not started

Scope:
- Product-level inbox for response alerts, failed side effects, and important sync events.

### 12. Response Import/Export Presets

Status: Not started

Scope:
- Saved export filters and recurring export formats.

### 13. Team And Workspace Roles

Status: Not started

Scope:
- Owner/admin/editor/viewer roles for collaborative form management.

### 14. Public Results Customization

Status: Not started

Scope:
- Creator-controlled public result displays with privacy guardrails.

### 15. Advanced Duplicate Detection

Status: Not started

Scope:
- Better duplicate signals across name, email, phone, IP/device/session metadata, and repeated answers.

### 16. Saved Analytics Filters

Status: Not started

Scope:
- Save date ranges, field filters, and response segments for repeat analysis.

## Current Verification Commands

Run before release-candidate deployment:

```bash
pnpm run check
pnpm exec playwright test tests/e2e/public-offline.spec.ts
pnpm run test:e2e
```
