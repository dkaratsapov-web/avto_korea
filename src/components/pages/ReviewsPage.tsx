import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Star,
  Play,
  ExternalLink,
} from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { site } from "@/lib/site";
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
 *
 * Пустая строка означает «подписи нет». Придумывать её за владельца нельзя:
 * видео с выдачи присылают без подписи нарочно, и «Автомобиль выдан клиенту»
 * под каждым роликом читалось бы как штамп, а не как отзыв.
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
  return "";
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

/**
 * Карточка отзыва.
 *
 * Сначала — кадр-обложка во всю карточку и крупная кнопка воспроизведения.
 * Само видео подключается только по нажатию, и вот почему: отзыв весит
 * десятки мегабайт и идёт через наш сервер. Если начинать грузить их все
 * сразу, лента открывается минуту, а посмотрят от силы один. Обложка весит
 * килобайты и приезжает мгновенно.
 *
 * Подпись лежит ПОВЕРХ кадра, на затемнении. Раньше она стояла отдельным
 * блоком под медиа, и карточка разваливалась надвое: сверху картинка, снизу
 * текст, между ними шов. Теперь это одно целое — так витрина и читается.
 */
function ReviewCard({ review }: { review: ApiReview }) {
  const slides = slidesOf(review);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const cur = slides[idx] ?? slides[0];

  // Обложка: кадр из видео, если бот его сохранил, иначе первое фото отзыва.
  const poster = review.poster || review.images?.[0] || review.media;

  // Отзыв без единого файла этой карточке не подходит: она вся состоит из
  // медиа, и на его месте остался бы пустой прямоугольник.
  if (!cur) return null;

  const isVideo = cur.type === "video";
  const title = deliveredTitle(review.text);

  return (
    <article className="group relative flex w-[84%] flex-none snap-start flex-col overflow-hidden rounded-[20px] bg-graphite shadow-[0_18px_40px_-22px_rgba(20,25,32,0.75)] transition-shadow hover:shadow-[0_22px_50px_-20px_rgba(20,25,32,0.85)] sm:w-[340px]">
      <div className="relative aspect-[3/4] overflow-hidden">
        {isVideo && playing ? (
          <video
            key={cur.src}
            src={cur.src}
            poster={poster}
            controls
            autoPlay
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <>
            {/* object-cover, а не contain: кадр заполняет карточку целиком,
                без чёрных полей по краям — карточки в ленте выглядят
                одинаковыми по плотности.

                Обложки может не быть вовсе: Telegram присылает кадр не к
                каждому видео. Тогда на её месте остаётся тёмный фон карточки
                с кнопкой воспроизведения — это лучше значка битой картинки. */}
            {isVideo && !poster ? null : (
              <img
                src={isVideo ? poster : cur.src}
                alt=""
                loading="lazy"
                className="h-full w-full bg-graphite object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            )}
            {/* Затемнение снизу — под подпись. Сверху лёгкое, под бейдж. */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(10,13,17,0.92)_0%,rgba(10,13,17,0.55)_28%,rgba(10,13,17,0)_55%,rgba(10,13,17,0.35)_100%)]" />

            {isVideo ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={title ? `Смотреть отзыв: ${title}` : "Смотреть видео-отзыв"}
                className="absolute inset-0 flex items-center justify-center focus-visible:outline-none"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:scale-110">
                  {/* Треугольник чуть правее центра: у знака воспроизведения
                      оптический центр не совпадает с геометрическим. */}
                  <Play className="ml-1 h-6 w-6 fill-bordeaux text-bordeaux" />
                </span>
              </button>
            ) : null}
          </>
        )}

        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-[0.04em] text-[#1f9d57] backdrop-blur">
          <CheckCircle2 className="h-3.5 w-3.5" /> Доставлено
        </span>

        {slides.length > 1 ? (
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-num text-[11.5px] font-bold text-white backdrop-blur">
            {idx + 1}/{slides.length}
          </span>
        ) : null}

        {/* Подпись поверх кадра — только если она есть. Видео с выдач
            присылают без подписи, и выдуманный заголовок под каждым роликом
            читался бы как штамп. Пока видео не запущено, плеер подпись не
            перекрывает, а после запуска она не нужна и убирается. */}
        {!playing && title ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
              Выдача
            </div>
            <div className="mt-1 text-[16px] font-extrabold leading-tight text-white [text-wrap:balance]">
              {title}
            </div>
          </div>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto bg-graphite-2 px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slides.map((s, i) => (
            <button
              key={s.src + i}
              type="button"
              onClick={() => {
                setIdx(i);
                setPlaying(false);
              }}
              aria-label={`Медиа ${i + 1}`}
              className={`relative h-12 w-12 flex-none overflow-hidden rounded-[9px] border-2 transition-colors ${
                i === idx ? "border-bordeaux-bright" : "border-transparent hover:border-white/30"
              }`}
            >
              <img
                src={s.type === "video" ? poster : s.src}
                alt=""
                loading="lazy"
                className="h-full w-full bg-graphite object-cover"
              />
              {s.type === "video" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Play className="h-3.5 w-3.5 fill-white text-white" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

type Tab = "video" | "maps";

/**
 * Переключатель источника отзывов.
 *
 * Отзывы у нас двух пород, и смешивать их в одну ленту нельзя: в справочниках
 * пишут посторонние люди и оценку там не подделать — это доказательство; видео
 * с выдач снимаем мы сами — это показ товара лицом. Посетитель приходит либо
 * за первым, либо за вторым, поэтому даём выбрать, а не листать всё подряд.
 */
function SourceTabs({
  tab,
  onTab,
  videoCount,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  videoCount: number;
}) {
  const items: { key: Tab; label: string; note: string }[] = [
    { key: "video", label: "Видео-отзывы", note: videoCount ? String(videoCount) : "" },
    { key: "maps", label: "Яндекс.Карты", note: "" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Источник отзывов"
      className="inline-flex w-full max-w-md rounded-full border border-line bg-white p-1 sm:w-auto"
    >
      {items.map((it) => {
        const on = tab === it.key;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onTab(it.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-5 py-2.5 text-[14px] font-extrabold transition-colors sm:flex-none ${
              on ? "bg-bordeaux text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {it.label}
            {it.note ? (
              <span
                className={`font-num text-[12px] font-bold ${on ? "text-white/70" : "text-ink-2/70"}`}
              >
                {it.note}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
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
        /*
         * В ленту идёт всё, у чего есть файл: видео или фото.
         *
         * Раньше здесь требовался ЛИБО снимок, либо осмысленный текст — и
         * видео-отзыв без подписи не проходил ни по одному условию. Именно
         * так пропадали ролики, присланные боту как есть: они лежали в
         * хранилище, но до витрины не доходили.
         */
        setRemote(
          rs.filter((r) => r.videos?.length || r.video || r.images?.length || r.media),
        ),
      )
      .catch(() => {});
  }, []);
  /*
   * В карусель идут только отзывы, у которых есть видео или фото.
   *
   * Карточка на три четверти состоит из медиа-блока во всю ширину. Отзыву без
   * единого файла показывать там нечего, и на его месте оставался тёмный
   * прямоугольник — снаружи неотличимо от несработавшей загрузки.
   */
  const withMedia = (remote ?? []).filter((r) => slidesOf(r).length > 0);
  const rail = useDragScroll();

  /*
   * Вкладка по умолчанию — видео, и она не меняется сама.
   *
   * Соблазн «если видео ещё не загрузились, открыть Яндекс» выглядит умно, но
   * ведёт себя отвратительно: страница открывается на картах, через полсекунды
   * приезжают отзывы — и вкладка перещёлкивается ровно тогда, когда человек уже
   * потянулся к экрану. Лучше честный скелет на месте будущей ленты.
   */
  const [tab, setTab] = useState<Tab>("video");

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

      <div className="wrap mt-8 flex justify-center sm:justify-start">
        <SourceTabs tab={tab} onTab={setTab} videoCount={withMedia.length} />
      </div>

      {/* Оценки на внешних площадках: слева площадки, справа живой виджет */}
      <section className={`wrap mt-6 ${tab === "maps" ? "" : "hidden"}`}>
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

      {tab === "video" && remote === null ? (
        // Скелет на месте ленты: место под карточки занято сразу, поэтому
        // страница не прыгает, когда отзывы приезжают.
        <section className="mt-6">
          <div className="flex gap-5 overflow-hidden px-6 pb-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] w-[84%] flex-none animate-pulse rounded-[20px] bg-graphite/10 sm:w-[340px]"
              />
            ))}
          </div>
        </section>
      ) : null}

      {tab === "video" && remote !== null && !withMedia.length ? (
        <section className="wrap mt-6">
          <div className="rounded-card border border-line bg-white p-8 text-center">
            <p className="text-[15px] font-bold text-ink">
              Видео с выдач готовим — скоро появятся здесь.
            </p>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-2">
              А оценки клиентов можно посмотреть прямо сейчас — их пишут в
              справочниках, где отзыв нельзя ни удалить, ни подделать.
            </p>
            <button
              type="button"
              onClick={() => setTab("maps")}
              className="btn btn-primary mt-5 !px-6"
            >
              <Star className="h-4 w-4" /> Отзывы на Яндекс.Картах
            </button>
          </div>
        </section>
      ) : null}

      {tab === "video" && withMedia.length ? (
        <section className="mt-6">
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
