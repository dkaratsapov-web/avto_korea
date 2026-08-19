/**
 * Профиль сотрудника: смена собственного пароля.
 *
 * После смены сервер закрывает все сессии, кроме текущей, — если пароль меняют
 * потому, что старый мог утечь, чужие устройства должны отвалиться сразу.
 */

import { useState, type FormEvent } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth";
import { formatMoment } from "../lib/format";
import { Button, Card, Field, Input, useToast } from "../ui";
import { PageHead } from "./Layout";

export function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (next !== repeat) {
      toast("Новый пароль и повтор не совпадают", "error");
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setRepeat("");
      toast("Пароль изменён");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось сменить пароль", "error");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await signOut();
    navigate("/crm");
  };

  return (
    <>
      <PageHead title="Профиль" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Учётная запись">
          <dl className="divide-y divide-[#eef1f5] px-4 py-1 text-[13.5px]">
            <Line label="Имя" value={user?.name ?? "—"} />
            <Line label="Почта" value={user?.email ?? "—"} />
            <Line label="Роль" value={user?.role === "OWNER" ? "Владелец" : "Менеджер"} />
            <Line label="В CRM с" value={formatMoment(user?.createdAt).slice(0, 10)} />
          </dl>
          <div className="border-t border-[#eef1f5] p-4">
            <Button variant="danger" onClick={leave}>
              <LogOut className="h-4 w-4" />
              Выйти
            </Button>
          </div>
        </Card>

        <Card title="Смена пароля">
          <form onSubmit={submit} className="space-y-3.5 p-4">
            <Field label="Текущий пароль">
              <Input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="Новый пароль" hint="Не короче 8 символов">
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Повторите новый">
              <Input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <Button type="submit" variant="primary" loading={busy}>
              Сменить пароль
            </Button>
            <p className="text-[12px] leading-relaxed text-[#8a93a0]">
              После смены вход на других устройствах перестанет работать.
            </p>
          </form>
        </Card>
      </div>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-[#6b7480]">{label}</dt>
      <dd className="font-semibold text-[#111827]">{value}</dd>
    </div>
  );
}
