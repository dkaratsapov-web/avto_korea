import { useState } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";

export type AccordionStep = {
  icon: LucideIcon;
  title: string;
  term: string;
  text: string;
};

function Panel({
  step,
  index,
  isActive,
  onActivate,
}: {
  step: AccordionStep;
  index: number;
  isActive: boolean;
  onActivate: () => void;
}) {
  const Icon = step.icon;
  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      aria-expanded={isActive}
      aria-label={step.title}
      className={`group relative h-[460px] shrink-0 overflow-hidden rounded-[22px] border text-left outline-none transition-[flex-grow,border-color] duration-[1800ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isActive
          ? "border-bordeaux-bright/40"
          : "border-line-dark hover:border-chrome/30"
      }`}
      style={{ flexGrow: isActive ? 7 : 1, flexBasis: 0, minWidth: 64 }}
    >
      {/* фон-градиент + зерно */}
      <span className="grain absolute inset-0 bg-[linear-gradient(160deg,#232C36_0%,#11151A_70%)]" aria-hidden />
      {isActive ? (
        <span
          className="glow-blob -right-8 -top-8 h-48 w-48 animate-glow-pan bg-bordeaux/25"
          aria-hidden
        />
      ) : null}

      {/* крупный номер-водяной знак */}
      <span
        aria-hidden
        className={`pointer-events-none absolute right-2 top-1 font-display text-[120px] font-extrabold leading-none transition-opacity duration-[1100ms] ${
          isActive ? "text-shine opacity-40" : "text-white/[0.05]"
        }`}
      >
        {index + 1}
      </span>

      {/* иконка */}
      <span
        className={`absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-[14px] transition-colors duration-[1100ms] ${
          isActive ? "bg-bordeaux text-white" : "bg-white/[0.06] text-chrome"
        }`}
      >
        <Icon className="h-6 w-6" />
      </span>

      {/* свёрнутый заголовок — вертикально, по центру панели */}
      <span
        className={`absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap font-display text-[15px] font-extrabold uppercase tracking-[0.06em] text-chrome transition-opacity duration-200 ${
          isActive ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={isActive}
      >
        {step.title}
      </span>

      {/* развёрнутый контент — фиксированная ширина, чтобы текст не «переливался» при анимации */}
      <span
        className={`absolute bottom-0 left-0 block w-[360px] max-w-full bg-gradient-to-t from-graphite via-graphite/70 to-transparent p-6 pt-16 transition-[opacity,transform] ${
          isActive
            ? "translate-y-0 opacity-100 delay-0 duration-500"
            : "pointer-events-none translate-y-2 opacity-0 delay-0 duration-200"
        }`}
        aria-hidden={!isActive}
      >
        <span className="mb-2 inline-flex rounded-full bg-bordeaux/15 px-2.5 py-1 font-num text-[13px] font-bold text-bordeaux-bright">
          {step.term}
        </span>
        <span className="mb-1.5 block font-display text-[24px] font-extrabold uppercase leading-none text-white">
          {step.title}
        </span>
        <span className="block max-w-[320px] text-[14.5px] leading-relaxed text-[#AEB7BE]">
          {step.text}
        </span>
      </span>
    </button>
  );
}

export function InteractiveStepsAccordion({
  steps,
}: {
  steps: AccordionStep[];
}) {
  const [active, setActive] = useState(0);

  return (
    <>
      {/* Desktop: горизонтальный аккордеон */}
      <div className="hidden gap-3 md:flex">
        {steps.map((step, i) => (
          <Panel
            key={step.title}
            step={step}
            index={i}
            isActive={i === active}
            onActivate={() => setActive(i)}
          />
        ))}
      </div>

      {/* Mobile: горизонтальный свайп */}
      <div className="md:hidden">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-2">
          Листайте вправо
          <ArrowRight className="h-4 w-4 text-bordeaux motion-safe:animate-nudge" />
        </div>
        <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="relative w-[80vw] max-w-[320px] flex-none snap-start overflow-hidden rounded-[18px] border border-line bg-white p-5"
              >
              <span className="pointer-events-none absolute -right-1 -top-3 font-display text-[64px] font-extrabold leading-none text-line/80">
                {i + 1}
              </span>
              <div className="relative mb-3 flex h-11 w-11 items-center justify-center rounded-[12px] bg-graphite text-chrome">
                <Icon className="h-5 w-5" />
              </div>
              <div className="relative mb-2 flex items-center gap-2">
                <h3 className="text-[18px] normal-case text-ink">{step.title}</h3>
                <span className="rounded-full bg-bordeaux/10 px-2 py-0.5 font-num text-[12px] font-bold text-bordeaux">
                  {step.term}
                </span>
              </div>
                <p className="relative text-[14px] leading-relaxed text-ink-2">
                  {step.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
