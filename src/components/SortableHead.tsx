import type { SortDir } from "../lib/sort";

export type SortColumn = {
  key: string;
  label: string;
  align?: "right";
  sortable?: boolean;
};

type Props = {
  columns: SortColumn[];
  sort: string;
  dir: SortDir;
  onSort?: (key: string) => void;
};

export function SortableHead({ columns, sort, dir, onSort }: Props) {
  return (
    <tr>
      {columns.map((col) => {
        const active = sort === col.key;
        const clickable = onSort != null && col.sortable !== false;
        return (
          <th
            key={col.key}
            className={col.align === "right" ? "text-right" : undefined}
            aria-sort={clickable && active ? (dir === "asc" ? "ascending" : "descending") : undefined}
          >
            {clickable ? (
              <button
                type="button"
                className={col.align === "right" ? "sort-btn is-right" : "sort-btn"}
                onClick={() => onSort(col.key)}
              >
                <span>{col.label}</span>
                {active && (
                  <span className="sort-arrow" aria-hidden="true">
                    {dir === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            ) : (
              col.label
            )}
          </th>
        );
      })}
    </tr>
  );
}
