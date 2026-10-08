import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SortableHead, type SortColumn } from "../components/SortableHead";
import { formatCount, formatFullMoney, formatIso, formatMoney } from "../lib/format";
import { useMarket } from "../lib/market";
import { fold, itemPath, type PkaItem } from "../lib/pka";
import { nextSort, type SortDir } from "../lib/sort";

type StashRow = {
  itemId: number;
  label: string;
  count: number;
  marketName: string | null;
  unit: number | null;
  source: "mediana" | "média 30d" | null;
  value: number | null;
};

const STASH_COLUMNS: SortColumn[] = [
  { key: "label", label: "Item" },
  { key: "count", label: "Qtd", align: "right" },
  { key: "unit", label: "Unitário", align: "right" },
  { key: "value", label: "Total", align: "right" },
];

type StashFile = {
  capturedAt: string | null;
  rows: { itemId: number; name: string; count: number }[];
};

function sortStash(rows: StashRow[], sort: string, dir: SortDir): StashRow[] {
  const copy = [...rows];
  const sign = dir === "asc" ? 1 : -1;
  copy.sort((a, b) => {
    const tie = a.label.localeCompare(b.label, "pt", { sensitivity: "base" });
    if (sort === "label") return a.label.localeCompare(b.label, "pt", { sensitivity: "base" }) * sign;
    const left = sort === "count" ? a.count : sort === "unit" ? a.unit : a.value;
    const right = sort === "count" ? b.count : sort === "unit" ? b.unit : b.value;
    if (left == null && right == null) return tie;
    if (left == null) return 1;
    if (right == null) return -1;
    return (left - right) * sign || tie;
  });
  return copy;
}

function stashLabel(raw: string): string {
  const line = raw.split(/\r?\n/)[0] ?? raw;
  return line.replace(/\.+$/g, "").trim();
}

function unitPrice(item: PkaItem | undefined): { unit: number; source: "mediana" | "média 30d" } | null {
  if (!item) return null;
  if (item.median > 0) return { unit: item.median, source: "mediana" };
  if (item.avg30 != null && item.avg30 > 0 && (item.count30 ?? 0) > 0) {
    return { unit: item.avg30, source: "média 30d" };
  }
  return null;
}

function parseStash(text: string): StashFile {
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== "object") throw new Error("JSON inválido.");
  const record = data as { capturedAt?: unknown; items?: unknown };
  if (!Array.isArray(record.items)) throw new Error("Esse arquivo não tem a lista de itens do stash.");
  const rows = record.items.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as { itemId?: unknown; name?: unknown; count?: unknown };
    const name = typeof item.name === "string" ? item.name : "";
    const count = typeof item.count === "number" ? item.count : 0;
    const itemId = typeof item.itemId === "number" ? item.itemId : 0;
    if (!name || count <= 0) return [];
    return [{ itemId, name, count }];
  });
  if (!rows.length) throw new Error("Nenhum item com quantidade nesse arquivo.");
  return {
    capturedAt: typeof record.capturedAt === "string" ? record.capturedAt : null,
    rows,
  };
}

export function StashPage() {
  const { items, capturedAt, loading, error } = useMarket();
  const [fileName, setFileName] = useState<string | null>(null);
  const [stash, setStash] = useState<StashFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const byName = useMemo(() => {
    const map = new Map<string, PkaItem>();
    for (const item of items) map.set(fold(item.name), item);
    return map;
  }, [items]);

  const valued = useMemo(() => {
    if (!stash) return [];
    const rows: StashRow[] = stash.rows.map((row) => {
      const label = stashLabel(row.name);
      const market = byName.get(fold(label));
      const price = unitPrice(market);
      return {
        itemId: row.itemId,
        label,
        count: row.count,
        marketName: market?.name ?? null,
        unit: price?.unit ?? null,
        source: price?.source ?? null,
        value: price ? price.unit * row.count : null,
      };
    });
    return rows;
  }, [stash, byName]);
  const [sort, setSort] = useState("value");
  const [dir, setDir] = useState<SortDir>("desc");
  const ordered = useMemo(() => sortStash(valued, sort, dir), [valued, sort, dir]);

  const total = valued.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const priced = valued.filter((row) => row.value != null).length;

  async function onFile(file: File | undefined) {
    setParseError(null);
    setStash(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    try {
      setStash(parseStash(await file.text()));
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Não consegui ler esse arquivo.");
    }
  }

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando o market…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Depot Stash</p>
        <h1 className="text-3xl font-bold">Valor do stash</h1>
        <p className="mt-1 text-sm text-slate-400">
          Envie o JSON do depot stash. O valor de cada item é a mediana do market
          {capturedAt ? ` (${formatIso(capturedAt)})` : ""} × a quantidade. Sem anúncio ativo, entra a média de 30 dias.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-dashed border-line bg-panel px-4 py-4 text-sm hover:border-gold/50">
        <span className="font-medium text-slate-200">Arquivo do stash</span>
        <input
          type="file"
          accept="application/json,.json"
          className="text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
      </label>

      {parseError && <p className="text-sm text-rose-400">{parseError}</p>}

      {stash && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-panel px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Valor total</p>
              <p className="mt-1 text-xl font-semibold text-gold">{formatMoney(total)}</p>
              <p className="text-xs text-slate-500">{formatFullMoney(total)}</p>
            </div>
            <div className="rounded-xl border border-line bg-panel px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Itens</p>
              <p className="mt-1 text-xl font-semibold">{formatCount(valued.length)}</p>
              <p className="text-xs text-slate-500">
                {formatCount(priced)} com preço
                {priced < valued.length ? ` · ${formatCount(valued.length - priced)} sem market` : ""}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-panel px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Stash</p>
              <p className="mt-1 text-xl font-semibold">{stash.capturedAt ? formatIso(stash.capturedAt) : "—"}</p>
              <p className="text-xs text-slate-500">data do arquivo</p>
            </div>
          </section>

          <div className="table-wrap rounded-xl border border-line bg-panel">
            <table>
              <thead>
                <SortableHead
                  columns={STASH_COLUMNS}
                  sort={sort}
                  dir={dir}
                  onSort={(key) => {
                    const next = nextSort(sort, dir, key);
                    setSort(next.sort);
                    setDir(next.dir);
                  }}
                />
              </thead>
              <tbody>
                {ordered.map((row) => (
                  <tr key={`${row.itemId}-${row.label}`}>
                    <td>
                      {row.marketName ? (
                        <Link to={itemPath(row.marketName)} className="font-medium hover:text-gold">
                          {row.label}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.label}</span>
                      )}
                      {!row.marketName && <div className="text-[11px] text-slate-500">sem anúncio no market</div>}
                    </td>
                    <td className="num text-right">{formatCount(row.count)}</td>
                    <td className="num text-right text-slate-300">
                      {row.unit != null ? formatMoney(row.unit) : "—"}
                      {row.source && <div className="text-[11px] text-slate-500">{row.source}</div>}
                    </td>
                    <td className="num text-right font-semibold text-gold">
                      {row.value != null ? formatMoney(row.value) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
