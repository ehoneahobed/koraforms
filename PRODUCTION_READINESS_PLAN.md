# KoraForms Production Readiness Plan

## Product Architecture Assumption

KoraForms is an offline-first form builder and response product, not a traditional always-online web app.

This plan should align with Kora.js `1.0.0-beta.1` as currently installed in this project and with the official Kora.js docs at <https://korajs.dev>. The relevant Kora philosophy is:

- Offline is the normal state. Every core code path should work without a network connection; connectivity enables sync and side effects, but it should not gate user action.
- Kora owns the data plane. The product should define schemas and mutations, then let Kora handle local storage, operation logs, conflict resolution, sync, replay, and diagnostics.
- Local durable storage is the default source of truth for app reads. Kora's browser storage target is SQLite WASM persisted through OPFS, with IndexedDB fallback.
- User actions become durable, content-addressed operations that persist with the local database, survive refreshes/restarts, replay in causal order, and deduplicate safely.
- Sync is operation-log based, not request/response state replacement. Reconnect should resume from the last acknowledgement rather than asking product code to reconcile remote state manually.
- Hybrid logical clocks, version vectors, idempotent operation application, and server apply results should be used for ordering, replay, and acceptance.
- Schema constraints, state transitions, merge strategies, sync scopes, server-accepted scopes, and custom resolvers should carry business invariants where possible.
- The server is authoritative for final acceptance, but it should validate synced operations rather than force the product into online-only request/response flows.
- UI should be driven by local state plus Kora sync status, not by blocking network calls or generic connection indicators.

That means production hardening should preserve these guarantees:

- Authenticated users can create, edit, draft, and manage forms locally when offline.
- Local changes sync automatically when a connection is available.
- The UI should clearly distinguish local-save state from remote-sync state.
- Public respondents, including field workers, should be able to open cached forms, fill them, save progress, and submit locally while offline.
- When connectivity returns, pending respondent submission operations should sync automatically through a validated server acceptance path.
- Server acknowledgement and downstream effects are deferred while offline: owner inbox sync, response count updates across devices, shared cross-device resume links, webhooks, email notifications, and public result publishing must complete automatically after connectivity returns.
- Server-side hardening must protect public endpoints without turning the whole product into an online-only system.

## Product Moat: Forms Work Anywhere

KoraForms should not merely "support offline." Its moat should be that a form is fully usable anywhere once it has been opened, preloaded, or packaged for the device.

Release meaning:

- A respondent can reload the public form page offline after the form was previously opened or preloaded.
- The app shell, form runtime, theme, fonts/icons needed for first-party UI, validation rules, conditional logic, answer piping, calculations, and respondent-facing assets are available locally.
- Every first-party field type works offline: text, email, phone, URL, number, date/time, dropdown, multiple choice, checkboxes, rating, linear scale, matrix/grid, ranking, signature, hidden/calculated fields, statements, section breaks, and file uploads.
- File uploads work offline by storing selected blobs durably, enforcing local limits, and syncing the payload after reconnect. If a browser/platform cannot persist the file safely, the UI must say that before submit.
- Submit always produces a durable local result. The respondent gets a truthful completion state even when remote acceptance is pending.
- Form owners can continue creating, editing, templating, reviewing already-synced responses, and preparing share links offline from local data.
- Network-only integrations such as webhooks, email notifications, external sheets, public result publishing, CAPTCHA, or payments must never block the core local submit path. They become queued/deferred side effects or explicit online-only add-ons.
- "Never opened before on this device" is the only hard offline boundary for a public URL. To support field workers, KoraForms needs a deliberate preload path: installed PWA, cached form pack, QR-assisted preload, or workspace/device provisioning before they enter the field.

This is the standard we should test against: airplane mode, flaky 2G, captive portals, browser refresh, tab close, device sleep, process restart, duplicate submit, multi-tab, and reconnect during sync must not lose work.

## Respondent Offline Workflow Target

The public respondent experience should behave like this:

