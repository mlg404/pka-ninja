import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CategoryTabs } from "../components/CategoryTabs";
import { ExpiredFilterSelect } from "../components/ExpiredFilterSelect";
import { ListingTable } from "../components/ListingTable";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { formatCount } from "../lib/format";
import { useMarket } from "../lib/market";
import {
  fold,
  matchesExpired,
  matchesQuery,
  offerKind,
  paginate,
  type ExpiredFilter,
  type PkaCategory,
  type PkaOffer,
} from "../lib/pka";

const PAGE_SIZE = 25;

function parseCat(value: string | null): PkaCategory {
  if (value === "pokemon" || value === "items") return value;
  return "all";
}

function parseExpired(value: string | null): ExpiredFilter {
  if (value === "expired" || value === "all") return value;
  return "active";
}

function sortOffers(rows: PkaOffer[], sort: string): PkaOffer[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "name") return a.itemName.localeCompare(b.itemName) || a.price - b.price;
    return b.seenAt - a.seenAt;
  });
  return copy;
}

export function ListingsPage() {
  const { offers, snapshots, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = parseCat(params.get("cat"));
  const expired = parseExpired(params.get("exp"));
  const sort = params.get("sort") ?? "seen";
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
  const sorted = useMemo(() => sortOffers(filtered, sort), [filtered, sort]);
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
          onChange={(value) => patch({ q: value || null })}
          placeholder="Buscar item, vendedor ou ball…"
        />
        <select
          value={sort}
          onChange={(e) => patch({ sort: e.target.value })}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm"
        >
          <option value="seen">Ordem do capture</option>
          <option value="price-desc">Maior preço</option>
          <option value="price-asc">Menor preço</option>
          <option value="name">Nome A–Z</option>
        </select>
      </div>

      <CategoryTabs value={cat} onChange={(id) => patch({ cat: id === "all" ? null : id })} counts={counts} />
      <ListingTable rows={paged.rows} />
      <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPage={(next) => patch({ page: String(next) })} />
    </div>
  );
}
