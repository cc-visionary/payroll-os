/**
 * build-payload.js
 *
 * Assembles the Next.js standalone output into resources/payload/
 * so electron-builder can include it as extraResources (outside asar).
 *
 * The spawned Node.js child process cannot read from inside asar archives,
 * so the Next.js server payload must live on the real filesystem.
 *
 * Run after:  next build
 * Run before: electron-builder
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const PAYLOAD = path.join(ROOT, "resources", "payload");

function log(msg) {
  console.log(`  ${msg}`);
}

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

/**
 * Find the standalone root directory.
 * Next.js standalone output can be either:
 *   - Direct:  .next/standalone/server.js
 *   - Nested:  .next/standalone/<project-name>/server.js
 */
function findStandaloneRoot() {
  // Case A: server.js directly in standalone
  if (fs.existsSync(path.join(STANDALONE, "server.js"))) {
    log("Found standalone structure: direct (server.js at root)");
    return STANDALONE;
  }

  // Case B: server.js in a nested subdirectory
  const children = fs
    .readdirSync(STANDALONE, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const d of children) {
    const candidate = path.join(STANDALONE, d.name);
    if (fs.existsSync(path.join(candidate, "server.js"))) {
      log(`Found standalone structure: nested (${d.name}/server.js)`);
      return candidate;
    }
  }

  throw new Error(`Could not find server.js in ${STANDALONE}`);
}

// ── Main ─────────────────────────────────────────────────────────────

console.log("=== build-payload: assembling resources/payload/ ===\n");

// 1. Verify standalone exists
if (!fs.existsSync(STANDALONE)) {
  console.error("ERROR: .next/standalone/ not found. Run 'next build' first.");
  process.exit(1);
}

const standaloneRoot = findStandaloneRoot();

// 2. Clean previous payload
if (fs.existsSync(PAYLOAD)) {
  fs.rmSync(PAYLOAD, { recursive: true, force: true });
}
fs.mkdirSync(PAYLOAD, { recursive: true });

// 3. Copy server.js (the entry point)
log("Copying server.js...");
fs.copyFileSync(
  path.join(standaloneRoot, "server.js"),
  path.join(PAYLOAD, "server.js")
);

// 4. Copy node_modules from standalone (already pruned by Next.js)
//    Check both standaloneRoot and parent (for nested structure)
let nodeModulesSrc = path.join(standaloneRoot, "node_modules");
if (!fs.existsSync(nodeModulesSrc)) {
  const parentNodeModules = path.join(
    path.dirname(standaloneRoot),
    "node_modules"
  );
  if (fs.existsSync(parentNodeModules)) {
    nodeModulesSrc = parentNodeModules;
    log("Found node_modules in parent directory (nested standalone)");
  }
}

if (fs.existsSync(nodeModulesSrc)) {
  log("Copying node_modules/ (standalone-pruned)...");
  copyRecursiveSync(nodeModulesSrc, path.join(PAYLOAD, "node_modules"));
} else {
  console.warn("  WARN: node_modules not found in standalone output!");
}

// 5. Copy .next directory from standalone (server chunks, manifests, etc.)
const dotNextSrc = path.join(standaloneRoot, ".next");
if (fs.existsSync(dotNextSrc)) {
  log("Copying .next/ server files...");
  copyRecursiveSync(dotNextSrc, path.join(PAYLOAD, ".next"));
}

// 6. Copy .next/static from the main build (NOT from standalone)
//    Next.js standalone does not include static files — they must be copied separately
const staticSrc = path.join(ROOT, ".next", "static");
const staticDest = path.join(PAYLOAD, ".next", "static");
if (fs.existsSync(staticSrc)) {
  log("Copying .next/static/ (from main build)...");
  copyRecursiveSync(staticSrc, staticDest);
} else {
  console.warn("  WARN: .next/static/ not found in main build output");
}

// 7. Copy public/ assets
const publicSrc = path.join(ROOT, "public");
if (fs.existsSync(publicSrc)) {
  log("Copying public/...");
  copyRecursiveSync(publicSrc, path.join(PAYLOAD, "public"));
}

// 8. Copy prisma schema and migrations (no recursive filter — copy each explicitly)
const prismaSrc = path.join(ROOT, "prisma");
if (fs.existsSync(prismaSrc)) {
  log("Copying prisma/schema.prisma...");
  const prismaDest = path.join(PAYLOAD, "prisma");
  fs.mkdirSync(prismaDest, { recursive: true });
  fs.copyFileSync(
    path.join(prismaSrc, "schema.prisma"),
    path.join(prismaDest, "schema.prisma")
  );

  // Copy migrations directory entirely (no filter to avoid Issue 4)
  const migrationsSrc = path.join(prismaSrc, "migrations");
  if (fs.existsSync(migrationsSrc)) {
    log("Copying prisma/migrations/...");
    copyRecursiveSync(migrationsSrc, path.join(prismaDest, "migrations"));
  }
}

// 9. Copy generated Prisma client if present in standalone trace
const generatedPrismaSrc = path.join(
  standaloneRoot,
  "app",
  "generated",
  "prisma"
);
if (fs.existsSync(generatedPrismaSrc)) {
  log("Copying app/generated/prisma/ (Prisma client)...");
  copyRecursiveSync(
    generatedPrismaSrc,
    path.join(PAYLOAD, "app", "generated", "prisma")
  );
}

// 10. Copy .env if it exists (for local builds; CI creates its own)
const envSrc = path.join(ROOT, ".env");
if (fs.existsSync(envSrc)) {
  log("Copying .env...");
  fs.copyFileSync(envSrc, path.join(PAYLOAD, ".env"));
}

// 11. Copy package.json from standalone (server.js may reference it)
const standalonePkg = path.join(standaloneRoot, "package.json");
const rootPkg = path.join(ROOT, "package.json");
if (fs.existsSync(standalonePkg)) {
  log("Copying package.json (from standalone)...");
  fs.copyFileSync(standalonePkg, path.join(PAYLOAD, "package.json"));
} else {
  log("Copying package.json (from project root)...");
  fs.copyFileSync(rootPkg, path.join(PAYLOAD, "package.json"));
}

console.log("\n=== build-payload: done ===");
