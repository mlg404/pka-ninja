import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CategoryTabs } from "../components/CategoryTabs";
import { ItemTable } from "../components/ItemTable";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { SortSelect } from "../components/SortSelect";
import { formatCount } from "../lib/format";
import { useMarket } from "../lib/market";
import { fold, matchesQuery, paginate, parsePkaCategory, type PkaCategory } from "../lib/pka";
import { ITEM_SORT_OPTIONS, nextSort, parseItemSort, sortPatch, sortPkaItems } from "../lib/sort";

const PAGE_SIZE = 40;

const ITEM_SORT = { sort: "active", dir: "desc" } as const;

export function ItemsPage() {
  const { items, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = parsePkaCategory(params.get("cat"));
  const rawSort = params.get("sort") === "listings" ? "active" : params.get("sort");
  const { sort, dir } = parseItemSort(rawSort, params.get("dir"), ITEM_SORT);
  const page = Number(params.get("page") || "1") || 1;

  const counts = useMemo(() => {
    const map: Partial<Record<PkaCategory, number>> = { all: items.length };
    for (const item of items) map[item.kind] = (map[item.kind] ?? 0) + 1;
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (cat !== "all" && item.kind !== cat) return false;
      return matchesQuery(fold(`${item.name} ${item.description} ${item.balls.join(" ")}`), q);
    });
  }, [items, q, cat]);
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

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando itens…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Market</p>
        <h1 className="text-3xl font-bold">Itens</h1>
        <p className="mt-1 text-sm text-slate-400">
          {formatCount(filtered.length)} de {formatCount(items.length)} nomes. Mín, mediana e máx são os anúncios ainda no market. Δ compara a mediana entre os captures salvos.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={(value) => patch({ q: value || null }, true)} placeholder="Buscar pelo nome do item…" />
        <SortSelect
          sort={sort}
          dir={dir}
          options={ITEM_SORT_OPTIONS}
          onChange={(nextSortKey, nextDir) => patch(sortPatch(nextSortKey, nextDir, ITEM_SORT))}
        />
      </div>

      <CategoryTabs value={cat} onChange={(id) => patch({ cat: id === "all" ? null : id })} counts={counts} />
      <ItemTable
        rows={paged.rows}
        sort={sort}
        dir={dir}
        onSort={(key) => {
          const next = nextSort(sort, dir, key);
          patch(sortPatch(next.sort, next.dir, ITEM_SORT));
        }}
      />
      <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPage={(next) => patch({ page: String(next) })} />
    </div>
  );
}
