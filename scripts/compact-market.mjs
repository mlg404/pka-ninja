/**
 * Remove anúncios que já apareceram num capture anterior do mesmo servidor.
 *
 * O itemCode é o registro da loja. A primeira vez que ele aparece fica no JSON
 * daquele capture. Os arquivos seguintes perdem essa linha. A cópia que fica
 * recebe os dados da última vez que o código foi visto (quantidade e prazo).
 * Se o capture mais recente do servidor não tem mais o código, essa linha
 * ganha "removed": true: expirou, foi comprado ou saiu do market.
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
import { closeSync, openSync, readFileSync, readSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adoptPublicCaptures, captureDir, hasMarketCaptures, liveDataDir, publicDataDir } from "./captures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const write = args.includes("--write");
const dirFlag = args.indexOf("--dir");
const customDir = dirFlag >= 0 && args[dirFlag + 1] ? resolve(args[dirFlag + 1]) : "";
const live = customDir ? null : liveDataDir();
if (write && !customDir && !live) adoptPublicCaptures();
const destDir = customDir || live || (hasMarketCaptures(captureDir) || write ? captureDir : publicDataDir);

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

function pageStats(data) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  let maxPage = 0;
  const seen = new Set();
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    if (typeof page.category === "number" && page.category !== 1) continue;
    if (typeof page.page === "number") seen.add(page.page);
    if (typeof page.maxPage === "number" && page.maxPage > maxPage) maxPage = page.maxPage;
  }
  return { seen: seen.size, maxPage };
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

function serverTag(path) {
  const size = statSync(path).size;
  const fd = openSync(path, "r");
  const buf = Buffer.alloc(Math.min(1024 * 1024, size));
  let offset = 0;
  let pending = "";
  try {
    while (offset < size) {
      const n = readSync(fd, buf, 0, buf.length, offset);
      if (!n) break;
      offset += n;
      const text = pending + buf.toString("utf8", 0, n);
      const match = text.match(/"server"\s*:\s*"([^"]+)"/);
      if (match) return match[1];
      pending = text.slice(-40);
    }
  } finally {
    closeSync(fd);
  }
  return "";
}

function loadMarket(name) {
  const path = resolve(destDir, name);
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`ignorado ${name}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
  if (!data || typeof data !== "object" || typeof data.capturedAt !== "string" || !Array.isArray(data.listings)) {
    console.error(`ignorado ${name}: sem capturedAt ou listings`);
    return null;
  }
  return { name, path, bytes: statSync(path).size, data };
}

function compactGroup(files) {
  const latest = files[files.length - 1];
  const stats = pageStats(latest.data);
  const coverage = stats.maxPage > 0 ? stats.seen / stats.maxPage : 1;
  let census = null;
  if (latest.data.deduped === true) {
    console.log("  último capture já está enxuto; as flags removed ficam como estão");
  } else if (!latest.data.listings.length || coverage < 0.9) {
    console.log(
      `  último capture com ${stats.seen}/${stats.maxPage} páginas. Não marquei saídas para não apagar o market por um capture pela metade.`,
    );
  } else {
    census = {
      t: capturedUnix(latest.data.capturedAt),
      codes: new Set(latest.data.listings.map(itemCode).filter(Boolean)),
    };
    if (stats.seen < stats.maxPage) {
      console.log(
        `  último capture com ${stats.seen}/${stats.maxPage} páginas. Algumas listagens dessas páginas faltantes podem ser marcadas como saídas.`,
      );
    }
  }

  const keptByCode = new Map();
  const prepared = [];
  for (const file of files) {
    file.touched = false;
    const original = file.data.listings;
    const already = file.data.deduped === true && Array.isArray(file.data.priceHistory);
    const priceHistory = already ? file.data.priceHistory : priceHistoryOf(original);
    const kept = [];
    let dropped = 0;
    for (const row of original) {
      if (!row || typeof row !== "object") continue;
      const code = itemCode(row);
      if (!code) {
        kept.push(row);
        continue;
      }
      const previous = keptByCode.get(code);
      if (previous) {
        Object.assign(previous.row, row);
        delete previous.row.removed;
        previous.file.touched = true;
        dropped += 1;
        continue;
      }
      keptByCode.set(code, { row, file });
      kept.push(row);
    }
    prepared.push({ file, kept, dropped, priceHistory, before: original.length });
  }

  let markedRemoved = 0;
  if (census) {
    for (const slot of keptByCode.values()) {
      const code = itemCode(slot.row);
      if (!census.codes.has(code)) {
        if (slot.row.removed !== true) markedRemoved += 1;
        slot.row.removed = true;
        slot.file.touched = true;
      } else if (slot.row.removed === true) {
        delete slot.row.removed;
        slot.file.touched = true;
      }
    }
  }

  const reports = [];
  for (const item of prepared) {
    const changed = item.dropped > 0 || item.file.data.deduped !== true || item.file.touched;
    let bytesAfter = item.file.bytes;
    if (changed) {
      const next = {
        ...item.file.data,
        listings: item.kept,
        listingCount: item.kept.length,
        deduped: true,
        priceHistory: item.priceHistory,
      };
      const body = `${JSON.stringify(next)}\n`;
      bytesAfter = Buffer.byteLength(body);
      if (write) {
        const tmp = `${item.file.path}.tmp`;
        writeFileSync(tmp, body);
        try {
          unlinkSync(item.file.path);
        } catch {
          /* replaced below */
        }
        renameSync(tmp, item.file.path);
      }
    }
    reports.push({
      name: item.file.name,
      server: typeof item.file.data.server === "string" ? item.file.data.server : "",
      before: item.before,
      after: item.kept.length,
      dropped: item.dropped,
      markedRemoved,
      bytes: item.file.bytes,
      bytesAfter,
      changed,
    });
  }
  return reports;
}

