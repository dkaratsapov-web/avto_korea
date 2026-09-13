import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Quote,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Flag } from "@/components/icons/Flag";
import { countries } from "@/lib/site";
import { fetchReviews, type Review as ApiReview } from "@/lib/api";

type Review = {
  name: string;
  city: string;
  country: keyof typeof countries;
  car: string;
  term: string;
  price: string;
  text: string;
  /** Фото кейса (если есть). TODO: реальные фото/видео доставленных авто. */
  media?: string;
  /** Ссылка на видео-отзыв (если есть). */
  video?: string;
};

// TODO: заменить на реальные отзывы и кейсы заказчика.
const reviews: Review[] = [
  {
    name: "Андрей М.",
    city: "Тверь",
    country: "kr",
    car: "Hyundai Palisade, 2022",
    term: "37 дней",
    price: "4 290 000 ₽",
    text: "Считали при мне, всё разложили по полочкам. Итог совпал с договором до рубля. Машина пришла идеальной.",
  },
  {
    name: "Сергей и Ольга",
    city: "Москва",
    country: "cn",
    car: "Zeekr 001, 2023",
    term: "44 дня",
    price: "4 950 000 ₽",
    text: "Брали электро из Китая, переживали по срокам. Держали в курсе на каждом этапе, привезли как обещали.",
  },
  {
    name: "Дмитрий К.",
    city: "Тверь",
    country: "jp",
    car: "Toyota LC Prado, 2021",
    term: "41 день",
    price: "5 690 000 ₽",
    text: "Проверили историю и состояние до выкупа, скинули видео осмотра. Никаких сюрпризов на таможне.",
  },
  {
    name: "Илья В.",
    city: "Санкт-Петербург",
    country: "eu",
    car: "BMW X5 xDrive40i, 2022",
    term: "52 дня",
    price: "7 250 000 ₽",
    text: "Премиум из Европы под ключ — документы, растаможка, всё аккуратно. Рекомендую за честность в цене.",
  },
];

type Card = {
  key: string;
  name: string;
  text: string;
  media?: string;
  video?: string;
  city?: string;
  car?: string;
  country?: keyof typeof countries;
  term?: string;
  price?: string;
};

export function Reviews() {
  const track = useRef<HTMLDivElement>(null);
  const [remote, setRemote] = useState<ApiReview[] | null>(null);

  useEffect(() => {
    fetchReviews()
      .then((rs) => setRemote(rs))
      .catch(() => {});
  }, []);

  // Если из канала отзывов пришли реальные отзывы — показываем их; иначе
  // остаётся витрина-заглушка с кейсами.
  const cards: Card[] =
    remote && remote.length
      ? remote.map((r) => ({
          key: r.id,
          name: r.name,
          text: r.text,
          // media/video — поля первых записей; у новых всё лежит в images и
          // videos, и брать надо оттуда, иначе отзыв из альбома окажется
          // без единой картинки.
          media: r.images?.[0] || r.media || undefined,
          video: r.videos?.[0] || r.video || undefined,
        }))
      : reviews.map((r) => ({
          key: r.name + r.car,
          name: r.name,
          text: r.text,
          media: r.media,
          video: r.video,
          city: r.city,
          car: r.car,
          country: r.country,
          term: r.term,
          price: r.price,
        }));

  function scrollBy(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <section id="reviews" className="scroll-mt-20 bg-paper py-[88px]">
      <div className="wrap">
        <Reveal className="flex items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Отзывы · Доставили"
            title="Реальные отзывы клиентов"
            description="Авто, маршрут, срок и итоговая цена под ключ — без приукрашиваний."
          />
          <div className="hidden flex-none gap-2 sm:flex">
            <CarouselBtn dir={-1} onClick={() => scrollBy(-1)} />
            <CarouselBtn dir={1} onClick={() => scrollBy(1)} />
          </div>
        </Reveal>

        <div
          ref={track}
          className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((r) => {
            return (
              <article
                key={r.key}
                className="flex w-[88%] flex-none snap-start flex-col overflow-hidden rounded-card border border-line bg-white sm:w-[420px]"
              >
                {/* Медиа кейса: видео (плеер) → фото. Без файлов блока нет:
                    заглушка «Фото / видео кейса» обещала то, чего в отзыве
                    не окажется, и выглядела как несработавшая загрузка. */}
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
                    <img
                      src={r.media}
                      alt={r.car || r.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                  {!r.video ? (
                    <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-white/90 px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#1f9d57]">
                      <CheckCircle2 className="h-4 w-4" /> Доставлено
                    </span>
                  ) : null}
                  {r.country ? (
                    <span className="pointer-events-none absolute right-3 top-3">
                      <Flag code={r.country} className="h-5 w-7" />
                    </span>
                  ) : null}
                </div>
                ) : null}

                <div className="flex flex-1 flex-col p-6">
                {/* У карточки без медиа бейджу негде стоять — он был приклеен
                    к углу фотографии. Возвращаем его в текст. */}
                {!r.video && !r.media ? (
                  <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#1f9d57]">
                    <CheckCircle2 className="h-4 w-4" /> Доставлено
                  </span>
                ) : null}
                <Quote className="mb-2 h-6 w-6 text-chrome" />
                <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-ink">
                  {r.text}
                </p>

                <div className="mt-5 border-t border-line pt-4">
                  <div className="font-bold text-ink">{r.name}</div>
                  {r.city || r.car ? (
                    <div className="text-[13.5px] text-ink-2">
                      {[r.city, r.car].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                  {r.term || r.price ? (
                    <div className="mt-3 flex items-end justify-between gap-3">
                      {r.term ? (
                        <div className="text-[13px] font-semibold text-ink-2">
                          Срок: <span className="font-num text-ink">{r.term}</span>
                        </div>
                      ) : <span />}
                      {r.price ? (
                        <div className="text-right">
                          <div className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-2">
                            Под ключ
                          </div>
                          <div className="font-num text-[20px] font-bold text-bordeaux">
                            {r.price}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CarouselBtn({
  dir,
  onClick,
}: {
  dir: 1 | -1;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? "Следующий отзыв" : "Предыдущий отзыв"}
      className="flex h-11 w-11 items-center justify-center rounded-btn border border-line bg-white text-ink transition-colors hover:border-graphite hover:bg-graphite hover:text-white"
    >
      {dir === 1 ? (
        <ChevronRight className="h-5 w-5" />
      ) : (
        <ChevronLeft className="h-5 w-5" />
      )}
    </button>
  );
}
