import { useRef, useState, type PointerEvent } from "react";
import { LeadForm } from "@/components/LeadForm";
import { SplineScene } from "@/components/ui/splite";
import { Logo } from "@/components/ui/Logo";
import { useScrollParallax } from "@/lib/useScrollParallax";

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

// import.meta.env.BASE_URL учитывает base из vite.config (на GitHub Pages — /avto_korea/).
// TODO: заменить на фото, на которое у заказчика есть права (см. ТЗ).
const HERO_IMAGE = `${import.meta.env.BASE_URL}hero-bg.jpg`;

export function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const giantRef = useScrollParallax<HTMLSpanElement>(0.12);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5, active: false });

  function onMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPointer({
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      active: true,
    });
  }

  const px = (pointer.x - 0.5) * 2; // -1..1
  const py = (pointer.y - 0.5) * 2;

  return (
    <section
      id="top"
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setPointer((p) => ({ ...p, active: false }))}
      className="relative isolate overflow-hidden bg-graphite text-white after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-[3px] after:bg-[linear-gradient(90deg,transparent,#5C6D76,#AEBAC2,#5C6D76,transparent)] after:content-['']"
    >
      {/* Фоновое фото + затемняющие слои + параллакс */}
      <div className="absolute inset-0 -z-10">
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          style={{
            transform: `translate3d(${px * -16}px, ${py * -12}px, 0) scale(1.08)`,
          }}
          className="absolute inset-0 h-full w-full object-cover object-[50%_58%] brightness-[.8] saturate-[.9] transition-transform duration-300 ease-out"
        />
        <div className="absolute inset-0 bg-graphite/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-graphite via-graphite/85 to-graphite/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-graphite via-transparent to-graphite/60" />
        {/* световое пятно-прожектор за курсором */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: pointer.active ? 1 : 0,
            background: `radial-gradient(420px circle at ${pointer.x * 100}% ${pointer.y * 100}%, rgba(174,186,194,.18), transparent 60%)`,
          }}
          aria-hidden
        />
        <div className="glow-blob right-[8%] top-[10%] h-80 w-80 animate-glow-pan bg-bordeaux/30" aria-hidden />
        <div className="glow-blob left-[2%] bottom-[6%] h-72 w-72 animate-glow-pan bg-steel/20 [animation-delay:-6s]" aria-hidden />
        <div className="grain absolute inset-0" aria-hidden />
      </div>

      {/* Гигантская контурная типографика — глубина и характер */}
      <span
        ref={giantRef}
        aria-hidden
        className="pointer-events-none absolute -right-[3%] top-[12%] z-0 select-none font-display text-[clamp(120px,20vw,320px)] font-extrabold uppercase leading-none tracking-tight text-transparent"
        style={{ WebkitTextStroke: "1.5px rgba(174,186,194,.10)" }}
      >
        под&nbsp;ключ
      </span>

      <div className="wrap grid items-center gap-10 pb-[64px] pt-[120px] max-md:gap-[18px] max-md:pb-[56px] max-md:pt-[104px] md:grid-cols-[1.05fr_0.95fr] md:pb-[100px] md:pt-[140px]">
        <div className="relative z-10 animate-fade-up">
          <div className="mb-[22px] inline-flex items-center gap-3 rounded-full border border-line-dark bg-graphite-2/50 py-2 pl-2 pr-4 text-[13px] font-bold uppercase tracking-[0.14em] text-chrome backdrop-blur-sm">
            <span className="slash" aria-hidden /> Импорт авто под ключ · 69 регион
          </div>

          <h1 className="mb-[18px] text-[clamp(40px,5.4vw,72px)] text-white [text-shadow:0_2px_24px_rgba(0,0,0,.45)]">
            Авто из Кореи,
            <br />
            Китая и Японии
            <br />
            <em className="not-italic text-shine">под ключ</em>
          </h1>

          <p className="mb-[26px] max-w-[520px] text-[19px] text-[#D2D9DF]">
            Считаем честно и показываем реальную цену с доставкой и растаможкой —
            без скрытых наценок.
          </p>

          <div className="mb-[30px] flex flex-wrap gap-2.5">
            {badges.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-line-dark bg-graphite-2/60 px-[14px] py-[9px] text-[14px] font-semibold text-[#DCE2E7] backdrop-blur-sm"
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

        {/* 3D-робот: следит за курсором (поведение встроено в сцену Spline) */}
        <div className="relative z-10 hidden min-h-[520px] items-center justify-center md:flex">
          {/* фоновое хром-кольцо */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full border border-chrome/15 [border-style:dashed]" />

          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="!h-[520px] !w-full"
          />

          {/* прячем вотермарк Spline */}
          <div className="pointer-events-none absolute bottom-2 right-2 h-9 w-32 rounded-md bg-graphite/90 backdrop-blur-sm" />

          {/* логотип-«шеврон» поверх робота */}
          <div className="glass pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2 animate-float rounded-full px-4 py-2">
            <Logo withIcon className="!text-[18px]" />
          </div>

          {/* прайс-чип */}
          <div className="pointer-events-none absolute right-[2%] top-[6%] animate-float rotate-[1deg] rounded-[14px] bg-white px-4 py-3 text-ink shadow-chip [animation-delay:-2s]">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">
              под ключ от
            </div>
            <div className="font-num text-[24px] font-bold text-bordeaux">
              2 190 000 ₽
            </div>
          </div>
        </div>
      </div>

      {/* индикатор прокрутки */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 hidden justify-center md:flex">
        <div className="flex h-9 w-6 items-start justify-center rounded-full border border-chrome/40 p-1.5">
          <span className="h-2 w-1 animate-scroll-cue rounded-full bg-chrome" />
        </div>
      </div>
    </section>
  );
}
