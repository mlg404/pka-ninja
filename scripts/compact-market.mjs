/**
 * Remove anúncios que já apareceram num capture anterior do mesmo servidor.
 *
 * O itemCode é o registro da loja. A primeira vez que ele aparece fica no JSON
 * daquele capture. Os arquivos seguintes perdem essa linha. Se o último capture
 * completo não tem mais o código, e o prazo ainda não acabou, a primeira linha
 * ganha "removed": true (vendido ou retirado antes da hora).
 *
 * Não mexe em pka_boost nem no sync. Arquivo novo continua chegando inteiro.
 * Rode de novo depois, quando quiser enxugar.
 *
 *   node scripts/compact-market.mjs
 *   node scripts/compact-market.mjs --write
 *   node scripts/compact-market.mjs --write --dir ../caminho/dos/json
 *
 * Sem --write só mostra o que mudaria.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adoptPublicCaptures, captureDir, hasMarketCaptures, publicDataDir } from "./captures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const write = args.includes("--write");
const dirFlag = args.indexOf("--dir");
const customDir = dirFlag >= 0 && args[dirFlag + 1] ? resolve(args[dirFlag + 1]) : "";
if (write && !customDir) adoptPublicCaptures();
const destDir = customDir || (hasMarketCaptures(captureDir) || write ? captureDir : publicDataDir);

const ARCANE_KIND = /mysterious\s+(.+?)(?:\s+den\b|\s*\.\s*rarity\b)/i;

function fold(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function offerName(itemName, description) {
  if (fold(itemName) !== "arcane shard") return itemName;
  const match = String(description || "").match(ARCANE_KIND);
  if (!match) return itemName;
  const kind = match[1].trim().replace(/['’]s$/i, "");
  return kind ? `Arcane Shard - ${kind}` : itemName;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function itemCode(row) {
  const code = row?.itemCode;
  if (typeof code === "string") return code.trim();
  if (typeof code === "number" && Number.isFinite(code)) return String(code);
  return "";
}

function capturedUnix(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function expiry(row) {
  const seen = Number(row?.seenAt);
  const left = Number(row?.timeleft);
  if (!Number.isFinite(seen) || seen <= 0) return 0;
  return seen + (Number.isFinite(left) ? Math.max(0, left) : 0);
}

function isComplete(data) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  let maxPage = 0;
  const seen = new Set();
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    if (typeof page.category === "number" && page.category !== 1) continue;
    if (typeof page.page === "number") seen.add(page.page);
    if (typeof page.maxPage === "number" && page.maxPage > maxPage) maxPage = page.maxPage;
  }
  return maxPage > 0 && seen.size >= maxPage;
}

function priceHistoryOf(listings) {
  const groups = new Map();
  for (const row of listings) {
    const price = Number(row?.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const name = offerName(typeof row.item_name === "string" ? row.item_name : "", row.description);
    if (!name) continue;
    const list = groups.get(name);
    if (list) list.push(price);
    else groups.set(name, [price]);
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
  points.sort((a, b) => a.name.localeCompare(b.name, "pt"));
  return points;
}

function loadMarkets() {
  const names = readdirSync(destDir)
    .filter((name) => name.startsWith("pka_market-") && name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const files = [];
  for (const name of names) {
    const path = resolve(destDir, name);
    let data;
    try {
      data = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      console.error(`ignorado ${name}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (!data || typeof data !== "object" || typeof data.capturedAt !== "string" || !Array.isArray(data.listings)) {
      console.error(`ignorado ${name}: sem capturedAt ou listings`);
      continue;
    }
    files.push({ name, path, bytes: statSync(path).size, data });
  }
  files.sort((a, b) => a.data.capturedAt.localeCompare(b.data.capturedAt) || a.name.localeCompare(b.name));
  return files;
}

function compactGroup(files) {
  const latest = files[files.length - 1];
  const census =
    latest.data.deduped === true || !isComplete(latest.data)
      ? null
      : {
          t: capturedUnix(latest.data.capturedAt),
          codes: new Set(latest.data.listings.map(itemCode).filter(Boolean)),
        };
  const seen = new Set();
  const reports = [];

  for (const file of files) {
    const original = file.data.listings;
    const already = file.data.deduped === true && Array.isArray(file.data.priceHistory);
    const priceHistory = already ? file.data.priceHistory : priceHistoryOf(original);
    const kept = [];
    let dropped = 0;
    let markedRemoved = 0;
    let clearedRemoved = 0;

    for (const row of original) {
      if (!row || typeof row !== "object") continue;
      const code = itemCode(row);
      if (!code) {
        kept.push(row);
        continue;
      }
      if (seen.has(code)) {
        dropped += 1;
        continue;
      }
      seen.add(code);
      if (census) {
        const stillListed = expiry(row) > census.t;
        const gone = stillListed && !census.codes.has(code);
        if (gone && row.removed !== true) {
          row.removed = true;
          markedRemoved += 1;
        } else if (!gone && row.removed === true) {
          delete row.removed;
          clearedRemoved += 1;
        }
      }
      kept.push(row);
    }

    const changed = dropped > 0 || file.data.deduped !== true || markedRemoved > 0 || clearedRemoved > 0;
    let bytesAfter = file.bytes;
    if (changed) {
      const next = {
        ...file.data,
        listings: kept,
        listingCount: kept.length,
        deduped: true,
        priceHistory,
      };
      const body = `${JSON.stringify(next)}\n`;
      bytesAfter = Buffer.byteLength(body);
      if (write) {
        const tmp = `${file.path}.tmp`;
        writeFileSync(tmp, body);
        try {
          unlinkSync(file.path);
        } catch {
          /* replaced below */
        }
        renameSync(tmp, file.path);
      }
    }
    reports.push({
      name: file.name,
      server: typeof file.data.server === "string" ? file.data.server : "",
      before: original.length,
      after: kept.length,
      dropped,
      markedRemoved,
      bytes: file.bytes,
      bytesAfter,
      changed,
    });
  }

  return reports;
}

