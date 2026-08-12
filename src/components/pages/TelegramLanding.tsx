import { useEffect } from "react";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Посадочная только под Telegram-канал (/tg).
 *
 * Отличие от /go: там витрина сайта с кнопкой, здесь — сам Telegram. Человек
 * видит канал таким, каким он откроется после клика: шапка, посты, а внизу
 * родная синяя кнопка «Подписаться». Она и есть переход — отдельной рекламной
 * кнопки на странице нет намеренно, клик по знакомому элементу интерфейса
 * даётся легче, чем по баннеру.
 *
 * Кликабелен весь телефон: попасть точно в кнопку на мобильном сложно.
 *
 * Закрыта от индексации, чтобы не конкурировать с основным сайтом в поиске.
 */

/** Экранный шрифт Telegram — системный, как в самом приложении. */
const TG_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

/**
 * Обои чата: мягкий сине-серый градиент с редкой сеткой точек.
 * Точный узор Telegram не копируем — важно ощущение текстуры под пузырями.
 */
const WALLPAPER = {
  backgroundColor: "#ccd8e4",
  backgroundImage: [
    "radial-gradient(circle at 22% 14%, rgba(255,255,255,0.55), transparent 55%)",
    "radial-gradient(circle at 82% 88%, rgba(148,173,198,0.5), transparent 55%)",
    "radial-gradient(circle at center, rgba(255,255,255,0.42) 1.5px, transparent 1.6px)",
  ].join(","),
  backgroundSize: "auto, auto, 24px 24px",
} as const;

/** Иконки статус-бара: рисуем сами, чтобы не тащить набор ради трёх значков. */
function StatusIcons() {
  return (
    <div className="flex items-center gap-1.5 text-[#0b0f14]">
      {/* Уровень сигнала */}
      <svg width="18" height="11" viewBox="0 0 18 11" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={i * 4.6}
            y={8 - i * 2.4}
            width="3"
            height={3 + i * 2.4}
            rx="1"
            fill="currentColor"
          />
        ))}
      </svg>
      {/* Wi-Fi */}
      <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden>
        <path
          d="M8 10.2 6.1 8.1a2.9 2.9 0 0 1 3.8 0L8 10.2Zm-3.3-3.6a5.6 5.6 0 0 1 6.6 0l1.3-1.4a7.6 7.6 0 0 0-9.2 0l1.3 1.4ZM1.4 3.6a9.9 9.9 0 0 1 13.2 0L15.9 2a12 12 0 0 0-15.8 0l1.3 1.6Z"
          fill="currentColor"
        />
      </svg>
      {/* Батарея */}
      <svg width="25" height="12" viewBox="0 0 25 12" aria-hidden>
        <rect
          x="0.5"
          y="0.5"
          width="21"
          height="11"
          rx="3.2"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.4"
        />
        <rect x="2" y="2" width="15" height="8" rx="2" fill="currentColor" />
        <path
          d="M23 4.2v3.6a2 2 0 0 0 0-3.6Z"
          fill="currentColor"
          fillOpacity="0.4"
        />
      </svg>
    </div>
  );
}

/** Время под сообщением — как в канале: серое, мелкое, в правом нижнем углу. */
function Stamp({ time, light = false }: { time: string; light?: boolean }) {
  return (
    <span
      className="ml-2 shrink-0 translate-y-[3px] text-[11px] font-medium tabular-nums"
      style={{ color: light ? "rgba(255,255,255,0.85)" : "#8d9aa6" }}
    >
      {time}
    </span>
  );
}

