import { Hero } from "@/components/sections/Hero";
import { BrandTicker } from "@/components/sections/BrandTicker";
import { Stats } from "@/components/sections/Stats";
import { Advantages } from "@/components/sections/Advantages";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Catalog } from "@/components/sections/Catalog";
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
      <BrandTicker />
      <Stats />
      <Advantages />
      <Catalog />
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
