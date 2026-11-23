import { Marquee } from "@/components/ui/Marquee";

const phrases = [
  "под ключ",
  "с растаможкой",
  "реальный расчёт",
  "без накруток",
  "доставка от 25 дней",
  "проверка перед покупкой",
  "фиксированная цена",
];

function Item({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-10">
      {/* Сплошной цвет (без анимированного градиента) — иначе маркиза лагает */}
      <span className="font-display text-[clamp(22px,3vw,40px)] font-extrabold uppercase tracking-[0.02em] text-[#C7CFD6]">
        {text}
      </span>
      <span className="h-2.5 w-2.5 rotate-45 bg-bordeaux-bright" aria-hidden />
    </span>
  );
}

export function BrandTicker() {
  return (
    <section className="relative overflow-hidden border-y border-line-dark bg-graphite py-5">
      <div className="grain" aria-hidden />
      {/* затемнение по краям */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-graphite to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-graphite to-transparent" />
      <Marquee
        duration={32}
        items={phrases.map((p) => (
          <Item key={p} text={p} />
        ))}
      />
    </section>
  );
}
