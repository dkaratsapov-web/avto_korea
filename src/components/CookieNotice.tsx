import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const KEY = "diauto:cookie-ok";

/**
 * Уведомление об использовании cookie и веб-аналитики.
 *
 * Сайт подключает Яндекс.Метрику, а она пишет cookie и собирает IP — по
 * позиции Роскомнадзора это обработка персональных данных, о которой
 * посетителя нужно информировать. Баннер показывается один раз: отметка о
 * закрытии хранится в браузере, на сервер ничего не уходит.
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
    <div className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-2xl rounded-[18px] border border-line-dark bg-graphite-2/98 p-4 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur sm:bottom-5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:p-5">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-[13px] leading-relaxed text-[#C7CFD6]">
          Мы используем cookie и Яндекс.Метрику, чтобы сайт работал корректно и
          мы понимали, что улучшить. Продолжая пользоваться сайтом, вы
          соглашаетесь с{" "}
          <Link to="/privacy" className="underline hover:text-white">
            политикой конфиденциальности
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          aria-label="Закрыть уведомление"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-chrome transition-colors hover:bg-white/10 hover:text-white sm:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={accept}
        className="btn btn-primary mt-3 !h-10 w-full !px-5 text-[14px] sm:mt-0 sm:w-auto"
      >
        Понятно
      </button>
    </div>
  );
}
