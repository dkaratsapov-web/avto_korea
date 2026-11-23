import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";
import { TelegramNotice, CTA_LABEL } from "@/components/pages/TelegramNotice";

/**
 * Посадочная только под Telegram-канал (/tg).
 *
 * Свёрстана как страница приглашения самого Telegram: обои с дудлами, белая
 * карточка, круглая аватарка канала и синяя кнопка внизу. Отдельной рекламной
 * кнопки нет намеренно — по знакомому элементу интерфейса кликают охотнее,
 * чем по баннеру.
 *
 * Текст уходит под нижний край и растворяется в белом: обрыв на середине
 * фразы — сильный повод дочитать, а дочитать можно только в канале.
 *
 * Закрыта от индексации, чтобы не конкурировать с основным сайтом в поиске.
 */

/** Экранный шрифт Telegram — системный, как в самом приложении. */
const TG_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

/** Ширина колонки: и карточка, и растворение, и кнопка держатся её. */
const COL = "min(620px, 100%)";

const WALLPAPER = {
  backgroundColor: "#90ac78",
  backgroundImage: "url(/tg-pattern.svg)",
  backgroundSize: "260px 260px",
} as const;

export function TelegramLanding() {
  // Растворение прибито к низу экрана, поэтому у конца страницы оно оказалось
  // бы белой полосой поверх обоев — карточка там уже закончилась. Гасим его,
  // когда прятать больше нечего.
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const left =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;
      setAtEnd(left < 180);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "ДиАвто69 — авто из Кореи, Китая и Японии под ключ";

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
    // Отступ сверху — падингом, а не марджином карточки: марджин ребёнка
    // схлопнулся бы наружу и сдвинул саму страницу вместе с обоями.
    <main
      className="min-h-screen pb-40 sm:pt-8"
      style={{ ...WALLPAPER, fontFamily: TG_FONT }}
    >
      {/* Карточка кликабельна целиком: промах мимо кнопки стоит нам перехода. */}
      <a
        href={site.telegramChannelHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={open}
        aria-label="Перейти в Telegram-канал ДиАвто69"
        className="mx-auto block bg-white px-6 pb-16 pt-10 sm:rounded-[14px] sm:px-12 sm:pt-12"
        style={{ width: COL }}
      >
        {/* Аватарка канала. Берём квадратную иконку, а не овальный логотип:
            овал внутри круга даёт две вложенные окружности и выглядит криво. */}
        <img
          src="/favicon-512.png"
          alt="ДиАвто69"
          className="mx-auto aspect-square w-[74%] max-w-[300px] rounded-full object-cover"
          decoding="async"
        />

        {/* font-body и normal-case перебивают общий стиль заголовков сайта:
            здесь мы имитируем Telegram, а не фирменную типографику. */}
        <h1 className="mt-10 font-body text-[19.5px] font-bold normal-case leading-snug text-[#111]">
          Авто из Кореи, Китая и Японии без переплат — честно, под ключ 🚗
        </h1>

        <TelegramNotice target="канал" />

        {/* Реквизиты — требование к рекламным посадочным страницам. */}
        <p className="mt-10 text-[12px] leading-relaxed text-[#8b9199]">
          {site.requisites.name} · ИНН {site.requisites.inn} · ОГРНИП{" "}
          {site.requisites.ogrnip}
          <br />
          Информация не является публичной офертой.{" "}
          <span className="underline">Политика конфиденциальности</span>
        </p>
      </a>

      {/* Растворение текста под кнопкой. Держится колонки, чтобы белое
          не заезжало на обои по бокам. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-0 left-1/2 h-44 -translate-x-1/2 transition-opacity duration-200 ${
          atEnd ? "opacity-0" : "opacity-100"
        }`}
        style={{
          width: COL,
          background:
            "linear-gradient(to top, #fff 34%, rgba(255,255,255,0.92) 55%, rgba(255,255,255,0))",
        }}
      />

      <a
        href={site.telegramChannelHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={open}
        className="fixed bottom-8 left-1/2 flex h-[58px] w-[min(300px,calc(100%-48px))] -translate-x-1/2 items-center justify-center gap-2.5 rounded-full bg-[#3390ec] text-[15.5px] font-bold uppercase tracking-[0.02em] text-white shadow-[0_10px_28px_-10px_rgba(51,144,236,0.85)] transition-transform hover:scale-[1.03]"
      >
        <span aria-hidden>☑️</span>
        {/* Надпись берём из общего места: на неё дословно ссылается третий
            шаг памятки, и разъехаться они не должны. */}
        {CTA_LABEL["канал"]}
      </a>
    </main>
  );
}
