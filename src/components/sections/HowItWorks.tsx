import {
  ClipboardList,
  Calculator,
  FileSignature,
  PackageCheck,
  Ship,
  KeyRound,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

const steps = [
  {
    icon: ClipboardList,
    title: "Заявка и подбор",
    term: "1 день",
    text: "Уточняем задачу, бюджет и пожелания, подбираем варианты под вас.",
  },
  {
    icon: Calculator,
    title: "Расчёт под ключ",
    term: "15 минут",
    text: "Считаем итоговую цену в РФ: авто, логистика, таможня, услуги.",
  },
  {
    icon: FileSignature,
    title: "Договор",
    term: "1 день",
    text: "Фиксируем условия и цену в договоре. Прозрачно и официально.",
  },
  {
    icon: PackageCheck,
    title: "Выкуп и проверка",
    term: "2–5 дней",
    text: "Осматриваем, проверяем историю и выкупаем выбранное авто.",
  },
  {
    icon: Ship,
    title: "Доставка",
    term: "30–45 дней",
    text: "Везём авто до РФ выбранным маршрутом, держим вас в курсе.",
  },
  {
    icon: KeyRound,
    title: "Растаможка и выдача",
    term: "3–7 дней",
    text: "Оформляем таможню и документы, передаём авто готовым к учёту.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-paper py-[88px]">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Процесс"
            title="Как это работает"
            description="Шесть понятных шагов от заявки до ключей. У каждого — свой срок."
          />
        </Reveal>
        <div className="relative mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ icon: Icon, title, term, text }, i) => (
            <Reveal key={title} direction="up" delay={(i % 3) * 90}>
              <div className="group relative h-full overflow-hidden rounded-card border border-line bg-white p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-card">
                <span className="pointer-events-none absolute -right-2 -top-4 font-display text-[96px] font-extrabold leading-none text-shine opacity-30 transition-opacity duration-300 group-hover:opacity-70">
                  {i + 1}
                </span>
                <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-graphite text-chrome transition-all duration-300 group-hover:scale-105 group-hover:bg-bordeaux group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="relative mb-1 text-[20px] normal-case text-ink">
                  {title}
                </h3>
                <span className="relative mb-3 inline-flex rounded-full bg-bordeaux/10 px-2.5 py-1 font-num text-[13px] font-bold text-bordeaux">
                  {term}
                </span>
                <p className="relative text-[15px] leading-relaxed text-ink-2">
                  {text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
