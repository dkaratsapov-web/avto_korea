import { useEffect } from "react";
import { ArrowRight, ScanLine } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Посадочная страница под Яндекс.Директ (/go).
 *
 * Изолирована от сайта: без шапки, футера и плавающих кнопок — только
 * логотип, заголовок и один переход в Telegram-канал. Всё лишнее уводит
 * внимание и снижает конверсию рекламного трафика.
 *
 * Закрыта от индексации, чтобы не конкурировать с основным сайтом в поиске.
 */
export function DirectLanding() {
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

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(900px_500px_at_50%_-10%,#27313d,#11151A_65%)] text-white">
      <HeroBackdrop silhouette={false} />

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <picture>
          <source srcSet="/logo-wordmark.webp" type="image/webp" />
          <img
            src="/logo-wordmark.png"
            alt="ДиАвто69"
            className="logo-outline h-11 w-auto sm:h-14"
            decoding="async"
          />
        </picture>

        <h1 className="mt-8 text-[clamp(27px,6vw,44px)] font-extrabold uppercase leading-[1.06]">
          Авто из Кореи, Китая
          <br />и Японии под ключ
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#C7CFD6] sm:text-[16px]">
          Каталог с ценами под ключ, новые поступления и честный расчёт с
          доставкой и растаможкой — в нашем Telegram-канале.
        </p>

        {/* Кнопка и QR — рядом на десктопе, где сканировать удобно с телефона.
            На мобильном QR не показываем: страницу и так открыли с телефона. */}
        <div className="mt-9 flex w-full flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
          <a
            href={site.telegramChannelHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              reachGoal(GOALS.telegramChannel, { place: "Посадочная /go" })
            }
            className="flex h-14 w-full max-w-sm items-center justify-center gap-2.5 rounded-full bg-[#229ED9] text-[16px] font-extrabold text-white shadow-[0_12px_30px_-12px_rgba(34,158,217,0.9)] transition-transform hover:scale-[1.02] sm:w-auto sm:px-8"
          >
            <TelegramIcon className="h-7 w-7" />
            Перейти в Telegram
            <ArrowRight className="h-[18px] w-[18px]" />
          </a>

          <div className="hidden text-center sm:block">
            <div className="rounded-2xl bg-white p-2.5 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.8)]">
              <img
                src="/qr-telegram.svg"
                alt="QR-код: наш канал в Telegram"
                width={128}
                height={128}
                className="h-32 w-32"
                decoding="async"
              />
            </div>
            <span className="mt-2 flex items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#9AA4B2]">
              <ScanLine className="h-3 w-3 flex-none" />
              Наведите камеру
            </span>
          </div>
        </div>

        <a
          href={site.phoneHref}
          onClick={() => reachGoal(GOALS.phone, { place: "Посадочная /go" })}
          className="mt-7 font-num text-[17px] font-bold text-white transition-colors hover:text-chrome"
        >
          {site.phone}
        </a>
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
