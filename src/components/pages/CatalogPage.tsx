import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { CarCard } from "@/components/CarCard";
import { Flag } from "@/components/icons/Flag";
import { Button } from "@/components/ui/Button";
import { cars } from "@/data/cars";
import { countries, type CountryCode } from "@/lib/site";

const allCountries = Array.from(new Set(cars.map((c) => c.country)));
const allDrives = Array.from(new Set(cars.map((c) => c.drive)));
const allGear = Array.from(new Set(cars.map((c) => c.gearbox)));
const allYears = Array.from(new Set(cars.map((c) => c.year))).sort((a, b) => b - a);
const prices = cars.map((c) => c.priceTverRub ?? c.priceRub);
const MIN_P = Math.min(...prices);
const MAX_P = Math.max(...prices);

type Sort = "default" | "price-asc" | "price-desc";

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

export function CatalogPage() {
  const [search, setSearch] = useState("");
  const [cc, setCc] = useState<CountryCode[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [gear, setGear] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [priceMax, setPriceMax] = useState(MAX_P);
  const [sort, setSort] = useState<Sort>("default");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const result = useMemo(() => {
    let list = cars.filter((c) => {
      const price = c.priceTverRub ?? c.priceRub;
      if (search && !c.model.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (cc.length && !cc.includes(c.country)) return false;
      if (drives.length && !drives.includes(c.drive)) return false;
      if (gear.length && !gear.includes(c.gearbox)) return false;
      if (years.length && !years.includes(c.year)) return false;
      if (price > priceMax) return false;
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
  }, [search, cc, drives, gear, years, priceMax, sort]);

  const hasActive =
    cc.length > 0 ||
    drives.length > 0 ||
    gear.length > 0 ||
    years.length > 0 ||
    priceMax < MAX_P ||
    search !== "";

  function reset() {
    setSearch("");
    setCc([]);
    setDrives([]);
    setGear([]);
    setYears([]);
    setPriceMax(MAX_P);
    setSort("default");
  }

  return (
    <main className="min-h-screen bg-paper pb-[88px] pt-[120px]">
      <div className="wrap">
        <div className="mb-3 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-bordeaux">
          <span className="slash" aria-hidden /> Каталог · наличие
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-[clamp(32px,5vw,56px)] text-ink">Авто в наличии</h1>
          <div className="text-[15px] font-semibold text-ink-2">
            Найдено: <span className="font-num text-ink">{result.length}</span>
          </div>
        </div>

        {/* Панель управления */}
        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
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
            className="field-light !h-12 appearance-none px-4 font-semibold sm:w-[220px]"
          >
            <option value="default">Сортировка: по умолчанию</option>
            <option value="price-asc">Сначала дешевле</option>
            <option value="price-desc">Сначала дороже</option>
          </select>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex h-12 items-center justify-center gap-2 rounded-[11px] border border-line bg-white px-5 font-bold text-ink transition-colors hover:border-steel lg:hidden"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" /> Фильтры
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Фильтры */}
          <aside
            className={`${filtersOpen ? "block" : "hidden"} lg:block`}
          >
            <div className="space-y-6 rounded-card border border-line bg-white p-5 lg:sticky lg:top-[100px]">
              <FilterGroup title="Страна">
                {allCountries.map((code) => (
                  <Chip
                    key={code}
                    active={cc.includes(code)}
                    onClick={() => setCc((p) => toggle(p, code))}
                  >
                    <Flag code={code} className="h-3.5 w-5" />
                    {countries[code].label}
                  </Chip>
                ))}
              </FilterGroup>

              <FilterGroup title="Привод">
                {allDrives.map((d) => (
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
                {allGear.map((g) => (
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
                {allYears.map((y) => (
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
                  Цена до{" "}
                  <span className="font-num text-bordeaux">{fmt(priceMax)} ₽</span>
                </div>
                <input
                  type="range"
                  min={MIN_P}
                  max={MAX_P}
                  step={10000}
                  value={priceMax}
                  onChange={(e) => setPriceMax(Number(e.target.value))}
                  className="w-full accent-bordeaux"
                />
                <div className="mt-1 flex justify-between font-num text-[12px] text-ink-2">
                  <span>{fmt(MIN_P)} ₽</span>
                  <span>{fmt(MAX_P)} ₽</span>
                </div>
              </div>

              {hasActive ? (
                <button
                  type="button"
                  onClick={reset}
                  className="flex w-full items-center justify-center gap-2 rounded-[11px] border border-line py-2.5 text-[14px] font-bold text-ink-2 transition-colors hover:border-bordeaux hover:text-bordeaux"
                >
                  <X className="h-4 w-4" /> Сбросить фильтры
                </button>
              ) : null}
            </div>
          </aside>

          {/* Сетка */}
          <div>
            {result.length > 0 ? (
              <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-3">
                {result.map((car) => (
                  <CarCard key={car.id} car={car} />
                ))}
              </div>
            ) : (
              <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
                <p className="text-[16px] font-semibold text-ink">
                  Ничего не найдено
                </p>
                <p className="mt-2 text-[14px] text-ink-2">
                  Сбросьте часть фильтров или оставьте заявку — подберём под ваш
                  запрос.
                </p>
                <Button variant="ghost-light" onClick={reset} className="mt-5">
                  Сбросить фильтры
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
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
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-bold transition-colors ${
        active
          ? "border-graphite bg-graphite text-white"
          : "border-line bg-paper text-ink-2 hover:border-steel hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
