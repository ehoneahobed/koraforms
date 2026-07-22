# KoraForms — KoraJS v0.3 → v0.6 Upgrade Plan

## Background

KoraForms currently depends on `@korajs/*` packages at **v0.3.x**. The latest published versions are **v0.6.x**. This spans three minor versions (0.4, 0.5, 0.6) and includes significant API changes. No production deployment exists yet, so backward compatibility is not a concern.

---

## What Changed in KoraJS (v0.3 → v0.6)

Sourced directly from https://korajs.dev docs and npm registry:

### `@korajs/auth` — Major Server-Side Refactor

**Old API (v0.3):**
```ts
import { BuiltInAuthRoutes, TokenManager, createSqliteUserStore } from '@korajs/auth/server'
const tokenManager = new TokenManager({ secret: process.env.AUTH_SECRET })
const authRoutes = new BuiltInAuthRoutes({ userStore, tokenManager })
// Manual HTTP route handling per endpoint
authRoutes.handleSignUp(body, ip)
authRoutes.handleSignIn(body, ip)
// etc.
```

**New API (v0.6):**
```ts
import { createKoraAuthServer, createSqliteOAuthStores } from '@korajs/auth/server'
const oauthStores = await createSqliteOAuthStores({ filename: './auth.db' })
const auth = createKoraAuthServer({
  jwtSecret: process.env.KORA_AUTH_SECRET,
  stores: oauthStores,
})
// auth exposes: auth.router (mounts all routes), auth.toSyncAuthProvider()
```

Key changes:
- `AUTH_SECRET` env var → `KORA_AUTH_SECRET`
- `createSqliteUserStore()` → `createSqliteOAuthStores()` (also supports Postgres)
- `BuiltInAuthRoutes` + `TokenManager` → `createKoraAuthServer()` factory
- Auth HTTP routes are now exposed via `auth.router` (a standard request handler), not manually wired
- `createPostgresUserStore` → `createPostgresOAuthStores`
- New `auth.toSyncAuthProvider()` method unchanged in concept, but access path changed
- Supports OAuth (Google provider via `googleProvider`), MFA, RBAC, organizations, passkeys

### `@korajs/auth` — Client-Side

**Old API (v0.3):**
```ts
import { AuthClient } from '@korajs/auth'
export const authClient = new AuthClient({ serverUrl, storageKey: 'koraforms_auth' })
```

**New API (v0.6):**
```ts
import { createKoraAuth } from '@korajs/auth'
export const authClient = createKoraAuth({ serverUrl })
```
- `createKoraAuth()` is the new preferred factory (wraps `AuthClient` with production defaults including `IndexedDB`-based token storage)
- `new AuthClient()` still works but is lower-level; `storageKey` option is deprecated in favor of the built-in `EncryptedTokenStore`
- New: `OrgClient`, `EncryptedTokenStore`, `createPersistentDeviceIdentity`
- New hooks in `@korajs/auth/react`: `useCurrentUser`, `useAuthStatus` (in addition to `useAuth`)

### `@korajs/react` — New/Changed Hooks

- `useSyncStatus` → return shape may have changed (check `status.status` still valid)
- New: `useRichText` hook for `t.richtext()` fields
- `KoraProvider` props: same, `app` + `fallback`
- `useCollection`, `useMutation` — same API, improved performance

### `@korajs/server` — Server-Side

**Old API (v0.3):**
```ts
import { createSqliteServerStore, createPostgresServerStore, MixedAuthProvider, KoraSyncServer, WsServerTransport } from '@korajs/server'
const syncServer = new KoraSyncServer({ store, auth: new MixedAuthProvider(...) })
```

**New API (v0.6):**
```ts
import { createSqliteServerStore, createPostgresServerStore, MixedAuthProvider, KoraSyncServer, WsServerTransport } from '@korajs/server'
// Core API unchanged, but MixedAuthProvider may have new signature
// auth.toSyncAuthProvider() now part of createKoraAuthServer() return value
```

- `KoraSyncServer`, `WsServerTransport` API unchanged
- `MixedAuthProvider` — check if `anonymous scopes` config changed
- `store.queryCollection()` — unchanged
- `store.setSchema()` — unchanged

