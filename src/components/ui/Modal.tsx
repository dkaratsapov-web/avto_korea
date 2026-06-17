import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({
  onClose,
  children,
  className = "",
  label,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative my-0 w-full animate-fade-up rounded-t-[24px] border border-line-dark bg-graphite-2 shadow-[0_30px_80px_rgba(0,0,0,.6)] sm:my-6 sm:rounded-[24px] ${className}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-line-dark bg-graphite/80 text-chrome backdrop-blur transition-colors hover:border-chrome hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
