import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExpiredFilterSelect } from "../components/ExpiredFilterSelect";
import { ListingTable } from "../components/ListingTable";
import { SortSelect } from "../components/SortSelect";
import { Sparkline } from "../components/Sparkline";
import { formatCount, formatFullMoney, formatIso, formatMoney, formatPct } from "../lib/format";
import { useMarket } from "../lib/market";
import { fold, matchesExpired, pkaCategoryLabel, type ExpiredFilter } from "../lib/pka";
import { LISTING_SORT_OPTIONS, nextSort, parseOfferSort, sortPatch, sortPkaOffers } from "../lib/sort";

function stat(value: number | null, trades: number | null): string {
  if (value == null || trades == null || trades <= 0) return "—";
  return formatMoney(value);
}

export function ItemDetailPage() {
  const { name = "" } = useParams();
  const itemName = decodeURIComponent(name);
  const wanted = fold(itemName);
  const { items, offers, snapshots, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const expired = parseExpired(params.get("exp"));
  const { sort, dir } = parseOfferSort(params.get("sort"), params.get("dir"), DETAIL_SORT);

  const item = items.find((row) => fold(row.name) === wanted);
  const rows = useMemo(() => {
    const matched = offers.filter((offer) => fold(offer.itemName) === wanted && matchesExpired(offer, expired));
    return sortPkaOffers(matched, sort, dir);
  }, [offers, wanted, expired, sort, dir]);
  const series = useMemo(
    () =>
      (item?.history ?? []).map((point) => ({
        t: point.t * 1000,
        median: point.median,
        min: point.min,
        listings: point.listings,
      })),
    [item],
  );

  function patch(next: Record<string, string | null>) {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (!value) copy.delete(key);
      else copy.set(key, value);
    }
    setParams(copy);
  }

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;
  if (!item && !rows.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-400">Item não encontrado neste capture.</p>
        <Link to="/items" className="mt-3 inline-block text-gold">
          Voltar aos itens
        </Link>
      </div>
    );
  }

  const displayName = item?.name ?? itemName;

  return (
    <div className="space-y-5">
      <Link to="/items" className="text-sm text-slate-400 hover:text-gold">
        ← Itens
      </Link>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          {item ? pkaCategoryLabel(item.kind) : "Item"}
          {item?.balls.length ? ` · ${item.balls.join(", ")}` : ""}
        </p>
        <h1 className="text-3xl font-bold">{displayName}</h1>
        {item?.description && (
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-slate-400">{item.description}</p>
        )}
        {snapshots.length > 1 && (
          <p className="mt-1 text-sm text-slate-500">
            Histórico de {formatIso(snapshots[0].capturedAt)} → {formatIso(snapshots[snapshots.length - 1].capturedAt)}
            {item?.changePct != null ? ` · mediana ${formatPct(item.changePct)}` : ""}
          </p>
        )}
      </div>

      {series.length > 1 && (
        <section className="rounded-xl border border-line bg-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Histórico de preço</h2>
            <Sparkline values={item?.spark ?? []} width={140} height={36} />
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#273142" strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t) => new Date(Number(t)).toLocaleDateString("pt-BR")}
                  stroke="#9aa8bd"
                  fontSize={11}
                />
                <YAxis stroke="#9aa8bd" fontSize={11} tickFormatter={(value) => formatMoney(Number(value))} />
                <Tooltip
                  contentStyle={{ background: "#10141c", border: "1px solid #273142" }}
                  labelFormatter={(t) => new Date(Number(t)).toLocaleString("pt-BR")}
                  formatter={(value, key) => [
                    key === "listings" ? formatCount(Number(value)) : formatFullMoney(Number(value)),
                    key === "min" ? "mínimo" : key === "listings" ? "anúncios" : "mediana",
                  ]}
                />
                <Line type="monotone" dataKey="median" stroke="#f5c542" strokeWidth={2} dot />
                <Line type="monotone" dataKey="min" stroke="#34d399" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="No market" value={formatCount(item?.active ?? 0)} hint={item && item.listings > item.active ? `${formatCount(item.listings)} no histórico` : undefined} />
        <Stat label="Preço agora" value={item?.min ? `${formatMoney(item.min)} – ${formatMoney(item.max)}` : "—"} hint={item?.median ? `mediana ${formatMoney(item.median)}` : undefined} />
        <Stat label="7 dias" value={stat(item?.avg7 ?? null, item?.count7 ?? null)} hint={item?.count7 ? `${formatCount(item.count7)} trades` : "sem histórico"} />
        <Stat label="30 dias" value={stat(item?.avg30 ?? null, item?.count30 ?? null)} hint={item?.min30 != null && item.max30 != null && item.count30 ? `${formatMoney(item.min30)} – ${formatMoney(item.max30)}` : "sem histórico"} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Anúncios deste item</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SortSelect
            sort={sort}
            dir={dir}
            options={LISTING_SORT_OPTIONS}
            onChange={(nextSortKey, nextDir) => patch(sortPatch(nextSortKey, nextDir, DETAIL_SORT))}
          />
          <ExpiredFilterSelect
            value={expired}
            onChange={(value) => patch({ exp: value === "active" ? null : value })}
          />
        </div>
      </div>
      <ListingTable
        rows={rows}
        sort={sort}
        dir={dir}
        onSort={(key) => {
          const next = nextSort(sort, dir, key);
          patch(sortPatch(next.sort, next.dir, DETAIL_SORT));
        }}
      />
    </div>
  );
}

const DETAIL_SORT = { sort: "price", dir: "asc" } as const;

function parseExpired(value: string | null): ExpiredFilter {
  if (value === "expired" || value === "all") return value;
  return "active";
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gold">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
