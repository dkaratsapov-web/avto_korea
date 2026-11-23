/**
 * Настройка уведомлений — блок в профиле.
 *
 * Два канала с разной ролью, и об этом здесь сказано прямо. Telegram работает
 * везде и всегда; браузерные push удобны на компьютере, но на iPhone требуют
 * установки CRM на домашний экран и могут тихо отключиться. Сотрудник должен
 * понимать, на что он подписался, а не гадать, почему ночью не пришло.
 */

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, Send, Smartphone } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { pushDisable, pushEnable, pushState, type PushState } from "../lib/push";
import { useAuth } from "../auth";
import { Button, Card, Field, Input, useToast } from "../ui";

type State = Awaited<ReturnType<typeof api.notifyState>>;

export function Notifications() {
  const { isOwner } = useAuth();
  const toast = useToast();

  const [state, setState] = useState<State | null>(null);
  const [push, setPush] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [next, current] = await Promise.all([api.notifyState(), pushState()]);
      setState(next);
      setPush(current);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось загрузить настройки", "error");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return null;

  const togglePush = async () => {
    setBusy(true);
    try {
      if (push === "on") {
        await pushDisable();
        toast("Уведомления в этом браузере выключены");
      } else {
        if (!state.vapidPublicKey) throw new Error("Сервер не выдал ключ — обновите страницу");
        await pushEnable(state.vapidPublicKey);
        toast("Уведомления в этом браузере включены");
      }
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось изменить подписку", "error");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const result = await api.testNotification();
      toast(`Отправлено: ${result.sent.join(", ")}. Проверьте телефон`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось отправить", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Уведомления">
        <div className="space-y-4 p-4">
          {/* --- Telegram --- */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-[14px] font-bold text-crm-ink">
                <Send className="h-4 w-4 text-crm-ink-3" />
                Telegram
                {state.telegramLinked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-crm-accent-soft px-2 py-0.5 text-[11.5px] font-bold text-crm-accent">
                    <Check className="h-3 w-3" />
                    подключён
                  </span>
                ) : null}
              </h4>
              {state.telegramLinked ? (
                <Button
                  size="sm"
                  onClick={async () => {
                    await api.unlinkTelegram();
                    await load();
                    toast("Telegram отвязан");
                  }}
                >
                  Отвязать
                </Button>
              ) : null}
            </div>

            {!state.telegramConfigured ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-crm-ink-2">
                Канал ещё не настроен.{" "}
                {isOwner
                  ? "Заведите бота у @BotFather и вставьте токен ниже."
                  : "Попросите владельца подключить бота."}
              </p>
            ) : state.telegramLinked ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-crm-ink-2">
                Уведомления приходят вам в личку. Работает на любом телефоне,
                ставить ничего не нужно.
              </p>
            ) : (
              <div className="mt-2 rounded-xl border border-crm-line bg-crm-raise p-3.5">
                <p className="text-[13px] leading-relaxed text-crm-ink-2">
                  Откройте бота{" "}
                  {state.botUsername ? (
                    <a
                      href={`https://t.me/${state.botUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-crm-link hover:underline"
                    >
                      @{state.botUsername}
                    </a>
                  ) : (
                    "уведомлений CRM"
                  )}{" "}
                  и отправьте ему этот код:
                </p>
                <p className="mt-2 select-all rounded-lg bg-crm-surface px-3 py-2 text-center font-num text-[22px] font-bold tracking-[0.2em] text-crm-ink">
                  {state.linkCode}
                </p>
                <p className="mt-2 text-[12px] text-crm-ink-3">
                  Код одноразовый: после привязки он перестаёт действовать.
                </p>
              </div>
            )}
          </section>

          <hr className="border-crm-line" />

          {/* --- Браузерные push --- */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-[14px] font-bold text-crm-ink">
                <Smartphone className="h-4 w-4 text-crm-ink-3" />
                Уведомления браузера
                {state.pushDevices > 0 ? (
                  <span className="rounded-full bg-crm-soft px-2 py-0.5 text-[11.5px] font-bold text-crm-ink-2">
                    устройств: {state.pushDevices}
                  </span>
                ) : null}
              </h4>

              {push === "on" || push === "off" ? (
                <Button size="sm" variant={push === "on" ? "ghost" : "primary"} loading={busy} onClick={togglePush}>
                  {push === "on" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  {push === "on" ? "Выключить здесь" : "Включить здесь"}
                </Button>
              ) : null}
            </div>

            <p className="mt-1.5 text-[13px] leading-relaxed text-crm-ink-2">
              {push === "on"
                ? "Этот браузер получает уведомления. Включать нужно на каждом устройстве отдельно."
                : push === "denied"
                  ? "Уведомления запрещены для сайта. Разрешите их в настройках браузера и вернитесь сюда."
                  : push === "ios-needs-install"
                    ? "На iPhone уведомления работают только у сайта, добавленного на домашний экран: откройте меню «Поделиться» → «На экран „Домой“», затем зайдите в CRM с этой иконки."
                    : push === "unsupported"
                      ? "Этот браузер не умеет присылать уведомления. Используйте Telegram."
                      : "Быстрее Telegram на компьютере, но их легко отключить незаметно — как основной канал лучше держать Telegram."}
            </p>
          </section>

          <hr className="border-crm-line" />

          <section className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-[14px] font-bold text-crm-ink">Не беспокоить</h4>
              <p className="mt-0.5 text-[13px] text-crm-ink-2">
                {state.muted ? "Уведомления вам не отправляются" : "Уведомления включены"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" loading={busy} onClick={sendTest}>
                Проверить
              </Button>
              <Button
                size="sm"
                variant={state.muted ? "primary" : "ghost"}
                onClick={async () => {
                  await api.muteNotifications(!state.muted);
                  await load();
                }}
              >
                {state.muted ? "Включить" : "Заглушить"}
              </Button>
            </div>
          </section>
        </div>
      </Card>

      {isOwner ? <TelegramSetup configured={state.telegramConfigured} onSaved={load} /> : null}
    </div>
  );
}

/** Подключение бота. Только для владельца: токен — ключ от канала. */
function TelegramSetup({ configured, onSaved }: { configured: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [bot, setBot] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveTelegram(token, bot);
      setToken("");
      toast("Токен сохранён");
      onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось сохранить", "error");
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setResult(null);
    try {
      const data = await api.checkTelegram();
      setResult(
        `Бот @${data.bot} на связи. Приём сообщений: ${data.webhook ? "подключён" : "не подключился"}.`,
      );
      onSaved();
    } catch (e) {
      setResult(e instanceof ApiError ? e.message : "Не удалось проверить связь");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Бот уведомлений">
      <div className="space-y-3.5 p-4">
        <p className="text-[13px] leading-relaxed text-crm-ink-2">
          У CRM свой бот, отдельный от бота сайта: направления не пересекаются,
          и отзыв одного токена не роняет второе. Заведите бота у{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-crm-link hover:underline"
          >
            @BotFather
          </a>{" "}
          командой <code className="rounded bg-crm-soft px-1">/newbot</code> и вставьте выданный токен.
        </p>

        <Field
          label="Токен бота"
          hint={configured ? "Токен уже сохранён. Введите новый, чтобы заменить" : "Вида 1234567890:AA..."}
        >
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={configured ? "••••••••••••••••" : "1234567890:AA..."}
            autoComplete="off"
          />
        </Field>

        <Field label="Имя бота" hint="Без собачки — чтобы сотрудникам показывалась ссылка на него">
          <Input value={bot} onChange={(e) => setBot(e.target.value)} placeholder="DiAvto69CrmBot" />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={busy} onClick={save} disabled={!token.trim()}>
            Сохранить
          </Button>
          <Button loading={busy} onClick={check} disabled={!configured}>
            Проверить связь
          </Button>
        </div>

        {result ? (
          <p className="rounded-lg bg-crm-soft px-3 py-2.5 text-[13px] leading-relaxed text-crm-ink">
            {result}
          </p>
        ) : null}

        <p className="text-[12px] leading-relaxed text-crm-ink-3">
          Токен на экране не показывается — только признак «настроен». Если он
          утечёт, отзовите его у @BotFather командой <code>/revoke</code> и сохраните новый.
        </p>
      </div>
    </Card>
  );
}
