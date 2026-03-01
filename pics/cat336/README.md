# CAT 336 Demo Images

Use these images to demonstrate Sensill's compounding memory value during a live demo.

---

## Setup (do this before the demo)

Submit `12.jpeg` under a **different unit ID** (e.g. `CAT-2903`) to pre-seed a fleet pattern in Supermemory. This makes the cross-unit pattern match fire during Inspections 3 and 4.

---

## Demo Sequence — use equipment ID `CAT-4821` for all

| Step | File | What it shows | Expected Claude output |
|---|---|---|---|
| Pre-seed | `12.jpeg` | Clean hydraulic cylinder | Submit as **CAT-2903** before demo — seeds fleet pattern |
| Inspection 1 | `1.jpeg` | Clean cab, near-new condition | GOOD (8/10) — no prior history, baseline established |
| Inspection 2 | `2.jpeg` | Full body, active job site, field wear | FAIR (6-7/10) — early wear noted, progression tracking begins |
| Inspection 3 | `3.jpeg` | Bucket teeth close-up, heavily rusted | POOR — progression detected across inspections, fleet pattern from CAT-2903 surfaces |
| Inspection 4 | `4.jpeg` | Cab burn/fire damage | CRITICAL — immediate action flag, full history and pattern match in output |

---

## The narrative

Each inspection builds on the last. By Inspection 3, Claude is no longer just looking at a photo — it's comparing against two prior inspections of this unit **and** surfacing a failure pattern from CAT-2903. By Inspection 4, it has the full context to say with confidence: *this unit needs attention now, and here's why.*

That's the compounding memory value. A tool that saw only `4.jpeg` in isolation would say "damage detected." Sensill says "this has been deteriorating since January, matches a prior fleet failure, and needs immediate action."
