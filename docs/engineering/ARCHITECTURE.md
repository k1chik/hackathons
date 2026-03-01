# Sensill — Architecture

How every part of Sensill fits together, why each component exists, and what happens end-to-end when an inspector submits a photo.

---

## 1. System Diagram

```
+-------------------------------------------------------+
|  Mobile PWA  (Cloudflare Pages)                       |
|                                                       |
|  React + Vite + Tailwind                              |
|  +-----------+   +-------------+   +--------------+  |
|  | InspectPage|   | ResultsPage |   | DashboardPage|  |
|  +-----------+   +-------------+   +--------------+  |
|        |                                  |           |
|  +------------------+                     |           |
|  | IndexedDB        |  (offline queue)    |           |
|  +------------------+                     |           |
+-------+----------------------------------+------------+
        | HTTPS + JWT (Bearer token)       | HTTPS + JWT
        v                                  v
+-------------------------------------------------------+
|  Cloudflare Workers  (Edge API)                       |
|  packages/worker/src/index.ts                         |
|                                                       |
|  +---------+  +----------+  +------+  +----------+   |
|  | KV:USERS|  | KV:CACHE |  |  R2  |  | CORS /   |   |
|  | (auth)  |  | (fleet)  |  |(photos) | routing  |   |
|  +---------+  +----------+  +------+  +----------+   |
+-------+-----------------------------------------------+
        |                    |
        v                    v
+---------------+    +------------------+
|  Claude API   |    |  Supermemory v3  |
|  claude-sonnet-4-6 |    |  (semantic memory) |
|  Vision + text|    |  store + search  |
+---------------+    +------------------+
```

---

## 2. Inspection Request Flow

This is the full pipeline executed on every `POST /api/inspect`.

### Frontend: pre-submit

1. Inspector fills out the form: Equipment ID, equipment type, photo, optional notes
2. The notes field has a mic button (Web Speech API) for dictation
3. The Equipment ID field has QR scanner support (BarcodeDetector API) and autocomplete from past inspections
4. On tap of "Analyze", the frontend calls `isOnline()` — an active HEAD ping to `/api/health` with a 3-second timeout
   - If offline: inspection serialized and saved to IndexedDB with `status: "pending"`; user sees "Saved for later"
   - If online: proceeds to submit

### Worker: receives request

```
POST /api/inspect
Authorization: Bearer {jwt}
Body: { equipmentId, equipmentType, imageBase64, mediaType, inspectorNotes }
```

1. Worker calls `verifyJWT(token)` → extracts `{ tenantId, email }`
2. Opens a `TransformStream`; returns the readable side as a `text/event-stream` response immediately
3. All pipeline work runs inside `ctx.waitUntil()` — keeps the isolate alive until the stream closes
4. Sends first progress event: `{ type: "progress", step: 0, message: "Retrieving inspection history..." }`

### Worker: parallel Supermemory search (~1.8s)

```typescript
const [specificHistory, fleetPatterns] = await Promise.all([
  searchMemories(
    "equipment {equipmentId} inspection history findings",
    ["tenant:{tenantId}", "equipment:{equipmentId}"],
    { limit: 8 }
  ),
  searchMemories(
    "{equipmentType} failure pattern wear damage",
    ["tenant:{tenantId}"],
    { limit: 5 }
  ),
]);
```

Returns the 8 most semantically relevant past inspections for this unit, plus up to 5 fleet-wide failure patterns matching the equipment type. Both results are merged into a historical context string injected into Claude's prompt.

### Worker: Claude vision analysis (~15-20s)

```
System prompt:  "You are Sensill, an expert heavy equipment inspection AI..."
User message:
  - base64 image (type: "image", source: { type: "base64", media_type, data })
  - inspection request text
  - historical context block from Supermemory results
  - JSON schema for structured response
```

Claude returns structured JSON (max_tokens: 2048, natural output ~800 tokens). Worker sends progress event: `{ type: "progress", step: 1, message: "Analyzing image..." }`.

### Worker: parallel save operations

Three saves run in sequence after analysis:

```
1. Photo → R2
   key: "{tenantId}/{equipmentId}/{timestamp}.{ext}"
   → photoUrl stored in inspection result

2. Inspection result → Supermemory
   content: markdown-formatted report (findings, score, summary, recommendations)
   containerTags: ["tenant:{tenantId}", "equipment:{equipmentId}",
                   "type:{equipmentType}", "condition:{condition}"]
   metadata: { equipmentId, conditionScore, immediateAction, photoUrl, inspectedAt }

3. Fleet cache → KV CACHE
   key: "fleet:{tenantId}:overview"
   value: updated JSON array with this unit's latest state
```

