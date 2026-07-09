import { Magnetic } from "@/components/ui/Magnetic";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { site } from "@/lib/site";

export function FloatingTelegram() {
  return (
    <Magnetic strength={0.45} className="fixed bottom-5 right-5 z-50">
      <a
        href={site.telegramHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Написать в Telegram"
        className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_10px_30px_rgba(34,158,217,.5)] transition-transform hover:scale-105 focus-visible:scale-105"
      >
        <TelegramIcon className="h-14 w-14" />
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#229ED9]/40 [animation-duration:2.5s] motion-reduce:hidden" />
      </a>
    </Magnetic>
  );
}
