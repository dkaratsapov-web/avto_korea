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

        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/85 px-2 py-1 text-[12.5px] font-bold text-ink shadow-[0_4px_14px_rgba(0,0,0,0.25)] backdrop-blur sm:left-3 sm:top-3 sm:px-2.5 sm:py-[5px]">
          <Flag code={car.country} className="h-3.5 w-5" />
          <span className="hidden sm:inline">{country.label}</span>
        </span>

        <div className="absolute right-2.5 top-2.5 flex items-center gap-2 sm:right-3 sm:top-3">
          <button
            type="button"
            aria-label={cmp ? "Убрать из сравнения" : "Добавить к сравнению"}
            aria-pressed={cmp}
            onClick={(e) => {
              e.stopPropagation();
              toggleCompare(car.id);
            }}
            className={`hidden h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-colors sm:flex ${
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

        {car.video ? (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2.5 py-[5px] text-[11.5px] font-bold text-white backdrop-blur">
            <Play className="h-3 w-3 fill-white" /> Видео
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <h3 className="font-display text-[15px] font-extrabold leading-tight tracking-[0.01em] text-ink sm:text-[21px]">
          {car.model}
        </h3>
        <div className="mt-1 hidden text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-2 sm:block sm:text-[13px]">
          {car.year}
          {car.trim ? ` · ${car.trim}` : ""}
        </div>
        {car.addedAt ? (
          <div className="mt-1 hidden text-[11px] font-medium text-ink-2/80 sm:block">
            В каталоге с {new Date(car.addedAt).toLocaleDateString("ru-RU")}
          </div>
        ) : null}

        <div className="mt-3 hidden grid-cols-1 gap-x-3 gap-y-2 border-t border-line pt-3 sm:mt-4 sm:grid sm:grid-cols-2 sm:gap-y-2.5 sm:pt-4">
          <Spec icon={<EngineIcon />} text={car.engine} />
          <Spec icon={<MileageIcon />} text={car.mileage} />
          {/* Коробка и привод — только там, где для них есть место. */}
          <Spec icon={<GearboxIcon />} text={car.gearbox} className="max-sm:hidden" />
          <Spec icon={<DriveIcon />} text={car.drive} className="max-sm:hidden" />
        </div>

        {/*
         * Подвал карточки: цена и «Подробнее».
         *
         * Раньше эти двое стояли в одну строку намертво — цена с
         * whitespace-nowrap, кнопка с flex-none. Сжаться не мог никто, и когда
         * карточка становилась узкой, кнопка просто выезжала за её край и
         * обрезалась: на экране оставалось «Подробне» без стрелки.
         *
         * Узкой карточка становится не на телефоне, а на десктопе — там, где
         * сетка переключается на три и четыре колонки раньше, чем карточкам
         * хватает ширины: 292 px при 1280 и 332 px при 1440. Плюс цена бывает
         * восьмизначной: «12 400 000 ₽» шире привычных семи знаков.
         *
         * Теперь так: крупный кегль цены включается только там, где место
         * заведомо есть (2xl — от 1536 px), а до него цена и кнопка чуть
         * компактнее. И на всякий случай разрешён перенос: если даже так не
         * помещается, кнопка уходит на свою строку целиком. Перенос — это
         * страховка от восьмизначных цен, а не основная раскладка.
         */}
        <div className="mt-auto flex flex-col items-stretch gap-2.5 pt-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-3 sm:gap-y-2.5 sm:pt-5">
          <div className="min-w-0 leading-none">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-2 sm:mb-1.5 sm:text-[10.5px]">
              Под ключ до Твери
            </div>
            <div className="whitespace-nowrap font-num text-[18px] font-extrabold text-bordeaux sm:text-[22px] 2xl:text-[26px]">
              {formatPrice(car.priceTverRub ?? car.priceRub)}
              <small className="ml-1 text-[12px] font-semibold text-ink-2 sm:text-[14px] 2xl:text-[15px]">
                ₽
              </small>
            </div>
          </div>
          <span className="hidden h-10 flex-none items-center justify-center gap-1.5 rounded-[12px] sm:ml-auto sm:flex bg-gradient-to-b from-graphite-2 to-graphite px-3 text-[12.5px] font-bold text-white sm:h-[44px] sm:gap-2 sm:rounded-[13px] sm:px-3.5 sm:text-[13.5px] 2xl:h-[46px] 2xl:px-4 2xl:text-[14px] shadow-[0_8px_20px_-10px_rgba(17,21,26,0.7)] transition-all duration-300 group-hover:from-bordeaux-bright group-hover:to-bordeaux">
            Подробнее
            <ArrowRight className="h-4 w-4 flex-none transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  );
}

function Spec({
  icon,
  text,
  className = "",
}: {
  icon: React.ReactNode;
  text: string;
  className?: string;
}) {
  // Пустую характеристику не показываем: лучше её отсутствие, чем выдуманное
  // значение или пустая строка в сетке.
  if (!text) return null;
  return (
    <div
      className={`flex items-center gap-2 text-[11.5px] font-semibold text-[#2c333b] sm:gap-2.5 sm:text-[13px] ${className}`}
    >
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-[8px] bg-paper text-steel sm:h-7 sm:w-7 sm:rounded-[9px] [&>svg]:h-[14px] [&>svg]:w-[14px] sm:[&>svg]:h-[16px] sm:[&>svg]:w-[16px]">
        {icon}
      </span>
      <span className="truncate">{text}</span>
    </div>
  );
}
