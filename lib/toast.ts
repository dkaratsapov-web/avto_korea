export const TOAST_EVENT = "diauto:toast";

export type ToastVariant = "success" | "error";

export type ToastDetail = {
  message: string;
  variant?: ToastVariant;
};

/** Показать тост из любого клиентского компонента. */
export function showToast(message: string, variant: ToastVariant = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, {
      detail: { message, variant },
    }),
  );
}
