/**
 * Вход в CRM и первичная настройка.
 *
 * Пока в базе нет ни одного сотрудника, форма работает как создание владельца.
 * Как только владелец появился, метод setup на сервере отвечает отказом
 * навсегда, и остальных сотрудников заводит уже он изнутри.
 */

import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth";
import { Button, Field, Input } from "../ui";

export function Login() {
  const { needsSetup, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const result = needsSetup
        ? await api.setup(name.trim(), email.trim(), password)
        : await api.login(email.trim(), password);
      signIn(result.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#1f2937] text-white">
            {needsSetup ? <ShieldCheck className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
          </div>
          <h1 className="text-[20px] font-bold text-[#111827]">
            {needsSetup ? "Настройка CRM" : "Вход в CRM"}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[#6b7480]">
            {needsSetup
              ? "Первый запуск: создайте учётную запись владельца. Дальше сотрудников добавляете вы."
              : "Внутренний раздел ДиАвто69"}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-3.5 rounded-xl border border-[#e3e8ee] bg-white p-5 shadow-[0_16px_40px_-24px_rgba(13,17,22,0.45)]"
        >
          {needsSetup ? (
            <Field label="Имя">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Дмитрий Петренко"
                autoComplete="name"
                required
              />
            </Field>
          ) : null}

          <Field label="Почта">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@diauto69.ru"
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Пароль" hint={needsSetup ? "Не короче 8 символов" : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={needsSetup ? "new-password" : "current-password"}
              required
            />
          </Field>

          {error ? (
            <p className="rounded-lg bg-[#fef3f2] px-3 py-2.5 text-[13px] font-semibold text-[#b42318]">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" loading={busy} className="w-full">
            {needsSetup ? "Создать владельца" : "Войти"}
          </Button>
        </form>

        {needsSetup ? (
          <p className="mt-4 text-center text-[12px] leading-relaxed text-[#8a93a0]">
            Пока владелец не создан, этот экран открыт всем, кто знает адрес.
            Завершите настройку сразу после выкладки.
          </p>
        ) : null}
      </div>
    </div>
  );
}
