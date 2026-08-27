import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Quote,
  Star,
  Play,
  ExternalLink,
} from "lucide-react";
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

// Горизонтальная лента: стрелки + перетаскивание мышью (на десктопе колесо
// само по себе ленту не листает, поэтому нужны явные элементы управления).
function useDragScroll() {
  // Лента появляется только после загрузки отзывов, поэтому ссылку держим
  // в состоянии: обычный ref остался бы пустым, и обработчики вешать было
  // бы не на что.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => setEl(node), []);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    if (!el) return;
    const sync = () => {
      setAtStart(el.scrollLeft <= 2);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, [el]);

  const scrollByCard = useCallback(
    (dir: 1 | -1) => {
      if (!el) return;
      const card = el.querySelector("article");
      const step = card
        ? card.getBoundingClientRect().width + 20
        : el.clientWidth * 0.8;
      el.scrollBy({ left: dir * step, behavior: "smooth" });
    },
    [el],
  );

  // Перетаскивание мышью. Тач не трогаем — там работает нативный скролл.
  useEffect(() => {
    if (!el) return;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let pointerId = -1;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      // Не мешаем управлению плеером и кнопками внутри карточки.
      if ((e.target as HTMLElement).closest("video, button, a")) return;
      // Без preventDefault браузер начинает выделять текст и тащить картинку.
      e.preventDefault();
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      // Привязка к карточкам возвращала ленту к ближайшей точке на каждом
      // шаге — на время перетаскивания отключаем.
      el.style.scrollSnapType = "none";
      el.classList.add("cursor-grabbing", "select-none");
    };
    const move = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      e.preventDefault();
      el.scrollLeft = startScroll - (e.clientX - startX);
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.scrollSnapType = "";
      el.classList.remove("cursor-grabbing", "select-none");
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [el]);

  return { ref, atStart, atEnd, scrollByCard };
}

type Slide = { type: "video" | "image"; src: string };

/**
 * Заголовок карточки — какое авто выдано. Тексты приходят из Telegram и
 * содержат служебные строки («Клиент: …», «Пришёл по ссылке», приглашение
 * написать менеджеру) — в витрине они лишние, нужна только модель.
 */
