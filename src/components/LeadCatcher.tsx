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
 * Показывается ОДИН раз и только тем, кто уже что-то посмотрел. Всплывать
 * сразу на входе нельзя: окно поверх ещё не прочитанной страницы читается
 * как «сначала заплати вниманием», и человек закрывает вкладку целиком.
 *
 * Кто оставил заявку — не увидит его больше никогда: предлагать консультацию
 * тому, кто уже ждёт звонка, значит показать, что мы его не помним.
 */

/** Через сколько на странице предложить консультацию. */
const AFTER_MS = 45_000;

/** Какую долю страницы надо пролистать, чтобы предложение было уместным. */
const AFTER_SCROLL = 0.5;

/** Сколько молчать после закрытия. Отказ — тоже ответ, и его надо уважать. */
const SNOOZE_DAYS = 7;

const KEY_SNOOZE = "diauto:lead-catcher-snooze";
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

/** Можно ли вообще показывать: не отправлял заявку и не закрывал недавно. */
function allowed(): boolean {
  if (read(KEY_SENT)) {
    return false;
  }
  const until = Number(read(KEY_SNOOZE) || 0);
  return !(until > Date.now());
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

    let fired = false;
    const show = () => {
      // Условия перепроверяем в момент срабатывания: за 45 секунд человек мог
      // успеть отправить заявку из формы на странице.
      if (fired || !allowed()) {
        return;
      }
      fired = true;
      setOpen(true);
      stop();
    };

    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0 && window.scrollY / total >= AFTER_SCROLL) {
        show();
      }
    };

    /*
     * Уход курсора за верхний край — намерение закрыть вкладку. Только на
     * мыши: на телефоне такого события нет, а подделывать его прокруткой
     * вверх нельзя — там это обычное движение по странице.
     */
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        show();
      }
    };

    const timer = window.setTimeout(show, AFTER_MS);
    const stop = () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onLeave);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseout", onLeave);
    return stop;
  }, [pathname]);

  function close() {
    setOpen(false);
    write(KEY_SNOOZE, String(Date.now() + SNOOZE_DAYS * 24 * 3600 * 1000));
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
