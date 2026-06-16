import { useEffect, useState } from "react";
import { Menu, X, Send, Phone, MessageCircle, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { nav, site } from "@/lib/site";

const capsule =
  "glass rounded-full shadow-[0_12px_34px_rgba(0,0,0,.4)] transition-all duration-300";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        >
          <Logo />
        </div>

        {/* Капсула: навигация */}
        <nav
          className={`${capsule} ${h} mx-auto hidden items-center gap-1 px-2 lg:flex`}
          aria-label="Основная навигация"
        >
          {nav.map((item, i) => {
            const isActive = active === item.href.slice(1);
            return (
              <span key={item.href} className="flex items-center">
                {i > 0 ? (
                  <span
                    className="mx-0.5 h-3.5 w-[5px] -skew-x-[24deg] rounded-[1px] bg-bordeaux-bright/40"
                    aria-hidden
                  />
                ) : null}
                <a
                  href={item.href}
                  aria-current={isActive ? "true" : undefined}
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
                </a>
              </span>
            );
          })}
        </nav>

        {/* Капсула: действия — наклон в другую сторону */}
        <div
          className={`${capsule} ${h} ml-auto flex rotate-1 items-center gap-1 px-2 hover:rotate-0 lg:ml-0`}
        >
          <a
            href={site.phoneHref}
            className="hidden items-center gap-1.5 px-3 font-num text-[15px] font-bold tracking-[0.02em] text-white transition-colors hover:text-chrome xl:flex"
          >
            <Phone className="h-3.5 w-3.5 text-bordeaux-bright" />
            {site.phone}
          </a>
          <a
            href={site.telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Написать в Telegram"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-chrome transition-colors hover:bg-white/10 hover:text-white sm:flex"
          >
            <Send className="h-[18px] w-[18px]" />
          </a>
          <Button
            href="#hero-form"
            variant="primary"
            className="!min-h-0 h-9 rounded-full !px-4 !py-0 text-[14px] max-sm:!px-3"
          >
            <span className="max-sm:hidden">Рассчитать</span>
            <ArrowRight className="h-[16px] w-[16px]" />
          </Button>
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
            {nav.map((item) => {
              const isActive = active === item.href.slice(1);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-full px-4 py-3 text-[16px] font-semibold transition-colors ${
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
                </a>
              );
            })}
            <div className="mt-1 flex items-center gap-2 border-t border-line-dark px-2 pt-3">
              <a
                href={site.telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line-dark text-chrome hover:text-white"
              >
                <Send className="h-5 w-5" />
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
          </nav>
        </div>
      ) : null}
    </header>
  );
}
