import type { ReactNode } from "react";

/**
 * Заголовок секции с фирменным «росчерком» (slash) в надзаголовке.
 * tone="light" — для тёмных секций (графит), tone="dark" — для светлых.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  tone = "dark",
  align = "left",
  shine = false,
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  tone?: "light" | "dark";
  align?: "left" | "center";
  shine?: boolean;
  className?: string;
}) {
  const eyebrowColor = tone === "light" ? "text-chrome" : "text-bordeaux";
  const titleColor = shine
    ? "text-shine"
    : tone === "light"
      ? "text-white"
      : "text-ink";
  const descColor = tone === "light" ? "text-chrome" : "text-ink-2";

  return (
    <div
      className={`${align === "center" ? "mx-auto text-center" : ""} ${className}`}
    >
      <div
        className={`mb-3 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] ${eyebrowColor} ${
          align === "center" ? "justify-center" : ""
        }`}
      >
        <span className="slash" aria-hidden />
        {eyebrow}
      </div>
      <h2
        className={`text-[clamp(30px,4vw,48px)] ${titleColor}`}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={`mt-3 max-w-xl text-[15px] ${descColor} ${
            align === "center" ? "mx-auto" : ""
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
