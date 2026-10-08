import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkline } from "../components/Sparkline";
import { cls, formatCount, formatIso, formatMoney, formatPct } from "../lib/format";
import { useMarket } from "../lib/market";
import { isOnMarket, itemPath, opportunityItems, priceHistogram, type PkaItem } from "../lib/pka";

export function EconomyPage() {
  const { capturedAt, snapshots, offers, items, loading, error } = useMarket();
  const live = useMemo(() => offers.filter((offer) => isOnMarket(offer)), [offers]);
  const listed = useMemo(() => items.filter((item) => item.active > 0), [items]);
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
    };
  }, [live]);
  const overview = useMemo(
    () =>
      snapshots.map((snapshot) => ({
        t: snapshot.t * 1000,
        value: snapshot.value,
      })),
    [snapshots],
  );
  const mostListed = useMemo(() => [...listed].sort((a, b) => b.active - a.active).slice(0, 8), [listed]);
  const biggestValue = useMemo(() => [...listed].sort((a, b) => b.totalValue - a.totalValue).slice(0, 8), [listed]);
  const movers = useMemo(
    () =>
      [...listed]
        .filter((item) => item.changePct != null && item.active >= 2)
        .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
        .slice(0, 8),
    [listed],
  );
  const volatile = useMemo(
    () => [...listed].filter((item) => item.active >= 2).sort((a, b) => b.spreadPct - a.spreadPct).slice(0, 8),
    [listed],
  );
  const sellOpps = useMemo(() => opportunityItems(items, "sell").slice(0, 8), [items]);
  const buyOpps = useMemo(() => opportunityItems(items, "buy").slice(0, 8), [items]);

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
        <Stat label="Nomes" value={formatCount(listed.length)} hint="ainda no market" />
        <Stat label="Valor listado" value={formatMoney(stats.totalValue)} hint="preço × quantidade" />
        <Stat label="Pokémon" value={formatCount(stats.pokemon)} hint={`mediana ${formatMoney(stats.median)}`} />
      </section>

      <section className={overview.length > 1 ? "grid gap-4 lg:grid-cols-2" : undefined}>
        <Chart title="Distribuição de preço">
          <BarChart data={stats.hist} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#273142" strokeDasharray="3 3" />
            <XAxis dataKey="bucket" stroke="#9aa8bd" fontSize={10} interval={1} />
            <YAxis stroke="#9aa8bd" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#10141c", border: "1px solid #273142" }} />
            <Bar dataKey="count" fill="#34d399" radius={[3, 3, 0, 0]} />
          </BarChart>
        </Chart>
        {overview.length > 1 && (
          <Chart title="Valor listado no tempo">
            <AreaChart data={overview} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="listed-value" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                formatter={(value) => [formatMoney(Number(value)), "valor"]}
              />
              <Area type="monotone" dataKey="value" stroke="#34d399" fill="url(#listed-value)" />
            </AreaChart>
          </Chart>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Mini title="Mais listados" rows={mostListed} value={(row) => `${row.active} anúncios`} />
        <Mini title="Maior valor no market" rows={biggestValue} value={(row) => formatMoney(row.totalValue)} />
        <Mini
          title="Maiores movimentos"
          hint="Quem mais subiu ou caiu na mediana entre os captures."
          rows={movers}
          value={(row) => <span className={cls("num", (row.changePct ?? 0) >= 0 ? "up" : "down")}>{formatPct(row.changePct)}</span>}
        />
        <Mini
          title="Maior variação de preço"
          hint="Maior distância entre o anúncio mais caro e o mais barato agora."
          rows={volatile}
          value={(row) => `${row.spreadPct.toFixed(0)}%`}
        />
        <Mini
          title="Melhores oportunidades de venda"
          hint="Itens, sem Pokémon, cujo anúncio mais barato mais subiu."
          rows={sellOpps}
          moreTo="/oportunidades?tipo=venda"
          value={(row) => (
            <span className="num up">
              {formatMoney(row.min)} · {formatPct(row.cheapestChangePct)}
            </span>
          )}
        />
        <Mini
          title="Melhores oportunidades de compra"
          hint="Itens, sem Pokémon, cujo anúncio mais barato mais caiu."
          rows={buyOpps}
          moreTo="/oportunidades?tipo=compra"
          value={(row) => (
            <span className="num down">
              {formatMoney(row.min)} · {formatPct(row.cheapestChangePct)}
            </span>
          )}
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

function Chart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="h-52">
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </section>
  );
}

function Mini({
  title,
  hint,
  rows,
  value,
  moreTo,
}: {
  title: string;
  hint?: string;
  rows: PkaItem[];
  value: (row: PkaItem) => ReactNode;
  moreTo?: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-3">
      <h2 className="text-xs font-semibold text-slate-200">{title}</h2>
      {hint && <p className="mb-1.5 text-[10px] leading-snug text-slate-500">{hint}</p>}
      <ul className="divide-y divide-line/70">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-2 py-1">
            <Sparkline values={row.spark} width={52} height={16} />
            <Link to={itemPath(row.name)} className="min-w-0 flex-1 truncate text-sm hover:text-gold">
              {row.name}
            </Link>
            <div className="num shrink-0 text-xs text-slate-200">{value(row)}</div>
          </li>
        ))}
        {!rows.length && <li className="py-3 text-xs text-slate-500">Ainda sem comparação entre captures.</li>}
      </ul>
      {moreTo && (
        <Link
          to={moreTo}
          className="mt-2 block rounded-md border border-line bg-panel-2 px-2 py-1.5 text-center text-xs font-medium text-gold hover:border-gold/50"
        >
          Ver mais
        </Link>
      )}
    </section>
  );
}
