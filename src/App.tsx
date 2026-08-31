import { useEffect, useRef, lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/Toaster";
import { BootScreen } from "@/components/ui/BootScreen";
import { METRIKA_ID } from "@/lib/metrika";

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
const NewsPage = lazy(() =>
  import("@/components/pages/NewsPage").then((m) => ({ default: m.NewsPage })),
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
const ThanksPage = lazy(() =>
  import("@/components/pages/ThanksPage").then((m) => ({
    default: m.ThanksPage,
  })),
);
const DirectLanding = lazy(() =>
  import("@/components/pages/DirectLanding").then((m) => ({
    default: m.DirectLanding,
  })),
);
const QuizLanding = lazy(() =>
  import("@/components/pages/QuizLanding").then((m) => ({ default: m.QuizLanding })),
);
const BotLanding = lazy(() =>
  import("@/components/pages/BotLanding").then((m) => ({ default: m.BotLanding })),
);
const TelegramLanding = lazy(() =>
  import("@/components/pages/TelegramLanding").then((m) => ({
    default: m.TelegramLanding,
  })),
);
const TmaApp = lazy(() =>
  import("@/components/pages/TmaApp").then((m) => ({ default: m.TmaApp })),
);
// CRM — отдельное направление: свой чанк, свой вход, своё хранилище.
// Код сайта её не тянет, а она не тянет код сайта.
const CrmApp = lazy(() =>
  import("@/crm/CrmApp").then((m) => ({ default: m.CrmApp })),
);

function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

/**
 * Метрика считает переход по SPA-маршруту только по явному хиту: сам счётчик
 * срабатывает один раз при загрузке документа. Первую загрузку он уже учёл,
 * поэтому отправляем хиты начиная со второго маршрута.
 */
function MetrikaTracker() {
  const { pathname, search } = useLocation();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    // CRM — внутренний раздел: её переходы не должны попадать в статистику
    // сайта и портить отчёты по рекламе.
    if (pathname.startsWith("/crm")) return;

    const url = window.location.origin + pathname + search;
    if (prev.current === null) {
      prev.current = url;
      return;
    }
    const referer = prev.current;
    prev.current = url;
    const ym = (window as unknown as { ym?: (...a: unknown[]) => void }).ym;
    ym?.(METRIKA_ID, "hit", url, { referer });
  }, [pathname, search]);

  return null;
}

export function App() {
  return (
    <>
      <ScrollManager />
      <MetrikaTracker />
      <Suspense
        fallback={
          /* Тот же экран, что и заставка в разметке: на внутренних стилях,
             поэтому виден даже до загрузки файла со стилями. */
          <BootScreen />
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
            <Route path="/news" element={<NewsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/consent" element={<ConsentPage />} />
            {/* Страница после отправки заявки — цель для Метрики и Директа */}
            <Route path="/thanks" element={<ThanksPage />} />
          </Route>
          {/* Посадочная под Директ — вне общего каркаса сайта */}
          <Route path="/go" element={<DirectLanding />} />
          {/* Посадочная только под Telegram-канал, свёрстана как сам Telegram */}
          <Route path="/tg" element={<TelegramLanding />} />
          {/* Прокладка в бота: ?v=a — со стеной подписки, ?v=b — без неё */}
          <Route path="/bot" element={<BotLanding />} />
          {/* Посадочная с квизом под Директ */}
          <Route path="/quiz" element={<QuizLanding />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/tma" element={<TmaApp />} />
          {/* CRM со своими доступами — не пересекается ни с сайтом, ни с ботом */}
          <Route path="/crm/*" element={<CrmApp />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
