import { Heart, Trash2, ArrowRight } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { Modal } from "@/components/ui/Modal";
import { CarModal } from "@/components/CarModal";
import { CompareModal } from "@/components/CompareModal";
import { LeadForm } from "@/components/LeadForm";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/data/cars";
import { site } from "@/lib/site";
import { Flag } from "@/components/icons/Flag";
import { useUI } from "@/lib/ui";
import { useCars } from "@/lib/carsStore";
import { GOALS, reachGoal } from "@/lib/metrika";

export function ModalHost() {
  const { modal, close, favorites, removeFav, openCar, compare } = useUI();
  const { cars } = useCars();
  if (!modal) return null;

  if (modal.type === "car") {
    const car = cars.find((c) => c.id === modal.carId);
    if (!car) return null;
    return <CarModal car={car} onClose={close} />;
  }

  if (modal.type === "compare") {
    const cmpCars = compare
      .map((id) => cars.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    return <CompareModal cars={cmpCars} onClose={close} />;
  }

  if (modal.type === "lead") {
    return (
      <Modal onClose={close} label="Рассчитать авто" className="max-w-xl">
        <div className="p-6 text-white sm:p-8">
          <div className="mb-1 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <span className="slash" aria-hidden /> Расчёт под ключ
          </div>
          <h3 className="text-[26px] font-extrabold uppercase leading-none text-white">
            Рассчитайте стоимость авто
          </h3>
          <p className="mb-6 mt-2 text-[14px] text-[#9AA4B2]">
            Заполните, что знаете — остальное уточним. Перезвоним в течение 15
            минут.
          </p>
          <LeadForm
            layout="full"
            tone="dark"
            source="Поп-ап «Рассчитать» (шапка)"
            submitLabel="Получить честный расчёт"
            onSent={close}
          />
        </div>
      </Modal>
    );
  }

  // favorites
  const favCars = cars.filter((c) => favorites.includes(c.id));
  return (
    <Modal onClose={close} label="Избранное" className="max-w-2xl">
      <div className="p-6 text-white sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <Heart className="h-6 w-6 fill-bordeaux-bright text-bordeaux-bright" />
          <h3 className="text-[24px] font-extrabold uppercase leading-none text-white">
            Избранное
          </h3>
          <span className="font-num text-[15px] font-bold text-chrome">
            {favCars.length}
          </span>
        </div>

        {favCars.length === 0 ? (
          <div className="rounded-card border border-line-dark bg-white/[0.03] px-6 py-12 text-center">
            <p className="text-[15px] text-[#9AA4B2]">
              Здесь пока пусто. Нажмите «В избранное» в карточке авто — и оно
              появится тут.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {favCars.map((car) => {
              return (
                <div
                  key={car.id}
                  className="flex items-center gap-4 rounded-card border border-line-dark bg-white/[0.03] p-3"
                >
                  <button
                    type="button"
                    onClick={() => openCar(car.id)}
                    className="h-16 w-24 flex-none overflow-hidden rounded-[10px]"
                    aria-label={`Открыть ${car.model}`}
                  >
                    {/* eslint-disable-next-line */}
                    <img
                      src={car.images[0]}
                      alt={car.model}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <Flag code={car.country} className="h-3.5 w-5" />
                      <span className="truncate">{car.model}</span>
                    </div>
                    <div className="font-num text-[15px] font-bold text-bordeaux-bright">
                      {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCar(car.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome transition-colors hover:border-chrome hover:text-white"
                    aria-label="Открыть"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFav(car.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome transition-colors hover:border-bordeaux-bright hover:text-bordeaux-bright"
                    aria-label="Удалить из избранного"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            href={site.telegramHref}
            onClick={() => reachGoal(GOALS.telegram, { place: "Избранное" })}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
          >
            <TelegramIcon className="h-[18px] w-[18px]" />
            Обсудить в Telegram
          </Button>
        </div>
      </div>
    </Modal>
  );
}