### Worker: result delivered

```
data: { "type": "result", "payload": { ...inspectionResult, photoUrl } }
stream closed
```

### Frontend: receives result

1. Frontend parses the SSE `result` event
2. Stores `inspectionResult` in `localStorage` under a namespaced key (survives PWA navigation outside the Layout route tree)
3. Navigates to `/results`

---

## 3. Memory Architecture

### How containerTags provide isolation

Every inspection document stored in Supermemory is tagged with multiple scopes:

```
tenant:{tenantId}          required on all documents — org-level isolation
equipment:{equipmentId}    unit-specific tag (lowercase, normalized)
type:{equipmentType}       equipment category (e.g. "type:336_excavator")
condition:{condition}      outcome tag (e.g. "condition:poor")
```

Searches always include `tenant:{tenantId}` to prevent cross-org data leakage. Equipment-specific searches also include `equipment:{equipmentId}`.

### What is stored per inspection

Each inspection is stored as a human-readable markdown document, not raw JSON. This improves semantic retrieval quality and lets Claude read the content directly if it's included in context.

```markdown
# Equipment Inspection: CAT-4821
Date: 2026-02-27 | Condition: FAIR (6/10) | Immediate Action: false

## Summary
Fair condition with Stage 2 hydraulic scoring on the rod seal area...

## Findings
- Hydraulic Cylinder (HIGH): Stage 2 scoring visible on rod seal area...
- Undercarriage (LOW): Normal wear, within acceptable range...

## Recommendations
1. Replace hydraulic rod seal within 2 weeks
2. Monitor hydraulic pressure at next 250-hour service
```

Metadata fields stored alongside: `equipmentId`, `equipmentType`, `conditionScore`, `overallCondition`, `immediateAction`, `photoUrl`, `tenantId`, `inspectedAt`.

### How Supermemory context is injected into Claude

The two parallel search results are merged into a single historical context block:

```
## Historical Inspection Data for Equipment CAT-4821:
[ranked past inspection documents from Supermemory]

## Fleet Pattern Knowledge:
[ranked fleet-wide failure patterns from Supermemory]
```

This block is appended to the user-turn message alongside the image and the current inspection request. Claude reasons over both the visual evidence and the historical text simultaneously.

---

## 4. Offline Architecture

### IndexedDB schema

Managed via the `idb` library. One object store: `pendingInspections`.

```typescript
interface PendingInspection {
  id: string;              // UUID
  equipmentId: string;
  equipmentType: string;
  imageBase64: string;     // 3-8MB — too large for localStorage
  mediaType: string;
  inspectorNotes: string;
  status: "pending" | "submitting" | "failed";
  retryCount: number;      // max 3
  createdAt: string;       // ISO timestamp
}
```

### Sync trigger points

Auto-sync fires on four events:

1. **App mount** — covers "open the app when you already have connectivity"
2. **`window.online` event** — covers "walk back into cell coverage"
3. **`document.visibilitychange`** — covers "switch back to the Sensill tab"
4. **Manual "Submit now" button** in `PendingBanner` — covers "I know I'm online, sync now"

### Retry logic

- On sync start: all items with `status: "submitting"` (from a previous crash) are reset to `"pending"`
- Each item transitions: `pending` → `submitting` → deleted on success, or back to `failed` after 3 retries
- Failed items remain in IndexedDB and are visible in the pending banner count

---

## 5. Auth + Tenancy

### JWT payload shape

```typescript
interface JWTPayload {
  tenantId: string;   // e.g. "acme-mining"
  email: string;
  orgName: string;
  iat: number;
  exp: number;        // 30-day expiry
}
```

Signed with HMAC-SHA256 via Web Crypto API. No external JWT library.

### KV key schema

```
USERS namespace:
  user:{email}        → { passwordHash, salt, tenantId, orgName }
  org:{tenantId}      → { tenantId, orgName, inviteCode, createdAt }
  invite:{code}       → { tenantId }

CACHE namespace:
  fleet:{tenantId}:overview  → FleetOverview JSON array
```

### How tenantId flows through every data layer

```
JWT verified on every request → tenantId extracted
  ↓
Supermemory: containerTags always include "tenant:{tenantId}"
  ↓
R2: photo key always prefixed with "{tenantId}/"
    Worker checks prefix before serving: 403 if mismatch
  ↓
KV CACHE: fleet key always "fleet:{tenantId}:overview"
  ↓
KV USERS: user lookup by email, then tenant verified
```

No query can touch another org's data. The tenantId from the verified JWT is the single source of truth.

---

## 6. Voice Input Architecture

### useSpeechRecognition hook

