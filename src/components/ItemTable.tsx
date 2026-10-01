import { Link } from "react-router-dom";
import { Sparkline } from "./Sparkline";
import { cls, formatCount, formatMoney, formatPct } from "../lib/format";
import { itemPath, type PkaItem } from "../lib/pka";

type Props = {
  rows: PkaItem[];
};

function stat(value: number | null, trades: number | null): string {
  if (value == null || trades == null || trades <= 0) return "—";
  return formatMoney(value);
}

export function ItemTable({ rows }: Props) {
  return (
    <div className="table-wrap rounded-xl border border-line bg-panel">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th className="text-right">Anúncios</th>
            <th className="text-right">Qtd</th>
            <th className="text-right">Mín</th>
            <th className="text-right">Mediana</th>
            <th className="text-right">Máx</th>
            <th className="text-right">Média 30d</th>
            <th className="text-right">Δ</th>
            <th>Preço</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <Link to={itemPath(row.name)} className="font-medium hover:text-gold">
                  {row.name}
                </Link>
                <div className="text-[11px] text-slate-500">
                  {row.kind === "pokemon" ? "Pokémon" : "Item"}
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
