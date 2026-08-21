import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { site } from "@/lib/site";
import { GOALS, reachGoal, reachGoalThen } from "@/lib/metrika";
import { telegramAppLink } from "@/lib/telegram";

/**
 * Прокладка под Директ: единственное действие — уйти в бота (/bot).
 *
 * Свёрстана как страница приглашения самого Telegram — обои с дудлами, белая
 * карточка, круглая аватарка и синяя кнопка внизу. Отдельной рекламной кнопки
 * нет намеренно: по знакомому элементу интерфейса кликают охотнее, чем по
 * баннеру. Тот же приём работает на /tg под канал.
 *
 * Текст обрывается под нижним краем и растворяется в белом: обрыв на середине
 * фразы — сильный повод дочитать, а дочитать можно только в боте.
 *
 * Вариант А/Б берётся из адреса (?v=a или ?v=b) и уезжает в бота меткой
 * диплинка. Страница у обоих вариантов одинаковая — различается только то,
 * что бот сделает дальше: «a» просит подписаться на канал, «b» пускает сразу.
 * Так в тесте сравнивается механика, а не оформление.
 *
 * Метка кампании из utm тоже уходит в бота — тогда в статистике видна вся
 * цепочка от объявления до заявки, а не только клик.
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

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * Метка кампании для диплинка.
 *
 * Telegram разрешает только A-Z a-z 0-9 _ - и не длиннее 64 символов, а
 * вариант занимает ещё два («a-»). Кампании в Директе обычно названы
 * по-русски, поэтому кириллицу транслитерируем: иначе от «Корея поиск»
 * не осталось бы ничего и все кампании слились бы в одну метку.
 */
