import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cars as defaultCars, cleanTrim, type Car } from "@/data/cars";
import { fetchSharedCatalog } from "@/lib/api";

const KEY = "diauto:cars";

/**
 * Приводим каталог к виду, пригодному для показа, откуда бы он ни пришёл —
 * из KV, из пререндера или из localStorage. Сейчас чистим только комплектацию:
 * в старых записях там лежат целые фразы из поста.
 */
function normalize(list: Car[]): Car[] {
  return list.map((c) =>
    c.trim === cleanTrim(c.trim) ? c : { ...c, trim: cleanTrim(c.trim) },
  );
}

/** Каталог, переданный пререндером в разметку страницы. */
function bootstrapCars(): Car[] | null {
  if (typeof window === "undefined") return null;
  const boot = (window as unknown as { __CATALOG__?: Car[] }).__CATALOG__;
  return Array.isArray(boot) && boot.length ? boot : null;
}

function load(): Car[] {
  if (typeof window === "undefined") return defaultCars;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Car[]) : defaultCars;
  } catch {
    return defaultCars;
  }
}

type CarsContextValue = {
  cars: Car[];
  setAll: (list: Car[]) => void;
  upsert: (car: Car) => void;
  remove: (id: string) => void;
  reset: () => void;
  isCustom: boolean;
};

const CarsContext = createContext<CarsContextValue | null>(null);

export function CarsProvider({
  children,
  initialCars,
}: {
  children: ReactNode;
  /** Каталог, вшитый в страницу при пререндере — чтобы в готовом HTML были
      реальные авто, а не демо-набор, и чтобы при загрузке не было мигания. */
  initialCars?: Car[];
}) {
  const [cars, setCars] = useState<Car[]>(
    () => normalize(initialCars ?? bootstrapCars() ?? load()),
  );
  const [isCustom, setIsCustom] = useState(
    () => typeof window !== "undefined" && !!window.localStorage.getItem(KEY),
  );

  // Общий каталог из бэкенда (KV) — источник правды для всех посетителей.
  // localStorage остаётся кэшем для мгновенного рендера/офлайна.
  // Периодически обновляем, чтобы новые авто из бота подхватывались без
  // перезагрузки страницы. Обновляем состояние только при реальных изменениях.
  useEffect(() => {
    let alive = true;
    let last = "";

    const sync = () => {
      fetchSharedCatalog().then((shared) => {
        // Пустой/отсутствующий общий каталог не затираем — оставляем текущие
        // (демо-каталог по умолчанию), пока не появятся реальные авто из канала.
        if (!alive || !shared || !Array.isArray(shared) || shared.length === 0)
          return;
        const next = JSON.stringify(shared);
        if (next === last) return;
        last = next;
        setCars(normalize(shared));
        try {
          window.localStorage.setItem(KEY, JSON.stringify(shared));
        } catch {
          /* ignore */
        }
      });
    };

    sync();
    const id = window.setInterval(sync, 120000); // каждые 2 минуты
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const save = useCallback((updater: (prev: Car[]) => Car[]) => {
    setCars((prev) => {
      const next = updater(prev);
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
        setIsCustom(true);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<CarsContextValue>(
    () => ({
      cars,
      setAll: (list) => save(() => list),
      upsert: (car) =>
        save((prev) =>
          prev.some((c) => c.id === car.id)
            ? prev.map((c) => (c.id === car.id ? car : c))
            : [...prev, car],
        ),
      remove: (id) => save((prev) => prev.filter((c) => c.id !== id)),
      reset: () => {
        try {
          window.localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
        setIsCustom(false);
        setCars(defaultCars);
      },
      isCustom,
    }),
    [cars, save, isCustom],
  );

  return <CarsContext.Provider value={value}>{children}</CarsContext.Provider>;
}

export function useCars() {
  const ctx = useContext(CarsContext);
  if (!ctx) throw new Error("useCars must be used within CarsProvider");
  return ctx;
}
