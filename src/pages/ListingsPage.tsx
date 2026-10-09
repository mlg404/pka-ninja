import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CategoryTabs } from "../components/CategoryTabs";
import { ExpiredFilterSelect } from "../components/ExpiredFilterSelect";
import { ListingTable } from "../components/ListingTable";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { SortSelect } from "../components/SortSelect";
import { formatCount } from "../lib/format";
import { useMarket } from "../lib/market";
import {
  fold,
  matchesExpired,
  matchesQuery,
  offerKind,
  paginate,
  parsePkaCategory,
  type ExpiredFilter,
  type PkaCategory,
} from "../lib/pka";
import { LISTING_SORT_OPTIONS, nextSort, parseOfferSort, sortPatch, sortPkaOffers } from "../lib/sort";

const PAGE_SIZE = 25;

function parseExpired(value: string | null): ExpiredFilter {
  if (value === "expired" || value === "all") return value;
  return "active";
}

const LISTING_SORT = { sort: "seen", dir: "desc" } as const;

export function ListingsPage() {
  const { offers, snapshots, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = parsePkaCategory(params.get("cat"));
  const expired = parseExpired(params.get("exp"));
  const { sort, dir } = parseOfferSort(params.get("sort"), params.get("dir"), LISTING_SORT);
  const page = Number(params.get("page") || "1") || 1;

  const scoped = useMemo(() => offers.filter((offer) => matchesExpired(offer, expired)), [offers, expired]);

  const counts = useMemo(() => {
    const map: Partial<Record<PkaCategory, number>> = { all: scoped.length };
    for (const offer of scoped) {
      const kind = offerKind(offer);
      map[kind] = (map[kind] ?? 0) + 1;
    }
    return map;
  }, [scoped]);

  const filtered = useMemo(() => {
    return scoped.filter((offer) => {
      if (cat !== "all" && offerKind(offer) !== cat) return false;
      return matchesQuery(
        fold(`${offer.itemName} ${offer.sellerName} ${offer.pokeballType} ${offer.description}`),
        q,
      );
    });
  }, [scoped, q, cat]);
  const sorted = useMemo(() => sortPkaOffers(filtered, sort, dir), [filtered, sort, dir]);
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

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando listagens…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Market</p>
        <h1 className="text-3xl font-bold">Listagens</h1>
        <p className="mt-1 text-sm text-slate-400">
          {formatCount(filtered.length)} anúncios
          {expired === "active" ? " no market atual" : " no histórico"}.
          {snapshots.length > 1
            ? " O que sumiu do capture mais novo entra como vendido ou removido."
            : " Com um capture só, ainda não dá para marcar o que saiu."}
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <ExpiredFilterSelect
          value={expired}
          onChange={(value) => patch({ exp: value === "active" ? null : value })}
        />
        <SearchInput
          value={q}
          onChange={(value) => patch({ q: value || null }, true)}
          placeholder="Buscar item, vendedor ou ball…"
        />
        <SortSelect
          sort={sort}
          dir={dir}
          options={LISTING_SORT_OPTIONS}
          onChange={(nextSortKey, nextDir) => patch(sortPatch(nextSortKey, nextDir, LISTING_SORT))}
        />
      </div>

      <CategoryTabs value={cat} onChange={(id) => patch({ cat: id === "all" ? null : id })} counts={counts} />
      <ListingTable
        rows={paged.rows}
        sort={sort}
        dir={dir}
        onSort={(key) => {
          const next = nextSort(sort, dir, key);
          patch(sortPatch(next.sort, next.dir, LISTING_SORT));
        }}
      />
      <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPage={(next) => patch({ page: String(next) })} />
    </div>
  );
}
