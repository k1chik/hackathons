# Sensill — Feature Backlog

Ordered by effort vs. value. Each item includes a branch workflow and implementation notes.
Nothing here changes core functionality — these round out what's already built.

**Branch workflow for every item:**
```
git checkout -b feat/<name>
# implement + test locally (wrangler dev + npm run dev)
# submit one inspection end-to-end to confirm nothing broke
git push -u origin feat/<name>
# open PR → review → merge to main
```

---

## Tier 0 — Judge bait (< 1 hour each, maximum visual impact)

These items exist purely to make a CAT judge's jaw drop. They require zero backend changes.

### 0. Downtime Cost Estimate on Results Page
**Branch:** `feat/downtime-cost-banner`

When a unit comes back CRITICAL or POOR, show the financial stakes right on the result. CAT judges think in dollars per day — give them the number.

**How:**
- Add a cost banner in `ResultsPage.tsx` below the condition badge, visible only for POOR and CRITICAL results
- Pure frontend calculation based on `conditionScore`:
  - CRITICAL (≤3): `"Estimated production loss if unaddressed: $5,000–$15,000/day"`
  - POOR (4–5): `"Estimated production loss if unaddressed: $1,500–$5,000/day"`
- Figures are grounded in CAT 336-class data: all-in operating rate $250–$400/hr; construction downtime $1,500–$3,500/day; mining/production use $5,000–$10,000+/day (Equipment World, Construction Equipment, ForConstructionPros)
- If challenged: cite the $250–$400/hr all-in rate × 8-hr shift + idle crew + schedule penalties. The math is solid.
- Style: amber/red banner with a `$` icon, subtle not alarming

**Files touched:** `ResultsPage.tsx` only (~15 lines)
**Cost:** Free. Zero backend. Pure string + conditional render.
**Wow factor:** Extremely high — directly speaks the language of the buyer.

---

### 00. Fleet Health Score on Dashboard
**Branch:** `feat/fleet-health-score`

Instead of a list of individual unit scores, show one number at the top: the fleet's overall health. A single 0–100 score that moves. Managers love a single number to anchor on.

**How:**
- Compute in `DashboardPage.tsx` from already-loaded fleet array: weighted average of `conditionScore` across all units (weight CRITICAL units 2x)
- Display prominently above the unit list: large number, color-coded (green/amber/red), label "Fleet Health"
- Optional: small label "X units need attention" below the score (count of POOR + CRITICAL)

**Files touched:** `DashboardPage.tsx` only (~20 lines)
**Cost:** Free. All math on already-loaded data.
**Wow factor:** High — first thing a judge sees on the dashboard screen.

---

### 000. Predicted Failure Window on POOR/CRITICAL
**Branch:** `feat/failure-window`

When the AI returns POOR or CRITICAL with progression data, show a plain-English prediction: "Based on current progression: estimated 3–6 weeks to failure." Makes the urgency concrete and time-bound.

