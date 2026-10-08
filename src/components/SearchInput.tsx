import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchInput({ value, onChange, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const pending = useRef<string | null>(null);
  const caret = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (pending.current != null) {
      if (value === pending.current) pending.current = null;
      return;
    }
    setDraft(value);
  }, [value]);

  useLayoutEffect(restoreCaret);
  useEffect(restoreCaret);

  function restoreCaret() {
    const node = inputRef.current;
    const range = caret.current;
    if (!node || !range || document.activeElement !== node) return;
    const atEnd = node.selectionStart === node.value.length && node.selectionEnd === node.value.length;
    const wantedEnd = range.start === node.value.length && range.end === node.value.length;
    if (atEnd && !wantedEnd) node.setSelectionRange(range.start, range.end);
  }

  return (
    <label className="relative block min-w-[220px] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          const native = event.nativeEvent;
          if (!("isComposing" in native) || !native.isComposing) {
            caret.current = {
              start: event.target.selectionStart ?? next.length,
              end: event.target.selectionEnd ?? next.length,
            };
          }
          pending.current = next;
          setDraft(next);
          onChange(next);
        }}
        onBlur={() => {
          caret.current = null;
        }}
        placeholder={placeholder ?? "Buscar…"}
        className="w-full rounded-lg border border-line bg-panel py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-gold/70"
      />
    </label>
  );
}
