import { useState } from "react";
import {
  Heart,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { LeadForm } from "@/components/LeadForm";
import { Button } from "@/components/ui/Button";
import { Flag } from "@/components/icons/Flag";
import {
  EngineIcon,
  MileageIcon,
  GearboxIcon,
  DriveIcon,
} from "@/components/icons/SpecIcons";
import { type Car, formatPrice } from "@/data/cars";
import { countries, site } from "@/lib/site";
import { useUI } from "@/lib/ui";

export function CarModal({ car, onClose }: { car: Car; onClose: () => void }) {
  const { isFav, toggleFav } = useUI();
  const [idx, setIdx] = useState(0);
  const country = countries[car.country];
  const fav = isFav(car.id);

  const prev = () => setIdx((i) => (i - 1 + car.images.length) % car.images.length);
  const next = () => setIdx((i) => (i + 1) % car.images.length);

  return (
    <Modal onClose={onClose} label={car.model} className="max-w-5xl">
      <div className="flex max-h-[92vh] flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
       <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Галерея */}
        <div className="relative bg-graphite p-4 sm:p-5">
          <div className="relative aspect-[16/11] overflow-hidden rounded-[16px] bg-black">
            {/* eslint-disable-next-line */}
            <img
              src={car.images[idx]}
              alt={`${car.model} — фото ${idx + 1}`}
              className="h-full w-full object-cover"
            />
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[13px] font-bold text-ink">
              <Flag code={car.country} className="h-3.5 w-5" />
              {country.label}
            </span>
            {car.isNew ? (
              <span className="absolute right-3 top-3 rounded-full bg-bordeaux px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.05em] text-white">
                Новинка
              </span>
            ) : null}
            {car.images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Предыдущее фото"
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-graphite/80 text-white backdrop-blur transition-colors hover:bg-bordeaux"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Следующее фото"
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-graphite/80 text-white backdrop-blur transition-colors hover:bg-bordeaux"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
            {car.images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Фото ${i + 1}`}
                className={`aspect-[4/3] w-full overflow-hidden rounded-[10px] border-2 transition-colors ${
                  i === idx
                    ? "border-bordeaux-bright"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Инфо */}
        <div className="flex flex-col gap-4 p-5 text-white sm:p-7">
          <div>
            <div className="mb-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-chrome">
              {car.trim}
            </div>
            <h3 className="text-[28px] font-extrabold uppercase leading-none text-white">
              {car.model}
            </h3>
            <div className="mt-1.5 text-[14px] font-semibold text-[#9AA4B2]">
              {car.year} год · {car.mileage}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-line-dark bg-white/[0.03] p-4">
            <Spec icon={<EngineIcon />} text={car.engine} />
            <Spec icon={<MileageIcon />} text={car.mileage} />
            <Spec icon={<GearboxIcon />} text={car.gearbox} />
            <Spec icon={<DriveIcon />} text={car.drive} />
          </div>

          <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {car.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-[13px] text-[#C7CFD6]">
                <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-success" />
                {h}
              </li>
            ))}
          </ul>

          <div className="mt-auto grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-card border border-line-dark bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2">
                Под ключ до Твери
              </div>
              <div className="font-num text-[20px] font-bold text-bordeaux-bright sm:text-[24px]">
                {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
              </div>
            </div>
            {car.priceMoscowRub ? (
              <div className="min-w-0 rounded-card border border-line-dark bg-white/[0.03] px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2">
                  Под ключ до Москвы
                </div>
                <div className="font-num text-[20px] font-bold text-white sm:text-[24px]">
                  {formatPrice(car.priceMoscowRub)} ₽
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => toggleFav(car.id)}
              className={`btn flex-1 ${
                fav
                  ? "border border-bordeaux-bright bg-bordeaux/15 text-white"
                  : "border border-line-dark text-white hover:bg-white/5"
              }`}
            >
              <Heart
                className={`h-[18px] w-[18px] ${fav ? "fill-bordeaux-bright text-bordeaux-bright" : ""}`}
              />
              {fav ? "В избранном" : "В избранное"}
            </button>
            <Button
              href={site.telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              className="flex-1"
            >
              <Send className="h-[18px] w-[18px]" />
              В Telegram
            </Button>
          </div>
        </div>
       </div>

        {/* Широкая горизонтальная форма снизу */}
        <div className="border-t border-line-dark bg-graphite-2/50 p-5 sm:px-7 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[16px] font-bold text-white">
                Запросить расчёт по этому авто
              </div>
              <div className="text-[13px] text-[#9AA4B2]">
                Оставьте имя и телефон — перезвоним в течение 15 минут.
              </div>
            </div>
            <LeadForm
              layout="compact"
              tone="dark"
              firstField="name"
              source={`Каталог — ${car.model}`}
              submitLabel="Запросить"
              className="lg:flex-none"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Spec({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[14px] font-semibold text-[#C7CFD6]">
      <span className="flex-none text-steel [&>svg]:h-[18px] [&>svg]:w-[18px]">
        {icon}
      </span>
      {text}
    </div>
  );
}
