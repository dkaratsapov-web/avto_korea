import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { logFav } from "@/lib/api";
import { trackCarView } from "@/lib/carViews";

type ModalState =
  | { type: "car"; carId: string }
  | { type: "favorites" }
  | { type: "compare" }
  | { type: "lead" }
  | null;

type UIContextValue = {
  favorites: string[];
  isFav: (id: string) => boolean;
  toggleFav: (id: string) => void;
  removeFav: (id: string) => void;
  favCount: number;
  compare: string[];
  isCompare: (id: string) => boolean;
  toggleCompare: (id: string) => void;
  removeCompare: (id: string) => void;
  clearCompare: () => void;
  compareCount: number;
  modal: ModalState;
  openCar: (id: string) => void;
  openFavorites: () => void;
  openCompare: () => void;
  openLead: () => void;
  close: () => void;
};

const STORAGE_KEY = "diauto:favorites";
const COMPARE_KEY = "diauto:compare";
export const MAX_COMPARE = 4;
const UIContext = createContext<UIContextValue | null>(null);

function loadFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function loadCompare(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [compare, setCompare] = useState<string[]>(loadCompare);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      /* ignore */
    }
  }, [favorites]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COMPARE_KEY, JSON.stringify(compare));
    } catch {
      /* ignore */
    }
  }, [compare]);

  /**
   * Блокируем скролл страницы, пока открыта модалка.
   *
   * Одного overflow: hidden мало: страница перестаёт быть прокручиваемой и
   * позиция теряется — после закрытия карточки человека выбрасывало почти в
   * начало каталога. Поэтому фиксируем body с отрицательным top, а при
   * закрытии возвращаем прокрутку ровно туда, где она была.
   */
  useEffect(() => {
    if (!modal) return;
    const y = window.scrollY;
    const { body } = document;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      // Возврат прокрутки — СИНХРОННО, в этом же тике. Через requestAnimationFrame
      // браузер успевал нарисовать один кадр со страницей в позиции 0 (прыжок
      // наверх) и лишь следующим кадром возвращал вниз — выглядело как дёрганье.
      // Чтение offsetHeight форсит пересчёт раскладки: пока body был зафиксирован,
      // страница «схлопывалась», и без форса scrollTo упёрся бы в устаревшую
      // высоту. Теперь высота уже актуальна, и прокрутка встаёт ровно на место
      // до первой отрисовки — без промежуточного кадра.
      void body.offsetHeight;
      window.scrollTo(0, y);
    };
  }, [modal]);

  // закрытие по Esc
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const isFav = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );
  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => {
      const already = prev.includes(id);
      if (!already) logFav(id); // учёт популярности (добавление в избранное)
      return already ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }, []);
  const removeFav = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((x) => x !== id));
  }, []);

  const isCompare = useCallback(
    (id: string) => compare.includes(id),
    [compare],
  );
  const toggleCompare = useCallback((id: string) => {
    setCompare((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, id],
    );
  }, []);
  const removeCompare = useCallback((id: string) => {
    setCompare((prev) => prev.filter((x) => x !== id));
  }, []);
  const clearCompare = useCallback(() => setCompare([]), []);

  const value = useMemo<UIContextValue>(
    () => ({
      favorites,
      isFav,
      toggleFav,
      removeFav,
      favCount: favorites.length,
      compare,
      isCompare,
      toggleCompare,
      removeCompare,
      clearCompare,
      compareCount: compare.length,
      modal,
      openCar: (carId: string) => {
        // Единственная точка входа в карточку — здесь и считаем глубину просмотра.
        trackCarView(carId);
        setModal({ type: "car", carId });
      },
      openFavorites: () => setModal({ type: "favorites" }),
      openCompare: () => setModal({ type: "compare" }),
      openLead: () => setModal({ type: "lead" }),
      close: () => setModal(null),
    }),
    [favorites, isFav, toggleFav, removeFav, compare, isCompare, toggleCompare, removeCompare, clearCompare, modal],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
