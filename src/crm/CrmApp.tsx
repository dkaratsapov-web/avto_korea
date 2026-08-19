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
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8]">
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
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Routes>
    </Layout>
  );
}

export function CrmApp() {
  useNoIndex();

  return (
    <div className="crm min-h-screen bg-[#f4f6f8] text-[#111827]">
      <ToastProvider>
        <Routes>
          {/* Публичные экраны — до проверки входа. */}
          <Route path="track/:token" element={<Track />} />
          <Route path="print/:id/:kind" element={<PrintGuarded />} />
          <Route path="*" element={<AuthProvider><Guarded /></AuthProvider>} />
        </Routes>
      </ToastProvider>
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