1. A respondent opens a published form while online.
2. The form definition, theme, validation rules, conditional logic, and assets needed to render the form are cached locally.
3. The respondent can later reopen and complete that form offline on the same device.
4. Progress is saved locally as they answer.
5. Pressing submit while offline creates a local pending submission as a Kora operation with explicit pending/accepted/rejected lifecycle state.
6. The UI shows a clear state such as "Submitted locally. Waiting to sync."
7. When the device reconnects, Kora sync sends the submission operation to the server in causal order and resumes safely if the connection drops mid-sync.
8. The server validates the response against the current published form rules before accepting/materializing it.
9. If accepted, the UI marks it as synced and downstream effects run.
10. If rejected because the form closed, the max response limit was reached, or validation changed, the UI shows a recoverable failure state instead of silently losing the response.

This keeps the essence of offline-first intact while still requiring the server to be the authority for final acceptance and side effects.

## Implementation Bar

KoraForms should compete with Google Forms, Microsoft Forms, Tally, Typeform, and Jotform, so the implementation bar is:

- No hidden online-only assumptions for core workflows.
- No parallel persistence model that fights Kora's operation log.
- No custom sync/data-plane code unless it is a deliberately isolated framework compatibility adapter.
- No browser-native prompts or unclear sync states.
- No security-sensitive data stored casually in settings JSON.
- No silent data loss on offline submit, reconnect, rejected sync, tab close, or process restart.
- No feature that works only in the happy path but cannot be reasoned about under retries, conflicts, and multiple devices.
- Every production invariant must be testable at the domain/server boundary, not only in UI components.

## Target Kora Data Model Direction

Before implementation, the schema should be designed as a Kora-native workflow instead of UI-shaped JSON:

- `forms`: owner-managed form metadata, publish state, slug, version, settings references, and server-authoritative publication fields.
- `formVersions`: immutable published snapshots containing fields, validation rules, conditional logic, answer piping, calculations, theme, asset manifests, and respondent-facing assets. Public respondents fill against a specific version so offline submissions remain explainable.
- `draftResponses`: same-device respondent progress that can be saved offline and safely discarded or promoted into a submission.
- `responseSubmissions`: append-only public submission attempts with deterministic client submission ids, form id, form version id, lifecycle status, validation summary, trusted server acceptance metadata, and untrusted client diagnostics.
- `submissionBlobs`: durable local/server-backed metadata for offline file uploads, signatures, and other binary answer payloads, bound to `responseSubmissions`.
- `responses`: owner-visible accepted responses only. These should be created/materialized after server acceptance.
- `resumeLinks`: durable cross-device resume records for online-backed sharing, with expiry and form/version binding.
- `webhookDeliveries`: async side-effect records created only after response acceptance.

The `responseSubmissions.status` lifecycle should be represented with Kora enum transitions or a collection state machine:

- `draft` -> `submitted_locally`
- `submitted_locally` -> `syncing`
- `syncing` -> `accepted`
- `syncing` -> `rejected`
- `rejected` -> `needs_review`
- `needs_review` -> `submitted_locally`

Counters and analytics should avoid read-modify-write races. Use Kora atomic increments/counter merge strategies for accepted response counts, and derive analytics from accepted `responses` plus immutable form versions rather than trusting client-maintained totals.

## Kora Framework Repo Findings

The Kora.js repository at <https://github.com/ehoneahobed/kora> confirms several primitives KoraForms should use directly:

- `MixedAuthProvider` is already the recommended Kora server pattern for products with authenticated creators and anonymous public submitters.
- Anonymous scopes are collection and field filters. `{ responses: {} }` means unrestricted anonymous access to the entire `responses` collection, so KoraForms should not expose accepted `responses` directly to anonymous clients.
- The sync server resolves server-accepted scopes during handshake and includes accepted scope information back to the client.
- Server sync checks operation visibility against session scopes before accepting operations and emits scope-violation errors for rejected writes.
- Kora has a persisted outbound queue (`_kora_sync_queue`) and exposes pending operation counts through sync status. KoraForms should use this instead of a separate product outbox.
- Server apply validates Kora Tier 2 schema constraints and referential integrity before materialization.
- Kora supports state machine validation and invalid-transition policies, which fits submission lifecycle modeling.
- The repo has release-gate style tests for reconnect, chaos, convergence, production path, multi-tab, and E2E fixture behavior. KoraForms should mirror that bar for product workflows.

Confirmed gap for KoraForms:

- Kora's built-in server constraint validation is structural and schema-driven. It does not replace KoraForms domain validation for published form version rules, required answers, conditional visibility, schedules, response limits, password access, duplicate policy, unknown field ids, and anti-abuse checks. That validation should be implemented as a clean domain module now and fed back into Kora as a possible operation-validator extension point.

