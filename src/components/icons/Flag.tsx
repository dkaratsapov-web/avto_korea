import type { CountryCode } from "@/lib/site";

const src = (code: CountryCode) => `${import.meta.env.BASE_URL}flags/${code}.svg`;

/** Флаг страны картинкой (эмодзи-флаги не рендерятся на Windows). */
export function Flag({
  code,
  className = "h-4 w-6",
}: {
  code: CountryCode;
  className?: string;
}) {
  return (
    <img
      src={src(code)}
      alt=""
      aria-hidden
      className={`inline-block shrink-0 rounded-[3px] object-cover ${className}`}
    />
  );
}
