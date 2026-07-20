import { Wallet, Truck, ReceiptText } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { Flag } from "@/components/icons/Flag";
import type { CountryCode } from "@/lib/site";

const badges = [
  { icon: Wallet, label: "Под любой бюджет" },
  { icon: Truck, label: "Доставка до 25 дней" },
  { icon: ReceiptText, label: "Прозрачная смета" },
];

const flags: { code: CountryCode; title: string }[] = [
  { code: "kr", title: "Корея" },
  { code: "cn", title: "Китай" },
  { code: "jp", title: "Япония" },
  { code: "eu", title: "ЕС" },
];

// Узкий hero без фонового изображения: слева — оффер, справа — форма заявки.
// Мокап сметы (HeroEstimate) временно убран — оставлен для размещения позже.
export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-[linear-gradient(160deg,#0b0f13_0%,#11151A_55%,#161d25_100%)] text-white after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-[3px] after:bg-[linear-gradient(90deg,transparent,#5C6D76,#AEBAC2,#5C6D76,transparent)] after:content-['']"
    >
      <div className="glow-blob right-[10%] top-[8%] h-64 w-64 animate-glow-pan bg-bordeaux/25" aria-hidden />
      <div className="glow-blob bottom-[6%] left-[2%] h-56 w-56 animate-glow-pan bg-steel/15 [animation-delay:-6s]" aria-hidden />
      <div className="grain absolute inset-0" aria-hidden />

      <div className="wrap relative z-10 grid items-center gap-x-10 gap-y-6 pb-5 pt-[76px] md:grid-cols-[1.05fr_0.95fr] md:pb-5 md:pt-[82px]">
        <div className="animate-fade-up">
          <div className="mb-2.5 inline-flex items-center gap-2.5 rounded-full border border-line-dark bg-graphite-2/50 py-1 pl-2 pr-3.5 text-[12px] font-bold uppercase tracking-[0.14em] text-chrome">
            <span className="slash" aria-hidden /> Импорт авто под ключ · 69 регион
          </div>

          <h1 className="mb-2.5 text-[clamp(25px,3.4vw,42px)] leading-[1.02] text-white [text-shadow:0_2px_20px_rgba(0,0,0,.4)]">
            Авто из Кореи, Китая и Японии
            <br />
            <em className="not-italic text-shine">под ключ</em>
          </h1>

          <p className="mb-3.5 max-w-[480px] text-[14.5px] text-[#D2D9DF]">
            Считаем честно и показываем реальную цену с доставкой и растаможкой —
            без скрытых наценок.
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {badges.map(({ icon: Icon, label }, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-line-dark bg-graphite-2/60 py-1.5 pl-2 pr-3.5 text-[13px] font-semibold text-[#DCE2E7]"
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-bordeaux/15 text-bordeaux-bright">
                  <Icon className="h-[15px] w-[15px]" />
                </span>
                {label}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2.5 text-[13px] text-[#AEB7BE]">
            Возим из:
            {flags.map((f) => (
              <Flag key={f.code} code={f.code} className="h-4 w-6" />
            ))}
          </div>
        </div>

        {/* Форма заявки — на месте бывшего мокапа сметы */}
        <div id="hero-form" className="scroll-mt-24 animate-fade-up">
          <div className="rounded-[20px] border border-line-dark bg-graphite-2/60 p-5 shadow-[0_24px_60px_-30px_rgba(0,0,0,.8)] backdrop-blur-sm sm:p-6">
            <div className="mb-3.5">
              <div className="text-[17px] font-extrabold text-white">
                Рассчитать под ключ
              </div>
              <div className="text-[13px] text-[#AEB7BE]">
                Перезвоним в течение 15 минут с честной ценой.
              </div>
            </div>
            <LeadForm
              source="Hero — первый экран"
              submitLabel="Получить расчёт"
              withCar={false}
              withContacts
              bare
            />
          </div>
        </div>
      </div>
    </section>
  );
}
