import { useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Quote,
  Image as ImageIcon,
  Play,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Flag } from "@/components/icons/Flag";
import { countries } from "@/lib/site";

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

export function Reviews() {
  const track = useRef<HTMLDivElement>(null);

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
            title="Реальные кейсы клиентов"
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
          {reviews.map((r) => {
            return (
              <article
                key={r.name + r.car}
                className="flex w-[88%] flex-none snap-start flex-col overflow-hidden rounded-card border border-line bg-white sm:w-[420px]"
              >
                {/* Медиа кейса: фото или видео */}
                <div className="relative aspect-[16/10] overflow-hidden bg-graphite">
                  {r.media ? (
                    // eslint-disable-next-line
                    <img
                      src={r.media}
                      alt={r.car}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(160deg,#232C36,#11151A)]">
                      <div className="flex items-center gap-3 text-chrome/70">
                        <ImageIcon className="h-7 w-7" />
                        <Play className="h-7 w-7" />
                      </div>
                      <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-steel">
                        Фото / видео кейса
                      </span>
                    </div>
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-white/90 px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#1f9d57]">
                    <CheckCircle2 className="h-4 w-4" /> Доставлено
                  </span>
                  <span className="absolute right-3 top-3">
                    <Flag code={r.country} className="h-5 w-7" />
                  </span>
                  {r.video ? (
                    <a
                      href={r.video}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Смотреть видео-отзыв"
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bordeaux/90 text-white shadow-lg transition-transform hover:scale-105">
                        <Play className="h-6 w-6 fill-white" />
                      </span>
                    </a>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-6">
                <Quote className="mb-2 h-6 w-6 text-chrome" />
                <p className="flex-1 text-[15px] leading-relaxed text-ink">
                  {r.text}
                </p>

                <div className="mt-5 border-t border-line pt-4">
                  <div className="font-bold text-ink">{r.name}</div>
                  <div className="text-[13.5px] text-ink-2">
                    {r.city} · {r.car}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="text-[13px] font-semibold text-ink-2">
                      Срок: <span className="font-num text-ink">{r.term}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-2">
                        Под ключ
                      </div>
                      <div className="font-num text-[20px] font-bold text-bordeaux">
                        {r.price}
                      </div>
                    </div>
                  </div>
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
