import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Truck, FileCheck2, Clock } from "lucide-react";
import { CostQuiz } from "@/components/CostQuiz";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Посадочная под Директ с квизом (/quiz).
 *
 * Одно действие — пройти четыре вопроса и оставить телефон. Ни каталога, ни
 * меню, ни ссылок наружу: с рекламного трафика уводит всё, что даёт выбор
 * кроме целевого.
 *
 * После отправки уходим на /thanks — отдельная страница-цель для Директа
 * надёжнее JS-события: она фиксируется, даже если счётчик не успел
 * отработать до перехода.
 *
 * Закрыта от индексации, чтобы не конкурировать с основным сайтом в поиске.
 */

const TRUST = [
  { icon: FileCheck2, text: "Цена в договоре — без доплат по факту" },
  { icon: Truck, text: "Доставка и растаможка включены" },
  { icon: ShieldCheck, text: "Проверяем авто до выкупа" },
  { icon: Clock, text: "Расчёт в течение 15 минут" },
];

export function QuizLanding() {
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Расчёт стоимости авто под ключ — ДиАвто69";

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

      <div className="relative mx-auto flex w-full max-w-[860px] flex-1 flex-col px-5 py-9 sm:py-12">
        <div className="text-center">
          <picture>
            <source srcSet="/logo-wordmark.webp" type="image/webp" />
            <img
              src="/logo-wordmark.png"
              alt="ДиАвто69"
              className="logo-outline mx-auto h-9 w-auto sm:h-12"
              decoding="async"
            />
          </picture>

          {/* Переносы не расставляем руками: строка «под ключ» должна остаться
              целой, остальное ложится само на любой ширине. */}
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-[clamp(25px,4.4vw,38px)] font-extrabold uppercase leading-[1.06]">
            Узнайте цену авто из Кореи, Китая или Японии{" "}
            <span className="whitespace-nowrap">под ключ</span>
          </h1>
          <p className="mx-auto mt-3.5 max-w-xl text-[15px] leading-relaxed text-[#C7CFD6] sm:text-[16.5px]">
            Четыре вопроса — и мы соберём расчёт с доставкой, растаможкой и
            оформлением. Без звонков «просто узнать бюджет».
          </p>
        </div>

        <div className="mx-auto mt-8 w-full max-w-[560px]">
          <CostQuiz
            source="Посадочная /quiz (Директ)"
            onSent={() =>
              navigate("/thanks", { state: { source: "Квиз /quiz" } })
            }
          />
        </div>

        <ul className="mx-auto mt-8 grid w-full max-w-[720px] gap-2.5 sm:grid-cols-2">
          {TRUST.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] font-bold backdrop-blur-sm"
            >
              <Icon className="h-[18px] w-[18px] flex-none text-chrome" />
              {text}
            </li>
          ))}
        </ul>

        <a
          href={site.phoneHref}
          onClick={() => reachGoal(GOALS.phone, { place: "Посадочная /quiz" })}
          className="mx-auto mt-7 font-num text-[17px] font-bold text-white transition-colors hover:text-chrome"
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
