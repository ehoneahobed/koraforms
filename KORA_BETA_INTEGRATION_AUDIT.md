# Kora Beta Integration Audit

Date: July 29, 2026

This audit records the KoraForms integration baseline for the latest published Kora.js beta. KoraForms is not in production yet, so the app intentionally drops compatibility paths for older beta framework behavior instead of preserving deprecated workarounds.

## Installed Baseline

- `korajs`: `1.0.0-beta.7`
- `@korajs/store`: `1.0.0-beta.7`
- `@korajs/react`: `1.0.0-beta.7`
- `@korajs/core`: `1.0.0-beta.6`
- `@korajs/server`: `1.0.0-beta.6`
- `@korajs/auth`: `1.0.0-beta.6`
- `@korajs/cli`: `1.0.0-beta.6`

## Framework Capabilities Adopted

- SharedWorker-hosted SQLite is no longer a durable storage path for KoraForms. Both authenticated and public runtimes use the standard `sqlite-wasm` worker path.
- Kora's leader/follower multi-tab storage coordination is now the browser coordination layer for public forms.
- Kora's OPFS-to-IndexedDB fallback is treated as a durable storage mode. KoraForms records `store:storage-fallback` as an informational diagnostic, not as an offline-readiness failure.
- The old active-tab `BroadcastChannel` form-payload handoff has been removed. Public cached form versions, progress, and queued submissions must hydrate from Kora's local database.
- `store:opfs-unavailable`, persistence errors, quota errors, and database-name collisions remain blocking diagnostics because those can imply non-durable or unsafe local state.
- KoraForms no longer patches installed Kora packages during `postinstall`. The server body parsing, structured-field materialization, and IndexedDB dump-only restore fixes are now framework-owned.

## Verification Target

Before a release candidate, run:

```bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm exec playwright test tests/e2e/public-offline.spec.ts
```

The public offline suite should pass without `VITE_KORA_SHARED_WORKER` or any app-level public-form data handoff.

## Remaining Product Migration

KoraForms still uses the REST acceptance bridge for final public response admission because public submissions must be validated against published form versions, password access, schedules, max-response policy, duplicate policy, payload limits, and abuse controls before owner-visible `responses` are materialized.

That bridge remains intentionally narrow and idempotent. A future anonymous sync path should only replace it when the same acceptance semantics, rejection UX, diagnostics, and E2E coverage are preserved through Kora operation validation and rejected-operation handling.
