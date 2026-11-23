import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Heart, ShieldCheck, Scale } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { useCars } from "@/lib/carsStore";
import { useUI } from "@/lib/ui";
import { site } from "@/lib/site";
import { showToast } from "@/lib/toast";
import { loadTelegram, haptic, type TG } from "@/lib/telegram";
import { loadMax, maxStartParam, type MaxApp } from "@/lib/maxapp";
import { adminCall, pingUser, logView, logClick, type AdminMe } from "@/lib/api";
import { TmaAdmin } from "@/components/pages/TmaAdmin";
import {
  HomeView,
  ListView,
  FavView,
  CarView,
  LeadView,
  CalcView,
  QuizView,
  SubscribeView,
  ReviewsView,
  FaqView,
  CompareView,
} from "@/components/tma/screens";

/*
 * Заставки в мини-аппе нет — сознательно.
 *
 * Раньше здесь показывался тот же прелоадер-глобус, что и на сайте: четыре
 * секунды анимации плюс ещё семьсот миллисекунд на угасание. На сайте это
 * уместно — человек пришёл на витрину, ему показывают марку. В мини-аппе
 * всё наоборот: он уже внутри Telegram, уже нажал кнопку «Каталог» и ждёт
 * машины. Пять секунд фирменной заставки поверх этого читаются однозначно —
 * «не работает».
 *
 * И это было не всё ожидание, а добавка сверху: сначала грузится бандл,
 * потом каталог, потом фотографии. Заставка накладывалась на самый медленный
 * сценарий и удваивала его. Убрана — экран показывается сразу, как только
 * разметка готова.
 */

type View =
  | { name: "home" }
  | { name: "list" }
  | { name: "car"; id: string }
  | { name: "favorites" }
  | { name: "calc" }
  | { name: "quiz" }
  | { name: "subscribe" }
  | { name: "compare" }
  | { name: "reviews" }
  | { name: "faq" }
  | { name: "lead"; carId?: string; from: View };

/**
 * Как назвать источник заявки.
 *
 * Мини-апп теперь открывается из двух мессенджеров, и в учёте они должны
 * различаться: иначе через месяц не понять, стоит ли MAX потраченного на
 * него времени. Признак — метка в адресе, её выставляет сама ссылка,
 * прописанная в настройках бота MAX.
 */
function sourceName(): string {
  if (typeof window === "undefined") return "Telegram Mini App";
  const ms = new URLSearchParams(window.location.search).get("ms");
  if (ms !== "max") return "Telegram Mini App";
  // В MAX к источнику добавляем метку запуска из рекламного диплинка
  // (max.ru/<bot>?startapp=…), если она есть, — чтобы заявки из разных
  // кампаний в MAX различались так же, как в Telegram через ?start=.
  const sp = maxStartParam();
  return sp ? `MAX Mini App · ${sp}` : "MAX Mini App";
}

