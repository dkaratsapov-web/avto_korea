import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/sections/Hero";
import { CarCard } from "@/components/CarCard";
import { useCars } from "@/lib/carsStore";
import { BrandTicker } from "@/components/sections/BrandTicker";
import { FinalCta } from "@/components/sections/FinalCta";

// Сколько колонок в сетке на текущей ширине — чтобы показать ровно 5 рядов
// (сетка ниже: 1 / 2 / 3 / 4 колонки на sm / lg / xl).
function useGridColumns() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setCols(w >= 1280 ? 4 : w >= 1024 ? 3 : w >= 640 ? 2 : 1);
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
          <h2 className="rounded-full bg-white px-6 py-3 text-[clamp(20px,2.4vw,30px)] font-extrabold uppercase leading-none text-ink shadow-[0_10px_28px_-18px_rgba(20,25,32,0.55)]">
            Каталог автомобилей
          </h2>
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 text-[14px] font-bold text-bordeaux shadow-[0_10px_28px_-18px_rgba(20,25,32,0.55)] transition-colors hover:text-bordeaux-bright"
          >
            Открыть весь каталог
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
