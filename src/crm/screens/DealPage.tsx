/**
 * Карточка сделки — рабочее место менеджера.
 *
 * Всё, что нужно по одной машине, на одном экране: клиент, авто, деньги,
 * задачи, документы и история. Переключений между вкладками нет намеренно —
 * при разговоре с клиентом искать нужное некогда.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Upload,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { STAGE_COLORS, STAGE_LABELS, STAGES, isStage, type Stage } from "../lib/stages";
import { money } from "../lib/money";
import { formatDayShort, formatMoment, formatSize, today } from "../lib/format";
import type { Deal, DealEvent, DealFile, FileKind, Task, User } from "../lib/types";
import { useAuth } from "../auth";
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner, Textarea, useToast } from "../ui";

const FILE_KIND_LABELS: Record<FileKind, string> = {
  PHOTO: "Фото авто",
  INVOICE: "Инвойс",
  CONTRACT: "Договор",
  CUSTOMS: "Таможня",
  CLIENT_DOC: "Документы клиента",
  OTHER: "Прочее",
};

export function DealPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOwner } = useAuth();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [events, setEvents] = useState<DealEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<DealFile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [data, list] = await Promise.all([api.deal(id), api.users()]);
      setDeal(data.deal);
      setEvents(data.events);
      setTasks(data.tasks);
      setFiles(data.files);
      setUsers(list.users);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Сделка не найдена", "error");
      navigate("/crm");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStage = async (stage: Stage) => {
    if (!deal) return;
    const previous = deal.stage;
    setDeal({ ...deal, stage });

    try {
      const result = await api.setStage(deal.id, stage);
      setDeal(result.deal);
      setEvents(result.events);
    } catch (e) {
      setDeal({ ...deal, stage: previous });
      toast(e instanceof ApiError ? e.message : "Не удалось сменить этап", "error");
    }
  };

  const remove = async () => {
    if (!deal) return;
    if (!window.confirm(`Удалить сделку №${deal.number}? Вместе с ней исчезнут задачи, файлы и история.`)) {
      return;
    }
    try {
      await api.deleteDeal(deal.id);
      toast("Сделка удалена");
      navigate("/crm");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось удалить", "error");
    }
  };

  if (loading || !deal) return <Spinner />;

  const car = [deal.carBrand, deal.carModel].filter(Boolean).join(" ");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/crm"
            className="mb-1.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6b7480] transition-colors hover:text-[#111827]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            К доске
          </Link>
          <h1 className="text-[20px] font-bold text-[#111827]">
            {deal.clientName}
            <span className="tnum ml-2 text-[15px] font-bold text-[#aab2bd]">№{deal.number}</span>
          </h1>
          <p className="mt-0.5 text-[13.5px] text-[#6b7480]">
            {car || "Автомобиль не указан"}
            {deal.carYear ? `, ${deal.carYear} г.в.` : ""}
            {deal.country ? ` · ${deal.country}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={deal.stage}
            onChange={(e) => {
              if (isStage(e.target.value)) void changeStage(e.target.value);
            }}
            aria-label="Этап сделки"
            className="!w-auto min-w-[200px]"
          >
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </Select>
          <Button onClick={() => navigate(`/crm/deals/${deal.id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Править
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <TasksBlock dealId={deal.id} tasks={tasks} users={users} onChange={setTasks} />
          <FilesBlock dealId={deal.id} files={files} onChange={setFiles} />
          <HistoryBlock dealId={deal.id} events={events} onChange={setEvents} />
        </div>

        <aside className="space-y-4">
          <Card title="Деньги">
            <dl className="divide-y divide-[#eef1f5] px-4 py-1 text-[13.5px]">
              <Row
                label={`Авто, ${deal.currency}`}
                value={deal.carPrice ? deal.carPrice.toLocaleString("ru-RU") : "—"}
              />
              <Row label="Курс" value={deal.exchangeRate ? String(deal.exchangeRate) : "не задан"} />
              <Row label="Себестоимость" value={money(deal.totals.costRub)} />
              <Row label="Комиссия" value={money(deal.totals.profitRub)} />
              <Row label="Итого клиенту" value={money(deal.totals.totalRub)} strong />
              <Row label="Оплачено" value={money(deal.paidAmount)} />
              <Row
                label="Остаток"
                value={money(deal.totals.dueRub)}
                strong
                tone={deal.totals.dueRub < 0 ? "warn" : undefined}
              />
            </dl>
          </Card>

          <Card title="Документы">
            <div className="space-y-2 p-4">
              <Button
                className="w-full justify-start"
                onClick={() => window.open(`/crm/print/${deal.id}/invoice`, "_blank")}
              >
                <Receipt className="h-4 w-4" />
                Счёт на оплату
              </Button>
              <Button
                className="w-full justify-start"
                onClick={() => window.open(`/crm/print/${deal.id}/contract`, "_blank")}
              >
                <FileText className="h-4 w-4" />
                Договор
              </Button>
            </div>
          </Card>

          <TrackBlock deal={deal} onChange={setDeal} />

          <Card title="Клиент и авто">
            <dl className="divide-y divide-[#eef1f5] px-4 py-1 text-[13.5px]">
              <Row label="Телефон" value={deal.clientPhone ?? "—"} />
              <Row label="Telegram" value={deal.clientTelegram ?? "—"} />
              <Row label="Источник" value={deal.source ?? "—"} />
              <Row label="Ответственный" value={deal.managerName ?? "—"} />
              <Row label="VIN" value={deal.vin ?? "—"} />
              <Row label="Пробег" value={deal.carMileage ? `${deal.carMileage.toLocaleString("ru-RU")} км` : "—"} />
              <Row label="Покупка" value={formatDayShort(deal.purchaseDate)} />
              <Row label="Прибытие" value={formatDayShort(deal.etaDate)} />
            </dl>

            {deal.lotUrl ? (
              <div className="border-t border-[#eef1f5] p-4">
                <a
                  href={deal.lotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1f6feb] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Лот на площадке
                </a>
              </div>
            ) : null}

            {deal.notes ? (
              <div className="border-t border-[#eef1f5] p-4">
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7b8593]">
                  Заметки
                </p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#3c4655]">
                  {deal.notes}
                </p>
              </div>
            ) : null}
          </Card>

          {isOwner ? (
            <Button variant="danger" onClick={remove} className="w-full">
              <Trash2 className="h-4 w-4" />
              Удалить сделку
            </Button>
          ) : null}
        </aside>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ задачи */

