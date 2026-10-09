/**
 * Junta os captures num único pka_market.json e grava gzip e brotli.
 * No servidor, lê e grava /var/www/pka.ninja/data sem mover os arquivos do outro repositório.
 *
 *   node scripts/build-market.mjs
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { adoptPublicCaptures, captureDir, ensureCaptureDirs, liveDataDir, publicDataDir } from "./captures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadPka() {
  const outDir = resolve(root, "scripts/.cache");
  mkdirSync(outDir, { recursive: true });
  const tsc = resolve(root, "node_modules/typescript/bin/tsc");
  const compiled = spawnSync(
    process.execPath,
    [tsc, "--pretty", "false", "-p", resolve(root, "scripts/pka.tsconfig.json")],
    { cwd: root, stdio: "inherit" },
  );
  if (compiled.status) process.exit(compiled.status ?? 1);
  return import(pathToFileURL(resolve(outDir, "pka.js")).href);
}

const AGGREGATE = "pka_market.json";

function listedValue(snapshot) {
  if (typeof snapshot.fullMarketValue === "number") return snapshot.fullMarketValue;
  let sum = 0;
  for (const offer of snapshot.offers) {
    if (offer.price > 0) sum += offer.price * Math.max(1, offer.count);
  }
  return sum;
}

function viewOf(snapshots) {
  const market = buildMarket(snapshots);
  const latest = snapshots[snapshots.length - 1];
  return {
    capturedAt: latest?.capturedAt ?? null,
    snapshots: snapshots.map((snapshot) => ({
      t: snapshot.t,
      capturedAt: snapshot.capturedAt,
      server: snapshot.server,
      value: listedValue(snapshot),
    })),
    offers: market.offers,
    items: market.items,
  };
}

function loadCaptures(dir, parsePkaSnapshot, dedupeSnapshots) {
  const names = readdirSync(dir)
    .filter((name) => name.startsWith("pka_market-") && name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const snapshots = [];
  for (const name of names) {
    const path = resolve(dir, name);
    let data;
    try {
      data = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      console.error(`ignorado ${name}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const snapshot = parsePkaSnapshot(data, name);
    if (!snapshot) {
      console.error(`ignorado ${name}: capture inválido`);
      continue;
    }
    snapshots.push(snapshot);
  }
  return dedupeSnapshots(snapshots);
}

function compressed(buf) {
  const gz = gzipSync(buf, { level: 6 });
  const br = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } });
  return { gz, br };
}

function writeCompressed(path, body) {
  const buf = Buffer.from(body);
  const { gz, br } = compressed(buf);
  writeFileSync(path, buf);
  writeFileSync(`${path}.gz`, gz);
  writeFileSync(`${path}.br`, br);
  return { raw: buf.length, gz: gz.length, br: br.length };
}

function compressExisting(dir, name) {
  const path = resolve(dir, name);
  const body = readFileSync(path);
  const { gz, br } = compressed(body);
  writeFileSync(`${path}.gz`, gz);
  writeFileSync(`${path}.br`, br);
  console.log(`${name}: ${(body.length / 1024 / 1024).toFixed(1)} MB, gzip ${(gz.length / 1024 / 1024).toFixed(1)} MB, brotli ${(br.length / 1024 / 1024).toFixed(1)} MB`);
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const { buildMarket, dedupeSnapshots, parsePkaSnapshot, sortServers } = await loadPka();

const live = liveDataDir();
let sourceDir = captureDir;
let outputDir = publicDataDir;
if (live) {
  sourceDir = live;
  outputDir = live;
  console.log(`captures do site: ${live}`);
} else {
  ensureCaptureDirs();
  const moved = adoptPublicCaptures();
  if (moved.length) console.log(`captures fora do site: ${moved.length} arquivo(s) em data/captures`);
}

const snapshots = loadCaptures(sourceDir, parsePkaSnapshot, dedupeSnapshots);
if (!snapshots.length) {
  console.error(`Nenhum capture em ${sourceDir}`);
  process.exit(1);
}

const servers = sortServers(new Set(snapshots.map((row) => row.server).filter(Boolean)));
const byServer = {};
if (servers.length > 1) {
  for (const server of servers) {
    const group = snapshots.filter((row) => row.server === server);
    if (group.length) byServer[server] = viewOf(group);
  }
}

const payload = {
  version: 1,
  servers,
  all: viewOf(snapshots),
  byServer,
};
const body = `${JSON.stringify(payload)}\n`;
const out = resolve(outputDir, AGGREGATE);
const sizes = writeCompressed(out, body);
console.log(
  `${AGGREGATE}: ${snapshots.length} capture(s), ${payload.all.offers.length} anúncios, ${payload.all.items.length} nomes`,
);
console.log(`  json ${mb(sizes.raw)}, gzip ${mb(sizes.gz)}, brotli ${mb(sizes.br)}`);

for (const name of readdirSync(outputDir)) {
  if (!name.startsWith("pka_boost-") || !name.endsWith(".json")) continue;
  compressExisting(outputDir, name);
}
