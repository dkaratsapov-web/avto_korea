import { CarSilhouette } from "@/components/icons/CarSilhouette";

export function Logo({
  withIcon = true,
  className = "",
}: {
  withIcon?: boolean;
  className?: string;
}) {
  return (
    <a
      href="#top"
      aria-label="ДиАвто69 — на главную"
      className={`flex items-baseline gap-px font-display text-[26px] font-extrabold tracking-[0.02em] text-white ${className}`}
    >
      {withIcon ? (
        <CarSilhouette className="mr-2 h-[18px] w-[30px] self-center" />
      ) : null}
      <span className="text-chrome">Ди</span>
      <span>Авто</span>
      <span className="text-bordeaux-bright">69</span>
    </a>
  );
}
