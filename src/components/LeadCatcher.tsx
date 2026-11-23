import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { LeadForm } from "@/components/LeadForm";
import { ShieldCheck, Clock, Wallet } from "lucide-react";
import { useUI } from "@/lib/ui";

/**
 * Поп-ап с предложением бесплатной консультации и расчёта.
 *
 * Ловит тех, кто посмотрел сайт и уходит, ничего не оставив. В нише, где
 * решение стоит несколько миллионов, это почти все: человек читает, считает
 * в уме и уходит думать — а вернуться забывает.
 *
 * Появляется через 45 секунд после начала визита — и больше никогда,
 * независимо от того, оставили заявку или закрыли. Всплывать сразу на входе
 * нельзя: окно поверх ещё не прочитанной страницы читается как «сначала
 * заплати вниманием», и человек закрывает вкладку целиком. А показывать
 * второй раз — верный способ из предложения превратиться в помеху.
 *
 * Кто уже оставил заявку, не увидит его и в первый раз: предлагать
 * консультацию тому, кто ждёт звонка, значит показать, что мы его не помним.
 */

/** Через сколько после начала визита предложить консультацию. */
const AFTER_MS = 45_000;

/** Когда начался визит. Живёт во вкладке, а не в постоянной памяти. */
const KEY_START = "diauto:visit-start";

/** Показывали ли уже. Один раз — и больше никогда. */
const KEY_SHOWN = "diauto:lead-catcher-shown";

const KEY_SENT = "diauto:lead-sent";

/** Страницы, где предложение только мешает. */
const SKIP = ["/thanks", "/privacy", "/consent"];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Приватный режим запрещает хранилище — тогда считаем, что записей нет.
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* не записалось — покажем в следующий раз, это не страшно */
  }
}

/**
 * Момент начала визита.
 *
 * Хранится во вкладке, а не берётся от загрузки страницы: сайт — единое
 * приложение, но переход между разделами всё равно перезапустил бы отсчёт,
 * и человек, листающий каталог по одной странице в полминуты, не увидел бы
 * предложения никогда.
 */
function visitStart(): number {
  try {
    const saved = Number(sessionStorage.getItem(KEY_START) || 0);
    if (saved > 0) {
      return saved;
    }
    const now = Date.now();
    sessionStorage.setItem(KEY_START, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

/** Можно ли показывать: не показывали раньше и заявку уже не оставляли. */
function allowed(): boolean {
  return !read(KEY_SHOWN) && !read(KEY_SENT);
}

export function LeadCatcher() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Поверх карточки авто или избранного второе окно не открываем: два
  // наложенных модальных окна — это уже не предложение, а засада.
  const { modal } = useUI();

  useEffect(() => {
    if (SKIP.includes(pathname) || !allowed()) {
      return;
    }

    /*
     * Ждём остаток от 45 секунд визита, а не полные 45 от этой страницы.
     * Иначе переход в другой раздел сбрасывал бы отсчёт, и тот, кто листает
     * каталог, не увидел бы предложения никогда.
     */
    const left = AFTER_MS - (Date.now() - visitStart());

    const show = () => {
      // Условия перепроверяем в момент срабатывания: за 45 секунд человек мог
      // успеть отправить заявку из формы на странице.
      if (!allowed()) {
        return;
      }
      // Помечаем сразу, а не при закрытии: показали — значит показали,
      // и второй раз человек этого окна не увидит, чем бы ни кончилось.
      write(KEY_SHOWN, "1");
      setOpen(true);
    };

    const timer = window.setTimeout(show, Math.max(0, left));
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function close() {
    setOpen(false);
  }

  function sent() {
    // Больше не показываем никогда: человек уже ждёт звонка.
    write(KEY_SENT, "1");
    setOpen(false);
  }

  if (!open || modal) {
    return null;
  }

  return (
    <Modal onClose={close} label="Бесплатная консультация" className="max-w-lg">
      <div className="p-6 text-white sm:p-8">
        <div className="mb-1 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-chrome">
          <span className="slash" aria-hidden /> Бесплатно
        </div>
        <h3 className="text-[25px] font-extrabold uppercase leading-[1.06] text-white sm:text-[28px]">
          Посчитаем вашу машину
          <br />
          до последнего рубля
        </h3>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[#9AA4B2]">
          Подберём варианты под ваш бюджет и покажем полный расчёт: цена авто,
          доставка, пошлина, утильсбор и оформление — по отдельности.
          Без обязательств.
        </p>

        {/* Три причины оставить номер — против главного страха ниши:
            что итоговая сумма окажется другой. */}
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {[
            { icon: Wallet, text: "Честная цена под ключ" },
            { icon: Clock, text: "Расчёт за 15 минут" },
            { icon: ShieldCheck, text: "Без предоплаты" },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-2 rounded-[12px] border border-line-dark bg-white/[0.04] px-3 py-2.5 text-[12.5px] font-semibold text-[#DCE2E7]"
            >
              <Icon className="h-4 w-4 flex-none text-bordeaux-bright" />
              {text}
            </li>
          ))}
        </ul>

        {/*
         * Только имя и телефон.
         *
         * Полная форма спрашивает ещё страну, модель, год, бюджет, ссылку
         * и фото — это анкета, а не «запишитесь на консультацию». Здесь мы
         * ловим того, кто уже собрался уходить: каждое лишнее поле стоит
         * части заявок, а всё остальное менеджер спросит голосом.
         */}
        <div className="mt-5">
          <LeadForm
            layout="compact"
            tone="dark"
            source="Поп-ап «Бесплатная консультация»"
            submitLabel="Записаться на консультацию"
            withCar={false}
            bare
            stack
            onSent={sent}
          />
        </div>

        <button
          type="button"
          onClick={close}
          className="mt-3 w-full text-center text-[13px] font-semibold text-[#7d8792] transition-colors hover:text-chrome"
        >
          Не сейчас
        </button>
      </div>
    </Modal>
  );
}
