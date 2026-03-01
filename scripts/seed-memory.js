#!/usr/bin/env node

/**
 * Sensill Demo Seed Script
 * Pre-populates Supermemory with realistic inspection history to power the
 * demo narrative: progressive deterioration + cross-unit pattern matching.
 *
 * Usage: SUPERMEMORY_API_KEY=your_key node scripts/seed-memory.js
 */

const SUPERMEMORY_BASE = "https://api.supermemory.ai/v3";
const API_KEY = process.env.SUPERMEMORY_API_KEY;

if (!API_KEY) {
  console.error("❌ SUPERMEMORY_API_KEY environment variable required");
  console.error("   Usage: SUPERMEMORY_API_KEY=your_key node scripts/seed-memory.js");
  process.exit(1);
}

async function addMemory(content, containerTags, metadata) {
  // Correct endpoint: POST /v3/documents with containerTags (not tags)
  const res = await fetch(`${SUPERMEMORY_BASE}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, containerTags, metadata }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.id;
}

const INSPECTIONS = [
  // ─────────────────────────────────────────────────────────
  // CAT-2903: Full failure story (this is the reference case)
  // ─────────────────────────────────────────────────────────
  {
    content: `## Inspection Record - 2024-12-10T08:00:00Z
Equipment ID: CAT-2903
Overall Condition: GOOD (Score: 8/10)
Immediate Action Required: No

### Findings:
- Hydraulic Cylinder (LOW): Minor surface scoring on rod. Depth <0.2mm. Within spec.
- Lift Arms (LOW): Normal wear at pin connections.
- Tires (LOW): 70% tread remaining, even wear pattern.

### Summary:
950M Wheel Loader in good operational condition. Minor hydraulic cylinder scoring noted but within acceptable tolerances. Standard maintenance schedule appropriate.

### Recommendations:
- Continue standard 500-hour maintenance schedule
- Monitor hydraulic cylinder rod condition at next inspection
- No immediate action required`,
    containerTags: ["tenant:acme-mining", "equipment:cat-2903", "type:wheel_loader", "condition:good"],
    metadata: {
      equipmentId: "CAT-2903",
      equipmentType: "950M Wheel Loader",
      timestamp: "2024-12-10T08:00:00Z",
      overallCondition: "GOOD",
      conditionScore: "8",
      immediateAction: "false",
      tenantId: "acme-mining",
    },
  },
  {
    content: `## Inspection Record - 2025-01-28T09:15:00Z
Equipment ID: CAT-2903
Overall Condition: FAIR (Score: 6/10)
Immediate Action Required: No

### Findings:
- Hydraulic Cylinder (MEDIUM): Scoring progressed. Rod shows Stage 1 wear pattern — longitudinal scoring 0.4mm depth. No active leakage. [Progression: Worsened from minor scoring to Stage 1 since December 2024]
- Bucket Edge (MEDIUM): 50% wear. Schedule replacement at next major service.
- Hydraulic Oil (LOW): Slight discoloration. Contamination test recommended.

### Summary:
Hydraulic cylinder wear is progressing and requires closer monitoring. Stage 1 wear pattern developing on rod surface. Unit remains operational but trending downward. Increase inspection frequency.

### Recommendations:
- Schedule Stage 1 hydraulic cylinder assessment
- Hydraulic oil sample for contamination analysis
- Replace bucket cutting edge at next service
- Move to monthly inspection cycle`,
    containerTags: ["tenant:acme-mining", "equipment:cat-2903", "type:wheel_loader", "condition:fair"],
    metadata: {
      equipmentId: "CAT-2903",
      equipmentType: "950M Wheel Loader",
      timestamp: "2025-01-28T09:15:00Z",
      overallCondition: "FAIR",
      conditionScore: "6",
      immediateAction: "false",
      tenantId: "acme-mining",
    },
  },
  {
    content: `## Inspection Record - 2025-03-05T07:30:00Z
Equipment ID: CAT-2903
Overall Condition: CRITICAL (Score: 2/10)
Immediate Action Required: Yes

### Findings:
- Hydraulic Cylinder (CRITICAL): Stage 2 failure. Rod scoring 1.2mm depth. Active hydraulic leak confirmed — 0.5 liters/hour loss rate. Cylinder seal failure imminent. [Progression: Stage 1 → Stage 2 failure in 5 weeks]
- Hydraulic System (HIGH): Low fluid level due to leak. Risk of pump cavitation.
- Bucket (HIGH): Dropped unexpectedly during operation due to hydraulic loss — safety incident.

### Summary:
CRITICAL FAILURE. Hydraulic cylinder stage 2 failure with active leak. Unit grounded immediately. Requires full hydraulic cylinder replacement and system flush. Safety incident logged due to unexpected bucket drop.

### Recommendations:
- IMMEDIATE: Ground unit — DO NOT OPERATE
- Full hydraulic cylinder replacement required
- Complete hydraulic system flush and refill
- Safety incident report filed
- Root cause analysis of seal failure progression`,
    containerTags: ["tenant:acme-mining", "equipment:cat-2903", "type:wheel_loader", "condition:critical", "failure:hydraulic"],
    metadata: {
      equipmentId: "CAT-2903",
      equipmentType: "950M Wheel Loader",
      timestamp: "2025-03-05T07:30:00Z",
      overallCondition: "CRITICAL",
      conditionScore: "2",
      immediateAction: "true",
      tenantId: "acme-mining",
    },
  },
  {
    content: `## Inspection Record - 2025-04-20T10:00:00Z
Equipment ID: CAT-2903
Overall Condition: GOOD (Score: 8/10)
Immediate Action Required: No

### Findings:
- Hydraulic Cylinder (LOW): New cylinder installed. No scoring. All seals intact.
- Hydraulic System (LOW): Flushed and refilled. Contamination cleared.
- Bucket (LOW): New cutting edge installed.

### Summary:
Post-maintenance inspection. Full hydraulic cylinder replacement completed. System flushed. All systems nominal. Unit returned to service.

### Inspector Notes:
Root cause confirmed: original cylinder rod had manufacturing surface roughness outside spec. This creates accelerated scoring under high-cycle hydraulic load. Pattern: minor scoring → Stage 1 (6-8 weeks) → Stage 2 failure (4-6 weeks). Total time from first observation to failure: ~12 weeks. Watch for same pattern in other units.`,
    containerTags: ["tenant:acme-mining", "equipment:cat-2903", "type:wheel_loader", "condition:good", "maintenance:hydraulic_replacement"],
    metadata: {
      equipmentId: "CAT-2903",
      equipmentType: "950M Wheel Loader",
      timestamp: "2025-04-20T10:00:00Z",
      overallCondition: "GOOD",
      conditionScore: "8",
      immediateAction: "false",
      tenantId: "acme-mining",
    },
  },

  // ─────────────────────────────────────────────────────────
  // CAT-4821: Current active case — same pattern developing
  // ─────────────────────────────────────────────────────────
  {
    content: `## Inspection Record - 2025-09-15T08:00:00Z
Equipment ID: CAT-4821
Overall Condition: GOOD (Score: 8/10)
Immediate Action Required: No

### Findings:
- Hydraulic Cylinder (LOW): Minor surface scoring observed on cylinder rod. Depth <0.2mm. Within tolerances.
- Boom Arm (LOW): Light paint wear at pivot points. Cosmetic only.
- Tracks (LOW): 85% remaining. Normal wear.

### Summary:
336 Excavator in good working condition. Minor hydraulic cylinder scoring noted — within acceptable range. No maintenance action required at this time.

### Recommendations:
- Continue standard maintenance schedule
- Monitor hydraulic cylinder rod at next inspection`,
    containerTags: ["tenant:acme-mining", "equipment:cat-4821", "type:336_excavator", "condition:good"],
    metadata: {
      equipmentId: "CAT-4821",
      equipmentType: "336 Excavator",
      timestamp: "2025-09-15T08:00:00Z",
      overallCondition: "GOOD",
      conditionScore: "8",
      immediateAction: "false",
      tenantId: "acme-mining",
    },
  },
  {
    content: `## Inspection Record - 2025-11-20T09:30:00Z
Equipment ID: CAT-4821
Overall Condition: FAIR (Score: 6/10)
Immediate Action Required: No

### Findings:
- Hydraulic Cylinder (MEDIUM): Scoring has progressed. Stage 1 wear pattern — longitudinal scoring 0.45mm depth. No leakage detected yet. [Progression: Worsened from minor to Stage 1 since September 2025. NOTE: This matches the early progression pattern observed in CAT-2903 before its March 2025 failure]
- Bucket Teeth (MEDIUM): 40% wear on cutting edge. Replacement due at next major service.
- Undercarriage (LOW): Track tension within spec. Sprocket wear normal.

### Summary:
Hydraulic cylinder wear is following a similar progression to CAT-2903's pre-failure pattern. Stage 1 wear detected. Unit operational but requires heightened monitoring. Recommend scheduling hydraulic inspection within 30 days.

### Recommendations:
- Schedule hydraulic cylinder detailed inspection
- Replace bucket teeth at next service interval
- Increase inspection frequency to monthly
- Compare against CAT-2903 progression timeline`,
    containerTags: ["tenant:acme-mining", "equipment:cat-4821", "type:336_excavator", "condition:fair", "watch:hydraulic"],
    metadata: {
      equipmentId: "CAT-4821",
      equipmentType: "336 Excavator",
      timestamp: "2025-11-20T09:30:00Z",
      overallCondition: "FAIR",
      conditionScore: "6",
      immediateAction: "false",
      tenantId: "acme-mining",
    },
  },

  // ─────────────────────────────────────────────────────────
  // CAT-0019: D8 Dozer — separate failure story (undercarriage)
  // ─────────────────────────────────────────────────────────
  {
    content: `## Inspection Record - 2025-08-01T07:00:00Z
Equipment ID: CAT-0019
Overall Condition: GOOD (Score: 7/10)
Immediate Action Required: No

### Findings:
- Undercarriage (LOW): Track links at 60% remaining life. Normal for operating hours.
- Final Drive (LOW): No abnormal noise. Oil level correct.
- Blade (LOW): Minor edge wear. Acceptable.

### Summary:
D8 Dozer in good condition. Undercarriage wear consistent with operating hours. No immediate concerns.`,
    containerTags: ["tenant:acme-mining", "equipment:cat-0019", "type:d8_dozer", "condition:good"],
    metadata: {
      equipmentId: "CAT-0019",
      equipmentType: "D8 Dozer",
      timestamp: "2025-08-01T07:00:00Z",
      overallCondition: "GOOD",
      conditionScore: "7",
      immediateAction: "false",
      tenantId: "acme-mining",
    },
  },
  {
    content: `## Inspection Record - 2025-11-15T08:45:00Z
Equipment ID: CAT-0019
Overall Condition: POOR (Score: 3/10)
Immediate Action Required: Yes

### Findings:
- Undercarriage (CRITICAL): Track links at 15% remaining life — well past 25% replacement threshold. Severe wear on sprocket. Track pin elongation 12mm beyond spec. [Progression: Accelerated wear since August — operation on abrasive rocky terrain increased wear rate 3x]
- Final Drive (HIGH): Abnormal grinding noise. Possible bearing failure. Oil showing metal particles.
- Blade (MEDIUM): Severe edge wear. Cutting efficiency reduced 40%.

### Summary:
URGENT: Undercarriage in critical condition. Track links at 15% — risk of track throwing or breaking during operation, which is a serious safety hazard. Final drive showing signs of bearing failure. Unit should be removed from service for undercarriage replacement.

### Inspector Notes:
The accelerated wear rate was caused by operating this unit on rocky quarry terrain without adjusting track tension per terrain type. This is a training issue as much as a maintenance issue.`,
    containerTags: ["tenant:acme-mining", "equipment:cat-0019", "type:d8_dozer", "condition:critical", "failure:undercarriage"],
    metadata: {
      equipmentId: "CAT-0019",
      equipmentType: "D8 Dozer",
      timestamp: "2025-11-15T08:45:00Z",
      overallCondition: "CRITICAL",
      conditionScore: "3",
      immediateAction: "true",
      tenantId: "acme-mining",
    },
  },

  // ─────────────────────────────────────────────────────────
  // Fleet-level pattern knowledge (not unit-specific)
  // ─────────────────────────────────────────────────────────
  {
    content: `## Fleet Pattern: Hydraulic Cylinder Rod Scoring — Progressive Failure Pattern

**Observed across: CAT-2903 (confirmed failure), CAT-4821 (active)**

### Pattern Description:
Hydraulic cylinder rod scoring follows a predictable 3-stage progression in high-cycle excavation and loading equipment:

**Stage 1 (0.2–0.5mm scoring depth):**
- No leakage yet
- Performance unaffected
- Typically observed 6-10 weeks before failure
- Easy to miss on casual inspection — requires close examination

**Stage 2 (0.5–1.5mm scoring depth):**
- Minor weeping/seepage may begin
- 2-6 weeks from active leak
- Risk of sudden seal failure under heavy load
- IMMEDIATE inspection and maintenance required

**Stage 3 (Failure):**
- Active hydraulic leak
- Cylinder must be replaced
- Risk of unexpected implement drop (SAFETY HAZARD)

### Root Cause:
Manufacturing surface roughness outside spec on some cylinder lots. Creates accelerated scoring under high-cycle loads. Check cylinder rod finish on new units before putting into service.

### Recommended Protocol:
- Monthly inspection of cylinder rod surfaces in high-cycle equipment
- At Stage 1: schedule maintenance within 30 days
- At Stage 2: ground unit within 48 hours

**Failure Cost Reference (CAT-2903):** Full hydraulic system repair = 4 days downtime + parts/labor. Preventive Stage 1 maintenance would have cost ~10% of failure repair.`,
    containerTags: ["tenant:acme-mining", "pattern:hydraulic_cylinder_scoring", "fleet_knowledge", "type:wheel_loader", "type:336_excavator"],
    metadata: {
      patternType: "hydraulic_cylinder_failure",
      affectedEquipmentTypes: "wheel_loader,336_excavator",
      confirmedFailureUnit: "CAT-2903",
      activeWatchUnit: "CAT-4821",
      tenantId: "acme-mining",
    },
  },
];

async function seed() {
  console.log("🌱 Sensill Demo Seed Script");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Seeding ${INSPECTIONS.length} inspection records into Supermemory...\n`);

  let success = 0;
  let failed = 0;

  for (const inspection of INSPECTIONS) {
    const preview = inspection.content.split("\n")[0].replace("## ", "");
    try {
      const id = await addMemory(
        inspection.content,
        inspection.containerTags,
        inspection.metadata
      );
      console.log(`✅ ${preview}`);
      console.log(`   ID: ${id}`);
      success++;

      // Rate limit respect
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`❌ Failed: ${preview}`);
      console.error(`   ${err.message}`);
      failed++;
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Seeded: ${success}/${INSPECTIONS.length}`);
  if (failed > 0) console.log(`❌ Failed: ${failed}`);
  console.log("\n🎯 Demo is ready! Key scenarios:");
  console.log("   • CAT-4821: Show Stage 1→Stage 2 progression with CAT-2903 pattern match");
  console.log("   • CAT-0019: Show critical undercarriage failure requiring immediate action");
  console.log("   • Fleet dashboard: Show health distribution across fleet");
}

seed().catch(console.error);
