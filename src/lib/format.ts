const BRL_LIKE = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function trimZeros(n: number): string {
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${trimZeros(abs / 1_000_000_000)}KKK`;
  if (abs >= 1_000_000) return `${sign}${trimZeros(abs / 1_000_000)}KK`;
  if (abs >= 1_000) return `${sign}${trimZeros(abs / 1_000)}k`;
  return `${sign}${BRL_LIKE.format(abs)}`;
}

export function formatMoney(value: number | null | undefined, offer = false): string {
  if (value == null || (value === 0 && offer)) return "Offer";
  if (value === 0) return "$0";
  return `$${formatCompact(value)}`;
}

export function formatFullMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 60) return `${Math.round(seconds)}s`;
  if (abs < 3600) return `${Math.round(seconds / 60)}m`;
  if (abs < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export function timeAgo(unixSeconds: number, now = Date.now()): string {
  const delta = Math.round(now / 1000 - unixSeconds);
  if (delta < 60) return "agora";
  if (delta < 3600) return `${Math.round(delta / 60)} min atrás`;
  if (delta < 86400) return `${Math.round(delta / 3600)} h atrás`;
  return `${Math.round(delta / 86400)} d atrás`;
}

export function cls(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
