import { PKA_CATEGORIES, type PkaCategory } from "../lib/pka";
import { cls } from "../lib/format";

type Props = {
  value: PkaCategory;
  onChange: (id: PkaCategory) => void;
  counts?: Partial<Record<PkaCategory, number>>;
};

export function CategoryTabs({ value, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PKA_CATEGORIES.map((cat) => {
        const count = counts?.[cat.id];
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={cls(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              value === cat.id
                ? "border-gold bg-gold/15 text-gold"
                : "border-line bg-panel text-slate-300 hover:border-slate-500",
            )}
          >
            {cat.label}
            {count != null && <span className="ml-1.5 text-slate-500">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
