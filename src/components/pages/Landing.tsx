import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/sections/Hero";
import { CarCard } from "@/components/CarCard";
import { useCars } from "@/lib/carsStore";
import { BrandTicker } from "@/components/sections/BrandTicker";
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
  const list = cars.slice(0, cols * ROWS);

  return (
    <section id="catalog" className="scroll-mt-24 bg-paper py-12">
      <div className="wrap">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[clamp(19px,2vw,26px)] font-extrabold uppercase leading-none text-ink">
              Каталог автомобилей
            </h2>
            {cars.length ? (
              <span className="rounded-full border border-line bg-white px-3 py-1 font-num text-[13px] font-bold text-ink-2">
                {cars.length} авто в наличии
              </span>
            ) : null}
          </div>
          <Link
            to="/catalog"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-4 py-2 text-[13.5px] font-bold text-bordeaux transition-colors hover:border-bordeaux/30 hover:text-bordeaux-bright"
          >
            Открыть весь каталог
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-[22px] lg:grid-cols-3 xl:grid-cols-4">
          {list.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>

        {cars.length > list.length ? (
          <div className="mt-10 flex justify-center">
            <Link to="/catalog" className="btn btn-primary px-8 py-4 text-[15px]">
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
      <FinalCta />
    </main>
  );
}