## Current Release Gate

Latest local verification passed on Kora.js `1.0.0-beta.1`:

- `pnpm run check`
- `pnpm run test:e2e`
- `pnpm exec kora doctor` passed project/schema/dependency checks and warned only that no local sync server was running.

Current coverage now includes domain/helper/unit-level tests plus Playwright coverage for the critical public respondent offline path: preload, offline reload, offline completion, offline local submit, attachment hydration, reconnect sync, permanent server rejection after reconnect, complex field types, and slug-bound resume requests.

Remaining coverage gap: authenticated builder/offline editing, owner response inbox/analytics/settings, rejected-sync recovery, multi-tab sync, public SEO routes, and template preview/start-from-template still need broader E2E coverage before a public release candidate.

## Implementation Status - Kora Local Data Plane

The first production-readiness implementation slices now align the respondent-critical offline path with Kora's local database instead of ad hoc browser storage:

- Published public form payloads are stored as sanitized `public_form_versions` records in Kora's local DB after a successful public load or password unlock.
- Public form reload can read the latest local `public_form_versions` record when the network is unavailable.
- Respondent submissions are stored first as durable `response_submissions` records with `submitted_locally`, `syncing`, `accepted`, `rejected`, and `failed` lifecycle states.
- Pending respondent submissions flush through the existing server-validated REST endpoint as a narrow compatibility bridge.
- Sync distinguishes retryable failures from permanent server rejections. Network failures and retryable HTTP responses remain queued; validation/revocation-style 4xx responses move to `rejected` so the UI can say the response needs review instead of claiming it is still waiting for connectivity.
- Respondent save/resume progress is stored as `public_form_progress` in Kora's local DB.
- Cross-device resume links are stored as durable `resume_links` records instead of process memory. Resume tokens are long random values, bound to a form slug/id, expire server-side, and enforce a payload size limit. Same-device progress remains local-first.
- Public respondent routes no longer import or initialize the authenticated Kora app. This keeps authenticated workspace sync, OPFS handles, and WebSocket sync out of anonymous form-fill pages.
- Public respondent runtime uses Kora's primary browser database target, `sqlite-wasm`, so form versions, progress, and queued submissions survive refresh/offline reload through Kora's durable local store.
- File upload and signature answers now save binary bytes into a durable browser blob store and keep compact local manifests in Kora-managed response/progress records. The compatibility REST bridge hydrates those manifests back into payload data before server validation, so queued offline submissions can sync complete attachment data after reconnect. Local blobs are retained while a submission is queued/retrying and cleaned up only after server acceptance or when the respondent removes/replaces that field value.
- Public-facing server endpoints now have lightweight per-client rate limits for auth, public form reads, password unlocks, shared resume reads/writes, public results, and response submission acceptance. These protect the online acceptance surface without changing the local-first respondent workflow.
- Public response bodies and shared resume payloads have explicit server-side size limits before validation/materialization.
- Published form shape and answer values now have explicit validation limits for field count, option count, matrix dimensions, text values, choice labels, and binary payload manifests. These limits are enforced on the server acceptance path, not only in the UI.
- Public results responses are capped through a server-side `limit` query with a maximum bound and pagination metadata, so public result publishing cannot accidentally return unbounded accepted response data.
- Public respondent submissions now carry deterministic client submission ids through both online submit and offline queued submit flows, giving the temporary REST compatibility bridge an idempotency key that can later map cleanly to Kora operation ids.
- Webhook side effects remain asynchronous and are created only after server response acceptance. Webhook configuration now requires HTTPS public destinations, rejects localhost/private/reserved addresses, performs DNS-resolution checks at delivery time, disables redirects, uses request timeouts, and caps captured error bodies.
- The remaining browser-native duplicate-submission prompt has been replaced with an in-app confirmation sheet that lets respondents review answers or intentionally submit another copy.
- CI now uses `pnpm run check`, so pull requests and main-branch pushes run typecheck, the unit suite, and production build before deployment can proceed.
- Production startup now rejects missing, weak, or development fallback `KORA_AUTH_SECRET` values.
- Calculated-field formulas now use a deterministic offline parser instead of `new Function`, while preserving arithmetic, aggregate, conditional, concatenation, and field-reference behavior.
- Clipboard actions now use a shared `Promise<boolean>` helper with fallback support, and visible copy controls only show success when copying actually works.
- Schema version is now `13` across client and server.
- The service worker remains only an app-shell/runtime asset cache. It is not the product data plane.
- Pure model tests cover public form sanitization, stable version hashes, response submission outbox shape, and respondent progress records.
- Browser E2E now verifies that a public respondent can load a form online, reload that same public URL offline, complete required text/email/file fields offline, complete complex first-party field types offline, persist the submission locally, sync hydrated attachment data after reconnect, and request resume links with slug binding.
- Kora `1.0.0-beta.1` route handlers now expose `req.kora.apply()`, `req.kora.query()`, and `req.kora.findById()`. KoraForms public form, public results, save/resume, and public response submission routes now use that request-scoped data-plane API for route reads and writes, so accepted responses, resume links, and side-effect jobs pass through Kora's validated apply/materialization/fan-out path instead of route-local hand-built operations.
- The sync server now declares an explicit accepted schema-version range of `{ min: 13, max: 13 }`, keeping beta clients with incompatible schema versions out of the sync session before they can send operations.
- Form access passwords now live on the top-level `forms.accessPassword` Kora `t.secret().hashed()` field. Settings JSON stays free of password material, and public form responses strip the secret field before returning full form payloads.

