import { useCountUp } from "@/lib/useCountUp";
import { Reveal } from "@/components/ui/Reveal";

type Stat = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
};

// TODO: заменить на реальные цифры заказчика.
const stats: Stat[] = [
  { value: 500, suffix: "+", label: "авто привезли под ключ" },
  { value: 38, label: "дней — средний срок доставки" },
  { value: 4, label: "страны: Корея, Китай, Япония, ЕС" },
  { value: 15, suffix: " мин", label: "и у вас готовый расчёт" },
];

function StatItem({ stat, delay }: { stat: Stat; delay: number }) {
  const { ref, value } = useCountUp(stat.value);
  return (
    <Reveal direction="up" delay={delay} className="text-center">
      <div className="font-num text-[clamp(40px,6vw,68px)] font-bold leading-none text-white">
        <span className="text-bordeaux-bright">{stat.prefix}</span>
        <span ref={ref}>{value}</span>
        <span className="text-chrome">{stat.suffix}</span>
      </div>
      <div className="mx-auto mt-3 max-w-[180px] text-[14px] font-semibold text-[#9AA4B2]">
        {stat.label}
      </div>
    </Reveal>
  );
}

export function Stats() {
  return (
    <section className="grain relative overflow-hidden bg-graphite-2 py-[44px]">
      <div className="glow-blob -left-20 top-0 h-56 w-56 animate-glow-pan bg-bordeaux/25" aria-hidden />
      <div className="glow-blob -right-10 bottom-0 h-52 w-52 animate-glow-pan bg-steel/20 [animation-delay:-7s]" aria-hidden />

      <div className="wrap relative grid grid-cols-2 gap-y-9 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="relative lg:[&:not(:first-child)]:before:absolute lg:[&:not(:first-child)]:before:inset-y-2 lg:[&:not(:first-child)]:before:left-0 lg:[&:not(:first-child)]:before:w-px lg:[&:not(:first-child)]:before:bg-line-dark"
          >
            <StatItem stat={s} delay={i * 90} />
          </div>
        ))}
      </div>
    </section>
  );
}
