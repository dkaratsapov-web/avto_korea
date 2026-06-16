import { Fragment, type CSSProperties, type ReactNode } from "react";

/**
 * Бесконечная бегущая строка. Контент дублируется дважды, лента сдвигается на -50%.
 */
export function Marquee({
  items,
  duration = 28,
  reverse = false,
  className = "",
}: {
  items: ReactNode[];
  duration?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`group flex overflow-hidden ${className}`}
      style={{ "--marquee-duration": `${duration}s` } as CSSProperties}
    >
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className={`flex shrink-0 items-center gap-10 pr-10 animate-marquee ${
            reverse ? "[animation-direction:reverse]" : ""
          } group-hover:[animation-play-state:paused] motion-reduce:animate-none`}
        >
          {items.map((item, i) => (
            <Fragment key={i}>{item}</Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
