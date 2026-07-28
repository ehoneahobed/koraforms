# KoraForms Feature Implementation Plan

## Objective

Make KoraForms materially better than traditional online form builders by combining a fully offline-first respondent workflow with owner-facing analytics that explain what happened, where people struggled, and what to improve next.

This plan assumes KoraForms is not yet public, so implementation should optimize for the right long-term architecture over backward compatibility. The app should keep using Kora as the durable local data plane wherever the data belongs to first-party product workflows.

## Product Principles

- Core form workflows must work anywhere after the form is available on the device.
- Analytics must be useful without third-party tracking, fingerprinting, paid infrastructure, or invasive respondent profiling.
- Owner-facing insights should explain behavior, not merely display charts.
- Every metric should be derivable from immutable responses, Kora-backed respondent events, form versions, or explicit audit records.
- Online-only side effects must be clearly separated from offline-safe first-party actions.
- UI should stay calm, readable, and Apple-like: sparse hierarchy, restrained color, clear affordances, no dense dashboard clutter.

## Execution Order

### 1. Drop-Off Journey Analytics

Goal: Show owners where respondents start, stop, abandon, and complete.

Data:
- Use `form_analytics_events` for `viewed_form`, `started_form`, `answered_question`, `saved_progress`, and `submitted_form`.
- Group by `sessionId`; count unique viewers through the privacy-preserving `visitorKey`.
- Do not infer identity across forms or devices.

Implementation:
- Build a field-level journey model from analytics events and accepted responses.
- Track per-field reach, answer, skip, and abandon counts.
- Identify the most common drop-off position and likely friction fields.
- Keep abandoned-session detection time-based and configurable in the domain helper.
- Treat accepted responses as completion truth when analytics events are missing.

UI:
- Add a journey panel to analytics with a compact step list or horizontal field funnel.
- Show field labels, field types, reached count, answered count, abandon count, and completion impact.
- Highlight the first major friction point without making the whole screen red.

Tests:
- Unit tests for view/start/answer/submit sessions, stale abandoned sessions, and responses without analytics events.
- Ensure section breaks and display-only fields are excluded from answer/drop-off calculations.

### 2. Response Quality Signals

Goal: Help owners review submissions that may need attention.

Signals:
- Duplicate identity values across email, phone, or name-like fields.
- Duplicate full response payloads.
- Suspiciously fast completions relative to form length.
- Very slow completions relative to median.
- Low completion responses.
- Required fields missing in accepted historical responses.
- Repeated identical values across many fields.
- Attachment-bearing submissions that should be reviewed.

Implementation:
- Extend the response review domain helpers with a normalized `ResponseQualitySignal[]`.
- Each signal should include severity, reason, affected response id, affected fields, and a short owner-facing action.
- Avoid storing signal output; derive it from responses so it stays deterministic.

UI:
- Add a quality summary to the To do/review tab.
- Add subtle badges in response rows for "Duplicate", "Fast", "Incomplete", or "Review".
- Keep the row table readable; detailed explanations belong in the slide-out or review tab.

Tests:
- Unit tests for each signal.
- Ensure display-only fields and metadata are not treated as answers.

### 3. Offline Respondent Session Recovery Dashboard

Goal: Make offline behavior visible and trustworthy.

Data:
- Use Kora-backed `response_submissions`, `public_form_progress`, `form_analytics_events`, rejected operation APIs, and sync status.
- Do not create a second persistence model.

Implementation:
- Add a workspace-level health helper that summarizes locally submitted, syncing, accepted, rejected, failed, and recoverable submissions.
- Add per-form counts for pending offline submissions and failed syncs.
- Expose retry and clear-resolved actions only where they are safe.

UI:
- Dashboard health strip: "Saved locally", "Pending sync", "Needs review".
- Per-form response screen notice when local data exists that has not reached the server.

Tests:
- Unit tests for state aggregation.
- E2E for offline submit, reconnect, rejection, and owner visibility after sync.

### 4. Form Version Analytics

Goal: Show whether a published form change helped or hurt conversion.

Data:
- Use immutable public form versions and `formVersionHash` stored on analytics events and submissions.
- Accepted responses should retain the version they were completed against.

