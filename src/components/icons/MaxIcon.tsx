// Иконка национального мессенджера MAX (VK): скруглённый тайл с сине-фиолетовым
// градиентом и белым безхвостым «облачком»-эмблемой. Цвета собственные.
// Уникальный id градиента, чтобы не конфликтовать при нескольких инстансах.
export function MaxIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="maxGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2B8CFF" />
          <stop offset="1" stopColor="#7B4DFF" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="url(#maxGrad)" />
      <path
        fill="#fff"
        d="M7.4 16.6V8.9c0-.53.43-.96.96-.96.33 0 .64.17.82.45L12 12.02l2.02-3.63c.18-.28.49-.45.82-.45.53 0 .96.43.96.96v7.7c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-4.02l-1.22 2.15a.9.9 0 0 1-1.56 0L10 11.68v4.92c0 .5-.4.9-.9.9s-.9-.4-.9-.9Z"
      />
    </svg>
  );
}
