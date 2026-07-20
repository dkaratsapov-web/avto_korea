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
const ReviewsPage = lazy(() =>
  import("@/components/pages/ReviewsPage").then((m) => ({ default: m.ReviewsPage })),
);
const ContactsPage = lazy(() =>
  import("@/components/pages/ContactsPage").then((m) => ({ default: m.ContactsPage })),
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
const PrivacyPolicyPage = lazy(() =>
  import("@/components/pages/LegalPage").then((m) => ({
    default: m.PrivacyPolicyPage,
  })),
);
const ConsentPage = lazy(() =>
  import("@/components/pages/LegalPage").then((m) => ({
    default: m.ConsentPage,
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
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:slug" element={<ArticlePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/consent" element={<ConsentPage />} />
          </Route>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/tma" element={<TmaApp />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