export function TelegramLanding() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "ДиАвто69 — канал с авто из Кореи, Китая и Японии";

    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);

    return () => {
      document.title = prevTitle;
      robots.remove();
    };
  }, []);

  const open = () => reachGoal(GOALS.telegramChannel, { place: "Посадочная /tg" });

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(1100px 700px at 50% -15%, #37b0e6, #1f8fc4 45%, #14648c 100%)",
      }}
    >
      {/* Блик сверху: без него фирменный синий выглядит плоской заливкой. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(600px 300px at 50% 0%, rgba(255,255,255,0.35), transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-5 py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:py-16">
        {/* Текстовая часть */}
        <div className="max-w-[600px] text-center lg:flex-1 lg:text-left">
          <picture>
            <source srcSet="/logo-wordmark.webp" type="image/webp" />
            <img
              src="/logo-wordmark.png"
              alt="ДиАвто69"
              className="mx-auto h-8 w-auto brightness-0 invert sm:h-11 lg:mx-0"
              decoding="async"
            />
          </picture>

          {/* Переносы не расставляем руками: строка «в нашем Telegram» должна
              оставаться целой на любой ширине, остальное ложится само. */}
          <h1 className="mt-5 text-[clamp(25px,4.6vw,42px)] font-extrabold uppercase leading-[1.06] sm:mt-7">
            Новые авто из Кореи, Китая и Японии —{" "}
            <span className="whitespace-nowrap">в нашем Telegram</span>
          </h1>

          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/85 sm:mt-5 sm:text-[17px] lg:mx-0">
            Выкладываем свежие поступления с ценами под ключ: доставка,
            растаможка, утильсбор и ЭПТС уже в сумме. Без скрытых доплат по факту.
          </p>

          <ul className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2 sm:mt-7 sm:gap-2.5 lg:mx-0 lg:justify-start">
            {[
              "Цены под ключ",
              "Фото и видео с площадки",
              "Расчёт бесплатно",
            ].map((t) => (
              <li
                key={t}
                className="rounded-full bg-white/15 px-3.5 py-1.5 text-[12.5px] font-bold backdrop-blur-sm sm:px-4 sm:py-2 sm:text-[13.5px]"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Макет телефона — кликабелен целиком: попасть точно в кнопку
            на мобильном неудобно, а промах по макету стоит нам перехода. */}
        <a
          href={site.telegramChannelHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={open}
          aria-label="Открыть Telegram-канал ДиАвто69"
          className="group block w-full max-w-[330px] shrink-0 transition-transform duration-300 hover:-translate-y-1.5 sm:max-w-[352px]"
        >
          <div
            className="relative rounded-[46px] bg-[#0d1116] p-[11px] shadow-[0_40px_90px_-30px_rgba(6,32,48,0.95),0_0_0_1px_rgba(255,255,255,0.14)]"
            style={{ fontFamily: TG_FONT }}
          >
            <div className="relative overflow-hidden rounded-[36px] bg-white">
              {/* Статус-бар */}
              <div className="relative flex items-center justify-between bg-[#f3f4f6] px-6 pb-1.5 pt-3">
                <span className="text-[14px] font-semibold tabular-nums text-[#0b0f14]">
                  9:41
                </span>
                {/* Динамический остров */}
                <div className="absolute left-1/2 top-2 h-[26px] w-[86px] -translate-x-1/2 rounded-full bg-[#0d1116]" />
                <StatusIcons />
              </div>

              {/* Шапка канала */}
              <div className="flex items-center gap-3 border-b border-[#dcdfe3] bg-[#f3f4f6] px-3.5 pb-2.5 pt-1">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 shrink-0 text-[#2b8fd6]"
                  aria-hidden
                >
                  <path
                    d="M15 5 8 12l7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <img
                  src="/favicon-512.png"
                  alt=""
                  className="h-[38px] w-[38px] shrink-0 rounded-full object-cover"
                  decoding="async"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold leading-tight text-[#0b0f14]">
                    ДиАвто69
                  </p>
                  <p className="truncate text-[12.5px] leading-tight text-[#8d9aa6]">
                    Авто из Кореи, Китая и Японии
                  </p>
                </div>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#8d9aa6]" aria-hidden>
                  <circle cx="12" cy="5" r="1.7" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                  <circle cx="12" cy="19" r="1.7" fill="currentColor" />
                </svg>
              </div>

              {/* Лента канала */}
              <div className="space-y-2 px-3 py-3.5" style={WALLPAPER}>
                <p className="mx-auto w-fit rounded-full bg-black/15 px-3 py-1 text-[11.5px] font-semibold text-white">
                  Сегодня
                </p>

                {/* Пост с фото: так канал и выглядит — карточка авто и цена */}
                <div className="max-w-[86%] overflow-hidden rounded-[15px] rounded-bl-[5px] bg-white shadow-[0_1px_2px_rgba(16,35,47,0.16)]">
                  <img
                    src="/cars/toyota-rav4/2.webp"
                    alt="Toyota RAV4 2026"
                    className="h-[132px] w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="px-2.5 pb-1.5 pt-2">
                    <p className="text-[13.5px] font-bold leading-snug text-[#0b0f14]">
                      🇯🇵 Toyota RAV4 2026
                    </p>
                    <p className="mt-1 text-[12.5px] leading-snug text-[#3d4a55]">
                      2.0T, 171 л.с., полный привод, 0 км
                      <br />
                      Комплектация Deluxe Edition
                    </p>
                    <p className="mt-1.5 flex items-end justify-between">
                      <span className="text-[15px] font-extrabold tabular-nums text-[#0b0f14]">
                        3 990 000 ₽{" "}
                        <span className="text-[11.5px] font-bold text-[#8d9aa6]">
                          под ключ
                        </span>
                      </span>
                      <Stamp time="12:04" />
                    </p>
                  </div>
                </div>

                {/* Текстовый пост */}
                <div className="max-w-[88%] rounded-[15px] rounded-bl-[5px] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(16,35,47,0.16)]">
                  <p className="text-[13px] leading-snug text-[#0b0f14]">
                    Каждый день добавляем новые авто с ценами под ключ —
                    доставка, растаможка и оформление уже посчитаны.
                    <Stamp time="12:06" />
                  </p>
                </div>

                {/* Последний пост подводит взгляд к кнопке внизу */}
                <div className="max-w-[74%] rounded-[15px] rounded-bl-[5px] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(16,35,47,0.16)]">
                  <p className="text-[13px] leading-snug text-[#0b0f14]">
                    Посчитаем любой автомобиль бесплатно 👇
                    <Stamp time="12:07" />
                  </p>
                </div>
              </div>

              {/* Родная панель Telegram вместо поля ввода — она же переход.
                  Внутри ссылки, поэтому div, а не кнопка: вложенные ссылки
                  ломают разметку. */}
              <div className="border-t border-[#dcdfe3] bg-[#f3f4f6] px-3 pb-5 pt-2.5">
                <div className="relative overflow-hidden rounded-[11px] bg-[#3390ec] py-3 text-center">
                  <span className="relative z-10 text-[15px] font-bold uppercase tracking-[0.03em] text-white">
                    Подписаться
                  </span>
                  {/* Блик пробегает по кнопке: единственный намёк, что это
                      не скриншот, а живой элемент. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] animate-join-shine bg-white/35 motion-reduce:hidden"
                  />
                </div>
                {/* Полоска-индикатор жеста «домой» */}
                <div className="mx-auto mt-3 h-[5px] w-[112px] rounded-full bg-[#0b0f14]/25" />
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[13.5px] font-bold text-white/90 transition-colors group-hover:text-white">
            Нажмите, чтобы открыть канал
          </p>
        </a>
      </div>

      {/* Реквизиты и оговорка — требование к рекламным посадочным страницам. */}
      <footer className="relative px-5 pb-8 text-center text-[11.5px] leading-relaxed text-white/60">
        <p>
          {site.requisites.name} · ИНН {site.requisites.inn} · ОГРНИП{" "}
          {site.requisites.ogrnip}
        </p>
        <p className="mt-1">
          Информация не является публичной офертой.{" "}
          <a href="/privacy" className="underline hover:text-white">
            Политика конфиденциальности
          </a>
        </p>
      </footer>
    </main>
  );
}
