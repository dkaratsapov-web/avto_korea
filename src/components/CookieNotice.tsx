import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "diauto:cookie-ok";

/**
 * Уведомление об использовании cookie и веб-аналитики.
 *
 * Сайт подключает Яндекс.Метрику, а она пишет cookie и собирает IP — по
 * позиции Роскомнадзора это обработка персональных данных, о которой
 * посетителя нужно информировать. Баннер показывается один раз: отметка о
 * закрытии хранится в браузере, на сервер ничего не уходит.
 *
 * Держим его маленьким и непрозрачным: полупрозрачная плашка во всю ширину
 * размазывалась поверх карточек каталога и выглядела грязно.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* приватный режим — просто не показываем */
    }
  }, []);

  if (!show) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* игнорируем */
    }
    setShow(false);
  };

  return (
    /*
     * На мобильном баннер поднят выше плавающих кнопок.
     *
     * Их снизу справа три, и стоят они лесенкой: Telegram (20), MAX (88),
     * звонок (156) — каждая по 56 в высоту, то есть верхняя заканчивается на
     * 212. Баннер стоял на 152 и накрывал кнопку звонка целиком: позвонить
     * было нельзя, пока не примешь cookie.
     *
     * Отсюда 224 — это 212 плюс небольшой зазор. Если в этот угол добавится
     * ещё одна кнопка, число придётся пересчитать: 20 + 68 × (число кнопок).
     *
     * От планшета и шире баннер опускается вниз, но НЕ по центру экрана:
     * слева внизу стоит «Подобрать авто», справа — мессенджеры, и на 768 px
     * отцентрованный баннер наезжал на левую кнопку. Поэтому он центрируется
     * не в экране, а в свободной полосе между ними: отступ слева пропускает
     * «Подобрать авто», отступ справа — столбик мессенджеров.
     */
    <div className="fixed inset-x-3 bottom-[224px] z-[60] mx-auto max-w-[430px] rounded-2xl border border-line-dark bg-graphite-2 p-3.5 text-white shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)] sm:bottom-5 sm:left-[256px] sm:right-[88px] sm:translate-x-0">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-[12.5px] leading-snug text-[#C7CFD6]">
          Мы используем cookie и Яндекс.Метрику. Продолжая, вы соглашаетесь с{" "}
          <Link to="/privacy" className="underline hover:text-white">
            политикой конфиденциальности
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="btn btn-primary !h-9 flex-none !px-4 !py-0 text-[13px]"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
