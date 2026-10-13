import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { sortServers, type PkaItem, type PkaOffer, type PricePoint } from "./pka";

const SERVER_KEY = "pka-ninja-server";
const MARKET_URL = "/data/pka_live.json";
const HISTORY_URL = "/data/pka_history.json";
const REMOVED_URL = "/data/pka_removed.json";

export type MarketCapture = {
  t: number;
  capturedAt: string;
  server: string;
  value: number;
};

type MarketView = {
  capturedAt: string | null;
  snapshots: MarketCapture[];
  offers: PkaOffer[];
  items: PkaItem[];
};

type MarketFile = {
  servers: string[];
  all: MarketView;
  byServer: Record<string, MarketView>;
};

type MarketState = {
  capturedAt: string | null;
  snapshots: MarketCapture[];
  offers: PkaOffer[];
  items: PkaItem[];
  loading: boolean;
  error: string | null;
  servers: string[];
  server: string;
  setServer: (server: string) => void;
};

const EMPTY_VIEW: MarketView = { capturedAt: null, snapshots: [], offers: [], items: [] };

const EMPTY: MarketState = {
  ...EMPTY_VIEW,
  loading: true,
  error: null,
  servers: [],
  server: "",
  setServer: () => {},
};

const MarketContext = createContext<MarketState>(EMPTY);

function isCapture(value: unknown): value is MarketCapture {
  if (!value || typeof value !== "object") return false;
  const row = value as MarketCapture;
  return typeof row.capturedAt === "string" && typeof row.t === "number" && typeof row.value === "number";
}

function isView(value: unknown): value is MarketView {
  if (!value || typeof value !== "object") return false;
  const row = value as MarketView;
  return Array.isArray(row.snapshots) && Array.isArray(row.offers) && Array.isArray(row.items) && row.snapshots.every(isCapture);
}

function fillOffer(raw: Partial<PkaOffer>): PkaOffer {
  return {
    itemCode: raw.itemCode ?? "",
    itemName: raw.itemName ?? "",
    count: raw.count ?? 0,
    price: raw.price ?? 0,
    sellerName: raw.sellerName || "—",
    anonymous: raw.anonymous === true,
    description: raw.description ?? "",
    pokeballType: raw.pokeballType ?? "",
    timeleft: raw.timeleft ?? 0,
    seenAt: raw.seenAt ?? 0,
    offerSize: raw.offerSize ?? 0,
    avg7: raw.avg7 ?? 0,
    min7: raw.min7 ?? 0,
    max7: raw.max7 ?? 0,
    count7: raw.count7 ?? 0,
    avg30: raw.avg30 ?? 0,
    min30: raw.min30 ?? 0,
    max30: raw.max30 ?? 0,
    count30: raw.count30 ?? 0,
    page: raw.page ?? 0,
    server: raw.server ?? "",
    removed: raw.removed === true,
  };
}

function fillItem(raw: PkaItem): PkaItem {
  return {
    ...raw,
    history: raw.history ?? [],
    spark: raw.spark ?? [],
    balls: raw.balls ?? [],
    description: raw.description ?? "",
  };
}

function fillView(view: MarketView): MarketView {
  return {
    ...view,
    offers: view.offers.map((offer) => fillOffer(offer)),
    items: view.items.map((item) => fillItem(item)),
  };
}

function parseMarketFile(data: unknown): MarketFile | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { servers?: unknown; all?: unknown; byServer?: unknown };
  if (!isView(row.all)) return null;
  const servers = Array.isArray(row.servers) ? row.servers.filter((name): name is string => typeof name === "string") : [];
  const byServer: Record<string, MarketView> = {};
  if (row.byServer && typeof row.byServer === "object") {
    for (const [name, view] of Object.entries(row.byServer)) {
      if (isView(view)) byServer[name] = fillView(view);
    }
  }
  return { servers: sortServers(servers), all: fillView(row.all), byServer };
}