function deliveredTitle(text?: string): string {
  const lines = (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Явное «Выдача BMW X4» — берём то, что после слова.
  for (const l of lines) {
    const m = l.match(/выдач[аи]\s*[:—-]?\s*(.+)$/i);
    if (m) {
      const model = m[1].replace(/[«»"']/g, "").trim();
      if (model && model.length <= 60) return model;
    }
  }

  // Иначе — первая строка без служебных пометок и контактов.
  const junk =
    /клиент\s*[:—-]|пришел|пришёл|по\s*ссылке|хотите\s*такой|напишите|подбер[её]м|@[a-z0-9_]/i;
  const first = lines.find((l) => !junk.test(l));
  if (first) {
    const clean = first.replace(/\s+/g, " ").trim();
    return clean.length > 80 ? clean.slice(0, 77) + "…" : clean;
  }
  return "Автомобиль выдан клиенту";
}

/** Все медиа отзыва одним списком: видео вперёд, затем фото. */
function slidesOf(r: ApiReview): Slide[] {
  const videos = r.videos?.length ? r.videos : r.video ? [r.video] : [];
  const images = r.images?.length ? r.images : r.media ? [r.media] : [];
  return [
    ...videos.map((src) => ({ type: "video" as const, src })),
    ...images.map((src) => ({ type: "image" as const, src })),
  ];
}

/** Карточка отзыва: крупное медиа + лента миниатюр, если их несколько. */
function ReviewCard({ review }: { review: ApiReview }) {
  const slides = slidesOf(review);
  const [idx, setIdx] = useState(0);
  const cur = slides[idx] ?? slides[0];
  const poster = review.images?.[0] || review.media;

  // Отзыв без единого файла карточке этого вида не подходит: она на три
  // четверти состоит из медиа-блока, и на его месте оставался огромный
  // пустой прямоугольник. Такие отзывы показываются текстовыми — см. ниже.
  if (!cur) return null;

  return (
    <article className="flex w-[84%] flex-none snap-start flex-col overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_10px_30px_-16px_rgba(20,25,32,0.4)] sm:w-[380px]">
      <div className="relative aspect-[3/4] overflow-hidden bg-graphite">
        {cur.type === "video" ? (
          <video
            key={cur.src}
            src={cur.src}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <img src={cur.src} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-white/90 px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#1f9d57]">
          <CheckCircle2 className="h-4 w-4" /> Доставлено
        </span>
        {slides.length > 1 ? (
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 font-num text-[12px] font-bold text-white">
            {idx + 1}/{slides.length}
          </span>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slides.map((s, i) => (
            <button
              key={s.src + i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Медиа ${i + 1}`}
              className={`relative h-14 w-14 flex-none overflow-hidden rounded-[10px] border transition-colors ${
                i === idx ? "border-bordeaux" : "border-line hover:border-ink/30"
              }`}
            >
              {s.type === "video" ? (
                <>
                  <img
                    src={poster}
                    alt=""
                    loading="lazy"
                    className="h-full w-full bg-graphite object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <Play className="h-4 w-4 text-white" />
                  </span>
                </>
              ) : (
                <img src={s.src} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col justify-center p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2">
          Выдача
        </div>
        <div className="mt-1 text-[17px] font-extrabold leading-tight text-ink">
          {deliveredTitle(review.text)}
        </div>
      </div>
    </article>
  );
}

export function ReviewsPage() {
  useMeta(
    "Отзывы клиентов ДиАвто69 — видео и фото выдач авто",
    "Отзывы и кейсы клиентов ДиАвто69: какие авто привезли под ключ из Кореи, Китая, Японии и ЕС, сроки доставки и итоговые цены. Честно, без приукрашиваний.",
  );

  // Реальные отзывы из Telegram (пересылка владельцем боту / канал отзывов).
  const [remote, setRemote] = useState<ApiReview[] | null>(null);
  useEffect(() => {
    fetchReviews()
      .then((rs) =>
        // Показываем отзыв, только если есть ФОТО или осмысленный текст.
        // Видео без превью и текста (часто битое/тяжёлое) не выводим.
        setRemote(
          rs.filter(
            (r) =>
              r.media ||
              r.images?.length ||
              (r.text || "").trim().length > 2,
          ),
        ),
      )
      .catch(() => {});
  }, []);
  /*
   * Отзывы делятся надвое, и показываются они по-разному.
   *
   * Карточка карусели на три четверти состоит из медиа-блока: он вертикальный,
   * во всю ширину карточки. Отзыву с видео или фото это ровно то, что нужно.
   * А у письменного отзыва файлов нет вовсе — и на месте медиа оставался
   * огромный тёмный прямоугольник, из-за которого блок «Видео-отзывы»
   * выглядел так, будто у него ничего не загрузилось.
   *
   * Поэтому письменные отзывы идут отдельной сеткой текстовых карточек, а в
   * карусель попадают только те, у которых действительно есть что показать.
   */
  const withMedia = (remote ?? []).filter((r) => slidesOf(r).length > 0);
  const textOnly = (remote ?? []).filter(
    (r) => slidesOf(r).length === 0 && (r.text || "").trim().length > 2,
  );
  const hasRemote = withMedia.length > 0 || textOnly.length > 0;
  const rail = useDragScroll();

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
            Отзывы клиентов и выдачи авто
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-[#C7CFD6]">
            Реальные видео и фото выдач автомобилей нашим клиентам — без
            приукрашиваний.
          </p>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      {/* Оценки на внешних площадках: слева площадки, справа живой виджет */}
      <section className="wrap mt-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_560px] lg:items-start">
          <div className="flex flex-col rounded-card border border-line bg-white p-6 sm:p-7">
            <h2 className="text-[clamp(20px,2.4vw,28px)] font-extrabold uppercase leading-tight text-ink">
              Нас оценивают на площадках
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-2">
              Отзывы в справочниках нельзя удалить или подделать — поэтому
              смотреть их стоит именно там. Справа — живая лента из Яндекса,
              ниже — ссылки на обе площадки.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-4 rounded-[16px] border border-line bg-paper p-4">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[#fc3f1d] font-display text-[16px] font-extrabold text-white">
                  Я
                </span>
                <div className="min-w-[120px] flex-1">
                  <div className="text-[15px] font-extrabold text-ink">Яндекс.Карты</div>
                  <div className="text-[13px] text-ink-2">Ди Авто Трейдинг</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={site.yandexReviewsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary !h-10 !px-4 text-[13.5px]"
                  >
                    <ExternalLink className="h-4 w-4" /> Смотреть
                  </a>
                  <a
                    href={site.yandexReviewsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn !h-10 border border-line !px-4 text-[13.5px] text-ink hover:bg-white"
                  >
                    Оставить отзыв
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 rounded-[16px] border border-line bg-paper p-4">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[#00a651] font-display text-[13px] font-extrabold text-white">
                  2ГИС
                </span>
                <div className="min-w-[120px] flex-1">
                  <div className="text-[15px] font-extrabold text-ink">2ГИС</div>
                  <div className="text-[13px] text-ink-2">Карточка компании в Твери</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={site.map2gisHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary !h-10 !px-4 text-[13.5px]"
                  >
                    <ExternalLink className="h-4 w-4" /> Смотреть
                  </a>
                  <a
                    href={site.map2gisHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn !h-10 border border-line !px-4 text-[13.5px] text-ink hover:bg-white"
                  >
                    Оставить отзыв
                  </a>
                </div>
              </div>
            </div>

            {/* Слот под живой виджет 2ГИС, если подключим агрегатор. */}
            <div id="reviews-2gis-widget" className="mt-4 empty:hidden" />
          </div>

          {/* Виджет верстает карточку фиксированной ширины, поэтому колонка
              под него ровно его формата. Внутри список прокручивается. */}
          {site.yandexOrgId ? (
            <iframe
              title="Отзывы о ДиАвто69 на Яндекс.Картах"
              src={`https://yandex.ru/maps-reviews-widget/${site.yandexOrgId}?comments`}
              loading="lazy"
              className="mx-auto h-[620px] w-full max-w-[560px] rounded-card border border-line"
            />
          ) : null}
        </div>
      </section>

      {withMedia.length ? (
        <section className="mt-12">
          <div className="wrap mb-4 flex items-end justify-between gap-3">
            <h2 className="text-[clamp(20px,2.6vw,30px)] font-extrabold uppercase text-ink">
              Видео-отзывы клиентов
            </h2>
            <div className="hidden flex-none items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => rail.scrollByCard(-1)}
                aria-label="Предыдущие отзывы"
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition-all hover:border-ink/30 hover:bg-paper ${
                  rail.atStart ? "opacity-40" : ""
                }`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => rail.scrollByCard(1)}
                aria-label="Следующие отзывы"
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition-all hover:border-ink/30 hover:bg-paper ${
                  rail.atEnd ? "opacity-40" : ""
                }`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          {/* Крупные карточки с горизонтальным скроллом */}
          <div
            ref={rail.ref}
            className="flex cursor-grab snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-6 px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {withMedia.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </section>
      ) : null}

      {textOnly.length ? (
        <section className="wrap mt-12">
          <h2 className="mb-4 text-[clamp(20px,2.6vw,30px)] font-extrabold uppercase text-ink">
            Письменные отзывы
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {textOnly.map((r) => (
              <article
                key={r.id}
                className="flex flex-col rounded-card border border-line bg-white p-6"
              >
                <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#1f9d57]">
                  <CheckCircle2 className="h-4 w-4" /> Доставлено
                </span>
                <Quote className="mb-2 h-6 w-6 text-chrome" />
                <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-ink">
                  {r.text}
                </p>
                <div className="mt-5 border-t border-line pt-4 font-bold text-ink">
                  {r.name}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!hasRemote ? (
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
      ) : null}

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
