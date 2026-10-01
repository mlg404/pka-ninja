import type { ExpiredFilter } from "../lib/pka";

type Props = {
  value: ExpiredFilter;
  onChange: (value: ExpiredFilter) => void;
};

export function ExpiredFilterSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ExpiredFilter)}
      className="rounded-lg border border-line bg-panel px-3 py-2 text-sm"
    >
      <option value="all">Todos (ativos, expirados e removidos)</option>
      <option value="active">Só o market atual</option>
      <option value="expired">Fora do market</option>
    </select>
  );
}
