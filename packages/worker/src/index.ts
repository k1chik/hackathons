import Anthropic from "@anthropic-ai/sdk";

export interface Env {
  ANTHROPIC_API_KEY: string;
  SUPERMEMORY_API_KEY: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  CACHE: KVNamespace;
  USERS: KVNamespace;
  PHOTOS: R2Bucket;
  ENVIRONMENT?: string;
}

// ─────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────

interface InspectionResult {
  equipmentId: string;
  timestamp: string;
  overallCondition: "GOOD" | "FAIR" | "POOR" | "CRITICAL";
  conditionScore: number;
  findings: Finding[];
  historicalContext: HistoricalMatch[];
  recommendations: string[];
  immediateAction: boolean;
  summary: string;
  inspectorNotes?: string;
}

interface Finding {
  component: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  progression?: string;
}

interface HistoricalMatch {
  type: "PROGRESSION" | "PATTERN_MATCH";
  description: string;
  referenceUnit?: string;
  referenceDate?: string;
}

interface Memory {
  id: string;
  content: string;
  metadata?: Record<string, string>;
}

interface FleetEntry {
  equipmentId: string;
  equipmentType: string;
  lastInspection: string;
  overallCondition: string;
  conditionScore: number;
  previousConditionScore?: number;
  immediateAction: boolean;
  summary: string;
}

interface UserRecord {
  passwordHash: string;
  tenantId: string;
  orgName: string;
}

interface OrgRecord {
  orgName: string;
  inviteCode: string;
}

interface JWTPayload {
  sub: string;
  tenantId: string;
  orgName: string;
  iat: number;
  exp: number;
}

// ─────────────────────────────────────────────────────────────
// Password hashing — PBKDF2 via Web Crypto
// ─────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const combined = new Uint8Array(16 + 32);
  combined.set(salt);
  combined.set(new Uint8Array(hash), 16);
  return btoa(String.fromCharCode(...combined));
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const expectedHash = combined.slice(16);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArr = new Uint8Array(hash);
  // Constant-time comparison to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < hashArr.length; i++) diff |= hashArr[i] ^ expectedHash[i];
  return diff === 0;
}

// ─────────────────────────────────────────────────────────────
// JWT — HMAC-SHA256 via Web Crypto, no external library
// ─────────────────────────────────────────────────────────────

