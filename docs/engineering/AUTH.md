# Engineering Design: Auth + Multi-Tenancy

**Branch:** `feat/auth`
**Status:** ✅ Shipped
**Depends on:** Nothing (first feature after MVP)
**Unlocked:** Offline Capture (needs tenantId from JWT)

---

## Problem

The MVP has no authentication. Any request to the Worker is accepted from anyone. All data (Supermemory documents, KV fleet cache, R2 photos) is shared globally — there is no data isolation between organizations. We cannot add user-specific features (push notifications, offline sync) without knowing who is making the request.

---

## Goals

- One login per organization (not per individual inspector — simplest model for the demo)
- Signup creates an org with one credential set
- JWT in `localStorage` — no backend session store required
- All data isolated by `tenantId` — no cross-org leakage
- No external dependencies — works entirely within the Cloudflare Workers runtime

## Non-Goals

- Individual user accounts within an org (future)
- Password reset / magic links (future — use an IdP if this is needed)
- MFA, SSO, social login (use Clerk or Auth0 if needed in production)
- Token revocation before expiry (logout is client-side only — clear localStorage)

---

## Architecture

### Auth Model

```
Signup:
  POST /api/auth/signup { email, password, orgName }
    → PBKDF2 hash password (100k iterations, random 16-byte salt)
    → generate tenantId = slugify(orgName)
    → store in USERS KV: user:{email} → { passwordHash, tenantId, orgName }
    → mint JWT: { sub: email, tenantId, orgName, iat, exp: now+30days }
    → return { token, user }

Login:
  POST /api/auth/login { email, password }
    → lookup user:{email} from USERS KV
    → verify password with constant-time comparison
    → mint + return JWT

Protected request:
  Authorization: Bearer {token}
    → verify HMAC-SHA256 signature with JWT_SECRET
    → check exp timestamp
    → extract tenantId from payload
    → use tenantId in all downstream data operations
```

### Token Format

HMAC-SHA256 JWT (RFC 7519), no external library. Web Crypto API only.

```json
Header: { "alg": "HS256", "typ": "JWT" }
Payload: {
  "sub": "user@company.com",
  "tenantId": "acme-mining",
  "orgName": "Acme Mining",
  "iat": 1708560000,
  "exp": 1711152000
}
```

### Why custom JWT, not an IdP?

| Criteria | Custom | IdP (Clerk, Auth0) |
|---|---|---|
| CF Workers runtime compat | Native — Web Crypto API | SDKs are Node.js — need shims |
| External dependency | None | Additional service + account |
| Features | Login + signup only | Password reset, MFA, social, sessions |
| Hackathon suitability | Best | Overkill |
| Production suitability | Sufficient with short token expiry | Better for real users |

Recommendation: stick with custom for now. If password reset or MFA is needed, migrate to Clerk (has explicit Workers support via `@clerk/backend`).

---

## Data Model

### USERS KV namespace

- **Binding:** `USERS` (separate from `CACHE` to allow different TTL policies)
- **Key:** `user:{email}` (lowercased)
- **Value:**

```json
{
  "passwordHash": "base64(salt[16] + derivedKey[32])",
  "tenantId": "acme-mining",
  "orgName": "Acme Mining"
}
```

### Tenant Isolation

| Store | Before | After |
|---|---|---|
| Supermemory containerTags | `["equipment:cat-4821"]` | `["tenant:acme-mining", "equipment:cat-4821"]` |
| Supermemory search filter | `containerTags: [equipmentTag]` | `containerTags: [tenantTag, equipmentTag]` |
| KV fleet cache | `fleet:overview` | `fleet:acme-mining:overview` |
| R2 photos | `CAT-4821/2026-01-10.jpg` | `acme-mining/CAT-4821/2026-01-10.jpg` |

`tenantId` is **always read from the verified JWT claims** — never from the request body or query string.

---

## Backend Changes (`packages/worker/src/index.ts`)

### New Env interface fields

```ts
JWT_SECRET: string;   // Worker secret — wrangler secret put JWT_SECRET
USERS: KVNamespace;   // new KV binding for user store
```

### New functions

| Function | Purpose |
|---|---|
| `hashPassword(password)` | PBKDF2 via Web Crypto — 100k iter, SHA-256, 16-byte random salt |
| `verifyPassword(password, stored)` | Constant-time comparison of derived key vs stored |
| `mintJWT(secret, payload)` | HMAC-SHA256 sign — returns `header.body.sig` |
| `verifyJWT(secret, token)` | Verify sig + check exp — returns payload or null |
| `authenticate(request, env)` | Extract `Authorization: Bearer`, call verifyJWT |
| `slugify(s)` | `orgName → tenant-id` (lowercase, hyphens) |

### New routes

| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Create org + user, return JWT |
| POST | `/api/auth/login` | No | Verify credentials, return JWT |

### Modified routes (all get auth gate)

All existing routes except `/api/auth/*` and `/api/health` now:
1. Call `authenticate(request, env)` → extract `claims`
2. Return `401` if claims is null
3. Pass `claims.tenantId` into all data operations

### Updated data operations

**`searchMemories`** — add tenant tag to filter:
```ts
// Unit history
searchMemories(key, query, [`tenant:${tenantId}`, `equipment:${equipmentId}`], 8)

// Fleet patterns (tenant-scoped)
searchMemories(key, query, [`tenant:${tenantId}`], 5)
```

**`addMemory`** — prepend tenant tag:
```ts
[`tenant:${tenantId}`, equipmentTag, typeTag, conditionTag]
```

**`updateFleetCache`** — new signature includes tenantId:
```ts
// key: fleet:${tenantId}:overview
```

