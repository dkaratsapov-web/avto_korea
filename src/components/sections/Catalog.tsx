import { useMemo, useState } from "react";
import { CarCard } from "@/components/CarCard";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { Flag } from "@/components/icons/Flag";
import { cars } from "@/data/cars";
import { countries, type CountryCode } from "@/lib/site";

type Filter = "all" | CountryCode;
const PAGE = 6; // 3 в ряд × 2 ряда

// Только страны, которые реально есть в витрине.
const present = Array.from(new Set(cars.map((c) => c.country))) as CountryCode[];
const tabs: { value: Filter; label: string; flag?: string }[] = [
  { value: "all", label: "Все" },
  ...present.map((code) => ({
    value: code,
    label: countries[code].label,
    flag: countries[code].flag,
  })),
];

export function Catalog() {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(
    () => cars.filter((c) => filter === "all" || c.country === filter),
    [filter],
  );
  const visible = filtered.slice(0, shown);
  const hasMore = shown < filtered.length;

  function changeFilter(value: Filter) {
    setFilter(value);
    setShown(PAGE);
  }

  return (
    <section id="catalog" className="scroll-mt-24 bg-paper py-[88px]">
      <div className="wrap">
        <Reveal className="mb-2.5 flex items-end justify-between gap-6 max-[600px]:flex-col max-[600px]:items-start">
          <div>
            <div className="mb-3 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-bordeaux">
              <span className="slash" aria-hidden /> Актуальное наличие
            </div>
            <h2 className="text-[clamp(30px,4vw,48px)] text-ink">
              Авто в наличии
            </h2>
          </div>
          <div className="flex max-w-[360px] flex-col items-start gap-3">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-bordeaux/25 bg-bordeaux/[0.06] px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-bordeaux">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bordeaux-bright/60 [animation-duration:2.4s] motion-reduce:hidden" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bordeaux-bright" />
              </span>
              Цена уже под ключ в РФ
            </span>
            <span className="text-[14.5px] text-ink-2">
              С доставкой, растаможкой, утильсбором и ЭПТС. Нажмите на карточку —
              откроются фото, описание и форма.
            </span>
          </div>
        </Reveal>

        {tabs.length > 2 ? (
          <div className="my-7 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр по странам">
            {tabs.map((t) => {
              const active = filter === t.value;
              return (
                <button
                  key={t.value}
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeFilter(t.value)}
                  className={`flex items-center gap-[7px] rounded-full border-[1.5px] px-[18px] py-2.5 text-[14px] font-bold transition-[0.15s] ${
                    active
                      ? "border-graphite bg-graphite text-white"
                      : "border-line bg-white text-ink-2 hover:border-steel hover:text-ink"
                  }`}
                >
                  {t.value !== "all" ? (
                    <Flag code={t.value} className="h-3.5 w-5" />
                  ) : null}
                  {t.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="h-7" />
        )}

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((car, i) => (
              <Reveal key={car.id} direction="up" delay={(i % 3) * 80}>
                <CarCard car={car} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-line bg-white px-6 py-10 text-center text-ink-2">
            По этой стране сейчас нет авто в витрине. Оставьте заявку — подберём
            под ваш запрос.
          </p>
        )}

        {hasMore ? (
          <div className="mt-[34px] flex justify-center">
            <Button
              variant="ghost-light"
              onClick={() => setShown((s) => s + PAGE)}
            >
              Смотреть ещё ({filtered.length - shown})
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
