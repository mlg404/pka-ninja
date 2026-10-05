import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { Sparkline } from "../components/Sparkline";
import { cls, formatCount, formatMoney, formatPct } from "../lib/format";
import { useMarket } from "../lib/market";
import { itemPath, opportunityItems, paginate, type OpportunityKind, type PkaItem } from "../lib/pka";

const PAGE_SIZE = 30;

export function OpportunitiesPage() {
  const { items, snapshots, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const kind = parseKind(params.get("tipo"));
  const page = Number(params.get("page") || "1") || 1;
  const rows = useMemo(() => opportunityItems(items, kind), [items, kind]);
  const paged = paginate(rows, page, PAGE_SIZE);
  const sell = kind === "sell";

  function patch(next: Record<string, string | null>) {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (!value) copy.delete(key);
      else copy.set(key, value);
    }
    if (!("page" in next)) copy.delete("page");
    setParams(copy);
  }

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando oportunidades…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-slate-400 hover:text-gold">
        ← Economia
      </Link>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Economia</p>
        <h1 className="text-3xl font-bold">{sell ? "Oportunidades de venda" : "Oportunidades de compra"}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {snapshots.length < 2
            ? "Precisa de pelo menos dois captures para comparar o anúncio mais barato."
            : `${formatCount(rows.length)} itens, sem Pokémon. Compara só o anúncio mais barato entre os captures.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <KindLink active={sell} to="/oportunidades?tipo=venda">
          Venda
        </KindLink>
        <KindLink active={!sell} to="/oportunidades?tipo=compra">
          Compra
        </KindLink>
      </div>

      <OpportunityTable rows={paged.rows} sell={sell} />
      <Pagination page={paged.page} pages={paged.pages} total={rows.length} onPage={(next) => patch({ page: String(next) })} />
    </div>
  );
}

function OpportunityTable({ rows, sell }: { rows: PkaItem[]; sell: boolean }) {
  return (
    <div className="table-wrap rounded-xl border border-line bg-panel">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th className="text-right">Mais barato</th>
            <th className="text-right">Variação</th>
            <th>Preço</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <Link to={itemPath(row.name)} className="font-medium hover:text-gold">
                  {row.name}
                </Link>
                <div className="text-[11px] text-slate-500">{row.active} no market</div>
              </td>
              <td className="num text-right font-semibold text-gold">{formatMoney(row.min)}</td>
              <td className={cls("num text-right", sell ? "up" : "down")}>{formatPct(row.cheapestChangePct)}</td>
              <td>
                <Sparkline values={row.spark} />
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="py-10 text-center text-slate-500">
                Nenhuma oportunidade com os captures atuais.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function KindLink({ active, to, children }: { active: boolean; to: string; children: string }) {
  return (
    <Link
      to={to}
      className={cls(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "border-gold bg-gold/15 text-gold" : "border-line bg-panel text-slate-300 hover:border-slate-500",
      )}
    >
      {children}
    </Link>
  );
}

function parseKind(raw: string | null): OpportunityKind {
  return raw === "compra" ? "buy" : "sell";
}
