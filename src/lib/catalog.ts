import { formatCompact } from "./format";
import { displayListingName, displayPokemonBoardName, formatHeld, listingLooksLikePokemon, pokemonDetails, pokemonMarketKind } from "./pokemon";
import type {
  CatalogItem,
  CategoryId,
  ConcreteCategory,
  Listing,
  MarketSnapshot,
  PricePoint,
  SnapshotFile,
  SnapshotSeriesPoint,
  SpeciesRow,
} from "./types";

export const CATEGORY_META: { id: CategoryId; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pokemon", label: "Pokémon" },
  { id: "items", label: "Itens" },
  { id: "stones", label: "Stones" },
  { id: "cosmetics", label: "Cosméticos" },
  { id: "berries", label: "Berries" },
  { id: "bags", label: "Bags" },
  { id: "balls", label: "Balls" },
  { id: "cards", label: "Cards" },
  { id: "held", label: "Held items" },
];

export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

const HELD_DESCRIPTION_NAME = /^voc[eê]\s+v[eê]\s+um[a]?\b/i;

export function isHeldItemListing(listing: Listing): boolean {
  return Boolean(
    listing.pokemon?.heldItems?.some((held) => HELD_DESCRIPTION_NAME.test(held.name.trim())),
  );
}

export function isPokemonListing(listing: Listing): boolean {
  if (isHeldItemListing(listing)) return false;
  return listingLooksLikePokemon(listing);
}

export function isBagListing(listing: Listing): boolean {
  return /\bvolume\s*:/i.test(listing.item?.description ?? "");
}

const DOLL_NAME_RE = /\bdoll$/i;
const TOY_NAME_RE = /\btoy$/i;
const DESC_PRICE_RE = /pre[cç]o\s*:/i;

export function isDollListing(listing: Listing): boolean {
  return isDollName(listing.item?.name ?? "", listing.item?.description ?? "");
}

export function isToyListing(listing: Listing): boolean {
  return isToyName(listing.item?.name ?? "");
}

function isDollName(name: string, description: string): boolean {
  return DOLL_NAME_RE.test(name) && !DESC_PRICE_RE.test(description);
}

function isToyName(name: string): boolean {
  return TOY_NAME_RE.test(name);
}

export function isHomeBoardExcluded(row: { name: string; category: string; sampleDescription?: string }): boolean {
  if (row.category === "bags") return true;
  if (isToyName(row.name)) return true;
  if (isDollName(row.name, row.sampleDescription ?? "")) return true;
  return false;
}

/** Boost mínimo para Pokémon entrar nos quadros de movimento/spread. */
export const POKEMON_BOARD_MIN_BOOST = 50;
/** Preço ($ / un.) alto o bastante para um Pokémon sem boost ainda contar nesses quadros. */
export const POKEMON_BOARD_HIGH_UNBOOSTED_DOLLARS = 10_000_000;

export function isPokemonComparableForPriceBoard(listing: Listing): boolean {
  if (!isPokemonListing(listing)) return true;
  const boost = pokemonDetails(listing).boost ?? 0;
  if (boost >= POKEMON_BOARD_MIN_BOOST) return true;
  const price = unitPrice(listing);
  return price != null && price >= POKEMON_BOARD_HIGH_UNBOOSTED_DOLLARS;
}

