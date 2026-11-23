import { Scale, X } from "lucide-react";
import { useUI } from "@/lib/ui";

// Плавающая панель сравнения — появляется, когда выбрано хотя бы одно авто.
export function CompareTray() {
  const { compareCount, openCompare, clearCompare } = useUI();
  if (compareCount < 1) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 px-3">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-graphite/95 py-2 pl-4 pr-2 text-white shadow-[0_14px_38px_rgba(0,0,0,0.45)] backdrop-blur">
        <Scale className="h-[18px] w-[18px] text-chrome" />
        <span className="text-[14px] font-bold">
          К сравнению: <span className="font-num">{compareCount}</span>
        </span>
        <button
          type="button"
          onClick={openCompare}
          disabled={compareCount < 2}
          className="ml-1 rounded-full bg-bordeaux px-4 py-2 text-[14px] font-extrabold text-white transition-colors hover:bg-bordeaux-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          Сравнить
        </button>
        <button
          type="button"
          onClick={clearCompare}
          aria-label="Очистить сравнение"
          className="flex h-9 w-9 items-center justify-center rounded-full text-chrome transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
