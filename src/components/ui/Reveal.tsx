import { useEffect, useRef, useState, type ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "scale" | "none";

const hiddenByDir: Record<Direction, string> = {
  up: "opacity-0 translate-y-8",
  down: "opacity-0 -translate-y-8",
  left: "opacity-0 translate-x-10",
  right: "opacity-0 -translate-x-10",
  scale: "opacity-0 scale-[0.94]",
  none: "opacity-0",
};

/**
 * Появление элемента при попадании во вьюпорт.
 * Уважает prefers-reduced-motion: при reduce контент показывается сразу.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className = "",
  once = true,
}: {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setInstant(true);
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            if (once) obs.unobserve(e.target);
          } else if (!once) {
            setShown(false);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      style={instant ? undefined : { transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
        shown
          ? "opacity-100 translate-x-0 translate-y-0 scale-100"
          : hiddenByDir[direction]
      } ${className}`}
    >
      {children}
    </div>
  );
}
