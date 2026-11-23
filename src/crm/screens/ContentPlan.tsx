/**
 * Контент-план Instagram.
 *
 * Тот же план, что в PDF (context/content-calendar.md), но рабочий: у каждой
 * публикации статус, её можно перенести, поправить, добавить новую. План
 * хранится в базе CRM, поэтому изменения видят все сотрудники.
 *
 * Виды: календарь месяца, разбивка по направлениям (рубрика × неделя),
 * общий список и бриф перед запуском. Пока в базе пусто — показываем
 * стартовый план из файла и сохраняем его целиком при первой правке. Если
 * стартовый план обновился (seed.version), а в базе лежит старый — предлагаем
 * заменить, но сами не заменяем: там могут быть правки.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Columns3, List, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";
import seed from "../data/content-plan.json";
import { api, ApiError, type ContentPost } from "../lib/api";
import { Button, Card, Field, Input, Modal, Select, Spinner, Textarea, useToast } from "../ui";
import { PageHead } from "./Layout";
import { ContentBrief } from "./ContentBrief";

const RUBRICS: Record<string, string> = {
  "Авто из каталога": "#9C1A12",
  "Расчёт онлайн": "#C98A1A",
  "Разборы": "#6B4FB3",
  "Выдачи и отзывы": "#2E9E5B",
  "Сравнения и подборки": "#2F6FB3",
  "Новости рынка": "#0F8F8F",
  "Вопросы и вовлечение": "#5C6D76",
};
// Рубрики первой версии плана — чтобы сохранённые раньше публикации не серели.
const LEGACY: Record<string, string> = { "Из чего складывается цена": "#C98A1A", "Как мы проверяем": "#6B4FB3" };
const FORMATS = ["карусель", "Reels", "эфир", "опрос", "вопрос-ответ", "пост", "сторис"];
const LENGTH: Record<"short" | "long", string> = { short: "короткий", long: "длинный" };
/** Reels на ЦА Тверь — правило плана: минимум один в каждую неделю с публикациями. */
const isTverReels = (p: ContentPost) => !!p.local && /reels/i.test(p.format);
const SEED_VERSION = (seed as { version?: number }).version ?? 1;
const SEED_POSTS = seed.posts as ContentPost[];
const STATUS: Record<ContentPost["status"], { label: string; dot: string }> = {
  idea: { label: "Идея", dot: "#9AA4B2" },
  progress: { label: "В работе", dot: "#C98A1A" },
  ready: { label: "Готово", dot: "#2F6FB3" },
  published: { label: "Опубликовано", dot: "#2E9E5B" },
};
const STORIES = ["Новое в каталоге", "Выдачи · в пути", "Угадай цену → расчёт", "Выдачи · в пути", "Вопрос менеджеру", "Репосты отзывов", "Репосты отзывов"];
const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
type View = "calendar" | "rubrics" | "list" | "brief";

