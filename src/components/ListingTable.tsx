import { Link } from "react-router-dom";
import { formatCount, formatDuration, formatFullMoney, formatMoney } from "../lib/format";
import { itemPath, lineTotal, offerStatus, secondsLeft, type PkaOffer } from "../lib/pka";

type Props = {
  rows: PkaOffer[];
};

export function ListingTable({ rows }: Props) {
  return (
    <div className="table-wrap rounded-xl border border-line bg-panel">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Ball</th>
            <th className="text-right">Qtd</th>
            <th className="text-right">Preço</th>
            <th className="text-right">Total</th>
            <th>Vendedor</th>
            <th className="text-right">Restante</th>
            <th className="text-right">Média 30d</th>
          </tr>
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
