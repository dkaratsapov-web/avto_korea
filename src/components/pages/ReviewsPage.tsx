import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, CheckCircle2, Quote, Star, ExternalLink } from "lucide-react";
import { Flag } from "@/components/icons/Flag";
import { LeadForm } from "@/components/LeadForm";
import { countries, site } from "@/lib/site";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { fetchReviews, type Review as ApiReview } from "@/lib/api";

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

type Case = {
  name: string;
  city: string;
  country: keyof typeof countries;
  car: string;
  term: string;
  price: string;
  text: string;
};

// TODO: заменить на реальные отзывы и кейсы заказчика (можно с фото/видео).
const cases: Case[] = [
  { name: "Андрей М.", city: "Тверь", country: "kr", car: "Hyundai Palisade, 2022", term: "37 дней", price: "4 290 000 ₽", text: "Считали при мне, всё разложили по полочкам. Итог совпал с договором до рубля. Машина пришла идеальной." },
  { name: "Сергей и Ольга", city: "Москва", country: "cn", car: "Zeekr 001, 2023", term: "от 25 дней", price: "4 950 000 ₽", text: "Брали электро из Китая, переживали по срокам. Держали в курсе на каждом этапе, привезли как обещали." },
  { name: "Дмитрий К.", city: "Тверь", country: "jp", car: "Toyota LC Prado, 2021", term: "41 день", price: "5 690 000 ₽", text: "Проверили историю и состояние до выкупа, скинули видео осмотра. Никаких сюрпризов на таможне." },
  { name: "Илья В.", city: "Санкт-Петербург", country: "eu", car: "BMW X5 xDrive40i, 2022", term: "52 дня", price: "7 250 000 ₽", text: "Премиум из Европы под ключ — документы, растаможка, всё аккуратно. Рекомендую за честность в цене." },
  { name: "Марина Т.", city: "Тверь", country: "kr", car: "Kia Sportage, 2023", term: "от 25 дней", price: "3 150 000 ₽", text: "Первый раз пригоняла авто из-за границы, боялась. Всё объяснили по шагам, помогли с постановкой на учёт." },
  { name: "Виктор П.", city: "Ярославль", country: "cn", car: "Li L7, 2023", term: "46 дней", price: "5 480 000 ₽", text: "Хотел конкретную комплектацию, которой нет у дилеров. Нашли, привезли, цена без сюрпризов." },
];

export function ReviewsPage() {
  useMeta(
    "Отзывы клиентов ДиАвто69 — реальные кейсы доставки авто",
    "Отзывы и кейсы клиентов ДиАвто69: какие авто привезли под ключ из Кореи, Китая, Японии и ЕС, сроки доставки и итоговые цены. Честно, без приукрашиваний.",
  );

  // Реальные отзывы из Telegram (пересылка владельцем боту / канал отзывов).
  const [remote, setRemote] = useState<ApiReview[] | null>(null);
  useEffect(() => {
    fetchReviews().then(setRemote).catch(() => {});
  }, []);
  const hasRemote = remote && remote.length > 0;

  return (
    <main className="bg-paper pb-[96px]">
      <section className="relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-8 pt-[104px] text-white">
        <HeroBackdrop />
        <div className="wrap relative">
          <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">Отзывы</span>
          </nav>
          <div className="mb-2 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <Star className="h-4 w-4" /> Отзывы · Доставили
          </div>
          <h1 className="text-[clamp(28px,3.6vw,46px)] leading-[1.05] text-shine">
            Реальные кейсы наших клиентов
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-[#C7CFD6]">
            Авто, маршрут, срок и итоговая цена под ключ — без приукрашиваний.
            <span className="mt-1 block text-[13px] text-[#8C97A1]">
              [ЗАГЛУШКА: заменим на реальные отзывы, добавим фото и видео
              доставленных авто.]
            </span>
          </p>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      {/* Отзывы и оценка в 2ГИС */}
      <section className="wrap mt-10">
        <div className="flex flex-col gap-5 rounded-card border border-line bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[16px] bg-[#00a651] font-display text-[15px] font-extrabold text-white">
              2ГИС
            </span>
            <div>
              <h2 className="text-[19px] font-extrabold text-ink">Мы на 2ГИС</h2>
              <p className="mt-0.5 max-w-md text-[13.5px] leading-snug text-ink-2">
                Читайте реальные отзывы клиентов и оценку компании в справочнике
                2ГИС — и оставьте свой после сделки.
              </p>
            </div>
          </div>
          <div className="flex flex-none flex-wrap gap-2.5">
            <a
              href={site.map2gisHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <ExternalLink className="h-[18px] w-[18px]" /> Смотреть отзывы
            </a>
            <a
              href={site.map2gisHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn border border-line text-ink hover:bg-paper"
            >
              Оставить отзыв
            </a>
          </div>
        </div>
        {/* Слот под живой виджет отзывов 2ГИС — вставим код агрегатора при подключении. */}
        <div id="reviews-2gis-widget" className="mt-4 empty:hidden" />
      </section>

      {hasRemote ? (
        <div className="wrap mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {remote!.map((r) => (
            <article key={r.id} className="flex flex-col overflow-hidden rounded-card border border-line bg-white">
              {r.video || r.media ? (
                <div className="relative aspect-[16/10] overflow-hidden bg-graphite">
                  {r.video ? (
                    <video
                      src={r.video}
                      poster={r.media}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full bg-black object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line
                    <img src={r.media} alt={r.name} loading="lazy" className="h-full w-full object-cover" />
                  )}
                  <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-white/90 px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#1f9d57]">
                    <CheckCircle2 className="h-4 w-4" /> Доставлено
                  </span>
                </div>
              ) : null}
              <div className="flex flex-1 flex-col p-6">
                <Quote className="mb-2 h-6 w-6 text-chrome" />
                <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-ink">{r.text}</p>
                <div className="mt-5 border-t border-line pt-4 font-bold text-ink">{r.name}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="wrap mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((r) => (
            <article key={r.name + r.car} className="flex flex-col rounded-card border border-line bg-white p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#1f9d57]">
                  <CheckCircle2 className="h-4 w-4" /> Доставлено
                </span>
                <Flag code={r.country} className="h-5 w-7" />
              </div>
              <Quote className="mb-2 h-6 w-6 text-chrome" />
              <p className="flex-1 text-[15px] leading-relaxed text-ink">{r.text}</p>
              <div className="mt-5 border-t border-line pt-4">
                <div className="font-bold text-ink">{r.name}</div>
                <div className="text-[13.5px] text-ink-2">{r.city} · {r.car}</div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-[13px] font-semibold text-ink-2">
                    Срок: <span className="font-num text-ink">{r.term}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-2">Под ключ</div>
                    <div className="font-num text-[20px] font-bold text-bordeaux">{r.price}</div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="wrap mt-14">
        <div className="rounded-card border border-line bg-graphite p-6 text-white sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="lg:max-w-sm">
              <h2 className="text-[24px] font-extrabold uppercase text-white">Станьте следующим кейсом</h2>
              <p className="mt-2 text-[14px] text-[#9AA4B2]">
                Оставьте заявку — подберём авто под ваш бюджет и посчитаем честную
                цену под ключ.
              </p>
            </div>
            <div className="w-full lg:max-w-xl">
              <LeadForm source="Страница «Отзывы»" submitLabel="Получить расчёт" withCar={false} withContacts bare />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
