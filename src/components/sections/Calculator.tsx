import { Car, Ship, Landmark, Wrench, Equal } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";

const breakdown = [
  { icon: Car, label: "Цена в стране", note: "реальная стоимость авто на аукционе/у дилера" },
  { icon: Ship, label: "Логистика", note: "доставка до РФ выбранным маршрутом" },
  { icon: Landmark, label: "Таможня", note: "пошлины, утильсбор, оформление" },
  { icon: Wrench, label: "Наши услуги", note: "подбор, проверка, сопровождение" },
];

export function Calculator() {
  return (
    <section
      id="calc"
      className="relative scroll-mt-20 overflow-hidden bg-graphite py-[78px] text-white"
    >
      <div className="chrome-line absolute inset-x-0 top-0" />
      <div className="wrap grid items-start gap-12 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <span className="slash" aria-hidden /> Расчёт под ключ
          </div>
          <h2 className="text-[clamp(30px,4vw,48px)] text-white">
            Рассчитайте стоимость вашего авто
          </h2>
          <p className="mt-3 max-w-md text-[16px] text-[#C7CFD6]">
            Никаких «звоните — расскажем». Раскладываем итоговую цену на честные
            составляющие, чтобы вы видели, за что платите.
          </p>

          <div className="mt-8 space-y-3">
            {breakdown.map(({ icon: Icon, label, note }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-card border border-line-dark bg-white/[0.03] p-4"
              >
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-graphite-3 text-chrome">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-white">{label}</div>
                  <div className="text-[13.5px] text-[#9AA4B2]">{note}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 rounded-card border border-bordeaux-bright/40 bg-bordeaux/15 p-4">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-bordeaux text-white">
                <Equal className="h-5 w-5" />
              </div>
              <div className="font-display text-[22px] uppercase text-white">
                Итог под ключ в РФ
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-line-dark bg-white/[0.04] p-6 sm:p-8">
          <h3 className="mb-1 text-[22px] text-white">Заявка на расчёт</h3>
          <p className="mb-6 text-[14px] text-[#9AA4B2]">
            Заполните, что знаете — остальное уточним. Перезвоним в течение 15
            минут.
          </p>
          <LeadForm
            layout="full"
            tone="dark"
            source="Калькулятор — форма расчёта"
            submitLabel="Получить честный расчёт"
          />
        </div>
      </div>
    </section>
  );
}
