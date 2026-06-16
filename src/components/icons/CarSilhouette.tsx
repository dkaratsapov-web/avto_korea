import type { SVGProps } from "react";

/**
 * Фирменный SVG-силуэт спорткара с хром-градиентом — перенесён 1:1 из макета.
 * Используется как водяной знак в hero и как заглушка фото в карточках авто.
 */
export function CarSilhouette({
  className,
  title,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 380 152"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="diauto-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E6EAED" />
          <stop offset=".35" stopColor="#AEBAC2" />
          <stop offset=".62" stopColor="#5C6D76" />
          <stop offset="1" stopColor="#33414B" />
        </linearGradient>
        <linearGradient id="diauto-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fb6c4" />
          <stop offset="1" stopColor="#3a4a55" />
        </linearGradient>
      </defs>
      <path
        d="M20 112 C20 100 26 95 40 94 L92 90 C104 72 120 62 150 60 L232 58
          C260 58 276 70 288 92 L340 96 C356 99 362 104 362 114 L362 120
          C362 124 360 126 354 126 L300 126 A28 28 0 0 0 244 126 L150 126
          A28 28 0 0 0 94 126 L30 126 C24 126 20 122 20 116 Z"
        fill="url(#diauto-chrome)"
      />
      <path
        d="M120 88 L152 66 L226 65 C246 65 258 74 268 89 Z"
        fill="url(#diauto-glass)"
        opacity=".92"
      />
      <path
        d="M158 67 L186 66 L186 86 L142 86 Z"
        fill="#11151a"
        opacity=".18"
      />
      <circle cx="122" cy="126" r="27" fill="#15191e" />
      <circle cx="122" cy="126" r="13" fill="url(#diauto-chrome)" />
      <circle cx="272" cy="126" r="27" fill="#15191e" />
      <circle cx="272" cy="126" r="13" fill="url(#diauto-chrome)" />
      <rect x="346" y="100" width="14" height="7" rx="3" fill="#9C1A12" />
    </svg>
  );
}