### `@korajs/core` / `korajs` — Schema DSL Additions

New modifiers available (not breaking — additive):
- `t.number().merge('counter' | 'max' | 'min')`
- `t.array().merge('append-only')`
- `t.string().merge('server-authoritative')`
- `t.enum().transitions({...})` — state machine support
- Schema `constraints:` block — uniqueness, capacity, referential integrity
- Schema `resolve:` block per collection — custom merge functions

### `kora.config.ts`

New options potentially available (non-breaking if not used):
- `devtools: true` in `createApp()` (already in use)
- Sync encryption hooks in config
- Backup/restore configuration

### `@korajs/cli` / `korajs` CLI

- `kora dev` command still valid
- `defineConfig` import from `korajs/config` — unchanged

### Env Var Rename

| Old | New |
|-----|-----|
| `AUTH_SECRET` | `KORA_AUTH_SECRET` |

---

## Open Questions

> [!IMPORTANT]
> **`createKoraAuthServer` returns a router** — does it expose individual handlers or only a single `router` function? Need to confirm if we can keep our custom static-file server + manual HTTP routes, or if we need to adapt. Based on doc snippet, `auth.router` mounts all `/auth/*` routes. We need to bridge it into our Node `http.createServer` handler.

> [!NOTE]
> **PostgreSQL store**: `createPostgresUserStore` is now `createPostgresOAuthStores`. This needs updating in the Postgres fallback path. Does it accept the same `{ connectionString }` option? Likely yes.

---

## Proposed Changes

### 1. Update All Dependencies

#### [MODIFY] [package.json](file:///Users/ehoneahobed/Work/koraforms/package.json)
Bump all `@korajs/*` and `korajs` packages from `^0.3.x` to `^0.6.x`.

```json
"@korajs/auth": "^0.6.0",
"@korajs/core": "^0.6.0",
"@korajs/react": "^0.6.1",
"@korajs/server": "^0.6.1",
"@korajs/store": "^0.6.0",
"korajs": "^0.6.1"
```
Dev:
```json
"@korajs/cli": "^0.6.0"
```

---

### 2. Server-Side Auth Refactor

#### [MODIFY] [server.ts](file:///Users/ehoneahobed/Work/koraforms/server.ts)

**Replace:**
```ts
import {
  BuiltInAuthRoutes,
  TokenManager,
  createSqliteUserStore,
  createPostgresUserStore,
} from '@korajs/auth/server'
import type { UserStore } from '@korajs/auth/server'
```

**With:**
```ts
import {
  createKoraAuthServer,
  createSqliteOAuthStores,
  createPostgresOAuthStores,
} from '@korajs/auth/server'
```

**Replace `createStores` function:**
Old returned `{ store, userStore }`. New returns `{ store, auth }` where auth is the result of `createKoraAuthServer()`.

**Replace manual auth route handlers:**
The 5 manual if-blocks (`/auth/signup`, `/auth/signin`, etc.) get replaced by delegating to `auth.router` from `createKoraAuthServer()`. The `auth.router` is a Node-compatible request handler.

**Replace `AUTH_SECRET`:**
```ts
// Old:
secret: process.env.AUTH_SECRET || 'koraforms-dev-secret-change-in-production'
// New:
jwtSecret: process.env.KORA_AUTH_SECRET || 'koraforms-dev-secret-change-in-production'
```

**Replace Sync server auth:**
```ts
// Old:
auth: new MixedAuthProvider({
  primary: authRoutes.toSyncAuthProvider(),
  anonymousScopes: { responses: {} },
})
// New:
auth: new MixedAuthProvider({
  primary: auth.toSyncAuthProvider(),
  anonymousScopes: { responses: {} },
})
```

---

### 3. Client-Side Auth Modernization

#### [MODIFY] [src/auth.ts](file:///Users/ehoneahobed/Work/koraforms/src/auth.ts)

**Replace:**
```ts
import { AuthClient } from '@korajs/auth'
export const authClient = new AuthClient({ serverUrl, storageKey: 'koraforms_auth' })
```

**With:**
```ts
import { createKoraAuth } from '@korajs/auth'
const serverUrl = import.meta.env.VITE_AUTH_URL ||
  `${window.location.protocol}//${window.location.host}`
