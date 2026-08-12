import { useEffect } from "react";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

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
        {/* Аватарка канала */}
        <div
          className="mx-auto flex aspect-square w-[74%] max-w-[300px] items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(160deg,#e8edf1,#b9c3cb 55%,#98a4ad)",
          }}
        >
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img
              src="/logo.png"
              alt="ДиАвто69"
              className="w-[74%]"
              decoding="async"
            />
          </picture>
        </div>

        {/* font-body и normal-case перебивают общий стиль заголовков сайта:
            здесь мы имитируем Telegram, а не фирменную типографику. */}
        <h1 className="mt-10 font-body text-[19.5px] font-bold normal-case leading-snug text-[#111]">
          Авто из Кореи, Китая и Японии без переплат — честно, под ключ 🚗
        </h1>

        <div className="mt-5 space-y-4 text-[16px] leading-[1.55] text-[#222]">
          <p>
            Покупка авто из-за границы — всегда риск: неясная история, скрытые
            наценки и страх переплатить на ровном месте.
            <br />
            Хотите знать,{" "}
            <b className="font-semibold">
              как выбрать надёжную машину и заплатить честную цену?
            </b>
          </p>

          <p>
            Мы в <b className="font-semibold">ДиАвто69</b> показываем реальные
            цены, расчёты и готовые авто под ваш бюджет.
            <br />
            Без накруток и с полным сопровождением — от подбора до выдачи ключей.
          </p>

          <p>
            В канале каждый день: новые поступления с ценами под ключ, фото и
            видео прямо с площадки, разборы конкретных расчётов — сколько стоит
            машина, доставка, растаможка и оформление по отдельности.
          </p>

          <p>
            Показываем и то, о чём обычно молчат: как отличить честный расчёт от
            заниженного, из-за чего цена вырастает уже после предоплаты и какие
            автомобили сейчас невыгодно везти.
          </p>
        </div>

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
        className="pointer-events-none fixed bottom-0 left-1/2 h-44 -translate-x-1/2"
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
        Перейти в канал
      </a>
    </main>
  );
}
