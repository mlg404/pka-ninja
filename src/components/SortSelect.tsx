import type { SortChoice, SortDir } from "../lib/sort";

type Props = {
  sort: string;
  dir: SortDir;
  options: SortChoice[];
  onChange: (sort: string, dir: SortDir) => void;
};

export function SortSelect({ sort, dir, options, onChange }: Props) {
  const value = `${sort}:${dir}`;
  const known = options.some((option) => `${option.sort}:${option.dir}` === value);
  return (
    <select
      value={known ? value : `${options[0]?.sort ?? sort}:${options[0]?.dir ?? dir}`}
      onChange={(event) => {
        const [nextSort, nextDir] = event.target.value.split(":");
        onChange(nextSort, nextDir === "asc" ? "asc" : "desc");
      }}
      className="rounded-lg border border-line bg-panel px-3 py-2 text-sm"
    >
      {options.map((option) => (
        <option key={`${option.sort}:${option.dir}`} value={`${option.sort}:${option.dir}`}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
