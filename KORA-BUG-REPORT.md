# Bug: `createProductionServer` httpRoutes receive `undefined` body for POST requests

## Package & Version

`@korajs/server@1.0.0-beta.0`

## Summary

POST request bodies are silently lost when using `createProductionServer` with `httpRoutes`. The `body` field in `ProductionHttpRouteRequest` is always `undefined` for POST requests, even though the client sends a valid JSON body with the correct `Content-Type: application/json` header.

## Root Cause

The `readBodyBuffer()` function inside `createProductionServer` attaches `data` and `end` event listeners to the Node.js `http.IncomingMessage` stream, but never calls `req.resume()`. On Node.js v22 (and likely v20+), the `IncomingMessage` stream starts in paused mode. Without `resume()`, the stream never enters flowing mode, so `data` events are never emitted. The `end` event fires immediately with zero chunks, and `readJsonBody()` returns `undefined`.

### Affected code (`@korajs/server/dist/index.js`)

```js
function readBodyBuffer(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
}
```

### Expected behavior

The request body should be parsed and available as `req.body` in `httpRoutes` handlers.

### Actual behavior

`req.body` is always `undefined` for POST requests. This breaks any `httpRoutes` handler that reads the body, including `@korajs/auth`'s `handleRequest()` for signup/signin endpoints.

## Reproduction

```ts
import { createProductionServer, createSqliteServerStore } from '@korajs/server'
import { defineSchema, t } from '@korajs/core'

const schema = defineSchema({
  version: 1,
  collections: {
    items: { fields: { name: t.string() } }
  }
})

const store = createSqliteServerStore({ filename: ':memory:' })
await store.setSchema(schema)

const server = createProductionServer({
  store,
  port: 3001,
  httpRoutes: [{
    path: '/echo',
    async handle(req) {
      console.log('body:', req.body) // Always logs: body: undefined
      return { status: 200, body: { received: req.body } }
    },
  }],
})

await server.start()
```

```bash
curl -X POST http://localhost:3001/echo \
  -H "Content-Type: application/json" \
  -d '{"hello":"world"}'

# Expected: {"received":{"hello":"world"}}
# Actual:   {"received":null}
```

## Impact

This breaks the documented pattern of using `httpRoutes` with `@korajs/auth`:

```ts
httpRoutes: [{
  path: '/auth',
  handle: (req) => auth.handleRequest(req),
}]
```

All auth endpoints (signup, signin, refresh) crash with `TypeError: Cannot read properties of undefined (reading 'length')` because `body.email` is `undefined`.

## Suggested Fix

Add `req.resume()` after attaching listeners so the stream enters flowing mode. Also add an `error` handler to prevent unhandled stream errors:

```js
function readBodyBuffer(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", () => resolve(Buffer.alloc(0)));
      if (!req.readableFlowing) req.resume();
    });
}
```

Additionally, `@korajs/auth`'s `isValidEmail()` and `handleSignUp()` should guard against `undefined` input to avoid crashing the server process on malformed/missing bodies:

```js
function isValidEmail(email) {
  if (!email || email.length === 0 || email.length > 254) {
    return false;
  }
  // ...
}
```

## Environment

- Node.js: v22.14.0
- OS: macOS (Darwin 25.0.0, arm64)
- `@korajs/server`: 1.0.0-beta.0
- `@korajs/auth`: 1.0.0-beta.0

## Workaround

We use a `postinstall` script that patches `readBodyBuffer` to add `req.resume()`. The patch is idempotent and exits cleanly once the upstream fix ships.
