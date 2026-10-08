import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { sortServers, type PkaItem, type PkaOffer } from "./pka";

const SERVER_KEY = "pka-ninja-server";
const MARKET_URL = "/data/pka_market.json";

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

function parseMarketFile(data: unknown): MarketFile | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { servers?: unknown; all?: unknown; byServer?: unknown };
  if (!isView(row.all)) return null;
  const servers = Array.isArray(row.servers) ? row.servers.filter((name): name is string => typeof name === "string") : [];
  const byServer: Record<string, MarketView> = {};
  if (row.byServer && typeof row.byServer === "object") {
    for (const [name, view] of Object.entries(row.byServer)) {
      if (isView(view)) byServer[name] = view;
    }
  }
  return { servers: sortServers(servers), all: row.all, byServer };
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
        if (!res.ok) throw new Error("Market agregado não encontrado. Rode npm.cmd run build-market.");
        const parsed = parseMarketFile(await res.json());
        if (!parsed) throw new Error("pka_market.json está incompleto. Rode npm.cmd run build-market.");
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
    return {
      capturedAt: view.capturedAt,
      snapshots: view.snapshots,
      offers: view.offers,
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
