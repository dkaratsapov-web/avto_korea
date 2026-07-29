import { CarSilhouette } from "@/components/icons/CarSilhouette";

// Премиальный фон для тёмных hero-секций: точечная сетка + мягкое свечение
// (бордо/сталь) + хром-силуэт авто водяным знаком. Всё декоративно.
export function HeroBackdrop({ silhouette = true }: { silhouette?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Точечная сетка — плавно исчезает влево */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(174,186,194,0.10) 1px, transparent 1.4px)",
          backgroundSize: "28px 28px",
          maskImage:
            "linear-gradient(90deg, transparent, #000 45%, #000 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, #000 45%, #000 100%)",
        }}
      />

      {/* Диагональные хром-лучи */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, transparent 0 38px, rgba(174,186,194,0.05) 38px 39px)",
          maskImage:
            "radial-gradient(120% 100% at 100% 0%, #000, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(120% 100% at 100% 0%, #000, transparent 70%)",
        }}
      />

      {/* Мягкое свечение */}
      <div className="glow-blob right-[16%] top-[-14%] h-72 w-72 animate-glow-pan bg-bordeaux/25" />
      <div className="glow-blob bottom-[-18%] right-[40%] h-64 w-64 animate-glow-pan bg-steel/15 [animation-delay:-7s]" />

      {/* Хром-силуэт авто — водяной знак справа (скрыт на мобильном, чтобы
          не перекрывать текст) */}
      {silhouette ? (
        <CarSilhouette className="absolute right-[-3%] top-1/2 hidden h-[58%] w-auto -translate-y-1/2 opacity-[0.08] animate-fade-up md:block" />
      ) : null}

      {/* Зерно поверх */}
      <div className="grain absolute inset-0" />
    </div>
  );
}
