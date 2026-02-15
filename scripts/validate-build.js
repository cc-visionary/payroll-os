/**
 * validate-build.js
 *
 * Pre-packaging validation. Runs before electron-builder to catch
 * missing files that would cause silent runtime crashes.
 *
 * Run after:  build-payload.js + electron:compile
 * Run before: electron-builder
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PAYLOAD = path.join(ROOT, "resources", "payload");
const DIST_ELECTRON = path.join(ROOT, "dist-electron");

const errors = [];
const warnings = [];

function check(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`MISSING: ${label}`);
  }
}

function checkDir(dirPath, label, minEntries = 1) {
  if (!fs.existsSync(dirPath)) {
    errors.push(`MISSING DIR: ${label}`);
    return;
  }
  const entries = fs.readdirSync(dirPath);
  if (entries.length < minEntries) {
    errors.push(
      `EMPTY: ${label} — expected >= ${minEntries} entries, got ${entries.length}`
    );
  }
}

function warn(filePath, label) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`${label}`);
  }
}

console.log("=== validate-build ===\n");

// ── Electron compiled output ────────────────────────────────────────
check(path.join(DIST_ELECTRON, "main.js"), "dist-electron/main.js");
check(path.join(DIST_ELECTRON, "preload.js"), "dist-electron/preload.js");

// ── Payload core ────────────────────────────────────────────────────
check(path.join(PAYLOAD, "server.js"), "payload/server.js");
check(path.join(PAYLOAD, "package.json"), "payload/package.json");

// ── node_modules (critical — catches electron-builder exclusion) ────
checkDir(path.join(PAYLOAD, "node_modules"), "payload/node_modules", 5);
checkDir(
  path.join(PAYLOAD, "node_modules", "next"),
  "payload/node_modules/next"
);

// ── .next server output ─────────────────────────────────────────────
checkDir(path.join(PAYLOAD, ".next", "server"), "payload/.next/server");
check(path.join(PAYLOAD, ".next", "BUILD_ID"), "payload/.next/BUILD_ID");

// ── .next/static (CSS, JS chunks) ──────────────────────────────────
checkDir(path.join(PAYLOAD, ".next", "static"), "payload/.next/static");

// ── Public assets ───────────────────────────────────────────────────
checkDir(path.join(PAYLOAD, "public"), "payload/public");

// ── Prisma ──────────────────────────────────────────────────────────
check(
  path.join(PAYLOAD, "prisma", "schema.prisma"),
  "payload/prisma/schema.prisma"
);
checkDir(
  path.join(PAYLOAD, "prisma", "migrations"),
  "payload/prisma/migrations"
);

// ── Warnings (non-fatal) ────────────────────────────────────────────
warn(path.join(PAYLOAD, ".env"), "payload/.env (optional — CI creates it)");
warn(
  path.join(ROOT, "node-runtime", "node.exe"),
  "node-runtime/node.exe (downloaded in CI)"
);

// ── Report ──────────────────────────────────────────────────────────
if (warnings.length > 0) {
  console.log("Warnings:");
  warnings.forEach((w) => console.log(`  - ${w}`));
  console.log();
}

if (errors.length > 0) {
  console.error("ERRORS:");
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error(
    `\n${errors.length} validation error(s). Build will fail at runtime.`
  );
  process.exit(1);
} else {
  console.log("All validation checks passed.\n");
}
