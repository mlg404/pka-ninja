import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listDataFiles } from "./dataFiles";
import {
  buildMarket,
  dedupeSnapshots,
  parsePkaSnapshot,
  type PkaItem,
  type PkaOffer,
  type PkaSnapshot,
} from "./pka";

type MarketState = {
  capturedAt: string | null;
  snapshots: PkaSnapshot[];
  offers: PkaOffer[];
  items: PkaItem[];
  loading: boolean;
  error: string | null;
};

const EMPTY: MarketState = {
  capturedAt: null,
  snapshots: [],
  offers: [],
  items: [],
  loading: true,
  error: null,
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

export function MarketProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<PkaSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const value = useMemo<MarketState>(() => {
    if (!snapshots.length) return { ...EMPTY, loading, error };
    const latest = snapshots[snapshots.length - 1];
    const market = buildMarket(snapshots);
    return {
      capturedAt: latest.capturedAt,
      snapshots,
      offers: market.offers,
      items: market.items,
      loading: false,
      error,
    };
  }, [snapshots, loading, error]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketState {
  return useContext(MarketContext);
}
