import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
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
 * Подпись и лента миниатюр лежат ПОВЕРХ кадра, на затемнении. Так карточка
 * читается как одно целое, и — важнее — у всех карточек одинаковая высота:
 * ряды в сетке идут ровно, без тёмных полей между ними.
 */
function ReviewCard({ review }: { review: ApiReview }) {
  const slides = slidesOf(review);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const cur = slides[idx] ?? slides[0];

  /*
   * Обложка — фотография с выдачи, и только если её нет — кадр из видео.
   *
   * Порядок был обратным, и витрина проигрывала: кадр, который Telegram
   * вырезает из видео, это первый попавшийся момент съёмки — размытая рука,
   * асфальт, пустой капот. Фотография же снята нарочно: клиент, машина, лица.
   * Именно она и продаёт, а кадр из ролика годится только как запасной.
   */
  const poster = review.images?.[0] || review.media || review.poster;

  // Отзыв без единого файла этой карточке не подходит: она вся состоит из
  // медиа, и на его месте остался бы пустой прямоугольник.
  if (!cur) return null;

  const isVideo = cur.type === "video";
  const title = deliveredTitle(review.text);

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-[20px] bg-graphite shadow-[0_18px_40px_-22px_rgba(20,25,32,0.75)] transition-shadow hover:shadow-[0_22px_50px_-20px_rgba(20,25,32,0.85)] sm:w-[340px]">
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

        {/* Подпись и лента миниатюр — одним слоем ВНУТРИ кадра.
            Лента раньше стояла отдельной полосой под ним, и карточка с
            несколькими файлами оказывалась выше соседних: ряды в сетке шли
            уступами, а между ними зияли тёмные поля. Внутри кадра высота у
            всех карточек одна — сетка выравнивается сама.

            Подпись показываем, только если она есть: видео с выдач присылают
            без подписи, и выдуманный заголовок читался бы как штамп. Пока
            видео не запущено, плеер их не перекрывает; после запуска слой
            уходит целиком. */}
        {!playing && (title || slides.length > 1) ? (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-3.5">
            {title ? (
              <div className="pointer-events-none">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
                  Выдача
                </div>
                <div className="mt-1 text-[15px] font-extrabold leading-tight text-white [text-wrap:balance]">
                  {title}
                </div>
              </div>
            ) : null}

            {slides.length > 1 ? (
              <div className="flex gap-1.5">
                {slides.slice(0, 5).map((s, i) => (
                  <button
                    key={s.src + i}
                    type="button"
                    onClick={() => {
                      setIdx(i);
                      setPlaying(false);
                    }}
                    aria-label={`Медиа ${i + 1}`}
                    className={`relative h-9 w-9 flex-none overflow-hidden rounded-[7px] border-2 transition-colors ${
                      i === idx ? "border-white" : "border-white/25 hover:border-white/60"
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
                        <Play className="h-3 w-3 fill-white text-white" />
                      </span>
                    ) : null}
                  </button>
                ))}
                {/* Больше пяти в ряд не помещается, а прокрутка внутри
                    карточки — та же боковая прокрутка, от которой ушли. */}
                {slides.length > 5 ? (
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[7px] border-2 border-white/25 bg-black/40 font-num text-[11px] font-bold text-white">
                    +{slides.length - 5}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Отзыв из справочника 2ГИС — ровно то, что отдаёт /api/2gis. */
type GisReview = { name: string; date: string; rating: number; text: string };
type GisData = { ok: boolean; rating?: number; count?: number; reviews?: GisReview[] };

const MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split(" ");

/** «21 отзыв», «22 отзыва», «25 отзывов». */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** «2026-05-17 12:33:44» → «17 мая». Непонятную дату просто не показываем. */
function gisDate(raw: string): string {
  const d = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function Stars({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`} aria-label={`Оценка ${n} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= n ? "fill-[#f5a623] text-[#f5a623]" : "fill-[#e2e6ea] text-[#e2e6ea]"}`}
        />
      ))}
    </span>
  );
}

/**
 * Карточка 2ГИС.
 *
 * У Яндекса виджет отзывов вставляется готовой рамкой, у 2ГИС такого нет —
 * их карточку в рамку не пустить. Поэтому она собрана вручную и нарочно
 * повторяет вид соседа: оценка крупно, звёзды, лента отзывов, кнопки. Иначе
 * страница читалась бы как «в Яндексе нам есть что показать, а в 2ГИС нет».
 *
 * Данные приходят с нашего же сервера (public/api/2gis.php), он ходит к 2ГИС
 * сам и держит ответ в кэше. Если данных нет — показываем карточку без цифр,
 * но со ссылками. Нарисовать оценку из головы нельзя: это ровно тот обман,
 * из-за которого отзывам на сайтах и перестают верить.
 */
function TwoGis() {
  const [data, setData] = useState<GisData | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/2gis")
      .then((r) => r.json())
      .then((d: GisData) => alive && setData(d))
      .catch(() => alive && setData({ ok: false }));
    return () => {
      alive = false;
    };
  }, []);

  const live = data?.ok && data.rating ? data : null;

  return (
    <div className="flex h-[620px] flex-col overflow-hidden rounded-card border border-line bg-white">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <div className="text-[18px] font-extrabold leading-tight text-ink">Ди Авто Трейдинг</div>
          <div className="mt-0.5 text-[13px] text-ink-2">Тверь, Коминтерна, 71</div>
        </div>
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
          <span className="flex h-5 items-center rounded-[5px] bg-[#00a651] px-1.5 text-[10px] font-extrabold text-white">
            2ГИС
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3 px-5 pt-4">
        {live ? (
          <>
            <span className="font-num text-[40px] font-extrabold leading-none text-ink">
              {String(live.rating).replace(".", ",")}
            </span>
            <span>
              <Stars n={Math.round(live.rating ?? 0)} className="mb-1" />
              <span className="text-[13px] text-ink-2">
                {live.count} {plural(live.count ?? 0, "отзыв", "отзыва", "отзывов")}
              </span>
            </span>
          </>
        ) : (
          <span className="text-[14px] text-ink-2">
            Карточка компании в справочнике — с адресом, телефоном и отзывами.
          </span>
        )}
      </div>

      <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-paper px-4 py-3">
        <span className="text-[14px] font-semibold text-ink">Поставьте нам оценку</span>
        <a
          href={site.map2gisHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[8px] bg-[#00a651] px-4 py-2 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
        >
          Оставить отзыв
        </a>
      </div>

      <div className="mt-1 flex-1 overflow-y-auto px-5 py-4">
        {live?.reviews?.length ? (
          <ul className="space-y-5">
            {live.reviews.map((r, i) => (
              <li key={i} className="border-b border-line pb-5 last:border-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-paper text-[13px] font-bold text-ink-2">
                    {r.name.trim().charAt(0).toUpperCase() || "Г"}
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold text-ink">{r.name}</span>
                    <span className="block text-[12px] text-ink-2">{gisDate(r.date)}</span>
                  </span>
                </div>
                <Stars n={r.rating} className="mt-2" />
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{r.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-2">
              Отзывы и оценка — на карточке компании в 2ГИС. Открывается в одно
              нажатие, там же можно оставить свой.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-line p-4">
        <a
          href={site.map2gisHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-paper py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:bg-line/40"
        >
          Больше отзывов в 2ГИС
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
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
    { key: "maps", label: "Яндекс и 2ГИС", note: "" },
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

  /*
   * Вкладка по умолчанию — видео, и она не меняется сама.
   *
   * Соблазн «если видео ещё не загрузились, открыть Яндекс» выглядит умно, но
   * ведёт себя отвратительно: страница открывается на картах, через полсекунды
   * приезжают отзывы — и вкладка перещёлкивается ровно тогда, когда человек уже
   * потянулся к экрану. Лучше честный скелет на месте будущих карточек.
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

      {/*
        Две площадки — двумя равными половинами.
        Раньше слева стояла карточка со ссылками, справа виджет Яндекса, и
        выходило, что один справочник показан отзывами, а второй — строчкой со
        ссылкой. Читалось это как «в Яндексе у нас есть что показать, а в 2ГИС
        нет». Теперь обе колонки одного размера и вида: оценка, отзывы, кнопки.
      */}
      <section className={`wrap mt-6 ${tab === "maps" ? "" : "hidden"}`}>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {site.yandexOrgId ? (
            <iframe
              title="Отзывы о ДиАвто69 на Яндекс.Картах"
              src={`https://yandex.ru/maps-reviews-widget/${site.yandexOrgId}?comments`}
              loading="lazy"
              className="h-[620px] w-full rounded-card border border-line bg-white"
            />
          ) : null}

          <TwoGis />
        </div>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[13.5px] leading-relaxed text-ink-2">
          Отзывы в справочниках нельзя ни удалить, ни подделать — поэтому смотреть
          их стоит именно там. Обе карточки живые: оценка и тексты подтягиваются
          с площадок.
        </p>
      </section>

      {tab === "video" && remote === null ? (
        // Скелет на месте будущих карточек: место занято сразу, поэтому
        // страница не прыгает, когда отзывы приезжают.
        <section className="wrap mt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] w-full animate-pulse rounded-[20px] bg-graphite/10"
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
              <Star className="h-4 w-4" /> Отзывы в справочниках
            </button>
          </div>
        </section>
      ) : null}

      {tab === "video" && withMedia.length ? (
        <section className="wrap mt-6">
          <h2 className="mb-4 text-[clamp(20px,2.6vw,30px)] font-extrabold uppercase text-ink">
            Видео-отзывы клиентов
          </h2>
          {/*
            Рядами, а не лентой.
            Лента листалась вбок и прятала половину отзывов за краем экрана:
            их не видно, а на телефоне горизонтальная прокрутка ещё и спорит
            с вертикальной. Отзывов теперь много — пусть все и будут на виду.
          */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
