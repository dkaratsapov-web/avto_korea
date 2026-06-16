import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { BrandTicker } from "@/components/sections/BrandTicker";
import { Stats } from "@/components/sections/Stats";
import { Advantages } from "@/components/sections/Advantages";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Catalog } from "@/components/sections/Catalog";
import { Calculator } from "@/components/sections/Calculator";
import { Geography } from "@/components/sections/Geography";
import { Reviews } from "@/components/sections/Reviews";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/sections/Footer";
import { FloatingTelegram } from "@/components/FloatingTelegram";
import { Toaster } from "@/components/ui/Toaster";
import { ScrollProgress } from "@/components/ui/ScrollProgress";

export function App() {
  return (
    <>
      <ScrollProgress />
      <Header />
      <main>
        <Hero />
        <BrandTicker />
        <Stats />
        <Advantages />
        <HowItWorks />
        <Catalog />
        <Calculator />
        <Geography />
        <Reviews />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <FloatingTelegram />
      <Toaster />
    </>
  );
}
