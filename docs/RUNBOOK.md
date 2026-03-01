# Sensill — Engineering Runbook

Step-by-step guide for an engineer to set up, run, and deploy Sensill from scratch.

---

## 1. Prerequisites

- Node.js 18+ (`node --version`)
- npm 8+ (`npm --version`)
- Wrangler CLI — install globally: `npm install -g wrangler`
- Git
- Accounts at Anthropic, Supermemory, and Cloudflare (all have free tiers; see below)

---

## 2. Accounts Required

| Service | URL | What you need |
|---|---|---|
| Anthropic | https://console.anthropic.com | API key + credits (minimum $5) |
| Supermemory | https://console.supermemory.ai | API key (free tier works) |
| Cloudflare | https://dash.cloudflare.com | Free account — Workers, KV, R2, and Pages are all on the free tier |

After creating a Cloudflare account, authenticate Wrangler:

```bash
wrangler login
# Opens browser OAuth flow; completes in ~30s
wrangler whoami  # verify
```

---

## 3. First-Time Infrastructure Setup

Run these once. If you are joining an existing project, ask the team for the existing KV IDs and skip the `create` commands.

### KV Namespace — fleet dashboard cache

```bash
cd packages/worker
wrangler kv namespace create sensill-fleet-cache
wrangler kv namespace create sensill-fleet-cache --preview
```

Copy both printed IDs into `packages/worker/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_PROD_ID"
preview_id = "YOUR_PREVIEW_ID"
```

### KV Namespace — user/auth store

```bash
wrangler kv namespace create sensill-user-store
wrangler kv namespace create sensill-user-store --preview
```

Add to `wrangler.toml` under the `USERS` binding:

```toml
[[kv_namespaces]]
binding = "USERS"
id = "YOUR_PROD_ID"
preview_id = "YOUR_PREVIEW_ID"
```

### R2 Bucket — photo storage

Enable R2 in the Cloudflare Dashboard first (Dashboard → R2 → Enable), then:

```bash
wrangler r2 bucket create sensill-inspection-photos
```

Verify `wrangler.toml` contains:

```toml
[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "sensill-inspection-photos"
```

### Secrets

```bash
# JWT signing secret — generate with: openssl rand -base64 32
wrangler secret put JWT_SECRET

# Anthropic API key
wrangler secret put ANTHROPIC_API_KEY

# Supermemory API key
wrangler secret put SUPERMEMORY_API_KEY
```

---

## 4. Environment Files

### packages/web/.env (frontend, local dev only)

```
VITE_API_URL=http://localhost:5173/api
```

In production the URL is passed inline at build time — do not hardcode the worker URL here (see Deployment section).

The Vite dev server proxies `/api/*` to `http://localhost:8787` so the frontend never needs to know the worker's port.

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL for all API calls; must include the `/api` suffix. In prod: `https://sensill-worker.kkukadia.workers.dev/api` |

### packages/worker/.dev.vars (worker, local dev only — gitignored)

```
ANTHROPIC_API_KEY=sk-ant-...
SUPERMEMORY_API_KEY=sm_...
JWT_SECRET=your-random-secret
```

Generate this file from your `.env`:

```bash
ANT_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2-)
SM_KEY=$(grep SUPERMEMORY_API_KEY .env | cut -d= -f2-)
JWT=$(openssl rand -base64 32)
printf "ANTHROPIC_API_KEY=%s\nSUPERMEMORY_API_KEY=%s\nJWT_SECRET=%s\n" \
  "$ANT_KEY" "$SM_KEY" "$JWT" > packages/worker/.dev.vars
```

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Authenticates Claude API calls (vision analysis) |
| `SUPERMEMORY_API_KEY` | Authenticates Supermemory v3 API (store + search inspection history) |
| `JWT_SECRET` | Signs and verifies all user JWTs; must be the same value in local dev and production |

---

## 5. Local Development

```bash
# From project root — starts worker (port 8787) and web (port 5173) concurrently
npm run dev
```

Or run packages separately:

```bash
# Worker only
npm run dev --workspace=packages/worker

# Web only
npm run dev --workspace=packages/web
```

Verify the worker is up:

```bash
curl http://localhost:8787/api/health
# {"status":"ok","timestamp":"...","environment":"development"}
```

Open the app: http://localhost:5173

The Vite dev server proxies all `/api/*` requests to `http://localhost:8787` via the config in `packages/web/vite.config.ts`:

```typescript
server: {
  proxy: {
    "/api": { target: "http://localhost:8787", changeOrigin: true }
  }
}
```

---

## 6. Deployment

### Deploy Worker

Upload production secrets (required before first deploy):

```bash
cd packages/worker

JWT_SECRET=$(grep JWT_SECRET .dev.vars | cut -d= -f2-)
ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .dev.vars | cut -d= -f2-)
SUPERMEMORY_API_KEY=$(grep SUPERMEMORY_API_KEY .dev.vars | cut -d= -f2-)

echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
echo "$ANTHROPIC_API_KEY" | wrangler secret put ANTHROPIC_API_KEY
echo "$SUPERMEMORY_API_KEY" | wrangler secret put SUPERMEMORY_API_KEY
```

Deploy:

```bash
wrangler deploy
# Worker URL: https://sensill-worker.kkukadia.workers.dev
```

### Deploy Frontend

Pass the production API URL at build time and deploy to Cloudflare Pages:

```bash
cd packages/web
VITE_API_URL=https://sensill-worker.kkukadia.workers.dev/api npm run build
wrangler pages deploy dist --project-name sensill --branch main
# App URL: https://sensill.pages.dev
```

