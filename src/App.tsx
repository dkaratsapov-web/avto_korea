import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/Toaster";

// Каждая зона приложения — отдельный чанк. Мини-апп (/tma) не тянет код сайта.
const SiteLayout = lazy(() =>
  import("@/components/SiteLayout").then((m) => ({ default: m.SiteLayout })),
);
const Landing = lazy(() =>
  import("@/components/pages/Landing").then((m) => ({ default: m.Landing })),
);
const CatalogPage = lazy(() =>
  import("@/components/pages/CatalogPage").then((m) => ({
    default: m.CatalogPage,
  })),
);
const AboutPage = lazy(() =>
  import("@/components/pages/AboutPage").then((m) => ({ default: m.AboutPage })),
);
const ArticlesPage = lazy(() =>
  import("@/components/pages/ArticlesPage").then((m) => ({
    default: m.ArticlesPage,
  })),
);
const ArticlePage = lazy(() =>
  import("@/components/pages/ArticlePage").then((m) => ({
    default: m.ArticlePage,
  })),
);
const AdminPage = lazy(() =>
  import("@/components/pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const TmaApp = lazy(() =>
  import("@/components/pages/TmaApp").then((m) => ({ default: m.TmaApp })),
);

function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
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
            <Route path="/about" element={<AboutPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:slug" element={<ArticlePage />} />
          </Route>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/tma" element={<TmaApp />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
