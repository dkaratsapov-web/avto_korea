import { Percent, Zap, Wallet, FileCheck2, Landmark, ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { useUI } from "@/lib/ui";

const perks = [
  { icon: Percent, title: "Выгодная ставка", text: "Подберём предложение с лучшими условиями среди банков-партнёров." },
  { icon: Wallet, title: "Низкий первый взнос", text: "Гибкие условия по первоначальному взносу и сроку кредита." },
  { icon: Zap, title: "Решение за 1 день", text: "Заявка онлайн — предварительное решение быстро, без визита в банк." },
  { icon: FileCheck2, title: "Минимум документов", text: "Поможем собрать пакет и оформить всё под ключ вместе с авто." },
];

// TODO: подтвердить актуальный список банков-партнёров у заказчика.
const banks = ["Примсоцбанк", "ВТБ", "Т‑Банк", "Уралсиб"];

export function Credit() {
  const { openLead } = useUI();

  return (
    <section id="credit" className="scroll-mt-24 bg-paper py-[80px]">
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Кредит и рассрочка"
            title="Оформим выгодный автокредит"
            description="Авто можно взять в кредит — поможем подобрать банк и ставку. Решение онлайн, оформление вместе с импортом под ключ."
          />
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} direction="up" delay={(i % 4) * 80}>
              <div className="group h-full rounded-card border border-line bg-white p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-card">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-graphite text-chrome transition-colors group-hover:bg-bordeaux group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1.5 text-[19px] normal-case text-ink">{title}</h3>
                <p className="text-[14.5px] leading-relaxed text-ink-2">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10 rounded-card border border-line bg-white p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[0.12em] text-ink-2">
                Банки-партнёры
              </div>
              <div className="flex flex-wrap gap-3">
                {banks.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-2.5 rounded-full border border-line bg-paper px-5 py-3 font-display text-[18px] font-extrabold uppercase tracking-[0.01em] text-ink"
                  >
                    <Landmark className="h-5 w-5 text-bordeaux" />
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <Button variant="primary" onClick={openLead} className="flex-none">
              Рассчитать кредит
              <ArrowRight className="h-[18px] w-[18px]" />
            </Button>
          </div>
          <p className="mt-5 text-[12.5px] text-ink-2">
            Кредит предоставляется банком; решение принимает банк. Условия,
            ставки и одобрение уточняйте у менеджера.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
