/**
 * Каркас CRM: шапка с навигацией и полем контента.
 *
 * Разделы «Сотрудники» и «Реквизиты» видит только владелец — не потому, что
 * менеджеру там опасно, а потому, что лишние пункты в меню отвлекают от работы.
 * Настоящее ограничение стоит на сервере.
 */

import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { BarChart3, Building2, KanbanSquare, ListTodo, LogOut, Menu, Users2, X } from "lucide-react";
import { useAuth } from "../auth";
import { initials } from "../lib/format";

const NAV = [
  { to: "/crm", label: "Сделки", icon: KanbanSquare, end: true },
  { to: "/crm/tasks", label: "Задачи", icon: ListTodo, end: false },
  { to: "/crm/dashboard", label: "Аналитика", icon: BarChart3, end: false },
];

const OWNER_NAV = [
  { to: "/crm/users", label: "Сотрудники", icon: Users2, end: false },
  { to: "/crm/settings", label: "Реквизиты", icon: Building2, end: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, isOwner, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = isOwner ? [...NAV, ...OWNER_NAV] : NAV;

  const leave = async () => {
    await signOut();
    navigate("/crm");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[#e3e8ee] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1500px] items-center gap-3 px-4">
          <Link to="/crm" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f2937] text-[13px] font-bold text-white">
              Д
            </span>
            <span className="text-[15px] font-bold text-[#111827]">
              CRM <span className="text-[#8a93a0]">ДиАвто69</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors ${
                    isActive
                      ? "bg-[#eef1f5] text-[#111827]"
                      : "text-[#6b7480] hover:bg-[#f4f6f8] hover:text-[#111827]"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/crm/profile"
              title={user?.name ?? ""}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef1f5] text-[12px] font-bold text-[#3c4655] transition-colors hover:bg-[#e2e7ee]"
            >
              {initials(user?.name)}
            </Link>

            <button
              type="button"
              onClick={leave}
              title="Выйти"
              className="hidden rounded-lg p-2 text-[#7b8593] transition-colors hover:bg-[#eef1f5] hover:text-[#111827] md:inline-flex"
            >
              <LogOut className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Меню"
              className="rounded-lg p-2 text-[#3c4655] transition-colors hover:bg-[#eef1f5] md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Мобильное меню: на телефоне пункты не помещаются в строку. */}
        {menuOpen ? (
          <nav className="border-t border-[#eef1f5] bg-white px-4 py-2 md:hidden">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-semibold ${
                    isActive ? "bg-[#eef1f5] text-[#111827]" : "text-[#4b5563]"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={leave}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-semibold text-[#b42318]"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-4 py-5">{children}</main>
    </div>
  );
}

/** Заголовок страницы с необязательной кнопкой действия. */
export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[19px] font-bold text-[#111827]">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13.5px] text-[#6b7480]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
