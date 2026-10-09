/** One PokeAlliance market offer, as written in `pka_market.json`. */

export type PkaOffer = {
  itemCode: string;
  itemName: string;
  count: number;
  price: number;
  sellerName: string;
  anonymous: boolean;
  description: string;
  pokeballType: string;
  timeleft: number;
  seenAt: number;
  offerSize: number;
  avg7: number;
  min7: number;
  max7: number;
  count7: number;
  avg30: number;
  min30: number;
  max30: number;
  count30: number;
  page: number;
  /** Capture server, empty when the file has no `server` field. */
  server: string;
  /** True when a later complete capture no longer contains this offer. */
  removed: boolean;
};

export type PkaKind = "pokemon" | "items";

export type PkaCategory = "all" | PkaKind;

export const PKA_CATEGORIES: { id: PkaCategory; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pokemon", label: "Pokémon" },
  { id: "items", label: "Itens" },
];

/** One row per `item_name`. Price stats come from the offers; 7d/30d come from the file. */
export type PkaItem = {
  name: string;
  kind: PkaKind;
  listings: number;
  quantity: number;
  min: number;
  median: number;
  max: number;
  totalValue: number;
  avg7: number | null;
  count7: number | null;
  avg30: number | null;
  min30: number | null;
  max30: number | null;
  count30: number | null;
  balls: string[];
  description: string;
  /** Offers still on the latest market. */
  active: number;
  history: PricePoint[];
  spark: number[];
  changePct: number | null;
  cheapestChangePct: number | null;
  spreadPct: number;
};

export type PricePoint = {
  t: number;
  min: number;
  median: number;
  max: number;
  listings: number;
};

/** Precomputed prices for one capture, kept when duplicate listings are stripped. */
export type SnapshotPrices = {
  name: string;
  min: number;
  median: number;
  max: number;
  listings: number;
};

export type PkaSnapshot = {
  file: string;
  capturedAt: string;
  t: number;
  /** Empty when the capture was saved before servers were recorded. */
  server: string;
  complete: boolean;
  /**
   * True after `compact-market` removed listings already stored in an earlier file.
   * A deduped file is not a full census of the market.
   */
  deduped: boolean;
  priceHistory: SnapshotPrices[] | null;
  /** Listed value of the whole capture, saved before duplicate listings were removed. */
  fullMarketValue: number | null;
  offers: PkaOffer[];
};

const SERVER_ORDER = ["Moon", "Sun", "Titan", "Titan2", "Titan3", "Eclipse"];

export function sortServers(names: Iterable<string>): string[] {
  return [...names].sort((a, b) => {
    const ia = SERVER_ORDER.indexOf(a);
    const ib = SERVER_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.localeCompare(b, "pt");
  });
}

export type ExpiredFilter = "all" | "active" | "expired";
export type OfferStatus = "active" | "expired" | "removed";