export function TmaApp() {
  const { cars } = useCars();
  const { favorites, isFav, toggleFav } = useUI();
  const tgRef = useRef<TG | null>(null);
  const maxRef = useRef<MaxApp | null>(null);
  // Открыт ли мини-апп из MAX. Признак — метка ?ms=max в адресе: её ставит
  // ссылка мини-приложения, прописанная в настройках бота MAX. У MAX свой
  // движок, телеграмовские нативные кнопки там не работают, поэтому в MAX
  // ведём себя как веб-версия (кнопки внутри экрана) и зовём SDK самого MAX.
  const isMax =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("ms") === "max";
  const [ready, setReady] = useState(false);
  const [view, setViewRaw] = useState<View>(() => {
    if (typeof window === "undefined") return { name: "home" };
    const s = new URLSearchParams(window.location.search).get("screen");
    if (s === "calc") return { name: "calc" };
    if (s === "quiz") return { name: "quiz" };
    if (s === "catalog") return { name: "list" };
    if (s === "subscribe") return { name: "subscribe" };
    if (s === "reviews") return { name: "reviews" };
    if (s === "faq") return { name: "faq" };
    return { name: "home" };
  });

  /**
   * Память прокрутки по экранам.
   *
   * Раньше при каждой смене экрана страница уезжала наверх — и возврат из
   * карточки авто выбрасывал в начало каталога, даже если человек долистал
   * до сотой машины. Теперь позицию каждого экрана запоминаем и возвращаем.
   */
  const scrollMemo = useRef<Record<string, number>>({});
  const viewRef = useRef<View>(view);
  const viewKey = (v: View) => (v.name === "car" ? `car:${v.id}` : v.name);

  // Обёртка над сеттером: позицию надо снять до перерисовки, поэтому делаем
  // это в момент перехода, а не в эффекте — там scrollY уже успевает поехать.
  const setView = useCallback((next: View | ((v: View) => View)) => {
    scrollMemo.current[viewKey(viewRef.current)] = window.scrollY;
    setViewRaw(next);
  }, []);

  // Список создаём только после первого захода в каталог и дальше уже не
  // размонтируем — иначе состояние фильтров терялось бы при каждом возврате.
  const listVisited = useRef(false);
  if (view.name === "list") listVisited.current = true;

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const initDataRef = useRef<string>("");
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  // стабильные обёртки для нативных кнопок
  const mainCb = useRef<() => void>(() => {});
  const backCb = useRef<() => void>(() => {});

  useEffect(() => {
    document.body.style.background = "#11151A";
    let mounted = true;
    loadTelegram().then(async (tg) => {
      if (!mounted) return;
      tgRef.current = tg;
      if (isMax) {
        // MAX: подключаем его SDK (для openLink и метки запуска startapp).
        // Телеграмовские ready/expand/нативные кнопки здесь не зовём — в MAX
        // их нет, работаем кнопками внутри экранов, как в веб-версии.
        maxRef.current = await loadMax();
      } else if (tg) {
        tg.ready();
        tg.expand();
        try {
          tg.setHeaderColor("#11151A");
          tg.setBackgroundColor("#11151A");
        } catch {
          /* ignore */
        }
        tg.MainButton.onClick(() => mainCb.current());
        tg.BackButton.onClick(() => backCb.current());
        // проверяем, админ ли открывший — по подписи initData
        const initData = tg.initData || "";
        initDataRef.current = initData;
        if (initData) {
          pingUser(initData);
          adminCall<AdminMe>(initData, "me").then((r) => {
            if (mounted && r.ok && (r.owner || (r.caps && r.caps.length)))
              setAdmin({ owner: !!r.owner, caps: r.caps || [] });
          });
        }
      }
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      document.body.style.background = "";
    };
  }, []);

  // В MAX — не Telegram: там нет нативных кнопок и телеграм-разделов (например
  // «Оповещения» завязаны на подпись Telegram). Поэтому ведём себя как веб.
  const inTg = ready && !!tgRef.current && !isMax;

  // Возвращаем прокрутку экрана: у нового — начало, у знакомого — то место,
  // где человек остановился. useLayoutEffect, чтобы не мелькнуло промежуточное
  // положение: разметка уже готова, но кадр ещё не отрисован.
  // behavior: "instant", а не "auto": "auto" берёт поведение из CSS, а там
  // html { scroll-behavior: smooth } — экран плавно уезжал вверх при открытии
  // карточки и обратно вниз при возврате в каталог («дёргается туда-сюда»).
  useLayoutEffect(() => {
    viewRef.current = view;
    const key = viewKey(view);
    window.scrollTo({ top: scrollMemo.current[key] ?? 0, behavior: "instant" });
  }, [view]);

  useLayoutEffect(() => {
    if (adminOpen) window.scrollTo({ top: 0, behavior: "instant" });
  }, [adminOpen]);

  function back() {
    haptic(tgRef.current);
    setView((v) =>
      v.name === "lead"
        ? v.from
        : v.name === "car"
          ? { name: "list" }
          : { name: "home" },
    );
  }

  async function submit(name: string, phone: string, carId?: string) {
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 11) {
      haptic(tgRef.current, "rigid");
      showToast("Заполните имя и телефон полностью", "error");
      return;
    }
    const car = carId ? cars.find((c) => c.id === carId) : undefined;
    // Ник и id пользователя Telegram — прикладываем автоматически из мини-аппа.
    const tgUser = (tgRef.current as unknown as {
      initDataUnsafe?: { user?: { username?: string; id?: number } };
    })?.initDataUnsafe?.user;
    const payload = {
      type: "lead",
      name: name.trim(),
      phone,
      car: car ? `${car.model} · ${car.id}` : "",
      username: tgUser?.username ? `@${tgUser.username}` : "",
      tgUserId: tgUser?.id || undefined,
      source: sourceName(),
    };
    const tg = tgRef.current;

    // 1) надёжно — через серверless-эндпоинт (если задан)
    const endpoint = import.meta.env.VITE_LEAD_ENDPOINT as string | undefined;
    if (endpoint) {
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          haptic(tg, "medium");
          showToast("Заявка отправлена — перезвоним в течение 15 минут");
          // В Telegram окно закрываем; в MAX закрытия нет — возвращаем к списку.
          if (tg?.close && !isMax) setTimeout(() => tg.close(), 900);
          else setView({ name: "list" });
          return;
        }
      } catch {
        /* упадём в фолбэк */
      }
    }

    // 2) через Telegram (если открыт из reply-кнопки)
    try {
      if (tg?.sendData) {
        tg.sendData(JSON.stringify(payload));
        haptic(tg, "medium");
        tg.close();
        return;
      }
    } catch {
      /* sendData недоступен — откроем чат */
    }

    // 3) фолбэк — открыть чат с менеджером
    showToast("Заявка готова — открываем чат с менеджером");
    if (tg?.openTelegramLink && !isMax) tg.openTelegramLink(site.telegramHref);
    else if (maxRef.current?.openLink) maxRef.current.openLink(site.telegramHref);
    else window.open(site.telegramHref, "_blank");
  }

  /**
   * Личка менеджера. В Telegram — через openTelegramLink: чат открывается
   * внутри мессенджера, мини-апп не закрывается. В MAX — профиль менеджера
   * в MAX (там у человека может не быть Telegram), в браузере — новая вкладка.
   */
  function openManager() {
    haptic(tgRef.current, "light");
    logClick("manager", viewRef.current.name, initDataRef.current);
    const tg = tgRef.current;
    if (isMax) {
      const mx = maxRef.current;
      if (mx?.openMaxLink) mx.openMaxLink(site.maxHref);
      else if (mx?.openLink) mx.openLink(site.maxHref);
      else window.open(site.maxHref, "_blank");
      return;
    }
    if (tg?.openTelegramLink) tg.openTelegramLink(site.telegramHref);
    else window.open(site.telegramHref, "_blank");
  }

  // конфигурация нативных кнопок под текущий экран
  const leadFormRef = useRef<{ name: string; phone: string; carId?: string }>({
    name: "",
    phone: "",
  });
  useEffect(() => {
    const tg = tgRef.current;
    // В MAX нативных кнопок нет — там всё управляется кнопками внутри экранов.
    if (isMax || !tg) return;

    // В админке — своя навигация, нативные кнопки не нужны.
    if (adminOpen) {
      backCb.current = () => setAdminOpen(false);
      tg.BackButton.show();
      tg.MainButton.hide();
      return;
    }

    backCb.current = back;
    if (view.name !== "home") tg.BackButton.show();
    else tg.BackButton.hide();

    if (view.name === "car") {
      mainCb.current = () =>
        setView({ name: "lead", carId: view.id, from: view });
      tg.MainButton.setText("Оставить заявку");
      tg.MainButton.setParams({ color: "#9C1A12", text_color: "#ffffff" });
      tg.MainButton.show();
    } else if (view.name === "lead") {
      mainCb.current = () => {
        const f = leadFormRef.current;
        submit(f.name, f.phone, f.carId);
      };
      tg.MainButton.setText("Отправить заявку");
      tg.MainButton.setParams({ color: "#9C1A12", text_color: "#ffffff" });
      tg.MainButton.show();
    } else {
      tg.MainButton.hide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, ready, adminOpen]);

  if (adminOpen && admin) {
    return (
      <div className="min-h-screen overflow-x-clip bg-graphite text-white">
        <div className="mx-auto max-w-md px-4 pb-28 pt-4">
          <TmaAdmin
            tg={tgRef.current}
            initData={initDataRef.current}
            owner={admin.owner}
            caps={admin.caps}
            onExit={() => setAdminOpen(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* overflow-x: clip — страховка: что бы ни оказалось шире экрана, экран
          не ездит вбок. Именно clip, а не hidden: hidden ломает прилипающую
          шапку поиска. */}
      <div className="min-h-screen overflow-x-clip bg-graphite text-white">
      <div className={`mx-auto max-w-md px-4 ${view.name === "home" ? "pb-5" : "pb-28"}`}>
        {/* Шапка — тёмная в стиле бота; лого как на сайте */}
        <div className="sticky top-0 z-40 -mx-4 mb-4 flex h-[53px] items-center justify-between gap-2 border-b border-line-dark/70 bg-graphite/95 px-4 backdrop-blur">
          {/*
            Кнопка «назад» в шапке — для тех, кто открыл мини-апп не из
            Telegram. В Telegram назад ведёт родная кнопка мессенджера, и
            вторая рядом с ней была бы лишней. В MAX её нет вовсе: человек
            заходил в каталог и оставался там без выхода, кроме закрытия
            всего приложения.
          */}
          {!inTg && view.name !== "home" ? (
            <button
              type="button"
              onClick={back}
              aria-label="Назад"
              className="-ml-1 mr-1 flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line-dark bg-white/[0.04] text-chrome"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              haptic(tgRef.current);
              setView({ name: "home" });
            }}
            aria-label="ДиАвто69 — на главную"
            className="flex min-w-0 flex-1 items-center"
          >
            {/* Как на сайте: только надпись с белой окантовкой, без подложки. */}
            <picture>
              <source srcSet="/logo-wordmark.webp" type="image/webp" />
              <img
                src="/logo-wordmark.png"
                alt="ДиАвто69"
                className="logo-outline block h-6 w-auto max-w-full object-contain"
                decoding="async"
              />
            </picture>
          </button>
          <div className="flex flex-none items-center gap-2">
          {admin ? (
            <button
              type="button"
              onClick={() => {
                haptic(tgRef.current);
                setAdminOpen(true);
              }}
              aria-label="Админка"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-bordeaux-bright/60 bg-bordeaux/15 text-bordeaux-bright"
            >
              <ShieldCheck className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              haptic(tgRef.current);
              setView({ name: "compare" });
            }}
            aria-label="Сравнение"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line-dark bg-white/[0.04] text-chrome"
          >
            <Scale className="h-5 w-5" />
            {compareIds.length > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] font-bold text-white">
                {compareIds.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              haptic(tgRef.current);
              setView({ name: "favorites" });
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line-dark bg-white/[0.04] text-chrome"
          >
            <Heart className="h-5 w-5" />
            {favorites.length > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] font-bold text-white">
                {favorites.length}
              </span>
            ) : null}
          </button>
          </div>
        </div>

        {view.name === "home" ? (
          <HomeView
            inTg={inTg}
            go={(name) => {
              haptic(tgRef.current);
              setView({ name } as View);
            }}
            onLead={() =>
              setView({ name: "lead", from: { name: "home" }, carId: undefined })
            }
            onManager={openManager}
          />
        ) : null}

        {/* Каталог не размонтируем, а прячем: иначе при открытии карточки
            теряются поиск, фильтры и выбранная страна — человеку приходится
            вводить марку заново после каждого просмотра. Скрытый список
            сохраняет состояние и высоту, поэтому и прокрутка возвращается
            туда же, где он остановился. */}
        {listVisited.current ? (
          <div hidden={view.name !== "list"}>
            <ListView
              cars={cars}
              isFav={isFav}
              onToggleFav={(id) => {
                haptic(tgRef.current);
                toggleFav(id);
              }}
              onOpen={(id) => {
                haptic(tgRef.current);
                logView(id);
                setView({ name: "car", id });
              }}
            />
          </div>
        ) : null}

        {view.name === "favorites" ? (
          <FavView
            cars={cars.filter((c) => favorites.includes(c.id))}
            onOpen={(id) => setView({ name: "car", id })}
            onRemove={(id) => {
              haptic(tgRef.current);
              toggleFav(id);
            }}
            onBack={() => setView({ name: "home" })}
          />
        ) : null}

        {view.name === "calc" ? (
          <CalcView
            onBack={() => setView({ name: "home" })}
            onLead={() => setView({ name: "lead", from: { name: "calc" }, carId: undefined })}
          />
        ) : null}

        {view.name === "quiz" ? (
          <QuizView
            inTg={inTg}
            onBack={() => setView({ name: "home" })}
            onOpen={(id) => {
              haptic(tgRef.current);
              logView(id);
              setView({ name: "car", id });
            }}
            haptic={() => haptic(tgRef.current, "medium")}
          />
        ) : null}

        {view.name === "subscribe" ? (
          <SubscribeView
            initData={initDataRef.current}
            inTg={inTg}
            onBack={() => setView({ name: "home" })}
            haptic={() => haptic(tgRef.current, "medium")}
          />
        ) : null}

        {view.name === "reviews" ? (
          <ReviewsView onBack={() => setView({ name: "home" })} />
        ) : null}

        {view.name === "faq" ? (
          <FaqView onBack={() => setView({ name: "home" })} />
        ) : null}

        {view.name === "compare" ? (
          <CompareView
            cars={cars.filter((c) => compareIds.includes(c.id))}
            onRemove={(id) =>
              setCompareIds((p) => p.filter((x) => x !== id))
            }
            onClear={() => setCompareIds([])}
            onBack={() => setView({ name: "home" })}
            onOpenCatalog={() => setView({ name: "list" })}
          />
        ) : null}

        {view.name === "car"
          ? (() => {
              const car = cars.find((c) => c.id === view.id);
              if (!car) return null;
              return (
                <CarView
                  key={car.id}
                  car={car}
                  fav={isFav(car.id)}
                  inCompare={compareIds.includes(car.id)}
                  onToggleCompare={() => {
                    haptic(tgRef.current);
                    setCompareIds((p) =>
                      p.includes(car.id)
                        ? p.filter((x) => x !== car.id)
                        : p.length >= 3
                          ? p
                          : [...p, car.id],
                    );
                  }}
                  onToggleFav={() => {
                    haptic(tgRef.current);
                    toggleFav(car.id);
                  }}
                  onBack={() => setView({ name: "list" })}
                  onLead={() =>
                    setView({ name: "lead", carId: car.id, from: view })
                  }
                  onOpen={(id) => {
                    haptic(tgRef.current);
                    logView(id);
                    setView({ name: "car", id });
                  }}
                  showInAppCta={!inTg}
                />
              );
            })()
          : null}

        {view.name === "lead" ? (
          <LeadView
            car={
              view.carId ? cars.find((c) => c.id === view.carId) : undefined
            }
            formRef={leadFormRef}
            onBack={back}
            onSubmit={(n, p) => submit(n, p, view.carId)}
            showInAppCta={!inTg}
          />
        ) : null}
      </div>

      {/*
        Связь с менеджером — всегда под рукой, на любом экране, кроме формы
        заявки (там своя кнопка отправки, и вторая цель рядом только мешает).
        На главной она стоит в ряд с «Подобрать авто» — в том же углу, но без
        наезда на кнопку.
        Правый нижний угол — зона большого пальца.
      */}
      {view.name !== "lead" && view.name !== "home" ? (
        <button
          type="button"
          onClick={openManager}
          aria-label="Написать менеджеру в Telegram"
          className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-50 h-14 w-14 rounded-full shadow-[0_12px_28px_-6px_rgba(34,158,217,.7)] transition-transform duration-150 active:scale-95"
        >
          <TelegramIcon className="h-14 w-14" />
        </button>
      ) : null}
      </div>
    </>
  );
}
