import { SectionHeading } from "@/components/ui/SectionHeading";
import { countries } from "@/lib/site";

const routes = [
  {
    code: "kr" as const,
    term: "30–40 дней",
    perk: "Свежие авто, бережная эксплуатация, богатые комплектации.",
  },
  {
    code: "cn" as const,
    term: "35–45 дней",
    perk: "Электро и гибриды, новые модели, выгодная цена.",
  },
  {
    code: "jp" as const,
    term: "30–45 дней",
    perk: "Надёжность, честный пробег, проверенные аукционы.",
  },
  {
    code: "eu" as const,
    term: "40–55 дней",
    perk: "Премиум-сегмент, полные опции, история обслуживания.",
  },
];

export function Geography() {
  return (
    <section className="bg-white py-[78px]">
      <div className="wrap">
        <SectionHeading
          eyebrow="География и сроки"
          title="Возим из четырёх направлений"
          description="Подбираем страну под задачу: где-то выгоднее цена, где-то — свежесть или премиум."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {routes.map((r) => {
            const c = countries[r.code];
            return (
              <div
                key={r.code}
                className="flex flex-col rounded-card border border-line bg-paper p-6 transition-[0.2s] hover:-translate-y-1 hover:border-[#d4d8de] hover:bg-white hover:shadow-card"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[34px] leading-none">{c.flag}</span>
                  <div>
                    <div className="font-display text-[22px] uppercase text-ink">
                      {c.label}
                    </div>
                    <div className="text-[13px] font-semibold text-ink-2">
                      → РФ
                    </div>
                  </div>
                </div>
                <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-graphite px-3 py-1.5 font-num text-[14px] font-bold text-chrome">
                  {r.term}
                </div>
                <p className="text-[14.5px] leading-relaxed text-ink-2">
                  {r.perk}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[13.5px] text-ink-2">
          Сроки ориентировочные и зависят от маршрута и загрузки таможни.
        </p>
      </div>
    </section>
  );
}
