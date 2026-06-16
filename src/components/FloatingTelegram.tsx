import { Send } from "lucide-react";
import { site } from "@/lib/site";

export function FloatingTelegram() {
  return (
    <a
      href={site.telegramHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать в Telegram"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-bordeaux text-white shadow-[0_10px_30px_rgba(122,20,16,.45)] transition-transform hover:scale-105 hover:bg-bordeaux-bright focus-visible:scale-105"
    >
      <Send className="h-6 w-6" />
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-bordeaux/40 [animation-duration:2.5s] motion-reduce:hidden" />
    </a>
  );
}
