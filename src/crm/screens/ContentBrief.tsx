/**
 * Бриф перед запуском Instagram — вкладка раздела «Контент».
 *
 * Вопросы — из src/crm/data/content-brief.json (тот же файл собирает
 * context/content-brief.md и PDF). Ответ сохраняется сам, когда поле теряет
 * фокус: каждый вопрос пишется отдельно, поэтому двое могут отвечать
 * одновременно. «Скопировать ответы» собирает всё в текст — его удобно
 * переслать маркетологу.
 */

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import brief from "../data/content-brief.json";
import { api, ApiError } from "../lib/api";
import { Button, Card, Spinner, Textarea, useToast } from "../ui";

type Q = { id: string; q: string; hint?: string };
const SECTIONS = brief.sections as { title: string; questions: Q[] }[];
const TOTAL = SECTIONS.reduce((s, x) => s + x.questions.length, 0);

export function ContentBrief() {
  const toast = useToast();
  const [saved, setSaved] = useState<Record<string, string> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<{ updatedAt?: string | null; updatedBy?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  useEffect(() => {
    api
      .contentBrief()
      .then((r) => {
        setSaved(r.brief.answers || {});
        setDraft(r.brief.answers || {});
        setMeta({ updatedAt: r.brief.updatedAt, updatedBy: r.brief.updatedBy });
      })
      .catch((e: unknown) => {
        toast(e instanceof ApiError ? e.message : "Не удалось загрузить бриф", "error");
        setSaved({});
      });
    // Один раз при открытии вкладки.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!saved) return <Spinner />;

  async function save(id: string) {
    const text = (draft[id] || "").trim();
    if (text === (saved?.[id] || "")) return;
    setBusy(id);
    try {
      const r = await api.saveBriefAnswer(id, text);
      // С сервера приходят и чужие свежие ответы — подхватываем их, не трогая
      // поля, которые сейчас редактируются у нас.
      setSaved(r.brief.answers || {});
      setDraft((d) => {
        const next = { ...(r.brief.answers || {}) };
        for (const [k, v] of Object.entries(d)) if (k !== id && v !== (saved?.[k] || "")) next[k] = v;
        return next;
      });
      setMeta({ updatedAt: r.brief.updatedAt, updatedBy: r.brief.updatedBy });
      setJustSaved(id);
      window.setTimeout(() => setJustSaved((x) => (x === id ? null : x)), 1800);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Ответ не сохранился", "error");
    } finally {
      setBusy(null);
    }
  }

  const answered = SECTIONS.flatMap((s) => s.questions).filter((q) => (saved[q.id] || "").trim()).length;

  function copyAll() {
    let n = 0;
    const lines = [`${brief.title} — ДиАвто69`, ""];
    for (const s of SECTIONS) {
      lines.push(`## ${s.title}`, "");
      for (const q of s.questions) {
        n += 1;
        lines.push(`${n}. ${q.q}`, `Ответ: ${(draft[q.id] || "").trim() || "—"}`, "");
      }
    }
    navigator.clipboard
      ?.writeText(lines.join("\n"))
      .then(() => toast("Ответы скопированы"))
      .catch(() => toast("Не удалось скопировать", "error"));
  }

  let n = 0;
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-[240px] flex-1">
          <div className="text-[16px] font-extrabold text-crm-ink">{brief.title}</div>
          <p className="mt-1 text-[13.5px] text-crm-ink-2">{brief.intro}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 w-full max-w-[320px] overflow-hidden rounded-full bg-crm-soft">
              <div className="h-full rounded-full bg-crm-accent transition-[width]" style={{ width: `${(answered / TOTAL) * 100}%` }} />
            </div>
            <span className="text-[13px] font-semibold text-crm-ink-2">
              Отвечено {answered} из {TOTAL}
            </span>
          </div>
          {meta.updatedAt ? (
            <div className="mt-1 text-[12px] text-crm-ink-3">
              Последний ответ:{" "}
              {new Date(meta.updatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              {meta.updatedBy ? `, ${meta.updatedBy}` : ""}
            </div>
          ) : null}
        </div>
        <Button onClick={copyAll}>
          <Copy className="h-4 w-4" /> Скопировать ответы
        </Button>
      </Card>

      {SECTIONS.map((s) => (
        <Card key={s.title} className="p-0">
          <div className="border-b border-crm-line px-4 py-3 text-[13px] font-extrabold uppercase tracking-wide text-crm-ink-2">
            {s.title}
          </div>
          <div className="divide-y divide-crm-line">
            {s.questions.map((q) => {
              n += 1;
              const done = !!(saved[q.id] || "").trim();
              return (
                <div key={q.id} className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-5">
                  <div className="flex gap-2.5">
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-extrabold ${
                        done ? "bg-crm-accent text-white" : "bg-crm-soft text-crm-ink-2"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : n}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold leading-snug text-crm-ink">{q.q}</div>
                      {q.hint ? <div className="mt-1 text-[12.5px] text-crm-ink-3">{q.hint}</div> : null}
                    </div>
                  </div>
                  <div className="relative">
                    <Textarea
                      rows={3}
                      value={draft[q.id] || ""}
                      placeholder="Ответ…"
                      onChange={(e) => setDraft((d) => ({ ...d, [q.id]: e.target.value }))}
                      onBlur={() => void save(q.id)}
                    />
                    <span className="pointer-events-none absolute bottom-2 right-3 text-[11.5px] text-crm-ink-3">
                      {busy === q.id ? "Сохраняем…" : justSaved === q.id ? "Сохранено" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
