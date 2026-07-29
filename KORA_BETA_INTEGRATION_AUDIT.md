# Kora Beta Integration Audit

Date: July 29, 2026

This audit records the KoraForms integration baseline for the latest published Kora.js beta dist-tag. KoraForms is not in production yet, so the app intentionally drops compatibility paths for older beta framework behavior instead of preserving deprecated workarounds.

## Installed Baseline

- `korajs`: `1.0.0-beta.8`
- `@korajs/store`: `1.0.0-beta.8`
- `@korajs/react`: `1.0.0-beta.8`
- `@korajs/core`: `1.0.0-beta.7`
- `@korajs/server`: `1.0.0-beta.7`
- `@korajs/auth`: `1.0.0-beta.7`
- `@korajs/cli`: `1.0.0-beta.7`

## Framework Capabilities Adopted

- SharedWorker-hosted SQLite is no longer a durable storage path for KoraForms. Both authenticated and public runtimes use the standard `sqlite-wasm` worker path.
- Kora's leader/follower multi-tab storage coordination is now the browser coordination layer for public forms.
- Kora's OPFS-to-IndexedDB fallback is treated as a durable storage mode. KoraForms records `store:storage-fallback` as an informational diagnostic, not as an offline-readiness failure.
- The old active-tab `BroadcastChannel` form-payload handoff has been removed. Public cached form versions, progress, and queued submissions must hydrate from Kora's local database.
- `store:opfs-unavailable`, persistence errors, quota errors, and database-name collisions remain blocking diagnostics because those can imply non-durable or unsafe local state.
- KoraForms no longer patches installed Kora packages during `postinstall`. The server body parsing, structured-field materialization, loud materialization failures, and IndexedDB dump-only restore fixes are now framework-owned.
- React auth subscriptions are expected to survive StrictMode remounts without app-level guards.
- `useQuery` is expected to hold previous query results while replacement subscriptions settle, so KoraForms should not add sticky query shims for framework query flicker.
- Broad and unsupported-only live queries are expected to sync collection-wide data correctly, including admin-style broad views mixed with narrow subscriptions.
- Scope changes are expected to invalidate stale delivery watermarks and backfill the authoritative server scope.
- Development and preview cross-origin isolation uses Kora's configurable COEP policy shape. KoraForms defaults to `credentialless` so embedded media works, with `KORA_COEP_POLICY=require-corp` available when stricter local isolation is needed.
- Local `.env` loading for `kora dev` and generated sync servers is framework-owned.

## Verification Target

Before a release candidate, run:

```bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm exec playwright test tests/e2e/public-offline.spec.ts
```

The public offline suite should pass without `VITE_KORA_SHARED_WORKER`, patch-package, sticky query shims, or any app-level public-form data handoff.

## Remaining Product Migration

KoraForms still uses the REST acceptance bridge for final public response admission because public submissions must be validated against published form versions, password access, schedules, max-response policy, duplicate policy, payload limits, and abuse controls before owner-visible `responses` are materialized.

That bridge remains intentionally narrow and idempotent. A future anonymous sync path should only replace it when the same acceptance semantics, rejection UX, diagnostics, and E2E coverage are preserved through Kora operation validation and rejected-operation handling.