Remaining framework-aligned gap:

- KoraForms still uses a REST acceptance bridge for final online response acceptance because public submissions require domain validation against published form versions, schedules, max-response limits, duplicate policy, password access, and abuse rules before owner-visible `responses` are materialized. Kora `1.0.0-beta.1` removes the route-write bypass by giving routes `req.kora.apply()`, but the next framework-level step is first-class anonymous submission sync: scoped anonymous sessions, server-side operation validators, and validated materialization from pending submission operations into accepted records.
- Kora's production server does not yet expose the route mutation context or an equivalent validated local mutation API to background workers created outside HTTP route handlers. KoraForms still uses hand-built operations for side-effect delivery status updates. Framework improvement: expose a production-server-level `apply()` helper so scheduled jobs, webhooks, and maintenance tasks can use the same validated/fan-out data plane without depending on a request object.
- Kora's production server config currently exposes schema-version compatibility but not the lower-level session limits such as `maxOperationBytes` and `maxOpsPerMinute`. KoraForms enforces public REST body/rate limits in product code today. Framework improvement: surface those limits through `createProductionServer` so products can harden sync sessions at the same boundary.
- Kora's collection names currently need SQL-safe identifiers for browser SQLite. CamelCase collection names created invalid SQL, so KoraForms now uses snake_case for public/offline collections. Framework improvement: validate or quote generated table names consistently.
- Kora's timestamp helpers distinguish server-managed values from product-owned values. KoraForms uses product-supplied numeric timestamps for public cache times, local submission times, progress update times, and side-effect retry times so offline respondent state can be created and replayed deterministically.
- KoraForms uses Kora's primary browser database target, `sqlite-wasm`, for respondent form versions, progress, and queued submissions. Kora `1.0.0-beta.1` also exposes OPFS-backed blob primitives; KoraForms now uses those for newly captured file/signature bytes with an IndexedDB compatibility fallback for browsers or older local data.
- Kora's SQLite WASM worker OPFS lifecycle can conflict when multiple app runtimes open the same browser origin/database path. KoraForms now isolates public and authenticated runtimes, but Kora should eventually provide clearer multi-runtime/multi-database guidance and diagnostics.
- Kora `1.0.0-beta.1` includes browser/server blob storage primitives and garbage-collection helpers. KoraForms has adopted the browser OPFS blob store and configured server blob persistence callbacks, but the current dynamic response schema still stores answer values as JSON manifests for compatibility with the existing REST acceptance bridge. The remaining KoraForms product migration is to model submission attachments as explicit Kora blob fields or a companion `submission_blobs` collection once anonymous validated submission materialization is available.
- Kora `1.0.0-beta.1` includes `t.json()`, `t.object()`, and `t.secret()`. KoraForms now uses `t.json()` for dynamic form and response payloads and `t.secret().hashed()` for form access passwords. `t.object()` should be used for future fixed-shape nested records; current form definitions, answers, settings, and side-effect payloads are intentionally dynamic and belong on `t.json()`.

## P0 - Must Fix Before Public Launch

