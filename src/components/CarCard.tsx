import { useState } from "react";
import { Heart, ArrowRight, Scale, Play } from "lucide-react";
import {
  EngineIcon,
  MileageIcon,
  GearboxIcon,
  DriveIcon,
} from "@/components/icons/SpecIcons";
import { Flag } from "@/components/icons/Flag";
import { CarSilhouette } from "@/components/icons/CarSilhouette";
import { type Car, formatPrice } from "@/data/cars";
import { countries } from "@/lib/site";
import { useUI } from "@/lib/ui";

// Фото авто с запасным вариантом: если картинка не загрузилась или её нет —
// показываем фирменный силуэт вместо чёрного прямоугольника.
function CarImage({ car }: { car: Car }) {
  const [broken, setBroken] = useState(false);
  const src = car.images?.[0];
  if (!src || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-graphite-2 to-graphite">
        <CarSilhouette className="h-[46%] w-[70%] opacity-40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line
    <img
      src={src}
      alt={`${car.model}, ${car.year}`}
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.06]"
    />
  );
}

export function CarCard({ car }: { car: Car }) {
  const country = countries[car.country];
  const { isFav, toggleFav, openCar, isCompare, toggleCompare } = useUI();
  const fav = isFav(car.id);
  const cmp = isCompare(car.id);

  const statusPill = car.isNew
    ? "border-transparent bg-gradient-to-b from-bordeaux-bright to-bordeaux text-white shadow-[0_6px_16px_-4px_rgba(122,20,16,.6)]"
    : "border-white/15 bg-black/55 text-white backdrop-blur";

  return (
    <article
      onClick={() => openCar(car.id)}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_2px_12px_-6px_rgba(20,25,32,0.22)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_54px_-26px_rgba(20,25,32,0.55)]"
    >
      {/* верхняя акцент-линия при наведении */}
      <span className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] scale-x-0 bg-gradient-to-r from-bordeaux-deep via-bordeaux-bright to-chrome transition-transform duration-500 group-hover:scale-x-100" />

      <div className="relative aspect-[16/10] overflow-hidden bg-graphite">
        <CarImage car={car} />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/10" />

        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/85 px-2.5 py-[5px] text-[12.5px] font-bold text-ink shadow-[0_4px_14px_rgba(0,0,0,0.25)] backdrop-blur">
          <Flag code={car.country} className="h-3.5 w-5" />
          {country.label}
        </span>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          <button
            type="button"
            aria-label={cmp ? "Убрать из сравнения" : "Добавить к сравнению"}
            aria-pressed={cmp}
            onClick={(e) => {
              e.stopPropagation();
              toggleCompare(car.id);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-colors ${
              cmp
                ? "border-transparent bg-graphite text-white"
                : "border-white/60 bg-white/80 text-ink hover:bg-white"
            }`}
          >
            <Scale className="h-[17px] w-[17px]" />
          </button>
          <button
            type="button"
            aria-label={fav ? "Убрать из избранного" : "В избранное"}
            aria-pressed={fav}
            onClick={(e) => {
              e.stopPropagation();
              toggleFav(car.id);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-colors ${
              fav
                ? "border-transparent bg-bordeaux text-white"
                : "border-white/60 bg-white/80 text-ink hover:bg-white"
            }`}
          >
            <Heart className={`h-[17px] w-[17px] ${fav ? "fill-white" : ""}`} />
          </button>
        </div>

        {car.isNew ? (
          <span
            className={`absolute bottom-3 left-3 rounded-full border px-[11px] py-[5px] text-[11.5px] font-extrabold uppercase tracking-[0.05em] ${statusPill}`}
          >
            Новинка
          </span>
        ) : null}

        {car.video ? (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2.5 py-[5px] text-[11.5px] font-bold text-white backdrop-blur">
            <Play className="h-3 w-3 fill-white" /> Видео
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[21px] font-extrabold leading-tight tracking-[0.01em] text-ink">
          {car.model}
        </h3>
        <div className="mt-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2">
          {car.year}
          {car.trim ? ` · ${car.trim}` : ""}
        </div>
        {car.addedAt ? (
          <div className="mt-1 text-[11px] font-medium text-ink-2/80">
            В каталоге с {new Date(car.addedAt).toLocaleDateString("ru-RU")}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-line pt-4">
          <Spec icon={<EngineIcon />} text={car.engine} />
          <Spec icon={<MileageIcon />} text={car.mileage} />
          <Spec icon={<GearboxIcon />} text={car.gearbox} />
          <Spec icon={<DriveIcon />} text={car.drive} />
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div className="leading-none">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-2">
              Под ключ до Твери
            </div>
            <div className="whitespace-nowrap font-num text-[26px] font-extrabold text-bordeaux">
              {formatPrice(car.priceTverRub ?? car.priceRub)}
              <small className="ml-1 text-[15px] font-semibold text-ink-2">₽</small>
            </div>
          </div>
          <span className="flex h-[46px] flex-none items-center gap-2 rounded-[13px] bg-gradient-to-b from-graphite-2 to-graphite px-4 text-[14px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(17,21,26,0.7)] transition-all duration-300 group-hover:from-bordeaux-bright group-hover:to-bordeaux">
            Подробнее
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  );
}

function Spec({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[#2c333b]">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-paper text-steel [&>svg]:h-[16px] [&>svg]:w-[16px]">
        {icon}
      </span>
      <span className="truncate">{text}</span>
    </div>
  );
}