const colorOf = (rubric: string) => RUBRICS[rubric] || LEGACY[rubric] || "#5C6D76";
const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const monthKey = (isoDate: string) => isoDate.slice(0, 7);
const monthTitle = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const t = new Date(y, m - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(" г.", "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const shiftMonth = (key: string, by: number) => {
  const [y, m] = key.split("-").map(Number);
  return iso(new Date(y, m - 1 + by, 1)).slice(0, 7);
};
const short = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");

function readView(): View {
  try {
    const v = localStorage.getItem("crm.content.view");
    return v === "rubrics" || v === "list" || v === "brief" ? v : "calendar";
  } catch {
    return "calendar";
  }
}

export function ContentPlan() {
  const toast = useToast();
  const [posts, setPosts] = useState<ContentPost[] | null>(null);
  const [meta, setMeta] = useState<{ updatedAt?: string; updatedBy?: string; seed?: number }>({});
  const [view, setViewRaw] = useState<View>(readView);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ContentPost | null>(null);
  const [saving, setSaving] = useState(false);
  // Выбранный месяц «ГГГГ-ММ». null — ещё не выбран: возьмём текущий, если
  // в нём есть публикации, иначе первый месяц плана.
  const [monthSel, setMonth] = useState<string | null>(null);

  const setView = (v: View) => {
    setViewRaw(v);
    try {
      localStorage.setItem("crm.content.view", v);
    } catch {
      /* без памяти вида — не страшно */
    }
  };

  useEffect(() => {
    api
      .contentPlan()
      .then((r) => {
        setPosts(r.plan?.posts ?? SEED_POSTS);
        if (r.plan) setMeta({ updatedAt: r.plan.updatedAt, updatedBy: r.plan.updatedBy, seed: r.plan.seed ?? 1 });
      })
      .catch((e: unknown) => {
        toast(e instanceof ApiError ? e.message : "Не удалось загрузить план", "error");
        setPosts(SEED_POSTS);
      });
    // Один раз при открытии раздела.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(next: ContentPost[], seedVersion = meta.seed ?? SEED_VERSION) {
    setSaving(true);
    try {
      const r = await api.saveContentPlan(next, seedVersion);
      setPosts(r.plan.posts);
      setMeta({ updatedAt: r.plan.updatedAt, updatedBy: r.plan.updatedBy, seed: r.plan.seed ?? seedVersion });
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось сохранить", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const visible = useMemo(
    () => (posts || []).filter((p) => !hidden.has(p.rubric)).sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n),
    [posts, hidden],
  );

  if (!posts) return <Spinner />;

  const outdated = !!meta.updatedAt && (meta.seed ?? 1) < SEED_VERSION;
  const rubricList = [
    ...Object.keys(RUBRICS),
    ...[...new Set(posts.map((p) => p.rubric))].filter((r) => !(r in RUBRICS)),
  ].filter((r) => r in RUBRICS || posts.some((p) => p.rubric === r));
  const first = posts.length ? parse([...posts].sort((a, b) => a.date.localeCompare(b.date))[0].date) : new Date();
  const last = posts.length ? parse([...posts].sort((a, b) => b.date.localeCompare(a.date))[0].date) : new Date();

  // Разбивка по месяцам: календарь, направления и список показывают один месяц.
  const todayKey = iso(new Date()).slice(0, 7);
  const planMonths = [...new Set(posts.map((p) => monthKey(p.date)))].sort();
  const month = monthSel ?? (planMonths.includes(todayKey) ? todayKey : planMonths[0] ?? todayKey);
  const monthTabs = [...new Set([...planMonths, month])].sort();
  const monthPosts = posts.filter((p) => monthKey(p.date) === month);
  const monthVisible = visible.filter((p) => monthKey(p.date) === month);
  const [my, mm] = month.split("-").map(Number);
  const monthFirst = new Date(my, mm - 1, 1);
  const monthLast = new Date(my, mm, 0);
  const start = mondayOf(monthFirst);
  const weeks = Math.ceil(((monthLast.getTime() - start.getTime()) / 86400000 + 1) / 7);

  // Проверка правила «Reels на Тверь» по неделям сетки месяца (неделя
  // считается целиком, даже если заходит в соседний месяц).
  const weekCheck = Array.from({ length: weeks }, (_, w) => {
    const a = iso(addDays(start, w * 7));
    const b = iso(addDays(start, w * 7 + 6));
    const inWeek = posts.filter((p) => p.date >= a && p.date <= b);
    return { any: inWeek.length > 0, tver: inWeek.filter(isTverReels) };
  });
  const tverWeeks = weekCheck.filter((w) => w.any);
  const tverOk = tverWeeks.filter((w) => w.tver.length > 0).length;
  const lengths = {
    long: monthPosts.filter((p) => p.length === "long").length,
    short: monthPosts.filter((p) => p.length === "short").length,
  };
  const counts = Object.fromEntries(
    (Object.keys(STATUS) as ContentPost["status"][]).map((k) => [k, monthPosts.filter((p) => p.status === k).length]),
  );

  const openNew = (date?: string) =>
    setEditing({
      id: "",
      n: Math.max(0, ...posts.map((p) => p.n)) + 1,
      date: date ?? (month === todayKey ? iso(new Date()) : `${month}-01`),
      rubric: Object.keys(RUBRICS)[0],
      format: "карусель",
      goal: "",
      topic: "",
      hook: "",
      visual: "",
      note: "",
      length: "",
      size: "",
      local: false,
      status: "idea",
    });

  const card = (p: ContentPost, compact = false) => (
    <button
      key={p.id}
      type="button"
      onClick={() => setEditing(p)}
      className={`w-full rounded-[8px] px-2 py-1.5 text-left text-white transition-[filter,opacity] hover:brightness-110 ${
        p.status === "published" ? "opacity-55" : ""
      }`}
      style={{ background: colorOf(p.rubric) }}
      title={p.topic}
    >
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] font-extrabold uppercase tracking-wide">
        <span className="h-2 w-2 flex-none rounded-full ring-1 ring-white/70" style={{ background: STATUS[p.status].dot }} />
        №{p.n} · {p.format}
        {p.length ? (
          <span
            className={`rounded-[4px] px-1 py-px text-[9.5px] normal-case tracking-normal ${p.length === "long" ? "bg-white/90 text-black/80" : "ring-1 ring-white/60"}`}
            title={p.size || undefined}
          >
            {LENGTH[p.length]}
          </span>
        ) : null}
        {p.local ? (
          <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-black/25 px-1 py-px text-[9.5px] normal-case tracking-normal" title="ЦА Тверь">
            <MapPin className="h-2.5 w-2.5" /> Тверь
          </span>
        ) : null}
      </span>
      <span className={`mt-0.5 text-[12px] font-semibold leading-snug ${compact ? "line-clamp-4" : "line-clamp-3"}`}>
        {p.topic}
      </span>
    </button>
  );

  return (
    <>
      <PageHead
        title="Контент-план Instagram"
        subtitle={
          `${short(first)} – ${short(last)} · ${posts.length} публикаций` +
          (meta.updatedAt
            ? ` · изменено ${new Date(meta.updatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${meta.updatedBy ? `, ${meta.updatedBy}` : ""}`
            : " · стартовый план, ещё не правился")
        }
        action={
          view === "brief" ? undefined : (
            <Button variant="primary" onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Публикация
            </Button>
          )
        }
      />

      {outdated ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-crm-line bg-crm-surface px-4 py-3">
          <div className="min-w-0 flex-1 text-[13.5px] text-crm-ink-2">
            <b className="text-crm-ink">Вышла новая версия плана.</b> В ней длинный и короткий контент, «Разборы», «Расчёт онлайн» и
            Reels на ЦА Тверь каждую неделю. Сейчас в CRM сохранён старый план с вашими правками.
          </div>
          <Button
            variant="primary"
            disabled={saving}
            onClick={async () => {
              if (!confirm("Заменить текущий план новым? Правки и статусы в текущем плане пропадут.")) return;
              if (await persist(SEED_POSTS, SEED_VERSION)) toast("План обновлён");
            }}
          >
            <RefreshCw className="h-4 w-4" /> Загрузить новый план
          </Button>
        </div>
      ) : null}

      {/* Месяцы: план показываем помесячно, стрелками можно уйти и в пустой
          месяц — чтобы планировать вперёд. */}
      {view !== "brief" ? (
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-crm-line bg-crm-surface text-crm-ink-2 hover:text-crm-ink"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {monthTabs.map((k) => {
            const n = posts.filter((p) => monthKey(p.date) === k).length;
            const on = k === month;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setMonth(k)}
                className={`inline-flex h-9 flex-none items-center gap-2 whitespace-nowrap rounded-[10px] border px-3.5 text-[14px] font-bold transition-colors ${
                  on ? "border-crm-accent bg-crm-accent text-white" : "border-crm-line bg-crm-surface text-crm-ink-2 hover:text-crm-ink"
                }`}
              >
                {monthTitle(k)}
                <span className={`rounded-full px-1.5 text-[12px] ${on ? "bg-white/20" : "bg-crm-soft text-crm-ink-3"}`}>{n}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-crm-line bg-crm-surface text-crm-ink-2 hover:text-crm-ink"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Статусы месяца и вид */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {view !== "brief" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-crm-line bg-crm-surface px-2.5 py-1 text-[12.5px] text-crm-ink-2">
            Длинных: <b className="text-crm-ink">{lengths.long}</b> · коротких: <b className="text-crm-ink">{lengths.short}</b>
          </span>
        ) : null}
        {view !== "brief" && tverWeeks.length ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] ${
              tverOk < tverWeeks.length ? "border-amber-500/60 bg-amber-500/10 text-amber-300" : "border-crm-line bg-crm-surface text-crm-ink-2"
            }`}
            title="Правило: минимум 1 Reels в неделю на ЦА Тверь"
          >
            <MapPin className="h-3.5 w-3.5" /> Reels на Тверь:{" "}
            <b className={tverOk < tverWeeks.length ? "" : "text-crm-ink"}>
              {tverOk} из {tverWeeks.length} нед.
            </b>
          </span>
        ) : null}
        {(view === "brief" ? [] : (Object.keys(STATUS) as ContentPost["status"][])).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-crm-line bg-crm-surface px-2.5 py-1 text-[12.5px] text-crm-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS[k].dot }} />
            {STATUS[k].label}: <b className="text-crm-ink">{counts[k]}</b>
          </span>
        ))}
        <div className="ml-auto inline-flex max-w-full overflow-x-auto rounded-[10px] border border-crm-line bg-crm-surface p-0.5">
          {([["calendar", "Календарь", CalendarDays], ["rubrics", "По направлениям", Columns3], ["list", "Список", List], ["brief", "Бриф", ClipboardList]] as const).map(
            ([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[13px] font-semibold ${
                  view === v ? "bg-crm-soft text-crm-ink" : "text-crm-ink-2 hover:text-crm-ink"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Направления — легенда и фильтр */}
      <div className={`mb-4 flex-wrap gap-1.5 ${view === "brief" ? "hidden" : "flex"}`}>
        {rubricList.map((name) => {
          const col = colorOf(name);
          const off = hidden.has(name);
          const n = monthPosts.filter((p) => p.rubric === name).length;
          return (
            <button
              key={name}
              type="button"
              onClick={() =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(name)) next.delete(name);
                  else next.add(name);
                  return next;
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold transition-opacity ${
                off ? "border-crm-line opacity-45" : "border-crm-line bg-crm-surface"
              }`}
              title={off ? "Показать" : "Скрыть"}
            >
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: col }} />
              <span className="text-crm-ink">{name}</span>
              <span className="text-crm-ink-3">{n}</span>
            </button>
          );
        })}
      </div>

      {view === "calendar" ? (
        <Card className="overflow-x-auto p-0">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-7 border-b border-crm-line bg-crm-soft">
              {DOW.map((d) => (
                <div key={d} className="px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-crm-ink-2">
                  {d}
                </div>
              ))}
            </div>
            {Array.from({ length: weeks }, (_, w) => (
              <div key={w} className="border-b border-crm-line last:border-0">
                {weekCheck[w].any ? (
                  weekCheck[w].tver.length ? (
                    <div className="flex items-center gap-1.5 border-b border-crm-line px-3 py-1 text-[11.5px] text-crm-ink-3">
                      <MapPin className="h-3 w-3" /> Reels на Тверь: {weekCheck[w].tver.map((p) => `№${p.n}`).join(", ")}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11.5px] font-semibold text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> На этой неделе нет Reels на ЦА Тверь — нужен минимум один
                    </div>
                  )
                ) : null}
              <div className="grid grid-cols-7">
                {Array.from({ length: 7 }, (_, i) => {
                  const day = addDays(start, w * 7 + i);
                  const key = iso(day);
                  // Дни соседних месяцев — серые и без публикаций: они в своём месяце.
                  const inRange = day.getMonth() === mm - 1;
                  const items = inRange ? monthVisible.filter((p) => p.date === key) : [];
                  const today = key === iso(new Date());
                  return (
                    <div
                      key={key}
                      className={`group flex min-h-[132px] flex-col gap-1.5 border-r border-crm-line p-2 last:border-r-0 ${inRange ? "" : "bg-crm-soft/60"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[12.5px] font-bold ${
                            today ? "rounded-[6px] bg-crm-accent px-1.5 text-white" : inRange ? "text-crm-ink" : "text-crm-ink-3"
                          }`}
                        >
                          {inRange ? short(day) : day.getDate()}
                        </span>
                        {inRange ? (
                          <button
                            type="button"
                            onClick={() => openNew(key)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] text-crm-ink-3 opacity-0 transition-opacity hover:bg-crm-soft hover:text-crm-ink focus:opacity-100 group-hover:opacity-100"
                            title="Публикация на этот день"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      {items.map((p) => card(p, true))}
                      {inRange ? <div className="mt-auto text-[11px] text-crm-ink-3">Сторис: {STORIES[i]}</div> : null}
                    </div>
                  );
                })}
              </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {view === "rubrics" ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-crm-line bg-crm-soft text-[12px] font-bold uppercase tracking-wide text-crm-ink-2">
                <th className="w-[200px] px-3 py-2">Направление</th>
                {Array.from({ length: weeks }, (_, w) => {
                  const a = addDays(start, w * 7);
                  const from = a < monthFirst ? monthFirst : a;
                  const to = addDays(a, 6) > monthLast ? monthLast : addDays(a, 6);
                  return (
                    <th key={w} className="px-3 py-2">
                      Нед. {w + 1} · {from.getDate()}–{short(to)}
                      {weekCheck[w].any ? (
                        <span
                          className={`mt-0.5 flex items-center gap-1 text-[10.5px] normal-case tracking-normal ${
                            weekCheck[w].tver.length ? "text-crm-ink-3" : "text-amber-300"
                          }`}
                        >
                          {weekCheck[w].tver.length ? <MapPin className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {weekCheck[w].tver.length ? `Тверь: ${weekCheck[w].tver.map((p) => `№${p.n}`).join(", ")}` : "нет Reels на Тверь"}
                        </span>
                      ) : null}
                    </th>
                  );
                })}
                <th className="w-[72px] px-3 py-2 text-right">Всего</th>
              </tr>
            </thead>
            <tbody>
              {rubricList
                .filter((r) => !hidden.has(r))
                .map((r) => {
                  const items = monthVisible.filter((p) => p.rubric === r);
                  return (
                    <tr key={r} className="border-b border-crm-line align-top last:border-0">
                      <td className="px-3 py-2.5" style={{ boxShadow: `inset 4px 0 0 ${colorOf(r)}` }}>
                        <div className="pl-1.5 text-[13.5px] font-bold text-crm-ink">{r}</div>
                      </td>
                      {Array.from({ length: weeks }, (_, w) => {
                        const a = addDays(start, w * 7);
                        const b = addDays(a, 6);
                        const cell = items.filter((p) => parse(p.date) >= a && parse(p.date) <= b);
                        return (
                          <td key={w} className="space-y-1.5 px-2 py-2">
                            {cell.map((p) => (
                              <div key={p.id}>
                                <div className="mb-0.5 text-[11px] font-bold" style={{ color: colorOf(p.rubric) }}>
                                  {short(parse(p.date))} · {p.format}
                                </div>
                                {card(p, true)}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right text-[18px] font-extrabold text-crm-ink">{items.length}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Card>
      ) : null}

      {view === "list" ? (
        <Card className="divide-y divide-crm-line p-0">
          {monthVisible.length === 0 ? (
            <div className="px-4 py-8 text-center text-[14px] text-crm-ink-3">В этом месяце публикаций пока нет</div>
          ) : null}
          {monthVisible.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p)}
              className="grid w-full grid-cols-[90px_minmax(0,1fr)_130px] items-start gap-3 px-4 py-3 text-left hover:bg-crm-raise"
            >
              <span className="text-[13px] font-bold text-crm-ink">
                {short(parse(p.date))}
                <span className="block text-[11.5px] font-medium text-crm-ink-3">{DOW[(parse(p.date).getDay() + 6) % 7]}</span>
              </span>
              <span className="min-w-0">
                <span className="mb-1 inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: colorOf(p.rubric) }}>
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: colorOf(p.rubric) }} />
                  №{p.n} · {p.rubric} · {p.format}
                  {p.length ? ` · ${LENGTH[p.length]}${p.size ? `, ${p.size}` : ""}` : ""}
                  {p.local ? " · ЦА Тверь" : ""}
                </span>
                <span className="block text-[14px] font-semibold text-crm-ink">{p.topic}</span>
                {p.hook ? <span className="mt-0.5 block text-[12.5px] text-crm-ink-2">Зацепка: {p.hook}</span> : null}
              </span>
              <span className="inline-flex items-center justify-end gap-1.5 text-[12.5px] text-crm-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS[p.status].dot }} />
                {STATUS[p.status].label}
              </span>
            </button>
          ))}
        </Card>
      ) : null}

      {view === "brief" ? <ContentBrief /> : null}

      <PostEditor
        post={editing}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (p) => {
          const next = p.id
            ? posts.map((x) => (x.id === p.id ? p : x))
            : [...posts, { ...p, id: `p${Date.now().toString(36)}` }];
          if (await persist(next)) {
            setEditing(null);
            toast("Сохранено");
          }
        }}
        onDelete={async (p) => {
          if (!confirm(`Удалить публикацию №${p.n}?`)) return;
          if (await persist(posts.filter((x) => x.id !== p.id))) {
            setEditing(null);
            toast("Публикация удалена");
          }
        }}
      />
    </>
  );
}

function PostEditor({
  post,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  post: ContentPost | null;
  saving: boolean;
  onClose: () => void;
  onSave: (p: ContentPost) => void;
  onDelete: (p: ContentPost) => void;
}) {
  const [f, setF] = useState<ContentPost | null>(post);
  useEffect(() => setF(post), [post]);
  if (!f) return null;
  const set = <K extends keyof ContentPost>(k: K, v: ContentPost[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(f);
  };
  return (
    <Modal open={!!post} onClose={onClose} title={f.id ? `Публикация №${f.n}` : "Новая публикация"} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Дата">
            <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label="Статус">
            <Select value={f.status} onChange={(e) => set("status", e.target.value as ContentPost["status"])}>
              {(Object.keys(STATUS) as ContentPost["status"][]).map((k) => (
                <option key={k} value={k}>
                  {STATUS[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Направление">
            <Select value={f.rubric} onChange={(e) => set("rubric", e.target.value)}>
              {[...new Set([...Object.keys(RUBRICS), f.rubric])].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Формат">
            <Select value={f.format} onChange={(e) => set("format", e.target.value)}>
              {[...new Set([...FORMATS, f.format])].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <Field label="Объём">
            <Select value={f.length || ""} onChange={(e) => set("length", e.target.value as ContentPost["length"])}>
              <option value="">не указан</option>
              <option value="short">Короткий</option>
              <option value="long">Длинный</option>
            </Select>
          </Field>
          <Field label="Хронометраж или объём">
            <Input value={f.size || ""} onChange={(e) => set("size", e.target.value)} placeholder="60–90 с, 12 слайдов, эфир 30 мин…" />
          </Field>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-crm-line bg-crm-soft/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={!!f.local}
            onChange={(e) => set("local", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--crm-accent)]"
          />
          <span className="text-[13.5px] text-crm-ink">
            <b>ЦА Тверь</b>
            <span className="block text-[12.5px] text-crm-ink-2">
              Ролик на тверичей: «Тверь» в первом кадре и первой фразе, город в кадре, геометка. Нужен минимум один такой Reels в неделю.
            </span>
          </span>
        </label>
        <Field label="Тема">
          <Textarea rows={2} value={f.topic} onChange={(e) => set("topic", e.target.value)} required />
        </Field>
        <Field label="Зацепка — первая фраза или первые 2 секунды">
          <Textarea rows={2} value={f.hook} onChange={(e) => set("hook", e.target.value)} />
        </Field>
        <Field label="Визуал — что показать">
          <Textarea rows={3} value={f.visual} onChange={(e) => set("visual", e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Цель">
            <Input value={f.goal} onChange={(e) => set("goal", e.target.value)} placeholder="заявки, доверие, охват…" />
          </Field>
          <Field label="Примечание">
            <Input value={f.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          {f.id ? (
            <button
              type="button"
              onClick={() => onDelete(f)}
              className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-crm-danger"
            >
              <Trash2 className="h-4 w-4" /> Удалить
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
