/**
 * Сводка по сделкам.
 *
 * Отвечает на три вопроса владельца: сколько заработали, сколько ещё должны
 * доплатить и где сделки застревают. Всё остальное — детали, за ними в доску.
 */

import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { money, moneyShort } from "../lib/money";
import { BOARD_STAGES, STAGE_COLORS, STAGE_SHORT } from "../lib/stages";
import { plural } from "../lib/format";
import type { Dashboard as DashboardData } from "../lib/types";
import { Button, Card, Spinner, useToast } from "../ui";
import { PageHead } from "./Layout";

const PERIODS: { key: string; label: string }[] = [
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
  { key: "all", label: "Всё время" },
];

export function Dashboard() {
  const toast = useToast();
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .dashboard(period)
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((e) => {
        if (alive) toast(e instanceof ApiError ? e.message : "Не удалось загрузить сводку", "error");
      });
    return () => {
      alive = false;
    };
  }, [period, toast]);

  if (!data) return <Spinner />;

  const { stats } = data;
  const maxStage = Math.max(1, ...BOARD_STAGES.map((stage) => data.byStage[stage] ?? 0));

  return (
    <>
      <PageHead
        title="Аналитика"
        subtitle="Показатели считаются по дате создания сделки"
        action={
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((item) => (
              <Button
                key={item.key}
                variant={period === item.key ? "primary" : "ghost"}
                onClick={() => setPeriod(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Выручка" value={money(stats.revenue)} hint="по завершённым сделкам" />
        <Metric label="Прибыль" value={money(stats.profit)} hint="наша комиссия" accent />
        <Metric label="Ждём доплат" value={money(stats.expected)} hint="по сделкам в работе" />
        <Metric label="Средний чек" value={money(stats.averageCheck)} hint="завершённая сделка" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Сделок" value={String(stats.deals)} hint="создано за период" />
        <Metric
          label="Завершено"
          value={String(stats.won)}
          hint={`${stats.lost} ${plural(stats.lost, ["отказ", "отказа", "отказов"])}`}
        />
        <Metric
          label="Конверсия"
          value={`${stats.conversion}%`}
          hint="доля успешных среди закрытых"
        />
        <Metric
          label="Средний срок"
          value={stats.averageDays ? `${stats.averageDays} дн.` : "—"}
          hint="от заявки до выдачи"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Где сейчас сделки">
          <div className="space-y-2.5 p-4">
            {BOARD_STAGES.map((stage) => {
              const count = data.byStage[stage] ?? 0;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-[110px] flex-none text-[13px] text-crm-ink-2">
                    {STAGE_SHORT[stage]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-crm-soft">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(count / maxStage) * 100}%`,
                        backgroundColor: STAGE_COLORS[stage],
                      }}
                    />
                  </div>
                  <span className="tnum w-6 flex-none text-right text-[13px] font-bold text-crm-ink">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="По менеджерам">
          {data.byManager.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13.5px] text-crm-ink-3">
              За этот период сделок нет
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-crm-soft text-left text-[12px] uppercase tracking-[0.04em] text-crm-ink-3">
                    <th className="px-4 py-2.5 font-semibold">Менеджер</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Сделок</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Успешных</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byManager.map((row) => (
                    <tr key={row.managerId} className="border-b border-crm-bg last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-crm-ink">
                        {row.managerName ?? "—"}
                      </td>
                      <td className="tnum px-2 py-2.5 text-right text-crm-ink-2">{row.deals}</td>
                      <td className="tnum px-2 py-2.5 text-right text-crm-ink-2">{row.won}</td>
                      <td className="tnum px-4 py-2.5 text-right font-bold text-crm-ink">
                        {moneyShort(row.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-crm-line bg-crm-surface p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-crm-ink-3">{label}</p>
      <p
        className={`tnum mt-1.5 text-[22px] font-bold leading-none ${
          accent ? "text-crm-ok" : "text-crm-ink"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[12px] text-crm-ink-3">{hint}</p> : null}
    </div>
  );
}
