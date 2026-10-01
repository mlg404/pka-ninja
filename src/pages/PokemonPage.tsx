import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { formatCount, formatMoney } from "../lib/format";
import { useMarket } from "../lib/market";
import { fold, itemPath, matchesQuery, paginate } from "../lib/pka";

const PAGE_SIZE = 30;

export function PokemonPage() {
  const { items, loading, error } = useMarket();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") || "1") || 1;
  const pokemon = useMemo(() => items.filter((item) => item.kind === "pokemon"), [items]);
  const filtered = useMemo(
    () => pokemon.filter((item) => matchesQuery(fold(`${item.name} ${item.balls.join(" ")}`), q)),
    [pokemon, q],
  );
  const paged = paginate(filtered, page, PAGE_SIZE);

  function patch(next: Record<string, string | null>) {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (!value) copy.delete(key);
      else copy.set(key, value);
    }
    if (!("page" in next)) copy.delete("page");
    setParams(copy);
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
      <SearchInput value={q} onChange={(value) => patch({ q: value || null })} placeholder="Buscar espécie ou ball…" />
      <div className="table-wrap rounded-xl border border-line bg-panel">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Balls</th>
              <th className="text-right">Anúncios</th>
              <th className="text-right">Mín</th>
              <th className="text-right">Mediana</th>
              <th className="text-right">Máx</th>
              <th className="text-right">Média 30d</th>
            </tr>
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
                <td className="num text-right">{row.count30 && row.avg30 != null ? formatMoney(row.avg30) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPage={(next) => patch({ page: String(next) })} />
    </div>
  );
}
