/**
 * Базовые элементы интерфейса CRM.
 *
 * Намеренно свои, а не общие с сайтом: у витрины кнопки крупные и с эффектами,
 * здесь нужна плотность — на экране должно помещаться много строк, а нажатия
 * происходить без задержек на анимацию.
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
  primary: "bg-[#1f2937] text-white hover:bg-[#111827] disabled:bg-[#9aa3ae]",
  ghost: "border border-[#d7dde4] bg-white text-[#1f2937] hover:border-[#9aa3ae] hover:bg-[#f7f9fb]",
  danger: "border border-[#f0c4c1] bg-white text-[#b42318] hover:bg-[#fef3f2]",
  quiet: "text-[#5b6470] hover:bg-[#eef1f5] hover:text-[#1f2937]",
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
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
      <span className="mb-1 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7b8593]">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-[#8a93a0]">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-[#d7dde4] bg-white px-3 text-[14px] text-[#111827] outline-none transition-colors placeholder:text-[#aab2bd] focus:border-[#1f2937] disabled:bg-[#f3f5f7]";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${INPUT_CLASS} ${className}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`min-h-[84px] w-full rounded-lg border border-[#d7dde4] bg-white px-3 py-2 text-[14px] leading-relaxed text-[#111827] outline-none transition-colors placeholder:text-[#aab2bd] focus:border-[#1f2937] ${className}`}
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
    <section className={`rounded-xl border border-[#e3e8ee] bg-white ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3">
          <h3 className="text-[14px] font-bold text-[#111827]">{title}</h3>
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
      style={color ? { backgroundColor: `${color}1a`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-[#9aa3ae]" />
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[15px] font-bold text-[#111827]">{title}</p>
      {hint ? <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-[#6b7480]">{hint}</p> : null}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0d1116]/45 p-4 sm:p-8">
      <div
        className={`w-full rounded-xl bg-white shadow-[0_30px_80px_-20px_rgba(13,17,22,0.4)] ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#eef1f5] px-5 py-3.5">
          <h3 className="text-[15px] font-bold text-[#111827]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-[#7b8593] transition-colors hover:bg-[#eef1f5] hover:text-[#111827]"
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
            className={`pointer-events-auto rounded-lg px-4 py-3 text-[13.5px] font-semibold text-white shadow-lg ${
              item.kind === "error" ? "bg-[#b42318]" : "bg-[#1f2937]"
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
