import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Menu,
  X,
  BookOpen,
  MapPin,
  Phone,
  ArrowRight,
  Heart,
  Car,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { Button } from "@/components/ui/Button";
import { nav, site } from "@/lib/site";
import { useUI } from "@/lib/ui";
import { GOALS, reachGoal } from "@/lib/metrika";

const capsule = "glass rounded-full shadow-[0_12px_34px_rgba(0,0,0,.4)]";

// Каналы с новыми поступлениями — в шапке и в мобильном меню.
const channels = [
  {
    label: "Telegram",
    href: site.telegramChannelHref,
    goal: GOALS.telegramChannel,
    icon: <TelegramIcon className="h-[17px] w-[17px]" />,
  },
  {
    label: "MAX",
    href: site.maxChannelHref,
    goal: GOALS.maxChannel,
    icon: <MaxIcon className="h-[17px] w-[17px]" />,
  },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { openLead, openFavorites, favCount } = useUI();
  const { pathname } = useLocation();
  // В шапке-капсуле — страницы, кроме тех, что вынесены отдельными кнопками
  // (Каталог и Статьи). «Новости» временно скрыты: раздел ещё не наполнен.
  const pageNav = nav.filter(
    (n) =>
      n.href !== "/catalog" && n.href !== "/articles" && n.href !== "/news",
  );

  const headerRef = useRef<HTMLElement>(null);

  // Реальную высоту шапки отдаём в CSS-переменную, чтобы липкие фильтры
  // каталога парковались точно под ней (шапка меняет высоту).
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${el.offsetHeight}px`,
      );
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);

  const h = "h-[52px]";

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-2 px-3 py-3.5 sm:gap-3 sm:px-6">
        {/* Логотип — только надпись, с белой окантовкой вместо подложки */}
        <div className="flex h-[60px] flex-none items-center">
          <Logo
            variant="wordmark"
            className="logo-outline h-7 w-auto shrink-0 sm:h-9"
          />
        </div>

        {/* Каталог — отдельная яркая кнопка (без анимаций) */}
        <Link
          to="/catalog"
          className={`hidden ${h} items-center gap-2 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-5 font-extrabold uppercase tracking-[0.02em] text-white shadow-[0_8px_22px_rgba(122,20,16,.5)] md:flex`}
        >
          <Car className="h-[18px] w-[18px]" />
          Каталог
        </Link>

        {/* Каналы: свободное место справа от «Каталога». Скрываем раньше
            навигации — на узких экранах каналы есть в мобильном меню. */}
        <div
          className={`${capsule} ${h} hidden items-center gap-1 px-2 xl:flex`}
        >
          {channels.map((c) => (
            <a
              key={c.href}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => reachGoal(c.goal, { place: "Шапка" })}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-[14px] font-semibold text-[#C3CBD2] transition-colors hover:bg-white/10 hover:text-white 2xl:px-3"
            >
              {c.icon}
              {/* До 1536 подписи прячем: с ними шапка не помещалась в строку. */}
              <span className="hidden min-[1700px]:inline">{c.label}</span>
            </a>
          ))}
        </div>

        {/* Капсула: навигация */}
        <nav
          className={`${capsule} ${h} hidden items-center gap-1 px-2 xl:flex`}
          aria-label="Основная навигация"
        >
          {pageNav.map((item, i) => {
            const isActive = pathname === item.href;
            return (
              <span key={item.href} className="flex items-center">
                {i > 0 ? (
                  <span
                    className="mx-0.5 h-3.5 w-[5px] -skew-x-[24deg] rounded-[1px] bg-bordeaux-bright/40"
                    aria-hidden
                  />
                ) : null}
                <Link
                  to={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-[#C3CBD2] hover:text-white"
                  }`}
                >
                  {item.label}
                  {isActive ? (
                    <span
                      className="absolute -bottom-0.5 left-1/2 h-[3px] w-5 -translate-x-1/2 -skew-x-12 rounded-sm bg-gradient-to-r from-bordeaux-deep to-bordeaux-bright"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              </span>
            );
          })}
          <span
            className="mx-0.5 h-3.5 w-[5px] -skew-x-[24deg] rounded-[1px] bg-bordeaux-bright/40"
            aria-hidden
          />
          <Link
            to="/articles"
            className="ml-1 flex items-center gap-1.5 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-3.5 py-2 text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(122,20,16,.45)]"
          >
            <BookOpen className="h-4 w-4" /> Статьи
          </Link>
        </nav>

        {/* Капсула: действия */}
        <div
          className={`${capsule} flex min-h-[52px] items-center gap-1 px-2 py-1.5`}
        >
          <div className="hidden flex-col justify-center gap-[5px] px-3 pt-1 2xl:flex">
            {site.phones.map((p) => (
              <a
                key={p.href}
                href={p.href}
                onClick={() => reachGoal(GOALS.phone, { place: "Шапка" })}
                className="flex items-center gap-2 whitespace-nowrap leading-none transition-colors hover:text-chrome"
              >
                <Phone className="h-[13px] w-[13px] flex-none text-bordeaux-bright" />
                <span className="font-num text-[12.5px] font-bold tracking-[0.01em] text-white">
                  {p.number}
                </span>
                <span className="hidden text-[11px] font-semibold text-[#C3CBD2] min-[1800px]:inline">
                  {p.name} · {p.role}
                </span>
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={openFavorites}
            aria-label="Избранное"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-chrome transition-colors hover:bg-white/10 hover:text-white"
          >
            <Heart className="h-[18px] w-[18px]" />
            {favCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] font-bold text-white">
                {favCount}
              </span>
            ) : null}
          </button>
          {/* На мобильном кнопку не показываем: там есть меню и плавающие
              кнопки подбора и Telegram, круглая стрелка только путала. */}
          <Button
            variant="primary"
            onClick={openLead}
            className="!min-h-0 h-9 rounded-full !px-4 !py-0 text-[14px] max-sm:hidden"
          >
            Рассчитать
            <ArrowRight className="h-[16px] w-[16px]" />
          </Button>
          <button
            type="button"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 xl:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — плавающая капсула под шапкой */}
      {open ? (
        <div className="wrap xl:hidden">
          <nav
            className="glass mt-1 flex flex-col gap-1 rounded-[26px] p-3 shadow-[0_18px_40px_rgba(0,0,0,.45)]"
            aria-label="Мобильная навигация"
          >
            <Link
              to="/catalog"
              onClick={() => setOpen(false)}
              className="mb-1 flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-4 py-3 font-extrabold uppercase tracking-[0.02em] text-white shadow-[0_8px_22px_rgba(122,20,16,.45)]"
            >
              <Car className="h-[18px] w-[18px]" /> Каталог
            </Link>
            {pageNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-full px-4 py-3 text-left text-[16px] font-semibold transition-colors ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-[#C3CBD2] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span
                    className={`h-4 w-[4px] -skew-x-12 rounded-sm bg-gradient-to-b from-bordeaux-deep to-bordeaux-bright transition-opacity ${
                      isActive ? "opacity-100" : "opacity-30"
                    }`}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/articles"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-full px-4 py-3 text-left text-[16px] font-semibold text-bordeaux-bright hover:bg-white/5"
            >
              <BookOpen className="h-[18px] w-[18px]" /> Полезные статьи
            </Link>
            <div className="mt-1 grid grid-cols-2 gap-2 border-t border-line-dark pt-3">
              {channels.map((c) => (
                <a
                  key={c.href}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    reachGoal(c.goal, { place: "Мобильное меню" });
                    setOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 py-3 text-[15px] font-bold text-white transition-colors hover:bg-white/10"
                >
                  {c.icon}
                  {c.label}
                </a>
              ))}
            </div>
            <div className="mt-1 flex flex-col gap-2 border-t border-line-dark px-2 pt-3">
              {site.phones.map((p) => (
                <a
                  key={p.href}
                  href={p.href}
                  className="flex items-start gap-2.5 hover:text-white"
                >
                  <Phone className="h-4 w-4 flex-none translate-y-1 text-bordeaux-bright" />
                  {/* Номер и подпись — в столбик: в одну строку номер
                      переносился посреди цифр. */}
                  <span className="min-w-0">
                    <span className="block whitespace-nowrap font-num text-[17px] font-bold leading-tight text-white">
                      {p.number}
                    </span>
                    <span className="block text-[12px] font-semibold leading-tight text-[#9AA4B2]">
                      {p.name} · {p.role}
                    </span>
                  </span>
                </a>
              ))}
              <div className="mt-1 flex items-center gap-2">
                <a
                  href={site.telegramHref}
                  onClick={() =>
                    reachGoal(GOALS.telegram, { place: "Мобильное меню" })
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Telegram"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line-dark text-chrome hover:text-white"
                >
                  <TelegramIcon className="h-5 w-5" />
                </a>
              </div>
            </div>
            <a
              href={site.mapHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2 pt-2 text-[14px] font-semibold text-[#C3CBD2] hover:text-white"
            >
              <MapPin className="h-4 w-4 text-bordeaux-bright" />{" "}
              {site.addressFull}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