function slug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => TRANSLIT[c] ?? "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function BotLanding() {
  const [params] = useSearchParams();

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
    document.title = "ДиАвто69 — подбор авто в Telegram";

    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);

    return () => {
      document.title = prevTitle;
      robots.remove();
    };
  }, []);

  const { href, variant } = useMemo(() => {
    // Всё, кроме явного «a», считаем вариантом без стены подписки: случайная
    // опечатка в ссылке объявления не должна закрывать бота людям.
    const v = params.get("v") === "a" ? "a" : "b";
    const src =
      slug(params.get("utm_campaign") || params.get("utm_source") || "") || "direct";
    return {
      variant: v,
      href: `https://t.me/${site.botUsername}?start=${v}-${src}`,
    };
  }, [params]);

  /*
   * Предложение открыть Telegram сразу, не дожидаясь нажатия на кнопку.
   *
   * Схема tg:// не уводит со страницы: браузер показывает своё окно «Открыть
   * приложение?», а посадочная остаётся под ним. Для модерации Директа это
   * важно: автоматического перехода на другой сайт нет, есть предложение
   * открыть приложение.
   *
   * Пробуем дважды: сразу при открытии — этого хватает на телефоне; и по
   * первому действию человека — на десктопе Chrome нередко гасит запуск
   * приложения, пока со страницей ничего не сделали.
   *
   * Один раз за вкладку: возврат кнопкой «назад» не должен снова выбрасывать
   * окно, которое человек только что закрыл.
   */
  useEffect(() => {
    const appHref = telegramAppLink(href);
    if (appHref === null) {
      return;
    }

    // Внутри самого Telegram открывать Telegram незачем.
    if (/Telegram/i.test(navigator.userAgent) || window.Telegram?.WebApp) {
      return;
    }

    const KEY = "bot-landing-opened";
    try {
      if (sessionStorage.getItem(KEY) === "1") {
        return;
      }
    } catch {
      // Приватный режим может запрещать хранилище — тогда просто пробуем.
    }

    let done = false;

    const launch = () => {
      if (done) {
        return;
      }
      done = true;
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        // Не записалось — не страшно, попытка всё равно одна за загрузку.
      }
      reachGoal(GOALS.botAutoOpen, { place: "Прокладка /bot", variant });
      window.location.href = appHref;
      stop();
    };

    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    const stop = () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, launch));
    };

    // Небольшая задержка: страница должна успеть отрисоваться, иначе человек
    // видит окно поверх пустого экрана и не понимает, куда попал.
    const timer = window.setTimeout(launch, 700);
    events.forEach((name) =>
      window.addEventListener(name, launch, { once: true, passive: true }),
    );

    return stop;
  }, [href, variant]);

  /*
   * Переход по ссылке выгружает страницу сразу, и запрос Метрики может
   * не успеть — цель теряется. Поэтому уходим только после подтверждения
   * от счётчика (или по таймауту, если Метрику режет блокировщик).
   */
  const open = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Клик с модификатором или средней кнопкой открывает в новой вкладке —
    // туда вмешиваться нельзя, иначе сломаем привычное поведение браузера.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      reachGoal(GOALS.bot, { place: "Прокладка /bot", variant });
      return;
    }
    e.preventDefault();
    reachGoalThen(GOALS.bot, { place: "Прокладка /bot", variant }, () => {
      window.location.href = href;
    });
  };

  return (
    // Отступ сверху — падингом, а не марджином карточки: марджин ребёнка
    // схлопнулся бы наружу и сдвинул саму страницу вместе с обоями.
    <main
      className="min-h-screen pb-40 sm:pt-8"
      style={{ ...WALLPAPER, fontFamily: TG_FONT }}
    >
      {/* Карточка кликабельна целиком: промах мимо кнопки стоит нам перехода. */}
      <a
        href={href}
        onClick={open}
        aria-label="Открыть бота ДиАвто69 в Telegram"
        className="mx-auto block bg-white px-6 pb-16 pt-10 sm:rounded-[14px] sm:px-12 sm:pt-12"
        style={{ width: COL }}
      >
        {/* Аватарка бота. Берём квадратную иконку, а не овальный логотип:
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
          Подбор авто из Кореи, Китая и Японии — прямо в Telegram 🚗
        </h1>

        <div className="mt-5 space-y-4 text-[16px] leading-[1.55] text-[#222]">
          <p>
            Каталог с ценами под ключ, расчёт с доставкой и растаможкой и подбор
            под ваш бюджет — в одном чате.
            <br />
            <b className="font-semibold">
              Без звонков, форм и ожидания менеджера.
            </b>
          </p>

          {/* Город намеренно не называем: посадочная работает на рекламу
              по всей стране, а привязка цены к одному городу отсекает
              всех остальных. */}
          <p>
            Бот покажет живой каталог — все машины в наличии и под заказ,
            с фото, характеристиками и честной ценой под ключ. Фильтры по
            стране, бюджету, кузову и году: нужное находится за минуту.
          </p>

          <p>
            Включите оповещения — и новые поступления будете видеть первым, ещё
            до того, как они попадут на сайт. Хорошие варианты уходят за дни,
            и обычно выигрывает тот, кто узнал раньше.
          </p>
        </div>

        {/* Реквизиты — требование к рекламным посадочным страницам. */}
        <p className="mt-10 text-[12px] leading-relaxed text-[#8b9199]">
          {site.requisites.name} · ИНН {site.requisites.inn} · ОГРНИП{" "}
          {site.requisites.ogrnip}
          <br />
          Информация не является публичной офертой.{" "}
          <a href="/privacy" className="underline">
            Политика конфиденциальности
          </a>
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
        href={href}
        onClick={open}
        className="fixed bottom-8 left-1/2 flex h-[58px] w-[min(300px,calc(100%-48px))] -translate-x-1/2 items-center justify-center gap-2.5 rounded-full bg-[#3390ec] text-[15.5px] font-bold uppercase tracking-[0.02em] text-white shadow-[0_10px_28px_-10px_rgba(51,144,236,0.85)] transition-transform hover:scale-[1.03]"
      >
        <span aria-hidden>🚀</span>
        Запустить бота
      </a>
    </main>
  );
}
