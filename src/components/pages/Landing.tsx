import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Hero } from "@/components/sections/Hero";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { BrandTicker } from "@/components/sections/BrandTicker";
import { FinalCta } from "@/components/sections/FinalCta";

// Каталог на главной: закреплённый заголовок + липкие фильтр-табы (внутри
// CatalogBrowser). --cat-extra резервирует место под заголовок, чтобы
// фильтры парковались точно под ним.
function HomeCatalog() {
  return (
    <section
      id="catalog"
      className="scroll-mt-20 bg-paper pt-8"
      style={{ "--cat-extra": "52px" } as CSSProperties}
    >
      <div
        className="sticky z-40 border-b border-line bg-paper/95 backdrop-blur"
        style={{ top: "var(--header-h, 96px)" }}
      >
        <div className="mx-auto flex w-full max-w-[1760px] items-center justify-between gap-3 px-6 py-2.5">
          <h2 className="text-[clamp(20px,2.4vw,30px)] font-extrabold uppercase leading-none text-ink">
            Каталог автомобилей
          </h2>
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 whitespace-nowrap text-[14px] font-bold text-bordeaux transition-colors hover:text-bordeaux-bright"
          >
            Открыть весь каталог
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <CatalogBrowser />
    </section>
  );
}

/** Главная маркетинговая страница (грузится отдельным чанком). */
export function Landing() {
  return (
    <main>
      <Hero />

      {/* Каталог с закреплёнными заголовком и фильтрами */}
      <HomeCatalog />

      <BrandTicker />
      <FinalCta />
    </main>
  );
}
