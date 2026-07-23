# Kora Framework Feedback From KoraForms

This feedback is based on KoraForms integration work against Kora.js `1.0.0-beta.2`.

KoraForms is an offline-first forms product. The product bar is that forms work anywhere: authenticated creators can build and manage forms offline, and public respondents can open cached forms, fill every first-party field type, save progress, submit locally, and sync automatically when connectivity returns.

## Beta.2 Improvements Confirmed

Kora `1.0.0-beta.2` resolves most of the framework issues KoraForms previously reported against `1.0.0-beta.1`:

- `KoraSyncServerConfig` now exposes `maxOperationBytes` and `maxOpsPerMinute`, and `createProductionServer({ syncOptions })` can pass them through.
- `validateOperation` now runs untrusted sync operations through a pre-materialization domain validation hook.
- Operation validators can return structured `accept`, `reject`, and `ignore` decisions.
- Rejected operation state is available client-side through `app.sync.getRejectedOperations()`, `app.sync.clearRejectedOperations()`, and the `sync:operation-rejected` event.
- `createProductionServer()` now returns `server.kora`, giving background workers the same trusted route-style `apply`, `query`, and `findById` data-plane context as HTTP routes.
- `createProductionServer()` now exposes `server.getLiveBlobRefs()`, so apps using the production wrapper can garbage-collect central blob storage.
- SQL generation now uses `quoteIdent(...)` consistently for collection and field identifiers, including camelCase and reserved-word-safe names.
- Browser SQLite WASM storage now has multi-tab coordination through leader/follower roles, BroadcastChannel RPC, and `navigator.locks` where available.
- OPFS fallback is now observable through `store:opfs-unavailable` diagnostics with classified reasons such as `lock-conflict`, `timeout`, and `unsupported`.
- KoraForms has updated its server integration to use beta.2 sync limits, the production `server.kora` context for side-effect delivery status updates, and `server.getLiveBlobRefs()` with `collectBlobGarbage()` for scheduled central blob cleanup.

## Remaining Framework-Level Gaps

### 1. Conditional Atomic Admission for Server Routes

KoraForms uses Kora counter merge semantics and `op.increment(1)` for accepted response counts. That prevents lost counter updates after a response is accepted.

The remaining quota problem is stricter: max-response enforcement needs to accept a response and increment the counter only if the form is still below its limit at commit time. A precheck against `responseCount` is fine for single-instance launch, but multiple production instances can still race unless Kora provides conditional server-route mutation semantics.

Suggested framework work:

- Add a first-class conditional mutation or transaction API on `ProductionHttpRouteContext`.
- Let the route read current state and commit multiple mutations atomically.
- Preserve operation-log semantics, HLC ordering, validation, fan-out, replay safety, and structured rejection details.
- Avoid recommending process-local locks as the production pattern; they do not work across multiple Node processes, containers, or regions.

Possible shapes:

```ts
await kora.transaction(async (tx) => {
  const form = await tx.findById('forms', formId, { forUpdate: true })
  if (form.responseCount >= form.settings.maxResponses) {
    throw new KoraDomainRejection('max_responses_reached')
  }
  await tx.insert('responses', responseId, response)
  await tx.update('forms', formId, { responseCount: op.increment(1) })
})
```

or:

```ts
await kora.apply({
  collection: 'forms',
  id: formId,
  if: { responseCount: { $lt: maxResponses } },
  update: { responseCount: op.increment(1) },
  also: [{ collection: 'responses', op: 'insert', id: responseId, data: response }],
})
```

## Confirmed Non-Issues in `1.0.0-beta.2`

These were checked and should not be reported as missing framework features:

- Blob primitives, server blob persistence callbacks, live blob refs, and blob garbage collection are available.
- `createProductionServer()` exposes `server.getLiveBlobRefs()`.
- `createProductionServer()` exposes `server.kora` for background jobs and scheduled tasks.
- `KoraSyncServer.applyLocalOperation()` is available for advanced callers that already have fully formed operations.
- `supportedSchemaVersions`, `maxConnections`, `batchSize`, `maxOperationBytes`, and `maxOpsPerMinute` are available on `KoraSyncServerConfig`.
- `validateOperation` is available on `KoraSyncServerConfig`.
- Structured operation rejection and client-side rejected-operation inspection are available.
- Product-supplied timestamps can use `t.timestamp()` without `.auto()` or a numeric field where domain-specific timestamp semantics are preferred.
- `t.json()`, `t.object()`, and `t.secret()` are available. KoraForms uses `t.json()` for dynamic payloads and `t.secret().hashed()` for form access passwords.
- Generated SQL identifiers are quoted consistently through `quoteIdent(...)`; camelCase collection and field names are supported by the framework. KoraForms can keep snake_case for product readability, but this is no longer a framework gap.
- Browser SQLite WASM includes multi-tab storage coordination and OPFS fallback diagnostics. KoraForms still isolates public and authenticated runtimes intentionally, but active same-origin tabs are no longer an unresolved framework issue.
- Atomic operations are available. KoraForms uses `op.increment(1)` for accepted response counters.
- Client-side transactions are available on `KoraApp` and the local store. The remaining transaction request is specifically for conditional server-route admission.
- Enum transitions are available. KoraForms constrains `response_submissions.localStatus` transitions in schema.
