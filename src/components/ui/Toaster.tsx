import { useEffect, useRef, useState } from "react";
import { TOAST_EVENT, type ToastDetail, type ToastVariant } from "@/lib/toast";

export function Toaster() {
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<ToastVariant>("success");
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      setMessage(detail.message);
      setVariant(detail.variant ?? "success");
      setShow(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), 3600);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-[26px] left-1/2 z-[80] -translate-x-1/2 rounded-[12px] border border-line-dark bg-graphite px-5 py-[14px] font-semibold text-white shadow-[0_18px_50px_rgba(0,0,0,.4)] transition-all duration-300 ${
        variant === "error"
          ? "border-l-[3px] border-l-bordeaux-bright"
          : "border-l-[3px] border-l-success"
      } ${
        show
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-5 opacity-0"
      }`}
    >
      {message}
    </div>
  );
}
