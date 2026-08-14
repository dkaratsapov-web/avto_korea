import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gem } from "lucide-react";
import { Hero } from "@/components/sections/Hero";
import { CarCard } from "@/components/CarCard";
import { isPremium, PREMIUM_MIN_PRICE } from "@/data/cars";
import { useCars } from "@/lib/carsStore";
import { BrandTicker } from "@/components/sections/BrandTicker";
import { Channels } from "@/components/sections/Channels";
import { FinalCta } from "@/components/sections/FinalCta";

// Сколько колонок в сетке на текущей ширине — чтобы показать ровно 5 рядов
// (сетка ниже: 2 колонки на мобильном, 3 на lg, 4 на xl).
function useGridColumns() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setCols(w >= 1280 ? 4 : w >= 1024 ? 3 : 2);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return cols;
}

const ROWS = 5;

/** Превью каталога на главной: последние авто + переход в полный каталог. */
function HomeCatalog() {
  const { cars } = useCars();
  const cols = useGridColumns();
  const [tab, setTab] = useState<"all" | "premium">("all");

  const premium = useMemo(() => cars.filter(isPremium), [cars]);
  const source = tab === "premium" ? premium : cars;
  const list = source.slice(0, cols * ROWS);
  // Переход ведёт в ту же вкладку каталога, что открыта здесь.
  const catalogHref = tab === "premium" ? "/catalog?tab=premium" : "/catalog";

  return (
    <section id="catalog" className="scroll-mt-24 bg-paper py-12">
      <div className="wrap">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[clamp(19px,2vw,26px)] font-extrabold uppercase leading-none text-ink">
              Каталог автомобилей
            </h2>
            {source.length ? (
              <span className="rounded-full border border-line bg-white px-3 py-1 font-num text-[13px] font-bold text-ink-2">
                {source.length} авто в каталоге
              </span>
            ) : null}
          </div>
          <Link
            to={catalogHref}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-4 py-2 text-[13.5px] font-bold text-bordeaux transition-colors hover:border-bordeaux/30 hover:text-bordeaux-bright"
          >
            Открыть весь каталог
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Вкладки. «Премиум» выделена намеренно: это дорогая витрина,
            и она должна цеплять взгляд раньше обычного списка. */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-line bg-white p-1 shadow-[0_10px_26px_-18px_rgba(20,25,32,0.5)]">
            <button
              type="button"
              onClick={() => setTab("all")}
              aria-pressed={tab === "all"}
              className={`rounded-full px-5 py-2.5 text-[14.5px] font-extrabold transition-colors ${
                tab === "all" ? "bg-graphite text-white" : "text-ink-2 hover:text-ink"
              }`}
            >
              Все авто
            </button>
            <button
              type="button"
              onClick={() => setTab("premium")}
              aria-pressed={tab === "premium"}
              className={`relative flex items-center gap-2 rounded-full px-5 py-2.5 text-[14.5px] font-extrabold transition-all ${
                tab === "premium"
                  ? "bg-gradient-to-b from-bordeaux-bright to-bordeaux text-white shadow-[0_12px_26px_-10px_rgba(177,31,22,0.95)]"
                  : "text-bordeaux hover:bg-bordeaux/[0.07]"
              }`}
            >
              <Gem className="h-[16px] w-[16px]" />
              Премиум
              {premium.length ? (
                <span
                  className={`font-num text-[12.5px] font-bold ${
                    tab === "premium" ? "text-white/85" : "text-bordeaux/70"
                  }`}
                >
                  {premium.length}
                </span>
              ) : null}
            </button>
          </div>

          {tab === "premium" ? (
            <p className="text-[13.5px] font-semibold text-ink-2">
              Mercedes-Benz, BMW и Audi от{" "}
              {new Intl.NumberFormat("ru-RU").format(PREMIUM_MIN_PRICE)} ₽ под ключ
            </p>
          ) : null}
        </div>

        {list.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-[22px] lg:grid-cols-3 xl:grid-cols-4">
            {list.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-line bg-white px-6 py-14 text-center">
            <p className="text-[17px] font-bold text-ink">
              В премиум-подборке пока пусто
            </p>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-2">
              Привезём Mercedes-Benz, BMW или Audi под заказ — оставьте заявку,
              рассчитаем стоимость под ключ.
            </p>
            <button
              type="button"
              onClick={() => setTab("all")}
              className="btn btn-primary mt-5 !h-11 !px-6 text-[14px]"
            >
              Смотреть все авто
            </button>
          </div>
        )}

        {source.length > list.length ? (
          <div className="mt-10 flex justify-center">
            <Link to={catalogHref} className="btn btn-primary px-8 py-4 text-[15px]">
              Перейти в каталог
              <ArrowRight className="h-[18px] w-[18px]" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Главная маркетинговая страница (грузится отдельным чанком). */
export function Landing() {
  return (
    <main>
      <Hero />

      {/* Последние авто из каталога + переход в полный каталог */}
      <HomeCatalog />

      <BrandTicker />

      {/* Каналы с новыми поступлениями: кнопки и QR для десктопа */}
      <Channels />

      <FinalCta />
    </main>
  );
}
