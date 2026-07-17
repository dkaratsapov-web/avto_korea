import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Menu,
  X,
  BookOpen,
  MapPin,
  Phone,
  MessageCircle,
  ArrowRight,
  Heart,
  Car,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { Button } from "@/components/ui/Button";
import { Magnetic } from "@/components/ui/Magnetic";
import { nav, site } from "@/lib/site";
import { useUI } from "@/lib/ui";

const capsule =
  "glass rounded-full shadow-[0_12px_34px_rgba(0,0,0,.4)] transition-all duration-300";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { openLead, openFavorites, favCount } = useUI();
  const { pathname } = useLocation();
  // В шапке-капсуле — страницы, кроме тех, что вынесены отдельными кнопками
  // (Каталог и Статьи).
  const pageNav = nav.filter(
    (n) => n.href !== "/catalog" && n.href !== "/articles",
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const h = scrolled ? "h-12" : "h-[52px]";

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`wrap flex items-center gap-3 transition-all duration-300 ${
          scrolled ? "py-2.5" : "py-3.5"
        }`}
      >
        {/* Капсула: логотип — с лёгким наклоном (рваный ритм) */}
        <div
          className={`${capsule} ${h} flex -rotate-1 items-center px-4 hover:rotate-0 sm:px-5`}
          style={{ background: "rgba(206, 214, 221, 0.22)" }}
        >
          <Logo variant="full" className="h-10 w-auto" />
        </div>

        {/* Каталог — отдельная яркая пульсирующая кнопка */}
        <Magnetic strength={0.35} className="hidden md:inline-block">
          <Link
            to="/catalog"
            className={`group relative flex ${h} animate-pulse-glow items-center gap-2 overflow-hidden rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-5 font-extrabold uppercase tracking-[0.02em] text-white shadow-[0_8px_22px_rgba(122,20,16,.5)] transition-transform`}
          >
            <Car className="h-[18px] w-[18px]" />
            Каталог
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>
        </Magnetic>

        {/* Капсула: навигация */}
        <nav
          className={`${capsule} ${h} mx-auto hidden items-center gap-1 px-2 lg:flex`}
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
                  className={`relative rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors ${
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
            className="ml-1 flex items-center gap-1.5 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-3.5 py-2 text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(122,20,16,.45)] transition-transform hover:scale-[1.04]"
          >
            <BookOpen className="h-4 w-4" /> Статьи
          </Link>
        </nav>

        {/* Капсула: действия — наклон в другую сторону */}
        <div
          className={`${capsule} ${h} ml-auto flex rotate-1 items-center gap-1 px-2 hover:rotate-0 lg:ml-0`}
        >
          <span className="hidden items-center gap-1.5 px-3 text-[13px] font-semibold text-[#C3CBD2] 2xl:flex">
            <MapPin className="h-3.5 w-3.5 text-bordeaux-bright" />
            {site.address}
          </span>
          <a
            href={site.phoneHref}
            className="hidden items-center gap-1.5 px-3 font-num text-[15px] font-bold tracking-[0.02em] text-white transition-colors hover:text-chrome xl:flex"
          >
            <Phone className="h-3.5 w-3.5 text-bordeaux-bright" />
            {site.phone}
          </a>
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
          <Magnetic strength={0.4}>
            <Button
              variant="primary"
              onClick={openLead}
              className="!min-h-0 h-9 rounded-full !px-4 !py-0 text-[14px] max-sm:!px-3"
            >
              <span className="max-sm:hidden">Рассчитать</span>
              <ArrowRight className="h-[16px] w-[16px]" />
            </Button>
          </Magnetic>
          <button
            type="button"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — плавающая капсула под шапкой */}
      {open ? (
        <div className="wrap lg:hidden">
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
            <div className="mt-1 flex items-center gap-2 border-t border-line-dark px-2 pt-3">
              <a
                href={site.telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line-dark text-chrome hover:text-white"
              >
                <TelegramIcon className="h-5 w-5" />
              </a>
              <a
                href={site.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line-dark text-chrome hover:text-white"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a
                href={site.phoneHref}
                className="ml-1 font-num text-[16px] font-bold text-white"
              >
                {site.phone}
              </a>
            </div>
            <a
              href={site.mapHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2 pt-2 text-[14px] font-semibold text-[#C3CBD2] hover:text-white"
            >
              <MapPin className="h-4 w-4 text-bordeaux-bright" /> {site.addressFull}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
