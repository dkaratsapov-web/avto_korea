/**
 * Корень CRM.
 *
 * Отдельное направление внутри проекта: свой маршрут /crm/*, свой чанк, свой
 * вход. Каркас сайта, каталог, счётчики и состояние витрины сюда не тянутся —
 * общий у них только сборщик.
 *
 * Единственный публичный экран — отслеживание заказа по ссылке: он должен
 * открываться клиенту без входа, поэтому проверяется до всего остального.
 */

import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { ThemeProvider, themeAttribute, useTheme } from "./theme";
import { Spinner, ToastProvider } from "./ui";
import { Layout } from "./screens/Layout";
import { Login } from "./screens/Login";
import { Board } from "./screens/Board";
import { DealPage } from "./screens/DealPage";
import { DealEditor } from "./screens/DealEditor";
import { Tasks } from "./screens/Tasks";
import { Dashboard } from "./screens/Dashboard";
import { Users } from "./screens/Users";
import { SettingsPage } from "./screens/SettingsPage";
import { Reviews } from "./screens/Reviews";
import { BotAdmin } from "./screens/BotAdmin";
import { Backups } from "./screens/Backups";
import { Profile } from "./screens/Profile";
import { PrintPage } from "./screens/PrintPage";
import { Track } from "./screens/Track";

/** Закрывает CRM от индексации: внутренний раздел в поиске не нужен. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

function Guarded() {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.title = "CRM ДиАвто69";
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-crm-bg">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes location={location}>
        <Route index element={<Board />} />
        <Route path="deals/new" element={<DealEditor />} />
        <Route path="deals/:id/edit" element={<DealEditor />} />
        <Route path="deals/:id" element={<DealPage />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="bot" element={<BotAdmin />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="backup" element={<Backups />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Routes>
    </Layout>
  );
}

export function CrmApp() {
  useNoIndex();

  return (
    <ThemeProvider>
      <ThemedRoot>
        <ToastProvider>
          <Routes>
            {/* Публичные экраны — до проверки входа. */}
            <Route path="track/:token" element={<Track />} />
            <Route path="print/:id/:kind" element={<PrintGuarded />} />
            <Route path="*" element={<AuthProvider><Guarded /></AuthProvider>} />
          </Routes>
        </ToastProvider>
      </ThemedRoot>
    </ThemeProvider>
  );
}

/**
 * Корень CRM с проставленной темой.
 *
 * Атрибут вешается только при явном выборе: без него работает системная
 * настройка. Заодно на время жизни CRM подкрашиваем фон самой страницы —
 * иначе при прокрутке за пределы содержимого из-под тёмного интерфейса
 * проглядывал бы светлый фон сайта.
 */
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { choice, resolved } = useTheme();

  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = resolved === "dark" ? "#0c1015" : "#f4f6f9";
    return () => {
      document.body.style.backgroundColor = previous;
    };
  }, [resolved]);

  return (
    <div className="crm min-h-screen bg-crm-bg text-crm-ink" data-crm-theme={themeAttribute(choice)}>
      {children}
    </div>
  );
}

/** Печатная форма требует входа, но обходится без общего каркаса и навигации. */
function PrintGuarded() {
  return (
    <AuthProvider>
      <PrintGate />
    </AuthProvider>
  );
}

function PrintGate() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Login />;
  return <PrintPage />;
}
