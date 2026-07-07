import { Link } from "react-router-dom";

// Логотип «ДиАвто69» — фирменная эмблема (public/logo.png|webp).
// Размер задаётся через className (высота), напр. "h-9 w-auto".
export function Logo({
  className = "h-9 w-auto",
}: {
  /** оставлено для обратной совместимости, не используется */
  withIcon?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="ДиАвто69 — на главную"
      className="inline-flex items-center"
    >
      <picture>
        <source srcSet="/logo.webp" type="image/webp" />
        <img
          src="/logo.png"
          alt="ДиАвто69"
          className={`block ${className}`}
          loading="eager"
          decoding="async"
        />
      </picture>
    </Link>
  );
}
