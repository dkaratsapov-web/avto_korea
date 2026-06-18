import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, ChevronRight } from "lucide-react";
import { CarCard } from "@/components/CarCard";
import { Flag } from "@/components/icons/Flag";
import { Button } from "@/components/ui/Button";
import { useCars } from "@/lib/carsStore";
import { statusLabels, type CarStatus } from "@/data/cars";
import { countries, type CountryCode } from "@/lib/site";

type Sort = "default" | "price-asc" | "price-desc";
type Condition = "all" | "new" | "used";

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const brandOf = (model: string) => model.trim().split(/\s+/)[0];

export function CatalogPage() {
  const { cars } = useCars();

  const facets = useMemo(() => {
    const prices = cars.map((c) => c.priceTverRub ?? c.priceRub);
    return {
      countries: Array.from(new Set(cars.map((c) => c.country))),
      brands: Array.from(new Set(cars.map((c) => brandOf(c.model)))).sort(),
      drives: Array.from(new Set(cars.map((c) => c.drive))),
      gear: Array.from(new Set(cars.map((c) => c.gearbox))),
      years: Array.from(new Set(cars.map((c) => c.year))).sort((a, b) => b - a),
      statuses: Array.from(new Set(cars.map((c) => c.status))),
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [cars]);

  const [search, setSearch] = useState("");
  const [countryTab, setCountryTab] = useState<CountryCode | "all">("all");
  const [statusTab, setStatusTab] = useState<CarStatus | "all">("all");
  const [brands, setBrands] = useState<string[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [gear, setGear] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [condition, setCondition] = useState<Condition>("all");
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("default");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const cap = priceMax ?? facets.max;

  const result = useMemo(() => {
    let list = cars.filter((c) => {
      const price = c.priceTverRub ?? c.priceRub;
      if (search && !c.model.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (countryTab !== "all" && c.country !== countryTab) return false;
      if (statusTab !== "all" && c.status !== statusTab) return false;
      if (brands.length && !brands.includes(brandOf(c.model))) return false;
      if (drives.length && !drives.includes(c.drive)) return false;
      if (gear.length && !gear.includes(c.gearbox)) return false;
      if (years.length && !years.includes(c.year)) return false;
      if (condition === "new" && !c.isNew) return false;
      if (condition === "used" && c.isNew) return false;
      if (price > cap) return false;
      return true;
    });
    if (sort === "price-asc")
      list = [...list].sort(
        (a, b) => (a.priceTverRub ?? a.priceRub) - (b.priceTverRub ?? b.priceRub),
      );
    if (sort === "price-desc")
      list = [...list].sort(
        (a, b) => (b.priceTverRub ?? b.priceRub) - (a.priceTverRub ?? a.priceRub),
      );
    return list;
  }, [cars, search, countryTab, statusTab, brands, drives, gear, years, condition, cap, sort]);

  const activeCount =
    brands.length +
    drives.length +
    gear.length +
    years.length +
    (condition !== "all" ? 1 : 0) +
    (priceMax !== null ? 1 : 0) +
    (search ? 1 : 0);

  function reset() {
    setSearch("");
    setCountryTab("all");
    setStatusTab("all");
    setBrands([]);
    setDrives([]);
    setGear([]);
    setYears([]);
    setCondition("all");
    setPriceMax(null);
    setSort("default");
  }

  return (
    <main className="bg-paper pb-[96px]">
      {/* Премиальная шапка */}
      <section className="grain relative overflow-hidden bg-[radial-gradient(900px_420px_at_80%_-10%,#27313d,#11151A_60%)] pb-12 pt-[120px] text-white">
        <div className="glow-blob right-[10%] top-0 hidden h-72 w-72 animate-glow-pan bg-bordeaux/25 md:block" aria-hidden />
        <div className="wrap relative">
          <nav className="mb-5 flex items-center gap-1.5 text-[13px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">Наличие</span>
          </nav>
          <div className="mb-3 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <span className="slash" aria-hidden /> Каталог под ключ
          </div>
          <h1 className="text-[clamp(34px,5.4vw,64px)] text-shine">
            Авто в наличии
          </h1>
          <p className="mt-3 max-w-xl text-[16px] text-[#C7CFD6]">
            Цена уже под ключ в РФ — с доставкой, растаможкой, утильсбором и ЭПТС.
            Подберите по параметрам и откройте карточку с фото.
          </p>

          {/* Табы по стране */}
          <div className="mt-7 flex flex-wrap gap-2">
            <Tab active={countryTab === "all"} onClick={() => setCountryTab("all")}>
              Все страны
            </Tab>
            {facets.countries.map((code) => (
              <Tab
                key={code}
                active={countryTab === code}
                onClick={() => setCountryTab(code)}
              >
                <Flag code={code} className="h-3.5 w-5" />
                {countries[code].label}
              </Tab>
            ))}
          </div>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      <div className="wrap mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Фильтры */}
        <aside className={filtersOpen ? "block" : "hidden lg:block"}>
          <div className="space-y-6 rounded-card border border-line bg-white p-5 lg:sticky lg:top-[100px]">
            <div className="flex items-center justify-between">
              <span className="font-display text-[18px] uppercase text-ink">
                Фильтры
              </span>
              {activeCount > 0 ? (
                <button
                  type="button"
                  onClick={reset}
                  className="text-[13px] font-bold text-bordeaux hover:underline"
                >
                  Сбросить
                </button>
              ) : null}
            </div>

            <FilterGroup title="Марка">
              {facets.brands.map((b) => (
                <Chip
                  key={b}
                  active={brands.includes(b)}
                  onClick={() => setBrands((p) => toggle(p, b))}
                >
                  {b}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup title="Состояние">
              {(
                [
                  ["all", "Любое"],
                  ["new", "Новые"],
                  ["used", "С пробегом"],
                ] as const
              ).map(([v, label]) => (
                <Chip
                  key={v}
                  active={condition === v}
                  onClick={() => setCondition(v)}
                >
                  {label}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup title="Привод">
              {facets.drives.map((d) => (
                <Chip
                  key={d}
                  active={drives.includes(d)}
                  onClick={() => setDrives((p) => toggle(p, d))}
                >
                  {d}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup title="Коробка">
              {facets.gear.map((g) => (
                <Chip
                  key={g}
                  active={gear.includes(g)}
                  onClick={() => setGear((p) => toggle(p, g))}
                >
                  {g}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup title="Год">
              {facets.years.map((y) => (
                <Chip
                  key={y}
                  active={years.includes(y)}
                  onClick={() => setYears((p) => toggle(p, y))}
                >
                  {y}
                </Chip>
              ))}
            </FilterGroup>

            <div>
              <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                Цена до <span className="font-num text-bordeaux">{fmt(cap)} ₽</span>
              </div>
              <input
                type="range"
                min={facets.min}
                max={facets.max}
                step={10000}
                value={cap}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                className="w-full accent-bordeaux"
              />
              <div className="mt-1 flex justify-between font-num text-[12px] text-ink-2">
                <span>{fmt(facets.min)} ₽</span>
                <span>{fmt(facets.max)} ₽</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Контент */}
        <div>
          {/* Табы по статусу */}
          <div className="mb-5 flex flex-wrap gap-2">
            <StatusTab active={statusTab === "all"} onClick={() => setStatusTab("all")}>
              Все
            </StatusTab>
            {facets.statuses.map((s) => (
              <StatusTab
                key={s}
                active={statusTab === s}
                onClick={() => setStatusTab(s)}
              >
                {statusLabels[s]}
              </StatusTab>
            ))}
          </div>

          {/* Тулбар */}
          <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="relative">
              <Search className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по модели…"
                className="field-light !h-12 pl-11"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="field-light !h-12 appearance-none px-4 font-semibold sm:w-[210px]"
            >
              <option value="default">Сортировка</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
            </select>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="relative flex h-12 items-center justify-center gap-2 rounded-[11px] border border-line bg-white px-5 font-bold text-ink transition-colors hover:border-steel lg:hidden"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" /> Фильтры
              {activeCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Активные фильтры + счётчик */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-ink-2">
              Найдено:{" "}
              <motion.span
                key={result.length}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-block font-num text-ink"
              >
                {result.length}
              </motion.span>
            </span>
            {brands.map((b) => (
              <RemoveChip key={b} onClick={() => setBrands((p) => toggle(p, b))}>
                {b}
              </RemoveChip>
            ))}
            {condition !== "all" ? (
              <RemoveChip onClick={() => setCondition("all")}>
                {condition === "new" ? "Новые" : "С пробегом"}
              </RemoveChip>
            ) : null}
            {drives.map((d) => (
              <RemoveChip key={d} onClick={() => setDrives((p) => toggle(p, d))}>
                {d}
              </RemoveChip>
            ))}
            {gear.map((g) => (
              <RemoveChip key={g} onClick={() => setGear((p) => toggle(p, g))}>
                {g}
              </RemoveChip>
            ))}
            {years.map((y) => (
              <RemoveChip key={y} onClick={() => setYears((p) => toggle(p, y))}>
                {y}
              </RemoveChip>
            ))}
          </div>

          {result.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {result.map((car) => (
                  <motion.div
                    key={car.id}
                    layout
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <CarCard car={car} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
              <p className="text-[18px] font-bold text-ink">Ничего не найдено</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-2">
                Попробуйте сбросить часть фильтров или оставьте заявку — подберём
                под ваш запрос.
              </p>
              <Button variant="ghost-light" onClick={reset} className="mt-5">
                Сбросить фильтры
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] font-bold transition-all duration-200 ${
        active
          ? "border-bordeaux-bright bg-bordeaux text-white shadow-[0_8px_24px_-8px_rgba(154,26,18,0.7)]"
          : "border-white/15 bg-white/5 text-[#C7CFD6] hover:border-white/30 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function StatusTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[11px] border px-4 py-2.5 text-[13.5px] font-bold transition-all duration-200 ${
        active
          ? "border-graphite bg-graphite text-white"
          : "border-line bg-white text-ink-2 hover:border-steel hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-bold transition-all duration-200 ${
        active
          ? "border-graphite bg-graphite text-white shadow-sm"
          : "border-line bg-paper text-ink-2 hover:border-steel hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function RemoveChip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-bordeaux/25 bg-bordeaux/[0.06] px-3 py-1.5 text-[13px] font-bold text-bordeaux transition-colors hover:bg-bordeaux/10"
    >
      {children}
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
