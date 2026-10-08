import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adoptPublicCaptures, captureDir, ensureCaptureDirs, publicDataDir } from "./captures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(root, "../../pxg-tyramel/captures");

ensureCaptureDirs();
adoptPublicCaptures();

function safeStamp(value) {
  return value.replace(/[:.+]/g, "-");
}

function capturedAtOf(path) {
  const head = readFileSync(path, "utf8").slice(0, 500);
  const match = head.match(/"capturedAt"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? "";
}

function archiveCapture(src, prefix, dest) {
  if (!existsSync(src)) {
    console.log(`missing ${src}`);
    return null;
  }
  const capturedAt = capturedAtOf(src);
  const stamp = safeStamp(capturedAt || new Date().toISOString());
  const target = resolve(dest, `${prefix}-${stamp}.json`);
  if (resolve(src) !== target) copyFileSync(src, target);
  console.log(`archived ${src} -> ${target}`);
  return target;
}

archiveCapture(resolve(sourceDir, "pka_market.json"), "pka_market", captureDir);

const boostPlain = resolve(publicDataDir, "pka_boost.json");
if (existsSync(boostPlain)) archiveCapture(boostPlain, "pka_boost", publicDataDir);
archiveCapture(resolve(sourceDir, "pka_boost.json"), "pka_boost", publicDataDir);

const keep = new Set(["pka_market.json", "pka_market.json.gz", "pka_market.json.br"]);
for (const name of readdirSync(publicDataDir)) {
  if (keep.has(name)) continue;
  if (name.startsWith("pka_boost-") && (name.endsWith(".json") || name.endsWith(".json.gz") || name.endsWith(".json.br"))) continue;
  if (!name.endsWith(".json") && !name.endsWith(".gz") && !name.endsWith(".br")) continue;
  unlinkSync(resolve(publicDataDir, name));
  console.log(`removed ${name}`);
}

const built = spawnSync(process.execPath, ["--experimental-strip-types", resolve(root, "scripts/build-market.mjs")], {
  stdio: "inherit",
});
if (built.status) process.exit(built.status ?? 1);

const markets = readdirSync(captureDir).filter((name) => name.startsWith("pka_market-")).length;
const boosts = readdirSync(publicDataDir).filter((name) => name.startsWith("pka_boost-") && name.endsWith(".json")).length;
console.log(`${markets} market capture(s) em data/captures, ${boosts} boost capture(s)`);
