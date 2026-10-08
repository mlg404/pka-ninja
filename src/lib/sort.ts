import { lineTotal, offerStatus, secondsLeft, type PkaItem, type PkaOffer } from "./pka";

export type SortDir = "asc" | "desc";

export type SortChoice = {
  sort: string;
  dir: SortDir;
  label: string;
};

const ASC_FIRST = new Set(["name", "item", "ball", "balls", "seller", "label"]);

export function nextSort(currentSort: string, currentDir: SortDir, key: string): { sort: string; dir: SortDir } {
  if (currentSort !== key) return { sort: key, dir: ASC_FIRST.has(key) ? "asc" : "desc" };
  return { sort: key, dir: currentDir === "asc" ? "desc" : "asc" };
}

export function sortPatch(
  sort: string,
  dir: SortDir,
  fallback: { sort: string; dir: SortDir },
): Record<string, string | null> {
  if (sort === fallback.sort && dir === fallback.dir) return { sort: null, dir: null };
  return { sort, dir };
}

function compareNum(a: number | null, b: number | null, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}

function compareText(a: string, b: string, dir: SortDir): number {
  const cmp = a.localeCompare(b, "pt", { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

function money(value: number): number | null {
  return value > 0 ? value : null;
}

function dirOf(raw: string | null, fallback: SortDir): SortDir {
  if (raw === "asc" || raw === "desc") return raw;
  return fallback;
}

const ITEM_KEYS = new Set(["name", "balls", "active", "listings", "quantity", "min", "median", "max", "avg30", "change"]);

export function parseItemSort(
  sort: string | null,
  dir: string | null,
  fallback: { sort: string; dir: SortDir } = { sort: "active", dir: "desc" },
): { sort: string; dir: SortDir } {
  if (sort === "name" || sort === "balls") return { sort, dir: dirOf(dir, "asc") };
  const key = sort && ITEM_KEYS.has(sort) ? sort : fallback.sort;
  const text = key === "name" || key === "balls";
  return { sort: key, dir: dirOf(dir, text ? "asc" : fallback.dir) };
}

export function sortPkaItems(rows: PkaItem[], sort: string, dir: SortDir): PkaItem[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const tie = a.name.localeCompare(b.name, "pt", { sensitivity: "base" });
    if (sort === "name") return compareText(a.name, b.name, dir);
    if (sort === "balls") return compareText(a.balls.join(", "), b.balls.join(", "), dir) || tie;
    if (sort === "active") return compareNum(a.active, b.active, dir) || tie;
    if (sort === "listings") return compareNum(a.listings, b.listings, dir) || tie;
    if (sort === "quantity") return compareNum(a.quantity, b.quantity, dir) || tie;
    if (sort === "min") return compareNum(money(a.min), money(b.min), dir) || tie;
    if (sort === "median") return compareNum(money(a.median), money(b.median), dir) || tie;
    if (sort === "max") return compareNum(money(a.max), money(b.max), dir) || tie;
    if (sort === "avg30") {
      const av = a.avg30 != null && (a.count30 ?? 0) > 0 ? a.avg30 : null;
      const bv = b.avg30 != null && (b.count30 ?? 0) > 0 ? b.avg30 : null;
      return compareNum(av, bv, dir) || tie;
    }
    if (sort === "change") return compareNum(a.changePct, b.changePct, dir) || tie;
    return compareNum(a.active, b.active, dir) || tie;
  });
  return copy;
}

const OFFER_KEYS = new Set(["item", "ball", "count", "price", "total", "seller", "left", "avg30", "seen"]);

export function parseOfferSort(
  sort: string | null,
  dir: string | null,
  fallback: { sort: string; dir: SortDir } = { sort: "seen", dir: "desc" },
): { sort: string; dir: SortDir } {
  if (sort === "price-asc") return { sort: "price", dir: "asc" };
  if (sort === "price-desc") return { sort: "price", dir: "desc" };
  if (sort === "name") return { sort: "item", dir: dirOf(dir, "asc") };
  if (sort === "time") return { sort: "seen", dir: dirOf(dir, "desc") };
  const key = sort && OFFER_KEYS.has(sort) ? sort : fallback.sort;
  const text = key === "item" || key === "ball" || key === "seller";
  return { sort: key, dir: dirOf(dir, text ? "asc" : fallback.dir) };
}

export function sortPkaOffers(rows: PkaOffer[], sort: string, dir: SortDir): PkaOffer[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const tie = a.itemName.localeCompare(b.itemName, "pt", { sensitivity: "base" }) || a.price - b.price;
    if (sort === "item") return compareText(a.itemName, b.itemName, dir) || a.price - b.price;
    if (sort === "ball") return compareText(a.pokeballType, b.pokeballType, dir) || tie;
    if (sort === "count") return compareNum(a.count, b.count, dir) || tie;
    if (sort === "price") return compareNum(a.price, b.price, dir) || tie;
    if (sort === "total") return compareNum(lineTotal(a), lineTotal(b), dir) || tie;
    if (sort === "seller") return compareText(a.sellerName, b.sellerName, dir) || tie;
    if (sort === "left") {
      const av = offerStatus(a) === "active" ? secondsLeft(a) : null;
      const bv = offerStatus(b) === "active" ? secondsLeft(b) : null;
      return compareNum(av, bv, dir) || tie;
    }
    if (sort === "avg30") {
      const av = a.count30 > 0 ? a.avg30 : null;
      const bv = b.count30 > 0 ? b.avg30 : null;
      return compareNum(av, bv, dir) || tie;
    }
    return compareNum(a.seenAt, b.seenAt, dir) || tie;
  });
  return copy;
}

