import { useEffect, useRef, useState } from "react";

/**
 * Пословное появление текста (слова всплывают со стаггером).
 * Уважает prefers-reduced-motion — показывает текст сразу.
 */
export function RevealWords({
  text,
  className = "",
  step = 70,
}: {
  text: string;
  className?: string;
  step?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(false);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInstant(true);
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const words = text.split(" ");

  return (
    <span ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <span
            className={`inline-block ${
              instant
                ? ""
                : "transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            } ${shown ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}
            style={instant ? undefined : { transitionDelay: `${i * step}ms` }}
          >
            {w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