function storedServer(): string {
  try {
    return localStorage.getItem(SERVER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<MarketFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [server, setServerState] = useState(storedServer);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(MARKET_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("Market não encontrado. Rode npm.cmd run build-site.");
        const parsed = parseMarketFile(await res.json());
        if (!parsed) throw new Error("pka_live.json está incompleto. Rode npm.cmd run build-site.");
        if (cancelled) return;
        setFile(parsed);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar o mercado");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setServer = useCallback((next: string) => {
    setServerState(next);
    try {
      if (next) localStorage.setItem(SERVER_KEY, next);
      else localStorage.removeItem(SERVER_KEY);
    } catch {
      /* ignore private mode */
    }
  }, []);

  const value = useMemo<MarketState>(() => {
    if (!file) return { ...EMPTY, loading, error, setServer };
    const servers = file.servers;
    const active = server && (file.byServer[server] || servers.includes(server)) ? server : "";
    const view = active && file.byServer[active] ? file.byServer[active] : file.all;
    const offers =
      active && file.byServer[active]
        ? file.byServer[active].offers
        : servers.flatMap((name) => file.byServer[name]?.offers ?? []);
    return {
      capturedAt: view.capturedAt,
      snapshots: view.snapshots,
      offers,
      items: view.items,
      loading: false,
      error,
      servers,
      server: active,
      setServer,
    };
  }, [file, loading, error, server, setServer]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketState {
  return useContext(MarketContext);
}

type RemovedFile = Record<string, PkaOffer[]>;

let removedTask: Promise<RemovedFile> | null = null;

function loadRemovedFile(): Promise<RemovedFile> {
  if (!removedTask) {
    removedTask = fetch(REMOVED_URL, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Saídas recentes não encontradas. Rode npm.cmd run build-site.");
        const data = (await res.json()) as { byServer?: Record<string, Partial<PkaOffer>[]> };
        const byServer: RemovedFile = {};
        if (data?.byServer && typeof data.byServer === "object") {
          for (const [name, rows] of Object.entries(data.byServer)) {
            if (Array.isArray(rows)) byServer[name] = rows.map((row) => fillOffer(row));
          }
        }
        return byServer;
      })
      .catch((err: unknown) => {
        removedTask = null;
        throw err;
      });
  }
  return removedTask;
}

export function useRemovedOffers(enabled: boolean): { offers: PkaOffer[]; loading: boolean; error: string | null } {
  const { server, servers } = useMarket();
  const [byServer, setByServer] = useState<RemovedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    loadRemovedFile()
      .then((data) => {
        if (cancelled) return;
        setByServer(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar as saídas");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const offers = useMemo(() => {
    if (!byServer) return [];
    if (server) return byServer[server] ?? [];
    return servers.flatMap((name) => byServer[name] ?? []);
  }, [byServer, server, servers]);

  return { offers, loading: enabled && !byServer && loading, error };
}

type HistoryFile = { byServer?: Record<string, Record<string, unknown>> };

let historyTask: Promise<HistoryFile | null> | null = null;

function loadHistoryFile(): Promise<HistoryFile | null> {
  if (!historyTask) {
    historyTask = fetch(HISTORY_URL, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Histórico não encontrado. Rode npm.cmd run build-site.");
        const data = (await res.json()) as HistoryFile;
        if (!data || typeof data !== "object") throw new Error("pka_history.json está incompleto.");
        return data;
      })
      .catch((err: unknown) => {
        historyTask = null;
        throw err;
      });
  }
  return historyTask;
}

function unpackPoints(value: unknown): PricePoint[] {
  if (!Array.isArray(value)) return [];
  const points: PricePoint[] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [t, min, median, max, listings] = row;
    if (typeof t !== "number") continue;
    points.push({
      t,
      min: typeof min === "number" ? min : 0,
      median: typeof median === "number" ? median : 0,
      max: typeof max === "number" ? max : 0,
      listings: typeof listings === "number" ? listings : 0,
    });
  }
  return points;
}

function seriesFor(file: HistoryFile, server: string, name: string): PricePoint[] {
  const groups = file.byServer ?? {};
  const packs = server && groups[server] ? [groups[server][name]] : Object.values(groups).map((group) => group[name]);
  const points: PricePoint[] = [];
  for (const pack of packs) points.push(...unpackPoints(pack));
  points.sort((a, b) => a.t - b.t);
  return points;
}

export function useItemHistory(name: string): { points: PricePoint[]; loading: boolean; error: string | null } {
  const { server } = useMarket();
  const [file, setFile] = useState<HistoryFile | null>(null);
  const [loading, setLoading] = useState(Boolean(name));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    loadHistoryFile()
      .then((data) => {
        if (cancelled) return;
        setFile(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar o histórico");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  const points = useMemo(() => (file && name ? seriesFor(file, server, name) : []), [file, server, name]);
  return { points, loading, error };
}
