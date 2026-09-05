/**
 * Резервные копии записей CRM.
 *
 * Раздел, в который заходят дважды: один раз — убедиться, что копии снимаются,
 * и второй — в худший день. Поэтому здесь ничего не спрятано за многоточиями:
 * видно, когда снята последняя копия, куда уходит второй экземпляр и что
 * именно вернётся при восстановлении.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Download, HardDriveDownload, RotateCcw, Send, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth";
import { formatMoment, formatSize, plural } from "../lib/format";
import { Button, Card, Empty, Spinner, useToast } from "../ui";
import { PageHead } from "./Layout";

type State = {
  backups: { name: string; size: number; createdAt: string }[];
  telegram: boolean;
  everyHours: number;
  keep: number;
};

export function Backups() {
  const { isOwner } = useAuth();
  const toast = useToast();

  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = useCallback(
    (e: unknown) => toast(e instanceof ApiError ? e.message : "Не удалось", "error"),
    [toast],
  );

  const load = useCallback(() => {
    if (!isOwner) return;
    api.backups().then(setState).catch(fail);
  }, [isOwner, fail]);

  useEffect(load, [load]);

  if (!isOwner) return <Navigate to="/crm" replace />;
  if (!state) return <Spinner />;

  const make = async () => {
    setBusy(true);
    try {
      const result = await api.makeBackup();
      setState(result);
      toast(result.sent ? "Копия снята и отправлена в Telegram" : "Копия снята");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (name: string) => {
    const ok = window.confirm(
      `Восстановить записи из копии ${name}?\n\n` +
        "Сделки, задачи, история и сотрудники вернутся к состоянию на момент копии. " +
        "Всё, что сделано позже, будет потеряно — но перед восстановлением снимется " +
        "копия текущего состояния, так что шаг можно отыграть назад.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const result = await api.restoreBackup(name);
      setState(result);
      const total = Object.values(result.restored).reduce((sum, n) => sum + n, 0);
      toast(`Восстановлено записей: ${total}. Текущее состояние сохранено как ${result.safety}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name: string) => {
    if (!window.confirm(`Удалить копию ${name}?`)) return;
    setBusy(true);
    try {
      setState(await api.deleteBackup(name));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const last = state.backups[0];

  return (
    <>
      <PageHead
        title="Резервные копии"
        subtitle="Сделки, задачи, история и сотрудники — снимок раз в сутки"
        action={
          <Button variant="primary" onClick={make} loading={busy}>
            <HardDriveDownload className="h-4 w-4" />
            Снять копию сейчас
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-crm-ink-3">
            Последняя копия
          </div>
          <div className="mt-1 text-[15px] font-bold text-crm-ink">
            {last ? formatMoment(last.createdAt) : "ещё не снималась"}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-crm-ink-2">
            Снимается сама, раз в {state.everyHours} ч, попутно с обычной работой в CRM. Храним
            последние {state.keep}.
          </p>
        </Card>

        <Card>
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-crm-ink-3">
            Второй экземпляр
          </div>
          <div className="mt-1 flex items-center gap-2 text-[15px] font-bold text-crm-ink">
            {state.telegram ? (
              <>
                <Check className="h-4 w-4 text-crm-ok" /> уходит в Telegram
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-crm-warn" /> только на этом сервере
              </>
            )}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-crm-ink-2">
            {state.telegram ? (
              <>
                Копия приходит владельцу в переписку с ботом. Диск хостинга и мессенджер разом не
                пропадут.
              </>
            ) : (
              <>
                Копия рядом с базой: от ошибки в коде спасёт, от гибели диска — нет. Подключите
                Telegram в профиле, и копии начнут уходить владельцу в переписку.
              </>
            )}
          </p>
        </Card>
      </div>

      <div className="mb-4 flex gap-3 rounded-xl border border-crm-line bg-crm-raise px-4 py-3 text-[13px] leading-relaxed text-crm-ink-2">
        <Send className="mt-0.5 h-4 w-4 flex-none text-crm-ink-3" />
        <div>
          В копию входят сделки, задачи, история, сотрудники и реквизиты. Вложения сделок (фото,
          документы) в неё не входят — они весят мегабайты и хранятся только в базе. Скачанный файл
          стоит держать у себя: это и есть та копия, которая переживёт что угодно.
        </div>
      </div>

      {state.backups.length === 0 ? (
        <Empty
          title="Копий пока нет"
          hint="Первая снимется сама в ближайшие сутки — или нажмите «Снять копию сейчас»."
        />
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-crm-line">
            {state.backups.map((b, i) => (
              <li key={b.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-crm-ink">
                    {formatMoment(b.createdAt)}
                    {i === 0 ? (
                      <span className="ml-2 text-[12px] font-bold text-crm-ok">свежая</span>
                    ) : null}
                  </div>
                  <div className="truncate text-[12px] text-crm-ink-3">
                    {b.name} · {formatSize(b.size)}
                  </div>
                </div>
                <div className="flex flex-none gap-2">
                  <a href={api.backupUrl(b.name)} download title="Скачать себе">
                    <Button size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button size="sm" onClick={() => restore(b.name)} disabled={busy} title="Восстановить">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => remove(b.name)}
                    disabled={busy}
                    title="Удалить копию"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-3 text-[12.5px] text-crm-ink-3">
        Всего копий: {state.backups.length}{" "}
        {plural(state.backups.length, ["штука", "штуки", "штук"])}.
      </p>
    </>
  );
}