export const authClient = createKoraAuth({ serverUrl })
```

The `createKoraAuth()` factory auto-configures encrypted `IndexedDB`-backed token storage — no `storageKey` needed.

---

### 4. Environment Variables

#### [MODIFY] [.env.example](file:///Users/ehoneahobed/Work/koraforms/.env.example)

Rename `AUTH_SECRET` to `KORA_AUTH_SECRET`:
```
# Server
PORT=3001
KORA_AUTH_SECRET=change-me-to-a-random-string
```

#### [MODIFY] [.github/workflows/deploy.yml](file:///Users/ehoneahobed/Work/koraforms/.github/workflows/deploy.yml)
Update any references to `AUTH_SECRET` → `KORA_AUTH_SECRET` in CI/CD secrets usage comments.

---

### 5. Schema Modernization (Optional but Recommended)

#### [MODIFY] [src/schema.ts](file:///Users/ehoneahobed/Work/koraforms/src/schema.ts)

Add proper `status` field as a state machine using new `.transitions()` API:

```ts
status: t.enum(['draft', 'published', 'closed'])
  .default('draft')
  .transitions({
    draft: ['published', 'closed'],
    published: ['draft', 'closed'],
    closed: [],
  }),
```

Add `responseCount` as a counter merge (so concurrent submissions don't race):
```ts
responseCount: t.number().default(0).merge('counter'),
```

Add `constraints` to `forms` for unique slugs:
```ts
constraints: {
  uniqueSlug: {
    type: 'unique',
    fields: ['slug'],
    where: { status: { $ne: 'draft' } },
    onConflict: 'first-write-wins',
  },
},
```

Also update `server.ts`'s inline schema to match.

**Schema version**: bump from `3` → `4`.

---

### 6. Verify `@korajs/react` Hook Compatibility

#### [MODIFY] [src/App.tsx](file:///Users/ehoneahobed/Work/koraforms/src/App.tsx)

Verify `useSyncStatus()` return shape. May now also expose `lastSyncedAt`, `queueSize`. The `status.status` field should still work.

Consider replacing the manual `user?.name` / `user?.email` access with `useCurrentUser()` hook for cleaner code:
```ts
import { useCurrentUser } from '@korajs/auth/react'
const currentUser = useCurrentUser()
```

---

### 7. Update `kora.config.ts` (Minor)

No breaking changes expected, but confirm `defineConfig` API still accepts the same shape. The current config is minimal and should still work.

---

### 8. Update `Dockerfile` (Env Var)

#### [MODIFY] [Dockerfile](file:///Users/ehoneahobed/Work/koraforms/Dockerfile)

Any references to `AUTH_SECRET` → `KORA_AUTH_SECRET` in comments or ARG lines.

---

### 9. Package Install

After all file changes:
```bash
pnpm install
```

---

## Verification Plan

### Automated Build Check
```bash
pnpm typecheck
pnpm build
```

### Manual Verification
1. Run `pnpm dev` and verify the kora dev server starts
2. Sign up a new account → verify auth works
3. Create a form → verify it saves locally  
4. Publish form → verify slug is generated
5. Open form URL → verify anonymous form fill works offline
6. Check responses appear

### Env Var Checklist
- [ ] `AUTH_SECRET` removed from all configs
- [ ] `KORA_AUTH_SECRET` set in production env (Fly.io: `fly secrets set KORA_AUTH_SECRET=...`)
- [ ] CI/CD secret name updated in GitHub repo settings

---

## Summary of Files Modified

| File | Change |
|------|--------|
| `package.json` | Bump all `@korajs/*` to `^0.6.x` |
| `server.ts` | New auth API: `createKoraAuthServer` + `createSqliteOAuthStores`; env var rename |
| `src/auth.ts` | Use `createKoraAuth()` factory |
| `src/schema.ts` | Add state machine, counter merge, unique constraint; bump version to 4 |
| `.env.example` | `AUTH_SECRET` → `KORA_AUTH_SECRET` |
| `Dockerfile` | Env var comment update |
| `.github/workflows/deploy.yml` | Secret name update |
| `src/App.tsx` | Minor: use `useCurrentUser()` hook if available |
