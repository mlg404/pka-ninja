import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { SortSelect } from "../components/SortSelect";
import { SortableHead, type SortColumn } from "../components/SortableHead";
import { Sparkline } from "../components/Sparkline";
import { cls, formatCount, formatMoney, formatPct } from "../lib/format";
import { useMarket } from "../lib/market";
import { itemPath, opportunityItems, paginate, type OpportunityKind, type PkaItem } from "../lib/pka";
import { nextSort, sortOpportunities, sortPatch, type SortChoice, type SortDir } from "../lib/sort";

const PAGE_SIZE = 30;
const COLUMNS: SortColumn[] = [
  { key: "name", label: "Item" },
  { key: "min", label: "Mais barato", align: "right" },
  { key: "change", label: "Variação", align: "right" },
  { key: "spark", label: "Preço", sortable: false },
];
const OPP_SORT_OPTIONS: SortChoice[] = [
  { sort: "change", dir: "desc", label: "Maior alta" },
  { sort: "change", dir: "asc", label: "Maior queda" },
  { sort: "min", dir: "desc", label: "Maior preço" },
  { sort: "min", dir: "asc", label: "Menor preço" },
  { sort: "name", dir: "asc", label: "Nome A–Z" },
  { sort: "name", dir: "desc", label: "Nome Z–A" },
];

export function OpportunitiesPage() {
  const { items, snapshots, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const kind = parseKind(params.get("tipo"));
  const sell = kind === "sell";
  const fallback = { sort: "change", dir: (sell ? "desc" : "asc") as SortDir };
  const sort = params.get("sort") ?? fallback.sort;
  const dir: SortDir = params.get("dir") === "asc" || params.get("dir") === "desc" ? (params.get("dir") as SortDir) : fallback.dir;
  const page = Number(params.get("page") || "1") || 1;
  const rows = useMemo(() => sortOpportunities(opportunityItems(items, kind), sort, dir), [items, kind, sort, dir]);
  const paged = paginate(rows, page, PAGE_SIZE);

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

      <div className="flex flex-wrap items-center gap-2">
        <KindLink active={sell} to="/oportunidades?tipo=venda">
          Venda
        </KindLink>
        <KindLink active={!sell} to="/oportunidades?tipo=compra">
          Compra
        </KindLink>
        <SortSelect
          sort={sort}
          dir={dir}
          options={OPP_SORT_OPTIONS}
          onChange={(nextSortKey, nextDir) => patch(sortPatch(nextSortKey, nextDir, fallback))}
        />
      </div>

      <OpportunityTable
        rows={paged.rows}
        sell={sell}
        sort={sort}
        dir={dir}
        onSort={(key) => {
          const next = nextSort(sort, dir, key);
          patch(sortPatch(next.sort, next.dir, fallback));
        }}
      />
      <Pagination page={paged.page} pages={paged.pages} total={rows.length} onPage={(next) => patch({ page: String(next) })} />
    </div>
  );
}

function OpportunityTable({
  rows,
  sell,
  sort,
  dir,
  onSort,
}: {
  rows: PkaItem[];
  sell: boolean;
  sort: string;
  dir: SortDir;
  onSort: (key: string) => void;
}) {
  return (
    <div className="table-wrap rounded-xl border border-line bg-panel">
      <table>
        <thead>
          <SortableHead columns={COLUMNS} sort={sort} dir={dir} onSort={onSort} />
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
