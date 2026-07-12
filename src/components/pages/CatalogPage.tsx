import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, ChevronRight, ChevronDown } from "lucide-react";
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
    const powers = cars.map((c) => c.powerHp ?? 0).filter(Boolean);
    return {
      countries: Array.from(new Set(cars.map((c) => c.country))),
      brands: Array.from(new Set(cars.map((c) => brandOf(c.model)))).sort(),
      bodies: Array.from(new Set(cars.map((c) => c.bodyType).filter(Boolean) as string[])).sort(),
      fuels: Array.from(new Set(cars.map((c) => c.fuelType).filter(Boolean) as string[])).sort(),
      colors: Array.from(new Set(cars.map((c) => c.color).filter(Boolean) as string[])).sort(),
      drives: Array.from(new Set(cars.map((c) => c.drive))),
      gear: Array.from(new Set(cars.map((c) => c.gearbox))),
      years: Array.from(new Set(cars.map((c) => c.year))).sort((a, b) => b - a),
      statuses: Array.from(new Set(cars.map((c) => c.status))),
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      powerMin: powers.length ? Math.min(...powers) : 0,
      powerMax: powers.length ? Math.max(...powers) : 0,
    };
  }, [cars]);

  const [search, setSearch] = useState("");
  const [countryTab, setCountryTab] = useState<CountryCode | "all">("all");
  const [statusTab, setStatusTab] = useState<CarStatus | "all">("all");
  const [brands, setBrands] = useState<string[]>([]);
  const [bodies, setBodies] = useState<string[]>([]);
  const [fuels, setFuels] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [gear, setGear] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [condition, setCondition] = useState<Condition>("all");
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [powerMin, setPowerMin] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("default");
  const [sheetOpen, setSheetOpen] = useState(false);

  const cap = priceMax ?? facets.max;
  const powCap = powerMin ?? facets.powerMin;

  const result = useMemo(() => {
    let list = cars.filter((c) => {
      const price = c.priceTverRub ?? c.priceRub;
      if (search && !c.model.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (countryTab !== "all" && c.country !== countryTab) return false;
      if (statusTab !== "all" && c.status !== statusTab) return false;
      if (brands.length && !brands.includes(brandOf(c.model))) return false;
      if (bodies.length && !(c.bodyType && bodies.includes(c.bodyType))) return false;
      if (fuels.length && !(c.fuelType && fuels.includes(c.fuelType))) return false;
      if (colors.length && !(c.color && colors.includes(c.color))) return false;
      if (drives.length && !drives.includes(c.drive)) return false;
      if (gear.length && !gear.includes(c.gearbox)) return false;
      if (years.length && !years.includes(c.year)) return false;
      if (condition === "new" && !c.isNew) return false;
      if (condition === "used" && c.isNew) return false;
      if (price > cap) return false;
      if (powCap && (c.powerHp ?? 0) < powCap) return false;
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
  }, [cars, search, countryTab, statusTab, brands, bodies, fuels, colors, drives, gear, years, condition, cap, powCap, sort]);

  const activeCount =
    brands.length +
    bodies.length +
    fuels.length +
    colors.length +
    drives.length +
    gear.length +
    years.length +
    (condition !== "all" ? 1 : 0) +
    (priceMax !== null ? 1 : 0) +
    (powerMin !== null ? 1 : 0) +
    (statusTab !== "all" ? 1 : 0) +
    (countryTab !== "all" ? 1 : 0) +
    (search ? 1 : 0);

  function reset() {
    setSearch("");
    setCountryTab("all");
    setStatusTab("all");
    setBrands([]);
    setBodies([]);
    setFuels([]);
    setColors([]);
    setDrives([]);
    setGear([]);
    setYears([]);
    setCondition("all");
    setPriceMax(null);
    setPowerMin(null);
    setSort("default");
  }

  // Общий набор групп фильтров — рендерим и в дропдаунах (десктоп), и в шторке (моб.)
  const conditionOpts = [
    ["all", "Любое"],
    ["new", "Новые"],
    ["used", "С пробегом"],
  ] as const;

  return (
    <main className="bg-paper pb-[96px]">
      {/* Компактная шапка */}
      <section className="grain relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-5 pt-[96px] text-white">
        <div className="wrap relative">
          <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">Наличие</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <div className="mb-1.5 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-chrome">
                <span className="slash" aria-hidden /> Каталог под ключ
              </div>
              <h1 className="text-[clamp(26px,3.2vw,40px)] leading-[1.02] text-shine">
                Авто в наличии
              </h1>
            </div>
            <p className="max-w-md text-[13.5px] leading-snug text-[#AEB7BE]">
              Цена уже под ключ в РФ — доставка, растаможка, утильсбор и ЭПТС.
              Подберите по параметрам и откройте карточку с фото.
            </p>
          </div>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      {/* Липкая горизонтальная панель фильтров (десктоп) */}
      <div className="sticky top-[64px] z-30 hidden border-b border-line bg-paper/95 shadow-[0_6px_20px_-12px_rgba(0,0,0,0.3)] backdrop-blur md:block">
        <div className="wrap flex flex-wrap items-center gap-2 py-3">
          {/* Страна */}
          <Seg active={countryTab === "all"} onClick={() => setCountryTab("all")}>
            Все страны
          </Seg>
          {facets.countries.map((code) => (
            <Seg
              key={code}
              active={countryTab === code}
              onClick={() =>
                setCountryTab((v) => (v === code ? "all" : code))
              }
            >
              <Flag code={code} className="h-3.5 w-5" />
              {countries[code].label}
            </Seg>
          ))}

          <Divider />

          {/* В наличии */}
          {facets.statuses.map((s) => (
            <Seg
              key={s}
              active={statusTab === s}
              onClick={() => setStatusTab((v) => (v === s ? "all" : s))}
            >
              {statusLabels[s]}
            </Seg>
          ))}

          <Divider />

          {/* Дропдауны характеристик */}
          <FacetDropdown label="Марка" count={brands.length}>
            <Chips opts={facets.brands} sel={brands} onToggle={(v) => setBrands((p) => toggle(p, v))} />
          </FacetDropdown>

          {facets.bodies.length ? (
            <FacetDropdown label="Кузов" count={bodies.length}>
              <Chips opts={facets.bodies} sel={bodies} onToggle={(v) => setBodies((p) => toggle(p, v))} />
            </FacetDropdown>
          ) : null}

          {facets.fuels.length ? (
            <FacetDropdown label="Топливо" count={fuels.length}>
              <Chips opts={facets.fuels} sel={fuels} onToggle={(v) => setFuels((p) => toggle(p, v))} />
            </FacetDropdown>
          ) : null}

          {facets.colors.length ? (
            <FacetDropdown label="Цвет" count={colors.length}>
              <Chips opts={facets.colors} sel={colors} onToggle={(v) => setColors((p) => toggle(p, v))} />
            </FacetDropdown>
          ) : null}

          <FacetDropdown label="Состояние" count={condition !== "all" ? 1 : 0}>
            <div className="flex flex-wrap gap-2">
              {conditionOpts.map(([v, label]) => (
                <Chip key={v} active={condition === v} onClick={() => setCondition(v)}>
                  {label}
                </Chip>
              ))}
            </div>
          </FacetDropdown>

          <FacetDropdown label="Привод" count={drives.length}>
            <Chips opts={facets.drives} sel={drives} onToggle={(v) => setDrives((p) => toggle(p, v))} />
          </FacetDropdown>

          <FacetDropdown label="Коробка" count={gear.length}>
            <Chips opts={facets.gear} sel={gear} onToggle={(v) => setGear((p) => toggle(p, v))} />
          </FacetDropdown>

          <FacetDropdown label="Год" count={years.length}>
            <div className="flex flex-wrap gap-2">
              {facets.years.map((y) => (
                <Chip key={y} active={years.includes(y)} onClick={() => setYears((p) => toggle(p, y))}>
                  {y}
                </Chip>
              ))}
            </div>
          </FacetDropdown>

          <FacetDropdown label="Цена" count={priceMax !== null ? 1 : 0}>
            <RangeControl
              title={`До ${fmt(cap)} ₽`}
              min={facets.min}
              max={facets.max}
              step={10000}
              value={cap}
              onChange={setPriceMax}
              fmtMin={`${fmt(facets.min)} ₽`}
              fmtMax={`${fmt(facets.max)} ₽`}
            />
          </FacetDropdown>

          {facets.powerMax > facets.powerMin ? (
            <FacetDropdown label="Мощность" count={powerMin !== null ? 1 : 0}>
              <RangeControl
                title={`От ${powCap} л.с.`}
                min={facets.powerMin}
                max={facets.powerMax}
                step={5}
                value={powCap}
                onChange={setPowerMin}
                fmtMin={`${facets.powerMin} л.с.`}
                fmtMax={`${facets.powerMax} л.с.`}
              />
            </FacetDropdown>
          ) : null}

          {/* Поиск + сортировка + сброс — справа */}
          <div className="ml-auto flex items-center gap-2">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск…"
                className="field-light !h-10 w-[150px] pl-9 text-[14px] focus:w-[200px]"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="field-light !h-10 appearance-none px-3 text-[14px] font-semibold"
            >
              <option value="default">Сортировка</option>
              <option value="price-asc">Дешевле</option>
              <option value="price-desc">Дороже</option>
            </select>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="flex h-10 items-center gap-1.5 rounded-[11px] border border-bordeaux/25 bg-bordeaux/[0.06] px-3 text-[13px] font-bold text-bordeaux transition-colors hover:bg-bordeaux/10"
              >
                Сбросить <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Мобильная липкая панель */}
      <div className="sticky top-[62px] z-30 border-b border-line bg-paper/95 backdrop-blur md:hidden">
        <div className="wrap flex items-center gap-2 py-2.5">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по модели…"
              className="field-light !h-11 w-full pl-9 text-[14px]"
            />
          </label>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="relative flex h-11 items-center gap-2 rounded-[11px] border border-line bg-white px-4 font-bold text-ink"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
            {activeCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="wrap mt-6">
        {/* Счётчик + активные фильтры */}
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
            <RemoveChip key={b} onClick={() => setBrands((p) => toggle(p, b))}>{b}</RemoveChip>
          ))}
          {bodies.map((b) => (
            <RemoveChip key={b} onClick={() => setBodies((p) => toggle(p, b))}>{b}</RemoveChip>
          ))}
          {fuels.map((f) => (
            <RemoveChip key={f} onClick={() => setFuels((p) => toggle(p, f))}>{f}</RemoveChip>
          ))}
          {colors.map((c) => (
            <RemoveChip key={c} onClick={() => setColors((p) => toggle(p, c))}>{c}</RemoveChip>
          ))}
          {condition !== "all" ? (
            <RemoveChip onClick={() => setCondition("all")}>
              {condition === "new" ? "Новые" : "С пробегом"}
            </RemoveChip>
          ) : null}
          {drives.map((d) => (
            <RemoveChip key={d} onClick={() => setDrives((p) => toggle(p, d))}>{d}</RemoveChip>
          ))}
          {gear.map((g) => (
            <RemoveChip key={g} onClick={() => setGear((p) => toggle(p, g))}>{g}</RemoveChip>
          ))}
          {years.map((y) => (
            <RemoveChip key={y} onClick={() => setYears((p) => toggle(p, y))}>{y}</RemoveChip>
          ))}
        </div>

        {result.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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

      {/* Мобильная шторка с фильтрами */}
      <AnimatePresence>
        {sheetOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-[22px] border-t border-line bg-white p-5 md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-[18px] uppercase text-ink">Фильтры</span>
                <div className="flex items-center gap-3">
                  {activeCount > 0 ? (
                    <button type="button" onClick={reset} className="text-[13px] font-bold text-bordeaux">
                      Сбросить
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-2"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <FilterGroup title="Страна">
                  <Chip active={countryTab === "all"} onClick={() => setCountryTab("all")}>Все</Chip>
                  {facets.countries.map((code) => (
                    <Chip key={code} active={countryTab === code} onClick={() => setCountryTab(code)}>
                      {countries[code].label}
                    </Chip>
                  ))}
                </FilterGroup>
                <FilterGroup title="Наличие">
                  <Chip active={statusTab === "all"} onClick={() => setStatusTab("all")}>Все</Chip>
                  {facets.statuses.map((s) => (
                    <Chip key={s} active={statusTab === s} onClick={() => setStatusTab(s)}>
                      {statusLabels[s]}
                    </Chip>
                  ))}
                </FilterGroup>
                <FilterGroup title="Марка">
                  <Chips opts={facets.brands} sel={brands} onToggle={(v) => setBrands((p) => toggle(p, v))} />
                </FilterGroup>
                {facets.bodies.length ? (
                  <FilterGroup title="Тип кузова">
                    <Chips opts={facets.bodies} sel={bodies} onToggle={(v) => setBodies((p) => toggle(p, v))} />
                  </FilterGroup>
                ) : null}
                {facets.fuels.length ? (
                  <FilterGroup title="Топливо">
                    <Chips opts={facets.fuels} sel={fuels} onToggle={(v) => setFuels((p) => toggle(p, v))} />
                  </FilterGroup>
                ) : null}
                {facets.colors.length ? (
                  <FilterGroup title="Цвет">
                    <Chips opts={facets.colors} sel={colors} onToggle={(v) => setColors((p) => toggle(p, v))} />
                  </FilterGroup>
                ) : null}
                <FilterGroup title="Состояние">
                  {conditionOpts.map(([v, label]) => (
                    <Chip key={v} active={condition === v} onClick={() => setCondition(v)}>{label}</Chip>
                  ))}
                </FilterGroup>
                <FilterGroup title="Привод">
                  <Chips opts={facets.drives} sel={drives} onToggle={(v) => setDrives((p) => toggle(p, v))} />
                </FilterGroup>
                <FilterGroup title="Коробка">
                  <Chips opts={facets.gear} sel={gear} onToggle={(v) => setGear((p) => toggle(p, v))} />
                </FilterGroup>
                <FilterGroup title="Год">
                  {facets.years.map((y) => (
                    <Chip key={y} active={years.includes(y)} onClick={() => setYears((p) => toggle(p, y))}>{y}</Chip>
                  ))}
                </FilterGroup>
                <RangeControl
                  title={`Цена до ${fmt(cap)} ₽`}
                  min={facets.min}
                  max={facets.max}
                  step={10000}
                  value={cap}
                  onChange={setPriceMax}
                  fmtMin={`${fmt(facets.min)} ₽`}
                  fmtMax={`${fmt(facets.max)} ₽`}
                />
                {facets.powerMax > facets.powerMin ? (
                  <RangeControl
                    title={`Мощность от ${powCap} л.с.`}
                    min={facets.powerMin}
                    max={facets.powerMax}
                    step={5}
                    value={powCap}
                    onChange={setPowerMin}
                    fmtMin={`${facets.powerMin} л.с.`}
                    fmtMax={`${facets.powerMax} л.с.`}
                  />
                ) : null}
              </div>

              <Button
                variant="primary"
                onClick={() => setSheetOpen(false)}
                className="mt-6 w-full"
              >
                Показать {result.length}
              </Button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

/* ---------- Мелкие части ---------- */

function Divider() {
  return <span className="mx-1 hidden h-6 w-px bg-line lg:block" aria-hidden />;
}

function Seg({
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
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors duration-200 ${
        active
          ? "border-bordeaux-bright bg-bordeaux text-white"
          : "border-line bg-white text-ink-2 hover:border-steel hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// Кнопка-дропдаун с поповером; закрывается по клику вне.
function FacetDropdown({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors duration-200 ${
          count > 0
            ? "border-graphite bg-graphite text-white"
            : open
              ? "border-steel bg-white text-ink"
              : "border-line bg-white text-ink-2 hover:border-steel hover:text-ink"
        }`}
      >
        {label}
        {count > 0 ? (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] text-white">
            {count}
          </span>
        ) : null}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[264px] rounded-card border border-line bg-white p-3.5 shadow-[0_18px_44px_-16px_rgba(20,25,32,0.5)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function RangeControl({
  title,
  min,
  max,
  step,
  value,
  onChange,
  fmtMin,
  fmtMax,
}: {
  title: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  fmtMin: string;
  fmtMax: string;
}) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-ink-2">
        {title}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-bordeaux"
      />
      <div className="mt-1 flex justify-between font-num text-[12px] text-ink-2">
        <span>{fmtMin}</span>
        <span>{fmtMax}</span>
      </div>
    </div>
  );
}

function Chips({
  opts,
  sel,
  onToggle,
}: {
  opts: string[];
  sel: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <Chip key={o} active={sel.includes(o)} onClick={() => onToggle(o)}>
          {o}
        </Chip>
      ))}
    </div>
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
