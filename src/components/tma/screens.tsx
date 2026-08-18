import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Check,
  SlidersHorizontal,
  X,
  Car as CarIcon,
  Bell,
  Scale,
  Star,
  HelpCircle,
  Send,
  Loader2,
  Maximize2,
  ClipboardList,
} from "lucide-react";
import { Flag } from "@/components/icons/Flag";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { useCars } from "@/lib/carsStore";
import { countries, site, type CountryCode } from "@/lib/site";
import { type Car, formatPrice } from "@/data/cars";
import { showToast } from "@/lib/toast";
import {
  subscribe as apiSubscribe,
  fetchReviews,
  fetchFaq,
  fetchRates,
  type Review,
  type Faq,
} from "@/lib/api";
function mtoggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

// Маска российского номера: +7 (XXX) XXX-XX-XX
function maskRuPhone(v: string) {
  let d = v.replace(/\D/g, "");
  if (d[0] === "8") d = "7" + d.slice(1);
  else if (d[0] === "9") d = "7" + d;
  else if (d && d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11);
  const r = d.slice(1);
  if (!r) return d ? "+7" : "";
  let out = "+7 (" + r.slice(0, 3);
  if (r.length >= 3) out += ")";
  if (r.length > 3) out += " " + r.slice(3, 6);
  if (r.length >= 6) out += "-" + r.slice(6, 8);
  if (r.length >= 8) out += "-" + r.slice(8, 10);
  return out;
}