export function categorize(listing: Listing): ConcreteCategory {
  const item = listing.item;
  const name = item?.name ?? "";
  const desc = item?.description ?? "";
  const nl = name.toLowerCase();
  const dl = desc.toLowerCase();

  if (isHeldItemListing(listing) || /\(tier:\s*\d+/i.test(name) || /^(x|y)-/i.test(name)) {
    return "held";
  }
  if (/\burns?\b/i.test(nl) || /\burna\b/i.test(dl)) return "cosmetics";
  if (isPokemonListing(listing)) return "pokemon";
  if (isBagListing(listing)) return "bags";
  if (
    /costume|outfit|cloak|scarf|glasses|\bhat\b|addon|guardian|backpack/i.test(nl) ||
    /traje|addon para|raridade:/i.test(dl)
  ) {
    return "cosmetics";
  }
  if (/stone|shard/i.test(nl)) return "stones";
  if (/berry/i.test(nl)) return "berries";
  if (/\bcard\b/i.test(nl)) return "cards";
  if (/\bball\b/i.test(nl)) return "balls";
  return "items";
}

export function stackCount(listing: Listing): number {
  return Math.max(1, listing.item?.count ?? 1);
}

export function unitPrice(listing: Listing): number | null {
  if (listing.offerOnly || !listing.priceDollars) return null;
  return listing.priceDollars;
}

export function totalPrice(listing: Listing): number | null {
  const unit = unitPrice(listing);
  if (unit == null) return null;
  return unit * stackCount(listing);
}

export function listingSearchText(listing: Listing): string {
  const poke = pokemonDetails(listing);
  const held = poke.helds.map((h) => formatHeld(h)).join(" ");
  return fold(
    [
      displayListingName(listing),
      listing.item?.name,
      listing.item?.description,
      listing.playerName,
      listing.description,
      poke.species,
      poke.ball,
      poke.boost != null ? `+${poke.boost}` : "",
      held,
      poke.tms.join(" "),
      poke.megas.join(" "),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function stats(values: number[]): {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
  stdev: number;
  spreadPct: number;
} {
  if (!values.length) {
    return { min: 0, p25: 0, median: 0, p75: 0, max: 0, mean: 0, stdev: 0, spreadPct: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const variance =
    sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, sorted.length);
  const stdev = Math.sqrt(variance);
  const median = percentile(sorted, 0.5);
  return {
    min: sorted[0],
    p25: percentile(sorted, 0.25),
    median,
    p75: percentile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    mean,
    stdev,
    spreadPct: median > 0 ? ((sorted[sorted.length - 1] - sorted[0]) / median) * 100 : 0,
  };
}

function listingAgeChangePct(listings: Listing[], capturedUnix: number): number | null {
  return listingAgeFieldChangePct(listings, capturedUnix, "median");
}

function listingAgeCheapestChangePct(listings: Listing[], capturedUnix: number): number | null {
  return listingAgeFieldChangePct(listings, capturedUnix, "min");
}

function listingAgeFieldChangePct(
  listings: Listing[],
  capturedUnix: number,
  field: "median" | "min",
): number | null {
  const day = 86_400;
  const cutoff = capturedUnix - day;
  const recent: number[] = [];
  const older: number[] = [];
  for (const listing of listings) {
    const price = unitPrice(listing);
    if (price == null) continue;
    if (listing.time >= cutoff) recent.push(price);
    else older.push(price);
  }
  if (field === "min") {
    if (!recent.length || !older.length) return null;
    const oldMin = Math.min(...older);
    const newMin = Math.min(...recent);
    if (!oldMin) return null;
    return ((newMin - oldMin) / oldMin) * 100;
  }
  if (recent.length < 2 || older.length < 2) return null;
  const oldMed = percentile([...older].sort((a, b) => a - b), 0.5);
  const newMed = percentile([...recent].sort((a, b) => a - b), 0.5);
  if (!oldMed) return null;
  return ((newMed - oldMed) / oldMed) * 100;
}

function snapshotChangePct(history: PricePoint[]): number | null {
  return snapshotFieldChangePct(history, "median");
}

function snapshotCheapestChangePct(history: PricePoint[]): number | null {
  return snapshotFieldChangePct(history, "min");
}

function snapshotFieldChangePct(history: PricePoint[], field: "median" | "min"): number | null {
  const priced = history.filter((point) => point[field] > 0);
  if (priced.length < 2) return null;
  const last = priced[priced.length - 1];
  const target = last.t - 86_400;
  let best = priced[priced.length - 2];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const point of priced.slice(0, -1)) {
    const dist = Math.abs(point.t - target);
    if (dist < bestDist) {
      best = point;
      bestDist = dist;
    }
  }
  if (!best[field]) return null;
  return ((last[field] - best[field]) / best[field]) * 100;
}

function listingSparkline(listings: Listing[], maxPoints = 24): number[] {
  const priced = listings
    .map((listing) => ({ t: listing.time, p: unitPrice(listing) }))
    .filter((row): row is { t: number; p: number } => row.p != null)
    .sort((a, b) => a.t - b.t);
  if (priced.length <= maxPoints) return priced.map((row) => row.p);
  const step = (priced.length - 1) / (maxPoints - 1);
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(priced[Math.round(i * step)].p);
  }
  return out;
}

function sparkFromHistory(history: PricePoint[], fallback: Listing[]): number[] {
  const medians = history.map((point) => point.median).filter((value) => value > 0);
  if (medians.length >= 2) return medians;
  return listingSparkline(fallback);
}

export function listingName(listing: Listing): string {
  return listing.item?.name?.trim() || `item-${listing.item?.id ?? listing.id}`;
}

export function listingItemKey(listing: Listing): string | null {
  const id = listing.item?.id;
  if (typeof id === "number" && id > 0) return String(id);
  const name = listing.item?.name?.trim();
  return name ? `name:${name}` : null;
}

export function listingPriceBoardKey(listing: Listing): string | null {
  const key = listingItemKey(listing);
  if (!key) return null;
  const kind = pokemonMarketKind(listing);
  return kind ? `${key}:${kind}` : key;
}

export function itemPath(item: { name: string }): string {
  return `/items/${encodeURIComponent(item.name)}`;
}

export function listingItemPath(listing: Listing): string {
  return itemPath({ name: displayListingName(listing) });
}

function majorityName(listings: Listing[], nameOf: (listing: Listing) => string = displayListingName): string {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    const name = nameOf(listing);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "item";
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function snapshotUnix(snapshot: MarketSnapshot): number {
  return Math.floor(new Date(snapshot.capturedAt).getTime() / 1000);
}

export function sortSnapshots<T extends MarketSnapshot>(snapshots: T[]): T[] {
  return [...snapshots].sort((a, b) => snapshotUnix(a) - snapshotUnix(b) || a.capturedAt.localeCompare(b.capturedAt));
}

export function dedupeSnapshots(snapshots: SnapshotFile[]): SnapshotFile[] {
  const byKey = new Map<string, SnapshotFile>();
  for (const snapshot of snapshots) {
    const key = snapshot.capturedAt;
    const existing = byKey.get(key);
    if (!existing || (snapshot.items?.length ?? 0) > (existing.items?.length ?? 0)) {
      byKey.set(key, snapshot);
    }
  }
  return sortSnapshots([...byKey.values()]);
}

function priceHistory(indexed: { t: number; byKey: Map<string, Listing[]> }[], key: string): PricePoint[] {
  const history: PricePoint[] = [];
  for (const snap of indexed) {
    const group = snap.byKey.get(key);
    if (!group?.length) continue;
    const prices = group.map(unitPrice).filter((v): v is number => v != null);
    const numeric = stats(prices);
    history.push({
      t: snap.t,
      median: numeric.median,
      min: numeric.min,
      max: numeric.max,
      listings: group.length,
      buyouts: prices.length,
    });
  }
  return history;
}

export function aggregateByName(
  snapshots: MarketSnapshot[],
  opts?: {
    keyFn?: (listing: Listing) => string | null;
    nameOf?: (listing: Listing) => string;
  },
): CatalogItem[] {
  if (!snapshots.length) return [];
  const keyFn = opts?.keyFn ?? listingItemKey;
  const nameOf = opts?.nameOf ?? displayListingName;
  const latestIds = latestMarketIds(snapshots);
  const indexed = snapshots.map((snapshot) => ({
    snapshot,
    t: snapshotUnix(snapshot),
    byKey: groupBy(snapshot.items ?? [], keyFn),
  }));
  const latest = indexed[indexed.length - 1];
  const keys = new Set<string>();
  for (const row of indexed) {
    for (const key of row.byKey.keys()) keys.add(key);
  }

  const rows: CatalogItem[] = [];
  for (const key of keys) {
    const history = priceHistory(indexed, key);
    const latestGroup = latest.byKey.get(key) ?? [];
    const sample =
      latestGroup[0] ??
      indexed
        .slice()
        .reverse()
        .map((row) => row.byKey.get(key)?.[0])
        .find(Boolean);
    if (!sample) continue;
    const lastGroup =
      latestGroup.length > 0
        ? latestGroup
        : indexed
            .slice()
            .reverse()
            .map((row) => row.byKey.get(key))
            .find((group): group is Listing[] => Boolean(group?.length)) ?? [];
    const unique = uniqueByListingId(indexed.map((row) => row.byKey.get(key) ?? [])).map((listing) =>
      withMarketPresence(listing, latestIds),
    );
    const prices = unique.map(unitPrice).filter((v): v is number => v != null);
    const numeric = stats(prices);
    const itemId = sample.item?.id ?? 0;
    const name = majorityName(unique.length ? unique : lastGroup, nameOf);
    const poke = unique.map(pokemonDetails).find((details) => details.species);
    const active = unique.filter((listing) => isOnMarket(listing));
    rows.push({
      key,
      name,
      category: categorize(sample),
      itemId,
      listings: unique.length,
      buyouts: prices.length,
      offers: unique.length - prices.length,
      quantity: unique.reduce((s, l) => s + Math.max(1, l.item?.count ?? 1), 0),
      ...numeric,
      changePct: snapshotChangePct(history) ?? listingAgeChangePct(lastGroup, latest.t),
      cheapestChangePct: snapshotCheapestChangePct(history) ?? listingAgeCheapestChangePct(lastGroup, latest.t),
      totalValue: active.reduce((s, l) => s + (totalPrice(l) || 0), 0),
      spark: sparkFromHistory(history, lastGroup),
      history,
      pokemon: poke?.species
        ? { species: poke.species, enhancement: poke.boost ?? undefined }
        : undefined,
      sampleDescription: sample.item?.description ?? "",
    });
  }
  return rows.sort((a, b) => b.listings - a.listings || a.name.localeCompare(b.name) || a.itemId - b.itemId);
}

export function aggregatePriceBoardCatalog(snapshots: MarketSnapshot[]): CatalogItem[] {
  const filtered = snapshots.map((snapshot) => ({
    ...snapshot,
    items: (snapshot.items ?? []).filter(isPokemonComparableForPriceBoard),
  }));
  return aggregateByName(filtered, {
    keyFn: listingPriceBoardKey,
    nameOf: displayPokemonBoardName,
  });
}

export function aggregateBySpecies(snapshots: MarketSnapshot[]): SpeciesRow[] {
  if (!snapshots.length) return [];
  const latestIds = latestMarketIds(snapshots);
  const indexed = snapshots.map((snapshot) => ({
    snapshot,
    t: snapshotUnix(snapshot),
    byKey: groupBy(snapshot.items ?? [], (listing) =>
      isHeldItemListing(listing) ? null : pokemonDetails(listing).species?.trim() || null,
    ),
  }));
  const latest = indexed[indexed.length - 1];
  const speciesNames = new Set<string>();
  for (const row of indexed) {
    for (const species of row.byKey.keys()) speciesNames.add(species);
  }

  const rows: SpeciesRow[] = [];
  for (const species of speciesNames) {
    const history = priceHistory(indexed, species);
    const latestGroup = latest.byKey.get(species) ?? [];
    const lastGroup =
      latestGroup.length > 0
        ? latestGroup
        : indexed
            .slice()
            .reverse()
            .map((row) => row.byKey.get(species))
            .find((group): group is Listing[] => Boolean(group?.length)) ?? [];
    const unique = uniqueByListingId(indexed.map((row) => row.byKey.get(species) ?? [])).map((listing) =>
      withMarketPresence(listing, latestIds),
    );
    const prices = unique.map(unitPrice).filter((v): v is number => v != null);
    const numeric = stats(prices);
    const enhancements = unique
      .map((g) => pokemonDetails(g).boost)
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b);
    const active = unique.filter((listing) => isOnMarket(listing));
    rows.push({
      species,
      itemId: unique[0]?.item?.id ?? lastGroup[0]?.item?.id ?? 0,
      listings: unique.length,
      buyouts: prices.length,
      offers: unique.length - prices.length,
      min: numeric.min,
      median: numeric.median,
      max: numeric.max,
      mean: numeric.mean,
      changePct: snapshotChangePct(history) ?? listingAgeChangePct(lastGroup, latest.t),
      spark: sparkFromHistory(history, lastGroup),
      history,
      enhancements,
      medianEnhancement: enhancements.length ? percentile(enhancements, 0.5) : null,
      totalValue: active.reduce((s, l) => s + (totalPrice(l) || 0), 0),
    });
  }
  return rows.sort((a, b) => b.listings - a.listings || a.species.localeCompare(b.species));
}

export function mergeListings(snapshots: MarketSnapshot[]): Listing[] {
  const latestIds = latestMarketIds(snapshots);
  const byId = new Map<number, Listing>();
  for (const snapshot of snapshots) {
    for (const listing of snapshot.items ?? []) {
      byId.set(listing.id, listing);
    }
  }
  return [...byId.values()].map((listing) => withMarketPresence(listing, latestIds));
}

export function latestMarketIds(snapshots: MarketSnapshot[]): Set<number> | null {
  if (snapshots.length < 2) return null;
  const latest = snapshots[snapshots.length - 1];
  if (latest.complete === false) return null;
  return new Set((latest.items ?? []).map((item) => item.id));
}

export function withMarketPresence(listing: Listing, latestIds: Set<number> | null): Listing {
  const removed = latestIds != null && !latestIds.has(listing.id);
  if (Boolean(listing.removed) === removed) return listing;
  return { ...listing, removed };
}

export function isClockExpired(listing: Listing, nowUnix = Date.now() / 1000): boolean {
  if (typeof listing.expiresAt === "number" && listing.expiresAt > 0) {
    return listing.expiresAt <= nowUnix;
  }
  return listing.remaining < 0;
}

export type ListingStatus = "active" | "expired" | "removed";

export function listingStatus(listing: Listing, nowUnix = Date.now() / 1000): ListingStatus {
  if (isClockExpired(listing, nowUnix)) return "expired";
  if (listing.removed) return "removed";
  return "active";
}

export function isOnMarket(listing: Listing, nowUnix = Date.now() / 1000): boolean {
  return listingStatus(listing, nowUnix) === "active";
}

export function isExpired(listing: Listing, nowUnix = Date.now() / 1000): boolean {
  return !isOnMarket(listing, nowUnix);
}

export function secondsUntilExpiry(listing: Listing, nowUnix = Date.now() / 1000): number {
  if (typeof listing.expiresAt === "number" && listing.expiresAt > 0) {
    return listing.expiresAt - nowUnix;
  }
  return listing.remaining;
}

export type ExpiredFilter = "all" | "active" | "expired";

export function matchesExpired(listing: Listing, filter: ExpiredFilter): boolean {
  if (filter === "all") return true;
  const live = isOnMarket(listing);
  return filter === "expired" ? !live : live;
}

function uniqueByListingId(groups: Listing[][]): Listing[] {
  const byId = new Map<number, Listing>();
  for (const group of groups) {
    for (const listing of group) byId.set(listing.id, listing);
  }
  return [...byId.values()];
}

export function snapshotOverviewSeries(snapshots: MarketSnapshot[]): SnapshotSeriesPoint[] {
  return snapshots.map((snapshot) => {
    const listings = snapshot.items ?? [];
    const names = new Set(
      listings.map((listing) => listing.item?.name?.trim()).filter((name): name is string => Boolean(name)),
    );
    return {
      t: snapshotUnix(snapshot),
      capturedAt: snapshot.capturedAt,
      listings: listings.length,
      value: listings.reduce((sum, listing) => sum + (totalPrice(listing) || 0), 0),
      unique: names.size,
    };
  });
}

export function itemObservations(
  snapshots: MarketSnapshot[],
  name: string,
): { t: number; price: number; seller: string }[] {
  const wanted = fold(name);
  const matches = (listing: Listing) => fold(listing.item?.name ?? "") === wanted;
  if (snapshots.length <= 1) {
    return (snapshots[0]?.items ?? [])
      .filter(matches)
      .map((listing) => {
        const price = unitPrice(listing);
        if (price == null) return null;
        return { t: listing.time * 1000, price, seller: listing.playerName };
      })
      .filter((row): row is { t: number; price: number; seller: string } => row != null)
      .sort((a, b) => a.t - b.t);
  }
  const points: { t: number; price: number; seller: string }[] = [];
  for (const snapshot of snapshots) {
    const t = new Date(snapshot.capturedAt).getTime();
    for (const listing of snapshot.items ?? []) {
      if (!matches(listing)) continue;
      const price = unitPrice(listing);
      if (price == null) continue;
      points.push({ t, price, seller: listing.playerName });
    }
  }
  return points.sort((a, b) => a.t - b.t);
}

export function matchesQuery(haystack: string, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  const hay = fold(haystack);
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export function filterCatalog(
  items: CatalogItem[],
  query: string,
  category: CategoryId,
): CatalogItem[] {
  const q = fold(query);
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!q) return true;
    return matchesQuery(fold(`${item.name} ${item.itemId} ${item.sampleDescription} ${item.pokemon?.species ?? ""}`), query);
  });
}

export type OpportunityKind = "sell" | "buy";

export function cheapestAsk(row: CatalogItem): number {
  for (let i = row.history.length - 1; i >= 0; i -= 1) {
    if (row.history[i].min > 0) return row.history[i].min;
  }
  return row.min;
}

export function opportunityItems(catalog: CatalogItem[], kind: OpportunityKind): CatalogItem[] {
  const rows = catalog.filter(
    (row) =>
      !isHomeBoardExcluded(row) &&
      row.category !== "pokemon" &&
      row.cheapestChangePct != null &&
      row.totalValue > 0,
  );
  if (kind === "sell") {
    return rows
      .filter((row) => (row.cheapestChangePct ?? 0) > 0)
      .sort((a, b) => (b.cheapestChangePct ?? 0) - (a.cheapestChangePct ?? 0));
  }
  return rows
    .filter((row) => (row.cheapestChangePct ?? 0) < 0)
    .sort((a, b) => (a.cheapestChangePct ?? 0) - (b.cheapestChangePct ?? 0));
}

export function filterListings(
  listings: Listing[],
  query: string,
  category: CategoryId,
  offersOnly = false,
  expired: ExpiredFilter = "all",
): Listing[] {
  return listings.filter((listing) => {
    if (!matchesExpired(listing, expired)) return false;
    if (offersOnly && !listing.offerOnly) return false;
    if (category !== "all" && categorize(listing) !== category) return false;
    if (!query.trim()) return true;
    return matchesQuery(listingSearchText(listing), query);
  });
}

export function paginate<T>(rows: T[], page: number, pageSize: number): { rows: T[]; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), pages, page: safePage };
}