function TasksBlock({
  dealId,
  tasks,
  users,
  onChange,
}: {
  dealId: string;
  tasks: Task[];
  users: User[];
  onChange: (tasks: Task[]) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [assigneeId, setAssigneeId] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    setBusy(true);
    try {
      const result = await api.createTask({ dealId, title: title.trim(), dueDate, assigneeId });
      onChange(result.tasks);
      setTitle("");
      setOpen(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось создать задачу", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (task: Task) => {
    try {
      const result = await api.updateTask(task.id, { isDone: !task.isDone });
      onChange(result.tasks);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось изменить задачу", "error");
    }
  };

  const remove = async (task: Task) => {
    try {
      await api.deleteTask(task.id);
      onChange(tasks.filter((t) => t.id !== task.id));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось удалить задачу", "error");
    }
  };

  return (
    <Card
      title="Задачи"
      action={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      }
    >
      {tasks.length === 0 ? (
        <Empty title="Задач нет" hint="Поставьте задачу, чтобы не забыть следующий шаг по этой машине." />
      ) : (
        <ul className="divide-y divide-[#eef1f5]">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => void toggle(task)}
                aria-label={task.isDone ? "Вернуть в работу" : "Отметить выполненной"}
                className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded border transition-colors ${
                  task.isDone
                    ? "border-[#16a34a] bg-[#16a34a] text-white"
                    : "border-[#c6cdd6] hover:border-[#1f2937]"
                }`}
              >
                {task.isDone ? <Check className="h-3 w-3" /> : null}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-[13.5px] leading-snug ${
                    task.isDone ? "text-[#9aa3ae] line-through" : "text-[#111827]"
                  }`}
                >
                  {task.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#8a93a0]">
                  {task.dueDate ? <UrgencyBadge task={task} /> : <span>без срока</span>}
                  {task.assigneeName ? <span>· {task.assigneeName}</span> : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void remove(task)}
                aria-label="Удалить задачу"
                className="rounded p-1 text-[#aab2bd] transition-colors hover:bg-[#fef3f2] hover:text-[#b42318]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новая задача">
        <form onSubmit={add} className="space-y-3.5">
          <Field label="Что сделать">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Запросить фото с площадки"
              autoFocus
              required
            />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Срок">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Исполнитель">
              <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Я</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Отмена</Button>
            <Button type="submit" variant="primary" loading={busy}>
              Создать
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

export function UrgencyBadge({ task }: { task: Task }) {
  if (task.urgency === "overdue") {
    return <span className="font-bold text-[#b42318]">просрочена · {formatDayShort(task.dueDate)}</span>;
  }
  if (task.urgency === "today") {
    return <span className="font-bold text-[#b45309]">сегодня</span>;
  }
  return <span>до {formatDayShort(task.dueDate)}</span>;
}

/* ------------------------------------------------------------------- файлы */

function FilesBlock({
  dealId,
  files,
  onChange,
}: {
  dealId: string;
  files: DealFile[];
  onChange: (files: DealFile[]) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>("PHOTO");
  const [busy, setBusy] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);

    try {
      let latest = files;
      // Файлы шлём по одному: так понятно, какой именно не прошёл проверку.
      for (const file of Array.from(list)) {
        const result = await api.uploadFile(dealId, file, kind);
        latest = result.files;
      }
      onChange(latest);
      toast("Файлы загружены");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось загрузить файл", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (file: DealFile) => {
    if (!window.confirm(`Удалить «${file.name}»?`)) return;
    try {
      await api.deleteFile(file.id);
      onChange(files.filter((f) => f.id !== file.id));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось удалить файл", "error");
    }
  };

  return (
    <Card
      title="Файлы"
      action={
        <div className="flex items-center gap-2">
          <Select value={kind} onChange={(e) => setKind(e.target.value as FileKind)} className="!h-8 !text-[13px]">
            {(Object.keys(FILE_KIND_LABELS) as FileKind[]).map((key) => (
              <option key={key} value={key}>
                {FILE_KIND_LABELS[key]}
              </option>
            ))}
          </Select>
          <Button size="sm" loading={busy} onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4" />
            Загрузить
          </Button>
        </div>
      }
    >
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => void upload(e.target.files)}
      />

      {files.length === 0 ? (
        <Empty
          title="Файлов нет"
          hint="Фото авто, инвойсы и таможенные документы. До 8 МБ на файл. Фото с типом «Фото авто» клиент увидит по ссылке отслеживания."
        />
      ) : (
        <ul className="divide-y divide-[#eef1f5]">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-4 py-2.5">
              <Paperclip className="h-4 w-4 flex-none text-[#aab2bd]" />
              <a
                href={api.fileUrl(file.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#1f2937] hover:underline"
              >
                {file.name}
              </a>
              <Badge className="hidden bg-[#eef1f5] text-[#5b6470] sm:inline-flex">
                {FILE_KIND_LABELS[file.kind]}
              </Badge>
              <span className="tnum hidden flex-none text-[12px] text-[#8a93a0] sm:block">
                {formatSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => void remove(file)}
                aria-label="Удалить файл"
                className="rounded p-1 text-[#aab2bd] transition-colors hover:bg-[#fef3f2] hover:text-[#b42318]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- история */

function HistoryBlock({
  dealId,
  events,
  onChange,
}: {
  dealId: string;
  events: DealEvent[];
  onChange: (events: DealEvent[]) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;

    setBusy(true);
    try {
      const result = await api.comment(dealId, text.trim());
      onChange(result.events);
      setText("");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось отправить", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="История и комментарии">
      <form onSubmit={send} className="border-b border-[#eef1f5] p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что обсудили с клиентом, о чём договорились"
          className="min-h-[64px]"
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!text.trim()}>
            Добавить
          </Button>
        </div>
      </form>

      <ul className="divide-y divide-[#eef1f5]">
        {events.map((event) => (
          <li key={event.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#8a93a0]">
              <span className="font-semibold text-[#5b6470]">{event.userName ?? "Система"}</span>
              <span>{formatMoment(event.createdAt)}</span>
            </div>
            <div className="mt-1 text-[13.5px] leading-snug text-[#111827]">
              <EventText event={event} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EventText({ event }: { event: DealEvent }) {
  if (event.type === "COMMENT") {
    return <span className="whitespace-pre-wrap">{event.text}</span>;
  }

  if (event.type === "CREATED") {
    return <span className="text-[#6b7480]">Сделка создана</span>;
  }

  if (event.type === "STAGE_CHANGED") {
    const from = isStage(event.from) ? event.from : null;
    const to = isStage(event.to) ? event.to : null;
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-[#6b7480]">
        Этап:
        {from ? (
          <Badge color={STAGE_COLORS[from]}>{STAGE_LABELS[from]}</Badge>
        ) : null}
        →
        {to ? <Badge color={STAGE_COLORS[to]}>{STAGE_LABELS[to]}</Badge> : null}
      </span>
    );
  }

  return <span className="text-[#6b7480]">Изменено: {event.text ?? "—"}</span>;
}

/* -------------------------------------------------------- ссылка отслеживания */

function TrackBlock({ deal, onChange }: { deal: Deal; onChange: (deal: Deal) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const url = deal.publicToken ? `${window.location.origin}/crm/track/${deal.publicToken}` : null;

  const act = async (revoke: boolean) => {
    setBusy(true);
    try {
      const result = await api.trackToken(deal.id, revoke);
      onChange({ ...deal, publicToken: result.publicToken });
      toast(revoke ? "Ссылка отозвана" : "Ссылка выдана");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось изменить ссылку", "error");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast("Ссылка скопирована");
    } catch {
      // Буфер обмена недоступен без защищённого соединения — показываем адрес,
      // чтобы его можно было выделить руками.
      toast(url);
    }
  };

  return (
    <Card title="Ссылка для клиента">
      <div className="space-y-2.5 p-4">
        {url ? (
          <>
            <p className="break-all rounded-lg bg-[#f4f6f8] px-3 py-2 text-[12px] text-[#5b6470]">{url}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={copy} className="flex-1">
                <Copy className="h-4 w-4" />
                Скопировать
              </Button>
              <Button size="sm" onClick={() => window.open(url, "_blank")} title="Открыть">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="danger" loading={busy} onClick={() => void act(true)} className="w-full">
              Отозвать
            </Button>
          </>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-[#6b7480]">
              Клиент увидит этап, срок прибытия, фото авто и сумму. Закупочная цена,
              расходы и комиссия по ссылке не отдаются.
            </p>
            <Button size="sm" variant="primary" loading={busy} onClick={() => void act(false)} className="w-full">
              <Link2 className="h-4 w-4" />
              Выдать ссылку
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="flex-none text-[#6b7480]">{label}</dt>
      <dd
        className={`tnum truncate text-right ${strong ? "text-[15px] font-bold" : "font-semibold"} ${
          tone === "warn" ? "text-[#b42318]" : "text-[#111827]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
