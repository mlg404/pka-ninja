import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listDataFiles } from "./dataFiles";
import {
  buildMarket,
  dedupeSnapshots,
  parsePkaSnapshot,
  sortServers,
  type PkaItem,
  type PkaOffer,
  type PkaSnapshot,
} from "./pka";

const SERVER_KEY = "pka-ninja-server";

type MarketState = {
  capturedAt: string | null;
  snapshots: PkaSnapshot[];
  offers: PkaOffer[];
  items: PkaItem[];
  loading: boolean;
  error: string | null;
  servers: string[];
  server: string;
  setServer: (server: string) => void;
};

const EMPTY: MarketState = {
  capturedAt: null,
  snapshots: [],
  offers: [],
  items: [],
  loading: true,
  error: null,
  servers: [],
  server: "",
  setServer: () => {},
};

const MarketContext = createContext<MarketState>(EMPTY);

async function readJson(path: string): Promise<unknown | null> {
  const res = await fetch(path);
  if (!res.ok) return null;
  const text = await res.text();
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function fetchSnapshot(file: string): Promise<PkaSnapshot | null> {
  const data = await readJson(`/data/${encodeURIComponent(file)}`);
  return parsePkaSnapshot(data, file);
}

function storedServer(): string {
  try {
    return localStorage.getItem(SERVER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<PkaSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [server, setServerState] = useState(storedServer);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const files = await listDataFiles("pka_market-");
        const loaded = (await Promise.all(files.map(fetchSnapshot))).filter(
          (row): row is PkaSnapshot => row != null,
        );
        const unique = dedupeSnapshots(loaded);
        if (cancelled) return;
        if (!unique.length) throw new Error("Nenhum capture de market em /data. Rode npm.cmd run sync-data.");
        setSnapshots(unique);
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
    const servers = sortServers(new Set(snapshots.map((row) => row.server).filter(Boolean)));
    const active = server && servers.includes(server) ? server : "";
    const scoped = active ? snapshots.filter((row) => row.server === active) : snapshots;
    if (!scoped.length) return { ...EMPTY, loading, error, servers, server: active, setServer };
    const latest = scoped[scoped.length - 1];
    const market = buildMarket(scoped);
    return {
      capturedAt: latest.capturedAt,
      snapshots: scoped,
      offers: market.offers,
      items: market.items,
      loading: false,
      error,
      servers,
      server: active,
      setServer,
    };
  }, [snapshots, loading, error, server, setServer]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketState {
  return useContext(MarketContext);
}
