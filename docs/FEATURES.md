# Sensill — Features Tracker

Current status of all product features. Live at https://sensill.pages.dev.

---

## Shipped

| Feature | Description |
|---|---|
| AI inspection with vision + memory context | Photo + inspector notes sent to Claude claude-sonnet-4-6 with full Supermemory context injected into the prompt |
| Compounding semantic memory (Supermemory) | Every inspection is stored and indexed; each new inspection retrieves the most relevant past records, making results smarter over time |
| Fleet health dashboard | Color-coded grid of all fleet units sorted worst-first; condition distribution summary and immediate-action count at the top |
| Equipment inspection history with trend visualization | Per-unit timeline with expandable entries, inspection photos, and an SVG score graph showing condition trajectory over time |
| QR code scanner (BarcodeDetector API) | Field inspectors can scan a QR code on equipment to auto-fill the Equipment ID field — no manual typing required |
| Voice-first notes (Web Speech API, glove-friendly) | Mic button on the notes field lets inspectors dictate observations hands-free; works with gloves; result transcribed directly into the notes field |
| Global voice command button (navigate + submit hands-free) | Floating mic button on all screens; accepts spoken commands to navigate, start an inspection, and submit — no screen taps needed |
| Offline inspection queue (IndexedDB, auto-syncs) | Inspections captured without connectivity are stored in IndexedDB and automatically submitted when the device comes back online |
| Multi-tenant auth (JWT + PBKDF2) | Org signup generates a `tenantId` and invite code; all data is isolated by `tenantId` across KV, R2, and Supermemory; JWT tokens verified on every request |
| Downloadable PDF-ready report | `/report` page renders a print-optimized white-background layout; browser print dialog produces a clean PDF |
| PWA (installable, dark theme) | Add-to-Home-Screen on iOS and Android; standalone display mode; dark high-contrast theme optimized for outdoor use |
| Photo storage (R2) | Inspection photos stored in Cloudflare R2 at `{tenantId}/{equipmentId}/{timestamp}.{ext}`; served via Worker with tenant access control |
| Equipment ID autocomplete | Previously inspected equipment IDs are suggested as the inspector types, reducing typos and ID inconsistencies |
| SSE streaming for inspection progress | Worker streams real-time progress events (memory retrieval, AI analysis, saving) so the UI reflects each pipeline stage as it completes |
| Memory Insights section | Results screen surfaces PROGRESSION and PATTERN_MATCH cards drawn from Supermemory — shows what the AI remembered from prior inspections |
| Condition score ring | Animated SVG arc on results screen; score (1-10) and ring color reflect condition level (GOOD / FAIR / POOR / CRITICAL) |

---

## In Progress / Next

- **Video inspection support** — submit a short clip instead of a still photo; extract key frames for analysis
- **Push notifications when queue syncs** — notify inspector when offline-queued inspections have been processed and results are ready
- **Per-user accounts within org** — currently one shared login per org; future: individual logins tied to the same `tenantId`
- **CAT service integration** — push inspection findings directly to CAT's dealer service scheduling API

---

## Infrastructure Notes

- Edge API: Cloudflare Workers (single `packages/worker/src/index.ts`)
- Frontend: Cloudflare Pages (React + Vite + Tailwind)
- Auth store + fleet cache: Cloudflare KV (`USERS` + `CACHE` namespaces)
- Photo storage: Cloudflare R2 (`sensill-inspection-photos` bucket)
- Semantic memory: Supermemory v3 API (`containerTags` for tenant + equipment isolation)
- AI vision: Claude claude-sonnet-4-6 via Anthropic API
- Offline queue: IndexedDB via `idb` library
- GitHub: https://github.com/3lizabethgu0/Sensill
