import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cars as defaultCars, type Car } from "@/data/cars";

const KEY = "diauto:cars";

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

export function CarsProvider({ children }: { children: ReactNode }) {
  const [cars, setCars] = useState<Car[]>(load);
  const [isCustom, setIsCustom] = useState(
    () => typeof window !== "undefined" && !!window.localStorage.getItem(KEY),
  );

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
