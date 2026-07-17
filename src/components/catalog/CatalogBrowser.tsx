import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { CarCard } from "@/components/CarCard";
import { Flag } from "@/components/icons/Flag";
import { Button } from "@/components/ui/Button";
import { useCars } from "@/lib/carsStore";
import { statusLabels, type Car, type CarStatus } from "@/data/cars";
import { countries, type CountryCode } from "@/lib/site";

type Sort = "default" | "price-asc" | "price-desc";
type Condition = "all" | "new" | "used";

// Состояние набора фильтров. Пользователь редактирует «черновик» (draft),
// а к каталогу применяется «applied» — только после кнопки «Показать».
type Filters = {
  countryTab: CountryCode | "all";
  statusTab: CarStatus | "all";
  brands: string[];
  bodies: string[];
  fuels: string[];
  colors: string[];
  drives: string[];
  gear: string[];
  condition: Condition;
  yearFrom: number | null;
  yearTo: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  powerFrom: number | null;
  powerTo: number | null;
};

const emptyFilters = (): Filters => ({
  countryTab: "all",
  statusTab: "all",
  brands: [],
  bodies: [],
  fuels: [],
  colors: [],
  drives: [],
  gear: [],
  condition: "all",
  yearFrom: null,
  yearTo: null,
  priceFrom: null,
  priceTo: null,
  powerFrom: null,
  powerTo: null,
});

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const brandOf = (model: string) => model.trim().split(/\s+/)[0];

function matchesCar(c: Car, f: Filters, search: string): boolean {
  const price = c.priceTverRub ?? c.priceRub;
  const hp = c.powerHp ?? 0;
  if (search && !c.model.toLowerCase().includes(search.toLowerCase())) return false;
  if (f.countryTab !== "all" && c.country !== f.countryTab) return false;
  if (f.statusTab !== "all" && c.status !== f.statusTab) return false;
  if (f.brands.length && !f.brands.includes(brandOf(c.model))) return false;
  if (f.bodies.length && !(c.bodyType && f.bodies.includes(c.bodyType))) return false;
  if (f.fuels.length && !(c.fuelType && f.fuels.includes(c.fuelType))) return false;
  if (f.colors.length && !(c.color && f.colors.includes(c.color))) return false;
  if (f.drives.length && !f.drives.includes(c.drive)) return false;
  if (f.gear.length && !f.gear.includes(c.gearbox)) return false;
  if (f.condition === "new" && !c.isNew) return false;
  if (f.condition === "used" && c.isNew) return false;
  if (f.yearFrom != null && c.year < f.yearFrom) return false;
  if (f.yearTo != null && c.year > f.yearTo) return false;
  if (f.priceFrom != null && price < f.priceFrom) return false;
  if (f.priceTo != null && price > f.priceTo) return false;
  if (f.powerFrom != null && hp < f.powerFrom) return false;
  if (f.powerTo != null && hp > f.powerTo) return false;
  return true;
}

function countActive(f: Filters): number {
  return (
    (f.countryTab !== "all" ? 1 : 0) +
    (f.statusTab !== "all" ? 1 : 0) +
    f.brands.length +
    f.bodies.length +
    f.fuels.length +
    f.colors.length +
    f.drives.length +
    f.gear.length +
    (f.condition !== "all" ? 1 : 0) +
    (f.yearFrom != null || f.yearTo != null ? 1 : 0) +
    (f.priceFrom != null || f.priceTo != null ? 1 : 0) +
    (f.powerFrom != null || f.powerTo != null ? 1 : 0)
  );
}

