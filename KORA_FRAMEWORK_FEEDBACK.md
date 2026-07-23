# Kora Framework Feedback From KoraForms

This feedback is based on KoraForms integration work against Kora.js `1.0.0-beta.1`.

KoraForms is an offline-first forms product. The product bar is that forms work anywhere: authenticated creators can build and manage forms offline, and public respondents can open cached forms, fill every first-party field type, save progress, submit locally, and sync automatically when connectivity returns.

The items below are framework-team follow-ups only. APIs that are already available in `1.0.0-beta.1` are not listed as missing features.

## 1. Server-Side Operation Validators Before Materialization

KoraForms needs public respondent submissions to sync as durable offline operations without exposing owner-visible `responses` directly to anonymous clients.

The required workflow is:

- A respondent opens a published form while online.
- The immutable form version is cached locally.
- The respondent fills and submits offline.
- A durable local submission operation is created.
- When online, Kora sync sends that operation to the server.
- The server validates it against the published form version, schedule, max-response limit, duplicate policy, access policy, and payload limits.
- Only accepted submissions become owner-visible `responses`.
- Rejected submissions remain recoverable and explainable on the respondent device.

Kora `1.0.0-beta.1` has structural schema validation, constraints, state transitions, auth scopes, and route-level `req.kora.apply()`. Those are useful, but they do not appear to provide a first-class sync-time domain validation hook that can reject or transform anonymous submitted operations before owner-visible materialization.

Suggested framework work:

- Add server-side operation validators that run before materialization.
- Allow accepted operations to produce derived/materialized records.
- Allow rejected operations to return structured rejection details to the originating client.
- Support pending public-submission collections that can be synced anonymously while keeping accepted owner-visible collections private.
- Make this work with Kora's existing operation log, HLC ordering, scopes, replay, and diagnostics.

## 2. Route-Style Mutation API Outside HTTP Route Handlers

`req.kora.apply()`, `req.kora.query()`, and `req.kora.findById()` are a strong improvement in `1.0.0-beta.1`.

The gap is that the same route-style API is available only inside `ProductionHttpRouteRequest`. Background jobs and scheduled tasks do not receive a request object.

KoraForms has a background side-effect processor for webhook/email delivery status. `KoraSyncServer.applyLocalOperation()` exists, but it requires a fully formed operation. The higher-level mutation builder used by `req.kora.apply()` is not exposed for non-route jobs, and `createProductionServer()` returns only `start()` and `stop()`.

Suggested framework work:

- Expose a production-server or sync-server mutation context outside request handlers:

```ts
server.kora.apply(...)
server.kora.query(...)
server.kora.findById(...)
```

or:

```ts
syncServer.applyMutation(...)
syncServer.query(...)
syncServer.findById(...)
```

- Reuse the same validation, previous-data capture, materialization, and fan-out behavior as `req.kora.apply()`.
- Keep `applyLocalOperation()` for advanced callers that intentionally want to build operations themselves.

## 3. Sync Operation Size and Rate Limits at Server Config Level

`ClientSessionOptions` includes:

- `maxOperationBytes`
- `maxOpsPerMinute`

However, these options do not appear on `KoraSyncServerConfig`, so they cannot be passed through `createKoraServer()` or `createProductionServer()` today.

KoraForms can rate-limit REST acceptance routes, but sync-session hardening should also be configurable at the server boundary.

Suggested framework work:

- Promote `maxOperationBytes` and `maxOpsPerMinute` to `KoraSyncServerConfig`.
- Ensure `createProductionServer({ syncOptions })` can pass them through.
- Return structured rejection details so product UIs can distinguish retryable transport failures from permanent server rejections.

Note: `maxConnections` and `batchSize` already exist on `KoraSyncServerConfig`; they are not part of this request.

## 4. Production Server Access to Blob Live-Refs and Garbage Collection

Kora `1.0.0-beta.1` already includes blob support:

- `t.blob()`
- `BlobRef`
- `createBlobRef()`
- `isBlobRef()`
- `ContentAddressedBlobStore`
- `MemoryBlobStore`
- `OpfsBlobStore`
- `putBlobForTransfer()`
- `extractBlobRefs()`
- `collectBlobGarbage()`
- `toServerBlobCallbacks()`
- `KoraSyncServer.getLiveBlobRefs()`
- server `resolveBlobChunk` / `persistBlobChunk` hooks

Those should not be treated as missing.

The remaining framework issue is production-server ergonomics: `createProductionServer()` internally owns a `KoraSyncServer`, but the returned `ProductionServer` exposes only `start()` and `stop()`. A product using `createProductionServer()` can configure central blob persistence, but does not get direct access to `getLiveBlobRefs()` for garbage collection unless it avoids the production server wrapper or duplicates lower-level setup.

Suggested framework work:

- Expose a production-server method or handle for live blob refs:

```ts
server.getLiveBlobRefs()
server.collectBlobGarbage(blobStore, options)
```

or expose the underlying sync server in a controlled way.

- Add a canonical production example for central blob storage:

```ts
const blobStore = new FilesystemBlobStore('/var/kora/blobs')

createProductionServer({
  syncOptions: {
    ...toServerBlobCallbacks(blobStore),
  },
})
```

plus a scheduled GC flow that uses live refs safely.

## 5. SQL Identifier Safety for Collection Names

KoraForms moved public/offline collection names to snake_case after camelCase collection names created invalid SQL in browser SQLite.

Suggested framework work:

- Validate collection names at schema-definition time, or
- Quote generated SQL identifiers consistently across adapters.

Schema-definition-time validation may be clearer for developers because invalid collection names fail early before runtime storage setup.

## 6. Multi-Runtime Browser Storage Guidance and Diagnostics

KoraForms has separate authenticated and public respondent runtimes on the same origin.

During earlier testing, multiple browser Kora runtimes could run into storage lifecycle/locking confusion when they were not deliberately isolated by database name/runtime setup.

Suggested framework work:

- Document recommended patterns for multiple Kora clients on one origin.
- Provide diagnostics for OPFS/database lock conflicts.
- Make database naming and runtime isolation conventions explicit.
- Consider helper APIs for common app shapes such as authenticated workspace runtime plus public/anonymous respondent runtime.

## Confirmed Non-Issues in `1.0.0-beta.1`

These were checked and should not be reported as missing framework features:

- Blob primitives and blob garbage collection are available.
- `KoraSyncServer.applyLocalOperation()` is available for callers that already have fully formed operations.
- `KoraSyncServer.getLiveBlobRefs()` is available on the lower-level sync server.
- `supportedSchemaVersions` is available on `KoraSyncServerConfig` and can be passed through `createProductionServer({ syncOptions })`.
- `maxConnections` and `batchSize` are available on `KoraSyncServerConfig`.
- Product-supplied timestamps can use `t.timestamp()` without `.auto()` or a numeric field where domain-specific timestamp semantics are preferred.
- `t.json()`, `t.object()`, and `t.secret()` are available. KoraForms is now using `t.json()` for dynamic payloads and `t.secret().hashed()` for form access passwords.
