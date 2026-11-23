import { useRef, type PointerEvent } from "react";

/**
 * Лёгкий 3D-наклон элемента вслед за курсором. Отключается при reduce-motion
 * и на сенсорных устройствах (pointer событий мыши там нет).
 */
export function useTilt(max = 7) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-4px)`;
  }

  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = "";
  }

  return { ref, onMove, onLeave };
}