export function sortOpportunities(rows: PkaItem[], sort: string, dir: SortDir): PkaItem[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const tie = a.name.localeCompare(b.name, "pt", { sensitivity: "base" });
    if (sort === "name") return compareText(a.name, b.name, dir);
    if (sort === "min") return compareNum(money(a.min), money(b.min), dir) || tie;
    return compareNum(a.cheapestChangePct, b.cheapestChangePct, dir) || tie;
  });
  return copy;
}

export const ITEM_SORT_OPTIONS: SortChoice[] = [
  { sort: "active", dir: "desc", label: "Mais anúncios" },
  { sort: "active", dir: "asc", label: "Menos anúncios" },
  { sort: "change", dir: "desc", label: "Maior alta" },
  { sort: "change", dir: "asc", label: "Maior queda" },
  { sort: "median", dir: "desc", label: "Maior mediana" },
  { sort: "median", dir: "asc", label: "Menor mediana" },
  { sort: "avg30", dir: "desc", label: "Maior média 30d" },
  { sort: "avg30", dir: "asc", label: "Menor média 30d" },
  { sort: "quantity", dir: "desc", label: "Maior quantidade" },
  { sort: "quantity", dir: "asc", label: "Menor quantidade" },
  { sort: "min", dir: "desc", label: "Maior mínimo" },
  { sort: "min", dir: "asc", label: "Menor mínimo" },
  { sort: "max", dir: "desc", label: "Maior máximo" },
  { sort: "max", dir: "asc", label: "Menor máximo" },
  { sort: "name", dir: "asc", label: "Nome A–Z" },
  { sort: "name", dir: "desc", label: "Nome Z–A" },
];

export const POKEMON_SORT_OPTIONS: SortChoice[] = [
  { sort: "listings", dir: "desc", label: "Mais anúncios" },
  { sort: "listings", dir: "asc", label: "Menos anúncios" },
  { sort: "change", dir: "desc", label: "Maior alta" },
  { sort: "change", dir: "asc", label: "Maior queda" },
  { sort: "median", dir: "desc", label: "Maior mediana" },
  { sort: "median", dir: "asc", label: "Menor mediana" },
  { sort: "min", dir: "desc", label: "Maior mínimo" },
  { sort: "min", dir: "asc", label: "Menor mínimo" },
  { sort: "max", dir: "desc", label: "Maior máximo" },
  { sort: "max", dir: "asc", label: "Menor máximo" },
  { sort: "name", dir: "asc", label: "Nome A–Z" },
  { sort: "name", dir: "desc", label: "Nome Z–A" },
  { sort: "balls", dir: "asc", label: "Ball A–Z" },
  { sort: "balls", dir: "desc", label: "Ball Z–A" },
];

export const LISTING_SORT_OPTIONS: SortChoice[] = [
  { sort: "seen", dir: "desc", label: "Mais recentes" },
  { sort: "seen", dir: "asc", label: "Mais antigos" },
  { sort: "price", dir: "desc", label: "Maior preço" },
  { sort: "price", dir: "asc", label: "Menor preço" },
  { sort: "total", dir: "desc", label: "Maior total" },
  { sort: "total", dir: "asc", label: "Menor total" },
  { sort: "count", dir: "desc", label: "Maior quantidade" },
  { sort: "count", dir: "asc", label: "Menor quantidade" },
  { sort: "avg30", dir: "desc", label: "Maior média 30d" },
  { sort: "avg30", dir: "asc", label: "Menor média 30d" },
  { sort: "left", dir: "desc", label: "Mais tempo restante" },
  { sort: "left", dir: "asc", label: "Menos tempo restante" },
  { sort: "item", dir: "asc", label: "Nome A–Z" },
  { sort: "item", dir: "desc", label: "Nome Z–A" },
  { sort: "seller", dir: "asc", label: "Vendedor A–Z" },
  { sort: "seller", dir: "desc", label: "Vendedor Z–A" },
  { sort: "ball", dir: "asc", label: "Ball A–Z" },
  { sort: "ball", dir: "desc", label: "Ball Z–A" },
];
