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
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
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
  featured = false,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  featured?: boolean;
}) {
  const tilt = useTilt(featured ? 4 : 6);

  if (featured) {
    return (
      <div
        ref={tilt.ref}
        onPointerMove={tilt.onMove}
        onPointerLeave={tilt.onLeave}
        className="group relative flex h-full flex-col justify-between overflow-hidden rounded-card border border-bordeaux-bright/30 bg-[linear-gradient(135deg,#3a0f0c_0%,#1B222B_55%)] p-7 text-white transition-[transform,box-shadow] duration-300 [transform-style:preserve-3d] hover:shadow-glow"
      >
        <div className="glow-blob -right-6 -top-6 h-44 w-44 animate-glow-pan bg-bordeaux/30" aria-hidden />
        <span className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <div className="relative mb-10 flex h-14 w-14 items-center justify-center rounded-[16px] bg-bordeaux text-white transition-transform duration-300 group-hover:-rotate-6">
          <Icon className="h-7 w-7" />
        </div>
        <div className="relative">
          <h3 className="mb-2 text-[24px] normal-case tracking-[0.01em] text-shine">
            {title}
          </h3>
          <p className="max-w-md text-[15px] leading-relaxed text-[#C7CFD6]">
            {text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onMove}
      onPointerLeave={tilt.onLeave}
      className="group relative h-full overflow-hidden rounded-card border border-line bg-paper p-6 transition-[transform,box-shadow,border-color] duration-300 [transform-style:preserve-3d] hover:border-[#d4d8de] hover:shadow-card"
    >
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
    <section className="overflow-hidden bg-white py-[72px]">
      <div className="wrap">
        <ContainerScroll
          titleComponent={
            <SectionHeading
              eyebrow="Почему мы"
              title="Премиальный импорт без сюрпризов"
              description="Доверие и прозрачность на каждом шаге — от первого расчёта до выдачи авто."
              align="center"
            />
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item, i) => {
              const featured = i === 0 || i === 5;
              return (
                <div
                  key={item.title}
                  className={featured ? "sm:col-span-2 lg:col-span-2" : ""}
                >
                  <AdvantageCard {...item} featured={featured} />
                </div>
              );
            })}
          </div>
        </ContainerScroll>
      </div>
    </section>
  );
}
