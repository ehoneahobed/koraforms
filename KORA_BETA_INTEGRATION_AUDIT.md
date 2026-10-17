# Kora Beta Integration Audit

Date: July 29, 2026 (baseline updated to 1.0.0-beta.14 on October 8, 2026)

This audit records the KoraForms integration baseline for the latest published Kora.js beta dist-tag. KoraForms is not in production yet, so the app intentionally drops compatibility paths for older beta framework behavior instead of preserving deprecated workarounds.

## Installed Baseline

Every Kora package is pinned to exactly `1.0.0-beta.14`:

- `korajs`, `@korajs/core`, `@korajs/store`, `@korajs/react`, `@korajs/server`, `@korajs/auth`, `@korajs/cli`

The package manager is pinned to pnpm 10.11 through `packageManager` in `package.json` (the Dockerfile and CI use the same version). pnpm 11 and later ignore `pnpm.onlyBuiltDependencies`; with the pin, a newer local pnpm switches to 10.11 so `better-sqlite3`, `esbuild` and `protobufjs` still build on a fresh clone.

## Access Rules (Kora beta.15 canary)

KoraForms runs on a Kora canary with access rules, which Kora enforces for any schema that declares them (no option since the beta.15 canary of 2026-10-17):

- A form is an access group and a sharing space (`@korajs/spaces`, schema v21). Its creator is its `owner` (`forms.ownerId` is `t.string().stamp('userId')`, filled on insert); people join by email invitation as `viewer`, `editor` or `admin` (`viewer` < `editor` < `admin` < `owner`). Invitations, roles, removal and leaving are the kit's routes (`/api/spaces`, `src/domain/sharing.ts`), each one server transaction; accepting needs a verified email (`@korajs/auth` email verification). Collaborators from before v21 (`form_collaborators`) are moved at startup: accepted ones become members before devices connect, pending invitations are re-sent with new links in the background.
- Each signed-in user's devices sync only the forms they own or collaborate on, with their responses, analytics events, audit events, invitations and delivery status. Saved response views and export presets are their author's own. Respondent-only collections (`response_submissions`, `public_form_progress`) and `resume_links` never sync.
- Removing a collaborator or a collaborator leaving drops the form from their devices at once; a role change applies to their next write.
- Writes are checked by the server against the role: viewers cannot edit, editors cannot delete responses or the form, only the owner deletes a form.
- `tests/integration/access-isolation.test.ts` runs two real devices against the sync server; `tests/integration/sharing.test.ts` and `sharing-upgrade.test.ts` cover sharing and the v20 upgrade.

## 1.0.0-beta.14 Upgrade Notes

- The boot-time binding of legacy node claims is gone: Kora hands a node with history but no owner to its signed-in device at the handshake (`deviceNodeHandover`, on by default). `tests/integration/node-claims.test.ts` pins the store half.
- The forms slug constraint applies among published forms (`where: { status: 'published' }`). The former `{ $ne: 'draft' }` never matched, and beta.14 refuses it at startup. Publishing a second form with a live slug is refused by the server and undone on the author's device with a notice.
- `server.ts` imports `src/schema.ts`; the runtime Docker stage copies it, and `tests/integration/dockerfile-runtime-files.test.ts` fails when a file the server imports at runtime is missing from the image.
- `/__kora/*` endpoints whose token is unset answer `403` in production.

## 1.0.0-beta.13 Upgrade Notes

- Record and input types are derived from `src/schema.ts` (`src/schemaTypes.ts`). Mutation wrappers use the collection's insert/update input types, and `t.json` fields receive real arrays and objects. Rows written by earlier builds can still hold JSON strings in json fields, so reads go through the parse helpers in `src/domain/forms.ts`. `settings` written as an object merges per top-level key: a key missing from the new object is removed (the store sends the stored object as `previousData`). Kora refuses `undefined` inside a json value, so every json write goes through `toJsonValue()` (`src/domain/forms.ts`), and settings edits are written as a patch onto the stored value so a stale render or another device's edit is never reverted.
- The production static server serves the SPA fallback only to HTML requests. `public/sw.js` asks for HTML when it warms route URLs. KoraForms keeps its own service worker rather than `koraServiceWorker()` from `@korajs/cli/vite`, which would precache the whole creator build for every respondent.
- `createProductionServer` refuses custom-route bodies over `maxRequestBodyBytes` (default 1 MiB). The server sets it from `src/domain/limits.ts` so public responses up to 2 MiB, attachments included, are accepted. The creator app's `store.maxOperationBytes` equals the server's `maxOperationBytes` (512 KiB).
- Production trusts one proxy hop for `X-Forwarded-For` (`trustProxy`, overridable with `KORA_TRUST_PROXY`); route rate limits key on `req.ip`. The app no longer parses forwarding headers itself and no longer patches `ws` for keepalive: Kora's built-in 25 s heartbeats cover the Azure ingress idle timeout.
- `useQuery` renders `[]` before its first local result. Pages where "loading" and "nothing found" differ use `useQueryState`. Failed local queries are thrown to route-level error boundaries.
- Creator notices cover `store:storage-blocked`, `store:durability-lost`, `store:schema-ahead` and terminal `sync:operation-rejected`; the respondent runtime treats durability loss and blocked storage as blocking readiness issues.

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
pnpm run check
pnpm exec playwright test
```

The Playwright suite (including the public offline specs) should pass without `VITE_KORA_SHARED_WORKER`, patch-package, sticky query shims, or any app-level public-form data handoff.

## Remaining Product Migration

KoraForms still uses the REST acceptance bridge for final public response admission because public submissions must be validated against published form versions, password access, schedules, max-response policy, duplicate policy, payload limits, and abuse controls before owner-visible `responses` are materialized.

That bridge remains intentionally narrow and idempotent. A future anonymous sync path should only replace it when the same acceptance semantics, rejection UX, diagnostics, and E2E coverage are preserved through Kora operation validation and rejected-operation handling.
