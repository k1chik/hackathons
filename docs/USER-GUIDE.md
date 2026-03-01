# Sensill — User Guide

Sensill is an AI-powered heavy equipment inspection app. Take a photo of any piece of equipment, get an instant condition report backed by the full history of that machine, and track how it changes over time. The app works in any browser and can be installed directly to your phone's home screen.

Live at: https://sensill.pages.dev

---

## 1. Installing the App

Sensill works in any browser, but installing it gives you a full-screen, offline-capable experience that behaves like a native app.

### iPhone (Safari)

1. Open https://sensill.pages.dev in Safari
2. Tap the Share button (box with upward arrow, bottom of the screen)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**

The Sensill icon will appear on your home screen. Tap it to open without browser chrome.

### Android (Chrome)

1. Open https://sensill.pages.dev in Chrome
2. Tap the three-dot menu (top right)
3. Tap **Add to Home Screen** or **Install app**
4. Tap **Install**

---

## 2. Creating Your Org / Joining a Team

### Create a new org

1. Open the app and tap **Sign Up**
2. Choose **Create a new org**
3. Enter your email, a password, and your organization name
4. Tap **Create**

Your org is created with a unique invite code. Tap your org name in the app header at any time to copy the invite code and share it with teammates.

### Join an existing org

1. Open the app and tap **Sign Up**
2. Choose **Join an org**
3. Enter your email, a password, and the 8-character invite code from your team lead
4. Tap **Join**

All members of the same org share the same fleet data and inspection history.

---

## 3. Running an Inspection

### Step 1 — Identify the equipment

In the Equipment ID field, enter the unit's ID (for example, `CAT-4821`).

**Tip: Use the QR scanner.** If the equipment has a QR code label, tap the QR icon next to the Equipment ID field. Hold your camera over the code — the ID fills in automatically. No typing required, which matters with gloves on.

**Tip: Use autocomplete.** If you've inspected this unit before, its ID will appear as a suggestion as you type. Tap it to confirm.

### Step 2 — Select equipment type

Pick the equipment type from the dropdown (336 Excavator, 950M Wheel Loader, D6 Dozer, etc.). This helps the AI apply the right failure patterns for the equipment category.

### Step 3 — Take a photo

Tap **Take Photo** to use your camera, or **Upload** to select an image from your device.

For best results:
- Photograph the specific component you're most concerned about (hydraulic cylinder, undercarriage, bucket teeth, etc.)
- Use good lighting — the AI can only analyze what it can see
- Get close enough that the detail is visible

### Step 4 — Add notes (optional but recommended)

The notes field captures things the camera can't see: unusual sounds, operating conditions, operator reports, what you noticed walking up to the machine.

**Use the mic button to dictate.** Tap the microphone icon next to the notes field and speak your observations. The transcript appears in the field. This works with gloves on and avoids one-finger typing.

### Step 5 — Tap Analyze

The app checks connectivity. If you have a signal, the inspection is submitted immediately. If you're offline, the inspection is saved and will be submitted automatically when connectivity returns.

---

## 4. Reading Your Results

### Condition Score

The ring at the top of the results screen shows the overall condition score (1-10). Higher is better.

| Score | Condition | What it means |
|---|---|---|
| 8-10 | GOOD | Normal wear, no concerns |
| 5-7 | FAIR | Monitor closely, schedule upcoming inspection |
| 3-4 | POOR | Plan maintenance soon |
| 1-2 | CRITICAL | Immediate action required |

### Immediate Action Alert

If a red banner appears at the top of the results, this equipment needs attention within 24 hours. Do not return it to service until a mechanic has reviewed it.

### AI Summary

A 2-3 sentence overview of findings, written for a site manager or service team lead.

### Memory Insights

This section appears when the equipment has prior inspection history. It shows two types of insights:

- **Progression Detected** — a specific component has changed since the last inspection. The AI says whether it improved or deteriorated.
- **Pattern Match** — the current condition matches a known failure pattern seen in another unit in your fleet. The reference unit and timeframe are shown so you can pull that case.

This is the most valuable section. It surfaces what would otherwise require an experienced inspector to recall from memory.

### Findings

Individual component assessments. Each finding shows:
- Component name with a colored severity dot
- Severity level: LOW / MEDIUM / HIGH / CRITICAL
- What was observed
- How it changed since the last inspection (if history exists)

### Recommendations

Prioritized action items. Item 1 is always the most urgent.

---

## 5. Voice Commands Reference

The floating microphone button (visible on all screens after login) lets you control the app without touching the screen.

| Say | What happens |
|---|---|
| "Go home" / "Home" | Navigates to the home screen |
| "Start inspection" / "Inspect" | Navigates to the inspection form |
| "Open dashboard" / "Fleet" | Navigates to the fleet dashboard |
| "Submit" / "Analyze" | Submits the inspection form (when on the inspect screen) |
| "Equipment [ID]" | Fills in the Equipment ID field (e.g. "Equipment CAT-4821") |

Voice commands require Chrome or Edge on Android or desktop. The Web Speech API is not supported in Firefox or Safari.

---

## 6. Offline Mode

### What happens when you lose signal

The app detects loss of connectivity using an active health-check ping, not just `navigator.onLine`. If the network is unreachable, your inspection is saved to the device's local storage (IndexedDB) rather than submitted.

You will see a "Saved for later" confirmation instead of the usual analysis screen.

### Checking queued inspections

A banner on the home screen shows how many inspections are queued and waiting to sync. It also has a **Submit now** button if you want to trigger sync manually.

### How sync works

Queued inspections are submitted automatically when:
- You open the app and connectivity is detected
- Your device comes back online (network event)
- You switch back to the app from another app

Each queued inspection is retried up to 3 times before being marked as failed. If the app crashes mid-submit, the item is reset to "pending" on next launch so it retries cleanly.

---

## 7. Fleet Dashboard

The dashboard (grid icon in the bottom navigation) shows your entire fleet at a glance.

- Each unit is a colored tile: green (GOOD), amber (FAIR), orange (POOR), red (CRITICAL)
- Units are sorted worst-first so critical equipment appears at the top
- The summary row shows counts by condition level and how many require immediate action
- Tap any unit tile to go directly to that unit's full inspection history

The dashboard data is cached and loads instantly — it does not require an AI call.

---

## 8. Downloading a Report

From any results screen, tap **Download Report** (or navigate to `/report` for a specific inspection). This opens a print-optimized white-background version of the full inspection report.

Use your browser's **Print** dialog (Cmd+P on Mac, Ctrl+P on Windows, or Share → Print on iOS) and select **Save as PDF** to save a copy.

---

## Tips for Good Inspections

- **Use the same Equipment ID every time.** The memory system only works if IDs are consistent. Standardize your format (`CAT-4821`, not `cat4821` or `CAT 4821`).
- **Inspect the specific component you're tracking.** If you're monitoring hydraulic wear, photograph the cylinder rod — not the whole machine.
- **Add notes for things the photo can't show.** Sounds, operating temperature, operator feedback. The AI incorporates these into its analysis.
- **Inspect regularly.** The system gets smarter with every inspection. Monthly inspections give the AI enough data to detect slow-developing issues before they become failures.
