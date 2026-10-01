import type { HeldFilter, HeldOption } from "../lib/pokemon";
import { sameHeldName } from "../lib/pokemon";

type Props = {
  options: HeldOption[];
  value: HeldFilter[];
  onChange: (next: HeldFilter[]) => void;
};

export function HeldFilterBar({ options, value, onChange }: Props) {
  if (!options.length) return null;

  function selected(name: string): HeldFilter | undefined {
    return value.find((filter) => sameHeldName(filter.name, name));
  }

  function toggleHeld(option: HeldOption) {
    const current = selected(option.name);
    if (current) {
      onChange(value.filter((filter) => !sameHeldName(filter.name, option.name)));
      return;
    }
    onChange([...value, { name: option.name, minTier: null, maxTier: null }]);
  }

  function patchHeld(name: string, next: Partial<HeldFilter>) {
    onChange(
      value.map((filter) =>
        sameHeldName(filter.name, name) ? { ...filter, ...next } : filter,
      ),
    );
  }

  function setExactTier(name: string, tier: number) {
    const current = selected(name);
    if (!current) {
      onChange([...value, { name, minTier: tier, maxTier: tier }]);
      return;
    }
    if (current.minTier === tier && current.maxTier === tier) {
      patchHeld(name, { minTier: null, maxTier: null });
      return;
    }
    patchHeld(name, { minTier: tier, maxTier: tier });
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        Held (todos os selecionados)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = Boolean(selected(option.name));
          return (
            <button
              key={option.name}
              type="button"
              onClick={() => toggleHeld(option)}
              className={
                active
                  ? "rounded-full border border-gold/60 bg-gold/15 px-2.5 py-1 text-[12px] text-gold"
                  : "rounded-full border border-line px-2.5 py-1 text-[12px] text-slate-300 hover:border-gold/40"
              }
            >
              {option.name}
            </button>
          );
        })}
      </div>
      {options
        .filter((option) => selected(option.name) && option.tiers.length > 0)
        .map((option) => {
          const filter = selected(option.name)!;
          return (
            <div key={option.name} className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span className="w-28 truncate text-[12px] text-slate-400">{option.name}</span>
              <label className="flex items-center gap-1.5 text-[12px]">
                mín
                <input
                  type="number"
                  min={0}
                  value={filter.minTier ?? ""}
                  onChange={(e) => patchHeld(option.name, { minTier: parseTierInput(e.target.value) })}
                  className="w-16 rounded-lg border border-line bg-panel-2 px-2 py-1 text-sm outline-none focus:border-gold/70"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[12px]">
                máx
                <input
                  type="number"
                  min={0}
                  value={filter.maxTier ?? ""}
                  onChange={(e) => patchHeld(option.name, { maxTier: parseTierInput(e.target.value) })}
                  className="w-16 rounded-lg border border-line bg-panel-2 px-2 py-1 text-sm outline-none focus:border-gold/70"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {option.tiers.map((tier) => {
                  const active = filter.minTier === tier && filter.maxTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setExactTier(option.name, tier)}
                      className={
                        active
                          ? "rounded-full border border-gold/60 bg-gold/15 px-2 py-0.5 text-[11px] text-gold"
                          : "rounded-full border border-line px-2 py-0.5 text-[11px] text-slate-400 hover:border-gold/40"
                      }
                    >
                      T{tier}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function parseTierInput(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
