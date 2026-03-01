#!/usr/bin/env node

/**
 * Sensill Demo Reset Script
 * Clears all Supermemory inspection data for a tenant and the KV fleet cache.
 * Run this before every demo to start with a clean slate.
 *
 * Usage:
 *   SUPERMEMORY_API_KEY=your_key node scripts/reset-demo.js
 *   SUPERMEMORY_API_KEY=your_key TENANT_ID=acme-mining node scripts/reset-demo.js
 *
 * What it clears:
 *   - All Supermemory documents tagged tenant:{TENANT_ID}
 *   - KV fleet cache key: fleet:{TENANT_ID}:overview
 *
 * What it does NOT touch:
 *   - USERS KV (login credentials stay intact — no need to re-signup)
 *   - R2 photos (optional cleanup — does not affect AI output)
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const SUPERMEMORY_BASE = "https://api.supermemory.ai/v3";
const API_KEY = process.env.SUPERMEMORY_API_KEY;
const TENANT_ID = process.env.TENANT_ID || "acme-mining";

if (!API_KEY) {
  console.error("❌  SUPERMEMORY_API_KEY environment variable required");
  console.error("    Usage: SUPERMEMORY_API_KEY=your_key node scripts/reset-demo.js");
  process.exit(1);
}

// ── Supermemory helpers ────────────────────────────────────────

async function searchDocuments(query, containerTags, limit = 100) {
  const res = await fetch(`${SUPERMEMORY_BASE}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, containerTags, limit }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Search failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  // results may be in data.results or data directly depending on API version
  return Array.isArray(data) ? data : (data.results ?? []);
}

async function deleteDocument(id) {
  const res = await fetch(`${SUPERMEMORY_BASE}/documents/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Delete failed for ${id}: ${res.status} ${err}`);
  }
}

// ── KV helpers ─────────────────────────────────────────────────

function getCacheKvId() {
  const tomlPath = path.join(__dirname, "../packages/worker/wrangler.toml");
  const toml = fs.readFileSync(tomlPath, "utf8");
  const lines = toml.split("\n");

  let inCacheBlock = false;
  for (const line of lines) {
    if (line.trim() === 'binding = "CACHE"') inCacheBlock = true;
    if (inCacheBlock && line.startsWith("id =")) {
      return line.split("=")[1].trim().replace(/['"]/g, "");
    }
  }

  console.error("❌  Could not find CACHE KV binding in wrangler.toml");
  process.exit(1);
}

function deleteKvKey(namespaceId, key) {
  try {
    execSync(
      `cd packages/worker && npx wrangler kv key delete "${key}" --namespace-id=${namespaceId} --remote`,
      { stdio: "pipe" }
    );
    return true;
  } catch {
    // Key may not exist — that's fine
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────

async function reset() {
  console.log("🔄  Sensill Demo Reset");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Tenant: ${TENANT_ID}\n`);

  // ── Step 1: Clear Supermemory ──────────────────────────────
  console.log("Step 1: Clearing Supermemory inspection data...");

  const tenantTag = `tenant:${TENANT_ID}`;
  let deleted = 0;
  let failed = 0;

  // Search using a broad query scoped to this tenant
  // Run multiple searches to catch all document types
  const queries = [
    "inspection history findings",
    "fleet pattern failure wear",
    "equipment condition maintenance",
  ];

  const seenIds = new Set();

  for (const query of queries) {
    try {
      const results = await searchDocuments(query, [tenantTag], 100);
      for (const doc of results) {
        const id = doc.id ?? doc.documentId;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        try {
          await deleteDocument(id);
          console.log(`  ✅  Deleted: ${id.slice(0, 16)}...`);
          deleted++;
          await new Promise((r) => setTimeout(r, 100)); // rate limit
        } catch (err) {
          console.error(`  ❌  Failed: ${id.slice(0, 16)}... — ${err.message}`);
          failed++;
        }
      }
    } catch (err) {
      console.error(`  ⚠️  Search failed for query "${query}": ${err.message}`);
    }
  }

  console.log(`\n  Deleted ${deleted} documents${failed > 0 ? `, ${failed} failed` : ""}`);

  // ── Step 2: Clear KV fleet cache ──────────────────────────
  console.log("\nStep 2: Clearing KV fleet cache...");
  const cacheKvId = getCacheKvId();
  const fleetKey = `fleet:${TENANT_ID}:overview`;
  const cleared = deleteKvKey(cacheKvId, fleetKey);
  console.log(cleared ? `  ✅  Deleted: ${fleetKey}` : `  ℹ️   Key not found (already clear): ${fleetKey}`);

  // ── Done ──────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅  Reset complete. Sensill is clean.\n");
  console.log("Next steps:");
  console.log("  1. Pre-seed CAT-2903 fleet pattern (submit pics/cat336/12.jpeg in the app)");
  console.log("  2. Follow demo sequence in docs/DEMO-SCRIPT.md");
}

reset().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
