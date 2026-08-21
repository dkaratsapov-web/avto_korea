import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Плавающие кнопки мессенджеров — написать нам, не покидая страницу.
 *
 * Оба ведут в личные сообщения, а не в каналы: человек, который тянется
 * к плавающей кнопке, хочет спросить, а не подписаться.
 *
 * Стопкой снизу вверх, а не в ряд: на телефоне справа уже стоит кнопка
 * звонка, а слева — «Подобрать авто», и горизонтальный ряд налезал бы
 * на неё на узких экранах.
 *
 * Позиции заданы числами, а не автоматической раскладкой: кнопка звонка
 * живёт в отдельном компоненте и должна попадать в ту же колонку —
 * общего контейнера у них нет.
 */
export function FloatingMessengers() {
  return (
    <>
      <a
        href={site.maxHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Написать в MAX"
        onClick={() => reachGoal(GOALS.max, { place: "Плавающая кнопка" })}
        className="fixed bottom-[88px] right-5 z-40 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-[0_10px_30px_rgba(123,77,255,.4)] ring-2 ring-white/85"
      >
        <MaxIcon className="h-14 w-14" />
      </a>

      <a
        href={site.telegramHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Написать в Telegram"
        onClick={() => reachGoal(GOALS.telegram, { place: "Плавающая кнопка" })}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-[0_10px_30px_rgba(34,158,217,.4)] ring-2 ring-white/85"
      >
        <TelegramIcon className="h-14 w-14" />
      </a>
    </>
  );
}
