import { Link } from "react-router-dom";
import { SortableHead, type SortColumn } from "./SortableHead";
import { formatCount, formatDuration, formatFullMoney, formatMoney } from "../lib/format";
import { itemPath, lineTotal, offerStatus, secondsLeft, type PkaOffer } from "../lib/pka";
import type { SortDir } from "../lib/sort";

type Props = {
  rows: PkaOffer[];
  sort: string;
  dir: SortDir;
  onSort: (key: string) => void;
};

const COLUMNS: SortColumn[] = [
  { key: "item", label: "Item" },
  { key: "ball", label: "Ball" },
  { key: "count", label: "Qtd", align: "right" },
  { key: "price", label: "Preço", align: "right" },
  { key: "total", label: "Total", align: "right" },
  { key: "seller", label: "Vendedor" },
  { key: "left", label: "Restante", align: "right" },
  { key: "avg30", label: "Média 30d", align: "right" },
];

export function ListingTable({ rows, sort, dir, onSort }: Props) {
  return (
    <div className="table-wrap rounded-xl border border-line bg-panel">
      <table>
        <thead>
          <SortableHead columns={COLUMNS} sort={sort} dir={dir} onSort={onSort} />
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = offerStatus(row);
            const gone = status !== "active";
            return (
            <tr key={`${row.server}:${row.itemCode}`} className={gone ? "opacity-70" : undefined}>
              <td>
                <Link to={itemPath(row.itemName)} className="font-medium hover:text-gold">
                  {row.itemName}
                </Link>
              </td>
              <td className="text-slate-300">{row.pokeballType || "—"}</td>
              <td className="num text-right">{formatCount(row.count)}</td>
              <td className="num text-right font-semibold text-gold" title={formatFullMoney(row.price)}>
                {formatMoney(row.price)}
              </td>
              <td className="num text-right text-slate-300" title={formatFullMoney(lineTotal(row))}>
                {formatMoney(lineTotal(row))}
              </td>
              <td>{row.sellerName}</td>
              <td className={gone ? "text-right text-rose-400" : "num text-right text-slate-400"}>
                {status === "removed" ? "Vendido ou removido" : status === "expired" ? "Expirado" : formatDuration(secondsLeft(row))}
              </td>
              <td className="num text-right">
                {row.count30 > 0 ? formatMoney(row.avg30) : "—"}
              </td>
            </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={8} className="py-10 text-center text-slate-500">
                Nenhum anúncio nesse filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
