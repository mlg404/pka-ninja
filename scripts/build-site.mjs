/**
 * Gera os arquivos que o site baixa, a partir dos captures originais.
 *
 * Não altera, não move e não apaga pka_market-*.json. Esses arquivos continuam
 * sendo o histórico bruto (no repo pka-ninja-data, ou aqui em public/data).
 *
 *   pka_live.json      quadro atual e a série do valor do market
 *   pka_removed.json   anúncios que saíram nos últimos 7 dias
 *   pka_history.json   min/mediana/máx por nome, já reduzido
 *
 * Redução da série: 2 dias em resolução cheia, até 14 dias um ponto por hora,
 * depois um ponto por dia. No agrupamento fica o menor mínimo, o maior máximo,
 * a última mediana e a última quantidade de anúncios.
 *
 *   node scripts/build-site.mjs
 *   node scripts/build-site.mjs --dir ../caminho/dos/json
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { captureDir, hasMarketCaptures, liveDataDir, publicDataDir } from "./captures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dirFlag = args.indexOf("--dir");
const customDir = dirFlag >= 0 && args[dirFlag + 1] ? resolve(args[dirFlag + 1]) : "";

const LIVE_NAME = "pka_live.json";
const HISTORY_NAME = "pka_history.json";
const REMOVED_NAME = "pka_removed.json";
const CENSUS_COVERAGE = 0.9;
const REMOVED_KEEP_SEC = 7 * 24 * 60 * 60;
const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;

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

function resolveDirs() {
  if (customDir) return { source: customDir, output: customDir };
  const live = liveDataDir();
  if (live && hasMarketCaptures(live)) return { source: live, output: live };
  if (hasMarketCaptures(captureDir)) return { source: captureDir, output: publicDataDir };
  return { source: publicDataDir, output: publicDataDir };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function pageCoverage(data) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  let maxPage = 0;
  const seen = new Set();
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    if (typeof page.category === "number" && page.category !== 1) continue;
    if (typeof page.page === "number") seen.add(page.page);
    if (typeof page.maxPage === "number" && page.maxPage > maxPage) maxPage = page.maxPage;
  }
  if (maxPage <= 0) return Array.isArray(data.listings) && data.listings.length ? 1 : 0;
  return seen.size / maxPage;
}

function pointsFromOffers(offers) {
  const groups = new Map();
  for (const offer of offers) {
    if (!(offer.price > 0) || !offer.itemName) continue;
    const list = groups.get(offer.itemName);
    if (list) list.push(offer.price);
    else groups.set(offer.itemName, [offer.price]);
  }
  const points = [];
  for (const [name, prices] of groups) {
    prices.sort((a, b) => a - b);
    points.push({
      name,
      min: prices[0],
      median: percentile(prices, 0.5),
      max: prices[prices.length - 1],
      listings: prices.length,
    });
  }
  return points;
}

function listedValue(offers) {
  let sum = 0;
  for (const offer of offers) {
    if (offer.price > 0) sum += offer.price * Math.max(1, offer.count);
  }
  return sum;
}

function blankState() {
  return {
    points: new Map(),
    totals: [],
    live: new Map(),
    removed: new Map(),
    seenKeys: new Set(),
    used: 0,
    skipped: 0,
  };
}

function appendPoints(state, t, points) {
  for (const point of points) {
    if (!point.name || !(point.listings > 0)) continue;
    const stored = {
      t,
      min: point.min,
      median: point.median,
      max: point.max,
      listings: point.listings,
    };
    const row = state.points.get(point.name);
    if (row) row.push(stored);
    else state.points.set(point.name, [stored]);
  }
}

function foldDeduped(state, snap) {
  for (const offer of snap.offers) {
    if (!offer.itemCode) continue;
    if (offer.removed) {
      state.live.delete(offer.itemCode);
      state.removed.set(offer.itemCode, { offer, at: offer.seenAt || snap.t });
    } else {
      state.removed.delete(offer.itemCode);
      state.live.set(offer.itemCode, offer);
    }
  }
  pruneRemoved(state, snap.t);
}

function applyCensus(state, snap) {
  const next = new Map();
  for (const offer of snap.offers) {
    if (!offer.itemCode) continue;
    next.set(offer.itemCode, offer.removed ? { ...offer, removed: false } : offer);
  }
  for (const [code, offer] of state.live) {
    if (next.has(code)) continue;
    state.removed.set(code, { offer: { ...offer, removed: true }, at: snap.t });
  }
  for (const code of next.keys()) state.removed.delete(code);
  state.live = next;
  pruneRemoved(state, snap.t);
}

function pruneRemoved(state, now) {
  const limit = now - REMOVED_KEEP_SEC;
  for (const [code, slot] of state.removed) {
    if (slot.at < limit) state.removed.delete(code);
  }
}

function bucketKey(t, now) {
  const age = now - t;
  if (age <= 2 * DAY) return t;
  if (age <= 14 * DAY) return Math.floor(t / HOUR);
  return Math.floor(t / DAY);
}

function downsamplePrices(points, now) {
  const kept = [];
  let bucket = null;
  for (const point of points) {
    const key = bucketKey(point.t, now);
    if (bucket && bucket.key === key) {
      bucket.point = {
        t: point.t,
        min: Math.min(bucket.point.min, point.min),
        max: Math.max(bucket.point.max, point.max),
        median: point.median,
        listings: point.listings,
      };
    } else {
      if (bucket) kept.push(bucket.point);
      bucket = { key, point: { ...point } };
    }
  }
  if (bucket) kept.push(bucket.point);
  return kept;
}

function downsampleTotals(rows, now) {
  const kept = [];
  let bucket = null;
  for (const row of rows) {
    const key = bucketKey(row.t, now);
    if (bucket && bucket.key === key) bucket.row = row;
    else {
      if (bucket) kept.push(bucket.row);
      bucket = { key, row };
    }
  }
  if (bucket) kept.push(bucket.row);
  return kept;
}

function finishState(state) {
  const now = state.totals.length ? state.totals[state.totals.length - 1].t : 0;
  if (now) pruneRemoved(state, now);
  for (const [name, points] of state.points) {
    state.points.set(name, downsamplePrices(points, now));
  }
  state.totals = downsampleTotals(state.totals, now);
}

function offersOf(state) {
  const rows = [];
  for (const offer of state.live.values()) rows.push(offer);
  for (const slot of state.removed.values()) rows.push(slot.offer);
  return rows;
}

function keptDescription(offer) {
  const description = typeof offer.description === "string" ? offer.description.trim() : "";
  if (!description) return "";
  if (description.includes("\n") || description.length > 96) return description;
  const name = typeof offer.itemName === "string" ? offer.itemName.toLowerCase() : "";
  if (name && description.toLowerCase().includes(name) && description.length < name.length + 48) return "";
  return description;
}

function publishOffer(offer) {
  const row = {
    itemCode: offer.itemCode,
    itemName: offer.itemName,
    count: offer.count,
    price: offer.price,
    sellerName: offer.sellerName,
    server: offer.server,
  };
  if (offer.anonymous) row.anonymous = true;
  const description = keptDescription(offer);
  if (description) row.description = description;
  if (offer.pokeballType) row.pokeballType = offer.pokeballType;
  if (offer.timeleft) row.timeleft = Math.round(offer.timeleft);
  if (offer.seenAt) row.seenAt = Math.round(offer.seenAt);
  if (offer.offerSize) row.offerSize = offer.offerSize;
  for (const key of ["avg7", "min7", "max7", "count7", "avg30", "min30", "max30", "count30", "page"]) {
    if (offer[key]) row[key] = offer[key];
  }
  if (offer.removed) row.removed = true;
  return row;
}

function mergeHistories(states) {
  const merged = new Map();
  for (const state of states) {
    for (const [name, points] of state.points) {
      const row = merged.get(name);
      if (row) row.push(...points);
      else merged.set(name, points.slice());
    }
  }
  for (const points of merged.values()) points.sort((a, b) => a.t - b.t);
  return merged;
}

function viewOf(aggregateItems, statOffers, shippedOffers, histories, snapshots) {
  const latest = snapshots[snapshots.length - 1];
  const items = aggregateItems(statOffers, histories).map(({ history: _history, ...item }) => item);
  return {
    capturedAt: latest?.capturedAt ?? null,
    snapshots,
    offers: shippedOffers,
    items,
  };
}

function packHistory(state) {
  const items = {};
  const names = [...state.points.keys()].sort((a, b) => a.localeCompare(b, "pt"));
  for (const name of names) {
    const points = state.points.get(name);
    if (!points?.length) continue;
    items[name] = points.map((point) => [point.t, point.min, point.median, point.max, point.listings]);
  }
  return items;
}

function writeJson(path, body) {
  writeFileSync(path, body);
  return Buffer.byteLength(body);
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const { aggregateItems, parsePkaSnapshot, sortServers } = await loadPka();
const { source, output } = resolveDirs();
mkdirSync(output, { recursive: true });

const names = readdirSync(source)
  .filter((name) => name.startsWith("pka_market-") && name.endsWith(".json"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!names.length) {
  console.error(`Nenhum capture em ${source}`);
  process.exit(1);
}

console.log(`${names.length} capture(s) em ${source}`);
console.log(`saída em ${output} (os JSON originais não são alterados)`);

const states = new Map();
let read = 0;
let used = 0;
let skipped = 0;

for (const name of names) {
  read += 1;
  let data;
  try {
    data = JSON.parse(readFileSync(resolve(source, name), "utf8"));
  } catch (err) {
    skipped += 1;
    console.error(`ignorado ${name}: ${err instanceof Error ? err.message : err}`);
    continue;
  }
  const snap = parsePkaSnapshot(data, name);
  if (!snap) {
    skipped += 1;
    console.error(`ignorado ${name}: capture inválido`);
    continue;
  }
  const server = snap.server;
  let state = states.get(server);
  if (!state) {
    state = blankState();
    states.set(server, state);
  }
  const key = `${server}\0${snap.capturedAt}`;
  if (state.seenKeys.has(key)) {
    skipped += 1;
    console.log(`  duplicado ${name}, mantive o anterior`);
    continue;
  }
  state.seenKeys.add(key);

  const coverage = pageCoverage(data);
  const census = !snap.deduped && snap.offers.length > 0 && coverage >= CENSUS_COVERAGE;
  if (snap.deduped && snap.priceHistory) {
    appendPoints(state, snap.t, snap.priceHistory);
    if (typeof snap.fullMarketValue === "number") {
      state.totals.push({
        t: snap.t,
        capturedAt: snap.capturedAt,
        server,
        value: snap.fullMarketValue,
      });
    }
    foldDeduped(state, snap);
    state.used += 1;
    used += 1;
  } else if (census) {
    appendPoints(state, snap.t, pointsFromOffers(snap.offers));
    state.totals.push({
      t: snap.t,
      capturedAt: snap.capturedAt,
      server,
      value: typeof snap.fullMarketValue === "number" ? snap.fullMarketValue : listedValue(snap.offers),
    });
    applyCensus(state, snap);
    state.used += 1;
    used += 1;
  } else {
    state.skipped += 1;
    skipped += 1;
    console.log(
      `  parcial ${name}: cobertura ${(coverage * 100).toFixed(0)}%. Não entrou no quadro nem na série.`,
    );
  }
  if (read % 20 === 0 || read === names.length) {
    console.log(`  ${read}/${names.length}`);
  }
}

const servers = sortServers([...states.keys()].filter(Boolean));
for (const state of states.values()) finishState(state);

const byServer = {};
const historyByServer = {};
const removedByServer = {};
for (const server of servers) {
  const state = states.get(server);
  if (!state) continue;
  const live = [...state.live.values()].map(publishOffer);
  byServer[server] = viewOf(aggregateItems, offersOf(state), live, state.points, state.totals);
  historyByServer[server] = packHistory(state);
  removedByServer[server] = [...state.removed.values()].map((slot) => publishOffer(slot.offer));
  console.log(
    `${server}: ${state.used} capture(s), ${state.live.size} no market, ${state.removed.size} saíram nos últimos 7 dias, ${state.totals.length} pontos de valor`,
  );
}

const unnamed = states.get("");
const groups = servers.map((server) => states.get(server)).filter(Boolean);
if (unnamed) groups.push(unnamed);
const allOffers = groups.flatMap((state) => offersOf(state));
const allSnapshots = groups
  .flatMap((state) => state.totals)
  .sort((a, b) => a.t - b.t || a.capturedAt.localeCompare(b.capturedAt));
const allHistories = mergeHistories(groups);

const liveBody = `${JSON.stringify({
  version: 2,
  servers,
  all: viewOf(aggregateItems, allOffers, [], allHistories, allSnapshots),
  byServer,
})}\n`;
const historyBody = `${JSON.stringify({ version: 1, byServer: historyByServer })}\n`;
const removedBody = `${JSON.stringify({ version: 1, byServer: removedByServer })}\n`;

const liveBytes = writeJson(resolve(output, LIVE_NAME), liveBody);
const historyBytes = writeJson(resolve(output, HISTORY_NAME), historyBody);
const removedBytes = writeJson(resolve(output, REMOVED_NAME), removedBody);

console.log(
  `\n${used} capture(s) usados, ${skipped} ignorado(s). Os originais em ${source} ficaram como estavam.`,
);
console.log(`${LIVE_NAME}: ${mb(liveBytes)}`);
console.log(`${REMOVED_NAME}: ${mb(removedBytes)}`);
console.log(`${HISTORY_NAME}: ${mb(historyBytes)}`);
