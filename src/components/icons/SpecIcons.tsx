import { Gauge, Cog, LifeBuoy, type LucideProps } from "lucide-react";

/** Понятные иконки характеристик авто (на базе lucide-react). */

/**
 * Двигатель — силуэт мотора: корпус, патрубок сверху, вал справа.
 *
 * Раньше здесь стояла колонка с пистолетом — значок заправки. Рядом с ней
 * написано «150 л.с.», и вместе это читалось как расход топлива или тип
 * горючего, а не как мотор. Готового значка двигателя в наборе нет, поэтому
 * рисуем свой — в той же манере: сетка 24, обводка в две единицы, скруглённые
 * концы, никакой заливки.
 *
 * Деталей намеренно три. В карточке значок показывается в 16–18 px, и всё
 * мелкое на этом размере слипается: поршень с шатуном превращался в медаль,
 * лапы и рёбра — в кляксу. Проверено отрисовкой в 16, 18, 24 и 56 px.
 */
export function EngineIcon({
  size = 24,
  strokeWidth = 2,
  ...props
}: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* корпус */}
      <rect x="2.5" y="9" width="15" height="9" rx="2.5" />
      {/* патрубок впуска */}
      <path d="M8 9V5.5h5" />
      {/* вал */}
      <path d="M17.5 12h4v3h-4" />
    </svg>
  );
}

export function MileageIcon(props: LucideProps) {
  return <Gauge {...props} />;
}

export function GearboxIcon(props: LucideProps) {
  return <Cog {...props} />;
}

export function DriveIcon(props: LucideProps) {
  return <LifeBuoy {...props} />;
}
