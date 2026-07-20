import { Phone, MessageCircle, Mail, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { CarSilhouette } from "@/components/icons/CarSilhouette";
import { Flag } from "@/components/icons/Flag";
import { nav, site } from "@/lib/site";

export function Footer() {
  return (
    <footer
      id="contacts"
      className="relative scroll-mt-20 overflow-hidden bg-graphite text-[14px] text-[#9AA4B0]"
    >
      <div className="chrome-line absolute inset-x-0 top-0" />
      <CarSilhouette className="pointer-events-none absolute -bottom-4 left-1/2 w-[420px] -translate-x-1/2 opacity-[0.05]" />

      <div className="wrap relative grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo className="h-11 w-auto" />
          <p className="mt-4 flex max-w-xs flex-wrap items-center gap-1.5 text-[14px] leading-relaxed">
            Импорт авто из
            <Flag code="kr" className="h-3.5 w-5" />
            <Flag code="cn" className="h-3.5 w-5" />
            <Flag code="jp" className="h-3.5 w-5" />
            <Flag code="eu" className="h-3.5 w-5" />
            под ключ — реальные цены и честный расчёт без накруток.
          </p>
          <div className="mt-4 flex items-center gap-2 text-[#9AA4B0]">
            <MapPin className="h-4 w-4 text-steel" /> {site.region}
          </div>
        </div>

        <nav aria-label="Навигация в футере">
          <div className="mb-4 font-display text-[15px] uppercase tracking-[0.08em] text-white">
            Навигация
          </div>
          <ul className="space-y-2.5">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className="transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <div className="mb-4 font-display text-[15px] uppercase tracking-[0.08em] text-white">
            Контакты
          </div>
          <ul className="space-y-2.5">
            <li>
              <a
                href={site.phoneHref}
                className="flex items-center gap-2 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4 text-steel" /> {site.phone}
              </a>
            </li>
            <li>
              <a
                href={site.telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-white"
              >
                <TelegramIcon className="h-4 w-4" /> Telegram
              </a>
            </li>
            <li>
              <a
                href={site.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-white"
              >
                <MessageCircle className="h-4 w-4 text-steel" /> WhatsApp
              </a>
            </li>
            <li>
              <a
                href={site.emailHref}
                className="flex items-center gap-2 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 text-steel" /> {site.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="chrome-line opacity-40" />
      <div className="wrap relative py-6 text-[13px]">
        <p className="max-w-4xl text-[12px] leading-relaxed text-[#6f7884]">
          {site.requisites.name} · ИНН {site.requisites.inn} · ОГРНИП{" "}
          {site.requisites.ogrnip}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 ДиАвто69. Импорт авто под ключ.</span>
          <span className="flex items-center gap-3 text-[#6f7884]">
            <Link to="/contacts" className="transition-colors hover:text-chrome">
              Реквизиты
            </Link>
            <Link to="/admin" className="transition-colors hover:text-chrome">
              Админ
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
