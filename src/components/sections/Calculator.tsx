import { useEffect, useRef, useState } from "react";
import {
  Car,
  Ship,
  Landmark,
  Wrench,
  Equal,
  Send,
  ArrowRight,
  ShieldCheck,
  Clock,
  Lock,
} from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

const trust = [
  { icon: Clock, label: "Ответ за 15 минут" },
  { icon: ShieldCheck, label: "Работаем по договору" },
  { icon: Lock, label: "Данные не передаём" },
];

const breakdown = [
  {
    icon: Car,
    label: "Цена в стране",
    note: "реальная стоимость авто на аукционе/у дилера",
    pct: 62,
    color: "#AEBAC2",
  },
  {
    icon: Ship,
    label: "Логистика",
    note: "доставка до РФ выбранным маршрутом",
    pct: 12,
    color: "#5C6D76",
  },
  {
    icon: Landmark,
    label: "Таможня",
    note: "пошлины, утильсбор, оформление",
    pct: 18,
    color: "#9C1A12",
  },
  {
    icon: Wrench,
    label: "Наши услуги",
    note: "подбор, проверка, сопровождение",
    pct: 8,
    color: "#530700",
  },
];

function CostBar() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    if (reduce) setShown(true);
    else obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="mt-7">
      <div className="mb-2 flex justify-between text-[12px] font-semibold uppercase tracking-[0.1em] text-[#9AA4B2]">
        <span>Из чего складывается цена</span>
        <span className="text-chrome">= 100% под ключ</span>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-line-dark bg-graphite-3">
        {breakdown.map((b) => (
          <div
            key={b.label}
            className="h-full transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: shown ? `${b.pct}%` : "0%",
              background: b.color,
            }}
            title={`${b.label} — ${b.pct}%`}
          />
        ))}
      </div>
    </div>
  );
}

export function Calculator() {
  return (
    <section
      id="calc"
      className="grain relative scroll-mt-20 overflow-hidden bg-graphite pb-[88px] pt-[120px] text-white [clip-path:polygon(0_3.2rem,100%_0,100%_100%,0_100%)]"
    >
      <div className="glow-blob right-[6%] top-[8%] h-72 w-72 animate-glow-pan bg-bordeaux/25" aria-hidden />
      <div className="wrap relative grid items-stretch gap-12 lg:grid-cols-2">
        <Reveal direction="right">
          <div className="mb-3 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <span className="slash" aria-hidden /> Расчёт под ключ
          </div>
          <h2 className="text-[clamp(30px,4vw,48px)] text-shine">
            Рассчитайте стоимость вашего авто
          </h2>
          <p className="mt-3 max-w-md text-[16px] text-[#C7CFD6]">
            Никаких «звоните — расскажем». Раскладываем итоговую цену на честные
            составляющие, чтобы вы видели, за что платите.
          </p>

          <CostBar />

          <div className="mt-6 space-y-3">
            {breakdown.map(({ icon: Icon, label, note, pct, color }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-card border border-line-dark bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]"
              >
                <div
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] text-white"
                  style={{ background: color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-white">{label}</div>
                    <div className="font-num text-[15px] font-bold text-chrome">
                      ~{pct}%
                    </div>
                  </div>
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
        </Reveal>

        <Reveal direction="left" delay={120} className="flex h-full flex-col justify-between gap-4">
          <div className="glass rounded-card p-6 shadow-glow sm:p-8">
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

          {/* доверие — чтобы колонка не пустовала */}
          <div className="grid grid-cols-3 gap-3">
            {trust.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="glass flex flex-col items-center gap-2 rounded-card px-3 py-4 text-center"
              >
                <Icon className="h-5 w-5 text-chrome" />
                <span className="text-[12px] font-semibold leading-tight text-[#C7CFD6]">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <a
            href={site.telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group glass flex items-center justify-between gap-4 rounded-card p-4 transition-colors hover:bg-white/[0.07]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-bordeaux text-white">
                <Send className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[14px] font-bold text-white">
                  Удобнее в Telegram?
                </span>
                <span className="block text-[12.5px] text-[#9AA4B2]">
                  Напишите — пришлём расчёт в переписке
                </span>
              </span>
            </span>
            <ArrowRight className="h-5 w-5 flex-none text-chrome transition-transform group-hover:translate-x-1" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
