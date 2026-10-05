import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cls, formatCount, formatFullMoney, formatIso, formatMoney } from "../lib/format";
import {
  BOOST_ELEMENTS,
  BOOST_TIERS,
  dropMarketName,
  findDayRecipe,
  findPoolDrop,
  finishedStoneName,
  parseDayCatalog,
  type BoostElement,
  type DayCatalog,
  type PoolDrop,
} from "../lib/boost";
import { listDataFiles } from "../lib/dataFiles";
import { useMarket } from "../lib/market";
import { fold, itemPath, type PkaItem } from "../lib/pka";

type PriceDrafts = Record<string, string>;

function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : null;
}

const QTY_KEYS = ["fragment", "drop-0", "drop-1", "drop-2", "stone"] as const;

export function BoostPage() {
  const { items, loading, error } = useMarket();
  const [catalog, setCatalog] = useState<DayCatalog | null>(null);
  const [catalogNote, setCatalogNote] = useState<string | null>(null);
  const [elementId, setElementId] = useState(BOOST_ELEMENTS[0].id);
  const [tierId, setTierId] = useState(BOOST_TIERS[0].id);
  const [slotNames, setSlotNames] = useState<string[]>(() => initialSlots(BOOST_ELEMENTS[0]));
  const [qty, setQty] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<PriceDrafts>({});
  const [params] = useSearchParams();
  const [makeRaw, setMakeRaw] = useState(() => {
    const initial = parseCount(params.get("qtd") ?? "");
    return initial ? String(initial) : "1";
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const files = await listDataFiles("pka_boost-");
        const latest = files[files.length - 1];
        if (!latest) throw new Error("missing");
        const res = await fetch(`/data/${encodeURIComponent(latest)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("missing");
        const parsed = parseDayCatalog(await res.json());
        if (!parsed) throw new Error("invalid");
        if (!cancelled) setCatalog(parsed);
      } catch {
        if (!cancelled) setCatalogNote("Sem capture de boost. As quantidades ficam em branco até você colocar um pka_boost-*.json.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const element = BOOST_ELEMENTS.find((entry) => entry.id === elementId) ?? BOOST_ELEMENTS[0];
  const tier = BOOST_TIERS.find((entry) => entry.id === tierId) ?? BOOST_TIERS[0];
  const productName = finishedStoneName(element, tier);

  const byName = useMemo(() => {
    const map = new Map<string, PkaItem>();
    for (const item of items) map.set(fold(item.name), item);
    return map;
  }, [items]);

  function marketOf(name: string): PkaItem | undefined {
    return byName.get(fold(name));
  }

  const recipe = catalog ? findDayRecipe(catalog, element, tier) : undefined;
  const recipeKey = recipe ? `${recipe.category}:${recipe.name}:${recipe.ingredients.map((item) => item.count).join(",")}` : "";

  useEffect(() => {
    if (!recipe) return;
    setSlotNames(recipe.ingredients.map((item) => item.name));
    setQty(
      Object.fromEntries(recipe.ingredients.map((item, index) => [QTY_KEYS[index], String(item.count)])),
    );
    setPrices({});
  }, [recipeKey]);

  function selectElement(next: BoostElement) {
    setElementId(next.id);
  }

  function selectTier(id: string) {
    setTierId(id);
  }

  function setDropName(slot: number, name: string) {
    setSlotNames((current) => {
      const next = [...current];
      next[slot + 1] = name;
      return next;
    });
    setPrices((current) => {
      const next = { ...current };
      delete next[`drop-${slot}`];
      return next;
    });
  }

  const drops = [0, 1, 2].map((index) => findPoolDrop(element, slotNames[index + 1] ?? ""));

  const lines = [
    slot("fragment", "Fragmento", slotNames[0] || element.fragment, null),
    ...[0, 1, 2].map((index) =>
      slot(`drop-${index}`, `Item ${index + 1}`, slotNames[index + 1] || "", drops[index] ?? null),
    ),
    slot("stone", "Pedra", slotNames[4] || element.stone, null),
  ];

  function slot(key: string, role: string, marketName: string, drop: PoolDrop | null) {
    const listed = marketOf(marketName);
    const draft = prices[key];
    const unit = draft != null ? parseAmount(draft) : listed && listed.min > 0 ? listed.min : null;
    const qtyRaw = qty[key] ?? "";
    const quantity = parseAmount(qtyRaw);
    const cost = unit != null && quantity != null ? unit * quantity : null;
    return { key, role, marketName, drop, listed, draft, unit, quantity, qtyRaw, cost };
  }

  const product = marketOf(productName);
  const productDraft = prices.product;
  const productUnit =
    productDraft != null ? parseAmount(productDraft) : product && product.min > 0 ? product.min : null;
  const craft = lines.every((line) => line.cost != null) ? lines.reduce((sum, line) => sum + (line.cost ?? 0), 0) : null;
  const make = parseCount(makeRaw);
  const needs = materialNeeds(lines, make);
  const missingQty = lines.some((line) => line.quantity == null);
  const missingPrice = lines.some((line) => line.unit == null) || productUnit == null;

  let verdict: { tone: "mint" | "rose" | "gold"; title: string; detail: string } | null = null;
  if (craft != null && productUnit != null) {
    const delta = productUnit - craft;
    if (delta > 0) {
      verdict = {
        tone: "mint",
        title: "Craftar sai mais barato",
        detail: `Economia de ${formatFullMoney(delta)} em relação ao anúncio mais barato (${pct(delta, productUnit)}).`,
      };
    } else if (delta < 0) {
      verdict = {
        tone: "rose",
        title: "Comprar a pedra pronta sai mais barato",
        detail: `O craft custa ${formatFullMoney(-delta)} a mais (${pct(-delta, productUnit)}).`,
      };
    } else {
      verdict = {
        tone: "gold",
        title: "O custo é o mesmo",
        detail: "Craftar e comprar a pedra pronta dão o mesmo valor com esses preços.",
      };
    }
  }

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando…</p>;
  if (error) return <p className="py-16 text-center text-rose-400">{error}</p>;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Craft</p>
        <h1 className="text-3xl font-bold">Boost calculator</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Itens e quantidades vêm do capture mais recente
          {catalog?.capturedAt ? ` (${formatIso(catalog.capturedAt)})` : ""}. Os dias anteriores ficam salvos. Preços
          vêm do market e podem ser editados.
        </p>
        {catalogNote && <p className="mt-2 text-sm text-gold">{catalogNote}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Elemento</h2>
        <div className="flex flex-wrap gap-2">
          {BOOST_ELEMENTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectElement(entry)}
              className={cls(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                entry.id === element.id
                  ? "border-gold bg-gold text-ink"
                  : "border-line bg-panel text-slate-200 hover:border-gold/50",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pedra de boost</h2>
        <div className="flex flex-wrap gap-2">
          {BOOST_TIERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectTier(entry.id)}
              className={cls(
                "rounded-lg border px-3 py-2 text-left transition",
                entry.id === tier.id
                  ? "border-gold bg-panel-2"
                  : "border-line bg-panel hover:border-gold/50",
              )}
            >
              <span className={cls("block text-sm font-semibold", entry.id === tier.id ? "text-gold" : "text-slate-100")}>
                {entry.name}
              </span>
              <span className="block text-[11px] text-slate-500">
                boost {entry.from}–{entry.to}
              </span>
            </button>
          ))}
        </div>
      </section>

      {element.pool.length < 3 && (
        <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">
          A pool de {element.label.toLowerCase()} tem {element.pool.length} itens. O mesmo item pode ocupar mais de um
          slot, e cada slot tem a própria quantidade.
        </p>
      )}

      <section className="grid gap-3 md:grid-cols-5">
        <IngredientCard
          line={lines[0]}
          onQty={(value) => setQty((current) => ({ ...current, fragment: value }))}
          onPrice={(value) => setPrices((current) => ({ ...current, fragment: value }))}
          onResetPrice={() =>
            setPrices((current) => {
              const next = { ...current };
              delete next.fragment;
              return next;
            })
          }
        />
        {[0, 1, 2].map((index) => (
          <IngredientCard
            key={`drop-${index}`}
            line={lines[index + 1]}
            options={dropChoices(element, slotNames[index + 1] || "")}
            selected={slotNames[index + 1] || ""}
            onSelect={(value) => setDropName(index, value)}
            onQty={(value) => setQty((current) => ({ ...current, [`drop-${index}`]: value }))}
            onPrice={(value) => setPrices((current) => ({ ...current, [`drop-${index}`]: value }))}
            onResetPrice={() =>
              setPrices((current) => {
                const next = { ...current };
                delete next[`drop-${index}`];
                return next;
              })
            }
          />
        ))}
        <IngredientCard
          line={lines[4]}
          onQty={(value) => setQty((current) => ({ ...current, stone: value }))}
          onPrice={(value) => setPrices((current) => ({ ...current, stone: value }))}
          onResetPrice={() =>
            setPrices((current) => {
              const next = { ...current };
              delete next.stone;
              return next;
            })
          }
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Pedra pronta</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {product ? (
              <Link to={itemPath(product.name)} className="text-lg font-semibold hover:text-gold">
                {product.name}
              </Link>
            ) : (
              <span className="text-lg font-semibold">{productName}</span>
            )}
            <span className="text-xs text-slate-500">
              {element.label} · boost {tier.from}–{tier.to}
            </span>
          </div>
          <label className="mt-3 block text-xs text-slate-400">
            Preço unitário no market
            <input
              inputMode="decimal"
              value={productDraft ?? (product && product.min > 0 ? String(product.min) : "")}
              placeholder="sem anúncio"
              onChange={(event) => setPrices((current) => ({ ...current, product: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/70"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            {product
              ? `${product.listings} anúncios · mais barato ${formatMoney(product.min)} · mediana ${formatMoney(product.median)}`
              : "Essa pedra não apareceu na capture. Digite o preço."}
            {productDraft != null && product && (
              <button
                type="button"
                className="ml-2 text-gold hover:underline"
                onClick={() =>
                  setPrices((current) => {
                    const next = { ...current };
                    delete next.product;
                    return next;
                  })
                }
              >
                usar o market
              </button>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Craftar</p>
              <p className="mt-1 text-2xl font-semibold">{craft == null ? "—" : formatMoney(craft)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Comprar</p>
              <p className="mt-1 text-2xl font-semibold">{productUnit == null ? "—" : formatMoney(productUnit)}</p>
            </div>
          </div>
          {verdict ? (
            <p
              className={cls(
                "mt-4 rounded-lg px-3 py-2 text-sm",
                verdict.tone === "mint" && "bg-mint/10 text-mint",
                verdict.tone === "rose" && "bg-rose/10 text-rose",
                verdict.tone === "gold" && "bg-gold/10 text-gold",
              )}
            >
              <span className="font-semibold">{verdict.title}. </span>
              {verdict.detail}
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              {missingQty
                ? "Informe a quantidade de cada um dos 5 materiais."
                : missingPrice
                  ? "Falta o preço de algum material ou da pedra pronta."
                  : "Preencha os campos para comparar."}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Lista de compra</p>
            <h2 className="text-lg font-semibold">Quantos quer fazer</h2>
          </div>
          <label className="text-xs text-slate-400">
            Quantidade de {productName}
            <input
              inputMode="numeric"
              value={makeRaw}
              onChange={(event) => setMakeRaw(event.target.value)}
              className="mt-1 w-28 rounded-lg border border-line bg-ink px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/70"
            />
          </label>
        </div>
        <div className="table-wrap mt-4">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Por pedra</th>
                <th className="text-right">Total</th>
                <th className="text-right">Preço un.</th>
                <th className="text-right">Gasto</th>
              </tr>
            </thead>
            <tbody>
              {needs.map((need) => (
                <tr key={need.name}>
                  <td className="font-medium">{need.name}</td>
                  <td className="num text-right">{formatCount(need.per)}</td>
                  <td className="num text-right">{make == null ? "—" : formatCount(need.total)}</td>
                  <td className="num text-right text-slate-300">{need.unit == null ? "—" : formatMoney(need.unit)}</td>
                  <td className="num text-right font-semibold text-gold">
                    {need.cost == null ? "—" : formatFullMoney(need.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Pedras</p>
            <p className="mt-1 text-xl font-semibold">{make == null ? "—" : formatCount(make)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Gasto craftando</p>
            <p className="mt-1 text-xl font-semibold">
              {make != null && craft != null ? formatFullMoney(craft * make) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Se comprar prontas</p>
            <p className="mt-1 text-xl font-semibold">
              {make != null && productUnit != null ? formatFullMoney(productUnit * make) : "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function parseCount(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return value > 0 ? value : null;
}

function materialNeeds(lines: Line[], make: number | null): Need[] {
  const groups = new Map<string, Need>();
  for (const line of lines) {
    const key = fold(line.marketName);
    const per = line.quantity ?? 0;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        name: line.listed?.name || line.marketName,
        per,
        total: make == null ? 0 : per * make,
        unit: line.unit,
        cost: line.cost == null || make == null ? null : line.cost * make,
      });
      continue;
    }
    existing.per += per;
    existing.total = make == null ? 0 : existing.per * make;
    if (existing.unit !== line.unit) existing.unit = null;
    if (existing.cost == null || line.cost == null || make == null) existing.cost = null;
    else existing.cost += line.cost * make;
  }
  return [...groups.values()];
}

type Need = {
  name: string;
  per: number;
  total: number;
  unit: number | null;
  cost: number | null;
};

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

type Line = {
  key: string;
  role: string;
  marketName: string;
  drop: PoolDrop | null;
  listed: PkaItem | undefined;
  draft: string | undefined;
  unit: number | null;
  quantity: number | null;
  qtyRaw: string;
  cost: number | null;
};

function IngredientCard({
  line,
  options,
  selected,
  onSelect,
  onQty,
  onPrice,
  onResetPrice,
}: {
  line: Line;
  options?: { value: string; label: string }[];
  selected?: string;
  onSelect?: (name: string) => void;
  onQty: (value: string) => void;
  onPrice: (value: string) => void;
  onResetPrice: () => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-panel p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{line.role}</p>
      {options && onSelect && selected != null ? (
        <select
          value={selected}
          onChange={(event) => onSelect(event.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-ink px-2 py-2 text-sm text-slate-100 outline-none focus:border-gold/70"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : line.listed ? (
        <Link to={itemPath(line.listed.name)} className="mt-2 text-sm font-semibold leading-snug hover:text-gold">
          {line.listed.name}
        </Link>
      ) : (
        <p className="mt-2 text-sm font-semibold leading-snug">{line.marketName}</p>
      )}
      {line.drop && (
        <p className="mt-1 text-[11px] text-slate-500">Dropa de {line.drop.pokemon}</p>
      )}
      <label className="mt-3 block text-[11px] text-slate-400">
        Quantidade
        <input
          inputMode="decimal"
          value={line.qtyRaw}
          placeholder="qtd do dia"
          onChange={(event) => onQty(event.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-ink px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-gold/70"
        />
      </label>
      <label className="mt-2 block text-[11px] text-slate-400">
        Preço unitário
        <input
          inputMode="decimal"
          value={line.draft ?? (line.listed && line.listed.min > 0 ? String(line.listed.min) : "")}
          placeholder="sem anúncio"
          onChange={(event) => onPrice(event.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-ink px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-gold/70"
        />
      </label>
      <p className="mt-2 text-[11px] text-slate-500">
        {line.listed
          ? `mín ${formatMoney(line.listed.min)} · med ${formatMoney(line.listed.median)}`
          : "sem anúncio nessa capture"}
        {line.draft != null && line.listed && (
          <button type="button" className="ml-1 text-gold hover:underline" onClick={onResetPrice}>
            market
          </button>
        )}
      </p>
      <p className="mt-auto pt-3 text-sm font-semibold">
        {line.cost == null ? "—" : formatFullMoney(line.cost)}
      </p>
    </article>
  );
}

function initialSlots(element: BoostElement): string[] {
  const drops = element.pool.slice(0, 3);
  while (drops.length < 3) drops.push(element.pool[0]);
  return [element.fragment, ...drops.map(dropMarketName), element.stone];
}

function dropChoices(element: BoostElement, current: string): { value: string; label: string }[] {
  const options = element.pool.map((drop) => ({
    value: dropMarketName(drop),
    label: `${drop.name} — ${drop.pokemon}`,
  }));
  if (current && !options.some((option) => fold(option.value) === fold(current))) {
    options.unshift({ value: current, label: current });
  }
  const match = options.find((option) => fold(option.value) === fold(current));
  if (match && match.value !== current) {
    return options.map((option) => (option === match ? { ...option, value: current } : option));
  }
  return options;
}
