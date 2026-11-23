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
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { STAGE_COLORS, STAGE_LABELS, STAGES, isStage, type Stage } from "../lib/stages";
import { money } from "../lib/money";
import { formatDayShort, formatMoment, formatSize, isCallbackDue, today } from "../lib/format";
import type { Deal, DealEvent, DealFile, FileKind, Task, User } from "../lib/types";
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
            className="mb-1.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-crm-ink-2 transition-colors hover:text-crm-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            К доске
          </Link>
          <h1 className="text-[20px] font-bold text-crm-ink">
            {deal.clientName}
            <span className="tnum ml-2 text-[15px] font-bold text-crm-ink-3">№{deal.number}</span>
          </h1>
          <p className="mt-0.5 text-[13.5px] text-crm-ink-2">
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
          {/* Задачи и файлы возвращают обновлённую историю: событие про
              загруженное фото должно появляться в ленте сразу, а не после
              перезагрузки страницы. */}
          <TasksBlock
            dealId={deal.id}
            tasks={tasks}
            users={users}
            onChange={setTasks}
            onEvents={setEvents}
          />
          <FilesBlock dealId={deal.id} files={files} onChange={setFiles} onEvents={setEvents} />
          <HistoryBlock dealId={deal.id} events={events} onChange={setEvents} />
        </div>

        <aside className="space-y-4">
          <Card title="Деньги">
            <dl className="divide-y divide-crm-soft px-4 py-1 text-[13.5px]">
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
            <dl className="divide-y divide-crm-soft px-4 py-1 text-[13.5px]">
              <Row label="Телефон" value={deal.clientPhone ?? "—"} />
              <Row label="Telegram" value={deal.clientTelegram ?? "—"} />
              <Row label="Источник" value={deal.source ?? "—"} />
              <Row label="Ответственный" value={deal.managerName ?? "—"} />
              <Row label="VIN" value={deal.vin ?? "—"} />
              <Row label="Пробег" value={deal.carMileage ? `${deal.carMileage.toLocaleString("ru-RU")} км` : "—"} />
              <Row
                label="Перезвонить"
                value={deal.callbackAt ? formatMoment(deal.callbackAt) : "—"}
                tone={isCallbackDue(deal.callbackAt) ? "warn" : undefined}
              />
              <Row label="Покупка" value={formatDayShort(deal.purchaseDate)} />
              <Row label="Прибытие" value={formatDayShort(deal.etaDate)} />
            </dl>

            {deal.lotUrl ? (
              <div className="border-t border-crm-soft p-4">
                <a
                  href={deal.lotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-crm-link hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Лот на площадке
                </a>
              </div>
            ) : null}

            {deal.notes ? (
              <div className="border-t border-crm-soft p-4">
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-crm-ink-3">
                  Заметки
                </p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-crm-ink-2">
                  {deal.notes}
                </p>
              </div>
            ) : null}
          </Card>

          <Button variant="danger" onClick={remove} className="w-full">
            <Trash2 className="h-4 w-4" />
            Удалить сделку
          </Button>
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
  onEvents,
}: {
  dealId: string;
  tasks: Task[];
  users: User[];
  onChange: (tasks: Task[]) => void;
  onEvents: (events: DealEvent[]) => void;
}) {
  const toast = useToast();
  // null — окно закрыто, "new" — создание, задача — правка существующей.
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  const toggle = async (task: Task) => {
    try {
      const result = await api.updateTask(task.id, { isDone: !task.isDone });
      onChange(result.tasks);
      if (result.events) onEvents(result.events);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось изменить задачу", "error");
    }
  };

  const remove = async (task: Task) => {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    try {
      const result = await api.deleteTask(task.id);
      onChange(tasks.filter((t) => t.id !== task.id));
      if (result.events) onEvents(result.events);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось удалить задачу", "error");
    }
  };

  return (
    <Card
      title="Задачи"
      action={
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      }
    >
      {tasks.length === 0 ? (
        <Empty title="Задач нет" hint="Поставьте задачу, чтобы не забыть следующий шаг по этой машине." />
      ) : (
        <ul className="divide-y divide-crm-line">
          {tasks.map((task) => (
            <li key={task.id} className="group flex items-start gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => void toggle(task)}
                aria-label={task.isDone ? "Вернуть в работу" : "Отметить выполненной"}
                className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border transition-colors ${
                  task.isDone
                    ? "border-crm-ok bg-crm-ok text-white"
                    : "border-crm-line-2 hover:border-crm-accent"
                }`}
              >
                {task.isDone ? <Check className="h-3 w-3" /> : null}
              </button>

              {/* Вся строка кликабельна: открыть задачу на правку — самое
                  частое действие после отметки о выполнении. */}
              <button
                type="button"
                onClick={() => setEditing(task)}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className={`block text-[13.5px] leading-snug ${
                    task.isDone ? "text-crm-ink-3 line-through" : "text-crm-ink"
                  }`}
                >
                  {task.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-crm-ink-3">
                  {task.dueDate ? <UrgencyBadge task={task} /> : <span>без срока</span>}
                  {task.assigneeName ? <span>· {task.assigneeName}</span> : null}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void remove(task)}
                aria-label={`Удалить задачу ${task.title}`}
                className="rounded-lg p-1 text-crm-ink-3 opacity-0 transition-opacity hover:text-crm-danger focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <TaskEditor
        dealId={dealId}
        task={editing}
        users={users}
        onClose={() => setEditing(null)}
        onSaved={(nextTasks, nextEvents) => {
          onChange(nextTasks);
          if (nextEvents) onEvents(nextEvents);
          setEditing(null);
        }}
      />
    </Card>
  );
}

/** Быстрые сроки: «сегодня» и «завтра» ставятся чаще всех остальных вместе. */
function shiftDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

const DUE_PRESETS: { label: string; value: () => string }[] = [
  { label: "Сегодня", value: () => shiftDays(0) },
  { label: "Завтра", value: () => shiftDays(1) },
  { label: "Через неделю", value: () => shiftDays(7) },
];

/**
 * Создание и правка задачи одной формой.
 *
 * Отдельного окна для правки нет намеренно: поля те же, и разводить две почти
 * одинаковые формы — верный способ поправить одну и забыть другую.
 */
function TaskEditor({
  dealId,
  task,
  users,
  onClose,
  onSaved,
}: {
  dealId: string;
  task: Task | "new" | null;
  users: User[];
  onClose: () => void;
  onSaved: (tasks: Task[], events?: DealEvent[]) => void;
}) {
  const toast = useToast();
  const editing = task !== null && task !== "new" ? task : null;

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [busy, setBusy] = useState(false);

  // Поля заполняются при каждом открытии: окно живёт в дереве постоянно,
  // и без этого в нём остались бы значения от прошлой задачи.
  useEffect(() => {
    if (task === null) return;
    setTitle(editing?.title ?? "");
    setDueDate(editing?.dueDate ?? (editing ? "" : today()));
    setAssigneeId(editing?.assigneeId ?? "");
  }, [task, editing]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    setBusy(true);
    try {
      const result = editing
        ? await api.updateTask(editing.id, { title: title.trim(), dueDate, assigneeId })
        : await api.createTask({ dealId, title: title.trim(), dueDate, assigneeId });
      onSaved(result.tasks, result.events);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось сохранить задачу", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={task !== null}
      onClose={onClose}
      title={editing ? "Задача" : "Новая задача"}
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Что сделать">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Запросить фото с площадки"
            autoFocus
            required
          />
        </Field>

        <Field label="Срок">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        <div className="-mt-1 flex flex-wrap gap-1.5">
          {DUE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDueDate(preset.value())}
              className="rounded-full border border-crm-line-2 px-3 py-1 text-[12.5px] font-semibold text-crm-ink-2 transition-colors hover:border-crm-accent hover:text-crm-ink"
            >
              {preset.label}
            </button>
          ))}
          {dueDate ? (
            <button
              type="button"
              onClick={() => setDueDate("")}
              className="rounded-full px-3 py-1 text-[12.5px] font-semibold text-crm-ink-3 transition-colors hover:text-crm-danger"
            >
              Без срока
            </button>
          ) : null}
        </div>

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

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" loading={busy}>
            {editing ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UrgencyBadge({ task }: { task: Task }) {
  if (task.urgency === "overdue") {
    return <span className="font-bold text-crm-danger">просрочена · {formatDayShort(task.dueDate)}</span>;
  }
  if (task.urgency === "today") {
    return <span className="font-bold text-crm-warn">сегодня</span>;
  }
  return <span>до {formatDayShort(task.dueDate)}</span>;
}

/* ------------------------------------------------------------------- файлы */

function FilesBlock({
  dealId,
  files,
  onChange,
  onEvents,
}: {
  dealId: string;
  files: DealFile[];
  onChange: (files: DealFile[]) => void;
  onEvents: (events: DealEvent[]) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>("PHOTO");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const upload = async (list: FileList | File[] | null) => {
    const chosen = list ? Array.from(list) : [];
    if (chosen.length === 0) return;
    setBusy(true);

    try {
      let latest = files;
      let events: DealEvent[] | undefined;
      // Файлы шлём по одному: так понятно, какой именно не прошёл проверку.
      for (const file of chosen) {
        const result = await api.uploadFile(dealId, file, kind);
        latest = result.files;
        events = result.events;
      }
      onChange(latest);
      if (events) onEvents(events);
      toast(chosen.length > 1 ? "Файлы загружены" : "Файл загружен");
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
      const result = await api.deleteFile(file.id);
      onChange(files.filter((f) => f.id !== file.id));
      if (result.events) onEvents(result.events);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось удалить файл", "error");
    }
  };

  return (
    <Card
      title="Файлы"
      action={
        <div className="flex items-center gap-2">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as FileKind)}
            className="!h-8 !text-[13px]"
            aria-label="Тип загружаемого файла"
          >
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
      <input ref={input} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />

      {/* Перетаскивание прямо на блок: фото с площадки чаще всего приходят
          пачкой, и открывать диалог выбора ради каждой — лишний шаг. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload(e.dataTransfer.files);
        }}
        className={`transition-colors ${dragOver ? "bg-crm-accent-soft" : ""}`}
      >
        {files.length === 0 ? (
          <Empty
            title={dragOver ? "Отпустите — загрузим" : "Файлов нет"}
            hint="Перетащите фото и документы сюда или нажмите «Загрузить». До 8 МБ на файл. Фото с типом «Фото авто» клиент увидит по ссылке отслеживания."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {files.map((file) => (
              <FileTile
                key={file.id}
                file={file}
                onOpen={() => setViewing(file.id)}
                onRemove={() => void remove(file)}
              />
            ))}
          </div>
        )}
      </div>

      <FileViewer
        files={files}
        openId={viewing}
        onClose={() => setViewing(null)}
        onNavigate={setViewing}
      />
    </Card>
  );
}

/** Картинка ли это — по типу содержимого, который определил сервер. */
function isImage(file: DealFile): boolean {
  return file.mimeType.startsWith("image/");
}

const FILE_ICONS: Record<string, typeof FileText> = {
  "application/pdf": FileText,
};

function FileTile({
  file,
  onOpen,
  onRemove,
}: {
  file: DealFile;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const Icon = FILE_ICONS[file.mimeType] ?? Paperclip;

  return (
    <figure className="group relative overflow-hidden rounded-xl border border-crm-line bg-crm-raise">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        title={file.name}
      >
        <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-crm-soft">
          {isImage(file) ? (
            <img
              // Миниатюра, а не оригинал: снимков с телефона на сделку бывает
              // три десятка, и открывать страницу ценой сотни мегабайт нельзя.
              src={api.fileThumbUrl(file.id)}
              alt={file.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <Icon className="h-8 w-8 text-crm-ink-3" />
          )}
        </span>

        <figcaption className="px-2.5 py-2">
          <span className="block truncate text-[12.5px] font-semibold text-crm-ink">{file.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-crm-ink-3">
            <span>{FILE_KIND_LABELS[file.kind]}</span>
            <span aria-hidden>·</span>
            <span className="tnum">{formatSize(file.size)}</span>
          </span>
        </figcaption>
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Удалить ${file.name}`}
        className="absolute right-1.5 top-1.5 rounded-lg bg-crm-surface/90 p-1.5 text-crm-ink-3 opacity-0 backdrop-blur transition-opacity hover:text-crm-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </figure>
  );
}

/**
 * Просмотр файла поверх страницы.
 *
 * Открывать вложения в новой вкладке неудобно: менеджер листает фото по
 * одному и каждый раз возвращается назад. Здесь фото листаются стрелками,
 * не покидая карточку сделки.
 */
function FileViewer({
  files,
  openId,
  onClose,
  onNavigate,
}: {
  files: DealFile[];
  openId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const index = files.findIndex((f) => f.id === openId);
  const file = index >= 0 ? files[index] : null;

  // Листаем только по картинкам: перескакивать с фото на PDF стрелкой странно.
  const gallery = files.filter(isImage);
  const galleryIndex = file && isImage(file) ? gallery.findIndex((f) => f.id === file.id) : -1;

  const step = useCallback(
    (delta: number) => {
      if (galleryIndex < 0 || gallery.length < 2) return;
      const next = (galleryIndex + delta + gallery.length) % gallery.length;
      onNavigate(gallery[next].id);
    },
    [galleryIndex, gallery, onNavigate],
  );

  useEffect(() => {
    if (!file) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [file, onClose, step]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label={file.name}
    >
      <header
        className="flex flex-none items-center gap-3 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{file.name}</span>

        {gallery.length > 1 && galleryIndex >= 0 ? (
          <span className="tnum flex-none text-[13px] text-white/60">
            {galleryIndex + 1} / {gallery.length}
          </span>
        ) : null}

        <a
          href={api.fileUrl(file.id)}
          download={file.name}
          className="flex-none rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          title="Скачать"
        >
          <Download className="h-[18px] w-[18px]" />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="flex-none rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {isImage(file) ? (
          <img
            src={api.fileUrl(file.id)}
            alt={file.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : file.mimeType === "application/pdf" ? (
          <iframe
            src={api.fileUrl(file.id)}
            title={file.name}
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full rounded-lg bg-white"
          />
        ) : (
          // Документы Word и Excel браузер показать не может — предлагаем скачать.
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl bg-crm-surface px-6 py-8 text-center"
          >
            <Paperclip className="mx-auto mb-3 h-8 w-8 text-crm-ink-3" />
            <p className="text-[15px] font-bold text-crm-ink">{file.name}</p>
            <p className="mt-1 text-[13px] text-crm-ink-2">
              Такой файл браузер не откроет — скачайте его.
            </p>
            <a
              href={api.fileUrl(file.id)}
              download={file.name}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-[10px] bg-crm-accent px-4 text-[14px] font-semibold text-white"
            >
              <Download className="h-4 w-4" />
              Скачать
            </a>
          </div>
        )}
      </div>

      {gallery.length > 1 && galleryIndex >= 0 ? (
        <>
          <button
            type="button"
            aria-label="Предыдущее фото"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Следующее фото"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
    </div>
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
      <form onSubmit={send} className="border-b border-crm-soft p-4">
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

      <ul className="divide-y divide-crm-soft">
        {events.map((event) => (
          <li key={event.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-crm-ink-3">
              <span className="font-semibold text-crm-ink-2">{event.userName ?? "Система"}</span>
              <span>{formatMoment(event.createdAt)}</span>
            </div>
            <div className="mt-1 text-[13.5px] leading-snug text-crm-ink">
              <EventText event={event} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Подписи для событий, у которых текст — просто название задачи или файла. */
const EVENT_LABELS: Partial<Record<DealEvent["type"], string>> = {
  TASK_ADDED: "Задача поставлена",
  TASK_UPDATED: "Задача изменена",
  TASK_DONE: "Задача выполнена",
  TASK_REOPENED: "Задача возвращена в работу",
  TASK_DELETED: "Задача удалена",
  FILE_ADDED: "Загружен файл",
  FILE_DELETED: "Удалён файл",
};

function EventText({ event }: { event: DealEvent }) {
  if (event.type === "COMMENT") {
    return <span className="whitespace-pre-wrap">{event.text}</span>;
  }

  if (event.type === "CREATED") {
    return <span className="text-crm-ink-2">Сделка создана</span>;
  }

  const label = EVENT_LABELS[event.type];
  if (label) {
    return (
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-crm-ink-2">{label}:</span>
        <span className="font-semibold">{event.text}</span>
        {event.type === "FILE_ADDED" && event.to ? (
          <span className="text-[12px] text-crm-ink-3">
            {FILE_KIND_LABELS[event.to as FileKind] ?? event.to}
          </span>
        ) : null}
      </span>
    );
  }

  if (event.type === "STAGE_CHANGED") {
    const from = isStage(event.from) ? event.from : null;
    const to = isStage(event.to) ? event.to : null;
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-crm-ink-2">
        Этап:
        {from ? (
          <Badge color={STAGE_COLORS[from]}>{STAGE_LABELS[from]}</Badge>
        ) : null}
        →
        {to ? <Badge color={STAGE_COLORS[to]}>{STAGE_LABELS[to]}</Badge> : null}
      </span>
    );
  }

  return <span className="text-crm-ink-2">Изменено: {event.text ?? "—"}</span>;
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
            <p className="break-all rounded-lg bg-crm-bg px-3 py-2 text-[12px] text-crm-ink-2">{url}</p>
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
            <p className="text-[13px] leading-relaxed text-crm-ink-2">
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
      <dt className="flex-none text-crm-ink-2">{label}</dt>
      <dd
        className={`tnum truncate text-right ${strong ? "text-[15px] font-bold" : "font-semibold"} ${
          tone === "warn" ? "text-crm-danger" : "text-crm-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
