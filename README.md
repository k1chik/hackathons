# Sensill

**AI-powered equipment inspection with compounding institutional memory**

Live: [sensill.pages.dev](https://sensill.pages.dev) &nbsp;|&nbsp; Worker: [sensill-worker.kkukadia.workers.dev](https://sensill-worker.kkukadia.workers.dev)

The name comes from *sensilla* — the sensory organs on insect antennae that detect the world with precision. Every inspection adds another data point the system never forgets.

---

## The Problem

Heavy equipment failure costs $250,000+ per day in lost production. A single missed hydraulic fault on a CAT excavator can cascade into a full drivetrain replacement. The people who know the machine best — senior mechanics with years of field experience — retire or move on. Their knowledge walks out the door with them. Written inspection reports pile up in filing cabinets. By the time a maintenance manager notices a pattern, the damage is done.

The root issue is not lack of inspections. It is lack of **institutional memory**.

---

## What Sensill Does

Sensill is an AI-powered inspection tool for heavy machinery (CAT excavators, dozers, wheel loaders, and similar equipment). A field inspector opens the app, selects a unit, photographs a component, optionally dictates voice notes while wearing gloves, and submits. Within seconds they receive a structured inspection report.

That report is not just an image description. It is an analysis grounded in every prior inspection of that unit, plus fleet-wide failure patterns observed across similar machines. By inspection #50, the system carries institutional knowledge that no individual inspector could hold in their head.

**Inspection #1** gives you a snapshot.
**Inspection #50** gives you institutional knowledge.

The system can detect that a hydraulic cylinder is following the same failure progression it saw on a different unit six months before its hydraulic failure — and warn the inspector before the failure occurs.

Demo equipment ID: `CAT-4821` (pre-seeded with progressive failure history)

---

## Architecture

```
Field Inspector
      |
      | photo + voice notes + equipment ID
      v
+----------------------+        +------------------+
|  React PWA           |        |  IndexedDB Queue |
|  (Cloudflare Pages)  |------->|  (offline cache, |
|  mobile-first, dark  |        |   auto-syncs)    |
+----------------------+        +------------------+
      |
      | HTTPS / SSE stream
      v
+----------------------+
|  Cloudflare Worker   |
|  (edge, no cold      |
|  starts, JWT auth,   |
|  multi-tenant KV)    |
+----------------------+
      |
      |----------- parallel -----------+
      |                                |
      v                                v
+------------------+        +---------------------+
|  Supermemory v3  |        |  Supermemory v3     |
|  Search          |        |  Search             |
|  this unit's     |        |  fleet-wide failure |
|  full history    |        |  patterns for this  |
|                  |        |  equipment type     |
+------------------+        +---------------------+
      |                                |
      +---------- merge context -------+
                       |
                       v
             +------------------+
             |  Claude          |
             |  claude-sonnet-  |
             |  4-6             |
             |  photo (base64)  |
             |  + merged history|
             |  + fleet context |
             +------------------+
                       |
                       v
             structured JSON report
             (findings, severity,
              progression, score,
              pattern matches,
              immediate action flag)
                       |
             +---------+---------+
             |                   |
             v                   v
    Store to Supermemory    SSE stream
    (closes the loop;       to browser
    next inspection is      (inspector sees
    smarter)                results live)
             |
             v
    Photo -> R2 storage
    Score -> KV fleet cache
    (dashboard updates instantly)
```

**Storage layers:**

| Store | Purpose |
|---|---|
| Cloudflare R2 | Inspection photos, tenant-scoped key prefix |
| Cloudflare KV (CACHE) | Fleet health overview cache per tenant |
| Cloudflare KV (USERS) | User records for auth |
| Supermemory v3 | All completed inspection reports as searchable semantic documents |

---

## How AI Is Used

This section addresses the judging criterion directly: Sensill is not a wrapper around an image description API.

### Claude claude-sonnet-4-6 — Core Inspection Analysis

The Claude prompt is purpose-built and includes three distinct inputs:

1. **The photo** (base64, multimodal vision)
2. **Full inspection history for this specific unit** — every prior inspection report retrieved from Supermemory, in chronological order
3. **Fleet-wide failure patterns** — semantic search results for this equipment type across the entire tenant's fleet, surfacing what has gone wrong on similar machines

Claude's output is a structured JSON document, not prose:

```json
{
  "findings": [
    {
      "component": "hydraulic cylinder",
      "severity": "FAIR",
      "description": "Visible scoring on rod surface, 15mm length",
      "progressionSinceLastInspection": "scoring extended 8mm since 2024-11-12 inspection"
    }
  ],
  "historicalContext": {
    "type": "PATTERN_MATCH",
    "description": "Matches failure progression on CAT-2903 prior to hydraulic failure 2024-09-04",
    "referenceUnit": "CAT-2903",
    "referenceDate": "2024-09-04"
  },
  "recommendations": ["Schedule cylinder replacement within 200 operating hours"],
  "conditionScore": 5,
  "overallCondition": "FAIR",
  "immediateAction": false,
  "summary": "..."
}
```

The `historicalContext` field is what separates Sensill from a photo analyzer. Claude knows what the cylinder looked like three months ago. It knows what happened to a similar machine. It can quantify the progression.

### Supermemory v3 — Semantic Memory Layer

Each completed inspection report is stored as a document in Supermemory with `containerTags` for multi-tenant and equipment-level isolation:

```
containerTags: ["tenant:acme-mining", "equipment:CAT-3241"]
```

Before each new inspection, two searches run in parallel:

- `containerTags: ["tenant:acme-mining", "equipment:CAT-3241"]` — retrieves this unit's full history
- `containerTags: ["tenant:acme-mining", "equipmentType:CAT-329E"]` — retrieves fleet-wide failures for this machine type

Both result sets are merged and injected into the Claude prompt. The vector embedding layer means relevant history surfaces even when terminology varies across inspectors over time.

This creates a **self-reinforcing feedback loop**: every inspection makes future inspections smarter because the context grows.

### Web Speech API — Gloved-Hand Operation

Field inspectors often wear heavy gloves and have both hands occupied. The app uses the Web Speech API (Google's speech recognition engine in Chrome) for:

- Dictating inspection notes
- Global voice commands: navigate between screens, submit an inspection, set the equipment ID

Voice input is designed around industrial field conditions: ambient noise, PPE, time pressure.

---

## Why This Is Not a Simple Wrapper

- **The value proposition is the memory loop, not the AI.** Claude analyzing a single photo is commodity. Claude analyzing that same photo with six months of inspection history and fleet-wide failure context is not.
- **Offline-first architecture.** Inspections captured with no connectivity are stored in IndexedDB and auto-synced when connectivity returns. This is a hard requirement for construction sites and remote mining operations.
- **Multi-tenant isolation at every layer.** JWT claims carry `tenantId`. KV keys are prefixed by tenant. R2 keys are prefixed by tenant. Supermemory `containerTags` enforce per-tenant scoping. One tenant cannot access another's data.
- **SSE streaming.** Claude's analysis streams back to the browser via Server-Sent Events from a Cloudflare Worker. The inspector sees results incrementally.
- **Structured output as a contract.** The JSON schema is defined, validated, and stored back into memory. The loop closes on every inspection.
- **Purpose-built data pipeline.** The dual-search context injection system — specific equipment history plus fleet-wide type patterns — is an original design, not a configuration of an existing tool.

---

## Project Structure

```
packages/
  worker/
    src/index.ts            <- Cloudflare Worker: all API routes, auth, Claude, Supermemory
    wrangler.toml           <- Worker config, KV/R2 bindings, secrets reference
  web/
    src/
      pages/
        HomePage.tsx        <- Recent inspections, equipment search, pending banner
        InspectPage.tsx     <- Photo capture, voice notes, offline-aware submission
        ResultsPage.tsx     <- Analysis results, animated score ring, Memory Insights
        HistoryPage.tsx     <- Per-unit timeline, trend graph, expandable entries
        DashboardPage.tsx   <- Fleet health grid, critical units
        LoginPage.tsx       <- Email + password sign in
        SignupPage.tsx      <- Create org or join with invite code
        ReportPage.tsx      <- Print-friendly report layout
      components/
        Layout.tsx          <- App shell, bottom nav, auto-sync on reconnect
        ProtectedRoute.tsx  <- Auth guard, redirects to /login
        PendingBanner.tsx   <- Offline queue status + manual sync
        ProtectedImage.tsx  <- Auth-gated R2 photo fetcher
      context/
        AuthContext.tsx     <- JWT token state, login/logout
      lib/
        api.ts              <- API client, types, auth functions
        offlineQueue.ts     <- IndexedDB queue for offline inspections
        syncManager.ts      <- Retry loop, submits queued inspections on reconnect
        connectivity.ts     <- Real connectivity check (HEAD ping, not navigator.onLine)
scripts/
  seed-memory.js            <- Pre-seeds Supermemory with demo inspection history
  seed-tenants.js           <- Pre-creates demo org accounts in USERS KV
docs/
  FEATURES.md
  RUNBOOK.md
  USER-GUIDE.md
  engineering/
    ARCHITECTURE.md
    AUTH.md
    OFFLINE-CAPTURE.md
```

---

## Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, React Router, Framer Motion |
| Hosting | Cloudflare Pages |
| API | Cloudflare Workers (vanilla fetch router, no framework) |
| AI analysis | Claude claude-sonnet-4-6 (multimodal) |
| Semantic memory | Supermemory v3 |
| Photo storage | Cloudflare R2 |
| Fleet cache / Auth | Cloudflare KV |
| Offline queue | IndexedDB (idb) |
| Voice input | Web Speech API |
| Auth primitives | JWT + PBKDF2 via Web Crypto API |

---

## Setup and Deployment

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) authenticated with your Cloudflare account
- Node.js 18+
- Anthropic API key
- Supermemory API key

### 1. Provision infrastructure

```bash
wrangler kv namespace create CACHE
wrangler kv namespace create USERS
wrangler kv namespace create CACHE --preview
wrangler kv namespace create USERS --preview
wrangler r2 bucket create sensill-inspection-photos
```

Copy the namespace IDs printed by each command into `packages/worker/wrangler.toml`.

### 2. Set secrets

```bash
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put SUPERMEMORY_API_KEY
wrangler secret put JWT_SECRET
```

### 3. Install dependencies

```bash
npm install
```

### 4. Deploy the worker

```bash
cd packages/worker
wrangler deploy
```

### 5. Deploy the frontend

```bash
cd packages/web
npm run build
wrangler pages deploy dist
```

### 6. Local development

```bash
# Terminal 1 — worker
cd packages/worker && wrangler dev

# Terminal 2 — frontend
cd packages/web && npm run dev
```

---

## AI Tool Usage Disclosure

In accordance with hackathon requirements, the following documents where AI assistance was used during development of this project.

**Claude (claude.ai / Claude Code) — development assistance:**
Used for code generation assistance during development, including boilerplate for Cloudflare Worker routing patterns, React component scaffolding, and Tailwind utility suggestions. The core product logic — the dual-search context injection pipeline, the structured inspection prompt design, and the Supermemory storage schema — was designed and iterated on by the team.

**Claude claude-sonnet-4-6 API — production runtime:**
The AI model that performs equipment inspection analysis within the deployed app. This is a core component of the product, not a development tool.

**Supermemory v3 API — production runtime:**
Used for semantic storage and retrieval of inspection history. This is a core component of the product architecture.

The dual-search memory loop, offline sync architecture, multi-tenant isolation design, voice-first interaction model, and the system's self-reinforcing feedback loop are original work by the Sensill team.
