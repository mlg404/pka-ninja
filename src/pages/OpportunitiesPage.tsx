import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { formatMoney, formatPct } from "../lib/format";
import { useMarket } from "../lib/market";
import { itemPath, paginate, type PkaItem } from "../lib/pka";

const PAGE_SIZE = 40;

export function OpportunitiesPage() {
  const { items, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") || "1") || 1;
  const rows = useMemo(
    () =>
      items
        .filter((item) => item.avg30 != null && item.avg30 > 0 && item.min > 0 && item.min < item.avg30 && (item.count30 ?? 0) > 0)
        .map((item) => ({ item, gap: ((item.avg30 ?? 0) - item.min) / (item.avg30 ?? 1) }))
        .sort((a, b) => b.gap - a.gap),
    [items],
  );
  const paged = paginate(rows, page, PAGE_SIZE);

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Market</p>
        <h1 className="text-3xl font-bold">Abaixo da média</h1>
        <p className="mt-1 text-sm text-slate-400">
          Menor anúncio atual contra a média de 30 dias que veio no capture (`avg30`).
        </p>
      </div>
      <div className="table-wrap rounded-xl border border-line bg-panel">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Mais barato</th>
              <th className="text-right">Média 30d</th>
              <th className="text-right">Diferença</th>
              <th className="text-right">Trades 30d</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map(({ item, gap }) => (
              <tr key={item.name}>
                <td>
                  <Link to={itemPath(item.name)} className="font-medium hover:text-gold">
                    {item.name}
                  </Link>
                </td>
                <td className="num text-right font-semibold text-gold">{formatMoney(item.min)}</td>
                <td className="num text-right">{formatMoney(item.avg30)}</td>
                <td className="num text-right down">{formatPct(-gap * 100)}</td>
                <td className="num text-right text-slate-400">{item.count30}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={paged.page}
        pages={paged.pages}
        total={paged.total}
        onPage={(next) => {
          const copy = new URLSearchParams(params);
          copy.set("page", String(next));
          setParams(copy);
        }}
      />
    </div>
  );
}

export type { PkaItem };