export type SortDir = "asc" | "desc";

export function sortListings(rows: Listing[], sort: string, dir: SortDir = "desc"): Listing[] {
  const mul = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "unit" || sort === "total") {
      const av = sort === "unit" ? unitSortValue(a) : totalPrice(a);
      const bv = sort === "unit" ? unitSortValue(b) : totalPrice(b);
      if (av == null && bv == null) return b.time - a.time;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av !== bv) return (av - bv) * mul;
      return b.time - a.time;
    }
    const cmp = compareListings(a, b, sort);
    if (cmp !== 0) return cmp * mul;
    return b.time - a.time;
  });
  return copy;
}

function compareListings(a: Listing, b: Listing, sort: string): number {
  if (sort === "listed" || sort === "time") return a.time - b.time;
  if (sort === "expires") return expiryUnix(a) - expiryUnix(b);
  if (sort === "name") return displayListingName(a).localeCompare(displayListingName(b));
  return a.time - b.time;
}

function unitSortValue(listing: Listing): number | null {
  if (listing.offerOnly) return null;
  return unitPrice(listing);
}

function expiryUnix(listing: Listing): number {
  if (typeof listing.expiresAt === "number" && listing.expiresAt > 0) return listing.expiresAt;
  return listing.time + (listing.remaining ?? 0);
}

