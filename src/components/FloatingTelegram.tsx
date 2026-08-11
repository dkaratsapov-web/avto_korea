import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

// Плавающая кнопка Telegram — без анимаций, с белой окантовкой.
export function FloatingTelegram() {
  return (
    <a
      href={site.telegramHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать в Telegram"
      onClick={() => reachGoal(GOALS.telegram, { place: "Плавающая кнопка" })}
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_10px_30px_rgba(34,158,217,.4)] ring-2 ring-white/85"
    >
      <TelegramIcon className="h-14 w-14" />
    </a>
  );
}
