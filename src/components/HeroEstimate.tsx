import { CarSilhouette } from "@/components/icons/CarSilhouette";

const items = [
  { label: "Авто в стране", amount: "1 290 000" },
  { label: "Логистика до РФ", amount: "250 000" },
  { label: "Таможня и утильсбор", amount: "480 000" },
  { label: "Услуги ДиАвто69", amount: "170 000" },
];

/** Дизайнерский мокап «сметы под ключ» с печатью «оплачено». */
export function EstimateMockup() {
  return (
    <div className="relative w-full max-w-[400px] rotate-[-1.6deg]">
      <div className="overflow-hidden rounded-[18px] bg-paper text-ink shadow-[0_34px_80px_rgba(0,0,0,.55)] ring-1 ring-black/10">
        {/* шапка документа */}
        <div className="flex items-center justify-between bg-graphite px-5 py-3 text-white">
          <div className="flex items-center gap-2">
            <CarSilhouette className="h-4 w-7" />
            <span className="font-display text-[16px] font-extrabold uppercase tracking-[0.02em]">
              Смета · под ключ
            </span>
          </div>
          <span className="font-num text-[12px] tracking-[0.04em] text-chrome">
            № 2026-0617
          </span>
        </div>

        {/* тело */}
        <div className="px-5 pb-5 pt-4">
          <div className="mb-3 flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">
            <span>🇰🇷 Kia K3 · 2026</span>
            <span>до Москвы</span>
          </div>

          <ul className="space-y-2.5">
            {items.map((it) => (
              <li
                key={it.label}
                className="flex items-baseline gap-1 text-[13.5px]"
              >
                <span className="whitespace-nowrap text-ink-2">{it.label}</span>
                <span className="mx-1 flex-1 translate-y-[-2px] border-b border-dotted border-ink-2/35" />
                <span className="whitespace-nowrap font-num font-bold text-ink">
                  {it.amount} ₽
                </span>
              </li>
            ))}
          </ul>

          <div className="my-4 border-t border-dashed border-ink-2/30" />

          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-2">
                Итог под ключ в РФ
              </div>
              <div className="font-num text-[32px] font-bold leading-none text-bordeaux">
                2 190 000 ₽
              </div>
            </div>
            <div className="rounded-md bg-success/12 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#1f9d57]">
              без накруток
            </div>
          </div>
        </div>

        {/* подвал */}
        <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[11px] text-ink-2">
          <span>ДиАвто69 · импорт под ключ</span>
          <span>с растаможкой и ЭПТС</span>
        </div>
      </div>

      {/* печать «оплачено» */}
      <Stamp className="absolute -bottom-7 -right-5 h-32 w-32 rotate-[-14deg]" />
    </div>
  );
}

function Stamp({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`pointer-events-none opacity-90 [filter:drop-shadow(0_2px_3px_rgba(0,0,0,.25))] ${className}`}
      aria-hidden
    >
      <defs>
        <path
          id="stamp-circle"
          d="M100,100 m-66,0 a66,66 0 1,1 132,0 a66,66 0 1,1 -132,0"
          fill="none"
        />
      </defs>
      <g fill="none" stroke="#9C1A12" strokeWidth="3">
        <circle cx="100" cy="100" r="84" />
        <circle cx="100" cy="100" r="72" />
      </g>
      <text
        fill="#9C1A12"
        style={{
          fontFamily: '"Saira Condensed", sans-serif',
          fontWeight: 800,
          fontSize: "15px",
          letterSpacing: "3px",
        }}
      >
        <textPath href="#stamp-circle" startOffset="0">
          ДИАВТО69 • ПОД КЛЮЧ • 69 РЕГИОН •
        </textPath>
      </text>

      {/* центр: галочка + «оплачено» */}
      <path
        d="M84 96 l10 11 l22 -26"
        fill="none"
        stroke="#9C1A12"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="100"
        y="128"
        textAnchor="middle"
        fill="#9C1A12"
        style={{
          fontFamily: '"Saira Condensed", sans-serif',
          fontWeight: 800,
          fontSize: "20px",
          letterSpacing: "1px",
        }}
      >
        ОПЛАЧЕНО
      </text>
    </svg>
  );
}
