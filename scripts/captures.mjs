import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const captureDir = resolve(root, "data/captures");
export const publicDataDir = resolve(root, "public/data");
const SERVER_DATA = "/var/www/pka.ninja/data";

/** Live site data, when this process is running on the VPS. Never used on a dev machine. */
export function liveDataDir() {
  if (process.env.PKA_DATA_DIR) return resolve(process.env.PKA_DATA_DIR);
  if (existsSync(resolve(SERVER_DATA, ".git"))) return SERVER_DATA;
  return null;
}

export function ensureCaptureDirs() {
  mkdirSync(captureDir, { recursive: true });
  mkdirSync(publicDataDir, { recursive: true });
}

function isMarketCapture(name) {
  return name.startsWith("pka_market-") && name.endsWith(".json");
}

/** Move stamped market dumps out of public/data so the browser does not download them. */
export function adoptPublicCaptures() {
  ensureCaptureDirs();
  if (!existsSync(publicDataDir)) return [];
  const moved = [];
  for (const name of readdirSync(publicDataDir)) {
    if (!isMarketCapture(name)) continue;
    const from = resolve(publicDataDir, name);
    const to = resolve(captureDir, name);
    if (existsSync(to)) continue;
    renameSync(from, to);
    moved.push(name);
  }
  return moved;
}

export function hasMarketCaptures(dir) {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some(isMarketCapture);
}
