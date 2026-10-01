import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCount, formatIso, formatMoney } from "../lib/format";
import { useMarket } from "../lib/market";
import { isOnMarket, itemPath, priceHistogram } from "../lib/pka";

export function EconomyPage() {
  const { capturedAt, snapshots, offers, items, loading, error } = useMarket();
  const live = useMemo(() => offers.filter((offer) => isOnMarket(offer)), [offers]);
  const stats = useMemo(() => {
    const prices = live.map((offer) => offer.price).filter((price) => price > 0).sort((a, b) => a - b);
    const mid = prices.length ? prices[Math.floor((prices.length - 1) / 2)] : 0;
    const pokemon = live.filter((offer) => offer.pokeballType).length;
    const totalValue = live.reduce((sum, offer) => sum + offer.price * Math.max(1, offer.count), 0);
    return {
      median: mid,
      pokemon,
      totalValue,
      hist: priceHistogram(prices),
      mostListed: [...items].sort((a, b) => b.listings - a.listings).slice(0, 8),
      belowAvg: items
        .filter((item) => item.avg30 != null && item.avg30 > 0 && item.min > 0 && item.min < item.avg30)
        .sort((a, b) => a.min / (a.avg30 ?? 1) - b.min / (b.avg30 ?? 1))
        .slice(0, 8),
    };
  }, [live, items]);
  const overview = useMemo(
    () => snapshots.map((snapshot) => ({ t: snapshot.t * 1000, listings: snapshot.offers.length })),
    [snapshots],
  );

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Economia</p>
          <h1 className="text-3xl font-bold">Snapshot do market</h1>
          <p className="mt-1 text-sm text-slate-400">
            {snapshots.length > 1
              ? `${snapshots.length} captures · ${formatIso(snapshots[0].capturedAt)} → ${formatIso(snapshots[snapshots.length - 1].capturedAt)}`
              : capturedAt
                ? `Capture de ${formatIso(capturedAt)}`
                : "Sem capture"}
          </p>
        </div>
        <Link to="/items" className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-yellow-300">
          Ver todos os itens
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Anúncios agora"
          value={formatCount(live.length)}
          hint={offers.length > live.length ? `${formatCount(offers.length)} no histórico` : undefined}
        />
        <Stat label="Nomes" value={formatCount(items.length)} hint="agrupados por item_name" />
        <Stat label="Valor listado" value={formatMoney(stats.totalValue)} hint="preço × quantidade" />
        <Stat label="Pokémon" value={formatCount(stats.pokemon)} hint={`mediana ${formatMoney(stats.median)}`} />
      </section>

      {overview.length > 1 && (
        <section className="rounded-xl border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-semibold">Anúncios por capture</h2>
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart data={overview} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#273142" strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t) => new Date(Number(t)).toLocaleDateString("pt-BR")}
                  stroke="#9aa8bd"
                  fontSize={11}
                />
                <YAxis stroke="#9aa8bd" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#10141c", border: "1px solid #273142" }}
                  labelFormatter={(t) => new Date(Number(t)).toLocaleString("pt-BR")}
                  formatter={(value) => [formatCount(Number(value)), "anúncios"]}
                />
                <Line type="monotone" dataKey="listings" stroke="#f5c542" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-panel p-4">
        <h2 className="mb-2 text-sm font-semibold">Distribuição de preço</h2>
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={stats.hist} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#273142" strokeDasharray="3 3" />
              <XAxis dataKey="bucket" stroke="#9aa8bd" fontSize={10} interval={1} />
              <YAxis stroke="#9aa8bd" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#10141c", border: "1px solid #273142" }} />
              <Bar dataKey="count" fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Mini title="Mais listados" rows={stats.mostListed.map((row) => ({ name: row.name, value: `${row.listings} anúncios` }))} />
        <Mini
          title="Abaixo da média de 30 dias"
          rows={stats.belowAvg.map((row) => ({
            name: row.name,
            value: `${formatMoney(row.min)} · média ${formatMoney(row.avg30)}`,
          }))}
        />
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Mini({ title, rows }: { title: string; rows: { name: string; value: string }[] }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-3">
      <h2 className="mb-1 text-xs font-semibold text-slate-200">{title}</h2>
      <ul className="divide-y divide-line/70">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-2 py-1.5">
            <Link to={itemPath(row.name)} className="min-w-0 flex-1 truncate text-sm hover:text-gold">
              {row.name}
            </Link>
            <span className="num shrink-0 text-xs text-slate-300">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
