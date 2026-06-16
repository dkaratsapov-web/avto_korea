import { ArrowRight } from "lucide-react";
import { CarSilhouette } from "@/components/icons/CarSilhouette";
import {
  EngineIcon,
  MileageIcon,
  GearboxIcon,
  DriveIcon,
} from "@/components/icons/SpecIcons";
import { type Car, statusLabels, formatPrice } from "@/data/cars";
import { countries } from "@/lib/site";
import { showToast } from "@/lib/toast";
import { useTilt } from "@/lib/useTilt";

const statusStyle: Record<Car["status"], string> = {
  in_stock:
    "bg-success/[0.16] text-[#1f9d57] border border-success/40",
  in_transit:
    "bg-chrome/20 text-chrome-dark border border-chrome/50",
  on_order:
    "bg-bordeaux-bright/15 text-bordeaux-bright border border-bordeaux-bright/40",
};

export function CarCard({ car }: { car: Car }) {
  const country = countries[car.country];
  const tilt = useTilt(5);

  return (
    <article
      ref={tilt.ref}
      onPointerMove={tilt.onMove}
      onPointerLeave={tilt.onLeave}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white transition-[transform,box-shadow,border-color] duration-300 [transform-style:preserve-3d] hover:border-[#d4d8de] hover:shadow-card"
    >
      <div className="relative flex aspect-[16/10] items-center overflow-hidden bg-[radial-gradient(420px_200px_at_70%_30%,#2b3640_0,#1b222b_60%,#11151a_100%)] px-[18px] pb-[14px] pt-[26px]">
        {/* блик по фото при наведении */}
        <span className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/[0.92] px-[11px] py-[5px] text-[13px] font-bold text-ink">
          <span className="text-[15px]">{country.flag}</span>
          {country.label}
        </span>
        <span
          className={`absolute right-3 top-3 rounded-full px-[11px] py-[5px] text-[12px] font-extrabold uppercase tracking-[0.04em] ${statusStyle[car.status]}`}
        >
          {statusLabels[car.status]}
        </span>
        {car.image ? (
          <img
            src={car.image}
            alt={`${car.model}, ${car.year}`}
            className="w-full drop-shadow-[0_16px_16px_rgba(0,0,0,0.5)]"
          />
        ) : (
          <CarSilhouette className="w-full drop-shadow-[0_16px_16px_rgba(0,0,0,0.5)]" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-[18px] pb-5">
        <h3 className="text-[23px] tracking-[0.01em] text-ink">{car.model}</h3>
        <div className="mb-[14px] mt-0.5 text-[14px] font-semibold text-ink-2">
          {car.year} год
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
              Цена под ключ
            </div>
            <div className="font-num text-[27px] font-bold text-bordeaux">
              {formatPrice(car.priceRub)}{" "}
              <small className="text-[15px] font-semibold text-ink-2">₽</small>
            </div>
          </div>
          <button
            type="button"
            aria-label={`Запросить расчёт по ${car.model}`}
            onClick={() =>
              showToast(`Запрос по ${car.model} принят — скоро напишем.`)
            }
            className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[11px] bg-graphite text-white transition-[0.16s] hover:bg-bordeaux"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
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