### 1. Guarantee Fully Functional Offline Public Forms

Finding:

- The plan currently assumes published forms can be cached, but production readiness needs an explicit runtime contract for offline public form use.
- Kora handles data persistence/sync, but KoraForms still owns app shell caching, form version preloading, asset availability, binary answer storage, and local execution of form logic.

Risk:

- The product moat fails if respondents can only type into simple fields offline while conditional logic, answer piping, file uploads, signatures, assets, or submit behavior degrade.

Plan:

- Add a public form preload/runtime layer that caches the app shell, form runtime bundle, immutable `formVersion`, theme, logic rules, and asset manifest.
- Store the active form version and respondent progress in Kora/local durable storage, not transient component state.
- Execute validation, conditional logic, answer piping, calculations, section navigation, duplicate detection, and completion checks locally from the immutable form version.
- Keep durable binary payload handling for file uploads and signatures on Kora's OPFS blob store, with IndexedDB fallback for unsupported browsers and old local records. Bind these blobs to explicit Kora submission/blob records in the next schema migration.
- Add a clear "available offline" indicator after a form is cached/preloaded.
- Add a deliberate field-worker preload workflow for forms that must work before the user reaches a no-network area.
- On reconnect, reconcile against the server's current publish state without mutating the historical form version the respondent completed.
- Treat unsupported online-only field/integration types as explicit add-ons that cannot block first-party local submit.
- Add tests for offline reload, browser restart, all field types, conditional branches, answer piping, calculated fields, file/signature payloads, and submit/retry under flaky reconnect.

### 2. Align Public Submission With Offline-First Sync Boundaries

Finding:

- The client auto-connects to Kora sync in `src/kora.ts`.
- The server grants anonymous sync scope to the `responses` collection in `server.ts`.
- This may allow public unauthenticated clients to write response records through sync directly, bypassing validation and acceptance rules.
- The Kora framework repo documents `MixedAuthProvider` for form-builder style public submitters, but its example anonymous scope of `{ responses: {} }` is intentionally broad and not sufficient for KoraForms production semantics.

Risk:

- Password protection, schedules, max response limits, duplicate detection, payload limits, and future anti-abuse rules can be bypassed if responses can be inserted without server validation.

Plan:

- Keep authenticated builder/workspace sync offline-first.
- Keep public respondent fill/save/submit offline-first.
- Represent public submissions as Kora operations, not a separate custom queue, so idempotency, operation replay, version vectors, diagnostics, conflict handling, and sync status stay inside the framework model.
- Introduce a first-class submission lifecycle in schema, preferably on a `publicSubmissions`/`responseSubmissions` collection that can transition through `draft`, `submitted_locally`, `syncing`, `accepted`, `rejected`, and `needs_review`.
- Use Kora enum transitions or collection state machines for that lifecycle so stale devices and invalid transitions are resolved by schema rules, not scattered component state.
- Materialize owner-visible `responses` only after server acceptance. Pending public submissions should remain pending locally until accepted or rejected by the server.
- Scope anonymous/public sync by published form slug/token so public users cannot insert arbitrary `responses` or submission operations for any form.
- Treat the server-accepted scope as authoritative, using Kora's existing scope/accepted-scope model and operation scope validation.
- Use `MixedAuthProvider`, but point anonymous access at the pending submission collection with required scope fields such as `formId`, `formVersionId`, `publicTokenHash`, and `respondentSessionId`, rather than exposing accepted responses.
- If Kora's current anonymous sync path cannot safely validate public submissions before materialization, add a narrow Kora-compatible adapter. It must persist operation-shaped records, use deterministic operation/submission ids, replay idempotently, feed the same server acceptance pipeline, and be tracked as framework debt rather than product architecture.
- If Kora framework support is needed, define this as a framework-level requirement: operation-level ACLs, scoped anonymous sessions, and server-side validators that run before sync-created operations are materialized.
- Add tests that prove anonymous sync or pending-submission replay cannot bypass public validation rules.

### 3. Add Server-Side Response Validation

Finding:

- The browser validates fields in `src/features/form-fill/flow.ts`.
- The server accepts response `data` as structured JSON or JSON transport text in `server.ts`, validates it against the published form definition, and stores accepted records as Kora `t.json()` values.
- Offline-created submission operations will also need server validation when replayed.

Risk:

