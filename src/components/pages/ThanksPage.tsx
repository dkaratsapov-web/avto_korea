import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Phone } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Страница после отправки заявки.
 *
 * Нужна не только человеку: посещение /thanks — самая надёжная цель для
 * Метрики и Директа (JS-событие может не успеть уйти при переходе). Поэтому
 * закрываем её от индексации — в поиске ей делать нечего.
 */
export function ThanksPage() {
  const { state } = useLocation() as {
    state?: { source?: string; selection?: string };
  };
  const navigate = useNavigate();
  const selection = state?.selection;

  /**
   * Пришли из квиза — сами открываем подобранные авто.
   *
   * Не редиректим мгновенно: страница «Спасибо» это цель для Директа, и ей
   * нужно успеть засчитаться. Пары секунд хватает, а кнопка рядом — для тех,
   * кто не хочет ждать.
   */
  useEffect(() => {
    if (!selection) return;
    const t = window.setTimeout(() => navigate(selection), 2500);
    return () => window.clearTimeout(t);
  }, [selection, navigate]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Заявка принята — ДиАвто69";

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
    <main className="grain relative flex min-h-[calc(100vh-var(--header-h,80px))] items-center overflow-hidden bg-[radial-gradient(900px_500px_at_50%_0%,#27313d,#11151A_65%)] py-16 text-white">
      <HeroBackdrop silhouette={false} />

      <div className="wrap relative">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 ring-2 ring-success/40">
            <Check className="h-8 w-8 text-success" />
          </span>

          <h1 className="mt-6 text-[clamp(28px,5vw,44px)] font-extrabold uppercase leading-[1.06]">
            Заявка принята
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-[#C7CFD6]">
            {selection
              ? "Открываем подборку под ваши параметры. Менеджер перезвонит в течение 15 минут и пришлёт расчёт по каждому авто."
              : "Перезвоним в течение 15 минут и пришлём честный расчёт под ключ — с доставкой и растаможкой."}
          </p>

          {selection ? (
            <Link
              to={selection}
              className="btn btn-primary mx-auto mt-6 !h-13 px-7 text-[15.5px]"
            >
              Смотреть подобранные авто
              <ArrowRight className="h-[18px] w-[18px]" />
            </Link>
          ) : null}
          {state?.source ? (
            <p className="mt-2 text-[13px] text-[#7d8792]">
              Источник заявки: {state.source}
            </p>
          ) : null}

          <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3">
            <a
              href={site.telegramChannelHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                reachGoal(GOALS.telegramChannel, { place: "Спасибо" })
              }
              className="btn bg-[#229ED9] text-white shadow-[0_12px_30px_-14px_rgba(34,158,217,0.9)]"
            >
              <TelegramIcon className="h-6 w-6" />
              Наш канал в Telegram
              <ArrowRight className="h-[18px] w-[18px]" />
            </a>
            <a
              href={site.maxChannelHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => reachGoal(GOALS.maxChannel, { place: "Спасибо" })}
              className="btn bg-white text-ink shadow-[0_12px_30px_-14px_rgba(255,255,255,0.4)]"
            >
              <MaxIcon className="h-6 w-6" />
              Наш канал в MAX
              <ArrowRight className="h-[18px] w-[18px]" />
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <a
              href={site.phoneHref}
              onClick={() => reachGoal(GOALS.phone, { place: "Спасибо" })}
              className="flex items-center gap-2 font-num text-[17px] font-bold text-white transition-colors hover:text-chrome"
            >
              <Phone className="h-[18px] w-[18px] text-bordeaux-bright" />
              {site.phone}
            </a>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-1.5 text-[15px] font-bold text-chrome underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Смотреть каталог
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