const files = loadMarkets();
if (!files.length) {
  console.error(`Nenhum pka_market-*.json em ${destDir}`);
  process.exit(1);
}

const groups = new Map();
for (const file of files) {
  const server = typeof file.data.server === "string" ? file.data.server : "";
  const list = groups.get(server);
  if (list) list.push(file);
  else groups.set(server, [file]);
}

console.log(`${write ? "gravando" : "simulação"} em ${destDir}`);
let beforeListings = 0;
let afterListings = 0;
let beforeBytes = 0;
let afterBytes = 0;
let droppedTotal = 0;
let removedTotal = 0;

for (const [server, group] of groups) {
  console.log(`\n${server || "(sem servidor)"} — ${group.length} capture(s)`);
  for (const report of compactGroup(group)) {
    beforeListings += report.before;
    afterListings += report.after;
    beforeBytes += report.bytes;
    afterBytes += report.bytesAfter;
    droppedTotal += report.dropped;
    removedTotal += report.markedRemoved;
    const size = report.bytesAfter != null ? ` → ${(report.bytesAfter / 1024 / 1024).toFixed(1)} MB` : "";
    console.log(
      `  ${report.name}: ${report.before} → ${report.after} anúncios, ${report.dropped} repetidos tirados` +
        (report.markedRemoved ? `, ${report.markedRemoved} marcados como saíram` : "") +
        `${size}`,
    );
  }
}

console.log(
  `\n${beforeListings} → ${afterListings} anúncios. ${droppedTotal} repetidos. ${removedTotal} saíram antes do prazo.` +
    `\n${(beforeBytes / 1024 / 1024).toFixed(1)} MB → ${(afterBytes / 1024 / 1024).toFixed(1)} MB.`,
);
if (!write) {
  console.log("Nada foi gravado. Rode de novo com --write para aplicar.");
} else if (!customDir) {
  const built = spawnSync(process.execPath, ["--experimental-strip-types", resolve(root, "scripts/build-market.mjs")], {
    stdio: "inherit",
  });
  if (built.status) process.exit(built.status);
}