A custom React hook wrapping the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). Exposes:

```typescript
const {
  listening,  // boolean
  supported,  // boolean — false in Firefox/Safari
  start,      // () => void
  stop,       // () => void
} = useSpeechRecognition(onResult);
```

The hook configures `recognition.continuous = false` and `recognition.interimResults = false` — one utterance per activation, transcribed when the user stops speaking.

### Two integration points

**1. Notes field mic button (InspectPage)**

A microphone icon sits adjacent to the inspector notes textarea. Tapping it calls `startListening()`; when the transcript arrives, it is appended to the existing notes field value. This is scoped to notes input only — it does not interpret commands.

**2. Global VoiceCommandButton**

A floating action button rendered outside the route Layout (always visible after login). It activates a command-mode session using the same `useSpeechRecognition` hook.

### Custom event bus for cross-component communication

The VoiceCommandButton and InspectPage live in separate parts of the component tree. Commands that affect InspectPage state (e.g., "Equipment CAT-4821" → fill in the ID field) are dispatched via `window.dispatchEvent` with custom event types:

```typescript
// VoiceCommandButton dispatches:
window.dispatchEvent(new CustomEvent("sensill:voice-equipment", {
  detail: { equipmentId: "CAT-4821" }
}));

window.dispatchEvent(new CustomEvent("sensill:voice-submit"));

// InspectPage listens:
useEffect(() => {
  window.addEventListener("sensill:voice-equipment", handleVoiceEquipment);
  window.addEventListener("sensill:voice-submit", handleVoiceSubmit);
  return () => { /* cleanup */ };
}, []);
```

Navigation commands (`"Go home"`, `"Open dashboard"`) are handled directly in VoiceCommandButton via `useNavigate()`.

---

## 7. PWA + Service Worker

### Workbox configuration

Sensill uses `vite-plugin-pwa` with Workbox for service worker generation.

```typescript
VitePWA({
  registerType: "autoUpdate",
  workbox: {
    // Static assets: CacheFirst (long TTL, content-hashed filenames)
    runtimeCaching: [
      {
        urlPattern: /\.(js|css|png|svg|ico|woff2)$/,
        handler: "CacheFirst",
        options: { cacheName: "static-assets", expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 } }
      }
    ],
    // All API routes: NetworkOnly — never cache
    navigateFallback: "/index.html",
  }
})
```

### Why all API calls are NetworkOnly

A NetworkFirst or StaleWhileRevalidate strategy for API routes will cache error responses — 401 Unauthorized, 404 Not Found, 503 Service Unavailable. These cached error responses are then served on subsequent requests even when the server is healthy. This causes silent failures that are very hard to debug.

The correct strategy for all `/api/*` routes is NetworkOnly. If the network is unavailable, the app's own offline logic (IndexedDB queue) handles the fallback — the service worker should not attempt to cache or serve API responses.

### navigateFallback

All path routes (`/results`, `/history/CAT-4821`, `/report`, etc.) must serve `index.html` for React Router to handle client-side navigation. Two mechanisms ensure this:

1. `navigateFallback: "/index.html"` in Workbox config (for PWA installs)
2. `packages/web/public/_redirects` with `/*  /index.html  200` (for Cloudflare Pages direct navigation)

### Why localStorage, not sessionStorage, for inspection data

After an inspection completes, the worker result is stored client-side and the app navigates to `/results`. The `/report` route lives outside the main Layout component tree. In a PWA standalone session, navigating from `/results` to `/report` causes React to unmount the Layout context, which clears any state held in React context or component state.

`sessionStorage` is also cleared when the PWA navigates outside the route tree in some browsers. Using `localStorage` with a namespaced key (`sensill_last_inspection`) ensures the result survives any internal navigation and can be read when `/report` mounts.

---

## 8. Storage Architecture Summary

| What | Where | Key / path format | Lifetime |
|---|---|---|---|
| User credentials | KV: USERS | `user:{email}` | Persistent |
| Org record | KV: USERS | `org:{tenantId}` | Persistent |
| Invite code mapping | KV: USERS | `invite:{code}` | Persistent |
| Fleet dashboard cache | KV: CACHE | `fleet:{tenantId}:overview` | 30 days |
| Inspection photos | R2: PHOTOS | `{tenantId}/{equipmentId}/{timestamp}.{ext}` | Persistent |
| Inspection history + memory | Supermemory | Tagged documents | Persistent |
| Offline inspection queue | IndexedDB | UUID per item | Until synced |
| Current inspection result | localStorage | `sensill_last_inspection` | Manual clear |
| Auth token | localStorage | `sensill_token` | 30 days (JWT exp) |
