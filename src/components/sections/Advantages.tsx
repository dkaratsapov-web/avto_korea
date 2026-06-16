import {
  Calculator,
  ShieldCheck,
  SearchCheck,
  Headset,
  FileCheck2,
  BadgeCheck,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

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

export function Advantages() {
  return (
    <section className="bg-white py-[78px]">
      <div className="wrap">
        <SectionHeading
          eyebrow="Почему мы"
          title="Премиальный импорт без сюрпризов"
          description="Доверие и прозрачность на каждом шаге — от первого расчёта до выдачи авто."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-card border border-line bg-paper p-6 transition-[0.2s] hover:-translate-y-1 hover:border-[#d4d8de] hover:bg-white hover:shadow-card"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-graphite text-chrome transition-colors group-hover:bg-bordeaux group-hover:text-white">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-[20px] normal-case tracking-[0.01em] text-ink">
                {title}
              </h3>
              <p className="text-[15px] leading-relaxed text-ink-2">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