function b64url(s: string): string {
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

async function mintJWT(secret: string, payload: JWTPayload): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifyJWT(secret: string, token: string): Promise<JWTPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sigBytes = Uint8Array.from(b64urlDecode(sig), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(`${header}.${body}`)
  );
  if (!valid) return null;
  const payload = JSON.parse(b64urlDecode(body)) as JWTPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ─────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────

async function authenticate(request: Request, env: Env): Promise<JWTPayload | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyJWT(env.JWT_SECRET, auth.slice(7));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function generateInviteCode(): string {
  // Omit ambiguous chars: O, 0, I, 1
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

// ─────────────────────────────────────────────────────────────
// Supermemory client
// ─────────────────────────────────────────────────────────────

const SUPERMEMORY_BASE = "https://api.supermemory.ai/v3";

async function addMemory(
  apiKey: string,
  content: string,
  containerTags: string[],
  metadata: Record<string, string>
): Promise<string> {
  const res = await fetch(`${SUPERMEMORY_BASE}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content, containerTags, metadata }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supermemory add failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function searchMemories(
  apiKey: string,
  query: string,
  containerTags?: string[],
  limit = 10
): Promise<Memory[]> {
  const body: Record<string, unknown> = { q: query, limit };
  if (containerTags && containerTags.length > 0) body.containerTags = containerTags;

  const res = await fetch(`${SUPERMEMORY_BASE}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`Supermemory search failed: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as {
    results: Array<{
      documentId: string;
      chunks: Array<{ content: string }>;
      metadata?: Record<string, string>;
      score: number;
    }>;
  };
  return (data.results ?? []).map((r) => ({
    id: r.documentId,
    content: r.chunks.map((c) => c.content).join("\n"),
    metadata: r.metadata,
  }));
}

// ─────────────────────────────────────────────────────────────
// Claude vision analysis
// ─────────────────────────────────────────────────────────────

async function analyzeInspectionImage(
  anthropic: Anthropic,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  equipmentId: string,
  equipmentType: string,
  historicalMemories: Memory[]
): Promise<InspectionResult> {
  const historicalContext =
    historicalMemories.length > 0
      ? `\n\n## Historical Inspection Data for Equipment ${equipmentId}:\n${historicalMemories
          .map((m) => m.content)
          .join("\n\n---\n\n")}`
      : "\n\n## Historical Data: No prior inspections on record for this unit.";

  const systemPrompt = `You are Sensill, an expert heavy equipment inspection AI with deep knowledge of CAT/Caterpillar machinery, hydraulic systems, structural integrity, and preventive maintenance. Your role is to analyze inspection photos and provide detailed, actionable assessments.

You have access to the complete inspection history for each piece of equipment. Use this history to:
1. Detect progression of wear or damage between inspections
2. Match failure patterns with other units that experienced similar issues
3. Predict when maintenance will become critical
4. Surface institutional knowledge that would otherwise be lost

Always respond with valid JSON matching the InspectionResult schema.`;

  const userPrompt = `Analyze this inspection photo for Equipment ID: ${equipmentId} (Type: ${equipmentType}).
${historicalContext}

Based on what you see in the photo AND the historical context above, provide a concise inspection report.

Be brief. Keep descriptions under 20 words each. Respond with a JSON object matching this exact schema:
{
  "equipmentId": "${equipmentId}",
  "timestamp": "${new Date().toISOString()}",
  "overallCondition": "GOOD|FAIR|POOR|CRITICAL",
  "conditionScore": <1-10, where 10 is perfect condition>,
  "findings": [
    <2-4 findings — ALWAYS include at least 2, even for good-condition equipment; note what looks good and what to watch>
    {
      "component": "<component name>",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "description": "<observation, max 20 words>",
      "progression": "<optional: change since last inspection, max 15 words>"
    }
  ],
  "historicalContext": [
    <max 2 items>
    {
      "type": "PROGRESSION|PATTERN_MATCH",
      "description": "<insight, max 20 words>",
      "referenceUnit": "<optional: unit ID>",
      "referenceDate": "<optional: date>"
    }
  ],
  "recommendations": ["<max 3 actionable items, each under 15 words>"],
  "immediateAction": <true if action required within 24 hours>,
  "summary": "<2 sentences max>",
  "inspectorNotes": "<optional, max 20 words>"
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let jsonStr = text;
  if (text.includes("```json")) {
    jsonStr = text.split("```json")[1].split("```")[0].trim();
  } else if (text.includes("```")) {
    jsonStr = text.split("```")[1].split("```")[0].trim();
  } else {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) jsonStr = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(jsonStr) as InspectionResult;
  } catch {
    console.error("JSON parse failed. Response length:", text.length);
    return {
      equipmentId,
      timestamp: new Date().toISOString(),
      overallCondition: "FAIR",
      conditionScore: 5,
      findings: [{ component: "Analysis Engine", severity: "LOW", description: "The AI response was too large to process automatically. Please retry." }],
      historicalContext: [],
      recommendations: ["Retry the inspection — this is a transient processing issue, not an equipment finding."],
      immediateAction: false,
      summary: "Analysis could not be fully processed this time. Please retry the inspection.",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Format inspection for memory storage
// ─────────────────────────────────────────────────────────────

function formatInspectionForMemory(result: InspectionResult): string {
  const findingsSummary = result.findings
    .map((f) => `- ${f.component} (${f.severity}): ${f.description}${f.progression ? ` [Progression: ${f.progression}]` : ""}`)
    .join("\n");

  return `## Inspection Record - ${result.timestamp}
Equipment ID: ${result.equipmentId}
Overall Condition: ${result.overallCondition} (Score: ${result.conditionScore}/10)
Immediate Action Required: ${result.immediateAction ? "YES" : "No"}

### Findings:
${findingsSummary}

### Summary:
${result.summary}

### Recommendations:
${result.recommendations.map((r) => `- ${r}`).join("\n")}

### Inspector Notes:
${result.inspectorNotes || "None"}`;
}

// ─────────────────────────────────────────────────────────────
// Fleet cache (tenant-scoped KV key)
// ─────────────────────────────────────────────────────────────

async function updateFleetCache(
  kv: KVNamespace,
  result: InspectionResult,
  equipmentType: string,
  tenantId: string
): Promise<void> {
  const key = `fleet:${tenantId}:overview`;
  const fleetRaw = await kv.get(key);
  const fleet: FleetEntry[] = fleetRaw ? JSON.parse(fleetRaw) : [];

  const existing = fleet.find((e) => e.equipmentId === result.equipmentId);
  const entry: FleetEntry = {
    equipmentId: result.equipmentId,
    equipmentType,
    lastInspection: result.timestamp,
    overallCondition: result.overallCondition,
    conditionScore: result.conditionScore,
    previousConditionScore: existing?.conditionScore,
    immediateAction: result.immediateAction,
    summary: result.summary,
  };

  const idx = fleet.findIndex((e) => e.equipmentId === result.equipmentId);
  if (idx >= 0) fleet[idx] = entry;
  else fleet.push(entry);

  await kv.put(key, JSON.stringify(fleet), { expirationTtl: 86400 * 30 });
}

// ─────────────────────────────────────────────────────────────
// CORS + response helpers
// ─────────────────────────────────────────────────────────────

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data: unknown, status = 200, origin = "*"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ─────────────────────────────────────────────────────────────
// Main router
// ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      // ── POST /api/auth/signup ──────────────────────────────
      if (url.pathname === "/api/auth/signup" && request.method === "POST") {
        const body = (await request.json()) as {
          email?: string;
          password?: string;
          orgName?: string;
          inviteCode?: string;
        };
        const { email, password, orgName, inviteCode } = body;

        if (!email || !password) {
          return json({ error: "email and password are required" }, 400, origin);
        }
        if (!orgName && !inviteCode) {
          return json({ error: "orgName or inviteCode is required" }, 400, origin);
        }
        if (password.length < 8) {
          return json({ error: "Password must be at least 8 characters" }, 400, origin);
        }

        const emailKey = `user:${email.toLowerCase()}`;
        if (await env.USERS.get(emailKey)) {
          return json({ error: "An account with this email already exists" }, 409, origin);
        }

        let tenantId: string;
        let resolvedOrgName: string;

        if (inviteCode) {
          // Joining an existing org via invite code
          const tid = await env.USERS.get(`invite:${inviteCode.toUpperCase()}`);
          if (!tid) return json({ error: "Invalid invite code" }, 400, origin);
          const orgRaw = await env.USERS.get(`org:${tid}`);
          if (!orgRaw) return json({ error: "Org not found" }, 400, origin);
          const org = JSON.parse(orgRaw) as OrgRecord;
          tenantId = tid;
          resolvedOrgName = org.orgName;
        } else {
          // Creating a new org
          tenantId = slugify(orgName!);
          const existingOrg = await env.USERS.get(`org:${tenantId}`);
          if (existingOrg) {
            return json(
              { error: "An org with this name already exists. Ask a teammate for the invite code to join." },
              409,
              origin
            );
          }
          const code = generateInviteCode();
          const orgRecord: OrgRecord = { orgName: orgName!, inviteCode: code };
          await env.USERS.put(`org:${tenantId}`, JSON.stringify(orgRecord));
          await env.USERS.put(`invite:${code}`, tenantId);
          resolvedOrgName = orgName!;
        }

        const passwordHash = await hashPassword(password);
        const record: UserRecord = { passwordHash, tenantId, orgName: resolvedOrgName };
        await env.USERS.put(emailKey, JSON.stringify(record));

        const iat = Math.floor(Date.now() / 1000);
        const token = await mintJWT(env.JWT_SECRET, {
          sub: email.toLowerCase(),
          tenantId,
          orgName: resolvedOrgName,
          iat,
          exp: iat + 86400 * 30,
        });

        return json({ token, user: { email: email.toLowerCase(), tenantId, orgName: resolvedOrgName } }, 201, origin);
      }

      // ── POST /api/auth/login ───────────────────────────────
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const body = (await request.json()) as { email?: string; password?: string };
        const { email, password } = body;

        if (!email || !password) {
          return json({ error: "email and password are required" }, 400, origin);
        }

        const raw = await env.USERS.get(`user:${email.toLowerCase()}`);
        // Use same response for missing user vs wrong password to prevent email enumeration
        if (!raw) return json({ error: "Invalid email or password" }, 401, origin);

        const record = JSON.parse(raw) as UserRecord;
        const ok = await verifyPassword(password, record.passwordHash);
        if (!ok) return json({ error: "Invalid email or password" }, 401, origin);

        const iat = Math.floor(Date.now() / 1000);
        const token = await mintJWT(env.JWT_SECRET, {
          sub: email.toLowerCase(),
          tenantId: record.tenantId,
          orgName: record.orgName,
          iat,
          exp: iat + 86400 * 30,
        });

        return json({ token, user: { email: email.toLowerCase(), tenantId: record.tenantId, orgName: record.orgName } }, 200, origin);
      }

      // ── POST /api/auth/forgot-password ────────────────────
      if (url.pathname === "/api/auth/forgot-password" && request.method === "POST") {
        const body = (await request.json()) as { email?: string };
        const { email } = body;
        if (!email) return json({ error: "email is required" }, 400, origin);
        // Always return 200 to prevent email enumeration
        const raw = await env.USERS.get(`user:${email.toLowerCase()}`);
        if (raw) {
          const token = crypto.randomUUID();
          await env.USERS.put(`reset:${token}`, email.toLowerCase(), { expirationTtl: 3600 });
          const resetUrl = `https://sensill.pages.dev/reset-password?token=${token}`;
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Sensill <noreply@sensill.app>",
              to: email.toLowerCase(),
              subject: "Reset your Sensill password",
              html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
            }),
          });
        }
        return json({ message: "If that email exists, a reset link has been sent." }, 200, origin);
      }

      // ── POST /api/auth/reset-password ──────────────────────
      if (url.pathname === "/api/auth/reset-password" && request.method === "POST") {
        const body = (await request.json()) as { token?: string; password?: string };
        const { token, password } = body;
        if (!token || !password) return json({ error: "token and password are required" }, 400, origin);
        if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400, origin);
        const email = await env.USERS.get(`reset:${token}`);
        if (!email) return json({ error: "Invalid or expired reset token" }, 400, origin);
        const raw = await env.USERS.get(`user:${email}`);
        if (!raw) return json({ error: "Account not found" }, 404, origin);
        const record = JSON.parse(raw) as UserRecord;
        record.passwordHash = await hashPassword(password);
        await env.USERS.put(`user:${email}`, JSON.stringify(record));
        await env.USERS.delete(`reset:${token}`);
        return json({ message: "Password reset successfully" }, 200, origin);
      }

      // ── GET /api/health ────────────────────────────────────
      if (url.pathname === "/api/health") {
        return json({ status: "ok", timestamp: new Date().toISOString(), environment: env.ENVIRONMENT || "development" }, 200, origin);
      }

      // ── Auth gate — all routes below require a valid JWT ───
      const claims = await authenticate(request, env);
      if (!claims) {
        return json({ error: "Unauthorized" }, 401, origin);
      }
      const { tenantId } = claims;

      // ── GET /api/auth/invite-code ──────────────────────────
      if (url.pathname === "/api/auth/invite-code" && request.method === "GET") {
        let orgRaw = await env.USERS.get(`org:${tenantId}`);
        if (!orgRaw) {
          // Backwards-compat: generate invite code on demand for pre-existing orgs
          const code = generateInviteCode();
          const orgRecord: OrgRecord = { orgName: claims.orgName, inviteCode: code };
          await env.USERS.put(`org:${tenantId}`, JSON.stringify(orgRecord));
          await env.USERS.put(`invite:${code}`, tenantId);
          orgRaw = JSON.stringify(orgRecord);
        }
        const org = JSON.parse(orgRaw) as OrgRecord;
        return json({ inviteCode: org.inviteCode, orgName: org.orgName }, 200, origin);
      }

      // ── POST /api/inspect (SSE streaming) ─────────────────
      if (url.pathname === "/api/inspect" && request.method === "POST") {
        const body = (await request.json()) as {
          equipmentId: string;
          equipmentType?: string;
          imageBase64: string;
          mediaType?: string;
          inspectorNotes?: string;
        };

        const {
          equipmentId,
          equipmentType = "Heavy Equipment",
          imageBase64,
          mediaType = "image/jpeg",
          inspectorNotes,
        } = body;

        if (!equipmentId || !imageBase64) {
          return json({ error: "equipmentId and imageBase64 are required" }, 400, origin);
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        const send = (data: Record<string, unknown>): Promise<void> =>
          writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        ctx.waitUntil(
          (async () => {
            try {
              await send({ type: "progress", step: 0, message: "Retrieving inspection history..." });

              const tenantTag = `tenant:${tenantId}`;
              const equipmentTag = `equipment:${equipmentId.toLowerCase()}`;

              const t0 = Date.now();
              const [specificHistory, fleetPatterns] = await Promise.all([
                searchMemories(env.SUPERMEMORY_API_KEY, `equipment ${equipmentId} inspection history findings`, [tenantTag, equipmentTag], 8),
                searchMemories(env.SUPERMEMORY_API_KEY, `${equipmentType} failure pattern wear damage`, [tenantTag], 5),
              ]);
              console.log(`[perf] supermemory fetch: ${Date.now() - t0}ms`);

              await send({ type: "progress", step: 1, message: "Analyzing image..." });
              const t1 = Date.now();
              const result = await analyzeInspectionImage(
                anthropic,
                imageBase64,
                mediaType as "image/jpeg" | "image/png" | "image/webp",
                equipmentId,
                equipmentType,
                [...specificHistory, ...fleetPatterns]
              );
              console.log(`[perf] claude analysis: ${Date.now() - t1}ms`);
              if (inspectorNotes) result.inspectorNotes = inspectorNotes;

              await send({ type: "progress", step: 2, message: "Saving inspection..." });

              let photoUrl: string | undefined;
              try {
                const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
                const photoKey = `${tenantId}/${equipmentId}/${result.timestamp}.${ext}`;
                const photoBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
                await env.PHOTOS.put(photoKey, photoBytes, { httpMetadata: { contentType: mediaType as string } });
                photoUrl = `/api/photos/${photoKey}`;
              } catch { /* non-fatal */ }

              await addMemory(
                env.SUPERMEMORY_API_KEY,
                formatInspectionForMemory(result),
                [tenantTag, equipmentTag, `type:${equipmentType.toLowerCase().replace(/\s+/g, "_")}`, `condition:${result.overallCondition.toLowerCase()}`],
                {
                  equipmentId,
                  equipmentType,
                  timestamp: result.timestamp,
                  overallCondition: result.overallCondition,
                  conditionScore: String(result.conditionScore),
                  immediateAction: String(result.immediateAction),
                  tenantId,
                  ...(photoUrl ? { photoUrl } : {}),
                }
              );

              await updateFleetCache(env.CACHE, result, equipmentType, tenantId);
              await send({ type: "result", payload: { ...result, photoUrl } });
            } catch (err) {
              await send({ type: "error", message: err instanceof Error ? err.message : "Inspection failed" });
            } finally {
              await writer.close();
            }
          })()
        );

        return new Response(readable, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...corsHeaders(origin) },
        });
      }

      // ── GET /api/equipment/:id ─────────────────────────────
      if (url.pathname.startsWith("/api/equipment/") && request.method === "GET") {
        const equipmentId = url.pathname.split("/")[3];
        if (!equipmentId) return json({ error: "Equipment ID required" }, 400, origin);

        const tenantTag = `tenant:${tenantId}`;
        const equipmentTag = `equipment:${equipmentId.toLowerCase()}`;
        const memories = await searchMemories(
          env.SUPERMEMORY_API_KEY,
          `equipment ${equipmentId}`,
          [tenantTag, equipmentTag],
          20
        );

        return json({ equipmentId, inspections: memories }, 200, origin);
      }

      // ── GET /api/fleet ─────────────────────────────────────
      if (url.pathname === "/api/fleet" && request.method === "GET") {
        const fleetRaw = await env.CACHE.get(`fleet:${tenantId}:overview`);
        const fleet: FleetEntry[] = fleetRaw ? JSON.parse(fleetRaw) : [];

        return json({
          total: fleet.length,
          critical: fleet.filter((e) => e.overallCondition === "CRITICAL").length,
          poor: fleet.filter((e) => e.overallCondition === "POOR").length,
          fair: fleet.filter((e) => e.overallCondition === "FAIR").length,
          good: fleet.filter((e) => e.overallCondition === "GOOD").length,
          immediateActionRequired: fleet.filter((e) => e.immediateAction).length,
          units: fleet.sort((a, b) => a.conditionScore - b.conditionScore),
        }, 200, origin);
      }

      // ── GET /api/patterns ──────────────────────────────────
      if (url.pathname === "/api/patterns" && request.method === "GET") {
        const equipmentType = url.searchParams.get("type") || "heavy equipment";
        const patterns = await searchMemories(
          env.SUPERMEMORY_API_KEY,
          `${equipmentType} pattern failure recurring wear`,
          [`tenant:${tenantId}`],
          10
        );
        return json({ patterns }, 200, origin);
      }

      // ── GET /api/photos/* ──────────────────────────────────
      if (url.pathname.startsWith("/api/photos/") && request.method === "GET") {
        const key = url.pathname.replace("/api/photos/", "");
        // Verify the photo belongs to the authenticated tenant
        if (!key.startsWith(`${tenantId}/`)) {
          return json({ error: "Forbidden" }, 403, origin);
        }
        const object = await env.PHOTOS.get(key);
        if (!object) return new Response("Not found", { status: 404 });
        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
            "Cache-Control": "public, max-age=31536000",
            ...corsHeaders(origin),
          },
        });
      }

      return json({ error: "Not found" }, 404, origin);
    } catch (err) {
      console.error("Worker error:", err);
      return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500, origin);
    }
  },
};
