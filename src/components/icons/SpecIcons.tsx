import type { SVGProps } from "react";

/** Линейные spec-иконки карточки авто — перенесены 1:1 из макета. */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  "aria-hidden": true,
};

export function EngineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9h6l3-3h3v3h2v4h-2v3h-3l-2-2H6v2H3v-7h3z" />
    </svg>
  );
}

export function MileageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 14a8 8 0 1 1 8-8" />
      <path d="M12 14l4-3" />
    </svg>
  );
}

export function GearboxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4v16M17 4v16M7 9h10" />
      <circle cx="7" cy="4" r="1.6" />
      <circle cx="17" cy="4" r="1.6" />
    </svg>
  );
}

export function DriveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
    </svg>
  );
}
