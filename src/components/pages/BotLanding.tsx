import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Calculator, Car, Bell } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Прокладка под Директ: единственное действие — уйти в бота (/bot).
 *
 * Вариант А/Б берётся из адреса (?v=a или ?v=b) и уезжает в бота меткой
 * диплинка. Страница у обоих вариантов одинаковая — различается только то,
 * что бот сделает дальше: «a» просит подписаться на канал, «b» пускает сразу.
 * Так в тесте сравнивается механика, а не оформление.
 *
 * Метка кампании из utm тоже уходит в бота — тогда в статистике видно всю
 * цепочку от объявления до заявки, а не только клик.
 *
 * Закрыта от индексации, чтобы не конкурировать с основным сайтом в поиске.
 */

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

const BENEFITS = [
  { icon: Car, text: "Каталог с ценами под ключ" },
  { icon: Calculator, text: "Расчёт стоимости за 2 минуты" },
  { icon: Bell, text: "Новые поступления — первым" },
];

export function BotLanding() {
  const [params] = useSearchParams();

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

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(900px_500px_at_50%_-10%,#27313d,#11151A_65%)] text-white">
      <HeroBackdrop silhouette={false} />

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <picture>
          <source srcSet="/logo-wordmark.webp" type="image/webp" />
          <img
            src="/logo-wordmark.png"
            alt="ДиАвто69"
            className="logo-outline h-10 w-auto sm:h-14"
            decoding="async"
          />
        </picture>

        <h1 className="mt-8 text-[clamp(27px,6vw,44px)] font-extrabold uppercase leading-[1.06]">
          Подберём авто из Кореи,
          <br />
          Китая и Японии — в Telegram
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#C7CFD6] sm:text-[16px]">
          Каталог, честный расчёт с доставкой и растаможкой и подбор под ваш
          бюджет — прямо в мессенджере. Без звонков и заполнения форм.
        </p>

        <ul className="mt-8 flex w-full max-w-md flex-col gap-2.5">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-left text-[14.5px] font-bold backdrop-blur-sm"
            >
              <Icon className="h-[18px] w-[18px] flex-none text-chrome" />
              {text}
            </li>
          ))}
        </ul>

        <a
          href={href}
          onClick={() => reachGoal(GOALS.bot, { place: "Прокладка /bot", variant })}
          className="mt-9 flex h-14 w-full max-w-sm items-center justify-center gap-2.5 rounded-full bg-[#229ED9] text-[16px] font-extrabold text-white shadow-[0_12px_30px_-12px_rgba(34,158,217,0.9)] transition-transform hover:scale-[1.02]"
        >
          <TelegramIcon className="h-7 w-7" />
          Открыть в Telegram
          <ArrowRight className="h-[18px] w-[18px]" />
        </a>

        <p className="mt-3 text-[12.5px] text-[#8b95a1]">
          Откроется чат с ботом — нажмите «Старт»
        </p>
      </div>

      {/* Реквизиты и оговорка — требование к рекламным посадочным страницам. */}
      <footer className="relative px-5 pb-7 text-center text-[11.5px] leading-relaxed text-[#7d8792]">
        <p>
          {site.requisites.name} · ИНН {site.requisites.inn} · ОГРНИП{" "}
          {site.requisites.ogrnip}
        </p>
        <p className="mt-1">
          Информация не является публичной офертой.{" "}
          <a href="/privacy" className="underline hover:text-chrome">
            Политика конфиденциальности
          </a>
        </p>
      </footer>
    </main>
  );
}
