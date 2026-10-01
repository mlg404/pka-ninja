import type { ReactNode } from "react";
import { cls } from "../lib/format";

type Props = {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
};

export function Pagination({ page, pages, total, onPage }: Props) {
  if (pages <= 1) {
    return <p className="text-xs text-slate-500">{total} resultados</p>;
  }

  const window = pageWindow(page, pages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <p className="text-xs text-slate-400">
        Página {page} de {pages} · {total.toLocaleString("en-US")} resultados
      </p>
      <div className="flex items-center gap-1">
        <PageBtn disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </PageBtn>
        {window.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-slate-500">
              …
            </span>
          ) : (
            <PageBtn key={n} active={n === page} onClick={() => onPage(n)}>
              {n}
            </PageBtn>
          ),
        )}
        <PageBtn disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Próxima
        </PageBtn>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cls(
        "min-w-8 rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40",
        active ? "bg-gold text-ink" : "bg-panel-2 text-slate-200 hover:bg-line",
      )}
    >
      {children}
    </button>
  );
}

function pageWindow(page: number, pages: number): Array<number | "…"> {
  if (pages <= 9) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (const n of nums) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && n - prev > 1) out.push("…");
    out.push(n);
  }
  return out;
}