Implementation:
- Add summary helpers grouped by `formVersionHash`.
- Compare conversion, completion rate, fill rate, drop-off field, and average duration by version.
- Make unknown legacy versions explicit.

UI:
- Add "Versions" section in analytics.
- Show current version vs previous version with clear trend deltas.

Tests:
- Unit tests for mixed-version responses and events.

### 5. Public Form Readiness Inspector

Goal: Tell owners whether a form is ready to work anywhere before they publish/share it.

Checks:
- Offline form version exists after publish.
- All fields are supported offline.
- Conditional logic, answer piping, calculations, and validation are locally executable.
- File/signature fields have local blob support and size limits.
- Integrations that need internet are flagged as deferred side effects.
- Password, schedule, and max-response policies are understandable under offline submit and later sync.

Implementation:
- Build a pure `buildPublicReadinessReport(form, fields, settings)` helper.
- Reuse it in builder settings/share/publish flows.

UI:
- Add a readiness card near publish/share: "Ready offline", "Needs attention", "Online-only add-ons".

Tests:
- Unit tests for each readiness condition.

### 6. Smart Field Suggestions

Goal: Give owners practical, no-cost recommendations.

Suggestions:
- Make low-fill non-critical fields optional.
- Split long forms with high mid-form drop-off into sections.
- Move high-friction required fields later or clarify them.
- Convert repeated free-text answers into choices.
- Remove fields with consistently empty responses.

Implementation:
- Derive from field analysis, journey analytics, and response quality helpers.
- Keep suggestions deterministic; no paid AI dependency.

UI:
- Add a small "Suggestions" section in field insights and To do.

Tests:
- Unit tests for suggestion thresholds and deduping.

### 7. Export and Filtering Upgrades

Goal: Make response management useful for teams with many submissions.

Features:
- Saved filter views.
- Field filters by value, missing/present, completion status, quality signal, and date range.
- Export current filtered set.
- Named report presets.

Implementation:
- Keep filters encoded in URL first.
- Add persisted saved views only after URL filters are stable.

UI:
- Compact filter builder with chips.
- Saved views in a light dropdown, not a dense sidebar.

Tests:
- Unit tests for filter semantics.
- E2E for URL persistence and export scoping.

### 8. Audit Trail

Goal: Make KoraForms credible for teams and larger organizations.

Events:
- Form created, duplicated, archived, restored, deleted.
- Field added, removed, reordered, or changed.
- Publish, close, reopen.
- Settings changed.
- Template started.
- Response deleted/exported.

Implementation:
- Add an `audit_events` Kora collection with actor id, form id, event type, payload, and timestamp.
- Write audit events through domain actions rather than scattered UI handlers.

UI:
- Add an activity timeline under form settings.
- Keep the main builder clean.

Tests:
- Unit tests for audit event creation in domain actions.

## Release Gates

Each feature slice should pass:

- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- Relevant Playwright coverage when the feature affects public/offline flows.

Before public release, run:

- `pnpm run check`
- `pnpm run test:e2e`
- `pnpm exec kora doctor`

## Implementation Progress

Completed:

- Drop-off journey analytics: lifecycle metrics, field journey, respondent drop-off, and analytics UI.
- Response quality signals: deterministic review signals in To do and response review helpers.
- Offline respondent session recovery dashboard: public Kora runtime diagnostics, workspace recovery state, per-form offline badges.
- Form version analytics: response schema versioning, public submit version attribution, offline flush version preservation, and version comparison UI.
- Public form readiness inspector: settings-tab readiness score with blocked/warning/ready checks.
- Smart field suggestions: deterministic field improvement suggestions in Field Insights.
- Export and filtering upgrades: URL-stable date/completion/field filters, strict filter decoding, active filter chips, and filtered export scope confirmation.
- Audit trail: synced `audit_events` collection, sanitized audit metadata, visible recent activity, and logging for form lifecycle, settings/access, template, response export, and deletion actions.

Remaining:

- None in this implementation plan. Pre-release validation should now focus on E2E offline scenarios, production environment configuration, and deployment smoke tests.
