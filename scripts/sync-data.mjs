import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const captureDir = resolve(root, "../../pxg-tyramel/captures");
const destDir = resolve(root, "public/data");

mkdirSync(destDir, { recursive: true });

function safeStamp(value) {
  return value.replace(/[:.+]/g, "-");
}

function capturedAtOf(path) {
  const head = readFileSync(path, "utf8").slice(0, 500);
  const match = head.match(/"capturedAt"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? "";
}

function archiveCapture(src, prefix) {
  if (!existsSync(src)) {
    console.log(`missing ${src}`);
    return null;
  }
  const capturedAt = capturedAtOf(src);
  const stamp = safeStamp(capturedAt || new Date().toISOString());
  const dest = resolve(destDir, `${prefix}-${stamp}.json`);
  if (resolve(src) !== dest) copyFileSync(src, dest);
  console.log(`archived ${src} -> ${dest}`);
  return dest;
}

const plain = resolve(destDir, "pka_market.json");
if (existsSync(plain)) {
  archiveCapture(plain, "pka_market");
  unlinkSync(plain);
  console.log(`removed unstamped ${plain}`);
}

archiveCapture(resolve(captureDir, "pka_market.json"), "pka_market");

const boostPlain = resolve(destDir, "pka_boost.json");
if (existsSync(boostPlain)) archiveCapture(boostPlain, "pka_boost");
archiveCapture(resolve(captureDir, "pka_boost.json"), "pka_boost");

for (const name of readdirSync(destDir)) {
  if (!name.endsWith(".json")) continue;
  if (name.startsWith("pka_market-") || name.startsWith("pka_boost-")) continue;
  unlinkSync(resolve(destDir, name));
  console.log(`removed ${name}`);
}

const markets = readdirSync(destDir).filter((name) => name.startsWith("pka_market-")).length;
const boosts = readdirSync(destDir).filter((name) => name.startsWith("pka_boost-")).length;
console.log(`${markets} market capture(s), ${boosts} boost capture(s)`);
