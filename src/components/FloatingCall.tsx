import { Phone } from "lucide-react";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Плавающая кнопка звонка — только на мобильном.
 *
 * Стоит над кнопкой Telegram (та занимает bottom-5 + 56px высоты), поэтому
 * отступ снизу 88px. На десктопе не нужна: там номера видны в шапке, а по
 * ссылке tel: с компьютера звонить некому.
 */
export function FloatingCall() {
  return (
    <a
      href={site.phoneHref}
      aria-label={`Позвонить ${site.phone}`}
      onClick={() => reachGoal(GOALS.phone, { place: "Плавающая кнопка" })}
      className="fixed bottom-[88px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux text-white shadow-[0_10px_30px_rgba(122,20,16,.5)] ring-2 ring-white/85 sm:hidden"
    >
      <Phone className="h-6 w-6" />
    </a>
  );
}
