/**
 * Канбан-доска сделок.
 *
 * Перетаскивание мышью — основной способ двигать сделку по воронке, но на
 * телефоне оно неудобно и ненадёжно, поэтому в каждой карточке есть ещё и
 * выпадающий список этапов. Это не запасной вариант «на всякий случай»:
 * половина работы менеджера идёт с телефона.
 *
 * Смена этапа применяется в интерфейсе сразу, не дожидаясь ответа сервера —
 * иначе карточка «прыгает» назад и обратно. Если сервер откажет, состояние
 * возвращается и показывается ошибка.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Plus, Search, SlidersHorizontal } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { BOARD_STAGES, CLOSED_STAGES, STAGE_COLORS, STAGE_LABELS, STAGE_SHORT, isStage, type Stage } from "../lib/stages";
import { moneyShort } from "../lib/money";
import { formatDayShort, plural } from "../lib/format";
import type { Deal, User } from "../lib/types";
import { Badge, Button, Empty, Input, Select, Spinner, useToast } from "../ui";
import { PageHead } from "./Layout";

export function Board() {
  const navigate = useNavigate();
  const toast = useToast();

  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [manager, setManager] = useState("all");
  const [showClosed, setShowClosed] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.deals(), api.users()])
      .then(([d, u]) => {
        if (!alive) return;
        setDeals(d.deals);
        setUsers(u.users);
      })
      .catch((e) => {
        if (alive) toast(e instanceof ApiError ? e.message : "Не удалось загрузить сделки", "error");
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  const filtered = useMemo(() => {
    if (!deals) return [];
    const query = search.trim().toLowerCase();

    return deals.filter((deal) => {
      if (manager !== "all" && deal.managerId !== manager) return false;
      if (!query) return true;

      // Ищем по всему, что менеджер может помнить о сделке.
      const haystack = [
        deal.clientName,
        deal.clientPhone,
        deal.clientTelegram,
        deal.vin,
        deal.carBrand,
        deal.carModel,
        String(deal.number),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deals, search, manager]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, Deal[]>();
    for (const stage of [...BOARD_STAGES, ...CLOSED_STAGES]) map.set(stage, []);
    for (const deal of filtered) map.get(deal.stage)?.push(deal);
    return map;
  }, [filtered]);

  const move = useCallback(
    async (dealId: string, stage: Stage) => {
      const current = deals?.find((d) => d.id === dealId);
      if (!current || current.stage === stage) return;

      const previous = current.stage;
      // Оптимистично: карточка встаёт в новую колонку мгновенно.
      setDeals((list) =>
        list ? list.map((d) => (d.id === dealId ? { ...d, stage } : d)) : list,
      );

      try {
        const result = await api.setStage(dealId, stage);
        setDeals((list) => (list ? list.map((d) => (d.id === dealId ? { ...d, ...result.deal } : d)) : list));
      } catch (e) {
        setDeals((list) =>
          list ? list.map((d) => (d.id === dealId ? { ...d, stage: previous } : d)) : list,
        );
        toast(e instanceof ApiError ? e.message : "Не удалось сменить этап", "error");
      }
    },
    [deals, toast],
  );

  if (!deals) return <Spinner />;

  const columns: Stage[] = showClosed ? [...BOARD_STAGES, ...CLOSED_STAGES] : BOARD_STAGES;
  const closedCount = (byStage.get("DONE")?.length ?? 0) + (byStage.get("LOST")?.length ?? 0);

  return (
    <>
      <PageHead
        title="Сделки"
        subtitle={`${filtered.length} ${plural(filtered.length, ["сделка", "сделки", "сделок"])} на доске`}
        action={
          <Button variant="primary" onClick={() => navigate("/crm/deals/new")}>
            <Plus className="h-4 w-4" />
            Новая сделка
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3ae]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Клиент, телефон, VIN, марка, номер"
            className="pl-9"
          />
        </label>

        {/* Восклицательный знак обязателен: базовый w-full у поля идёт в CSS
            после w-auto и без !important перебил бы ширину. */}
        <Select value={manager} onChange={(e) => setManager(e.target.value)} className="!w-auto min-w-[170px]">
          <option value="all">Все менеджеры</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>

        <Button
          variant={showClosed ? "primary" : "ghost"}
          onClick={() => setShowClosed((v) => !v)}
          title="Показать завершённые и отказы"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Закрытые
          {closedCount ? <span className="tnum opacity-70">{closedCount}</span> : null}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty
          title="Сделок не найдено"
          hint={search ? "Попробуйте изменить запрос или сбросить фильтр по менеджеру." : "Создайте первую сделку — она появится в колонке «Новая заявка»."}
          action={
            <Button variant="primary" onClick={() => navigate("/crm/deals/new")}>
              <Plus className="h-4 w-4" />
              Новая сделка
            </Button>
          }
        />
      ) : (
        // Доска прокручивается по горизонтали внутри себя: страница при этом
        // остаётся на месте, иначе на телефоне уезжала бы вся вёрстка.
        <div className="-mx-4 overflow-x-auto px-4 pb-3">
          <div className="flex min-w-max gap-3">
            {columns.map((stage) => {
              const items = byStage.get(stage) ?? [];
              const sum = items.reduce((acc, d) => acc + d.totals.totalRub, 0);

              return (
                <section
                  key={stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(stage);
                  }}
                  onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverStage(null);
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) void move(id, stage);
                  }}
                  className={`flex w-[268px] flex-none flex-col rounded-xl border transition-colors ${
                    overStage === stage
                      ? "border-[#1f2937] bg-[#eef1f5]"
                      : "border-[#e3e8ee] bg-[#fafbfc]"
                  }`}
                >
                  <header className="flex items-center gap-2 px-3 py-2.5">
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ backgroundColor: STAGE_COLORS[stage] }}
                    />
                    <h2 className="text-[13px] font-bold text-[#111827]">{STAGE_SHORT[stage]}</h2>
                    <span className="tnum ml-auto text-[12px] font-bold text-[#8a93a0]">
                      {items.length}
                    </span>
                  </header>

                  {sum > 0 ? (
                    <p className="tnum -mt-1 px-3 pb-2 text-[11.5px] font-semibold text-[#8a93a0]">
                      {moneyShort(sum)}
                    </p>
                  ) : null}

                  <div className="flex min-h-[60px] flex-col gap-2 px-2 pb-2">
                    {items.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        dragging={dragging === deal.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", deal.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragging(deal.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                        onStage={(next) => void move(deal.id, next)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function DealCard({
  deal,
  dragging,
  onDragStart,
  onDragEnd,
  onStage,
}: {
  deal: Deal;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onStage: (stage: Stage) => void;
}) {
  // Ссылка и перетаскивание конфликтуют: после перетаскивания браузер
  // засчитывает клик и открывает карточку. Запоминаем, было ли движение.
  const moved = useRef(false);

  const car = [deal.carBrand, deal.carModel].filter(Boolean).join(" ");

  return (
    <article
      draggable
      onDragStart={(e) => {
        moved.current = true;
        onDragStart(e);
      }}
      onDragEnd={() => {
        onDragEnd();
        window.setTimeout(() => {
          moved.current = false;
        }, 0);
      }}
      className={`rounded-lg border border-[#e3e8ee] bg-white p-2.5 transition-shadow ${
        dragging ? "opacity-40" : "hover:shadow-[0_6px_18px_-8px_rgba(13,17,22,0.3)]"
      }`}
    >
      <Link
        to={`/crm/deals/${deal.id}`}
        onClick={(e) => {
          if (moved.current) e.preventDefault();
        }}
        className="block"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13.5px] font-bold leading-snug text-[#111827]">
            {deal.clientName}
          </span>
          <span className="tnum flex-none text-[11.5px] font-bold text-[#aab2bd]">
            №{deal.number}
          </span>
        </div>

        {car ? <p className="mt-0.5 text-[12.5px] text-[#6b7480]">{car}</p> : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {deal.totals.totalRub > 0 ? (
            <span className="tnum text-[12.5px] font-bold text-[#111827]">
              {moneyShort(deal.totals.totalRub)}
            </span>
          ) : null}
          {deal.etaDate ? (
            <span className="tnum text-[11.5px] text-[#8a93a0]">{formatDayShort(deal.etaDate)}</span>
          ) : null}
          {deal.dueTasks ? (
            <Badge color="#ef4444" className="!px-2 !py-0.5">
              <AlertCircle className="h-3 w-3" />
              {deal.dueTasks}
            </Badge>
          ) : null}
        </div>
      </Link>

      {/* Список этапов — для телефона, где перетаскивание не работает. */}
      <select
        value={deal.stage}
        onChange={(e) => {
          if (isStage(e.target.value)) onStage(e.target.value);
        }}
        aria-label={`Этап сделки №${deal.number}`}
        className="mt-2 w-full rounded-md border border-[#e8ecf1] bg-[#fafbfc] px-2 py-1.5 text-[12px] font-semibold text-[#4b5563] outline-none focus:border-[#1f2937]"
      >
        {[...BOARD_STAGES, ...CLOSED_STAGES].map((stage) => (
          <option key={stage} value={stage}>
            {STAGE_LABELS[stage]}
          </option>
        ))}
      </select>
    </article>
  );
}
