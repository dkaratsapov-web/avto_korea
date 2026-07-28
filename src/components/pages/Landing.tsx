import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/sections/Hero";
import { CarCard } from "@/components/CarCard";
import { useCars } from "@/lib/carsStore";
import { BrandTicker } from "@/components/sections/BrandTicker";
import { Advantages } from "@/components/sections/Advantages";
import { Office } from "@/components/sections/Office";
import { FinalCta } from "@/components/sections/FinalCta";

// Превью каталога на главной: последние авто (до 4 рядов по 4) + переход
// на полную страницу каталога с фильтрами.
function CatalogPreview() {
  const { cars } = useCars();
  const latest = cars.slice(0, 16);
  return (
    <section id="catalog" className="scroll-mt-20 bg-paper py-10">
      <div className="mx-auto w-full max-w-[1760px] px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[clamp(24px,3vw,36px)] font-extrabold uppercase text-ink">
            Каталог автомобилей
          </h2>
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 text-[14px] font-bold text-bordeaux transition-colors hover:text-bordeaux-bright"
          >
            Открыть весь каталог
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {latest.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>

        <div className="mt-9 flex justify-center">
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-7 py-3.5 text-[15px] font-extrabold uppercase tracking-[0.02em] text-white shadow-[0_10px_26px_-10px_rgba(122,20,16,.6)] transition-transform hover:scale-[1.03]"
          >
            Смотреть полный каталог
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Главная маркетинговая страница (грузится отдельным чанком). */
export function Landing() {
  return (
    <main>
      <Hero />

      {/* Превью каталога: последние авто (4 ряда) + переход в полный каталог */}
      <CatalogPreview />

      <BrandTicker />
      <Advantages />
      <Office />
      <FinalCta />
    </main>
  );
}