- Attackers can submit missing required fields, invalid emails/URLs/numbers, hidden or display-only data, oversized payloads, or unknown field ids.

Plan:

- Parse the published form fields on the server before accepting a response operation.
- Validate required fields, type constraints, conditional visibility, and allowed option values.
- Strip display-only fields such as section breaks and statements.
- Reject unknown field ids unless explicitly configured as hidden/calculated fields.
- Enforce a response payload size limit.
- Generate trusted server metadata, while preserving client metadata only as untrusted diagnostics.
- Return structured rejection reasons so offline-created submissions can show clear recovery states.
- Make validation reusable across sync acceptance, import, tests, and any temporary compatibility adapter.
- Prefer Kora server-side operation validators if available; otherwise isolate validation in a server domain module that can later become a Kora framework extension point.
- Reuse shared validation helpers where possible, but keep the server as the source of truth.

### 4. Hash Form Access Passwords

Finding:

- Form passwords are stored in `settings.password` and compared directly on the server.

Risk:

- Plaintext form passwords can leak through database access, exports, logs, or future bugs.

Plan:

- Replace plaintext password storage with a password hash.
- Add a migration path for existing plaintext settings.
- Use constant-time comparison.
- Add rate limiting for password verification attempts.
- Keep the public GET behavior: password-protected forms should return only safe metadata until unlocked.

### 5. Escape Email Notification HTML

Finding:

- Server-side notification emails interpolate form titles, field labels, and response values into HTML.

Risk:

- User-controlled content can produce malformed or unsafe HTML emails.

Plan:

- Add a shared `escapeHtml` utility.
- Escape form title, labels, values, and URLs before inserting into notification HTML.
- Add unit tests using HTML/script-like input.

## P1 - Strongly Recommended Before Launch

### 6. Make Save-and-Continue Durable

Finding:

- Public partial responses were stored in an in-memory `Map`.
- Resume ids were short and not durable across restarts or multiple instances.
- Current implementation stores shared resume links in durable `resume_links` records with long tokens, expiry, slug binding, and payload limits.

Offline-first interpretation:

- Local browser progress should remain offline-first.
- Same-device save and resume should work offline from local storage.
- Cross-device resume links are an online feature and need durable server storage once connectivity exists.

Plan:

- Keep local progress in browser storage for offline use.
- Store server resume records in durable storage through a Kora collection or server store table, not a process-local `Map`.
- Use long random tokens.
- Add expiry, form binding, payload size limits, and cleanup.
- Avoid exposing partial progress unless the resume token and form/slug match.
- If the user requests a cross-device resume link while offline, persist that intent locally and create the shareable server link after reconnecting.
- Do not let cross-device resume become the source of truth for same-device progress; local state remains primary until sync/ack.

### 7. Harden Webhook Delivery

Finding:

- User-configured webhook URLs are fetched server-side.
- Current implementation persists webhook delivery jobs after server acceptance and processes them asynchronously.
- Current implementation requires HTTPS, rejects obvious localhost/private/reserved destinations at configuration time, re-checks resolved DNS addresses before delivery, disables redirects, uses a delivery timeout, caps error-body reads, and stores retry metadata.

Risk:

- Server-side request forgery, slow endpoints, and unbounded retries can affect infrastructure.

Plan:

- Require `https` webhook URLs.
- Block localhost, private networks, link-local addresses, and cloud metadata ranges.
- Add request timeouts.
- Cap response body reads.
- Store delivery status and retry metadata.
- Keep webhook delivery async and non-blocking for respondent submission.
- Trigger webhooks only after server acceptance, never merely because a client created a pending local response.
- Add deployment-level egress controls where available so application checks are not the only SSRF defense.

### 8. Replace Remaining Native Duplicate Submission Confirm

Finding:

- The public fill flow previously used `window.confirm` for duplicate submission detection.
- Current implementation uses a polished in-app confirmation sheet with explicit "Review answers" and "Submit again" actions.

Risk:

- Browser-native prompts break the polished product feel and are inconsistent with the rest of the app.

Plan:

- Keep the native prompt removed.
- Keep the duplicate detection local/offline-first.
- Ensure duplicate detection covers local pending submissions as well as recently synced submissions.
- Make the action explicit: "Submit again" and "Review answers".

### 9. Run Tests In CI

Finding:

- The GitHub workflow previously typechecked and built, but did not run the unit test suite.
- Current implementation uses `pnpm run check` in CI.

