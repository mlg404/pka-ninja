import type { HeldItem, Listing } from "./types";

export type PokemonDetails = {
  species?: string;
  boost: number | null;
  ball?: string;
  helds: HeldItem[];
  tms: string[];
  megas: string[];
};

const MEGA_STONE_RE = /ite(?:\s+[XY])?$/i;

const CONTAINS_RE = /cont[eé]m um[a]?\s+(.+?)(?:\.|$)/i;
const SPECIES_BOOST_RE = /^(.*?)\s+\+(\d+)(?:\s*\(.*\))?\s*$/;
const BALL_RE = /voc[eê]\s+v[eê]\s+um[a]?\s+([^.]+?)\.\s*cont[eé]m/i;
const TM_RE = /T[MR]\s+aprendido:\s*([^\n]+)/gi;
const HELD_SECTION_RE =
  /segurando:\s*(.+?)(?:\.\s*(?:pre[cç]o|tm\s+aprendido|tr\s+aprendido|espa[cç]os|n[ií]vel)|$)/i;
const HELD_TIER_RE = /^(.*?)\s*\(\s*Tier:\s*(\d+)\s*\)\s*$/i;
const HELD_SPLIT_RE = /,\s*|\s+e\s+/i;
const LOOK_PREFIX = /^voc[eê]\s+v[eê]\s+um[a]?\s+/i;
const BOOST_SUFFIX = /\s+\+\d+\s*$/;

export function stripBoostFromName(name: string): string {
  return name.replace(BOOST_SUFFIX, "").trim();
}

export function normalizeHeldName(name: string): string {
  return name.replace(LOOK_PREFIX, "").replace(/^e\s+/i, "").replace(/\s+/g, " ").trim();
}

export function parsePokemonDescription(description: string): PokemonDetails {
  const helds = parseHelds(description);
  const tms = [...description.matchAll(TM_RE)].map((match) => match[1].trim()).filter(Boolean);
  const contains = CONTAINS_RE.exec(description);
  let species: string | undefined;
  let boost: number | null = null;
  if (contains) {
    const body = contains[1].trim();
    const boosted = SPECIES_BOOST_RE.exec(body);
    if (boosted) {
      species = boosted[1].trim();
      boost = Number(boosted[2]);
    } else {
      species = body.replace(/\s*\(.*\)\s*$/, "").trim() || undefined;
    }
  }
  const ball = BALL_RE.exec(description)?.[1]?.trim();
  const { helds: onlyHelds, megas } = partitionMegas(helds);
  return { species, boost, ball, helds: onlyHelds, tms, megas };
}

export function listingLooksLikePokemon(listing: Listing): boolean {
  const desc = listing.item?.description ?? "";
  return Boolean(listing.item?.isPokeball) || CONTAINS_RE.test(desc);
}

export function pokemonDetails(listing: Listing): PokemonDetails {
  if (!listingLooksLikePokemon(listing)) {
    return { boost: null, helds: [], tms: [], megas: [] };
  }
  const parsed = parsePokemonDescription(listing.item?.description ?? "");
  const poke = listing.pokemon;
  const dumpHelds = (poke?.heldItems ?? [])
    .map((held) => ({
      name: normalizeHeldName(held.name),
      tier: held.tier,
    }))
    .filter((held) => held.name && !LOOK_PREFIX.test(held.name));
  const fromDump = partitionMegas(dumpHelds);
  const usedParsed = parsed.helds.length > 0 || parsed.megas.length > 0;
  const fromName =
    listing.item?.isPokeball && listing.item.name
      ? stripBoostFromName(listing.item.name)
      : undefined;
  return {
    species: parsed.species || poke?.species || fromName || undefined,
    boost: parsed.boost ?? poke?.enhancement ?? null,
    ball: parsed.ball || poke?.ball,
    helds: usedParsed ? parsed.helds : fromDump.helds,
    tms: parsed.tms.length ? parsed.tms : poke?.learnedTms ?? [],
    megas: usedParsed ? parsed.megas : poke?.megaStones?.length ? poke.megaStones : fromDump.megas,
  };
}

export function displayListingName(listing: Listing): string {
  const details = pokemonDetails(listing);
  if (listingLooksLikePokemon(listing) && details.species) return details.species;
  return listing.item?.name?.trim() || `item-${listing.item?.id ?? listing.id}`;
}

export type PokemonMarketKind = "mega" | "tm" | "tr" | "tmtr" | "base";

const TM_LEARNED_RE = /TM\s+aprendido:/i;
const TR_LEARNED_RE = /TR\s+aprendido:/i;

export function pokemonMarketKind(listing: Listing): PokemonMarketKind | null {
  if (!listingLooksLikePokemon(listing)) return null;
  const details = pokemonDetails(listing);
  if (details.megas.length) return "mega";
  const desc = listing.item?.description ?? "";
  const dumpMoves = listing.pokemon?.learnedTms ?? [];
  const fromDescTm = TM_LEARNED_RE.test(desc);
  const fromDescTr = TR_LEARNED_RE.test(desc);
  const dumpTr = dumpMoves.some((name) => /\bTR\b/i.test(name));
  const dumpTm = dumpMoves.some((name) => !/\bTR\b/i.test(name));
  const tr = fromDescTr || dumpTr;
  const tm = fromDescTm || dumpTm || (details.tms.length > 0 && !tr);
  if (tm && tr) return "tmtr";
  if (tr) return "tr";
  if (tm) return "tm";
  return "base";
}

