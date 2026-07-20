import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, MessageCircle, Mail, MapPin, Clock } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { LeadForm } from "@/components/LeadForm";
import { site } from "@/lib/site";

function useMeta(title: string, description: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    const tag = document.querySelector('meta[name="description"]');
    const prevDesc = tag?.getAttribute("content") ?? "";
    if (tag) tag.setAttribute("content", description);
    return () => {
      document.title = prev;
      if (tag) tag.setAttribute("content", prevDesc);
    };
  }, [title, description]);
}

export function ContactsPage() {
  useMeta(
    "Контакты ДиАвто69 — импорт авто под ключ в Твери",
    "Свяжитесь с ДиАвто69: телефон, Telegram, WhatsApp, e-mail. Импорт авто из Кореи, Китая, Японии и ЕС под ключ. Тверь, 69 регион.",
  );

  const contacts = [
    { icon: <Phone className="h-5 w-5" />, label: "Телефон", value: site.phone, href: site.phoneHref },
    { icon: <TelegramIcon className="h-5 w-5" />, label: "Telegram", value: site.telegram, href: site.telegramHref, ext: true },
    { icon: <MessageCircle className="h-5 w-5 text-[#25D366]" />, label: "WhatsApp", value: "Написать в WhatsApp", href: site.whatsappHref, ext: true },
    { icon: <Mail className="h-5 w-5" />, label: "E-mail", value: site.email, href: site.emailHref },
  ];

  return (
    <main className="bg-paper pb-[96px]">
      <section className="grain relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-8 pt-[104px] text-white">
        <div className="wrap relative">
          <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">Контакты</span>
          </nav>
          <div className="mb-2 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <span className="slash" aria-hidden /> Контакты
          </div>
          <h1 className="text-[clamp(28px,3.6vw,46px)] leading-[1.05] text-shine">
            Свяжитесь с нами
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-[#C7CFD6]">
            Ответим на вопросы, посчитаем стоимость под ключ и поможем с подбором.
            Пишите в удобный мессенджер или оставьте заявку — перезвоним в течение
            15 минут.
          </p>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      <div className="wrap mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* Контакты + инфо */}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.ext ? "_blank" : undefined}
                rel={c.ext ? "noopener noreferrer" : undefined}
                className="flex items-center gap-3 rounded-card border border-line bg-white p-4 transition-shadow hover:shadow-card"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-graphite text-chrome">
                  {c.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold uppercase tracking-wide text-ink-2">{c.label}</span>
                  <span className="block truncate font-bold text-ink">{c.value}</span>
                </span>
              </a>
            ))}
          </div>

          <div className="rounded-card border border-line bg-white p-5">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 flex-none text-steel" />
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-2">Адрес</div>
                <div className="font-bold text-ink">{site.addressFull}</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <a
                    href={site.mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-line px-3 py-1 text-[12.5px] font-bold text-ink-2 transition-colors hover:border-steel hover:text-ink"
                  >
                    Яндекс.Карты
                  </a>
                  <a
                    href={site.map2gisHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-line px-3 py-1 text-[12.5px] font-bold text-ink-2 transition-colors hover:border-steel hover:text-ink"
                  >
                    2ГИС
                  </a>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 flex-none text-steel" />
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-2">Часы работы</div>
                <div className="font-bold text-ink">Ежедневно 9:00–21:00</div>
              </div>
            </div>
          </div>

          {/* Карта проезда — Яндекс.Карты */}
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <iframe
              src={site.mapEmbed}
              title="ДиАвто69 на карте — Тверь, ул. Коминтерна, 71"
              className="h-[300px] w-full border-0"
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>

        {/* Форма */}
        <div className="rounded-card border border-line bg-graphite p-6 text-white sm:p-8">
          <h2 className="text-[22px] font-extrabold text-white">Оставить заявку</h2>
          <p className="mb-6 mt-1 text-[14px] text-[#9AA4B2]">
            Заполните, что знаете — остальное уточним. Перезвоним в течение 15 минут.
          </p>
          <LeadForm layout="full" tone="dark" source="Страница «Контакты»" submitLabel="Отправить заявку" />
        </div>
      </div>
    </main>
  );
}
