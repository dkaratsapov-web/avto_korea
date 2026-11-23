import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Menu,
  X,
  BookOpen,
  MapPin,
  Phone,
  ArrowRight,
  Heart,
  Car,
  ChevronRight,
  Gem,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { Button } from "@/components/ui/Button";
import { nav, site } from "@/lib/site";
import { useUI } from "@/lib/ui";
import { GOALS, reachGoal } from "@/lib/metrika";

const capsule = "glass rounded-full shadow-[0_12px_34px_rgba(0,0,0,.4)]";

/**
 * Написать нам — в шапке и в мобильном меню.
 *
 * Раньше здесь стояли ссылки на каналы. Но человек в шапке ищет способ
 * связаться, а не подписаться: переписка с менеджером почти равна заявке,
 * подписка — только повод вернуться. Поэтому наверху личные сообщения,
 * а каналы остались там, где они уместны: в блоке на главной и на
 * рекламных посадочных под Директ.
 *
 * Цели соответственно click_*, а не channel_*: это разные по цене действия,
 * и смешивать их в отчётах нельзя.
 */
const messengers = [
  {
    label: "Telegram",
    href: site.telegramHref,
    goal: GOALS.telegram,
    icon: <TelegramIcon className="h-[17px] w-[17px]" />,
  },
  {
    label: "MAX",
    href: site.maxHref,
    goal: GOALS.max,
    icon: <MaxIcon className="h-[17px] w-[17px]" />,
  },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { openLead, openFavorites, favCount } = useUI();
  const { pathname } = useLocation();
  // В шапке-капсуле — страницы, кроме тех, что вынесены отдельными кнопками
  // (Каталог и Статьи). «Новости» временно скрыты: раздел ещё не наполнен.
  const pageNav = nav.filter(
    (n) =>
      n.href !== "/catalog" && n.href !== "/articles" && n.href !== "/news",
  );

  // В меню, в отличие от шапки, показываем и «Статьи» — там места хватает.
  const menuNav = [...pageNav, { href: "/articles", label: "Статьи" } as const];

  const headerRef = useRef<HTMLDivElement>(null);

  // Реальную высоту шапки отдаём в CSS-переменную, чтобы липкие фильтры
  // каталога парковались точно под ней (шапка меняет высоту).
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${el.offsetHeight}px`,
      );
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);

  // Меню закрывается по Esc и при переходе на другую страницу.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const h = "h-[52px]";

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Высоту меряем по строке шапки, а не по всему <header>: с раскрытым
          меню он выше, и липкие фильтры каталога уезжали бы вниз. */}
      <div
        ref={headerRef}
        className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-2 px-3 py-3.5 sm:gap-3 sm:px-6"
      >
        {/* Логотип — только надпись, с белой окантовкой вместо подложки */}
        <div className="flex h-[60px] flex-none items-center">
          <div className="relative flex items-center">
            <Logo
              variant="wordmark"
              className="logo-outline h-7 w-auto shrink-0 sm:h-9"
            />
            <img
              src={`${import.meta.env.BASE_URL}holiday/header-sprig.webp`}
              alt=""
              aria-hidden="true"
              width={260}
              height={124}
              className="pointer-events-none absolute -right-1 -top-[19px] h-auto w-[61px] -scale-x-100 select-none drop-shadow-[0_2px_3px_rgba(0,0,0,.65)] sm:-top-6 sm:w-[76px]"
              decoding="async"
            />
          </div>
        </div>

        {/* Каталог — отдельная яркая кнопка (без анимаций) */}
        <Link
          to="/catalog"
          className={`hidden ${h} items-center gap-2 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-5 font-extrabold uppercase tracking-[0.02em] text-white shadow-[0_8px_22px_rgba(122,20,16,.5)] md:flex`}
        >
          <Car className="h-[18px] w-[18px]" />
          Каталог
        </Link>

        {/*
         * Одна кнопка вместо двух: переход в бота.
         *
         * Раньше здесь стояли Telegram и MAX — два способа написать лично.
         * Оба вели в переписку, то есть требовали от менеджера ответа, и
         * между собой отличались только мессенджером: выбор без разницы,
         * а места занимает вдвое. Бот отвечает сам и в любое время, поэтому
         * в шапке полезнее он.
         *
         * Личные сообщения никуда не делись — они остались в мобильном меню
         * и в блоке контактов, где человек их и ищет.
         *
         * Освободившееся место сразу пошло в дело: подпись раньше пряталась
         * до 1700 px, теперь показывается с 1366 — почти на всех ноутбуках.
         * Ниже остаётся один значок: на 1280 шапка с подписью уже не
         * помещалась в строку и распирала капсулы. Замерено.
         */}
        <a
          href={site.botHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => reachGoal(GOALS.bot, { place: "Шапка" })}
          className={`${capsule} ${h} hidden items-center gap-2 whitespace-nowrap px-3.5 text-[14px] font-semibold text-[#C3CBD2] transition-colors hover:text-white xl:flex min-[1366px]:px-4`}
          aria-label="Наш бот в Telegram"
        >
          <TelegramIcon className="h-[17px] w-[17px] flex-none" />
          <span className="hidden min-[1366px]:inline">Наш бот в Telegram</span>
        </a>

        {/* Капсула: навигация */}
        <nav
          className={`${capsule} ${h} hidden items-center gap-1 px-2 xl:flex`}
          aria-label="Основная навигация"
        >
          {pageNav.map((item, i) => {
            const isActive = pathname === item.href;
            return (
              <span key={item.href} className="flex items-center">
                {i > 0 ? (
                  <span
                    className="mx-0.5 h-3.5 w-[5px] -skew-x-[24deg] rounded-[1px] bg-bordeaux-bright/40"
                    aria-hidden
                  />
                ) : null}
                <Link
                  to={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-[#C3CBD2] hover:text-white"
                  }`}
                >
                  {item.label}
                  {isActive ? (
                    <span
                      className="absolute -bottom-0.5 left-1/2 h-[3px] w-5 -translate-x-1/2 -skew-x-12 rounded-sm bg-gradient-to-r from-bordeaux-deep to-bordeaux-bright"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              </span>
            );
          })}
          <span
            className="mx-0.5 h-3.5 w-[5px] -skew-x-[24deg] rounded-[1px] bg-bordeaux-bright/40"
            aria-hidden
          />
          <Link
            to="/articles"
            className="ml-1 flex items-center gap-1.5 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-3.5 py-2 text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(122,20,16,.45)]"
          >
            <BookOpen className="h-4 w-4" /> Статьи
          </Link>
        </nav>

        {/* Капсула: действия */}
        <div
          className={`${capsule} flex min-h-[52px] items-center gap-1 px-2 py-1.5`}
        >
          <div className="hidden flex-col justify-center gap-[5px] px-3 pt-1 2xl:flex">
            {site.phones.map((p) => (
              <a
                key={p.href}
                href={p.href}
                onClick={() => reachGoal(GOALS.phone, { place: "Шапка" })}
                className="flex items-center gap-2 whitespace-nowrap leading-none transition-colors hover:text-chrome"
              >
                <Phone className="h-[13px] w-[13px] flex-none text-bordeaux-bright" />
                <span className="font-num text-[12.5px] font-bold tracking-[0.01em] text-white">
                  {p.number}
                </span>
                <span className="hidden text-[11px] font-semibold text-[#C3CBD2] min-[1800px]:inline">
                  {p.name} · {p.role}
                </span>
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={openFavorites}
            aria-label="Избранное"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-chrome transition-colors hover:bg-white/10 hover:text-white"
          >
            <Heart className="h-[18px] w-[18px]" />
            {favCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] font-bold text-white">
                {favCount}
              </span>
            ) : null}
          </button>
          {/* На мобильном кнопку не показываем: там есть меню и плавающие
              кнопки подбора и Telegram, круглая стрелка только путала. */}
          <Button
            variant="primary"
            onClick={openLead}
            className="!min-h-0 h-9 rounded-full !px-4 !py-0 text-[14px] max-sm:hidden"
          >
            Рассчитать
            <ArrowRight className="h-[16px] w-[16px]" />
          </Button>
          <button
            type="button"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 xl:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Мобильное меню: затемнение + панель под бургером.
          Во всю ширину она смотрелась пустой на планшетах, поэтому ограничена
          по ширине и прижата вправо — туда, где сама кнопка меню. */}
      {open ? (
        <>
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setOpen(false)}
            className="fixed inset-0 -z-10 h-full w-full cursor-default bg-black/55 backdrop-blur-[2px] xl:hidden"
          />
          <div className="px-3 sm:px-6 xl:hidden">
            <nav
              className="glass ml-auto mt-1 flex max-h-[calc(100vh-120px)] w-full max-w-[420px] flex-col overflow-y-auto rounded-[24px] p-3 shadow-[0_24px_60px_rgba(0,0,0,.6)]"
              aria-label="Мобильная навигация"
            >
              <Link
                to="/catalog"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-bordeaux-bright to-bordeaux px-4 py-3.5 font-extrabold uppercase tracking-[0.02em] text-white shadow-[0_10px_24px_-10px_rgba(122,20,16,.9)]"
              >
                <Car className="h-[18px] w-[18px]" /> Весь каталог
              </Link>

              <Link
                to="/catalog?tab=premium"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center gap-2.5 rounded-2xl border border-bordeaux/40 bg-bordeaux/[0.10] px-4 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-bordeaux/20"
              >
                <Gem className="h-[17px] w-[17px] text-bordeaux-bright" />
                Премиум
                <span className="ml-auto text-[12px] font-semibold text-[#9AA4B2]">
                  Mercedes · BMW · Audi
                </span>
              </Link>

              <div className="mt-3 flex flex-col gap-0.5">
                {menuNav.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[16px] font-semibold transition-colors ${
                        isActive
                          ? "bg-white/[0.08] text-white"
                          : "text-[#C3CBD2] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span
                        className={`h-4 w-[4px] flex-none -skew-x-12 rounded-sm bg-gradient-to-b from-bordeaux-deep to-bordeaux-bright transition-opacity ${
                          isActive ? "opacity-100" : "opacity-30"
                        }`}
                        aria-hidden
                      />
                      {item.label}
                      <ChevronRight className="ml-auto h-4 w-4 text-[#6C7681]" />
                    </Link>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-line-dark pt-3">
                <span className="px-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7C8792]">
                  Написать нам
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {messengers.map((c) => (
                    <a
                      key={c.href}
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        reachGoal(c.goal, { place: "Мобильное меню" });
                        setOpen(false);
                      }}
                      className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-3 py-3 text-[15px] font-bold text-white transition-colors hover:bg-white/10"
                    >
                      {c.icon}
                      {c.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-3 border-t border-line-dark pt-3">
                <span className="px-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7C8792]">
                  Связаться
                </span>
                <div className="mt-2 flex flex-col gap-2">
                  {site.phones.map((p) => (
                    <a
                      key={p.href}
                      href={p.href}
                      onClick={() => reachGoal(GOALS.phone, { place: "Мобильное меню" })}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 transition-colors hover:bg-white/[0.08]"
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-bordeaux/20 text-bordeaux-bright">
                        <Phone className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block whitespace-nowrap font-num text-[16px] font-bold leading-tight text-white">
                          {p.number}
                        </span>
                        <span className="block text-[12px] font-semibold leading-tight text-[#9AA4B2]">
                          {p.name} · {p.role}
                        </span>
                      </span>
                    </a>
                  ))}

                  {/* Кнопки «написать» — выше, в блоке «Написать нам»: там
                      теперь и Telegram, и MAX. Здесь остались телефоны
                      и заявка, чтобы не предлагать одно и то же дважды. */}

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openLead();
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-[15px] font-extrabold text-ink transition-colors hover:bg-chrome-lt"
                  >
                    Рассчитать под ключ
                    <ArrowRight className="h-[17px] w-[17px]" />
                  </button>
                </div>
              </div>

              <a
                href={site.mapHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="mt-3 flex items-center gap-2 border-t border-line-dark px-1 pt-3 text-[13.5px] font-semibold text-[#9AA4B2] transition-colors hover:text-white"
              >
                <MapPin className="h-4 w-4 flex-none text-bordeaux-bright" />
                {site.addressFull}
              </a>
            </nav>
          </div>
        </>
      ) : null}
    </header>
  );
}
