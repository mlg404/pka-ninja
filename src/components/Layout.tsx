import { NavLink, Outlet } from "react-router-dom";
import { cls, formatCount, formatIso } from "../lib/format";
import { useMarket } from "../lib/market";
import { isOnMarket } from "../lib/pka";

const LINKS = [
  { to: "/", label: "Economia", end: true },
  { to: "/items", label: "Itens" },
  { to: "/oportunidades", label: "Oportunidades" },
  { to: "/listings", label: "Listagens" },
  { to: "/pokemon", label: "Pokémon" },
  { to: "/boost", label: "Boost" },
  { to: "/stash", label: "Stash" },
];

export function Layout() {
  const { capturedAt, snapshots, offers, loading, servers, server, setServer } = useMarket();
  const live = offers.reduce((sum, offer) => sum + (isOnMarket(offer) ? 1 : 0), 0);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold text-ink font-bold">
              忍
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold tracking-wide">PKA NINJA</span>
              <span className="block text-[11px] text-slate-400">PokeAlliance market</span>
            </span>
          </NavLink>
          <nav className="flex flex-1 items-center gap-1">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cls(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition",
                    isActive ? "bg-panel-2 text-gold" : "text-slate-300 hover:bg-panel hover:text-white",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <select
            value={server}
            onChange={(event) => setServer(event.target.value)}
            aria-label="Servidor"
            className="shrink-0 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm"
          >
            <option value="">Todos servidores</option>
            {servers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <div className="hidden text-right text-xs text-slate-400 sm:block">
            {loading && "carregando…"}
            {capturedAt && (
              <>
                <div>{formatCount(live)} no market</div>
                <div>
                  {snapshots.length > 1 ? `${snapshots.length} captures · ` : ""}
                  {formatIso(capturedAt)}
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line/70 px-4 py-4 text-center text-xs text-slate-500">
        PKA Ninja — {snapshots.length > 1 ? `${snapshots.length} captures, último` : "capture"}
        {capturedAt ? `: ${formatIso(capturedAt)}` : ""}
      </footer>
    </div>
  );
}
