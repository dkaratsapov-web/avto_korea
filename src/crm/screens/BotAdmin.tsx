/**
 * Раздел «Бот» — та же админка, что в мини-аппе Telegram, внутри CRM.
 *
 * Не перенос и не копия данных: это тот же интерфейс (TmaAdmin), который
 * вызывает те же действия бота, только не с телефона, а через сервер CRM.
 * Каталог, заявки, настройки, отзывы, рассылка — всё живёт у бота, поэтому
 * правка здесь сразу видна в мини-аппе и наоборот.
 *
 * Подключается полным ключом из бота (команда /crm_admin). Раздел только
 * для владельца: ключ даёт права владельца бота.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, RefreshCw } from "lucide-react";
import { TmaAdmin } from "@/components/pages/TmaAdmin";
import { ALL_CAPS, setAdminTransport } from "@/lib/api";
import { api, ApiError } from "../lib/api";
import { Button, Card, Field, Input, Spinner, useToast } from "../ui";
import { PageHead } from "./Layout";

export function BotAdmin() {
  const toast = useToast();
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  // Пока открыт раздел, админка бота ходит через CRM, а не напрямую к боту.
  useEffect(() => {
    setAdminTransport(api.botCall);
    return () => setAdminTransport(null);
  }, []);

  const load = () => {
    setFailed(null);
    setConnected(null);
    api
      .botStatus()
      .then((r) => setConnected(r.connected))
      .catch((e: unknown) => setFailed(e instanceof ApiError ? e.message : "Не удалось связаться с ботом"));
  };
  useEffect(load, []);

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.connectBot(key.trim());
      setConnected(r.connected);
      setKey("");
      toast("Бот подключён");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Не удалось подключить", "error");
    } finally {
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <>
        <PageHead title="Бот" subtitle="Админка Telegram-бота" />
        <Card className="p-6 text-center">
          <p className="text-crm-ink-2">{failed}</p>
          <Button className="mt-4" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Повторить
          </Button>
        </Card>
      </>
    );
  }

  if (connected === null) return <Spinner />;

  if (!connected) {
    return (
      <>
        <PageHead title="Бот" subtitle="Админка Telegram-бота — та же, что в мини-аппе" />
        <Card className="max-w-xl p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-crm-ink">
            <KeyRound className="h-5 w-5" /> Подключение
          </div>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-[14px] text-crm-ink-2">
            <li>Откройте чат с ботом @DI_AVTO_69_BOT.</li>
            <li>
              Отправьте команду <code className="rounded bg-crm-soft px-1">/crm_admin</code>.
            </li>
            <li>Скопируйте ключ из ответа и вставьте ниже.</li>
          </ol>
          <form onSubmit={connect} className="space-y-3">
            <Field label="Полный ключ бота">
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Ключ из /crm_admin"
                autoComplete="off"
              />
            </Field>
            <Button type="submit" disabled={busy || key.trim().length < 20}>
              {busy ? "Проверяем…" : "Подключить"}
            </Button>
          </form>
          <p className="mt-3 text-[12.5px] text-crm-ink-3">
            Ключ отзывов (/crm) сюда не подходит: он даёт только отзывы.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHead title="Бот" subtitle="Админка Telegram-бота. Изменения сразу видны в мини-аппе." />
      {/* Админка мини-аппа свёрстана под тёмный экран телефона — даём ей
          её родной фон, чтобы она выглядела так же, как в Telegram. */}
      <div className="dark-bot-admin mx-auto max-w-[560px] rounded-[20px] bg-graphite p-4 text-white shadow-lg">
        <TmaAdmin
          tg={null}
          initData="crm"
          owner
          caps={ALL_CAPS.map((c) => c.key)}
          onExit={() => navigate("/crm")}
        />
      </div>
    </>
  );
}
