import { useEffect, useState, lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { FloatingTelegram } from "@/components/FloatingTelegram";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { CursorGlow } from "@/components/ui/CursorGlow";
import { ModalHost } from "@/components/ModalHost";

const Preloader = lazy(() =>
  import("@/components/Preloader").then((m) => ({ default: m.Preloader })),
);

/** Маркетинговая обёртка сайта: прелоадер, шапка, футер, декор, модалки. */
export function SiteLayout() {
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
      <ModalHost />
    </>
  );
}
