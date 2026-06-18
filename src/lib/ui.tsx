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

type ModalState =
  | { type: "car"; carId: string }
  | { type: "favorites" }
  | { type: "lead" }
  | null;

type UIContextValue = {
  favorites: string[];
  isFav: (id: string) => boolean;
  toggleFav: (id: string) => void;
  removeFav: (id: string) => void;
  favCount: number;
  modal: ModalState;
  openCar: (id: string) => void;
  openFavorites: () => void;
  openLead: () => void;
  close: () => void;
};

const STORAGE_KEY = "diauto:favorites";
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

export function UIProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      /* ignore */
    }
  }, [favorites]);

  // блокируем скролл, пока открыта модалка
  useEffect(() => {
    if (modal) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
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

  const value = useMemo<UIContextValue>(
    () => ({
      favorites,
      isFav,
      toggleFav,
      removeFav,
      favCount: favorites.length,
      modal,
      openCar: (carId: string) => setModal({ type: "car", carId }),
      openFavorites: () => setModal({ type: "favorites" }),
      openLead: () => setModal({ type: "lead" }),
      close: () => setModal(null),
    }),
    [favorites, isFav, toggleFav, removeFav, modal],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
