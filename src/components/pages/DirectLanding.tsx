import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { site } from "@/lib/site";

/**
 * Посадочная страница под Яндекс.Директ (/go).
 *
 * Изолирована от сайта: без шапки, футера и плавающих кнопок — только
 * логотип, заголовок и два перехода в каналы. Всё лишнее уводит внимание
 * и снижает конверсию рекламного трафика.
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
          доставкой и растаможкой — в наших каналах.
        </p>

        <div className="mt-9 flex w-full max-w-sm flex-col gap-3">
          <a
            href={site.telegramChannelHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 items-center justify-center gap-2.5 rounded-full bg-[#229ED9] text-[16px] font-extrabold text-white shadow-[0_12px_30px_-12px_rgba(34,158,217,0.9)] transition-transform hover:scale-[1.02]"
          >
            <TelegramIcon className="h-7 w-7" />
            Перейти в Telegram
            <ArrowRight className="h-[18px] w-[18px]" />
          </a>
          <a
            href={site.maxChannelHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 items-center justify-center gap-2.5 rounded-full bg-white text-[16px] font-extrabold text-ink shadow-[0_12px_30px_-12px_rgba(255,255,255,0.4)] transition-transform hover:scale-[1.02]"
          >
            <MaxIcon className="h-7 w-7" />
            Перейти в MAX
            <ArrowRight className="h-[18px] w-[18px]" />
          </a>
        </div>

        <a
          href={site.phoneHref}
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
