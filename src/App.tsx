import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Header } from "@/components/sections/Header";
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
import { Footer } from "@/components/sections/Footer";
import { FloatingTelegram } from "@/components/FloatingTelegram";
import { Toaster } from "@/components/ui/Toaster";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { CursorGlow } from "@/components/ui/CursorGlow";
import { Preloader } from "@/components/Preloader";
import { ModalHost } from "@/components/ModalHost";
import { CatalogPage } from "@/components/pages/CatalogPage";

function Landing() {
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

function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export function App() {
  const [intro, setIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;
    return !reduce && !isMobile;
  });

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
      <ScrollManager />
      <CursorGlow />
      <ScrollProgress />
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/catalog" element={<CatalogPage />} />
      </Routes>
      <Footer />
      <FloatingTelegram />
      <Toaster />
      <ModalHost />
    </>
  );
}