export function CatalogBrowser() {
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
      statuses: Array.from(new Set(cars.map((c) => c.status))),
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      yearMin: cars.length ? Math.min(...cars.map((c) => c.year)) : 2010,
      yearMax: cars.length ? Math.max(...cars.map((c) => c.year)) : 2026,
      powerMin: powers.length ? Math.min(...powers) : 0,
      powerMax: powers.length ? Math.max(...powers) : 0,
    };
  }, [cars]);

  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("default");
  const [sheetOpen, setSheetOpen] = useState(false);

  const patch = (p: Partial<Filters>) => setDraft((d) => ({ ...d, ...p }));
  // Мгновенно и в черновик, и в применённые (для быстрого снятия активного фильтра).
  const commit = (p: Partial<Filters>) => {
    setDraft((d) => ({ ...d, ...p }));
    setApplied((a) => ({ ...a, ...p }));
  };
  const applyDraft = () => setApplied(draft);
  function reset() {
    setDraft(emptyFilters());
    setApplied(emptyFilters());
    setSearch("");
    setSort("default");
  }

  const result = useMemo(() => {
    let list = cars.filter((c) => matchesCar(c, applied, search));
    if (sort === "price-asc")
      list = [...list].sort(
        (a, b) => (a.priceTverRub ?? a.priceRub) - (b.priceTverRub ?? b.priceRub),
      );
    if (sort === "price-desc")
      list = [...list].sort(
        (a, b) => (b.priceTverRub ?? b.priceRub) - (a.priceTverRub ?? a.priceRub),
      );
    return list;
  }, [cars, applied, search, sort]);

  // Сколько покажет текущий черновик (для кнопки «Показать N»).
  const draftCount = useMemo(
    () => cars.filter((c) => matchesCar(c, draft, search)).length,
    [cars, draft, search],
  );

  const draftActive = countActive(draft) + (search ? 1 : 0);
  const hasPending = JSON.stringify(draft) !== JSON.stringify(applied);

  const conditionOpts = [
    ["all", "Любое"],
    ["new", "Новые"],
    ["used", "С пробегом"],
  ] as const;

  // Блок фильтров-дропдаунов (переиспользуем на десктопе и в шторке).
  const facetControls = (
    <>
      <FacetDropdown label="Страна" count={draft.countryTab !== "all" ? 1 : 0}>
        <div className="flex flex-wrap gap-2">
          <Chip active={draft.countryTab === "all"} onClick={() => patch({ countryTab: "all" })}>
            Все страны
          </Chip>
          {facets.countries.map((code) => (
            <Chip key={code} active={draft.countryTab === code} onClick={() => patch({ countryTab: code })}>
              <Flag code={code} className="h-3.5 w-5" />
              {countries[code].label}
            </Chip>
          ))}
        </div>
      </FacetDropdown>

      <FacetDropdown label="Наличие" count={draft.statusTab !== "all" ? 1 : 0}>
        <div className="flex flex-wrap gap-2">
          <Chip active={draft.statusTab === "all"} onClick={() => patch({ statusTab: "all" })}>
            Все
          </Chip>
          {facets.statuses.map((s) => (
            <Chip key={s} active={draft.statusTab === s} onClick={() => patch({ statusTab: s })}>
              {statusLabels[s]}
            </Chip>
          ))}
        </div>
      </FacetDropdown>

      <FacetDropdown label="Марка" count={draft.brands.length}>
        <Chips opts={facets.brands} sel={draft.brands} onToggle={(v) => patch({ brands: toggle(draft.brands, v) })} />
      </FacetDropdown>

      {facets.bodies.length ? (
        <FacetDropdown label="Кузов" count={draft.bodies.length}>
          <Chips opts={facets.bodies} sel={draft.bodies} onToggle={(v) => patch({ bodies: toggle(draft.bodies, v) })} />
        </FacetDropdown>
      ) : null}

      {facets.fuels.length ? (
        <FacetDropdown label="Топливо" count={draft.fuels.length}>
          <Chips opts={facets.fuels} sel={draft.fuels} onToggle={(v) => patch({ fuels: toggle(draft.fuels, v) })} />
        </FacetDropdown>
      ) : null}

      {facets.colors.length ? (
        <FacetDropdown label="Цвет" count={draft.colors.length}>
          <Chips opts={facets.colors} sel={draft.colors} onToggle={(v) => patch({ colors: toggle(draft.colors, v) })} />
        </FacetDropdown>
      ) : null}

      <FacetDropdown label="Состояние" count={draft.condition !== "all" ? 1 : 0}>
        <div className="flex flex-wrap gap-2">
          {conditionOpts.map(([v, label]) => (
            <Chip key={v} active={draft.condition === v} onClick={() => patch({ condition: v })}>
              {label}
            </Chip>
          ))}
        </div>
      </FacetDropdown>

      <FacetDropdown label="Привод" count={draft.drives.length}>
        <Chips opts={facets.drives} sel={draft.drives} onToggle={(v) => patch({ drives: toggle(draft.drives, v) })} />
      </FacetDropdown>

      <FacetDropdown label="Коробка" count={draft.gear.length}>
        <Chips opts={facets.gear} sel={draft.gear} onToggle={(v) => patch({ gear: toggle(draft.gear, v) })} />
      </FacetDropdown>

      <FacetDropdown label="Год" count={draft.yearFrom != null || draft.yearTo != null ? 1 : 0}>
        <DualRange
          min={facets.yearMin}
          max={facets.yearMax}
          step={1}
          from={draft.yearFrom}
          to={draft.yearTo}
          onChange={(from, to) => patch({ yearFrom: from, yearTo: to })}
          fmt={(n) => String(n)}
        />
      </FacetDropdown>

      <FacetDropdown label="Цена" count={draft.priceFrom != null || draft.priceTo != null ? 1 : 0}>
        <DualRange
          min={facets.min}
          max={facets.max}
          step={10000}
          from={draft.priceFrom}
          to={draft.priceTo}
          onChange={(from, to) => patch({ priceFrom: from, priceTo: to })}
          fmt={(n) => `${fmt(n)} ₽`}
        />
      </FacetDropdown>

      {facets.powerMax > facets.powerMin ? (
        <FacetDropdown label="Мощность" count={draft.powerFrom != null || draft.powerTo != null ? 1 : 0}>
          <DualRange
            min={facets.powerMin}
            max={facets.powerMax}
            step={5}
            from={draft.powerFrom}
            to={draft.powerTo}
            onChange={(from, to) => patch({ powerFrom: from, powerTo: to })}
            fmt={(n) => `${n} л.с.`}
          />
        </FacetDropdown>
      ) : null}
    </>
  );

  return (
    <>
      {/* Липкая горизонтальная панель фильтров (десктоп) — плавающая капсула */}
      <div className="pointer-events-none sticky top-[64px] z-30 hidden py-2.5 md:block">
        <div className="mx-auto w-full max-w-[1600px] px-6 [&_*]:pointer-events-auto">
          <div className="flex flex-wrap items-center gap-1.5 rounded-[28px] border-2 border-[#cfd4dc] bg-white px-3 py-2 shadow-[0_12px_30px_-18px_rgba(20,25,32,0.5)]">
            {facetControls}

            <div className="ml-auto flex items-center gap-1.5">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск…"
                  className="field-light !h-9 w-[120px] rounded-full pl-9 text-[13px]"
                />
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="field-light !h-9 appearance-none rounded-full px-3 text-[13px] font-semibold"
              >
                <option value="default">Сортировка</option>
                <option value="price-asc">Дешевле</option>
                <option value="price-desc">Дороже</option>
              </select>
              {draftActive > 0 ? (
                <button
                  type="button"
                  onClick={reset}
                  aria-label="Сбросить фильтры"
                  title="Сбросить фильтры"
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-bordeaux/30 bg-bordeaux/[0.06] text-bordeaux transition-colors hover:bg-bordeaux/10"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={applyDraft}
                disabled={!hasPending}
                className={`flex h-9 items-center rounded-full px-4 text-[13px] font-extrabold transition-colors ${
                  hasPending
                    ? "bg-bordeaux text-white hover:bg-bordeaux-bright"
                    : "cursor-default bg-graphite/90 text-white/70"
                }`}
              >
                Показать {draftCount}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Мобильная липкая панель */}
      <div className="sticky top-[62px] z-30 border-b border-line bg-paper/95 backdrop-blur md:hidden">
        <div className="mx-auto w-full max-w-[1600px] px-6 flex items-center gap-2 py-2.5">
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
            {countActive(applied) > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] text-white">
                {countActive(applied)}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="mx-auto w-full max-w-[1600px] px-6 mt-6">
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
          {applied.brands.map((b) => (
            <RemoveChip key={b} onClick={() => commit({ brands: applied.brands.filter((x) => x !== b) })}>{b}</RemoveChip>
          ))}
          {applied.bodies.map((b) => (
            <RemoveChip key={b} onClick={() => commit({ bodies: applied.bodies.filter((x) => x !== b) })}>{b}</RemoveChip>
          ))}
          {applied.fuels.map((f) => (
            <RemoveChip key={f} onClick={() => commit({ fuels: applied.fuels.filter((x) => x !== f) })}>{f}</RemoveChip>
          ))}
          {applied.colors.map((c) => (
            <RemoveChip key={c} onClick={() => commit({ colors: applied.colors.filter((x) => x !== c) })}>{c}</RemoveChip>
          ))}
          {applied.drives.map((d) => (
            <RemoveChip key={d} onClick={() => commit({ drives: applied.drives.filter((x) => x !== d) })}>{d}</RemoveChip>
          ))}
          {applied.gear.map((g) => (
            <RemoveChip key={g} onClick={() => commit({ gear: applied.gear.filter((x) => x !== g) })}>{g}</RemoveChip>
          ))}
          {applied.condition !== "all" ? (
            <RemoveChip onClick={() => commit({ condition: "all" })}>
              {applied.condition === "new" ? "Новые" : "С пробегом"}
            </RemoveChip>
          ) : null}
          {applied.countryTab !== "all" ? (
            <RemoveChip onClick={() => commit({ countryTab: "all" })}>{countries[applied.countryTab].label}</RemoveChip>
          ) : null}
          {applied.yearFrom != null || applied.yearTo != null ? (
            <RemoveChip onClick={() => commit({ yearFrom: null, yearTo: null })}>
              Год: {applied.yearFrom ?? facets.yearMin}–{applied.yearTo ?? facets.yearMax}
            </RemoveChip>
          ) : null}
          {applied.priceFrom != null || applied.priceTo != null ? (
            <RemoveChip onClick={() => commit({ priceFrom: null, priceTo: null })}>
              {fmt(applied.priceFrom ?? facets.min)}–{fmt(applied.priceTo ?? facets.max)} ₽
            </RemoveChip>
          ) : null}
          {applied.powerFrom != null || applied.powerTo != null ? (
            <RemoveChip onClick={() => commit({ powerFrom: null, powerTo: null })}>
              {applied.powerFrom ?? facets.powerMin}–{applied.powerTo ?? facets.powerMax} л.с.
            </RemoveChip>
          ) : null}
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

      {/* Мобильная шторка */}
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
                  {draftActive > 0 ? (
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
                  <Chip active={draft.countryTab === "all"} onClick={() => patch({ countryTab: "all" })}>Все</Chip>
                  {facets.countries.map((code) => (
                    <Chip key={code} active={draft.countryTab === code} onClick={() => patch({ countryTab: code })}>
                      {countries[code].label}
                    </Chip>
                  ))}
                </FilterGroup>
                <FilterGroup title="Наличие">
                  <Chip active={draft.statusTab === "all"} onClick={() => patch({ statusTab: "all" })}>Все</Chip>
                  {facets.statuses.map((s) => (
                    <Chip key={s} active={draft.statusTab === s} onClick={() => patch({ statusTab: s })}>
                      {statusLabels[s]}
                    </Chip>
                  ))}
                </FilterGroup>
                <FilterGroup title="Марка">
                  <Chips opts={facets.brands} sel={draft.brands} onToggle={(v) => patch({ brands: toggle(draft.brands, v) })} />
                </FilterGroup>
                {facets.bodies.length ? (
                  <FilterGroup title="Тип кузова">
                    <Chips opts={facets.bodies} sel={draft.bodies} onToggle={(v) => patch({ bodies: toggle(draft.bodies, v) })} />
                  </FilterGroup>
                ) : null}
                {facets.fuels.length ? (
                  <FilterGroup title="Топливо">
                    <Chips opts={facets.fuels} sel={draft.fuels} onToggle={(v) => patch({ fuels: toggle(draft.fuels, v) })} />
                  </FilterGroup>
                ) : null}
                {facets.colors.length ? (
                  <FilterGroup title="Цвет">
                    <Chips opts={facets.colors} sel={draft.colors} onToggle={(v) => patch({ colors: toggle(draft.colors, v) })} />
                  </FilterGroup>
                ) : null}
                <FilterGroup title="Состояние">
                  {conditionOpts.map(([v, label]) => (
                    <Chip key={v} active={draft.condition === v} onClick={() => patch({ condition: v })}>{label}</Chip>
                  ))}
                </FilterGroup>
                <FilterGroup title="Привод">
                  <Chips opts={facets.drives} sel={draft.drives} onToggle={(v) => patch({ drives: toggle(draft.drives, v) })} />
                </FilterGroup>
                <FilterGroup title="Коробка">
                  <Chips opts={facets.gear} sel={draft.gear} onToggle={(v) => patch({ gear: toggle(draft.gear, v) })} />
                </FilterGroup>
                <div>
                  <div className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-2">Год</div>
                  <DualRange min={facets.yearMin} max={facets.yearMax} step={1} from={draft.yearFrom} to={draft.yearTo} onChange={(from, to) => patch({ yearFrom: from, yearTo: to })} fmt={(n) => String(n)} />
                </div>
                <div>
                  <div className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-2">Цена</div>
                  <DualRange min={facets.min} max={facets.max} step={10000} from={draft.priceFrom} to={draft.priceTo} onChange={(from, to) => patch({ priceFrom: from, priceTo: to })} fmt={(n) => `${fmt(n)} ₽`} />
                </div>
                {facets.powerMax > facets.powerMin ? (
                  <div>
                    <div className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-2">Мощность</div>
                    <DualRange min={facets.powerMin} max={facets.powerMax} step={5} from={draft.powerFrom} to={draft.powerTo} onChange={(from, to) => patch({ powerFrom: from, powerTo: to })} fmt={(n) => `${n} л.с.`} />
                  </div>
                ) : null}
              </div>

              <Button
                variant="primary"
                onClick={() => {
                  applyDraft();
                  setSheetOpen(false);
                }}
                className="mt-6 w-full"
              >
                Показать {draftCount}
              </Button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/* ---------- Мелкие части ---------- */

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
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-200 ${
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
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[280px] rounded-card border border-line bg-white p-3.5 shadow-[0_18px_44px_-16px_rgba(20,25,32,0.5)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// Диапазон «от/до» на двух ползунках. null = граница не задана (весь диапазон).
function DualRange({
  min,
  max,
  step,
  from,
  to,
  onChange,
  fmt: fmtVal,
}: {
  min: number;
  max: number;
  step: number;
  from: number | null;
  to: number | null;
  onChange: (from: number | null, to: number | null) => void;
  fmt: (n: number) => string;
}) {
  const lo = from ?? min;
  const hi = to ?? max;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-bold text-ink">
        <span>от {fmtVal(lo)}</span>
        <span>до {fmtVal(hi)}</span>
      </div>
      <div className="space-y-1.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi);
            onChange(v <= min ? null : v, to);
          }}
          className="w-full accent-bordeaux"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo);
            onChange(from, v >= max ? null : v);
          }}
          className="w-full accent-bordeaux"
        />
      </div>
      <div className="mt-1 flex justify-between font-num text-[12px] text-ink-2">
        <span>{fmtVal(min)}</span>
        <span>{fmtVal(max)}</span>
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
