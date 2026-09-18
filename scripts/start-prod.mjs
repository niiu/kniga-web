#!/usr/bin/env node
/**
 * Production Node listener for a `NITRO_PRESET=node-server` build.
 * Binds 0.0.0.0 so nginx / Docker can reach it.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, ".output/server/index.mjs");

if (!existsSync(server)) {
  console.error("Нет сборки. На сервере: npm ci && npm run build:server && npm start");
  process.exit(1);
}

process.env.HOST ||= "0.0.0.0";
process.env.NITRO_HOST ||= "0.0.0.0";
process.env.PORT ||= "8080";
process.env.NITRO_PORT ||= process.env.PORT;
process.env.VITE_AUTH_ENABLED ||= "false";

await import(pathToFileURL(server).href);
