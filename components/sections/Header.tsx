"use client";

import { useEffect, useState } from "react";
import {
  Menu,
  X,
  Send,
  Phone,
  MessageCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { nav, site, countries } from "@/lib/site";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("");

  // Сжатие шапки при скролле
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Подсветка активной секции (scroll-spy)
  useEffect(() => {
    const ids = nav.map((n) => n.href.slice(1));
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-40">
      {/* Верхний инфо-бар — схлопывается при скролле */}
      <div
        className={`hidden overflow-hidden border-b border-line-dark bg-graphite-2 text-[12.5px] text-[#9AA4B2] transition-all duration-300 md:block ${
          scrolled ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
        }`}
      >
        <div className="wrap flex h-9 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-[0.1em] text-steel">
              Возим из:
            </span>
            <span className="flex items-center gap-2">
              {Object.values(countries).map((c) => (
                <span key={c.label} title={c.label} className="text-[14px]">
                  {c.flag}
                </span>
              ))}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-steel" /> Ежедневно 9:00–21:00
            </span>
            <a
              href={site.telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Send className="h-3.5 w-3.5 text-steel" /> Telegram
            </a>
            <a
              href={site.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5 text-steel" /> WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Основная панель */}
      <div
        className={`border-b border-line-dark bg-graphite/[0.82] backdrop-blur-[12px] transition-shadow duration-300 ${
          scrolled ? "shadow-[0_10px_30px_rgba(0,0,0,.35)]" : ""
        }`}
      >
        <div
          className={`wrap flex items-center gap-7 transition-[height] duration-300 ${
            scrolled ? "h-[60px]" : "h-[74px]"
          }`}
        >
          <Logo />

          <nav
            className="ml-3 hidden items-center gap-1 lg:flex"
            aria-label="Основная навигация"
          >
            {nav.map((item) => {
              const isActive = active === item.href.slice(1);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "true" : undefined}
                  className={`group relative px-3 py-2 text-[15px] font-semibold transition-colors ${
                    isActive ? "text-white" : "text-[#C3CBD2] hover:text-white"
                  }`}
                >
                  {item.label}
                  {/* фирменный «росчерк»-индикатор */}
                  <span
                    className={`pointer-events-none absolute -bottom-0.5 left-3 h-[3px] -skew-x-12 rounded-sm bg-gradient-to-r from-bordeaux-deep to-bordeaux-bright transition-all duration-200 ${
                      isActive
                        ? "w-[calc(100%-1.5rem)] opacity-100"
                        : "w-0 opacity-0 group-hover:w-[calc(100%-1.5rem)] group-hover:opacity-100"
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            {/* Телефон с подписью */}
            <a
              href={site.phoneHref}
              className="hidden flex-col items-end leading-none md:flex"
            >
              <span className="flex items-center gap-1.5 font-num text-[17px] font-bold tracking-[0.02em] text-white transition-colors hover:text-chrome">
                <Phone className="h-3.5 w-3.5 text-bordeaux-bright" />
                {site.phone}
              </span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-steel">
                перезвоним за 15 мин
              </span>
            </a>

            <span className="hidden h-8 w-px bg-line-dark lg:block" aria-hidden />

            <Button
              href="#hero-form"
              variant="primary"
              className="max-sm:hidden"
            >
              Рассчитать авто
              <ArrowRight className="h-[18px] w-[18px]" />
            </Button>

            <a
              href={site.telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Написать в Telegram"
              className="hidden h-11 w-11 items-center justify-center rounded-btn border border-line-dark text-chrome transition-colors hover:border-chrome hover:bg-white/5 hover:text-white sm:flex"
            >
              <Send className="h-5 w-5" />
            </a>

            <button
              type="button"
              aria-label={open ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center text-white lg:hidden"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* хром-хейрлайн снизу */}
        <div className="chrome-line opacity-60" />
      </div>

      {/* Mobile menu */}
      {open ? (
        <div className="border-b border-line-dark bg-graphite lg:hidden">
          <nav
            className="wrap flex flex-col gap-1 py-4"
            aria-label="Мобильная навигация"
          >
            {nav.map((item) => {
              const isActive = active === item.href.slice(1);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-btn px-3 py-3 text-[16px] font-semibold transition-colors ${
                    isActive
                      ? "bg-white/5 text-white"
                      : "text-[#C3CBD2] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span
                    className={`h-4 w-[3px] -skew-x-12 rounded-sm bg-gradient-to-b from-bordeaux-deep to-bordeaux-bright transition-opacity ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden
                  />
                  {item.label}
                </a>
              );
            })}

            <div className="mt-2 flex items-center gap-3 border-t border-line-dark px-3 pt-4">
              <a
                href={site.telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-11 w-11 items-center justify-center rounded-btn border border-line-dark text-chrome transition-colors hover:text-white"
              >
                <Send className="h-5 w-5" />
              </a>
              <a
                href={site.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-11 w-11 items-center justify-center rounded-btn border border-line-dark text-chrome transition-colors hover:text-white"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a
                href={site.phoneHref}
                className="font-num text-[17px] font-bold text-white"
              >
                {site.phone}
              </a>
            </div>

            <Button
              href="#hero-form"
              variant="primary"
              onClick={() => setOpen(false)}
              className="mt-3 w-full"
            >
              Рассчитать авто
              <ArrowRight className="h-[18px] w-[18px]" />
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
