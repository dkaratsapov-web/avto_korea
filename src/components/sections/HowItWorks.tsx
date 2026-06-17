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
    text: "Уточняем задачу, бюджет и пожелания по марке, году и комплектации. Подбираем несколько реальных вариантов с фото и ценами под ключ и проверяем их доступность на аукционах и у дилеров. Вы выбираете — мы берём в работу.",
  },
  {
    icon: Calculator,
    title: "Расчёт под ключ",
    term: "15 минут",
    text: "Считаем итоговую цену в рублях прозрачно: стоимость авто в стране, логистика, таможенные платежи и наши услуги. Никаких «звоните — расскажем»: вы сразу видите финальную сумму без скрытых наценок и можете сравнить варианты.",
  },
  {
    icon: FileSignature,
    title: "Договор",
    term: "1 день",
    text: "Фиксируем выбранное авто, сроки и цену в договоре. Прописываем порядок оплаты и зоны ответственности сторон — вы точно знаете, что и когда происходит и за что платите. Работаем официально.",
  },
  {
    icon: PackageCheck,
    title: "Выкуп и проверка",
    term: "2–5 дней",
    text: "Осматриваем авто вживую, проверяем юридическую историю, реальный пробег и техническое состояние. Присылаем фото и видео осмотра до выкупа — берём только то, в чём уверены сами, без сюрпризов по приезде.",
  },
  {
    icon: Ship,
    title: "Доставка",
    term: "30–45 дней",
    text: "Везём авто до России оптимальным маршрутом и держим вас в курсе на каждом этапе — от погрузки до прибытия на склад. Статус и ориентир по срокам доступны в любой момент, без необходимости что-то выяснять.",
  },
  {
    icon: KeyRound,
    title: "Растаможка и выдача",
    term: "3–7 дней",
    text: "Оформляем таможню, утильсбор и весь пакет документов. Авто приезжает готовым к постановке на учёт — помогаем с регистрацией в ГИБДД и передаём вам ключи. Дальше — только ваши поездки.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-paper pb-[88px] pt-[56px]">
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
