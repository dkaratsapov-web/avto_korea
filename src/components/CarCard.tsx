import { Heart, ArrowRight } from "lucide-react";
import {
  EngineIcon,
  MileageIcon,
  GearboxIcon,
  DriveIcon,
} from "@/components/icons/SpecIcons";
import { type Car, statusLabels, formatPrice } from "@/data/cars";
import { countries } from "@/lib/site";
import { useUI } from "@/lib/ui";
import { useTilt } from "@/lib/useTilt";

export function CarCard({ car }: { car: Car }) {
  const country = countries[car.country];
  const { isFav, toggleFav, openCar } = useUI();
  const tilt = useTilt(4);
  const fav = isFav(car.id);

  return (
    <article
      onClick={() => openCar(car.id)}
      className="group h-full cursor-pointer overflow-hidden rounded-card border border-line bg-white transition-[box-shadow,border-color] duration-300 hover:border-[#d4d8de] hover:shadow-card"
    >
      <div
        ref={tilt.ref}
        onPointerMove={tilt.onMove}
        onPointerLeave={tilt.onLeave}
        className="flex h-full flex-col transition-transform duration-300 [transform-style:preserve-3d]"
      >
      <div className="relative aspect-[16/10] overflow-hidden bg-graphite">
        {/* eslint-disable-next-line */}
        <img
          src={car.images[0]}
          alt={`${car.model}, ${car.year}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />

        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/[0.92] px-[11px] py-[5px] text-[13px] font-bold text-ink">
          <span className="text-[15px]">{country.flag}</span>
          {country.label}
        </span>

        <button
          type="button"
          aria-label={fav ? "Убрать из избранного" : "В избранное"}
          aria-pressed={fav}
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(car.id);
          }}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors ${
            fav
              ? "bg-bordeaux text-white"
              : "bg-white/85 text-ink hover:bg-white"
          }`}
        >
          <Heart className={`h-[18px] w-[18px] ${fav ? "fill-white" : ""}`} />
        </button>

        <span className="absolute bottom-3 left-3 rounded-full bg-bordeaux px-[11px] py-[5px] text-[12px] font-extrabold uppercase tracking-[0.04em] text-white">
          {car.isNew ? "Новинка" : statusLabels[car.status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-[18px] pb-5">
        <h3 className="text-[22px] tracking-[0.01em] text-ink">{car.model}</h3>
        <div className="mb-[14px] mt-0.5 text-[14px] font-semibold text-ink-2">
          {car.year} · {car.trim}
        </div>

        <div className="grid grid-cols-2 gap-x-[14px] gap-y-[10px] border-y border-line py-[14px]">
          <Spec icon={<EngineIcon />} text={car.engine} />
          <Spec icon={<MileageIcon />} text={car.mileage} />
          <Spec icon={<GearboxIcon />} text={car.gearbox} />
          <Spec icon={<DriveIcon />} text={car.drive} />
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="leading-none">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-2">
              Под ключ до Твери
            </div>
            <div className="font-num text-[26px] font-bold text-bordeaux">
              {formatPrice(car.priceTverRub ?? car.priceRub)}{" "}
              <small className="text-[15px] font-semibold text-ink-2">₽</small>
            </div>
          </div>
          <span className="flex h-[46px] items-center gap-2 rounded-[11px] bg-graphite px-4 text-[14px] font-bold text-white transition-colors group-hover:bg-bordeaux">
            Подробнее
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
      </div>
    </article>
  );
}

function Spec({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-[9px] text-[13.5px] font-semibold text-[#3c444d]">
      <span className="flex-none text-steel [&>svg]:h-[18px] [&>svg]:w-[18px]">
        {icon}
      </span>
      {text}
    </div>
  );
}
