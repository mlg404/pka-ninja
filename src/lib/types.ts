export type HeldItem = {
  name: string;
  tier?: number;
};

export type PokemonInfo = {
  species?: string;
  enhancement?: number;
  ball?: string;
  heldItems?: HeldItem[];
  learnedTms?: string[];
  megaStones?: string[];
};

export type MarketItem = {
  id: number;
  count: number;
  name: string;
  description: string;
  isPokeball?: boolean;
};

export type Listing = {
  id: number;
  price: number;
  priceCents: number;
  priceDollars: number;
  offerOnly: boolean;
  playerName: string;
  time: number;
  remaining: number;
  expiresAt: number;
  description: string;
  item: MarketItem;
  pokemon?: PokemonInfo;
  /** Sumiu do último dump (comprado, retirado ou dump mais novo não traz mais). */
  removed?: boolean;
};

export type MarketSnapshot = {
  capturedAt: string;
  count: number;
  pages: number;
  complete: boolean;
  items: Listing[];
};

export type SnapshotFile = MarketSnapshot & {
  file: string;
};

export type PricePoint = {
  t: number;
  median: number;
  min: number;
  max: number;
  listings: number;
  buyouts: number;
};

export type SnapshotSeriesPoint = {
  t: number;
  capturedAt: string;
  listings: number;
  value: number;
  unique: number;
};

export const CATEGORY_IDS = [
  "all",
  "pokemon",
  "items",
  "stones",
  "cosmetics",
  "berries",
  "bags",
  "balls",
  "cards",
  "held",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];
export type ConcreteCategory = Exclude<CategoryId, "all">;

export type CatalogItem = {
  key: string;
  name: string;
  category: ConcreteCategory;
  itemId: number;
  listings: number;
  buyouts: number;
  offers: number;
  quantity: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
  stdev: number;
  spreadPct: number;
  changePct: number | null;
  cheapestChangePct: number | null;
  totalValue: number;
  spark: number[];
  history: PricePoint[];
  pokemon?: { species: string; enhancement?: number };
  sampleDescription: string;
};

export type SpeciesRow = {
  species: string;
  itemId: number;
  listings: number;
  buyouts: number;
  offers: number;
  min: number;
  median: number;
  max: number;
  mean: number;
  changePct: number | null;
  spark: number[];
  history: PricePoint[];
  enhancements: number[];
  medianEnhancement: number | null;
  totalValue: number;
};
