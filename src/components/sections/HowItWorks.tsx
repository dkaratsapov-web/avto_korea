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
    text: "Подбираем реальные варианты с фото и ценами под ключ.",
  },
  {
    icon: Calculator,
    title: "Расчёт под ключ",
    term: "15 минут",
    text: "Прозрачная итоговая цена в рублях — без скрытых наценок.",
  },
  {
    icon: FileSignature,
    title: "Договор",
    term: "1 день",
    text: "Фиксируем авто, сроки и цену. Работаем официально.",
  },
  {
    icon: PackageCheck,
    title: "Выкуп и проверка",
    term: "2–5 дней",
    text: "Осмотр, история и реальный пробег. Фото и видео до выкупа.",
  },
  {
    icon: Ship,
    title: "Доставка",
    term: "30–45 дней",
    text: "Везём до России и держим в курсе на каждом этапе.",
  },
  {
    icon: KeyRound,
    title: "Растаможка и выдача",
    term: "3–7 дней",
    text: "Таможня, документы, помощь с учётом — и ключи ваши.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-paper pb-[72px] pt-[56px]">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Процесс"
            title="Как это работает"
            description="Шесть понятных шагов от заявки до ключей. У каждого — свой срок."
          />
        </Reveal>

        <Reveal className="mt-9">
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {steps.map(({ icon: Icon, title, term, text }, i) => (
              <li
                key={title}
                className="group relative flex flex-col overflow-hidden rounded-[16px] border border-line bg-white p-4 shadow-[0_2px_10px_-6px_rgba(20,25,32,0.2)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_-20px_rgba(20,25,32,0.45)]"
              >
                {/* акцент-линия сверху при наведении */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] scale-x-0 bg-gradient-to-r from-bordeaux-deep via-bordeaux-bright to-chrome transition-transform duration-500 group-hover:scale-x-100" />
                {/* крупный номер-водяной знак */}
                <span className="pointer-events-none absolute -right-1 top-0 font-display text-[46px] font-extrabold leading-none text-ink/[0.05]">
                  {i + 1}
                </span>

                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-bordeaux/10 text-bordeaux transition-colors duration-300 group-hover:bg-bordeaux group-hover:text-white">
                  <Icon className="h-[19px] w-[19px]" />
                </span>

                <h3 className="mt-3 font-display text-[15px] font-extrabold uppercase leading-tight tracking-[0.01em] text-ink">
                  {title}
                </h3>

                <span className="mt-1.5 w-fit rounded-full bg-graphite/[0.06] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink-2">
                  {term}
                </span>

                <p className="mt-2 text-[12.5px] leading-snug text-ink-2">
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
