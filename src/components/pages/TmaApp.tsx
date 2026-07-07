import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Heart, ShieldCheck, Scale } from "lucide-react";
import { useCars } from "@/lib/carsStore";
import { useUI } from "@/lib/ui";
import { site } from "@/lib/site";
import { showToast } from "@/lib/toast";
import { loadTelegram, haptic, type TG } from "@/lib/telegram";
import { adminCall, pingUser, logView, type AdminRole } from "@/lib/api";
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

// Тот же прелоадер-глобус, что и на сайте (грузится отдельным чанком).
const Preloader = lazy(() =>
  import("@/components/Preloader").then((m) => ({ default: m.Preloader })),
);

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

export function TmaApp() {
  const { cars } = useCars();
  const { favorites, isFav, toggleFav } = useUI();
  const tgRef = useRef<TG | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>(() => {
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
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const initDataRef = useRef<string>("");
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [intro, setIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !reduce && !window.sessionStorage.getItem("diauto:tma:intro");
  });

  // стабильные обёртки для нативных кнопок
  const mainCb = useRef<() => void>(() => {});
  const backCb = useRef<() => void>(() => {});

  useEffect(() => {
    document.body.style.background = "#11151A";
    let mounted = true;
    loadTelegram().then((tg) => {
      if (!mounted) return;
      tgRef.current = tg;
      if (tg) {
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
          adminCall<{ role: AdminRole }>(initData, "me").then((r) => {
            if (mounted && r.ok && r.role) setAdminRole(r.role);
          });
        }
      }
      setReady(true);
    });
    return () => {
      mounted = false;
      document.body.style.background = "";
    };
  }, []);

  const inTg = ready && !!tgRef.current;

  // при смене экрана прокручиваем наверх (иначе карточка открывается прокрученной)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, adminOpen]);

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
    const payload = {
      type: "lead",
      name: name.trim(),
      phone,
      car: car ? `${car.model} · ${car.id}` : "",
      source: "Telegram Mini App",
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
          if (tg?.close) setTimeout(() => tg.close(), 900);
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
    if (!tg) return;

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

  if (adminOpen && adminRole) {
    return (
      <div className="min-h-screen bg-graphite text-white">
        <div className="mx-auto max-w-md px-4 pb-28 pt-4">
          <TmaAdmin
            tg={tgRef.current}
            initData={initDataRef.current}
            role={adminRole}
            onExit={() => setAdminOpen(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {intro ? (
        <Suspense fallback={<div className="fixed inset-0 z-[100] bg-graphite" />}>
          <Preloader
            onDone={() => {
              window.sessionStorage.setItem("diauto:tma:intro", "1");
              setIntro(false);
            }}
          />
        </Suspense>
      ) : null}
      <div className="min-h-screen bg-graphite text-white">
      <div className="mx-auto max-w-md px-4 pb-28">
        {/* Шапка — фиксируется при скролле */}
        <div className="sticky top-0 z-40 -mx-4 mb-4 flex items-center justify-between border-b border-line-dark/60 bg-graphite px-4 py-3">
          <button
            type="button"
            onClick={() => {
              haptic(tgRef.current);
              setView({ name: "home" });
            }}
            aria-label="ДиАвто69 — на главную"
            className="flex items-center"
          >
            <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img
                src="/logo.png"
                alt="ДиАвто69"
                className="block h-10 w-auto"
                decoding="async"
              />
            </picture>
          </button>
          <div className="flex items-center gap-2">
          {adminRole ? (
            <button
              type="button"
              onClick={() => {
                haptic(tgRef.current);
                setAdminOpen(true);
              }}
              aria-label="Админка"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-bordeaux-bright/60 bg-bordeaux/15 text-bordeaux-bright"
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
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line-dark text-chrome"
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
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line-dark text-chrome"
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
            favCount={favorites.length}
            compareCount={compareIds.length}
            go={(name) => {
              haptic(tgRef.current);
              setView({ name } as View);
            }}
            onLead={() =>
              setView({ name: "lead", from: { name: "home" }, carId: undefined })
            }
          />
        ) : null}

        {view.name === "list" ? (
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
      </div>
    </>
  );
}