Do not modify `packages/web/.env` with the production URL — the inline override keeps local dev pointed at localhost.

---

## 7. Seeding Demo Data

### Seed demo tenants (auth)

Creates two demo org accounts in the USERS KV namespace:

```bash
node scripts/seed-tenants.js
```

Demo credentials:
- `demo@acmemining.com` / `demo1234` — Acme Mining (has pre-seeded inspection history)
- `demo@betaconstruction.com` / `demo1234` — Beta Construction (empty fleet)

For production KV:

```bash
node scripts/seed-tenants.js --remote
```

### Seed demo inspection history (Supermemory)

Loads 9 inspection records tagged to the `acme-mining` tenant:

```bash
SM_KEY=$(grep SUPERMEMORY_API_KEY .env | cut -d= -f2-)
SUPERMEMORY_API_KEY=$SM_KEY node scripts/seed-memory.js
```

Records seeded:
- **CAT-2903**: 4 inspections — good → fair → critical hydraulic failure → post-repair (reference case for pattern matching)
- **CAT-4821**: 2 inspections — good → fair with Stage 1 hydraulic warning (active demo unit)
- **CAT-0019**: 2 inspections — good → critical undercarriage failure
- **1 fleet pattern**: hydraulic cylinder failure pattern (fleet-wide)

Supermemory takes 10-30 seconds to index new documents. Wait before querying.

---

## 8. API Reference

All routes return JSON. Protected routes require `Authorization: Bearer {token}`.

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Create org or join org with invite code; returns JWT |
| POST | `/api/auth/login` | No | Verify credentials; returns JWT |
| GET | `/api/auth/invite-code` | Yes | Returns the org's 8-character invite code |
| POST | `/api/inspect` | Yes | Submit inspection — returns SSE stream |
| GET | `/api/fleet` | Yes | Fleet overview from KV cache |
| GET | `/api/equipment/:id` | Yes | All inspections for one unit from Supermemory |
| GET | `/api/photos/:key` | Yes | Serve inspection photo from R2 (tenant-scoped) |
| GET | `/api/health` | No | Health check (also used by offline connectivity ping) |

### POST /api/inspect — request body

```json
{
  "equipmentId": "CAT-4821",
  "equipmentType": "336 Excavator",
  "imageBase64": "...",
  "mediaType": "image/jpeg",
  "inspectorNotes": "Optional notes"
}
```

### POST /api/inspect — SSE events (in order)

```
data: {"type":"progress","step":0,"message":"Retrieving inspection history..."}
data: {"type":"progress","step":1,"message":"Analyzing image..."}
data: {"type":"progress","step":2,"message":"Saving inspection..."}
data: {"type":"result","payload":{...InspectionResult...}}
```

On error:

```
data: {"type":"error","message":"..."}
```

---

## 9. Common Issues and Fixes

### Service worker caches stale JS after deploy

**Symptom:** App still shows old UI after deploying new frontend code.
**Fix:** Chrome DevTools → Application → Service Workers → click "Update". Or force-reload with Shift+Cmd+R. In production, `registerType: "autoUpdate"` handles this automatically on next app open, but it may take one page load cycle.
**Root cause:** The PWA service worker caches the app shell. API calls are NetworkOnly (not cached), but the JS bundle itself is cached by the service worker until it detects a new version.

### VITE_API_URL must include the /api suffix

**Symptom:** All API calls return 404 in production; work fine locally.
**Fix:** Set `VITE_API_URL=https://sensill-worker.kkukadia.workers.dev/api` (with `/api`). Using just the domain base means every fetch call in `apiFetch()` misses the prefix.

### Supermemory indexing delay (10-30s)

**Symptom:** Search returns no results immediately after seeding.
**Fix:** Wait 10-30 seconds after adding documents. This is expected behavior — Supermemory's indexing is async. Verify seeding succeeded by checking the script output (should print `Seeded X/9`).

### source .env fails / produces errors

**Cause:** API keys contain shell-special characters (`+`, `/`, `=`).
**Fix:** Use `grep ... | cut -d= -f2-` to extract individual values instead of sourcing the file.

### wrangler commands fail with "You must be logged in"

**Fix:** `wrangler login` then complete the browser OAuth flow.

### Wrangler secrets vs vars

**Rule:** Use `wrangler secret put` for `ANTHROPIC_API_KEY`, `SUPERMEMORY_API_KEY`, and `JWT_SECRET`. These are encrypted and never appear in code or config files. Use `[vars]` in `wrangler.toml` only for non-sensitive config (e.g., environment name).

### KV reads return null in local dev

**Cause:** Local Wrangler uses an in-memory KV simulator that starts empty each run.
**Fix:** Expected behavior. KV data seeded locally does not persist across `wrangler dev` restarts. Persistent data only exists in the deployed environment.

### R2 photo upload fails silently

**Cause:** R2 not enabled on the Cloudflare account, or bucket does not exist.
**Fix:** Enable R2 in Cloudflare Dashboard → R2, then `wrangler r2 bucket create sensill-inspection-photos`.

### Worker returns AI parsing error

**Cause:** `max_tokens` too low, truncating Claude's JSON mid-string.
**Fix:** Ensure `max_tokens: 2048` in the Claude API call in `packages/worker/src/index.ts`.

---

## Useful Commands

```bash
wrangler whoami                    # Check auth
wrangler kv namespace list         # List KV namespaces
wrangler r2 bucket list            # List R2 buckets
wrangler secret list               # List secrets set on worker
wrangler tail                      # Tail live worker logs
wrangler pages project list        # List Pages projects
```
