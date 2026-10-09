import { Link } from "react-router-dom";
import { Sparkline } from "./Sparkline";
import { SortableHead, type SortColumn } from "./SortableHead";
import { cls, formatCount, formatMoney, formatPct } from "../lib/format";
import { itemPath, pkaCategoryLabel, type PkaItem } from "../lib/pka";
import type { SortDir } from "../lib/sort";

type Props = {
  rows: PkaItem[];
  sort: string;
  dir: SortDir;
  onSort: (key: string) => void;
};

const COLUMNS: SortColumn[] = [
  { key: "name", label: "Item" },
  { key: "active", label: "Anúncios", align: "right" },
  { key: "quantity", label: "Qtd", align: "right" },
  { key: "min", label: "Mín", align: "right" },
  { key: "median", label: "Mediana", align: "right" },
  { key: "max", label: "Máx", align: "right" },
  { key: "avg30", label: "Média 30d", align: "right" },
  { key: "change", label: "Δ", align: "right" },
  { key: "spark", label: "Preço", sortable: false },
];

function stat(value: number | null, trades: number | null): string {
  if (value == null || trades == null || trades <= 0) return "—";
  return formatMoney(value);
}

export function ItemTable({ rows, sort, dir, onSort }: Props) {
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
                <div className="text-[11px] text-slate-500">
                  {pkaCategoryLabel(row.kind)}
                  {row.balls.length > 0 && ` · ${row.balls.join(", ")}`}
                </div>
              </td>
              <td className="num text-right">
                {row.active}
                {row.listings > row.active && (
                  <div className="text-[11px] text-slate-500">{formatCount(row.listings)} no histórico</div>
                )}
              </td>
              <td className="num text-right">{formatCount(row.quantity)}</td>
              <td className="num text-right text-slate-300">{row.min ? formatMoney(row.min) : "—"}</td>
              <td className="num text-right font-semibold text-gold">{row.median ? formatMoney(row.median) : "—"}</td>
              <td className="num text-right text-slate-300">{row.max ? formatMoney(row.max) : "—"}</td>
              <td className="num text-right">{stat(row.avg30, row.count30)}</td>
              <td className={cls("num text-right", (row.changePct ?? 0) > 0 ? "up" : (row.changePct ?? 0) < 0 ? "down" : "text-slate-400")}>
                {formatPct(row.changePct)}
              </td>
              <td>
                <Sparkline values={row.spark} />
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={9} className="py-10 text-center text-slate-500">
                Nenhum item nesse filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
