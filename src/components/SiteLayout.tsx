import { useEffect, useState, lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { FloatingMessengers } from "@/components/FloatingMessengers";
import { FloatingCall } from "@/components/FloatingCall";
import { QuizFab } from "@/components/QuizFab";
import { CompareTray } from "@/components/CompareTray";
import { CookieNotice } from "@/components/CookieNotice";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { CursorGlow } from "@/components/ui/CursorGlow";
import { ModalHost } from "@/components/ModalHost";
import { LeadCatcher } from "@/components/LeadCatcher";
import { willShowIntro } from "@/lib/intro";

const Preloader = lazy(() =>
  import("@/components/Preloader").then((m) => ({ default: m.Preloader })),
);

/** Маркетинговая обёртка сайта: прелоадер, шапка, футер, декор, модалки. */
export function SiteLayout() {
  // Условие одно на весь сайт (см. src/lib/intro.ts): по нему же заставка из
  // разметки решает, показывать ли логотип или остаться пустым фоном.
  const [intro, setIntro] = useState(willShowIntro);

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
      <QuizFab />
      <FloatingCall />
      <FloatingMessengers />
      <CompareTray />
      <CookieNotice />
      <ModalHost />
      <LeadCatcher />
    </>
  );
}