export type PkaMarket = {
  capturedAt: string;
  offers: PkaOffer[];
  items: PkaItem[];
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function offerKind(offer: PkaOffer): PkaKind {
  return offer.pokeballType ? "pokemon" : "items";
}

export function lineTotal(offer: PkaOffer): number {
  return offer.price * Math.max(1, offer.count);
}

export function itemPath(name: string): string {
  return `/items/${encodeURIComponent(name)}`;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function shared(values: number[]): number | null {
  if (!values.length) return null;
  const first = values[0];
  return values.every((value) => value === first) ? first : null;
}

const ARCANE_KIND = /mysterious\s+(.+?)(?:\s+den\b|\s*\.\s*rarity\b)/i;

/** Arcane Shards share one item name. The den in the description is the real type. */
function offerName(itemName: string, description: string): string {
  if (fold(itemName) !== "arcane shard") return itemName;
  const match = description.match(ARCANE_KIND);
  if (!match) return itemName;
  const kind = match[1].trim().replace(/['’]s$/i, "");
  return kind ? `Arcane Shard - ${kind}` : itemName;
}

function toOffer(raw: Record<string, unknown>, index: number, server = ""): PkaOffer | null {
  const rawName = text(raw.item_name);
  if (!rawName) return null;
  const description = typeof raw.description === "string" ? raw.description : "";
  const itemName = offerName(rawName, description);
  return {
    itemCode: text(raw.itemCode) || `${itemName}:${index}`,
    itemName,
    count: num(raw.count) ?? 0,
    price: num(raw.price) ?? 0,
    sellerName: text(raw.seller_name) || "—",
    anonymous: raw.anonymous === true,
    description,
    pokeballType: text(raw.pokeballType),
    timeleft: num(raw.timeleft) ?? 0,
    seenAt: num(raw.seenAt) ?? 0,
    offerSize: num(raw.offerSize) ?? 0,
    avg7: num(raw.avg7) ?? 0,
    min7: num(raw.min7) ?? 0,
    max7: num(raw.max7) ?? 0,
    count7: num(raw.count7) ?? 0,
    avg30: num(raw.avg30) ?? 0,
    min30: num(raw.min30) ?? 0,
    max30: num(raw.max30) ?? 0,
    count30: num(raw.count30) ?? 0,
    page: num(raw.page) ?? 0,
    server,
    removed: raw.removed === true,
  };
}

export function aggregateItems(offers: PkaOffer[], histories?: Map<string, PricePoint[]>): PkaItem[] {
  const groups = new Map<string, PkaOffer[]>();
  for (const offer of offers) {
    const list = groups.get(offer.itemName);
    if (list) list.push(offer);
    else groups.set(offer.itemName, [offer]);
  }

  const items: PkaItem[] = [];
  for (const [name, group] of groups) {
    const balls = [...new Set(group.map((offer) => offer.pokeballType).filter(Boolean))].sort();
    const descriptions = new Map<string, number>();
    for (const offer of group) {
      if (!offer.description) continue;
      descriptions.set(offer.description, (descriptions.get(offer.description) ?? 0) + 1);
    }
    const description =
      [...descriptions.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] ?? "";
    const count30 = shared(group.map((offer) => offer.count30));
    const count7 = shared(group.map((offer) => offer.count7));
    const live = group.filter((offer) => isOnMarket(offer));
    const livePrices = live.map((offer) => offer.price).filter((price) => price > 0).sort((a, b) => a - b);
    const history = histories?.get(name) ?? [];
    items.push({
      name,
      kind: group.some((offer) => offer.pokeballType) ? "pokemon" : "items",
      listings: group.length,
      quantity: live.reduce((sum, offer) => sum + Math.max(0, offer.count), 0),
      min: livePrices[0] ?? 0,
      median: percentile(livePrices, 0.5),
      max: livePrices[livePrices.length - 1] ?? 0,
      totalValue: live.reduce((sum, offer) => sum + (offer.price > 0 ? lineTotal(offer) : 0), 0),
      active: live.length,
      avg7: count7 && count7 > 0 ? shared(group.map((offer) => offer.avg7)) : count7 === 0 ? null : shared(group.map((offer) => offer.avg7)),
      count7,
      avg30: count30 && count30 > 0 ? shared(group.map((offer) => offer.avg30)) : count30 === 0 ? null : shared(group.map((offer) => offer.avg30)),
      min30: count30 && count30 > 0 ? shared(group.map((offer) => offer.min30)) : null,
      max30: count30 && count30 > 0 ? shared(group.map((offer) => offer.max30)) : null,
      count30,
      balls,
      description,
      history,
      spark: history.map((point) => point.median).filter((value) => value > 0),
      changePct: fieldChangePct(history, "median"),
      cheapestChangePct: fieldChangePct(history, "min"),
      spreadPct:
        livePrices.length > 1 && livePrices[0] > 0
          ? ((livePrices[livePrices.length - 1] - livePrices[0]) / livePrices[0]) * 100
          : 0,
    });
  }
  return items.sort((a, b) => b.active - a.active || b.listings - a.listings || a.name.localeCompare(b.name));
}

function fieldChangePct(history: PricePoint[], field: "median" | "min"): number | null {
  const priced = history.filter((point) => point[field] > 0);
  if (priced.length < 2) return null;
  const first = priced[0][field];
  const last = priced[priced.length - 1][field];
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

export type OpportunityKind = "sell" | "buy";

export function opportunityItems(items: PkaItem[], kind: OpportunityKind): PkaItem[] {
  const rows = items.filter(
    (item) => item.kind !== "pokemon" && item.cheapestChangePct != null && item.active > 0 && item.min > 0,
  );
  if (kind === "sell") {
    return rows
      .filter((item) => (item.cheapestChangePct ?? 0) > 0)
      .sort((a, b) => (b.cheapestChangePct ?? 0) - (a.cheapestChangePct ?? 0));
  }
  return rows
    .filter((item) => (item.cheapestChangePct ?? 0) < 0)
    .sort((a, b) => (a.cheapestChangePct ?? 0) - (b.cheapestChangePct ?? 0));
}

export function snapshotUnix(capturedAt: string): number {
  const ms = Date.parse(capturedAt);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

export function sortSnapshots(snapshots: PkaSnapshot[]): PkaSnapshot[] {
  return [...snapshots].sort((a, b) => a.t - b.t || a.capturedAt.localeCompare(b.capturedAt));
}

export function dedupeSnapshots(snapshots: PkaSnapshot[]): PkaSnapshot[] {
  const byKey = new Map<string, PkaSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.server}\0${snapshot.capturedAt}`;
    const existing = byKey.get(key);
    if (!existing || snapshot.offers.length > existing.offers.length) byKey.set(key, snapshot);
  }
  return sortSnapshots([...byKey.values()]);
}

function categoryPages(data: unknown): { seen: number; maxPage: number } {
  if (!data || typeof data !== "object") return { seen: 0, maxPage: 0 };
  const pages = (data as { pages?: unknown }).pages;
  if (!Array.isArray(pages) || !pages.length) return { seen: 0, maxPage: 0 };
  let maxPage = 0;
  const seen = new Set<number>();
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const row = page as { category?: unknown; page?: unknown; maxPage?: unknown };
    if (typeof row.category === "number" && row.category !== 1) continue;
    if (typeof row.page === "number") seen.add(row.page);
    if (typeof row.maxPage === "number" && row.maxPage > maxPage) maxPage = row.maxPage;
  }
  return { seen: seen.size, maxPage };
}

function snapshotComplete(data: unknown): boolean {
  const { seen, maxPage } = categoryPages(data);
  return maxPage > 0 && seen >= maxPage;
}

export function parsePkaSnapshot(data: unknown, file = ""): PkaSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { capturedAt?: unknown; listings?: unknown; server?: unknown };
  if (typeof row.capturedAt !== "string" || !Array.isArray(row.listings)) return null;
  const server = text(row.server);
  const offers: PkaOffer[] = [];
  row.listings.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const offer = toOffer(entry as Record<string, unknown>, index, server);
    if (offer) offers.push(offer);
  });
  const deduped = (data as { deduped?: unknown }).deduped === true;
  return {
    file,
    capturedAt: row.capturedAt,
    t: snapshotUnix(row.capturedAt),
    server,
    complete: snapshotComplete(data),
    deduped,
    priceHistory: deduped ? parsePriceHistory((data as { priceHistory?: unknown }).priceHistory) : null,
    fullMarketValue: parseFullMarketValue(data),
    offers,
  };
}

function parseFullMarketValue(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const market = (data as { fullMarket?: unknown }).fullMarket;
  if (!market || typeof market !== "object") return null;
  const value = (market as { value?: unknown }).value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePriceHistory(value: unknown): SnapshotPrices[] | null {
  if (!Array.isArray(value)) return null;
  const points: SnapshotPrices[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { name?: unknown; min?: unknown; median?: unknown; max?: unknown; listings?: unknown };
    const name = text(row.name);
    if (!name) continue;
    points.push({
      name,
      min: num(row.min) ?? 0,
      median: num(row.median) ?? 0,
      max: num(row.max) ?? 0,
      listings: num(row.listings) ?? 0,
    });
  }
  return points;
}

function pointsFromOffers(snapshot: PkaSnapshot): SnapshotPrices[] {
  const groups = new Map<string, number[]>();
  for (const offer of snapshot.offers) {
    if (offer.price <= 0) continue;
    const list = groups.get(offer.itemName);
    if (list) list.push(offer.price);
    else groups.set(offer.itemName, [offer.price]);
  }
  const points: SnapshotPrices[] = [];
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

function priceHistories(snapshots: PkaSnapshot[]): Map<string, PricePoint[]> {
  const series = new Map<string, PricePoint[]>();
  for (const snapshot of snapshots) {
    const points = snapshot.deduped && snapshot.priceHistory != null ? snapshot.priceHistory : pointsFromOffers(snapshot);
    for (const point of points) {
      if (point.listings <= 0) continue;
      const stored: PricePoint = {
        t: snapshot.t,
        min: point.min,
        median: point.median,
        max: point.max,
        listings: point.listings,
      };
      const row = series.get(point.name);
      if (row) row.push(stored);
      else series.set(point.name, [stored]);
    }
  }
  return series;
}

export function mergeOffers(snapshots: PkaSnapshot[]): PkaOffer[] {
  const latest = snapshots[snapshots.length - 1];
  // A compacted file only kept listings that were new. It is not a census, so absence there
  // does not mean the offer was sold. `removed` on the kept row is the record of that.
  const census = latest && !latest.deduped && latest.offers.length > 0 ? latest : null;
  const censusIds = census ? new Set(census.offers.map((offer) => offer.itemCode)) : null;
  const byCode = new Map<string, PkaOffer>();
  for (const snapshot of snapshots) {
    for (const offer of snapshot.offers) byCode.set(offer.itemCode, offer);
  }
  return [...byCode.values()].map((offer) => {
    if (!census || !censusIds) return offer;
    const removed = !censusIds.has(offer.itemCode);
    if (offer.removed === removed) return offer;
    return { ...offer, removed };
  });
}

export function buildMarket(snapshots: PkaSnapshot[]): { offers: PkaOffer[]; items: PkaItem[] } {
  const ordered = sortSnapshots(snapshots);
  const groups = new Map<string, PkaSnapshot[]>();
  for (const snapshot of ordered) {
    const list = groups.get(snapshot.server);
    if (list) list.push(snapshot);
    else groups.set(snapshot.server, [snapshot]);
  }
  if (groups.size <= 1) {
    const offers = mergeOffers(ordered);
    return { offers, items: aggregateItems(offers, priceHistories(ordered)) };
  }
  const offers: PkaOffer[] = [];
  const histories = new Map<string, PricePoint[]>();
  for (const group of groups.values()) {
    offers.push(...mergeOffers(group));
    for (const [name, points] of priceHistories(group)) {
      const row = histories.get(name);
      if (row) row.push(...points);
      else histories.set(name, points.slice());
    }
  }
  for (const points of histories.values()) points.sort((a, b) => a.t - b.t);
  return { offers, items: aggregateItems(offers, histories) };
}

export function expiresAt(offer: PkaOffer): number {
  if (offer.seenAt > 0) return offer.seenAt + Math.max(0, offer.timeleft);
  return 0;
}

export function secondsLeft(offer: PkaOffer, nowUnix = Date.now() / 1000): number {
  const expiry = expiresAt(offer);
  if (expiry > 0) return expiry - nowUnix;
  return offer.timeleft;
}

export function offerStatus(offer: PkaOffer, nowUnix = Date.now() / 1000): OfferStatus {
  const expiry = expiresAt(offer);
  if (expiry > 0 && expiry <= nowUnix) return "expired";
  if (offer.removed) return "removed";
  return "active";
}

export function isOnMarket(offer: PkaOffer, nowUnix = Date.now() / 1000): boolean {
  return offerStatus(offer, nowUnix) === "active";
}

export function matchesExpired(offer: PkaOffer, filter: ExpiredFilter, nowUnix = Date.now() / 1000): boolean {
  if (filter === "all") return true;
  const live = isOnMarket(offer, nowUnix);
  return filter === "expired" ? !live : live;
}

export function parsePkaMarket(data: unknown): PkaMarket | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { capturedAt?: unknown; listings?: unknown; server?: unknown };
  if (typeof row.capturedAt !== "string" || !Array.isArray(row.listings)) return null;
  const server = text(row.server);
  const offers: PkaOffer[] = [];
  row.listings.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const offer = toOffer(entry as Record<string, unknown>, index, server);
    if (offer) offers.push(offer);
  });
  return {
    capturedAt: row.capturedAt,
    offers,
    items: aggregateItems(offers),
  };
}

export function matchesQuery(haystack: string, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  const hay = fold(haystack);
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export function paginate<T>(rows: T[], page: number, pageSize: number): {
  rows: T[];
  page: number;
  pages: number;
  total: number;
} {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: current, pages, total: rows.length };
}

export function priceHistogram(prices: number[], buckets = 12): { bucket: string; count: number }[] {
  const values = prices.filter((price) => price > 0);
  if (!values.length) return [];
  const logs = values.map((price) => Math.log10(price));
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  const span = max - min || 1;
  const counts = Array.from({ length: buckets }, () => 0);
  for (const value of logs) {
    const idx = Math.min(buckets - 1, Math.floor(((value - min) / span) * buckets));
    counts[idx] += 1;
  }
  return counts.map((count, index) => {
    const start = 10 ** (min + (span * index) / buckets);
    return { bucket: start >= 1000 ? `${Math.round(start / 1000)}k` : String(Math.round(start)), count };
  });
}
