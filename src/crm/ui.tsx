/**
 * Базовые элементы интерфейса CRM.
 *
 * Намеренно свои, а не общие с сайтом: у витрины кнопки крупные и с эффектами,
 * здесь нужна плотность — на экране должно помещаться много строк, а нажатия
 * происходить без задержек на анимацию.
 *
 * Цвета берутся только из токенов (crm-*): одна и та же вёрстка обслуживает
 * светлую и тёмную тему, ни одного «прибитого» оттенка здесь быть не должно.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Loader2, X } from "lucide-react";

/* ------------------------------------------------------------------ кнопки */

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger" | "quiet";
  size?: "md" | "sm";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  title?: string;
};

const VARIANTS: Record<string, string> = {
  primary:
    "bg-crm-accent text-white shadow-[0_1px_2px_rgba(0,0,0,.16)] hover:bg-crm-accent-2 disabled:bg-crm-ink-3 disabled:shadow-none",
  ghost:
    "border border-crm-line-2 bg-crm-surface text-crm-ink hover:border-crm-ink-3 hover:bg-crm-raise",
  danger: "border border-crm-danger/40 bg-crm-surface text-crm-danger hover:bg-crm-danger-soft",
  quiet: "text-crm-ink-2 hover:bg-crm-soft hover:text-crm-ink",
};

export function Button({
  children,
  onClick,
  type = "button",
  variant = "ghost",
  size = "md",
  disabled,
  loading,
  className = "",
  title,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-[background-color,border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-70 ${
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14px]"
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- поля */

/**
 * Поле объявлено на уровне модуля, а не внутри формы.
 *
 * Компонент, созданный внутри другого компонента, — новый тип при каждом
 * рендере: React размонтирует инпут и заново монтирует, теряя ввод и фокус.
 * Ошибка неочевидная, поэтому оставлено предупреждением.
 */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-crm-ink-3">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-[12px] text-crm-ink-3">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLASS =
  "h-10 w-full rounded-[10px] border border-crm-line-2 bg-crm-surface px-3 text-[14px] text-crm-ink outline-none transition-colors placeholder:text-crm-ink-3 focus:border-crm-accent disabled:bg-crm-soft disabled:text-crm-ink-3";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${INPUT_CLASS} ${className}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`min-h-[84px] w-full rounded-[10px] border border-crm-line-2 bg-crm-surface px-3 py-2 text-[14px] leading-relaxed text-crm-ink outline-none transition-colors placeholder:text-crm-ink-3 focus:border-crm-accent ${className}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select {...rest} className={`${INPUT_CLASS} pr-8 ${className}`}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ блоки */

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-crm-line bg-crm-surface shadow-[var(--crm-shadow)] ${className}`}
    >
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-crm-line px-4 py-3">
          <h3 className="text-[14px] font-bold text-crm-ink">{title}</h3>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({
  children,
  color,
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${className}`}
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-crm-ink-3" />
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[15px] font-bold text-crm-ink">{title}</p>
      {hint ? <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-crm-ink-2">{hint}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- модалка */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // Фон не должен прокручиваться под открытым окном.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8">
      <div
        className={`w-full rounded-2xl border border-crm-line bg-crm-surface shadow-[var(--crm-shadow-lg)] ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-crm-line px-5 py-3.5">
          <h3 className="text-[15px] font-bold text-crm-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-crm-ink-3 transition-colors hover:bg-crm-soft hover:text-crm-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- уведомления */

type Toast = { id: number; text: string; kind: "ok" | "error" };

const ToastContext = createContext<{ show: (text: string, kind?: "ok" | "error") => void } | null>(
  null,
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const show = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, kind }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-[min(420px,calc(100%-24px))] -translate-x-1/2 flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-[13.5px] font-semibold text-white shadow-[var(--crm-shadow-lg)] ${
              item.kind === "error" ? "bg-crm-danger" : "bg-crm-accent"
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast должен вызываться внутри ToastProvider");
  return ctx.show;
}
