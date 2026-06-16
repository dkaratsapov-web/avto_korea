import { CarSilhouette } from "@/components/icons/CarSilhouette";
import { LeadForm } from "@/components/LeadForm";

const badges = [
  { strong: "15 мин", rest: " — расчёт под ключ" },
  { strong: "30–45", rest: " дней доставка" },
  { pre: "Цена ", strong: "с растаможкой" },
];

const flags = [
  { flag: "🇰🇷", title: "Корея" },
  { flag: "🇨🇳", title: "Китай" },
  { flag: "🇯🇵", title: "Япония" },
  { flag: "🇪🇺", title: "ЕС" },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[radial-gradient(1100px_520px_at_78%_18%,#27313d_0%,#11151A_60%)] text-white after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-[linear-gradient(90deg,transparent,#5C6D76,#AEBAC2,#5C6D76,transparent)] after:content-['']"
    >
      <div className="wrap grid items-center gap-10 py-[60px] max-md:gap-[18px] max-md:py-[48px] md:grid-cols-[1.05fr_0.95fr] md:py-[70px] md:pb-[84px]">
        <div className="animate-fade-up">
          <div className="mb-[22px] flex items-center gap-3 text-[14px] font-bold uppercase tracking-[0.14em] text-chrome">
            <span className="slash" aria-hidden /> Импорт авто под ключ · 69 регион
          </div>

          <h1 className="mb-[18px] text-[clamp(40px,5.4vw,72px)] text-white">
            Авто из Кореи,
            <br />
            Китая и Японии
            <br />
            <em className="not-italic text-bordeaux-bright">под ключ</em>
          </h1>

          <p className="mb-[26px] max-w-[520px] text-[19px] text-[#C7CFD6]">
            Считаем честно и показываем реальную цену с доставкой и растаможкой —
            без скрытых наценок.
          </p>

          <div className="mb-[30px] flex flex-wrap gap-2.5">
            {badges.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-line-dark bg-white/5 px-[14px] py-[9px] text-[14px] font-semibold text-[#DCE2E7]"
              >
                {b.pre}
                <b className="text-chrome">{b.strong}</b>
                {b.rest}
              </span>
            ))}
          </div>

          <div id="hero-form" className="scroll-mt-24">
            <LeadForm source="Hero — первый экран" submitLabel="Получить расчёт" />
          </div>

          <div className="mt-[26px] flex items-center gap-2.5 text-[14px] text-[#AEB7BE]">
            Возим из:
            {flags.map((f) => (
              <span key={f.title} title={f.title} className="text-[22px]">
                {f.flag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex min-h-[340px] items-center justify-center max-md:order-first max-md:min-h-[230px]">
          <div className="relative w-full max-w-[560px]">
            <div className="absolute inset-x-[6%] bottom-[8%] h-[46px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,.55),transparent_70%)] blur-[2px]" />
            <CarSilhouette
              title="Силуэт импортного авто"
              className="h-auto w-full drop-shadow-[0_30px_30px_rgba(0,0,0,0.45)]"
            />
            <div className="absolute right-[2%] top-[6%] rotate-[1deg] rounded-[14px] bg-white px-4 py-3 text-ink shadow-chip">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">
                под ключ от
              </div>
              <div className="font-num text-[24px] font-bold text-bordeaux">
                2 190 000 ₽
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