**How:**
- In `ResultsPage.tsx`, check if `memoryInsights` contains a `PROGRESSION` type insight
- If yes and condition is POOR: render `"Estimated time to failure: 4–8 weeks based on progression rate"`
- If yes and condition is CRITICAL: render `"Estimated time to failure: 1–3 weeks — immediate action recommended"`
- If no progression data: show nothing (don't fabricate)
- Style: inside the Memory Insights section, visually distinct (clock icon, amber text)

**Files touched:** `ResultsPage.tsx` only (~20 lines)
**Cost:** Free. Uses data already returned by Claude.
**Wow factor:** Very high — turns abstract AI output into a deadline.

---

### 0000. Full Voice Mode (Glove-Friendly Operation)
**Branch:** `feat/voice-mode`

Inspectors wearing gloves can't type. One tap activates a persistent voice listener — all fields, navigation, and submission are then fully hands-free. The photo tap is the only unavoidable touch. Directly addresses the "real-world use" question every judge asks.

**Works on:** Chrome Mac ✅ (demo environment), Chrome Android ✅, Safari iOS ✅ (14.5+)
**Requires:** HTTPS (covered by `sensill.pages.dev`) + microphone permission pre-approved in browser

**Demo flow (after implementation):**
```
Inspector taps mic icon once
  → App says: "Voice mode on. Say your Equipment ID."
Inspector: "Equipment ID CAT-4821"
  → Field fills, app says: "Got it. Say equipment type."
Inspector: "CAT 336 Excavator"
  → Dropdown selects, app says: "Ready. Take your photo."
Inspector taps camera (one unavoidable tap)
  → App says: "Photo received. Add a note or say submit."
Inspector: "Note: hydraulic cylinder showing scoring on the rod"
  → Notes field fills, app says: "Got it. Say submit when ready."
Inspector: "Submit"
  → Inspection submits, results stream in
```

**How — Implementation:**

**Step 1: New hook `useVoiceMode.ts`** (~60 lines)
```ts
// packages/web/src/hooks/useVoiceMode.ts
// Wraps window.SpeechRecognition in continuous mode
// Exposes: { active, toggle, lastCommand }
// Calls onCommand(command: string) callback on each recognised phrase
// Uses SpeechSynthesis to speak confirmation after each command
```
- Use `recognition.continuous = true` and `recognition.interimResults = false`
- Restart automatically on `recognition.onend` if still active (Chrome stops after silence)
- Speak confirmations via `window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`

**Step 2: Command parser** (inside the hook, ~30 lines)
```ts
function parseCommand(transcript: string): VoiceCommand | null {
  const t = transcript.toLowerCase().trim();
  if (t.startsWith("equipment id")) return { type: "SET_ID",   value: t.replace("equipment id", "").trim().toUpperCase() };
  if (t.startsWith("note"))         return { type: "SET_NOTE", value: t.replace(/^(add )?note\s*/,"") };
  if (t === "submit" || t === "submit inspection") return { type: "SUBMIT" };
  if (t === "dashboard")            return { type: "NAVIGATE", value: "/" };
  if (t === "new inspection")       return { type: "NAVIGATE", value: "/inspect" };
  // Equipment type: fuzzy match against known types array
  const matchedType = EQUIPMENT_TYPES.find(et => t.includes(et.toLowerCase()));
  if (matchedType) return { type: "SET_TYPE", value: matchedType };
  return null;
}
```

**Step 3: Wire into `InspectPage.tsx`** (~20 lines added)
- Call `useVoiceMode({ onCommand })` where `onCommand` maps `SET_ID` → `setEquipmentId`, etc.
- `SUBMIT` command programmatically fires the submit handler

**Step 4: Global mic toggle button in `Layout.tsx`** (~10 lines)
- Persistent mic button in the bottom nav bar (visible on all pages)
- Pulsing amber ring when active — immediately obvious to the audience
- Tap to toggle on/off

**Files touched:**
- New: `packages/web/src/hooks/useVoiceMode.ts` (~90 lines)
- `packages/web/src/pages/InspectPage.tsx` (~20 lines)
- `packages/web/src/components/Layout.tsx` (~10 lines)
- Optional: `packages/web/src/pages/DashboardPage.tsx` for navigation commands (~5 lines)

**Cost:** Free. Web Speech API — zero new dependencies, zero backend.
**Effort:** ~3-4 hours
**Wow factor:** Extremely high — the most visceral demo moment on the list. A gloved inspector talking to a phone and getting AI results is unforgettable.

**Pre-demo checklist for Chrome Mac:**
```
□ Visit sensill.pages.dev in Chrome
□ Chrome → Settings → Privacy → Site Settings → Microphone → Allow sensill.pages.dev
□ Test voice mode in the actual demo room (background noise check)
□ Speak clearly, pause 0.5s before each command
```

---

### 00000. Inspector Sign-Off Field
**Branch:** `feat/inspector-signoff`

Add Name and Role fields before submitting. Adds enterprise legitimacy. Cheap signal that this is production-ready, not a demo toy.

**How:**
- Add two optional fields to `InspectPage.tsx` above the Submit button: Inspector Name (text), Role (dropdown: Inspector / Senior Inspector / Supervisor)
- On submit, include in the form payload
- Worker: include in the Supermemory document metadata (already a free-form object)
- Results page: show "Inspected by [Name] · [Role]" in the header area

**Files touched:** `InspectPage.tsx`, `ResultsPage.tsx`, minor `index.ts` (add fields to payload) (~30 lines total)
**Cost:** Free.
**Wow factor:** Medium-high — makes it feel like enterprise software immediately.

---

## Tier 1 — Tiny effort, immediate value (< 2 hours each)

### 1. Speech-to-Text for Inspector Notes
**Branch:** `feat/speech-to-notes`

Inspectors in the field often have gloves on or dirty hands. Tapping a mic and talking is faster than typing.

**How:**
- Web Speech API — browser-native, zero cost, zero backend changes
- Mic button next to the Inspector Notes textarea in `InspectPage.tsx`
- Tap to start → text appears live as they speak → tap to stop
- Pulsing mic icon while recording so the state is obvious
- Graceful fallback: hide the button if `window.SpeechRecognition` is not available

**Files touched:** `InspectPage.tsx` only (~30 lines)
**Cost:** Free. No new dependencies.
**Works on:** Chrome Android ✅, Safari iOS ✅ (14.5+), Firefox ❌ (hide button silently)

---

### 2. Remember Equipment Type per Unit
**Branch:** `feat/remember-equipment-type`

If an inspector always inspects CAT-1303 as "CAT 336 Excavator", they shouldn't have to select it every time.

**How:**
- On successful inspection submit, write to localStorage: `sensill_eq_type:{equipmentId}` → `equipmentType`
- On InspectPage, when `equipmentId` changes (on blur), read from localStorage and pre-fill the dropdown
- Show a subtle "Remembered from last time" label so it's clear it was auto-filled

**Files touched:** `InspectPage.tsx` only (~15 lines)
**Cost:** Free. localStorage only.

---

### 3. "Last Inspected" Lookup on Inspect Page
**Branch:** `feat/last-inspected-hint`

When an inspector types an equipment ID, show when it was last inspected and its last condition score. Prevents duplicate inspections and gives context before submitting.

**How:**
- On `equipmentId` blur, call `getFleet()` (already implemented, cached in KV) or use fleet data already loaded on HomePage and passed via state
- Show a small badge below the Equipment ID field: `Last: FAIR (6/10) · 3 weeks ago`
- If no history: show nothing (first inspection)

**Files touched:** `InspectPage.tsx`, `api.ts` (maybe) (~25 lines)
**Cost:** Free. Uses existing fleet KV cache — no new API call if fleet data is already in memory.

---

### 4. Equipment ID Autocomplete from Fleet
**Branch:** `feat/equipment-id-autocomplete`

Inspectors often inspect the same units. Showing known IDs as they type avoids typos and speeds up entry.

**How:**
- On InspectPage mount, call `getFleet()` to get known unit IDs
- On Equipment ID input change, show a small dropdown of matching IDs from the fleet list
- Tap to select — fills ID and triggers equipment type memory lookup (#2 above)
- Dismiss on tap outside

**Files touched:** `InspectPage.tsx` only (~40 lines)
**Cost:** Free. Uses existing fleet KV cache.

---

### 5. Haptic Feedback on Submit Success
**Branch:** `feat/haptic-feedback`

A brief vibration confirms the inspection was submitted — especially useful when the screen is hard to see in bright sunlight.

**How:**
- After successful inspection result arrives, call `navigator.vibrate(200)`
- One line in `InspectPage.tsx` inside the success handler
- `navigator.vibrate` is silently ignored on unsupported devices

**Files touched:** `InspectPage.tsx` (~1 line)
**Cost:** Free. Zero effort.

---

## Tier 2 — Low effort, meaningful value (2–4 hours each)

### 6. Condition Trend Arrow on Fleet Dashboard
**Branch:** `feat/fleet-trend-arrows`

The dashboard shows current condition scores but not direction. A ↑↓→ arrow next to each unit tells a manager at a glance whether things are getting better or worse.

**How:**
- The fleet cache already stores the latest `conditionScore`
- Equipment history (from Supermemory via `getEquipmentHistory`) has previous scores
- Compute trend on the dashboard: if last 2 scores go up → ↑ green, down → ↓ red, same → → grey
- Alternatively: store `previousConditionScore` in the KV fleet cache at inspection time (worker change, small)

**Files touched:** `DashboardPage.tsx`, optionally `index.ts` (worker, small KV write change)
**Cost:** Free.

---

### 7. Filter Chips on Fleet Dashboard
**Branch:** `feat/fleet-filters`

Currently all units are shown sorted worst-first. Adding filter chips (ALL · CRITICAL · POOR · FAIR · GOOD) lets managers focus on what matters.

**How:**
- Frontend state only — `filterCondition` state variable in `DashboardPage.tsx`
- Filter chip row above the units list
- Filter applied to the already-loaded fleet array — no API call
- Active chip highlighted in CAT yellow

**Files touched:** `DashboardPage.tsx` only (~40 lines)
**Cost:** Free. Pure frontend state.

---

### 8. Copy Report as Text
**Branch:** `feat/copy-report`

Inspectors often need to paste findings into a maintenance ticket, email, or WhatsApp. A "Copy" button that puts the full report as formatted text in the clipboard saves manual typing.

**How:**
- Add a "Copy report" button to `ResultsPage.tsx` next to the existing Share button
- Use Clipboard API: `navigator.clipboard.writeText(formattedReport)`
- Format: plain text markdown — equipment ID, condition, findings, recommendations, summary
- "Copied!" confirmation for 2s (already have this pattern in Layout for invite code)

**Files touched:** `ResultsPage.tsx` only (~25 lines)
**Cost:** Free. Clipboard API is universal.

---

### 9. Password Reset via Email
**Branch:** `feat/password-reset`

Currently there's no recovery path if a user forgets their password. Blocks real-world adoption.

**How:**
- Use [Resend](https://resend.com) (free tier: 100 emails/day) — one-line email send from a Worker
- Worker: `POST /api/auth/forgot-password` → generate a time-limited reset token (UUID, store in KV with 1hr TTL) → send email with reset link
- Worker: `POST /api/auth/reset-password` → verify token from KV → update password hash → delete token
- Frontend: forgot password link on LoginPage → simple email input form → confirmation screen

**Files touched:** `index.ts` (2 new routes), `LoginPage.tsx`, new `ResetPasswordPage.tsx`, `wrangler.toml` (RESEND_API_KEY secret)
**Cost:** Free on Resend's free tier for hackathon scale.
**Effort:** Half day — most complex item on this list.

---

## Notes

- Items 1–5 can be done in any order and are completely independent
- Items 1 + 2 + 3 together make the InspectPage feel fully polished
- Item 9 (password reset) is the only one that requires a new external service
- None of these touch core inspection logic, Supermemory, or Claude