const names = readdirSync(destDir)
  .filter((name) => name.startsWith("pka_market-") && name.endsWith(".json"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!names.length) {
  console.error(`Nenhum pka_market-*.json em ${destDir}`);
  process.exit(1);
}

const groups = new Map();
for (const name of names) {
  const server = serverTag(resolve(destDir, name));
  const list = groups.get(server);
  if (list) list.push(name);
  else groups.set(server, [name]);
}

console.log(`${write ? "gravando" : "simulação"} em ${destDir}`);
let beforeListings = 0;
let afterListings = 0;
let beforeBytes = 0;
let afterBytes = 0;
let droppedTotal = 0;
let removedTotal = 0;

for (const [server, groupNames] of groups) {
  const files = [];
  for (const name of groupNames) {
    const file = loadMarket(name);
    if (file) files.push(file);
  }
  files.sort((a, b) => a.data.capturedAt.localeCompare(b.data.capturedAt) || a.name.localeCompare(b.name));
  console.log(`\n${server || "(sem servidor)"} — ${files.length} capture(s)`);
  const reports = compactGroup(files);
  removedTotal += reports[0]?.markedRemoved ?? 0;
  for (const report of reports) {
    beforeListings += report.before;
    afterListings += report.after;
    beforeBytes += report.bytes;
    afterBytes += report.bytesAfter;
    droppedTotal += report.dropped;
    const size = report.changed ? ` → ${(report.bytesAfter / 1024 / 1024).toFixed(1)} MB` : "";
    console.log(
      `  ${report.name}: ${report.before} → ${report.after} anúncios, ${report.dropped} repetidos tirados${size}`,
    );
  }
  if (reports[0]?.markedRemoved) console.log(`  ${reports[0].markedRemoved} anúncios marcados como saíram`);
}

console.log(
  `\n${beforeListings} → ${afterListings} anúncios. ${droppedTotal} repetidos. ${removedTotal} marcados como saíram.` +
    `\n${(beforeBytes / 1024 / 1024).toFixed(1)} MB → ${(afterBytes / 1024 / 1024).toFixed(1)} MB.`,
);
if (!write) {
  console.log("Nada foi gravado. Rode de novo com --write para aplicar.");
} else if (!customDir) {
  const built = spawnSync(process.execPath, [resolve(root, "scripts/build-market.mjs")], {
    stdio: "inherit",
  });
  if (built.status) process.exit(built.status);
}