**R2 photo key**:
```ts
const photoKey = `${tenantId}/${equipmentId}/${timestamp}.jpg`;
```

**Photo serving** — validate ownership:
```ts
if (!key.startsWith(`${claims.tenantId}/`)) return json({ error: "Forbidden" }, 403, origin);
```

---

## Frontend Changes (`packages/web/src/`)

### New files

| File | Purpose |
|---|---|
| `context/AuthContext.tsx` | React context: `{ user, token, orgName, setAuth(), logout() }` |
| `pages/LoginPage.tsx` | Email + password form → POST /api/auth/login |
| `pages/SignupPage.tsx` | Email + password + org name → POST /api/auth/signup |
| `components/ProtectedRoute.tsx` | Renders `<Outlet />` if token exists, redirects to `/login` otherwise |

### Modified files

**`lib/api.ts`**
- `apiFetch(url, options)` — injects `Authorization: Bearer {token}`, handles 401 → redirect
- `loginUser(email, password)` — calls `/api/auth/login`
- `signupUser(email, password, orgName)` — calls `/api/auth/signup`
- All existing `fetch()` calls updated to `apiFetch()`

**`App.tsx`**
- Wrap in `<AuthProvider>` (inside `<BrowserRouter>`)
- Add `/login` and `/signup` routes (outside Layout, no chrome)
- Wrap existing routes in `<ProtectedRoute>`

**`components/Layout.tsx`**
- Header right: `orgName` text + `<LogOut>` icon button
- Logout calls `logout()` from `useAuth()`, navigates to `/login`

### Auth state

Token stored in `localStorage` under key `sensill_token`. On app load, `AuthProvider` reads and validates the stored token (checks expiry by decoding payload). If expired or invalid, clears it and user sees `/login`.

---

## Infrastructure

### Wrangler changes

```toml
[[kv_namespaces]]
binding = "USERS"
id = "REPLACE_WITH_USERS_KV_ID"
preview_id = "REPLACE_WITH_USERS_KV_PREVIEW_ID"

# Add to comments:
# JWT_SECRET — wrangler secret put JWT_SECRET
```

### Setup commands (one-time per environment)

```bash
cd packages/worker

# Create KV namespace
wrangler kv namespace create sensill-user-store
wrangler kv namespace create sensill-user-store --preview
# → copy printed IDs into wrangler.toml

# Set JWT secret
wrangler secret put JWT_SECRET
# → enter a random 32+ char string (use: openssl rand -base64 32)
```

---

## Demo Seed Script (`scripts/seed-tenants.js`)

Pre-creates two demo orgs in USERS KV so judges can log in without signing up:

| Email | Password | Tenant ID | Org Name |
|---|---|---|---|
| demo@acmemining.com | demo1234 | acme-mining | Acme Mining |
| demo@betaconstruction.com | demo1234 | beta-construction | Beta Construction |

Acme Mining's `tenantId` matches the tenant tag added to `seed-memory.js` so existing demo history is visible on login.

Script uses `wrangler kv key put --namespace-id=ID` to write records without running a live server.

---

## Implementation Order

1. `wrangler.toml` — add USERS KV binding + JWT_SECRET comment
2. Worker: add `JWT_SECRET` + `USERS` to Env interface
3. Worker: PBKDF2 helpers (`hashPassword`, `verifyPassword`)
4. Worker: JWT helpers (`mintJWT`, `verifyJWT`)
5. Worker: `authenticate` middleware + `slugify` helper
6. Worker: POST `/api/auth/signup` route
7. Worker: POST `/api/auth/login` route
8. Worker: auth gate on all existing protected routes
9. Worker: tenant isolation in all data operations (Supermemory, KV, R2)
10. Frontend: `apiFetch` wrapper + `loginUser` + `signupUser` in `api.ts`
11. Frontend: `AuthContext.tsx`
12. Frontend: `LoginPage.tsx`
13. Frontend: `SignupPage.tsx`
14. Frontend: `ProtectedRoute.tsx`
15. Frontend: update `App.tsx`
16. Frontend: update `Layout.tsx`
17. `scripts/seed-tenants.js`
18. Update `scripts/seed-memory.js` — add `tenant:acme-mining` tag to all records

---

## Testing

| Test | How |
|---|---|
| Signup creates JWT | POST `/api/auth/signup`, inspect response, check localStorage |
| Login with correct creds | POST `/api/auth/login`, verify token returned |
| Login with wrong password | Expect `401`, not a 500 |
| Protected route without token | Expect `401` |
| Protected route with expired token | Expect `401` |
| KV key isolation | Submit inspection as tenant A, check KV key has tenantId prefix |
| R2 path isolation | Inspect photo URL — must start with `tenantId/` |
| Supermemory tag isolation | Log addMemory call — must include `tenant:{tenantId}` tag |
| Cross-tenant data | Sign in as tenant B — fleet dashboard must be empty |
| Client-side redirect | Clear localStorage, navigate to `/` — must redirect to `/login` |
| Logout | Click logout — token cleared, redirected to `/login` |

---

## Open Questions / Future Work

- **Token revocation:** Currently no server-side revoke. Logout is client-side only. If we need server-side revoke, add a `denied:{jti}` key to KV with TTL matching the token's remaining life.
- **Multiple users per org:** Add a `userId` to the token payload and store `user:{email}` → `{ ..., orgId }` with separate org records. Tenant isolation key remains `tenantId`.
- **Password reset:** Requires email delivery. Use Resend or Cloudflare Email Workers + a time-limited reset token stored in KV.
- **Production:** If real users are needed with MFA and password reset, migrate to Clerk (`@clerk/backend` has CF Workers support).