export function ListView({
  cars,
  isFav,
  onToggleFav,
  onOpen,
}: {
  cars: Car[];
  isFav: (id: string) => boolean;
  onToggleFav: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | CountryCode>("all");
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [bodies, setBodies] = useState<string[]>([]);
  const [fuels, setFuels] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [gear, setGear] = useState<string[]>([]);
  const [condition, setCondition] = useState<"all" | "new" | "used">("all");
  const [priceFrom, setPriceFrom] = useState<number | null>(null);
  const [priceTo, setPriceTo] = useState<number | null>(null);
  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);
  const [powerFrom, setPowerFrom] = useState<number | null>(null);
  const [powerTo, setPowerTo] = useState<number | null>(null);

  const facets = useMemo(() => {
    const prices = cars.map((c) => c.priceTverRub ?? c.priceRub);
    const powers = cars.map((c) => c.powerHp ?? 0).filter(Boolean);
    return {
      brands: Array.from(new Set(cars.map((c) => c.model.trim().split(/\s+/)[0]))).sort(),
      bodies: Array.from(new Set(cars.map((c) => c.bodyType).filter(Boolean) as string[])).sort(),
      fuels: Array.from(new Set(cars.map((c) => c.fuelType).filter(Boolean) as string[])).sort(),
      colors: Array.from(new Set(cars.map((c) => c.color).filter(Boolean) as string[])).sort(),
      drives: Array.from(new Set(cars.map((c) => c.drive))),
      gear: Array.from(new Set(cars.map((c) => c.gearbox))),
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      yearMin: cars.length ? Math.min(...cars.map((c) => c.year)) : 2010,
      yearMax: cars.length ? Math.max(...cars.map((c) => c.year)) : 2026,
      powerMin: powers.length ? Math.min(...powers) : 0,
      powerMax: powers.length ? Math.max(...powers) : 0,
    };
  }, [cars]);

  const countryTabs = useMemo(() => {
    const present = Array.from(new Set(cars.map((c) => c.country)));
    return [
      { value: "all" as const, label: "Все" },
      ...present.map((code) => ({ value: code, label: countries[code].label })),
    ];
  }, [cars]);

  const activeCount =
    brands.length + bodies.length + fuels.length + colors.length + drives.length +
    gear.length + (condition !== "all" ? 1 : 0) +
    (priceFrom != null || priceTo != null ? 1 : 0) +
    (yearFrom != null || yearTo != null ? 1 : 0) +
    (powerFrom != null || powerTo != null ? 1 : 0);

  const list = cars.filter((c) => {
    const price = c.priceTverRub ?? c.priceRub;
    const hp = c.powerHp ?? 0;
    if (filter !== "all" && c.country !== filter) return false;
    if (!c.model.toLowerCase().includes(q.toLowerCase())) return false;
    if (brands.length && !brands.includes(c.model.trim().split(/\s+/)[0])) return false;
    if (bodies.length && !(c.bodyType && bodies.includes(c.bodyType))) return false;
    if (fuels.length && !(c.fuelType && fuels.includes(c.fuelType))) return false;
    if (colors.length && !(c.color && colors.includes(c.color))) return false;
    if (drives.length && !drives.includes(c.drive)) return false;
    if (gear.length && !gear.includes(c.gearbox)) return false;
    if (condition === "new" && !c.isNew) return false;
    if (condition === "used" && c.isNew) return false;
    if (priceFrom != null && price < priceFrom) return false;
    if (priceTo != null && price > priceTo) return false;
    if (yearFrom != null && c.year < yearFrom) return false;
    if (yearTo != null && c.year > yearTo) return false;
    if (powerFrom != null && hp < powerFrom) return false;
    if (powerTo != null && hp > powerTo) return false;
    return true;
  });

  function resetFilters() {
    setBrands([]);
    setBodies([]);
    setFuels([]);
    setColors([]);
    setDrives([]);
    setGear([]);
    setCondition("all");
    setPriceFrom(null);
    setPriceTo(null);
    setYearFrom(null);
    setYearTo(null);
    setPowerFrom(null);
    setPowerTo(null);
  }

  const pill = (active: boolean) =>
    `flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
      active ? "border-bordeaux-bright bg-bordeaux text-white" : "border-line-dark text-chrome"
    }`;

  return (
    <>
      {/* Поиск + табы — фиксируются под шапкой */}
      <div className="sticky top-[64px] z-30 -mx-4 mb-3 border-b border-line-dark/60 bg-graphite px-4 pb-2.5 pt-2">
        <div className="mb-2.5 flex gap-2">
          <label className="relative block flex-1">
            <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8C97A1]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по модели…"
              className="field-dark pl-10"
            />
          </label>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`relative flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[12px] border ${
              open || activeCount
                ? "border-bordeaux-bright bg-bordeaux/15 text-bordeaux-bright"
                : "border-line-dark text-chrome"
            }`}
            aria-label="Фильтры"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {activeCount ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] font-bold text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {countryTabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${
                filter === t.value
                  ? "border-bordeaux-bright bg-bordeaux text-white"
                  : "border-line-dark text-chrome"
              }`}
            >
              {t.value !== "all" ? <Flag code={t.value} className="h-3 w-4" /> : null}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {open ? (
        <div className="mb-4 space-y-3 rounded-[16px] border border-line-dark bg-graphite-2 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-extrabold uppercase">Фильтры</span>
            {activeCount ? (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-[12.5px] font-bold text-bordeaux-bright"
              >
                <X className="h-3.5 w-3.5" /> Сбросить
              </button>
            ) : null}
          </div>

          <FilterRow label="Состояние">
            {([["all", "Любое"], ["new", "Новые"], ["used", "С пробегом"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setCondition(v)} className={pill(condition === v)}>{l}</button>
            ))}
          </FilterRow>

          {facets.bodies.length ? (
            <FilterRow label="Кузов">
              {facets.bodies.map((b) => (
                <button key={b} onClick={() => setBodies((p) => mtoggle(p, b))} className={pill(bodies.includes(b))}>
                  {b}
                </button>
              ))}
            </FilterRow>
          ) : null}

          {facets.fuels.length ? (
            <FilterRow label="Топливо">
              {facets.fuels.map((f) => (
                <button key={f} onClick={() => setFuels((p) => mtoggle(p, f))} className={pill(fuels.includes(f))}>
                  {f}
                </button>
              ))}
            </FilterRow>
          ) : null}

          {facets.colors.length ? (
            <FilterRow label="Цвет">
              {facets.colors.map((c) => (
                <button key={c} onClick={() => setColors((p) => mtoggle(p, c))} className={pill(colors.includes(c))}>
                  {c}
                </button>
              ))}
            </FilterRow>
          ) : null}

          <FilterRow label="Привод">
            {facets.drives.map((d) => (
              <button key={d} onClick={() => setDrives((p) => mtoggle(p, d))} className={pill(drives.includes(d))}>
                {d}
              </button>
            ))}
          </FilterRow>

          <FilterRow label="Коробка">
            {facets.gear.map((g) => (
              <button key={g} onClick={() => setGear((p) => mtoggle(p, g))} className={pill(gear.includes(g))}>
                {g}
              </button>
            ))}
          </FilterRow>

          <FilterRow label="Марка">
            {facets.brands.map((b) => (
              <button key={b} onClick={() => setBrands((p) => mtoggle(p, b))} className={pill(brands.includes(b))}>
                {b}
              </button>
            ))}
          </FilterRow>

          <MiniRange label="Год" min={facets.yearMin} max={facets.yearMax} step={1}
            from={yearFrom} to={yearTo} onFrom={setYearFrom} onTo={setYearTo} fmt={(n) => String(n)} />
          <MiniRange label="Цена" min={facets.min} max={facets.max} step={10000}
            from={priceFrom} to={priceTo} onFrom={setPriceFrom} onTo={setPriceTo} fmt={(n) => `${formatPrice(n)} ₽`} />
          {facets.powerMax > facets.powerMin ? (
            <MiniRange label="Мощность" min={facets.powerMin} max={facets.powerMax} step={5}
              from={powerFrom} to={powerTo} onFrom={setPowerFrom} onTo={setPowerTo} fmt={(n) => `${n} л.с.`} />
          ) : null}
        </div>
      ) : null}

      <div className="mb-2 text-[13px] font-semibold text-[#9AA4B2]">
        Найдено: <span className="font-num text-white">{list.length}</span>
      </div>

      <div className="space-y-4">
        {list.map((car) => (
          <div
            key={car.id}
            className="overflow-hidden rounded-[18px] border border-line-dark bg-graphite-2"
          >
            <button
              type="button"
              onClick={() => onOpen(car.id)}
              className="relative block aspect-[16/10] w-full bg-black"
            >
              {/* eslint-disable-next-line */}
              <img
                src={car.images[0]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold text-white">
                {car.images.length} фото
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFav(car.id);
                }}
                className={`absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full ${
                  isFav(car.id) ? "bg-bordeaux text-white" : "bg-black/45 text-white"
                }`}
              >
                <Heart className={`h-[18px] w-[18px] ${isFav(car.id) ? "fill-white" : ""}`} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpen(car.id)}
              className="block w-full p-3.5 text-left"
            >
              <div className="flex items-center gap-1.5">
                <Flag code={car.country} className="h-3 w-4" />
                <span className="truncate font-bold">{car.model}</span>
              </div>
              <div className="text-[12.5px] text-[#9AA4B2]">
                {car.year} · {car.engine}
                {car.bodyType ? ` · ${car.bodyType}` : ""}
              </div>
              <div className="mt-0.5 font-num text-[19px] font-extrabold text-bordeaux-bright">
                {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
              </div>
            </button>
          </div>
        ))}
        {list.length === 0 ? (
          <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
            Ничего не найдено
          </p>
        ) : null}
      </div>
    </>
  );
}

/* ---------- Полноэкранный просмотр фото ---------- */
function Lightbox({
  images,
  start = 0,
  onClose,
}: {
  images: string[];
  start?: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(start);
  const startX = useRef(0);
  const prev = () => setI((x) => (x - 1 + images.length) % images.length);
  const next = () => setI((x) => (x + 1) % images.length);
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between p-3">
        <span className="rounded-full bg-white/10 px-3 py-1.5 font-num text-[13px] text-white">
          {i + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        className="relative flex flex-1 items-center justify-center px-2 pb-4"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - startX.current;
          if (dx > 40) prev();
          else if (dx < -40) next();
        }}
      >
        {/* eslint-disable-next-line */}
        <img src={images[i]} alt="" className="max-h-full max-w-full object-contain" />
        {images.length > 1 ? (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function FavView({
  cars,
  onOpen,
  onRemove,
  onBack,
}: {
  cars: Car[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <>
      <Header2 title="Избранное" onBack={onBack} />
      <div className="space-y-3">
        {cars.length === 0 ? (
          <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
            Здесь пока пусто. Добавляйте авто кнопкой ♥.
          </p>
        ) : (
          cars.map((car) => (
            <div
              key={car.id}
              className="flex items-center gap-3 rounded-[16px] border border-line-dark bg-graphite-2 p-2.5"
            >
              <button
                onClick={() => onOpen(car.id)}
                className="h-[56px] w-[80px] flex-none overflow-hidden rounded-[10px] bg-black"
              >
                {/* eslint-disable-next-line */}
                <img src={car.images[0]} alt="" className="h-full w-full object-cover" />
              </button>
              <button
                onClick={() => onOpen(car.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate font-bold">{car.model}</div>
                <div className="font-num text-[15px] font-bold text-bordeaux-bright">
                  {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
                </div>
              </button>
              <button
                onClick={() => onRemove(car.id)}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-bordeaux text-white"
              >
                <Heart className="h-[18px] w-[18px] fill-white" />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export function CarView({
  car,
  fav,
  inCompare,
  onToggleCompare,
  onToggleFav,
  onBack,
  onLead,
  showInAppCta,
}: {
  car: Car;
  fav: boolean;
  inCompare: boolean;
  onToggleCompare: () => void;
  onToggleFav: () => void;
  onBack: () => void;
  onLead: () => void;
  showInAppCta: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [lb, setLb] = useState(false);
  const prev = () =>
    setIdx((i) => (i - 1 + car.images.length) % car.images.length);
  const next = () => setIdx((i) => (i + 1) % car.images.length);

  return (
    <>
      {lb ? (
        <Lightbox images={car.images} start={idx} onClose={() => setLb(false)} />
      ) : null}
      <Header2 title={car.model} onBack={onBack} />
      <div className="relative aspect-[16/11] overflow-hidden rounded-[16px] bg-black">
        {/* eslint-disable-next-line */}
        <img
          src={car.images[idx]}
          alt=""
          onClick={() => setLb(true)}
          className="h-full w-full cursor-pointer object-cover"
        />
        <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold text-white">
          <Maximize2 className="h-3 w-3" /> на весь экран
        </span>
        {car.images.length > 1 ? (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-graphite/80 text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-graphite/80 text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-graphite/80 px-2 py-0.5 font-num text-[12px]">
              {idx + 1}/{car.images.length}
            </div>
          </>
        ) : null}
        {car.isNew ? (
          <span className="absolute right-3 top-3 rounded-full bg-bordeaux px-3 py-1 text-[11px] font-extrabold uppercase text-white">
            Новинка
          </span>
        ) : null}
      </div>

      {car.video ? (
        <video
          src={car.video}
          poster={car.images[0]}
          controls
          playsInline
          preload="metadata"
          className="mt-3 aspect-video w-full rounded-[16px] bg-black object-contain"
        />
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Flag code={car.country} className="h-4 w-6" />
        <span className="text-[14px] font-semibold text-chrome">
          {countries[car.country].label} · {car.trim}
        </span>
      </div>
      <h2 className="mt-1 text-[24px] font-extrabold uppercase leading-none">
        {car.model}
      </h2>
      <div className="mt-1 text-[13px] text-[#9AA4B2]">
        {car.year} · {car.engine} · {car.gearbox} · {car.drive}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          car.isNew ? "Новый" : "С пробегом",
          car.bodyType || "",
          car.fuelType || "",
          car.steering ? `${car.steering} руль` : "",
        ]
          .filter(Boolean)
          .map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-line-dark bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold text-[#C7CFD6]"
            >
              {chip}
            </span>
          ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Price label="до Твери" value={car.priceTverRub ?? car.priceRub} accent />
        {car.priceMoscowRub ? (
          <Price label="до Москвы" value={car.priceMoscowRub} />
        ) : null}
      </div>

      {car.description ? (
        <p className="mt-4 text-[14px] leading-relaxed text-[#C7CFD6]">
          {car.description}
        </p>
      ) : null}

      <ul className="mt-4 space-y-1.5">
        {car.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-[13.5px] text-[#C7CFD6]">
            <Check className="mt-0.5 h-4 w-4 flex-none text-success" />
            {h}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onToggleFav}
          className={`btn flex-1 ${
            fav
              ? "border border-bordeaux-bright bg-bordeaux/15 text-white"
              : "border border-line-dark text-white"
          }`}
        >
          <Heart className={`h-[18px] w-[18px] ${fav ? "fill-bordeaux-bright text-bordeaux-bright" : ""}`} />
          {fav ? "В избранном" : "В избранное"}
        </button>
        <button
          onClick={onToggleCompare}
          className={`btn flex-1 ${
            inCompare
              ? "border border-bordeaux-bright bg-bordeaux/15 text-white"
              : "border border-line-dark text-white"
          }`}
        >
          <Scale className="h-[18px] w-[18px]" />
          {inCompare ? "В сравнении" : "Сравнить"}
        </button>
      </div>
      {showInAppCta ? (
        <button onClick={onLead} className="btn btn-primary mt-3 w-full">
          Оставить заявку
        </button>
      ) : null}
    </>
  );
}

export function LeadView({
  car,
  formRef,
  onBack,
  onSubmit,
  showInAppCta,
}: {
  car?: Car;
  formRef: React.MutableRefObject<{ name: string; phone: string; carId?: string }>;
  onBack: () => void;
  onSubmit: (name: string, phone: string) => void;
  showInAppCta: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    formRef.current = { name, phone, carId: car?.id };
  }, [name, phone, car, formRef]);


  return (
    <>
      <Header2 title="Заявка на расчёт" onBack={onBack} />
      {car ? (
        <div className="mb-4 flex items-center gap-3 rounded-[16px] border border-line-dark bg-graphite-2 p-2.5">
          {/* eslint-disable-next-line */}
          <img
            src={car.images[0]}
            alt=""
            className="h-12 w-16 flex-none rounded-[8px] object-cover"
          />
          <div>
            <div className="font-bold">{car.model}</div>
            <div className="font-num text-[14px] font-bold text-bordeaux-bright">
              {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
            </div>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          className="field-dark"
        />
        <input
          value={phone}
          inputMode="tel"
          onChange={(e) => setPhone(maskRuPhone(e.target.value))}
          placeholder="+7 (___) ___-__-__"
          className="field-dark"
        />
      </div>
      <p className="mt-2 text-[12px] text-[#8C97A1]">
        Нажимая «Отправить», вы соглашаетесь с обработкой персональных данных.
        Перезвоним в течение 15 минут.
      </p>
      {showInAppCta ? (
        <button
          onClick={() => onSubmit(name, phone)}
          className="btn btn-primary mt-4 w-full"
        >
          Отправить заявку
        </button>
      ) : null}
    </>
  );
}

/* ---------- Примерный калькулятор «под ключ» ---------- */
// Коэффициенты приблизительные — для предварительной оценки.
// Точную смету подтверждает менеджер.
const DELIVERY: Record<CountryCode, number> = {
  kr: 120000,
  cn: 90000,
  jp: 130000,
  eu: 160000,
};
const DOCS = 60000; // СБКТС / ЭПТС / брокер
const SERVICE = 80000; // услуги компании
type Age = "u3" | "a35" | "o5";

function dutyPerCc(cc: number, age: Age) {
  const base =
    cc <= 1000 ? 1.5 : cc <= 1500 ? 1.7 : cc <= 1800 ? 2.5 : cc <= 2300 ? 2.7 : cc <= 3000 ? 3.0 : 3.6;
  const old =
    cc <= 1000 ? 3.0 : cc <= 1500 ? 3.2 : cc <= 1800 ? 3.5 : cc <= 2300 ? 4.8 : cc <= 3000 ? 5.0 : 5.7;
  return age === "o5" ? old : base;
}

// Утильсбор-2026. Льготный (физлицо, личное пользование) — только при
// двигателе ≤3.0 л и мощности ≤160 л.с.: 3 400 ₽ (до 3 лет) / 5 200 ₽ (старше).
// Иначе — коммерческий (ориентир, базовая ставка × коэффициент).
function utilFee(age: Age, eligible: boolean, cc: number) {
  if (eligible) return age === "u3" ? 3400 : 5200;
  const t = cc <= 1000 ? 0 : cc <= 2000 ? 1 : cc <= 3000 ? 2 : 3;
  const commNew = [180000, 600000, 1200000, 2000000];
  const commOld = [300000, 850000, 1650000, 2700000];
  return age === "u3" ? commNew[t] : commOld[t];
}

export function CalcView({ onBack, onLead }: { onBack: () => void; onLead: () => void }) {
  const [country, setCountry] = useState<CountryCode>("kr");
  const [priceStr, setPriceStr] = useState("");
  const [volStr, setVolStr] = useState("");
  const [powStr, setPowStr] = useState("");
  const [age, setAge] = useState<Age>("a35");
  const [electric, setElectric] = useState(false);
  const [eurRate, setEurRate] = useState<number | null>(null);
  const [rateDate, setRateDate] = useState<string | null>(null);

  useEffect(() => {
    fetchRates().then((r) => {
      if (r?.rates.eur) {
        setEurRate(r.rates.eur);
        setRateDate(r.date);
      }
    });
  }, []);

  const EUR_RUB = eurRate ?? 105;
  const price = Number(priceStr) || 0;
  const volume = Number(volStr) || 0;
  const power = Number(powStr) || 0;
  const delivery = DELIVERY[country];
  const eligible = electric ? power <= 160 : volume <= 3000 && power <= 160;
  const util = utilFee(age, eligible, volume);
  const duty = electric
    ? Math.round(price * 0.15)
    : age === "u3"
      ? Math.round(price * 0.48)
      : Math.round(volume * dutyPerCc(volume, age) * EUR_RUB);
  const total = price + delivery + duty + util + DOCS + SERVICE;
  const ready = price > 0 && power > 0 && (electric || volume > 0);

  const ageBtns: [Age, string][] = [
    ["u3", "до 3 лет"],
    ["a35", "3–5 лет"],
    ["o5", "старше 5"],
  ];

  return (
    <>
      <Header2 title="Калькулятор под ключ" onBack={onBack} />
      <p className="-mt-2 mb-4 text-[13px] text-[#9AA4B2]">
        Примерная стоимость авто в РФ: доставка, пошлина, утильсбор, оформление и
        услуги. Точный расчёт подтвердит менеджер.
      </p>

      <div className="space-y-3">
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            Страна
          </span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DELIVERY) as CountryCode[]).map((code) => (
              <button
                key={code}
                onClick={() => setCountry(code)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${
                  country === code
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                <Flag code={code} className="h-3 w-4" />
                {countries[code].label}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            Цена авто в стране, ₽
          </span>
          <input
            value={priceStr}
            inputMode="numeric"
            onChange={(e) => setPriceStr(e.target.value.replace(/\D/g, ""))}
            placeholder="например, 1 500 000"
            className="field-dark"
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            Возраст авто
          </span>
          <div className="flex gap-2">
            {ageBtns.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setAge(v)}
                className={`flex-1 rounded-full border px-2 py-2 text-[13px] font-bold ${
                  age === v
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={electric ? "pointer-events-none opacity-40" : ""}>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
              Объём, см³
            </span>
            <input
              value={volStr}
              inputMode="numeric"
              disabled={electric}
              onChange={(e) => setVolStr(e.target.value.replace(/\D/g, ""))}
              placeholder="1600"
              className="field-dark"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
              Мощность, л.с.
            </span>
            <input
              value={powStr}
              inputMode="numeric"
              onChange={(e) => setPowStr(e.target.value.replace(/\D/g, ""))}
              placeholder="150"
              className="field-dark"
            />
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={electric}
            onChange={(e) => setElectric(e.target.checked)}
            className="h-4 w-4 accent-bordeaux"
          />
          <span className="text-[14px] font-semibold">Электромобиль</span>
        </label>
      </div>

      {/* Результат */}
      <div className="mt-5 rounded-[18px] border border-line-dark bg-graphite-2 p-4">
        <CalcRow label="Стоимость авто" value={price} />
        <CalcRow label={`Доставка (${countries[country].label})`} value={delivery} />
        <CalcRow label="Таможенная пошлина" value={duty} hint={!ready ? "—" : undefined} />
        <CalcRow
          label={`Утильсбор (${eligible ? "льготный" : "коммерческий"})`}
          value={util}
        />
        <CalcRow label="Оформление (СБКТС, ЭПТС, брокер)" value={DOCS} />
        <CalcRow label="Услуги компании" value={SERVICE} />
        <div className="mt-3 flex items-center justify-between border-t border-line-dark pt-3">
          <span className="text-[13px] font-bold uppercase tracking-wide text-chrome">
            Итого под ключ
          </span>
          <span className="font-num text-[22px] font-extrabold text-bordeaux-bright">
            {ready ? `${formatPrice(total)} ₽` : "—"}
          </span>
        </div>
      </div>

      {ready && !eligible ? (
        <p className="mt-2 rounded-[12px] border border-bordeaux-bright/30 bg-bordeaux/[0.08] p-2.5 text-[12px] text-[#E7B3AE]">
          ⚠️ Мощность &gt;160 л.с. или объём &gt;3.0 л — действует{" "}
          <b>коммерческий</b> утильсбор (ориентир). Точную сумму подтвердит менеджер.
        </p>
      ) : null}

      <p className="mt-2 text-[12px] text-[#8C97A1]">
        Расчёт примерный. Курс €{" "}
        {eurRate ? `${eurRate.toFixed(2)} ₽ (ЦБ${rateDate ? ", " + rateDate.slice(0, 10) : ""})` : `${EUR_RUB} ₽`}
        . Утильсбор-2026: льготный 3 400/5 200 ₽ при ≤3.0 л и ≤160 л.с. Итоговую
        смету фиксирует менеджер.
      </p>

      <button onClick={onLead} className="btn btn-primary mt-4 w-full">
        Оставить заявку на точный расчёт
      </button>
    </>
  );
}

function CalcRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-[13.5px]">
      <span className="text-[#C7CFD6]">{label}</span>
      <span className="font-num font-bold text-white">
        {hint ?? `${formatPrice(value)} ₽`}
      </span>
    </div>
  );
}

/* ---------- Домашнее меню ---------- */
type HomeTarget =
  | "list"
  | "calc"
  | "quiz"
  | "subscribe"
  | "compare"
  | "reviews"
  | "favorites"
  | "faq";

export function HomeView({
  favCount,
  compareCount,
  go,
  onLead,
}: {
  favCount: number;
  compareCount: number;
  go: (name: HomeTarget) => void;
  onLead: () => void;
}) {
  const items: {
    name: HomeTarget;
    label: string;
    sub: string;
    icon: typeof CarIcon;
    primary?: boolean;
  }[] = [
    { name: "list", label: "Каталог", sub: "Все авто под заказ", icon: CarIcon, primary: true },
    { name: "subscribe", label: "Оповещения", sub: "О новинках каталога", icon: Bell },
    { name: "compare", label: "Сравнить", sub: compareCount ? `${compareCount} выбрано` : "До 3 авто", icon: Scale },
    { name: "reviews", label: "Отзывы", sub: "Мнения клиентов", icon: Star },
    { name: "faq", label: "Вопросы", sub: "Частые вопросы", icon: HelpCircle },
    { name: "favorites", label: "Избранное", sub: favCount ? `${favCount} авто` : "Сохранённые", icon: Heart },
  ];
  return (
    <>
      <div className="mb-5 px-0.5 pt-1">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="h-[2px] w-7 rounded-full bg-bordeaux-bright" />
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.22em] text-bordeaux-bright">
            Импорт авто под ключ
          </span>
        </div>
        <h1 className="font-display text-[26px] font-extrabold uppercase leading-[1.04] text-shine">
          Авто из Кореи, Китая,
          <br />
          Японии и ЕС
        </h1>
        <div className="mt-3 flex items-center gap-2">
          <Flag code="kr" className="h-3.5 w-5" />
          <Flag code="cn" className="h-3.5 w-5" />
          <Flag code="jp" className="h-3.5 w-5" />
          <Flag code="eu" className="h-3.5 w-5" />
          <span className="ml-1 text-[12.5px] text-[#9AA4B2]">
            Честный расчёт с растаможкой
          </span>
        </div>
      </div>

      {/* Промо-кнопка квиза */}
      <button
        onClick={() => go("quiz")}
        className="mb-3 flex w-full items-center gap-3 rounded-[18px] border border-bordeaux-bright bg-bordeaux/[0.15] p-4 text-left transition-transform active:scale-[0.99]"
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-bordeaux text-white">
          <ClipboardList className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-extrabold">
            Ответьте на 5 вопросов
          </span>
          <span className="block text-[12.5px] text-[#C7CFD6]">
            Подберём авто и расчёт под ваш бюджет
          </span>
        </span>
      </button>

      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <button
            key={it.name}
            onClick={() => go(it.name)}
            className={`flex flex-col items-center gap-2 rounded-[18px] border p-4 text-center transition-transform active:scale-[0.98] ${
              it.primary
                ? "col-span-2 border-bordeaux-bright bg-bordeaux/[0.12]"
                : "border-line-dark bg-graphite-2"
            }`}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                it.primary ? "bg-bordeaux text-white" : "bg-graphite text-bordeaux-bright"
              }`}
            >
              <it.icon className="h-5 w-5" />
            </span>
            <span className="text-[16px] font-extrabold">{it.label}</span>
            <span className="text-[12px] text-[#9AA4B2]">{it.sub}</span>
          </button>
        ))}
      </div>
      <button onClick={onLead} className="btn btn-primary mt-3 w-full">
        <Send className="h-[18px] w-[18px]" /> Оставить заявку
      </button>
    </>
  );
}

/* ---------- Квиз: 5 вопросов → подбор под бюджет ---------- */
type QuizState = {
  budget?: number; // индекс варианта бюджета
  body?: string;
  country?: CountryCode | "any";
  condition?: "new" | "used" | "any";
  when?: string;
};
const BUDGETS: { label: string; min: number; max: number }[] = [
  { label: "1,5–2 млн ₽", min: 1_500_000, max: 2_000_000 },
  { label: "2–2,5 млн ₽", min: 2_000_000, max: 2_500_000 },
  { label: "2,5 млн ₽ и больше", min: 2_500_000, max: Infinity },
];

export function QuizView({
  inTg,
  onBack,
  onOpen,
  haptic: hapticOk,
}: {
  inTg: boolean;
  onBack: () => void;
  onOpen: (id: string) => void;
  haptic: () => void;
}) {
  const { cars } = useCars();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizState>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const steps: {
    key: keyof QuizState;
    q: string;
    opts: { label: string; value: string | number }[];
  }[] = [
    {
      key: "budget",
      q: "Какой бюджет под ключ?",
      opts: BUDGETS.map((b, i) => ({ label: b.label, value: i })),
    },
    {
      key: "body",
      q: "Какой тип кузова?",
      opts: [
        { label: "Седан", value: "Седан" },
        { label: "Кроссовер", value: "Кроссовер" },
        { label: "Внедорожник", value: "Внедорожник" },
        { label: "Неважно", value: "any" },
      ],
    },
    {
      key: "country",
      q: "Откуда предпочитаете?",
      opts: [
        { label: "Корея", value: "kr" },
        { label: "Китай", value: "cn" },
        { label: "Япония", value: "jp" },
        { label: "Европа", value: "eu" },
        { label: "Неважно", value: "any" },
      ],
    },
    {
      key: "condition",
      q: "Новое или с пробегом?",
      opts: [
        { label: "Новое", value: "new" },
        { label: "С пробегом", value: "used" },
        { label: "Неважно", value: "any" },
      ],
    },
    {
      key: "when",
      q: "Когда планируете покупку?",
      opts: [
        { label: "Сейчас", value: "Сейчас" },
        { label: "1–3 месяца", value: "1–3 месяца" },
        { label: "Просто смотрю", value: "Просто смотрю" },
      ],
    },
  ];

  const total = steps.length;
  const done = step >= total;

  function choose(key: keyof QuizState, value: string | number) {
    hapticOk();
    setA((p) => ({ ...p, [key]: value }));
    setStep((s) => s + 1);
  }

  // подбор под ответы
  const budget = typeof a.budget === "number" ? BUDGETS[a.budget] : null;
  const matches = cars.filter((c) => {
    const price = c.priceTverRub ?? c.priceRub;
    if (budget && (price < budget.min || price > budget.max)) return false;
    if (a.body && a.body !== "any" && c.bodyType !== a.body) return false;
    if (a.country && a.country !== "any" && c.country !== a.country) return false;
    if (a.condition === "new" && !c.isNew) return false;
    if (a.condition === "used" && c.isNew) return false;
    return true;
  });

  function summary() {
    const parts = [
      budget ? `бюджет ${budget.label}` : "",
      a.body && a.body !== "any" ? a.body : "",
      a.country && a.country !== "any" ? countries[a.country as CountryCode].label : "",
      a.condition === "new" ? "новое" : a.condition === "used" ? "с пробегом" : "",
    ].filter(Boolean);
    return parts.join(", ");
  }


  async function submit() {
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 11) {
      showToast("Заполните имя и телефон", "error");
      return;
    }
    const payload = {
      type: "lead",
      name: name.trim(),
      phone,
      car: `Квиз: ${summary() || "без уточнений"}`,
      budget: budget?.label || "",
      comment: a.when ? `Срок: ${a.when}` : "",
      source: "Квиз (мини-апп)",
    };
    const endpoint = import.meta.env.VITE_LEAD_ENDPOINT as string | undefined;
    if (!endpoint) {
      setSent(true);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLoading(false);
      if (r.ok) {
        hapticOk();
        setSent(true);
      } else showToast("Не удалось отправить", "error");
    } catch {
      setLoading(false);
      showToast("Ошибка сети", "error");
    }
  }

  if (sent) {
    return (
      <>
        <Header2 title="Подбор по бюджету" onBack={onBack} />
        <div className="rounded-[18px] border border-success/40 bg-success/10 p-5 text-center">
          <Check className="mx-auto h-8 w-8 text-success" />
          <p className="mt-2 text-[16px] font-bold">Заявка отправлена!</p>
          <p className="mt-1 text-[13px] text-[#C7CFD6]">
            Подготовим расчёт под ваш бюджет и перезвоним в течение 15 минут.
          </p>
        </div>
      </>
    );
  }

  // экран вопросов
  if (!done) {
    const cur = steps[step];
    return (
      <>
        <Header2 title="Подбор по бюджету" onBack={step === 0 ? onBack : () => setStep((s) => s - 1)} />
        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            <span>Вопрос {step + 1} из {total}</span>
            <span>{Math.round(((step + 1) / total) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-graphite-2">
            <div
              className="h-full rounded-full bg-bordeaux-bright transition-all"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
        </div>
        <h2 className="mb-4 text-[20px] font-extrabold leading-tight">{cur.q}</h2>
        <div className="space-y-2.5">
          {cur.opts.map((o) => (
            <button
              key={String(o.value)}
              onClick={() => choose(cur.key, o.value)}
              className="flex w-full items-center justify-between rounded-[14px] border border-line-dark bg-graphite-2 px-4 py-3.5 text-left text-[15px] font-semibold transition-colors active:border-bordeaux-bright"
            >
              {o.label}
              <ChevronRight className="h-4 w-4 text-chrome" />
            </button>
          ))}
        </div>
      </>
    );
  }

  // экран результата + заявка
  return (
    <>
      <Header2 title="Ваш подбор" onBack={() => setStep(total - 1)} />
      <div className="mb-4 rounded-[14px] border border-line-dark bg-graphite-2 p-3 text-[13px] text-[#C7CFD6]">
        🎯 Параметры: <b className="text-white">{summary() || "без уточнений"}</b>
      </div>

      {matches.length ? (
        <>
          <div className="mb-2 text-[13px] font-semibold text-[#9AA4B2]">
            Подходит из наличия: <span className="font-num text-white">{matches.length}</span>
          </div>
          <div className="mb-4 space-y-2.5">
            {matches.slice(0, 5).map((car) => (
              <button
                key={car.id}
                onClick={() => onOpen(car.id)}
                className="flex w-full items-center gap-3 rounded-[14px] border border-line-dark bg-graphite-2 p-2.5 text-left"
              >
                <div className="h-[52px] w-[74px] flex-none overflow-hidden rounded-[10px] bg-black">
                  {/* eslint-disable-next-line */}
                  <img src={car.images[0]} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{car.model}</div>
                  <div className="font-num text-[14px] font-bold text-bordeaux-bright">
                    {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 flex-none text-chrome" />
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mb-4 rounded-[14px] border border-line-dark bg-graphite-2 p-4 text-center text-[13.5px] text-[#9AA4B2]">
          Точного совпадения пока нет — подберём под заказ под ваш бюджет.
        </p>
      )}

      <div className="rounded-[18px] border border-bordeaux-bright/40 bg-bordeaux/[0.06] p-4">
        <p className="mb-3 text-[14px] font-bold">
          Оставьте контакты — пришлём расчёт под ключ под ваш бюджет:
        </p>
        <div className="space-y-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            className="field-dark"
          />
          <input
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(maskRuPhone(e.target.value))}
            placeholder="+7 (___) ___-__-__"
            className="field-dark"
          />
        </div>
        {!inTg ? (
          <p className="mt-2 text-[11px] text-[#8C97A1]">
            Перезвоним в течение 15 минут.
          </p>
        ) : null}
        <button onClick={submit} className="btn btn-primary mt-3 w-full">
          {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
          Получить расчёт
        </button>
      </div>
    </>
  );
}

/* ---------- Подписка на подбор ---------- */
const SUB_COUNTRIES = [
  ["", "Любая"],
  ["Корея", "Корея"],
  ["Китай", "Китай"],
  ["Япония", "Япония"],
  ["Европа", "Европа"],
] as const;
const SUB_BODIES = ["", "Седан", "Кроссовер", "Внедорожник", "Хэтчбек", "Минивэн"];

export function SubscribeView({
  initData,
  inTg,
  onBack,
  haptic: hapticOk,
}: {
  initData: string;
  inTg: boolean;
  onBack: () => void;
  haptic: () => void;
}) {
  const [country, setCountry] = useState("");
  const [body, setBody] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const lab = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]";

  async function submit() {
    if (!inTg || !initData) {
      showToast("Подписка доступна при открытии из Telegram", "error");
      return;
    }
    setLoading(true);
    const r = await apiSubscribe(initData, {
      country: country || undefined,
      body: body || undefined,
      budget: budget ? Number(budget) : undefined,
    });
    setLoading(false);
    if (r.ok) {
      hapticOk();
      setDone(true);
    } else showToast("Не удалось оформить: " + (r.error || ""), "error");
  }

  if (done) {
    return (
      <>
        <Header2 title="Подписка" onBack={onBack} />
        <div className="rounded-[18px] border border-success/40 bg-success/10 p-5 text-center">
          <Bell className="mx-auto h-8 w-8 text-success" />
          <p className="mt-2 text-[16px] font-bold">Подписка оформлена!</p>
          <p className="mt-1 text-[13px] text-[#C7CFD6]">
            Сообщим в этом боте, как только появится подходящее авто.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header2 title="Подписка на подбор" onBack={onBack} />
      <p className="-mt-2 mb-4 text-[13px] text-[#9AA4B2]">
        Укажите параметры — пришлём уведомление, когда появится подходящее авто.
      </p>
      <div className="space-y-3">
        <div>
          <span className={lab}>Страна</span>
          <div className="flex flex-wrap gap-2">
            {SUB_COUNTRIES.map(([v, label]) => (
              <button
                key={label}
                onClick={() => setCountry(v)}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-bold ${
                  country === v
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={lab}>Тип кузова</span>
          <div className="flex flex-wrap gap-2">
            {SUB_BODIES.map((b) => (
              <button
                key={b || "any"}
                onClick={() => setBody(b)}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-bold ${
                  body === b
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                {b || "Любой"}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className={lab}>Бюджет до, ₽</span>
          <input
            value={budget}
            inputMode="numeric"
            onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
            placeholder="например, 2 500 000"
            className="field-dark"
          />
        </label>
      </div>
      <button onClick={submit} className="btn btn-primary mt-4 w-full">
        {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Bell className="h-[18px] w-[18px]" />}
        Подписаться
      </button>
    </>
  );
}

/* ---------- Отзывы ---------- */
/** Заголовок карточки — какое авто выдано (служебные строки поста убираем). */
function deliveredTitle(text?: string): string {
  const lines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const l of lines) {
    const m = l.match(/выдач[аи]\s*[:—-]?\s*(.+)$/i);
    if (m) {
      const model = m[1].replace(/[«»"']/g, "").trim();
      if (model && model.length <= 60) return model;
    }
  }
  const junk =
    /клиент\s*[:—-]|пришел|пришёл|по\s*ссылке|хотите\s*такой|напишите|подбер[её]м|@[a-z0-9_]/i;
  const first = lines.find((l) => !junk.test(l));
  if (first) {
    const clean = first.replace(/\s+/g, " ").trim();
    return clean.length > 70 ? clean.slice(0, 67) + "…" : clean;
  }
  return "Автомобиль выдан клиенту";
}

/** Медиа отзыва одним списком: видео вперёд, затем фото. */
function reviewSlides(r: Review): { type: "video" | "image"; src: string }[] {
  const videos = r.videos?.length ? r.videos : r.video ? [r.video] : [];
  const images = r.images?.length ? r.images : r.media ? [r.media] : [];
  return [
    ...videos.map((src) => ({ type: "video" as const, src })),
    ...images.map((src) => ({ type: "image" as const, src })),
  ];
}

function ReviewItem({ review }: { review: Review }) {
  const slides = reviewSlides(review);
  const [idx, setIdx] = useState(0);
  const cur = slides[idx] ?? slides[0];
  const poster = review.images?.[0] || review.media;

  return (
    <div className="overflow-hidden rounded-[16px] border border-line-dark bg-graphite-2">
      {cur ? (
        <div className="relative aspect-video bg-black">
          {cur.type === "video" ? (
            <video
              key={cur.src}
              src={cur.src}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            // eslint-disable-next-line
            <img src={cur.src} alt="" className="h-full w-full object-cover" />
          )}
          {slides.length > 1 ? (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 font-num text-[11px] font-bold text-white">
              {idx + 1}/{slides.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {slides.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slides.map((sl, i) => (
            <button
              key={sl.src + i}
              onClick={() => setIdx(i)}
              aria-label={`Медиа ${i + 1}`}
              className={`relative h-12 w-12 flex-none overflow-hidden rounded-[9px] border ${
                i === idx ? "border-bordeaux-bright" : "border-line-dark"
              }`}
            >
              {/* eslint-disable-next-line */}
              <img
                src={sl.type === "video" ? poster : sl.src}
                alt=""
                className="h-full w-full bg-graphite object-cover"
              />
              {sl.type === "video" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                  ▶
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="p-4">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#8C97A1]">
          Выдача
        </div>
        <div className="mt-0.5 text-[15px] font-extrabold leading-tight text-white">
          {deliveredTitle(review.text)}
        </div>
      </div>
    </div>
  );
}

export function ReviewsView({ onBack }: { onBack: () => void }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  useEffect(() => {
    fetchReviews().then((rs) =>
      setReviews(
        rs.filter(
          (r) => r.media || r.images?.length || (r.text || "").trim().length > 2,
        ),
      ),
    );
  }, []);
  return (
    <>
      <Header2 title="Отзывы клиентов" onBack={onBack} />
      {reviews === null ? (
        <div className="flex justify-center py-10 text-chrome">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
          Отзывы скоро появятся.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- FAQ ---------- */
export function FaqView({ onBack }: { onBack: () => void }) {
  const [faq, setFaq] = useState<Faq[] | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  useEffect(() => {
    fetchFaq().then(setFaq);
  }, []);
  return (
    <>
      <Header2 title="Частые вопросы" onBack={onBack} />
      {faq === null ? (
        <div className="flex justify-center py-10 text-chrome">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {faq.map((f, i) => (
            <div key={i} className="overflow-hidden rounded-[14px] border border-line-dark bg-graphite-2">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-2 p-3.5 text-left"
              >
                <span className="text-[14px] font-bold">{f.q}</span>
                <ChevronRight
                  className={`h-4 w-4 flex-none text-chrome transition-transform ${open === i ? "rotate-90" : ""}`}
                />
              </button>
              {open === i ? (
                <p className="px-3.5 pb-3.5 text-[13px] text-[#C7CFD6]">{f.a}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <a
        href={site.telegramHref}
        target="_blank"
        rel="noreferrer"
        className="btn btn-primary mt-4 w-full"
      >
        <TelegramIcon className="h-[18px] w-[18px]" /> Задать вопрос менеджеру
      </a>
    </>
  );
}

/* ---------- Сравнение ---------- */
export function CompareView({
  cars,
  onRemove,
  onClear,
  onBack,
  onOpenCatalog,
}: {
  cars: Car[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onBack: () => void;
  onOpenCatalog: () => void;
}) {
  const rows: [string, (c: Car) => string][] = [
    ["Цена под ключ", (c) => `${formatPrice(c.priceTverRub ?? c.priceRub)} ₽`],
    ["Год", (c) => String(c.year)],
    ["Страна", (c) => countries[c.country].label],
    ["Кузов", (c) => c.bodyType || "—"],
    ["Двигатель", (c) => c.engine],
    ["Мощность", (c) => (c.powerHp ? `${c.powerHp} л.с.` : "—")],
    ["Топливо", (c) => c.fuelType || "—"],
    ["Коробка", (c) => c.gearbox],
    ["Привод", (c) => c.drive],
    ["Цвет", (c) => c.color || "—"],
  ];
  if (cars.length === 0) {
    return (
      <>
        <Header2 title="Сравнение" onBack={onBack} />
        <div className="rounded-[18px] border border-line-dark bg-graphite-2 p-6 text-center">
          <Scale className="mx-auto h-8 w-8 text-chrome" />
          <p className="mt-2 font-bold">Список сравнения пуст</p>
          <p className="mt-1 text-[13px] text-[#9AA4B2]">
            Откройте карточку авто и нажмите «Добавить к сравнению» (до 3 авто).
          </p>
          <button onClick={onOpenCatalog} className="btn btn-primary mt-4 w-full">
            <CarIcon className="h-[18px] w-[18px]" /> В каталог
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-[18px] font-extrabold uppercase">Сравнение</h1>
        <button onClick={onClear} className="ml-auto text-[12.5px] font-bold text-bordeaux-bright">
          Очистить
        </button>
      </div>
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-graphite" />
              {cars.map((c) => (
                <th key={c.id} className="min-w-[140px] p-2 align-top">
                  <div className="relative overflow-hidden rounded-[12px] border border-line-dark bg-graphite-2 p-2">
                    <button
                      onClick={() => onRemove(c.id)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-graphite/80 text-bordeaux-bright"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {/* eslint-disable-next-line */}
                    <img src={c.images[0]} alt="" className="h-16 w-full rounded-[8px] object-cover" />
                    <div className="mt-1.5 text-[12.5px] font-bold leading-tight">{c.model}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn], ri) => (
              <tr key={label} className={ri % 2 ? "bg-white/[0.02]" : ""}>
                <td className="sticky left-0 bg-graphite px-2 py-2 text-[11.5px] font-bold uppercase tracking-wide text-[#8C97A1]">
                  {label}
                </td>
                {cars.map((c) => (
                  <td key={c.id} className="px-2 py-2 font-num text-white">
                    {fn(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-[#8C97A1]">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// Диапазон «от/до» на двух ползунках (мини-апп). null = граница не задана.
function MiniRange({
  label,
  min,
  max,
  step,
  from,
  to,
  onFrom,
  onTo,
  fmt,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  from: number | null;
  to: number | null;
  onFrom: (v: number | null) => void;
  onTo: (v: number | null) => void;
  fmt: (n: number) => string;
}) {
  const lo = from ?? min;
  const hi = to ?? max;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px] font-bold uppercase tracking-wide text-[#8C97A1]">
        <span>{label}: от <span className="font-num text-bordeaux-bright">{fmt(lo)}</span></span>
        <span>до <span className="font-num text-bordeaux-bright">{fmt(hi)}</span></span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        onChange={(e) => {
          const v = Math.min(Number(e.target.value), hi);
          onFrom(v <= min ? null : v);
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
          onTo(v >= max ? null : v);
        }}
        className="w-full accent-bordeaux"
      />
    </div>
  );
}

function Header2({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="truncate text-[18px] font-extrabold uppercase">{title}</h1>
    </div>
  );
}

function Price({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-line-dark bg-graphite-2 px-3 py-2.5">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8C97A1]">
        под ключ {label}
      </div>
      <div
        className={`font-num text-[18px] font-bold ${accent ? "text-bordeaux-bright" : "text-white"}`}
      >
        {formatPrice(value)} ₽
      </div>
    </div>
  );
}
