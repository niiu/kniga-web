#!/usr/bin/env node
/**
 * Nitro bundles `@electric-sql/pglite` JS but not pglite.data / pglite.wasm /
 * initdb.wasm. Copy those sidecars next to every bundled pglite module so the
 * default constructor can find them under vite preview / Vercel.
 */
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "node_modules/@electric-sql/pglite/dist");
const FILES = ["pglite.data", "pglite.wasm", "initdb.wasm"];
const OUTPUT = join(ROOT, ".vercel/output");

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(full, acc);
    else if (name.name.includes("pglite") && name.name.endsWith(".mjs")) acc.push(full);
  }
  return acc;
}

const missing = FILES.filter((f) => !existsSync(join(DIST, f)));
if (missing.length) {
  console.warn("[copy-pglite-assets] missing source files:", missing.join(", "));
  process.exit(0);
}

const bundles = walk(OUTPUT);
if (bundles.length === 0) {
  console.warn("[copy-pglite-assets] no bundled pglite module under .vercel/output");
  process.exit(0);
}

for (const bundle of bundles) {
  const destDir = dirname(bundle);
  for (const file of FILES) {
    copyFileSync(join(DIST, file), join(destDir, file));
  }
  console.log("[copy-pglite-assets] copied sidecars next to", bundle.replace(ROOT + "/", ""));
}
