/**
 * Каркас CRM: шапка с навигацией и полем контента.
 *
 * Разделы «Сотрудники» и «Реквизиты» видит только владелец — не потому, что
 * менеджеру там опасно, а потому, что лишние пункты в меню отвлекают от работы.
 * Настоящее ограничение стоит на сервере.
 */

import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  KanbanSquare,
  ListTodo,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
  Users2,
  X,
} from "lucide-react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
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
      <header className="sticky top-0 z-30 border-b border-crm-line bg-crm-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1720px] items-center gap-3 px-4">
          <Link to="/crm" className="flex flex-none items-center gap-2.5">
            {/* Квадратная иконка, а не овальный логотип: в круглой рамке овал
                дал бы две вложенные окружности и выглядел бы криво. */}
            <img
              src="/favicon-512.png"
              alt="ДиАвто69"
              width={32}
              height={32}
              decoding="async"
              className="h-8 w-8 flex-none rounded-[10px] object-cover shadow-[0_2px_8px_-3px_rgba(0,0,0,.5)]"
            />
            <span className="text-[15px] font-bold tracking-[-0.01em] text-crm-ink">
              CRM <span className="font-semibold text-crm-ink-3">ДиАвто69</span>
            </span>
          </Link>

          <nav className="ml-3 hidden items-center gap-0.5 md:flex">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold transition-colors ${
                    isActive
                      ? "bg-crm-soft text-crm-ink"
                      : "text-crm-ink-2 hover:bg-crm-raise hover:text-crm-ink"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex flex-none items-center gap-1.5">
            <ThemeToggle />

            <Link
              to="/crm/profile"
              title={user?.name ?? ""}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-crm-soft text-[12px] font-bold text-crm-ink-2 transition-colors hover:bg-crm-line hover:text-crm-ink"
            >
              {initials(user?.name)}
            </Link>

            <button
              type="button"
              onClick={leave}
              title="Выйти"
              className="hidden rounded-[10px] p-2 text-crm-ink-3 transition-colors hover:bg-crm-soft hover:text-crm-ink md:inline-flex"
            >
              <LogOut className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Меню"
              aria-expanded={menuOpen}
              className="rounded-[10px] p-2 text-crm-ink-2 transition-colors hover:bg-crm-soft md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Мобильное меню: на телефоне пункты не помещаются в строку. */}
        {menuOpen ? (
          <nav className="border-t border-crm-line bg-crm-surface px-4 py-2 md:hidden">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] font-semibold ${
                    isActive ? "bg-crm-soft text-crm-ink" : "text-crm-ink-2"
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
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-semibold text-crm-danger"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-[1720px] px-4 py-5">{children}</main>
    </div>
  );
}

/**
 * Переключатель темы: система → светлая → тёмная → система.
 *
 * Три состояния, а не два: «как в системе» — не то же самое, что «светлая».
 * Иначе сотрудник, переключивший систему в тёмную вечером, получал бы утром
 * прибитую светлую тему и не понимал, почему CRM больше не слушается.
 */
function ThemeToggle() {
  const { choice, cycle } = useTheme();

  const Icon = choice === "system" ? Monitor : choice === "light" ? Sun : Moon;
  const label =
    choice === "system" ? "Тема: как в системе" : choice === "light" ? "Тема: светлая" : "Тема: тёмная";

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className="rounded-[10px] p-2 text-crm-ink-3 transition-colors hover:bg-crm-soft hover:text-crm-ink"
    >
      <Icon className="h-4 w-4" />
    </button>
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
        <h1 className="text-[20px] font-bold tracking-[-0.015em] text-crm-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13.5px] text-crm-ink-2">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
