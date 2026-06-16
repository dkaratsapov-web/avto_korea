"use client";

import { useEffect, useState } from "react";
import { Menu, X, Send } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { nav, site } from "@/lib/site";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line-dark bg-graphite/[0.86] backdrop-blur-[10px]">
      <div
        className={`wrap flex items-center gap-7 transition-[height] duration-200 ${
          scrolled ? "h-[60px]" : "h-[72px]"
        }`}
      >
        <Logo />

        <nav className="ml-2 hidden gap-[26px] lg:flex" aria-label="Основная навигация">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[15px] font-semibold text-[#C3CBD2] transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-[18px]">
          <a
            href={site.phoneHref}
            className="hidden font-num text-[17px] font-bold tracking-[0.02em] text-white md:block"
          >
            {site.phone}
          </a>
          <Button href="#hero-form" variant="primary" className="max-sm:hidden">
            Рассчитать авто
          </Button>
          <a
            href={site.telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Написать в Telegram"
            className="hidden h-11 w-11 items-center justify-center rounded-btn border border-line-dark text-chrome transition-colors hover:border-chrome hover:text-white sm:flex"
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

      {/* Mobile menu */}
      {open ? (
        <div className="border-t border-line-dark bg-graphite lg:hidden">
          <nav
            className="wrap flex flex-col gap-1 py-4"
            aria-label="Мобильная навигация"
          >
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-btn px-2 py-3 text-[16px] font-semibold text-[#C3CBD2] transition-colors hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <a
              href={site.phoneHref}
              className="px-2 py-3 font-num text-[17px] font-bold text-white"
            >
              {site.phone}
            </a>
            <Button
              href="#hero-form"
              variant="primary"
              onClick={() => setOpen(false)}
              className="mt-2 w-full"
            >
              Рассчитать авто
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
