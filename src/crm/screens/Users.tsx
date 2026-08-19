/**
 * Сотрудники. Раздел владельца.
 *
 * Отключение сотрудника действует немедленно: сервер удаляет его сессии,
 * и человек выпадает из CRM, не дожидаясь, пока истечёт кука. То же при
 * смене пароля — уходят все устройства, включая забытые.
 */

import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { KeyRound, Plus, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth";
import { formatMoment, initials } from "../lib/format";
import type { User } from "../lib/types";
import { Badge, Button, Card, Field, Input, Modal, Select, Spinner, useToast } from "../ui";
import { PageHead } from "./Layout";

export function Users() {
  const { isOwner, user: me } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<User[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordFor, setPasswordFor] = useState<User | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    api
      .users()
      .then(({ users: list }) => setUsers(list))
      .catch((e) => {
        toast(e instanceof ApiError ? e.message : "Не удалось загрузить список", "error");
        setUsers([]);
      });
  }, [isOwner, toast]);

  // Ограничение стоит и на сервере: этот переход — только чтобы не показывать
  // пустой экран тому, кому раздел не полагается.
  if (!isOwner) return <Navigate to="/crm" replace />;
  if (!users) return <Spinner />;

  const patch = async (user: User, changes: Record<string, unknown>, message: string) => {
    try {
      const result = await api.updateUser(user.id, changes);
      setUsers((list) => (list ? list.map((u) => (u.id === user.id ? result.user : u)) : list));
      toast(message);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось изменить", "error");
    }
  };

  return (
    <>
      <PageHead
        title="Сотрудники"
        subtitle="Владелец видит все разделы, менеджер — сделки, задачи и аналитику"
        action={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Добавить
          </Button>
        }
      />

      <Card>
        <ul className="divide-y divide-[#eef1f5]">
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#eef1f5] text-[12.5px] font-bold text-[#3c4655]">
                {initials(user.name)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-bold text-[#111827]">{user.name}</span>
                  {user.role === "OWNER" ? (
                    <Badge color="#8b5cf6">
                      <ShieldCheck className="h-3 w-3" />
                      Владелец
                    </Badge>
                  ) : null}
                  {!user.isActive ? (
                    <Badge color="#ef4444">Отключён</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-[#8a93a0]">
                  {user.email} · в CRM с {formatMoment(user.createdAt).slice(0, 10)}
                </p>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => setPasswordFor(user)} title="Сменить пароль">
                  <KeyRound className="h-4 w-4" />
                </Button>

                {user.id !== me?.id ? (
                  <Button
                    size="sm"
                    variant={user.isActive ? "danger" : "ghost"}
                    onClick={() =>
                      void patch(
                        user,
                        { isActive: !user.isActive },
                        user.isActive ? "Доступ отключён" : "Доступ восстановлен",
                      )
                    }
                  >
                    {user.isActive ? <UserMinus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {user.isActive ? "Отключить" : "Включить"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <CreateUser
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(user) => {
          setUsers((list) => (list ? [...list, user] : [user]));
          setCreateOpen(false);
          toast("Сотрудник добавлен");
        }}
      />

      <ChangePassword
        user={passwordFor}
        onClose={() => setPasswordFor(null)}
        onDone={() => {
          setPasswordFor(null);
          toast("Пароль изменён — сотрудник выйдет на всех устройствах");
        }}
      />
    </>
  );
}

function CreateUser({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: User) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MANAGER");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { user } = await api.createUser({ name, email, password, role });
      onCreated(user);
      setName("");
      setEmail("");
      setPassword("");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось добавить", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Новый сотрудник">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Имя">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Анна Иванова" required />
        </Field>
        <Field label="Почта" hint="По ней сотрудник входит в CRM">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="anna@diauto69.ru"
            required
          />
        </Field>
        <Field label="Пароль" hint="Не короче 8 символов. Передайте его сотруднику лично">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Роль">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="MANAGER">Менеджер</option>
            <option value="OWNER">Владелец</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Добавить
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ChangePassword({
  user,
  onClose,
  onDone,
}: {
  user: User | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setBusy(true);
    try {
      await api.updateUser(user.id, { password });
      setPassword("");
      onDone();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось сменить пароль", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={Boolean(user)} onClose={onClose} title={`Новый пароль — ${user?.name ?? ""}`}>
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Пароль" hint="Не короче 8 символов">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Сменить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
