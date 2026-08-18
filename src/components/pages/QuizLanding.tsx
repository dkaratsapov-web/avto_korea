import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Truck, FileCheck2, Clock } from "lucide-react";
import { CostQuiz } from "@/components/CostQuiz";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { site } from "@/lib/site";

/**
 * Посадочная под Директ с квизом (/quiz).
 *
 * Один экран без прокрутки: всё помещается в высоту окна, уйти взглядом
 * некуда — только пройти квиз. Прокручивается при необходимости лишь сама
 * карточка квиза, чтобы на низких экранах ничего не обрезалось.
 *
 * После отправки уходим на /thanks, а оттуда — сразу в каталог с фильтрами по
 * ответам. Промежуточная страница нужна как цель для Директа: она успевает
 * засчитаться до перехода на подборку.
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

    // Страница занимает ровно экран, поэтому прокрутку документа выключаем:
    // иначе на мобильных остаётся «резиновый» ход и страница кажется битой.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.title = prevTitle;
      robots.remove();
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <main className="relative flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(900px_500px_at_50%_-10%,#27313d,#11151A_65%)] text-white">
      <HeroBackdrop silhouette={false} />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden px-5 py-5 sm:py-7 lg:flex-row lg:items-center lg:gap-14 lg:px-8">
        {/* Левая колонка: обещание и снятие возражений. На мобильном —
            сжатая шапка, чтобы квиз оставался главным на экране. */}
        <div className="flex-none text-center lg:flex-1 lg:text-left">
          <picture>
            <source srcSet="/logo-wordmark.webp" type="image/webp" />
            <img
              src="/logo-wordmark.png"
              alt="ДиАвто69"
              className="logo-outline mx-auto h-7 w-auto sm:h-9 lg:mx-0 lg:h-12"
              decoding="async"
            />
          </picture>

          <h1 className="mx-auto mt-3 max-w-xl text-balance text-[clamp(19px,4.6vw,38px)] font-extrabold uppercase leading-[1.08] sm:mt-5 lg:mx-0 lg:max-w-none">
            Узнайте цену авто из Кореи, Китая или Японии{" "}
            <span className="whitespace-nowrap">под ключ</span>
          </h1>

          <p className="mx-auto mt-2.5 hidden max-w-md text-[15px] leading-relaxed text-[#C7CFD6] sm:block lg:mx-0 lg:mt-4 lg:text-[17px]">
            Четыре вопроса — и мы соберём расчёт с доставкой, растаможкой и
            оформлением. Без звонков «просто узнать бюджет».
          </p>

          {/* Плашки доверия только на десктопе: на телефоне они съедали бы
              высоту, которая нужна самому квизу. */}
          <ul className="mt-7 hidden gap-2.5 lg:grid">
            {TRUST.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14.5px] font-bold backdrop-blur-sm"
              >
                <Icon className="h-[18px] w-[18px] flex-none text-chrome" />
                {text}
              </li>
            ))}
          </ul>

          <a
            href={site.phoneHref}
            className="mt-6 hidden font-num text-[18px] font-bold text-white transition-colors hover:text-chrome lg:inline-block"
          >
            {site.phone}
          </a>
        </div>

        {/* Правая колонка: сам квиз. Прокручивается внутри себя, если экран
            низкий, — страница при этом остаётся неподвижной. */}
        <div className="mt-4 flex min-h-0 w-full flex-1 flex-col lg:mt-0 lg:max-w-[520px] lg:flex-none">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CostQuiz
              source="Посадочная /quiz (Директ)"
              onSent={(selection) =>
                navigate("/thanks", {
                  state: { source: "Квиз /quiz", selection },
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Реквизиты — требование к рекламным посадочным страницам. */}
      <footer className="relative flex-none px-5 pb-3 text-center text-[10.5px] leading-snug text-[#6f7883]">
        {site.requisites.name} · ИНН {site.requisites.inn} · Не является
        публичной офертой ·{" "}
        <a href="/privacy" className="underline hover:text-chrome">
          Политика конфиденциальности
        </a>
      </footer>
    </main>
  );
}
