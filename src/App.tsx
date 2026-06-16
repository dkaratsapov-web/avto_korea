import { useEffect, useState } from "react";
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
import { CursorGlow } from "@/components/ui/CursorGlow";
import { Preloader } from "@/components/Preloader";

export function App() {
  const [intro, setIntro] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (!intro) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [intro]);

  return (
    <>
      {intro ? <Preloader onDone={() => setIntro(false)} /> : null}
      <CursorGlow />
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
