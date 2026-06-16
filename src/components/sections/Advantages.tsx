import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  ShieldCheck,
  SearchCheck,
  Headset,
  FileCheck2,
  BadgeCheck,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { useTilt } from "@/lib/useTilt";

const items = [
  {
    icon: Calculator,
    title: "Честный расчёт без накруток",
    text: "Показываем реальную стоимость в стране и каждый этап сметы. Скрытых наценок нет.",
  },
  {
    icon: BadgeCheck,
    title: "Фиксированная цена под ключ",
    text: "Сумма в договоре финальная: авто + логистика + таможня + услуги. Без доплат в процессе.",
  },
  {
    icon: SearchCheck,
    title: "Проверка авто перед покупкой",
    text: "Осмотр, диагностика и проверка истории до выкупа. Берём только то, что проверили сами.",
  },
  {
    icon: Headset,
    title: "Полное сопровождение",
    text: "Ведём от заявки до выдачи ключей: подбор, торг, выкуп, доставка и постановка на учёт.",
  },
  {
    icon: FileCheck2,
    title: "Растаможка и документы",
    text: "Оформляем таможню и все бумаги. Авто приезжает готовым к регистрации в ГИБДД.",
  },
  {
    icon: ShieldCheck,
    title: "Гарантия по договору",
    text: "Работаем официально, по договору с прописанными сроками и зонами ответственности.",
  },
];

function AdvantageCard({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  const tilt = useTilt(6);
  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onMove}
      onPointerLeave={tilt.onLeave}
      className="group relative h-full overflow-hidden rounded-card border border-line bg-paper p-6 transition-[transform,box-shadow,border-color] duration-300 [transform-style:preserve-3d] hover:border-[#d4d8de] hover:shadow-card"
    >
      {/* верхняя градиентная линия-акцент */}
      <span className="absolute inset-x-0 top-0 h-[2px] scale-x-0 bg-gradient-to-r from-bordeaux-deep via-bordeaux-bright to-chrome transition-transform duration-300 group-hover:scale-x-100" />
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-graphite text-chrome transition-all duration-300 group-hover:-rotate-6 group-hover:bg-bordeaux group-hover:text-white">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-2 text-[20px] normal-case tracking-[0.01em] text-ink">
        {title}
      </h3>
      <p className="text-[15px] leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

export function Advantages() {
  return (
    <section className="bg-white py-[88px]">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Почему мы"
            title="Премиальный импорт без сюрпризов"
            description="Доверие и прозрачность на каждом шаге — от первого расчёта до выдачи авто."
          />
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} direction="up" delay={(i % 3) * 90}>
              <AdvantageCard {...item} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