export function sortCatalog(items: CatalogItem[], sort: string, dir: SortDir): CatalogItem[] {
  const mul = dir === "asc" ? 1 : -1;
  const copy = [...items];
  copy.sort((a, b) => {
    const va = sortValue(a, sort);
    const vb = sortValue(b, sort);
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * (dir === "asc" ? 1 : -1);
    const na = Number(va);
    const nb = Number(vb);
    if (na === nb) return a.name.localeCompare(b.name);
    return (na - nb) * mul;
  });
  return copy;
}

function sortValue(item: CatalogItem, sort: string): number | string {
  switch (sort) {
    case "name":
      return item.name.toLowerCase();
    case "listings":
      return item.listings;
    case "min":
      return item.min;
    case "median":
      return item.median;
    case "max":
      return item.max;
    case "spread":
      return item.spreadPct;
    case "change":
      return item.changePct ?? -Infinity;
    case "value":
      return item.totalValue;
    default:
      return item.listings;
  }
}

export function volumeSeries(listings: Listing[], buckets = 24): { t: number; listings: number; value: number }[] {
  if (!listings.length) return [];
  const times = listings.map((l) => l.time);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(1, max - min);
  const size = span / buckets;
  const series = Array.from({ length: buckets }, (_, i) => ({
    t: min + i * size,
    listings: 0,
    value: 0,
  }));
  for (const listing of listings) {
    const idx = Math.min(buckets - 1, Math.floor((listing.time - min) / size));
    series[idx].listings += 1;
    series[idx].value += totalPrice(listing) || 0;
  }
  return series;
}

export function priceHistogram(prices: number[], bins = 16): { bucket: string; count: number; mid: number }[] {
  if (!prices.length) return [];
  const logs = prices.filter((p) => p > 0).map((p) => Math.log10(p));
  if (!logs.length) return [];
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  const span = Math.max(0.0001, max - min);
  const counts = Array.from({ length: bins }, () => 0);
  const mids = Array.from({ length: bins }, (_, i) => min + ((i + 0.5) * span) / bins);
  for (const log of logs) {
    const idx = Math.min(bins - 1, Math.floor(((log - min) / span) * bins));
    counts[idx] += 1;
  }
  return counts.map((count, i) => ({
    bucket: formatCompact(10 ** (min + (i * span) / bins)),
    count,
    mid: 10 ** mids[i],
  }));
}

export function fromSlug(slug: string): string {
  return decodeURIComponent(slug);
}
