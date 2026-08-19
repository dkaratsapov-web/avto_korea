/**
 * Список задач.
 *
 * По умолчанию — только свои и невыполненные: страница отвечает на вопрос
 * «что делать сегодня», а не служит архивом. Порядок задаёт сервер: сначала
 * просроченные, потом сегодняшние, задачи без срока — в конце.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { plural } from "../lib/format";
import type { Task } from "../lib/types";
import { Button, Card, Empty, Spinner, useToast } from "../ui";
import { PageHead } from "./Layout";
import { UrgencyBadge } from "./DealPage";

export function Tasks() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [withDone, setWithDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const { tasks: list } = await api.tasks(scope, withDone);
      setTasks(list);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось загрузить задачи", "error");
      setTasks([]);
    }
  }, [scope, withDone, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (task: Task) => {
    // Отметку ставим сразу: ждать ответа сервера, чтобы галочка появилась,
    // при списке из двадцати задач невыносимо.
    setTasks((list) =>
      list ? list.map((t) => (t.id === task.id ? { ...t, isDone: !t.isDone } : t)) : list,
    );

    try {
      await api.updateTask(task.id, { isDone: !task.isDone });
      // Перезагружаем: невыполненный фильтр должен убрать закрытую задачу.
      if (!withDone) await load();
    } catch (e) {
      setTasks((list) =>
        list ? list.map((t) => (t.id === task.id ? { ...t, isDone: task.isDone } : t)) : list,
      );
      toast(e instanceof ApiError ? e.message : "Не удалось изменить задачу", "error");
    }
  };

  if (!tasks) return <Spinner />;

  const overdue = tasks.filter((t) => t.urgency === "overdue" && !t.isDone).length;

  return (
    <>
      <PageHead
        title="Задачи"
        subtitle={
          overdue
            ? `${overdue} ${plural(overdue, ["просроченная", "просроченные", "просроченных"])} — начните с них`
            : `${tasks.length} ${plural(tasks.length, ["задача", "задачи", "задач"])}`
        }
        action={
          <div className="flex gap-2">
            <Button variant={scope === "mine" ? "primary" : "ghost"} onClick={() => setScope("mine")}>
              Мои
            </Button>
            <Button variant={scope === "all" ? "primary" : "ghost"} onClick={() => setScope("all")}>
              Все
            </Button>
            <Button variant={withDone ? "primary" : "ghost"} onClick={() => setWithDone((v) => !v)}>
              С выполненными
            </Button>
          </div>
        }
      />

      <Card>
        {tasks.length === 0 ? (
          <Empty
            title="Задач нет"
            hint="Задачи ставятся в карточке сделки — так они всегда привязаны к конкретной машине."
          />
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
                    className={`text-[14px] leading-snug ${
                      task.isDone ? "text-[#9aa3ae] line-through" : "text-[#111827]"
                    }`}
                  >
                    {task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#8a93a0]">
                    {task.dueDate ? <UrgencyBadge task={task} /> : <span>без срока</span>}
                    {task.assigneeName ? <span>· {task.assigneeName}</span> : null}
                    {task.dealNumber ? (
                      <Link
                        to={`/crm/deals/${task.dealId}`}
                        className="font-semibold text-[#1f6feb] hover:underline"
                      >
                        · №{task.dealNumber} {task.dealClient ?? ""}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