export function pokemonMarketKindLabel(kind: PokemonMarketKind): string {
  if (kind === "mega") return "Mega";
  if (kind === "tm") return "TM";
  if (kind === "tr") return "TR";
  if (kind === "tmtr") return "TM/TR";
  return "Poké";
}

export function displayPokemonBoardName(listing: Listing): string {
  const name = displayListingName(listing);
  const kind = pokemonMarketKind(listing);
  if (!kind) return name;
  return `${name} · ${pokemonMarketKindLabel(kind)}`;
}

export function formatHeld(held: HeldItem): string {
  return held.tier != null && held.tier > 0 ? `${held.name} (T${held.tier})` : held.name;
}

export type HeldFilter = {
  name: string;
  minTier: number | null;
  maxTier: number | null;
};

export type HeldOption = {
  name: string;
  tiers: number[];
};

export function uniqueHeldOptions(listings: Listing[]): HeldOption[] {
  const names = new Map<string, { name: string; tiers: Set<number> }>();
  for (const listing of listings) {
    for (const held of pokemonDetails(listing).helds) {
      const key = foldHeld(held.name);
      if (!key) continue;
      let entry = names.get(key);
      if (!entry) {
        entry = { name: held.name, tiers: new Set() };
        names.set(key, entry);
      }
      if (held.tier != null && held.tier > 0) entry.tiers.add(held.tier);
    }
  }
  return [...names.values()]
    .map((entry) => ({ name: entry.name, tiers: [...entry.tiers].sort((a, b) => a - b) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseHeldFilters(raw: string | null): HeldFilter[] {
  if (!raw) return [];
  const filters: HeldFilter[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.lastIndexOf(":");
    if (colon <= 0) {
      filters.push({ name: trimmed, minTier: null, maxTier: null });
      continue;
    }
    const name = trimmed.slice(0, colon).trim();
    const spec = trimmed.slice(colon + 1).trim();
    if (!name) continue;
    if (spec.includes("-")) {
      const [minRaw, maxRaw] = spec.split("-");
      filters.push({ name, minTier: parseOptNum(minRaw), maxTier: parseOptNum(maxRaw) });
    } else {
      const tier = parseOptNum(spec);
      filters.push({ name, minTier: tier, maxTier: tier });
    }
  }
  return filters;
}

export function serializeHeldFilters(filters: HeldFilter[]): string | null {
  if (!filters.length) return null;
  return filters
    .map((filter) => {
      const min = filter.minTier;
      const max = filter.maxTier;
      if (min == null && max == null) return filter.name;
      if (min != null && max != null && min === max) return `${filter.name}:${min}`;
      return `${filter.name}:${min ?? ""}-${max ?? ""}`;
    })
    .join(",");
}

export function sameHeldName(a: string, b: string): boolean {
  return foldHeld(a) === foldHeld(b);
}

export function listingMatchesPokemonFilters(
  listing: Listing,
  opts: { boostMin: number | null; boostMax: number | null; helds: HeldFilter[] },
): boolean {
  if (opts.boostMin == null && opts.boostMax == null && !opts.helds.length) return true;
  const details = pokemonDetails(listing);
  if (opts.boostMin != null && (details.boost == null || details.boost < opts.boostMin)) return false;
  if (opts.boostMax != null && (details.boost == null || details.boost > opts.boostMax)) return false;
  if (opts.helds.length) {
    const matches = opts.helds.every((filter) => details.helds.some((held) => heldMatchesFilter(held, filter)));
    if (!matches) return false;
  }
  return true;
}

function heldMatchesFilter(held: HeldItem, filter: HeldFilter): boolean {
  if (!sameHeldName(held.name, filter.name)) return false;
  if (filter.minTier == null && filter.maxTier == null) return true;
  if (held.tier == null) return false;
  if (filter.minTier != null && held.tier < filter.minTier) return false;
  if (filter.maxTier != null && held.tier > filter.maxTier) return false;
  return true;
}

function parseOptNum(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function isMegaStoneName(name: string): boolean {
  return MEGA_STONE_RE.test(name.trim());
}

function partitionMegas(items: HeldItem[]): { helds: HeldItem[]; megas: string[] } {
  const helds: HeldItem[] = [];
  const megas: string[] = [];
  for (const item of items) {
    if (isMegaStoneName(item.name)) megas.push(item.name);
    else helds.push(item);
  }
  return { helds, megas };
}

function parseHelds(description: string): HeldItem[] {
  const section = HELD_SECTION_RE.exec(description);
  if (!section) return [];
  const helds: HeldItem[] = [];
  for (const part of section[1].split(HELD_SPLIT_RE)) {
    const raw = part.trim().replace(/[.\s]+$/, "");
    if (!raw || LOOK_PREFIX.test(raw)) continue;
    const tiered = HELD_TIER_RE.exec(raw);
    if (tiered) {
      helds.push({ name: normalizeHeldName(tiered[1]), tier: Number(tiered[2]) });
      continue;
    }
    const name = normalizeHeldName(raw);
    if (name) helds.push({ name });
  }
  return helds;
}

function foldHeld(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}
