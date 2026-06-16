import { useMemo, useState } from "react";
import { CarCard } from "@/components/CarCard";
import { Button } from "@/components/ui/Button";
import { cars } from "@/data/cars";
import { countries, type CountryCode } from "@/lib/site";

type Filter = "all" | CountryCode;

const tabs: { value: Filter; label: string; flag?: string }[] = [
  { value: "all", label: "Все" },
  { value: "kr", label: countries.kr.label, flag: countries.kr.flag },
  { value: "cn", label: countries.cn.label, flag: countries.cn.flag },
  { value: "jp", label: countries.jp.label, flag: countries.jp.flag },
  { value: "eu", label: countries.eu.label, flag: countries.eu.flag },
];

const PAGE = 6;

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
    <section id="catalog" className="scroll-mt-20 bg-paper py-[78px] pb-[90px]">
      <div className="wrap">
        <div className="mb-2.5 flex items-end justify-between gap-6 max-[600px]:flex-col max-[600px]:items-start">
          <div>
            <div className="mb-3 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-bordeaux">
              <span className="slash" aria-hidden /> Актуальное наличие
            </div>
            <h2 className="text-[clamp(30px,4vw,48px)] text-ink">
              Авто в пути и под заказ
            </h2>
          </div>
          <p className="max-w-[340px] text-[15px] text-ink-2">
            Цена указана уже под ключ в РФ — с доставкой, растаможкой и нашими
            услугами.
          </p>
        </div>

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
                {t.flag ? <span className="text-[15px]">{t.flag}</span> : null}
                {t.label}
              </button>
            );
          })}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-3 gap-[22px] max-[600px]:grid-cols-1 max-[920px]:grid-cols-2">
            {visible.map((car) => (
              <CarCard key={car.id} car={car} />
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
              Показать ещё авто
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
