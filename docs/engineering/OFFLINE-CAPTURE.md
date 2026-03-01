# Engineering Design: Offline Capture

**Branch:** `feat/offline-capture`
**Status:** ✅ Shipped
**Depends on:** `feat/auth` — inspections must be associated with a tenantId before submission
**Blocks:** Nothing

---

## Problem

Field inspectors work in mines, quarries, and construction sites — environments with unreliable or no mobile data. Currently, if an inspector submits a photo in a dead zone, the request fails and the inspection is lost. They must either wait for connectivity or give up. This breaks the core workflow and erodes trust in the app.

---

## Goals

- Inspector can capture and queue an inspection with no internet connection
- Queued inspections show in a "Pending" list so the inspector knows they're saved
- When connectivity returns, inspections are submitted automatically (background sync)
- Photos stored locally until submitted — not lost if the app is closed
- Works on iOS and Android

## Non-Goals

- Offline viewing of existing inspection results (future — would require caching API responses)
- Offline fleet dashboard (future)
- Conflict resolution if the same equipment is inspected twice offline (last-write-wins is acceptable)
- Offline-first architecture (we only need capture, not full offline capability)

---

## Architecture

### Storage Strategy

Offline inspections are stored in **IndexedDB** (via the `idb` library for a cleaner API). `localStorage` is too small for base64 images (can be 3-5MB each). IndexedDB supports up to several GB.

```
IndexedDB: sensill-offline-db
  object store: pending-inspections
    key: uuid
    value: {
      id: uuid,
      queuedAt: ISO string,
      tenantId: string,      ← from JWT at time of capture
      equipmentId: string,
      equipmentType: string,
      imageBase64: string,   ← full base64 photo
      mediaType: string,
      inspectorNotes: string | undefined,
      status: "pending" | "submitting" | "failed"
    }
```

### Submission Strategy

Two mechanisms — both needed:

**1. Online event listener (immediate)**
When the browser fires `window.addEventListener("online", ...)`, flush the queue immediately. This covers the case where the inspector captures offline and walks back to coverage.

**2. Background Sync API (when app is closed)**
Service worker registers a `sync` event with the tag `"submit-inspections"`. The OS wakes the service worker when connectivity returns, even if the app is closed.

```js
// Register sync when a new inspection is queued:
const reg = await navigator.serviceWorker.ready;
await reg.sync.register("submit-inspections");

// Service worker handles it:
self.addEventListener("sync", (event) => {
  if (event.tag === "submit-inspections") {
    event.waitUntil(submitPendingInspections());
  }
});
```

**Note:** Background Sync is supported on Chrome/Android. On iOS (Safari), it's not available — inspections are submitted when the user next opens the app and is online.

### Connectivity Detection

Don't rely on `navigator.onLine` alone — it can be true even with no real connectivity (connected to WiFi with no internet). Use a lightweight ping:

```ts
async function isOnline(): Promise<boolean> {
  try {
    await fetch("/api/health", { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}
```

---

## Data Flow

### Capture path (always the same, online or offline)

```
InspectPage: user fills form + takes photo
  ↓
"Analyze" button tapped
  ↓
isOnline()?
  YES → submit immediately (existing flow) → navigate to /results
  NO  → save to IndexedDB with status "pending"
        → show "Saved for later" toast
        → navigate back to home (not /results — no result yet)
        → register background sync
```

### Sync path

```
connectivity returns (online event or background sync wakes service worker)
  ↓
read all { status: "pending" } from IndexedDB
  ↓
for each, in order of queuedAt:
  → set status = "submitting"
  → POST /api/inspect (existing endpoint — no changes needed)
  → on success:
      → delete from IndexedDB
      → show push notification: "CAT-4821 inspection complete — FAIR (6/10)"
  → on failure:
      → set status = "failed", increment retryCount
      → retry up to 3 times with exponential backoff
      → after 3 failures: leave as "failed", alert user
```

---

## API Changes

No changes to the Worker API. The offline queue submits to the existing `POST /api/inspect` endpoint with the same payload format. The JWT from `localStorage` is still valid (30-day expiry) when the inspection is eventually submitted.

**Edge case:** Token expired by the time sync runs (user offline for 30+ days). The submission will get `401`. Handle by:
1. Showing "Sign in again to submit pending inspections" in the UI
2. Not deleting the queued inspection — it stays pending until the user re-authenticates

---

## Frontend Changes

### New: `src/lib/offlineQueue.ts`

