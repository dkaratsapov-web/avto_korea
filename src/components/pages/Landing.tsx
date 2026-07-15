import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/sections/Hero";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { BrandTicker } from "@/components/sections/BrandTicker";
import { Stats } from "@/components/sections/Stats";
import { Advantages } from "@/components/sections/Advantages";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Calculator } from "@/components/sections/Calculator";
import { Credit } from "@/components/sections/Credit";
import { Geography } from "@/components/sections/Geography";
import { Reviews } from "@/components/sections/Reviews";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";

/** Главная маркетинговая страница (грузится отдельным чанком). */
export function Landing() {
  return (
    <main>
      <Hero />

      {/* Каталог с полными фильтрами — сразу под hero */}
      <section id="catalog" className="scroll-mt-20 bg-paper pt-8">
        <div className="mx-auto w-full max-w-[1600px] px-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
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
        </div>
        <CatalogBrowser />
      </section>

      <BrandTicker />
      <Stats />
      <Advantages />
      <HowItWorks />
      <Calculator />
      <Credit />
      <Geography />
      <Reviews />
      <Faq />
      <FinalCta />
    </main>
  );
}
