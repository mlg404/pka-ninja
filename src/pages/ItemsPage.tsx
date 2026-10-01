import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CategoryTabs } from "../components/CategoryTabs";
import { ItemTable } from "../components/ItemTable";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { formatCount } from "../lib/format";
import { useMarket } from "../lib/market";
import { fold, matchesQuery, paginate, type PkaCategory, type PkaItem } from "../lib/pka";

const PAGE_SIZE = 40;

function parseCat(value: string | null): PkaCategory {
  if (value === "pokemon" || value === "items") return value;
  return "all";
}

function sortItems(rows: PkaItem[], sort: string): PkaItem[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "median") return b.median - a.median;
    if (sort === "change") return (b.changePct ?? -999) - (a.changePct ?? -999);
    if (sort === "avg30") return (b.avg30 ?? -1) - (a.avg30 ?? -1);
    if (sort === "quantity") return b.quantity - a.quantity;
    return b.active - a.active || b.listings - a.listings || a.name.localeCompare(b.name);
  });
  return copy;
}

export function ItemsPage() {
  const { items, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = parseCat(params.get("cat"));
  const sort = params.get("sort") ?? "listings";
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
  const sorted = useMemo(() => sortItems(filtered, sort), [filtered, sort]);
  const paged = paginate(sorted, page, PAGE_SIZE);

  function patch(next: Record<string, string | null>) {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (!value) copy.delete(key);
      else copy.set(key, value);
    }
    if (!("page" in next)) copy.delete("page");
    setParams(copy);
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
        <SearchInput value={q} onChange={(value) => patch({ q: value || null })} placeholder="Buscar pelo nome do item…" />
        <select
          value={sort}
          onChange={(e) => patch({ sort: e.target.value })}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm"
        >
          <option value="listings">Mais anúncios</option>
          <option value="change">Maior alta</option>
          <option value="median">Maior mediana</option>
          <option value="avg30">Maior média 30d</option>
          <option value="quantity">Maior quantidade</option>
          <option value="name">Nome A–Z</option>
        </select>
      </div>

      <CategoryTabs value={cat} onChange={(id) => patch({ cat: id === "all" ? null : id })} counts={counts} />
      <ItemTable rows={paged.rows} />
      <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPage={(next) => patch({ page: String(next) })} />
    </div>
  );
}
