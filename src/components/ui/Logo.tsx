import { Link } from "react-router-dom";

// Логотип «ДиАвто69».
// variant="full" — полная эмблема (машина в овале + надпись); для прелоадера/футера.
// variant="wordmark" — только надпись «ДиАвто69»; читается в компактной шапке.
// Размер задаётся через className (высота), напр. "h-8 w-auto".
export function Logo({
  variant = "full",
  className = "h-9 w-auto",
}: {
  variant?: "full" | "wordmark";
  /** оставлено для обратной совместимости, не используется */
  withIcon?: boolean;
  className?: string;
}) {
  const src = variant === "wordmark" ? "/logo-wordmark" : "/logo";
  return (
    <Link
      to="/"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="ДиАвто69 — на главную"
      className="inline-flex items-center"
    >
      <picture>
        <source srcSet={`${src}.webp`} type="image/webp" />
        <img
          src={`${src}.png`}
          alt="ДиАвто69"
          className={`block ${className}`}
          loading="eager"
          decoding="async"
        />
      </picture>
    </Link>
  );
}