```ts
import { openDB } from "idb";

const DB_NAME = "sensill-offline-db";
const STORE = "pending-inspections";

export interface PendingInspection {
  id: string;
  queuedAt: string;
  tenantId: string;
  equipmentId: string;
  equipmentType: string;
  imageBase64: string;
  mediaType: string;
  inspectorNotes?: string;
  status: "pending" | "submitting" | "failed";
  retryCount: number;
}

export async function queueInspection(params: Omit<PendingInspection, "id" | "queuedAt" | "status" | "retryCount">): Promise<string>
export async function getPendingInspections(): Promise<PendingInspection[]>
export async function updateStatus(id: string, status: PendingInspection["status"]): Promise<void>
export async function removeInspection(id: string): Promise<void>
```

### New: `src/lib/syncManager.ts`

```ts
export async function syncPendingInspections(): Promise<void>
// Reads queue, submits each, updates status, triggers notifications
```

### Modified: `src/pages/InspectPage.tsx`

```ts
// On form submit:
const online = await isOnline();
if (!online) {
  await queueInspection({ tenantId, equipmentId, ... });
  await registerBackgroundSync();
  toast("Inspection saved — will submit when online");
  navigate("/");
  return;
}
// ... existing submit flow
```

### New: `src/components/PendingBanner.tsx`

Shown on HomePage when there are pending inspections:

```
┌─────────────────────────────────────────┐
│ 2 inspections pending (offline)          │
│ Will submit automatically when online    │
│                           [Submit now →] │
└─────────────────────────────────────────┘
```

### Modified: Service Worker (Vite PWA config)

Add `sync` event handler for background sync:

```js
self.addEventListener("sync", (event) => {
  if (event.tag === "submit-inspections") {
    event.waitUntil(
      // import and call syncManager from SW context
    );
  }
});
```

Note: Service workers can't import ES modules directly — the sync logic needs to be either in the SW bundle or communicated via `postMessage` to an open client.

---

## Dependencies

```bash
# In packages/web:
npm install idb   # lightweight IndexedDB wrapper (~1.7kB gzipped)
```

---

## Infrastructure

No Worker or KV changes. The offline queue is entirely client-side until submission.

---

## Implementation Order

1. `idb` dependency install
2. `src/lib/offlineQueue.ts` — IndexedDB CRUD helpers
3. `src/lib/syncManager.ts` — submission loop with retry
4. `src/lib/connectivity.ts` — `isOnline()` ping helper
5. Modify `InspectPage.tsx` — branch on connectivity before submit
6. `src/components/PendingBanner.tsx` — show pending count on HomePage
7. Service worker: `sync` event handler for background sync
8. Service worker: register sync tag when inspection is queued
9. Push notification on successful sync (if push notifications are implemented)

---

## Testing

| Test | How |
|---|---|
| Capture offline | Chrome DevTools → Network → Offline. Fill form, submit. Check IndexedDB for pending record. |
| Auto-sync on reconnect | While offline, queue inspection. Re-enable network. Verify submission fires and record removed from IndexedDB. |
| App closed sync | Queue offline. Close app. Re-enable network. Open app — verify sync completed. |
| Token expiry handling | Queue offline. Manually expire token in localStorage. Re-enable network. Verify "sign in again" error shown, inspection not lost. |
| Retry on failure | Mock worker returning 500. Verify retryCount increments and inspection stays in queue. |
| Multiple queued | Queue 3 offline inspections. Re-enable. Verify all 3 submitted in order. |
| iOS (no background sync) | On Safari iOS: queue offline, re-open app online, verify auto-submit on app open. |
| PendingBanner | Home page shows banner when queue has items, disappears when empty. |

---

## Open Questions

- **Image storage size:** base64 images are ~1.3x the original file size. A 5MP photo at 5MB = ~6.5MB in IndexedDB per inspection. If the inspector captures 10 offline, that's 65MB. Mobile browsers typically allow 50-500MB of IndexedDB. We should add a warning or compress images (to JPEG quality 70%) before queuing.
- **Queue order:** Should offline inspections for the same unit be submitted in strict `queuedAt` order? Yes — otherwise inspection history could appear out of sequence in Supermemory.
- **Result visibility:** After sync, where do the results go? Option A: push notification with score. Option B: a "Completed" section on the home page showing results of recently synced inspections. Depends on whether push notifications are implemented.
- **Service worker scope:** The Vite PWA plugin generates the service worker — we need to understand how to add custom event handlers without the plugin overwriting them.
