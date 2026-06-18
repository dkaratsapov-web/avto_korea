import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  Calculator,
  SlidersHorizontal,
  X,
  Car as CarIcon,
  Bell,
  Scale,
  Star,
  HelpCircle,
  Send,
  Loader2,
} from "lucide-react";
import { Flag } from "@/components/icons/Flag";
import { useCars } from "@/lib/carsStore";
import { useUI } from "@/lib/ui";
import { countries, site, type CountryCode } from "@/lib/site";
import { type Car, formatPrice } from "@/data/cars";
import { showToast } from "@/lib/toast";
import { loadTelegram, haptic, type TG } from "@/lib/telegram";
import {
  adminCall,
  pingUser,
  logView,
  subscribe as apiSubscribe,
  fetchReviews,
  fetchFaq,
  type AdminRole,
  type Review,
  type Faq,
} from "@/lib/api";
import { TmaAdmin } from "@/components/pages/TmaAdmin";

type View =
  | { name: "home" }
  | { name: "list" }
  | { name: "car"; id: string }
  | { name: "favorites" }
  | { name: "calc" }
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
    <div className="min-h-screen bg-graphite text-white">
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">
        {/* Шапка */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              haptic(tgRef.current);
              setView({ name: "home" });
            }}
            className="flex items-baseline gap-px font-display text-[22px] font-extrabold text-white"
          >
            <span className="text-chrome">Ди</span>Авто
            <span className="text-bordeaux-bright">69</span>
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
  );
}

/* ---------- Экраны ---------- */

function mtoggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function ListView({
  cars,
  isFav,
  onToggleFav,
  onOpen,
}: {
  cars: Car[];
  isFav: (id: string) => boolean;
  onToggleFav: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | CountryCode>("all");
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [bodies, setBodies] = useState<string[]>([]);
  const [fuels, setFuels] = useState<string[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [priceMax, setPriceMax] = useState<number | null>(null);

  const facets = useMemo(() => {
    const prices = cars.map((c) => c.priceTverRub ?? c.priceRub);
    return {
      brands: Array.from(new Set(cars.map((c) => c.model.trim().split(/\s+/)[0]))).sort(),
      bodies: Array.from(new Set(cars.map((c) => c.bodyType).filter(Boolean) as string[])).sort(),
      fuels: Array.from(new Set(cars.map((c) => c.fuelType).filter(Boolean) as string[])).sort(),
      drives: Array.from(new Set(cars.map((c) => c.drive))),
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [cars]);

  const countryTabs = useMemo(() => {
    const present = Array.from(new Set(cars.map((c) => c.country)));
    return [
      { value: "all" as const, label: "Все" },
      ...present.map((code) => ({ value: code, label: countries[code].label })),
    ];
  }, [cars]);

  const cap = priceMax ?? facets.max;
  const activeCount =
    brands.length + bodies.length + fuels.length + drives.length + (priceMax !== null ? 1 : 0);

  const list = cars.filter((c) => {
    const price = c.priceTverRub ?? c.priceRub;
    if (filter !== "all" && c.country !== filter) return false;
    if (!c.model.toLowerCase().includes(q.toLowerCase())) return false;
    if (brands.length && !brands.includes(c.model.trim().split(/\s+/)[0])) return false;
    if (bodies.length && !(c.bodyType && bodies.includes(c.bodyType))) return false;
    if (fuels.length && !(c.fuelType && fuels.includes(c.fuelType))) return false;
    if (drives.length && !drives.includes(c.drive)) return false;
    if (price > cap) return false;
    return true;
  });

  function resetFilters() {
    setBrands([]);
    setBodies([]);
    setFuels([]);
    setDrives([]);
    setPriceMax(null);
  }

  const pill = (active: boolean) =>
    `flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
      active ? "border-bordeaux-bright bg-bordeaux text-white" : "border-line-dark text-chrome"
    }`;

  return (
    <>
      <div className="mb-3 flex gap-2">
        <label className="relative block flex-1">
          <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8C97A1]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по модели…"
            className="field-dark pl-10"
          />
        </label>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`relative flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[12px] border ${
            open || activeCount
              ? "border-bordeaux-bright bg-bordeaux/15 text-bordeaux-bright"
              : "border-line-dark text-chrome"
          }`}
          aria-label="Фильтры"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {activeCount ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-bordeaux px-1 font-num text-[11px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {countryTabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={`flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${
              filter === t.value
                ? "border-bordeaux-bright bg-bordeaux text-white"
                : "border-line-dark text-chrome"
            }`}
          >
            {t.value !== "all" ? <Flag code={t.value} className="h-3 w-4" /> : null}
            {t.label}
          </button>
        ))}
      </div>

      {open ? (
        <div className="mb-4 space-y-3 rounded-[16px] border border-line-dark bg-graphite-2 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-extrabold uppercase">Фильтры</span>
            {activeCount ? (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-[12.5px] font-bold text-bordeaux-bright"
              >
                <X className="h-3.5 w-3.5" /> Сбросить
              </button>
            ) : null}
          </div>

          {facets.bodies.length ? (
            <FilterRow label="Кузов">
              {facets.bodies.map((b) => (
                <button key={b} onClick={() => setBodies((p) => mtoggle(p, b))} className={pill(bodies.includes(b))}>
                  {b}
                </button>
              ))}
            </FilterRow>
          ) : null}

          {facets.fuels.length ? (
            <FilterRow label="Топливо">
              {facets.fuels.map((f) => (
                <button key={f} onClick={() => setFuels((p) => mtoggle(p, f))} className={pill(fuels.includes(f))}>
                  {f}
                </button>
              ))}
            </FilterRow>
          ) : null}

          <FilterRow label="Привод">
            {facets.drives.map((d) => (
              <button key={d} onClick={() => setDrives((p) => mtoggle(p, d))} className={pill(drives.includes(d))}>
                {d}
              </button>
            ))}
          </FilterRow>

          <FilterRow label="Марка">
            {facets.brands.map((b) => (
              <button key={b} onClick={() => setBrands((p) => mtoggle(p, b))} className={pill(brands.includes(b))}>
                {b}
              </button>
            ))}
          </FilterRow>

          {facets.max > facets.min ? (
            <div>
              <div className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#8C97A1]">
                Цена до{" "}
                <span className="font-num text-bordeaux-bright">
                  {formatPrice(cap)} ₽
                </span>
              </div>
              <input
                type="range"
                min={facets.min}
                max={facets.max}
                step={10000}
                value={cap}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                className="w-full accent-bordeaux"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-2 text-[13px] font-semibold text-[#9AA4B2]">
        Найдено: <span className="font-num text-white">{list.length}</span>
      </div>

      <div className="space-y-3">
        {list.map((car) => (
          <button
            key={car.id}
            onClick={() => onOpen(car.id)}
            className="flex w-full items-center gap-3 rounded-[16px] border border-line-dark bg-graphite-2 p-2.5 text-left"
          >
            <div className="relative h-[64px] w-[88px] flex-none overflow-hidden rounded-[10px] bg-black">
              {/* eslint-disable-next-line */}
              <img
                src={car.images[0]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Flag code={car.country} className="h-3 w-4" />
                <span className="truncate font-bold">{car.model}</span>
              </div>
              <div className="text-[12px] text-[#9AA4B2]">
                {car.year} · {car.engine}
              </div>
              <div className="font-num text-[16px] font-bold text-bordeaux-bright">
                {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
              </div>
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onToggleFav(car.id);
              }}
              className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${
                isFav(car.id) ? "bg-bordeaux text-white" : "text-chrome"
              }`}
            >
              <Heart
                className={`h-[18px] w-[18px] ${isFav(car.id) ? "fill-white" : ""}`}
              />
            </span>
          </button>
        ))}
        {list.length === 0 ? (
          <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
            Ничего не найдено
          </p>
        ) : null}
      </div>
    </>
  );
}

function FavView({
  cars,
  onOpen,
  onRemove,
  onBack,
}: {
  cars: Car[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <>
      <Header2 title="Избранное" onBack={onBack} />
      <div className="space-y-3">
        {cars.length === 0 ? (
          <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
            Здесь пока пусто. Добавляйте авто кнопкой ♥.
          </p>
        ) : (
          cars.map((car) => (
            <div
              key={car.id}
              className="flex items-center gap-3 rounded-[16px] border border-line-dark bg-graphite-2 p-2.5"
            >
              <button
                onClick={() => onOpen(car.id)}
                className="h-[56px] w-[80px] flex-none overflow-hidden rounded-[10px] bg-black"
              >
                {/* eslint-disable-next-line */}
                <img src={car.images[0]} alt="" className="h-full w-full object-cover" />
              </button>
              <button
                onClick={() => onOpen(car.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate font-bold">{car.model}</div>
                <div className="font-num text-[15px] font-bold text-bordeaux-bright">
                  {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
                </div>
              </button>
              <button
                onClick={() => onRemove(car.id)}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-bordeaux text-white"
              >
                <Heart className="h-[18px] w-[18px] fill-white" />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function CarView({
  car,
  fav,
  inCompare,
  onToggleCompare,
  onToggleFav,
  onBack,
  onLead,
  showInAppCta,
}: {
  car: Car;
  fav: boolean;
  inCompare: boolean;
  onToggleCompare: () => void;
  onToggleFav: () => void;
  onBack: () => void;
  onLead: () => void;
  showInAppCta: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const prev = () =>
    setIdx((i) => (i - 1 + car.images.length) % car.images.length);
  const next = () => setIdx((i) => (i + 1) % car.images.length);

  return (
    <>
      <Header2 title={car.model} onBack={onBack} />
      <div className="relative aspect-[16/11] overflow-hidden rounded-[16px] bg-black">
        {/* eslint-disable-next-line */}
        <img src={car.images[idx]} alt="" className="h-full w-full object-cover" />
        {car.images.length > 1 ? (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-graphite/80 text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-graphite/80 text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-graphite/80 px-2 py-0.5 font-num text-[12px]">
              {idx + 1}/{car.images.length}
            </div>
          </>
        ) : null}
        {car.isNew ? (
          <span className="absolute right-3 top-3 rounded-full bg-bordeaux px-3 py-1 text-[11px] font-extrabold uppercase text-white">
            Новинка
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Flag code={car.country} className="h-4 w-6" />
        <span className="text-[14px] font-semibold text-chrome">
          {countries[car.country].label} · {car.trim}
        </span>
      </div>
      <h2 className="mt-1 text-[24px] font-extrabold uppercase leading-none">
        {car.model}
      </h2>
      <div className="mt-1 text-[13px] text-[#9AA4B2]">
        {car.year} · {car.engine} · {car.gearbox} · {car.drive}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Price label="до Твери" value={car.priceTverRub ?? car.priceRub} accent />
        {car.priceMoscowRub ? (
          <Price label="до Москвы" value={car.priceMoscowRub} />
        ) : null}
      </div>

      <ul className="mt-4 space-y-1.5">
        {car.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-[13.5px] text-[#C7CFD6]">
            <Check className="mt-0.5 h-4 w-4 flex-none text-success" />
            {h}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onToggleFav}
          className={`btn flex-1 ${
            fav
              ? "border border-bordeaux-bright bg-bordeaux/15 text-white"
              : "border border-line-dark text-white"
          }`}
        >
          <Heart className={`h-[18px] w-[18px] ${fav ? "fill-bordeaux-bright text-bordeaux-bright" : ""}`} />
          {fav ? "В избранном" : "В избранное"}
        </button>
        {showInAppCta ? (
          <button onClick={onLead} className="btn btn-primary flex-1">
            Оставить заявку
          </button>
        ) : null}
      </div>
      <button
        onClick={onToggleCompare}
        className={`btn mt-3 w-full ${
          inCompare
            ? "border border-bordeaux-bright bg-bordeaux/15 text-white"
            : "border border-line-dark text-white"
        }`}
      >
        <Scale className="h-[18px] w-[18px]" />
        {inCompare ? "В сравнении" : "Добавить к сравнению"}
      </button>
    </>
  );
}

function LeadView({
  car,
  formRef,
  onBack,
  onSubmit,
  showInAppCta,
}: {
  car?: Car;
  formRef: React.MutableRefObject<{ name: string; phone: string; carId?: string }>;
  onBack: () => void;
  onSubmit: (name: string, phone: string) => void;
  showInAppCta: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    formRef.current = { name, phone, carId: car?.id };
  }, [name, phone, car, formRef]);

  function maskPhone(v: string) {
    let d = v.replace(/\D/g, "");
    if (d[0] === "8") d = "7" + d.slice(1);
    else if (d[0] === "9") d = "7" + d;
    else if (d && d[0] !== "7") d = "7" + d;
    d = d.slice(0, 11);
    const r = d.slice(1);
    if (!r) return d ? "+7" : "";
    let out = "+7 (" + r.slice(0, 3);
    if (r.length >= 3) out += ")";
    if (r.length > 3) out += " " + r.slice(3, 6);
    if (r.length >= 6) out += "-" + r.slice(6, 8);
    if (r.length >= 8) out += "-" + r.slice(8, 10);
    return out;
  }

  return (
    <>
      <Header2 title="Заявка на расчёт" onBack={onBack} />
      {car ? (
        <div className="mb-4 flex items-center gap-3 rounded-[16px] border border-line-dark bg-graphite-2 p-2.5">
          {/* eslint-disable-next-line */}
          <img
            src={car.images[0]}
            alt=""
            className="h-12 w-16 flex-none rounded-[8px] object-cover"
          />
          <div>
            <div className="font-bold">{car.model}</div>
            <div className="font-num text-[14px] font-bold text-bordeaux-bright">
              {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
            </div>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          className="field-dark"
        />
        <input
          value={phone}
          inputMode="tel"
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          placeholder="+7 (___) ___-__-__"
          className="field-dark"
        />
      </div>
      <p className="mt-2 text-[12px] text-[#8C97A1]">
        Нажимая «Отправить», вы соглашаетесь с обработкой персональных данных.
        Перезвоним в течение 15 минут.
      </p>
      {showInAppCta ? (
        <button
          onClick={() => onSubmit(name, phone)}
          className="btn btn-primary mt-4 w-full"
        >
          Отправить заявку
        </button>
      ) : null}
    </>
  );
}

/* ---------- Примерный калькулятор «под ключ» ---------- */
// Коэффициенты приблизительные — для предварительной оценки.
// Точную смету подтверждает менеджер.
const EUR_RUB = 105; // примерный курс €
const DELIVERY: Record<CountryCode, number> = {
  kr: 120000,
  cn: 90000,
  jp: 130000,
  eu: 160000,
};
const DOCS = 60000; // СБКТС / ЭПТС / брокер
const SERVICE = 80000; // услуги компании
type Age = "u3" | "a35" | "o5";

function dutyPerCc(cc: number, age: Age) {
  const base =
    cc <= 1000 ? 1.5 : cc <= 1500 ? 1.7 : cc <= 1800 ? 2.5 : cc <= 2300 ? 2.7 : cc <= 3000 ? 3.0 : 3.6;
  const old =
    cc <= 1000 ? 3.0 : cc <= 1500 ? 3.2 : cc <= 1800 ? 3.5 : cc <= 2300 ? 4.8 : cc <= 3000 ? 5.0 : 5.7;
  return age === "o5" ? old : base;
}

function CalcView({ onBack, onLead }: { onBack: () => void; onLead: () => void }) {
  const [country, setCountry] = useState<CountryCode>("kr");
  const [priceStr, setPriceStr] = useState("");
  const [volStr, setVolStr] = useState("");
  const [age, setAge] = useState<Age>("a35");
  const [electric, setElectric] = useState(false);

  const price = Number(priceStr) || 0;
  const volume = Number(volStr) || 0;
  const delivery = DELIVERY[country];
  const util = age === "u3" ? 3400 : 5200;
  const duty = electric
    ? Math.round(price * 0.15)
    : age === "u3"
      ? Math.round(price * 0.48)
      : Math.round(volume * dutyPerCc(volume, age) * EUR_RUB);
  const total = price + delivery + duty + util + DOCS + SERVICE;
  const ready = price > 0 && (electric || volume > 0);

  const ageBtns: [Age, string][] = [
    ["u3", "до 3 лет"],
    ["a35", "3–5 лет"],
    ["o5", "старше 5"],
  ];

  return (
    <>
      <Header2 title="Калькулятор под ключ" onBack={onBack} />
      <p className="-mt-2 mb-4 text-[13px] text-[#9AA4B2]">
        Примерная стоимость авто в РФ: доставка, пошлина, утильсбор, оформление и
        услуги. Точный расчёт подтвердит менеджер.
      </p>

      <div className="space-y-3">
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            Страна
          </span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DELIVERY) as CountryCode[]).map((code) => (
              <button
                key={code}
                onClick={() => setCountry(code)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${
                  country === code
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                <Flag code={code} className="h-3 w-4" />
                {countries[code].label}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            Цена авто в стране, ₽
          </span>
          <input
            value={priceStr}
            inputMode="numeric"
            onChange={(e) => setPriceStr(e.target.value.replace(/\D/g, ""))}
            placeholder="например, 1 500 000"
            className="field-dark"
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            Возраст авто
          </span>
          <div className="flex gap-2">
            {ageBtns.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setAge(v)}
                className={`flex-1 rounded-full border px-2 py-2 text-[13px] font-bold ${
                  age === v
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className={electric ? "pointer-events-none opacity-40" : ""}>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            Объём двигателя, см³
          </span>
          <input
            value={volStr}
            inputMode="numeric"
            disabled={electric}
            onChange={(e) => setVolStr(e.target.value.replace(/\D/g, ""))}
            placeholder="например, 1600"
            className="field-dark"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={electric}
            onChange={(e) => setElectric(e.target.checked)}
            className="h-4 w-4 accent-bordeaux"
          />
          <span className="text-[14px] font-semibold">Электромобиль</span>
        </label>
      </div>

      {/* Результат */}
      <div className="mt-5 rounded-[18px] border border-line-dark bg-graphite-2 p-4">
        <CalcRow label="Стоимость авто" value={price} />
        <CalcRow label={`Доставка (${countries[country].label})`} value={delivery} />
        <CalcRow label="Таможенная пошлина" value={duty} hint={!ready ? "—" : undefined} />
        <CalcRow label="Утильсбор" value={util} />
        <CalcRow label="Оформление (СБКТС, ЭПТС, брокер)" value={DOCS} />
        <CalcRow label="Услуги компании" value={SERVICE} />
        <div className="mt-3 flex items-center justify-between border-t border-line-dark pt-3">
          <span className="text-[13px] font-bold uppercase tracking-wide text-chrome">
            Итого под ключ
          </span>
          <span className="font-num text-[22px] font-extrabold text-bordeaux-bright">
            {ready ? `${formatPrice(total)} ₽` : "—"}
          </span>
        </div>
      </div>

      <p className="mt-2 text-[12px] text-[#8C97A1]">
        Расчёт примерный (курс €{EUR_RUB}, ставки усреднены). Итоговую смету
        фиксирует менеджер по конкретному авто.
      </p>

      <button onClick={onLead} className="btn btn-primary mt-4 w-full">
        Оставить заявку на точный расчёт
      </button>
    </>
  );
}

function CalcRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-[13.5px]">
      <span className="text-[#C7CFD6]">{label}</span>
      <span className="font-num font-bold text-white">
        {hint ?? `${formatPrice(value)} ₽`}
      </span>
    </div>
  );
}

/* ---------- Домашнее меню ---------- */
type HomeTarget =
  | "list"
  | "calc"
  | "subscribe"
  | "compare"
  | "reviews"
  | "favorites"
  | "faq";

function HomeView({
  favCount,
  compareCount,
  go,
  onLead,
}: {
  favCount: number;
  compareCount: number;
  go: (name: HomeTarget) => void;
  onLead: () => void;
}) {
  const items: {
    name: HomeTarget;
    label: string;
    sub: string;
    icon: typeof CarIcon;
    primary?: boolean;
  }[] = [
    { name: "list", label: "Каталог", sub: "Авто в наличии и под заказ", icon: CarIcon, primary: true },
    { name: "calc", label: "Калькулятор", sub: "Расчёт под ключ", icon: Calculator },
    { name: "subscribe", label: "Подписка", sub: "Сообщим о новинках", icon: Bell },
    { name: "compare", label: "Сравнить", sub: compareCount ? `${compareCount} выбрано` : "До 3 авто", icon: Scale },
    { name: "reviews", label: "Отзывы", sub: "Мнения клиентов", icon: Star },
    { name: "faq", label: "Вопросы", sub: "Частые вопросы", icon: HelpCircle },
    { name: "favorites", label: "Избранное", sub: favCount ? `${favCount} авто` : "Сохранённые", icon: Heart },
  ];
  return (
    <>
      <div className="mb-4 grain overflow-hidden rounded-[20px] border border-line-dark bg-[radial-gradient(420px_180px_at_85%_-20%,#3a1714,#161b22_70%)] p-4">
        <div className="text-[15.5px] font-extrabold leading-snug">
          Авто из Кореи, Китая, Японии и ЕС — под ключ
        </div>
        <div className="mt-1 text-[12.5px] text-[#9AA4B2]">
          Честный расчёт с растаможкой. Выберите раздел 👇
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <button
            key={it.name}
            onClick={() => go(it.name)}
            className={`flex flex-col items-center gap-2 rounded-[18px] border p-4 text-center transition-transform active:scale-[0.98] ${
              it.primary
                ? "col-span-2 border-bordeaux-bright bg-bordeaux/[0.12]"
                : "border-line-dark bg-graphite-2"
            }`}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                it.primary ? "bg-bordeaux text-white" : "bg-graphite text-bordeaux-bright"
              }`}
            >
              <it.icon className="h-5 w-5" />
            </span>
            <span className="text-[16px] font-extrabold">{it.label}</span>
            <span className="text-[12px] text-[#9AA4B2]">{it.sub}</span>
          </button>
        ))}
      </div>
      <button onClick={onLead} className="btn btn-primary mt-3 w-full">
        <Send className="h-[18px] w-[18px]" /> Оставить заявку
      </button>
    </>
  );
}

/* ---------- Подписка на подбор ---------- */
const SUB_COUNTRIES = [
  ["", "Любая"],
  ["Корея", "Корея"],
  ["Китай", "Китай"],
  ["Япония", "Япония"],
  ["Европа", "Европа"],
] as const;
const SUB_BODIES = ["", "Седан", "Кроссовер", "Внедорожник", "Хэтчбек", "Минивэн"];

function SubscribeView({
  initData,
  inTg,
  onBack,
  haptic: hapticOk,
}: {
  initData: string;
  inTg: boolean;
  onBack: () => void;
  haptic: () => void;
}) {
  const [country, setCountry] = useState("");
  const [body, setBody] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const lab = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]";

  async function submit() {
    if (!inTg || !initData) {
      showToast("Подписка доступна при открытии из Telegram", "error");
      return;
    }
    setLoading(true);
    const r = await apiSubscribe(initData, {
      country: country || undefined,
      body: body || undefined,
      budget: budget ? Number(budget) : undefined,
    });
    setLoading(false);
    if (r.ok) {
      hapticOk();
      setDone(true);
    } else showToast("Не удалось оформить: " + (r.error || ""), "error");
  }

  if (done) {
    return (
      <>
        <Header2 title="Подписка" onBack={onBack} />
        <div className="rounded-[18px] border border-success/40 bg-success/10 p-5 text-center">
          <Bell className="mx-auto h-8 w-8 text-success" />
          <p className="mt-2 text-[16px] font-bold">Подписка оформлена!</p>
          <p className="mt-1 text-[13px] text-[#C7CFD6]">
            Сообщим в этом боте, как только появится подходящее авто.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header2 title="Подписка на подбор" onBack={onBack} />
      <p className="-mt-2 mb-4 text-[13px] text-[#9AA4B2]">
        Укажите параметры — пришлём уведомление, когда появится подходящее авто.
      </p>
      <div className="space-y-3">
        <div>
          <span className={lab}>Страна</span>
          <div className="flex flex-wrap gap-2">
            {SUB_COUNTRIES.map(([v, label]) => (
              <button
                key={label}
                onClick={() => setCountry(v)}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-bold ${
                  country === v
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={lab}>Тип кузова</span>
          <div className="flex flex-wrap gap-2">
            {SUB_BODIES.map((b) => (
              <button
                key={b || "any"}
                onClick={() => setBody(b)}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-bold ${
                  body === b
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                {b || "Любой"}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className={lab}>Бюджет до, ₽</span>
          <input
            value={budget}
            inputMode="numeric"
            onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
            placeholder="например, 2 500 000"
            className="field-dark"
          />
        </label>
      </div>
      <button onClick={submit} className="btn btn-primary mt-4 w-full">
        {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Bell className="h-[18px] w-[18px]" />}
        Подписаться
      </button>
    </>
  );
}

/* ---------- Отзывы ---------- */
function ReviewsView({ onBack }: { onBack: () => void }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  useEffect(() => {
    fetchReviews().then(setReviews);
  }, []);
  return (
    <>
      <Header2 title="Отзывы клиентов" onBack={onBack} />
      {reviews === null ? (
        <div className="flex justify-center py-10 text-chrome">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
          Отзывы скоро появятся.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-[16px] border border-line-dark bg-graphite-2 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">{r.name}</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < r.rating ? "fill-bordeaux-bright text-bordeaux-bright" : "text-[#3a424c]"}`}
                    />
                  ))}
                </span>
              </div>
              {r.car ? <div className="text-[12px] text-[#8C97A1]">{r.car}</div> : null}
              <p className="mt-1.5 text-[13.5px] text-[#C7CFD6]">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- FAQ ---------- */
function FaqView({ onBack }: { onBack: () => void }) {
  const [faq, setFaq] = useState<Faq[] | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  useEffect(() => {
    fetchFaq().then(setFaq);
  }, []);
  return (
    <>
      <Header2 title="Частые вопросы" onBack={onBack} />
      {faq === null ? (
        <div className="flex justify-center py-10 text-chrome">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {faq.map((f, i) => (
            <div key={i} className="overflow-hidden rounded-[14px] border border-line-dark bg-graphite-2">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-2 p-3.5 text-left"
              >
                <span className="text-[14px] font-bold">{f.q}</span>
                <ChevronRight
                  className={`h-4 w-4 flex-none text-chrome transition-transform ${open === i ? "rotate-90" : ""}`}
                />
              </button>
              {open === i ? (
                <p className="px-3.5 pb-3.5 text-[13px] text-[#C7CFD6]">{f.a}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <a
        href={site.telegramHref}
        target="_blank"
        rel="noreferrer"
        className="btn btn-primary mt-4 w-full"
      >
        <Send className="h-[18px] w-[18px]" /> Задать вопрос менеджеру
      </a>
    </>
  );
}

/* ---------- Сравнение ---------- */
function CompareView({
  cars,
  onRemove,
  onClear,
  onBack,
  onOpenCatalog,
}: {
  cars: Car[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onBack: () => void;
  onOpenCatalog: () => void;
}) {
  const rows: [string, (c: Car) => string][] = [
    ["Цена под ключ", (c) => `${formatPrice(c.priceTverRub ?? c.priceRub)} ₽`],
    ["Год", (c) => String(c.year)],
    ["Страна", (c) => countries[c.country].label],
    ["Кузов", (c) => c.bodyType || "—"],
    ["Двигатель", (c) => c.engine],
    ["Мощность", (c) => (c.powerHp ? `${c.powerHp} л.с.` : "—")],
    ["Топливо", (c) => c.fuelType || "—"],
    ["Коробка", (c) => c.gearbox],
    ["Привод", (c) => c.drive],
    ["Цвет", (c) => c.color || "—"],
  ];
  if (cars.length === 0) {
    return (
      <>
        <Header2 title="Сравнение" onBack={onBack} />
        <div className="rounded-[18px] border border-line-dark bg-graphite-2 p-6 text-center">
          <Scale className="mx-auto h-8 w-8 text-chrome" />
          <p className="mt-2 font-bold">Список сравнения пуст</p>
          <p className="mt-1 text-[13px] text-[#9AA4B2]">
            Откройте карточку авто и нажмите «Добавить к сравнению» (до 3 авто).
          </p>
          <button onClick={onOpenCatalog} className="btn btn-primary mt-4 w-full">
            <CarIcon className="h-[18px] w-[18px]" /> В каталог
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-[18px] font-extrabold uppercase">Сравнение</h1>
        <button onClick={onClear} className="ml-auto text-[12.5px] font-bold text-bordeaux-bright">
          Очистить
        </button>
      </div>
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-graphite" />
              {cars.map((c) => (
                <th key={c.id} className="min-w-[140px] p-2 align-top">
                  <div className="relative overflow-hidden rounded-[12px] border border-line-dark bg-graphite-2 p-2">
                    <button
                      onClick={() => onRemove(c.id)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-graphite/80 text-bordeaux-bright"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {/* eslint-disable-next-line */}
                    <img src={c.images[0]} alt="" className="h-16 w-full rounded-[8px] object-cover" />
                    <div className="mt-1.5 text-[12.5px] font-bold leading-tight">{c.model}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn], ri) => (
              <tr key={label} className={ri % 2 ? "bg-white/[0.02]" : ""}>
                <td className="sticky left-0 bg-graphite px-2 py-2 text-[11.5px] font-bold uppercase tracking-wide text-[#8C97A1]">
                  {label}
                </td>
                {cars.map((c) => (
                  <td key={c.id} className="px-2 py-2 font-num text-white">
                    {fn(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-[#8C97A1]">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Header2({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="truncate text-[18px] font-extrabold uppercase">{title}</h1>
    </div>
  );
}

function Price({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-line-dark bg-graphite-2 px-3 py-2.5">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8C97A1]">
        под ключ {label}
      </div>
      <div
        className={`font-num text-[18px] font-bold ${accent ? "text-bordeaux-bright" : "text-white"}`}
      >
        {formatPrice(value)} ₽
      </div>
    </div>
  );
}