Risk:

- A change can pass CI while breaking behavior covered by local tests.

Plan:

- Keep CI aligned with the canonical local release gate.
- Keep deployment dependent on the full check job.

### 10. Harden Production Auth And Sync Sessions

Finding:

- KoraForms relies on Kora auth and scoped sync, but production release needs explicit handling for token revocation, secret rotation, session expiry, anonymous public sessions, and rejected scopes.
- Current implementation fails startup in production unless `KORA_AUTH_SECRET` is configured with a non-development strong value.

Risk:

- A leaked, stale, or over-scoped token can keep syncing data after access should have been revoked.
- Public respondent scopes can become too broad if slug/token validation is not enforced consistently during sync handshakes.

Plan:

- Keep the production JWT secret startup guard in place.
- Configure a durable token revocation/session store instead of process-local revocation state.
- Add key rotation guidance and a migration path for active sessions.
- Use short-lived public respondent sync sessions bound to a published form slug/token, accepted form version, and allowed operation scope.
- Ensure logout disconnects sync, clears sensitive cached auth state, and preserves non-sensitive pending local operations where appropriate.
- Add tests for expired tokens, revoked tokens, public scope narrowing, rejected scopes, and reconnect after re-authentication.

### 11. Add End-to-End Smoke Tests

Finding:

- Current tests cover many helpers, but not critical user journeys.

Plan:

- Add Playwright smoke tests for:
  - Authenticated sign-in/sign-up happy path.
  - Create draft offline/local-first.
  - Publish form and copy public URL.
  - Public form preload and offline availability indicator.
  - Public form reload in airplane mode after prior preload.
  - Public form fill and submit online.
  - Public form fill and submit offline into a pending Kora submission operation.
  - Every first-party field type offline, including file upload and signature.
  - Conditional logic, answer piping, calculations, and section navigation offline.
  - Pending public submission sync after reconnect.
  - Server rejection of a pending response when the form is no longer accepting responses.
  - Duplicate replay/idempotency after flaky reconnect.
  - Multi-tab respondent flow where one tab creates a pending submission and another syncs.
  - Owner dashboard eventually receiving offline-created responses after sync.
  - Password-protected form unlock.
  - Response inbox, analytics tab, field insights tab.
  - Template preview and start-from-template.
  - Offline/online sync recovery where feasible.

## P2 - Important Hardening And Maintainability

### 12. Replace Dynamic Formula Evaluation

Finding:

- Formula evaluation previously used `new Function` after sanitizing arithmetic input.
- Current implementation uses a small deterministic parser for arithmetic-shaped formulas and fails malformed/non-finite arithmetic closed.

Risk:

- Current sanitization reduces risk, but dynamic code execution is not ideal for a public form product.

Plan:

- Keep the expression parser/evaluator in place.
- Support only explicit arithmetic operators and approved functions.
- Add tests for malformed formulas, divide-by-zero, nested functions, and non-numeric field values.

### 13. Improve Clipboard Feedback Contract

Finding:

- Clipboard helpers previously returned `void`, so UI could not reliably show success/failure.
- Current implementation returns `Promise<boolean>` and routes all product clipboard writes through the shared helper.

Plan:

- Keep `copyToClipboard` success-aware.
- Standardize copy feedback across share, URL, response export, resume links, and embed snippets.

### 14. Formalize Offline/Sync Status Semantics

Finding:

- The UI has local save and sync states, but production behavior should be explicit and consistent.

Plan:

- Define product states:
  - Saved locally.
  - Submitted locally.
  - Pending remote sync.
  - Syncing.
  - Synced.
  - Offline, changes pending.
  - Sync failed, retrying.
  - Sync rejected, action needed.
- Map these states to Kora's sync status, apply results, diagnostics, and pending operation metadata where possible.
- Ensure builder, dashboard, public fill, responses, and settings use the same vocabulary and visual treatment.
- Add framework feedback for Kora if the sync API lacks enough state detail for pending operation counts, rejected operation reasons, and retry status.

### 15. Add Operational Limits

Status:

- Public response body size, shared resume payload size, request rate limits, webhook delivery hardening, webhook count/header limits, field/option/matrix/value limits, public results capping, local pending submission caps, local blob storage caps, and public submission idempotency keys are implemented.

Plan:

- Keep public response body size limits in place.
- Limit pending submission operation volume per device/form.
- Keep number-of-fields and option/matrix dimension limits in place.
- Limit webhook count and header size.
- Keep public results response caps/pagination in place.
- Keep request rate limits for auth, password checks, public form fetches, partial saves, public results, and submissions.
- Keep replay/idempotency keys for pending public submissions so reconnect retries cannot create accidental duplicates.
- Keep explicit product limits for local pending queue size and retained local blob bytes per form/device.
- Keep webhook count and header size limits in place.
- Prefer Kora operation IDs or deterministic submission fingerprints for idempotency instead of separate random request ids where possible.

### 16. Add Observability For Offline-First Production Support

Finding:

- Kora exposes sync diagnostics and server metrics, but KoraForms needs product-level observability around pending submissions and rejected acceptance.
- Current implementation has a support-safe public respondent diagnostics snapshot for local submission status counts, pending counts, local blob usage, and recent failed/rejected submission metadata. Queued respondent completion screens can copy that snapshot without exposing response answers, resume tokens, passwords, or webhook secrets.

Plan:

- Keep support-safe local diagnostics for pending submissions, accepted submissions, rejected submissions, retry attempts, local blob usage, and recent failure reasons.
- Include operation ids/submission ids in support-safe logs and diagnostics.
- Add owner-side/server diagnostics for webhook delivery outcomes and rejected acceptance reasons.
- Avoid logging raw response data, passwords, tokens, or webhook secrets.

### 17. Review Public SEO Pages Separately

Plan:

- Validate public landing/templates/detail pages for:
  - Metadata and canonical URLs.
  - Open Graph/Twitter cards.
  - Structured data for templates where useful.
  - Accessible heading hierarchy.
  - Responsive layout at mobile/tablet/desktop.
  - No private dashboard routes leaking into public navigation.

## Framework-Level Feedback For Kora.js

KoraForms is intentionally stress-testing Kora.js. These production-readiness findings suggest useful framework-level improvements:

- Operation-level ACLs for sync, especially anonymous/public scopes.
- Server-side collection validators that run before sync-created operations materialize, and that can also be reused by any temporary compatibility adapter.
- First-class local pending-submission lifecycle primitives for anonymous/public submissions, built on the existing operation queue rather than a second persistence model.
- First-class offline preload/form-pack patterns for public URL workflows where the respondent may later have no network.
- Clearer production examples for binding Kora blob refs to anonymous offline submission operations and collecting server-side blobs through the production server wrapper.
- Idempotent operation replay support that exposes duplicate/applied/rejected results clearly to the app.
- First-class offline/sync state primitives for UI.
- Public scoped sync sessions based on form slug/token, with server-accepted scopes visible to the client.
- Server-side rejection reasons that can flow back to pending local operations.
- Durable partial-progress patterns for public users.
- Built-in hooks for side effects after operation acceptance, such as webhooks and email notifications.
- Stronger examples for anonymous offline writes with validation, replay, rejection, and user-visible recovery.
- Durable server-side sync/session metadata for public/offline workflows.
- Migration helpers for schema/settings changes that affect persisted offline data.

## Suggested Execution Order

1. Define the "forms work anywhere" runtime contract and add failing E2E tests for preload, offline reload, all field types, local submit, refresh/restart, and reconnect.
2. Finalize the Kora-native schema: immutable form versions, draft responses, response submissions, submission blobs, accepted responses, resume links, and webhook deliveries.
3. Define the public respondent submission lifecycle with Kora enum transitions/state machines.
4. Build the public form preload/runtime layer.
5. Lock down public response writes so no transport can bypass server acceptance.
6. Add server-side response validation and payload limits for every acceptance path.
7. Hash/migrate form passwords and rate-limit password checks.
8. Escape notification email HTML.
9. Harden production auth, revocation, public sync sessions, and accepted scopes.
10. Make save-and-continue durable for cross-device resume links.
11. Harden webhooks.
12. Replace the final native duplicate-submission confirmation.
13. Update CI to run the full check suite.
14. Add remaining end-to-end smoke tests for authenticated builder, analytics, responses, templates, and settings journeys.
15. Add observability for pending/rejected/synced submission flows.
16. Replace dynamic formula evaluation.
17. Standardize clipboard feedback.
18. Polish public SEO pages and final responsive QA.
