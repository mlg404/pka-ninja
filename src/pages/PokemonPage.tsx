import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { SortSelect } from "../components/SortSelect";
import { SortableHead, type SortColumn } from "../components/SortableHead";
import { Sparkline } from "../components/Sparkline";
import { cls, formatCount, formatMoney, formatPct } from "../lib/format";
import { useMarket } from "../lib/market";
import { fold, itemPath, matchesQuery, paginate } from "../lib/pka";
import { nextSort, parseItemSort, POKEMON_SORT_OPTIONS, sortPatch, sortPkaItems } from "../lib/sort";

const PAGE_SIZE = 30;
const POKEMON_SORT = { sort: "listings", dir: "desc" } as const;
const COLUMNS: SortColumn[] = [
  { key: "name", label: "Nome" },
  { key: "balls", label: "Balls" },
  { key: "listings", label: "Anúncios", align: "right" },
  { key: "min", label: "Mín", align: "right" },
  { key: "median", label: "Mediana", align: "right" },
  { key: "max", label: "Máx", align: "right" },
  { key: "change", label: "Δ", align: "right" },
  { key: "spark", label: "Preço", sortable: false },
];

export function PokemonPage() {
  const { items, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const { sort, dir } = parseItemSort(params.get("sort"), params.get("dir"), POKEMON_SORT);
  const page = Number(params.get("page") || "1") || 1;
  const pokemon = useMemo(() => items.filter((item) => item.kind === "pokemon"), [items]);
  const filtered = useMemo(
    () => pokemon.filter((item) => matchesQuery(fold(`${item.name} ${item.balls.join(" ")}`), q)),
    [pokemon, q],
  );
  const sorted = useMemo(() => sortPkaItems(filtered, sort, dir), [filtered, sort, dir]);
  const paged = paginate(sorted, page, PAGE_SIZE);

  function patch(next: Record<string, string | null>, replace = false) {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (!value) copy.delete(key);
      else copy.set(key, value);
    }
    if (!("page" in next)) copy.delete("page");
    setParams(copy, { replace });
  }

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Market</p>
        <h1 className="text-3xl font-bold">Pokémon</h1>
        <p className="mt-1 text-sm text-slate-400">
          {formatCount(filtered.length)} nomes com pokeball no capture. O nome é o `item_name` do arquivo.
        </p>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={(value) => patch({ q: value || null }, true)} placeholder="Buscar espécie ou ball…" />
        <SortSelect
          sort={sort}
          dir={dir}
          options={POKEMON_SORT_OPTIONS}
          onChange={(nextSortKey, nextDir) => patch(sortPatch(nextSortKey, nextDir, POKEMON_SORT))}
        />
      </div>
      <div className="table-wrap rounded-xl border border-line bg-panel">
        <table>
          <thead>
            <SortableHead
              columns={COLUMNS}
              sort={sort}
              dir={dir}
              onSort={(key) => {
                const next = nextSort(sort, dir, key);
                patch(sortPatch(next.sort, next.dir, POKEMON_SORT));
              }}
            />
          </thead>
          <tbody>
            {paged.rows.map((row) => (
              <tr key={row.name}>
                <td>
                  <Link to={itemPath(row.name)} className="font-medium hover:text-gold">
                    {row.name}
                  </Link>
                </td>
                <td className="text-slate-400">{row.balls.join(", ") || "—"}</td>
                <td className="num text-right">{row.listings}</td>
                <td className="num text-right">{formatMoney(row.min)}</td>
                <td className="num text-right font-semibold text-gold">{formatMoney(row.median)}</td>
                <td className="num text-right">{formatMoney(row.max)}</td>
                <td className={cls("num text-right", (row.changePct ?? 0) > 0 ? "up" : (row.changePct ?? 0) < 0 ? "down" : "text-slate-400")}>
                  {formatPct(row.changePct)}
                </td>
                <td>
                  <Sparkline values={row.spark} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPage={(next) => patch({ page: String(next) })} />
    </div>
  );
}
