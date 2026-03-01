#!/usr/bin/env node

/**
 * Sensill Demo Tenant Seed Script
 * Pre-creates two demo org credentials in the USERS KV namespace.
 *
 * Usage: node scripts/seed-tenants.js
 * Requires: wrangler authenticated (run `wrangler login` first)
 *           USERS KV namespace ID set in packages/worker/wrangler.toml
 */

const { execSync } = require("child_process");
const { webcrypto } = require("crypto");
const fs = require("fs");
const path = require("path");

const subtle = webcrypto.subtle;

// ── PBKDF2 matching the worker implementation ──────────────────
async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await subtle.importKey(
    "raw",
    Buffer.from(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hash = await subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const combined = new Uint8Array(48);
  combined.set(salt);
  combined.set(new Uint8Array(hash), 16);
  return Buffer.from(combined).toString("base64");
}

// ── Read USERS KV namespace ID from wrangler.toml ─────────────
function getUsersKvId() {
  const tomlPath = path.join(__dirname, "../packages/worker/wrangler.toml");
  const toml = fs.readFileSync(tomlPath, "utf8");
  const lines = toml.split("\n");

  let inUsersBlock = false;
  for (const line of lines) {
    if (line.trim() === 'binding = "USERS"') inUsersBlock = true;
    if (inUsersBlock && line.startsWith("id =")) {
      const id = line.split("=")[1].trim().replace(/['"]/g, "");
      if (id.startsWith("REPLACE_")) {
        console.error("❌  USERS KV namespace not configured in wrangler.toml");
        console.error("    Run these commands first:");
        console.error("      cd packages/worker");
        console.error("      wrangler kv namespace create sensill-user-store");
        console.error("      wrangler kv namespace create sensill-user-store --preview");
        console.error("    Then update the id and preview_id in wrangler.toml");
        process.exit(1);
      }
      return id;
    }
  }

  console.error("❌  Could not find USERS KV binding in wrangler.toml");
  process.exit(1);
}

// ── Demo orgs ─────────────────────────────────────────────────
const DEMO_ORGS = [
  {
    email: "demo@acmemining.com",
    password: "demo1234",
    tenantId: "acme-mining",
    orgName: "Acme Mining",
  },
  {
    email: "demo@betaconstruction.com",
    password: "demo1234",
    tenantId: "beta-construction",
    orgName: "Beta Construction",
  },
];

async function seed() {
  console.log("🌱 Sensill Demo Tenant Seed");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const namespaceId = getUsersKvId();
  console.log(`KV namespace: ${namespaceId}\n`);

  for (const org of DEMO_ORGS) {
    try {
      console.log(`Creating: ${org.email} → tenant: ${org.tenantId}`);
      const passwordHash = await hashPassword(org.password);
      const record = JSON.stringify({ passwordHash, tenantId: org.tenantId, orgName: org.orgName });

      const remote = process.argv.includes("--remote") ? " --remote" : "";
      execSync(
        `cd packages/worker && wrangler kv key put "user:${org.email}" '${record}' --namespace-id=${namespaceId}${remote}`,
        { stdio: "inherit" }
      );
      console.log(`✅  Done\n`);
    } catch (err) {
      console.error(`❌  Failed for ${org.email}: ${err.message}\n`);
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Demo credentials:");
  console.log("  demo@acmemining.com     / demo1234  (Acme Mining)");
  console.log("  demo@betaconstruction.com / demo1234  (Beta Construction)");
  console.log("");
  console.log("Next: seed Supermemory with Acme Mining's inspection history:");
  console.log("  SUPERMEMORY_API_KEY=your_key node scripts/seed-memory.js");
}

seed().catch(console.error);
