# No-Cost Production Release Plan

KoraForms' north star is simple: forms should work anywhere once a respondent or field worker has prepared the form on the device. The items below avoid paid vendors and focus on implementation quality, offline confidence, test coverage, and release trust.

## Release Principles

- Use Kora as the data plane for durable local state, schema invariants, operation replay, and sync.
- Treat offline as a first-class state, not an error state.
- Give respondents truthful status: ready offline, saved locally, waiting to sync, accepted, or needs review.
- Keep public respondent runtime isolated from authenticated workspace sync.
- Prefer deterministic local behavior and automated tests over manual release confidence.

## Phase 1 - Offline Confidence

### 1. Offline Readiness Check

Status: implemented in the first production-hardening slice.

Goal: every public form should clearly say whether it is ready for offline use on the current device.

Checklist:

- The published form version is cached in Kora's local database.
- The app shell/service worker is available where the browser supports it.
- Local attachment/signature storage is available.
- Pending and rejected submission counts are visible.
- The respondent can tell when a form was loaded from the device versus the network.

Acceptance criteria:

- Public form welcome screen shows a compact readiness panel.
- The panel never overstates readiness. Unknown or unavailable capabilities are shown honestly.
- Offline readiness is covered by unit tests and public E2E.

### 2. Field-Worker Preload Flow

Status: implemented as a first-pass public form "Prepare" action.

Goal: make offline preparation explicit before field teams leave connectivity.

Checklist:

- Add a "Prepare for offline use" control on public form pages.
- Re-run the readiness checks and persist the newest public form version.
- Show a pass/fail result with the specific missing capability.
- Do not require login.

Acceptance criteria:

- A field worker can open a form once, click prepare, go offline, reload, fill, and submit locally.

### 3. Pending Submission Visibility

Status: implemented for public respondents and first-pass owner workspace diagnostics.

Goal: queued local submissions should be visible and understandable.

Checklist:

- Show counts for waiting, syncing, accepted, rejected, and failed local submissions. Implemented through public offline diagnostics and readiness state.
- Surface recent rejected/failed submission reasons without exposing sensitive answer data. Implemented in diagnostics payload.
- Keep diagnostics copyable for support/debugging. Implemented from the public form readiness panel and submitted screen.
- Surface owner-facing local workspace health without exposing protected operator tokens. Implemented on the dashboard.

Acceptance criteria:

- Respondents are never left wondering whether a submit click worked.

## Phase 2 - Data-Plane Invariants

### 4. Schema Lifecycle Hardening

Status: partially implemented.

Goal: move status rules into Kora schema whenever they are product invariants.

Checklist:

- Public submission lifecycle transitions. Implemented.
- Side-effect delivery status transitions. Implemented in schema; background worker still needs framework-level production `apply()` support to use the full route data plane.
- Published form version status transitions. Implemented.
- Resume link status transitions. Implemented.

Acceptance criteria:

- Invalid status jumps fail in the data plane.
- Tests prove accepted transitions still work.

### 5. Atomic Counters and Derived Analytics

Status: implemented for accepted response counters; framework-level conditional admission is still needed for perfect hard quotas in multi-instance deployments.

Goal: avoid read-modify-write races.

Checklist:

- Accepted response counts use Kora atomic operations. Implemented with `op.increment(1)`.
- Max-response admission reads the Kora counter as the source of truth before accepting a response. Implemented.
- Hard max-response quotas should become a single conditional accept-and-increment operation when Kora exposes a transaction or compare-and-swap style API.
- Analytics are derived from accepted responses and immutable form versions.
- Client-maintained totals are treated as hints, not truth.

Acceptance criteria:

- Concurrent submissions cannot lose counter updates.
- Production deployments do not rely on process-local locks for quota correctness.

## Phase 3 - Offline Test Matrix

### 6. Browser Restart and Multi-Tab Coverage

Status: implemented.

Goal: prove local durability outside the happy path.

Checklist:

- Offline reload after preload. Implemented.
- Browser/tab close before reconnect. Implemented.
- Browser/context restart before reconnect. Implemented with persistent-profile E2E.
- Multi-tab with pending submission created in one tab and visible in another. Implemented with bounded Kora reads plus metadata-only same-device recovery hints for active-tab local database contention.
- Reconnect during queued file/signature sync.

Acceptance criteria:

- Playwright covers these flows without manual steps.

### 7. Full Field-Type Offline Coverage

Goal: every first-party field type behaves offline.

Checklist:

- Text, email, phone, URL, number, date/time.
- Dropdown, multiple choice, checkboxes, yes/no.
- Rating, linear scale, matrix/grid, ranking.
- Statement, section break, hidden/calculated.
- File upload and signature.
- Conditional logic and answer piping.

Acceptance criteria:

- Offline E2E verifies completion and sync for representative complex forms.

## Phase 4 - Release Trust

### 8. Accessibility Pass

Status: implemented for the critical public respondent flow.

Goal: form filling must be usable without a mouse and understandable to assistive tech.

Checklist:

- Keyboard-only navigation. Implemented and covered by public form E2E.
- Visible focus states.
- Field errors announced near the active question. Implemented for public question validation.
- Buttons and icon-only actions have accessible names.
- Reduced-motion support remains respected.

Acceptance criteria:

- Critical public form flow can be completed with keyboard only.

### 9. Local Backup and Export

Status: implemented for creator workspace backup and per-form/per-response exports.

Goal: creators and field teams can preserve work without paid infrastructure.

Checklist:

- Export form definitions. Implemented per form.
- Export accepted responses. Implemented from response views.
- Expose a clear backup story for local/offline data. Implemented with dashboard workspace backup.

Acceptance criteria:

- A creator can recover critical form/response data from product UI.

### 10. Built-In Diagnostics

Goal: support production use without buying observability tooling first.

Checklist:

- Local pending/rejected submission diagnostics. Implemented for public respondents.
- Owner workspace health diagnostics. Implemented from local Kora data.
- Server health and side-effect delivery diagnostics. Implemented as a protected operator endpoint.
- Clear logs for public acceptance failures. Implemented with structured, payload-free rejection events.
- No answer payloads or secrets in diagnostics. Implemented in diagnostics snapshots and public rejection log formatting.

Acceptance criteria:

- Support/debug data can be copied safely without leaking respondent answers.

## Current Priority Order

1. Offline readiness panel and prepare flow.
2. Pending submission visibility improvements.
3. Remaining schema lifecycle transitions.
4. Offline restart and multi-tab E2E.
5. Accessibility pass on public form flow.
6. Local backup/export polish.
7. Diagnostics review.
