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
import { InteractiveStepsAccordion } from "@/components/ui/interactive-image-accordion";

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
        <Reveal className="mt-12">
          <p className="mb-4 hidden text-[13px] font-semibold text-ink-2 md:block">
            Наведите на шаг, чтобы раскрыть детали →
          </p>
          <InteractiveStepsAccordion steps={steps} />
        </Reveal>
      </div>
    </section>
  );
}
