import { X, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { type Car, formatPrice } from "@/data/cars";
import { Flag } from "@/components/icons/Flag";
import { countries } from "@/lib/site";
import { useUI } from "@/lib/ui";

const ROWS: { label: string; get: (c: Car) => string }[] = [
  { label: "Год", get: (c) => String(c.year) },
  { label: "Двигатель", get: (c) => c.engine || "—" },
  { label: "Мощность", get: (c) => (c.powerHp ? `${c.powerHp} л.с.` : "—") },
  { label: "Пробег", get: (c) => c.mileage || "—" },
  { label: "Коробка", get: (c) => c.gearbox || "—" },
  { label: "Привод", get: (c) => c.drive || "—" },
  { label: "Кузов", get: (c) => c.bodyType || "—" },
  { label: "Цвет", get: (c) => c.color || "—" },
  { label: "Комплектация", get: (c) => c.trim || "—" },
  { label: "Страна", get: (c) => countries[c.country].label },
];

export function CompareModal({
  cars,
  onClose,
}: {
  cars: Car[];
  onClose: () => void;
}) {
  const { removeCompare, clearCompare, openCar } = useUI();
  const prices = cars.map((c) => c.priceTverRub ?? c.priceRub);
  const minPrice = prices.length ? Math.min(...prices) : 0;

  return (
    <Modal onClose={onClose} label="Сравнение авто" className="max-w-5xl">
      {cars.length < 2 ? (
        <div className="px-2 py-10 text-center">
          <p className="text-[17px] font-bold text-white">
            Добавьте минимум 2 авто
          </p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#9AA4B2]">
            В каталоге нажмите значок «весы» на карточке — выбранные авто
            появятся здесь для сравнения бок о бок.
          </p>
          <Button variant="ghost" onClick={onClose} className="mt-5">
            В каталог
          </Button>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between pr-10">
            <span className="text-[14px] font-semibold text-[#9AA4B2]">
              Сравниваем {cars.length}
            </span>
            <button
              type="button"
              onClick={clearCompare}
              className="flex items-center gap-1.5 text-[13px] font-bold text-bordeaux-bright hover:underline"
            >
              <Trash2 className="h-4 w-4" /> Очистить
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-[128px] bg-graphite-2" />
                  {cars.map((car) => (
                    <th key={car.id} className="p-2 align-top">
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Убрать"
                          onClick={() => removeCompare(car.id)}
                          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-bordeaux"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openCar(car.id)}
                          className="block w-full text-left"
                        >
                          {/* eslint-disable-next-line */}
                          <img
                            src={car.images[0]}
                            alt={car.model}
                            className="mb-2 aspect-[16/10] w-full rounded-[10px] object-cover"
                          />
                          <span className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                            <Flag code={car.country} className="h-3 w-4" />
                            {car.model}
                          </span>
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <td className="sticky left-0 z-10 bg-graphite-2 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#9AA4B2]">
                    Цена
                  </td>
                  {cars.map((car) => {
                    const p = car.priceTverRub ?? car.priceRub;
                    const best = p === minPrice;
                    return (
                      <td
                        key={car.id}
                        className={`whitespace-nowrap px-3 py-2 text-center font-num text-[17px] font-bold ${
                          best ? "text-success" : "text-bordeaux-bright"
                        }`}
                      >
                        {formatPrice(p)} ₽
                        {best ? (
                          <div className="text-[10px] font-bold uppercase text-success">
                            дешевле всех
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? "bg-graphite-3" : ""}>
                    <td className={`sticky left-0 z-10 py-2.5 pl-1 pr-3 text-[13px] font-semibold text-[#9AA4B2] ${i % 2 ? "bg-graphite-3" : "bg-graphite-2"}`}>
                      {row.label}
                    </td>
                    {cars.map((car) => (
                      <td
                        key={car.id}
                        className="px-3 py-2.5 text-center text-[14px] text-white"
                      >
                        {row.get(car)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
