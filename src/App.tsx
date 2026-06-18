import { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Outlet, useLocation } from "react-router-dom";
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
import { ModalHost } from "@/components/ModalHost";

const Preloader = lazy(() =>
  import("@/components/Preloader").then((m) => ({ default: m.Preloader })),
);
const CatalogPage = lazy(() =>
  import("@/components/pages/CatalogPage").then((m) => ({
    default: m.CatalogPage,
  })),
);
const AdminPage = lazy(() =>
  import("@/components/pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const TmaApp = lazy(() =>
  import("@/components/pages/TmaApp").then((m) => ({ default: m.TmaApp })),
);

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

/** Маркетинговая обёртка сайта: прелоадер, шапка, футер, декор. */
function SiteLayout() {
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
      {intro ? (
        <Suspense fallback={<div className="fixed inset-0 z-[100] bg-graphite" />}>
          <Preloader onDone={() => setIntro(false)} />
        </Suspense>
      ) : null}
      <CursorGlow />
      <ScrollProgress />
      <Header />
      <Outlet />
      <Footer />
      <FloatingTelegram />
    </>
  );
}

export function App() {
  return (
    <>
      <ScrollManager />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-paper pt-20">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-bordeaux" />
          </div>
        }
      >
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/catalog" element={<CatalogPage />} />
          </Route>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/tma" element={<TmaApp />} />
        </Routes>
      </Suspense>
      <Toaster />
      <ModalHost />
    </>
  );
}
