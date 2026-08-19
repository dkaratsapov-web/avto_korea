/**
 * Форма сделки: создание и правка.
 *
 * Суммы пересчитываются на каждый ввод — менеджер видит итог и остаток
 * до сохранения, а не после. Формула та же, что на сервере, поэтому
 * сохранённые цифры совпадут с показанными.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calculator, RefreshCw } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { calcTotals, money, parseMoney } from "../lib/money";
import { STAGE_LABELS, STAGES, type Stage } from "../lib/stages";
import type { Deal, User } from "../lib/types";
import { Button, Card, Field, Input, Select, Spinner, Textarea, useToast } from "../ui";
import { PageHead } from "./Layout";
import { CustomsCalculator } from "./CustomsCalculator";

/** Валюты закупки, с которыми реально работают. */
const CURRENCIES = ["USD", "EUR", "CNY", "KRW", "JPY", "RUB"];

const COUNTRIES = ["Корея", "Китай", "Япония", "ЕС", "ОАЭ", "Другое"];

type FormState = {
  clientName: string;
  clientPhone: string;
  clientTelegram: string;
  source: string;
  managerId: string;
  stage: Stage;

  carBrand: string;
  carModel: string;
  carYear: string;
  carMileage: string;
  vin: string;
  country: string;
  lotUrl: string;

  currency: string;
  carPrice: string;
  exchangeRate: string;
  deliveryCost: string;
  customsDuty: string;
  utilFee: string;
  brokerCost: string;
  otherCost: string;
  commission: string;
  paidAmount: string;

  purchaseDate: string;
  etaDate: string;
  notes: string;
};

const EMPTY: FormState = {
  clientName: "",
  clientPhone: "",
  clientTelegram: "",
  source: "",
  managerId: "",
  stage: "NEW",
  carBrand: "",
  carModel: "",
  carYear: "",
  carMileage: "",
  vin: "",
  country: "",
  lotUrl: "",
  currency: "USD",
  carPrice: "",
  exchangeRate: "",
  deliveryCost: "",
  customsDuty: "",
  utilFee: "",
  brokerCost: "",
  otherCost: "",
  commission: "",
  paidAmount: "",
  purchaseDate: "",
  etaDate: "",
  notes: "",
};

function fromDeal(deal: Deal): FormState {
  const text = (value: number) => (value ? String(value) : "");

  return {
    clientName: deal.clientName,
    clientPhone: deal.clientPhone ?? "",
    clientTelegram: deal.clientTelegram ?? "",
    source: deal.source ?? "",
    managerId: deal.managerId,
    stage: deal.stage,
    carBrand: deal.carBrand ?? "",
    carModel: deal.carModel ?? "",
    carYear: deal.carYear ? String(deal.carYear) : "",
    carMileage: deal.carMileage ? String(deal.carMileage) : "",
    vin: deal.vin ?? "",
    country: deal.country ?? "",
    lotUrl: deal.lotUrl ?? "",
    currency: deal.currency,
    carPrice: text(deal.carPrice),
    exchangeRate: text(deal.exchangeRate),
    deliveryCost: text(deal.deliveryCost),
    customsDuty: text(deal.customsDuty),
    utilFee: text(deal.utilFee),
    brokerCost: text(deal.brokerCost),
    otherCost: text(deal.otherCost),
    commission: text(deal.commission),
    paidAmount: text(deal.paidAmount),
    purchaseDate: deal.purchaseDate ?? "",
    etaDate: deal.etaDate ?? "",
    notes: deal.notes ?? "",
  };
}

export function DealEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    let alive = true;

    api
      .users()
      .then(({ users: list }) => {
        if (!alive) return;
        setUsers(list);
        // Новую сделку по умолчанию вешаем на того, кто её заводит.
        setForm((prev) => (prev.managerId ? prev : { ...prev, managerId: list[0]?.id ?? "" }));
      })
      .catch(() => undefined);

    if (id) {
      api
        .deal(id)
        .then(({ deal }) => {
          if (alive) setForm(fromDeal(deal));
        })
        .catch((e) => {
          if (alive) toast(e instanceof ApiError ? e.message : "Сделка не найдена", "error");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }

    return () => {
      alive = false;
    };
  }, [id, toast]);

  const totals = useMemo(
    () =>
      calcTotals({
        carPrice: parseMoney(form.carPrice),
        exchangeRate: parseMoney(form.exchangeRate),
        deliveryCost: parseMoney(form.deliveryCost),
        customsDuty: parseMoney(form.customsDuty),
        utilFee: parseMoney(form.utilFee),
        brokerCost: parseMoney(form.brokerCost),
        otherCost: parseMoney(form.otherCost),
        commission: parseMoney(form.commission),
        paidAmount: parseMoney(form.paidAmount),
      }),
    [form],
  );

  const pullRate = async () => {
    setRateBusy(true);
    try {
      const result = await api.rate(form.currency);
      set({ exchangeRate: String(result.rate) });
      toast(`Курс ЦБ: ${result.rate} ₽ за 1 ${result.currency}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось получить курс", "error");
    } finally {
      setRateBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.clientName.trim()) {
      toast("Укажите имя клиента", "error");
      return;
    }

    setSaving(true);
    const payload = { ...form };

    try {
      if (id) {
        await api.updateDeal(id, payload);
        toast("Сделка сохранена");
        navigate(`/crm/deals/${id}`);
      } else {
        const { deal } = await api.createDeal(payload);
        toast(`Сделка №${deal.number} создана`);
        navigate(`/crm/deals/${deal.id}`);
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось сохранить", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <form onSubmit={submit}>
      <PageHead
        title={id ? "Правка сделки" : "Новая сделка"}
        action={
          <div className="flex gap-2">
            <Button onClick={() => navigate(id ? `/crm/deals/${id}` : "/crm")}>
              <ArrowLeft className="h-4 w-4" />
              Отмена
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Сохранить
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title="Клиент">
            <div className="grid gap-3.5 p-4 sm:grid-cols-2">
              <Field label="Имя" className="sm:col-span-2">
                <Input
                  value={form.clientName}
                  onChange={(e) => set({ clientName: e.target.value })}
                  placeholder="Пётр Смирнов"
                  required
                />
              </Field>
              <Field label="Телефон">
                <Input
                  value={form.clientPhone}
                  onChange={(e) => set({ clientPhone: e.target.value })}
                  placeholder="+7 (900) 000-00-00"
                />
              </Field>
              <Field label="Telegram">
                <Input
                  value={form.clientTelegram}
                  onChange={(e) => set({ clientTelegram: e.target.value })}
                  placeholder="@username"
                />
              </Field>
              <Field label="Источник" hint="Откуда пришёл: Директ, канал, рекомендация">
                <Input
                  value={form.source}
                  onChange={(e) => set({ source: e.target.value })}
                  placeholder="Директ /quiz"
                />
              </Field>
              <Field label="Ответственный">
                <Select value={form.managerId} onChange={(e) => set({ managerId: e.target.value })}>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Автомобиль">
            <div className="grid gap-3.5 p-4 sm:grid-cols-2">
              <Field label="Марка">
                <Input value={form.carBrand} onChange={(e) => set({ carBrand: e.target.value })} placeholder="Kia" />
              </Field>
              <Field label="Модель">
                <Input value={form.carModel} onChange={(e) => set({ carModel: e.target.value })} placeholder="Sorento" />
              </Field>
              <Field label="Год выпуска">
                <Input
                  value={form.carYear}
                  onChange={(e) => set({ carYear: e.target.value })}
                  inputMode="numeric"
                  placeholder="2022"
                />
              </Field>
              <Field label="Пробег, км">
                <Input
                  value={form.carMileage}
                  onChange={(e) => set({ carMileage: e.target.value })}
                  inputMode="numeric"
                  placeholder="45000"
                />
              </Field>
              <Field label="Страна">
                <Select value={form.country} onChange={(e) => set({ country: e.target.value })}>
                  <option value="">Не выбрана</option>
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="VIN">
                <Input
                  value={form.vin}
                  onChange={(e) => set({ vin: e.target.value.toUpperCase() })}
                  placeholder="KNAPM81CBN5123456"
                />
              </Field>
              <Field label="Ссылка на лот" className="sm:col-span-2">
                <Input
                  value={form.lotUrl}
                  onChange={(e) => set({ lotUrl: e.target.value })}
                  placeholder="https://encar.com/..."
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Финансы"
            action={
              <Button size="sm" onClick={() => setCalcOpen(true)}>
                <Calculator className="h-4 w-4" />
                Рассчитать таможню
              </Button>
            }
          >
            <div className="grid gap-3.5 p-4 sm:grid-cols-2">
              <Field label="Валюта закупки">
                <Select value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={`Цена авто, ${form.currency}`}>
                <Input
                  value={form.carPrice}
                  onChange={(e) => set({ carPrice: e.target.value })}
                  inputMode="decimal"
                  placeholder="25000"
                />
              </Field>

              <Field
                label="Курс к рублю"
                hint={
                  parseMoney(form.exchangeRate) > 0
                    ? `Цена авто в рублях: ${money(totals.carPriceRub)}`
                    : "Пока курс не задан, цена авто в сумму не входит"
                }
              >
                <div className="flex gap-2">
                  <Input
                    value={form.exchangeRate}
                    onChange={(e) => set({ exchangeRate: e.target.value })}
                    inputMode="decimal"
                    placeholder="92.5"
                  />
                  <Button onClick={pullRate} loading={rateBusy} title="Подставить курс ЦБ">
                    <RefreshCw className="h-4 w-4" />
                    ЦБ
                  </Button>
                </div>
              </Field>

              <MoneyField label="Доставка, ₽" value={form.deliveryCost} onChange={(v) => set({ deliveryCost: v })} />
              <MoneyField label="Пошлина, ₽" value={form.customsDuty} onChange={(v) => set({ customsDuty: v })} />
              <MoneyField label="Утильсбор, ₽" value={form.utilFee} onChange={(v) => set({ utilFee: v })} />
              <MoneyField label="Брокер, ₽" value={form.brokerCost} onChange={(v) => set({ brokerCost: v })} />
              <MoneyField label="Прочие расходы, ₽" value={form.otherCost} onChange={(v) => set({ otherCost: v })} />
              <MoneyField label="Наша комиссия, ₽" value={form.commission} onChange={(v) => set({ commission: v })} />
              <MoneyField label="Оплачено клиентом, ₽" value={form.paidAmount} onChange={(v) => set({ paidAmount: v })} />
            </div>
          </Card>

          <Card title="Сроки и заметки">
            <div className="grid gap-3.5 p-4 sm:grid-cols-2">
              <Field label="Дата покупки">
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => set({ purchaseDate: e.target.value })}
                />
              </Field>
              <Field label="Ожидаемое прибытие" hint="Эту дату видит клиент по ссылке отслеживания">
                <Input type="date" value={form.etaDate} onChange={(e) => set({ etaDate: e.target.value })} />
              </Field>
              <Field label="Заметки" className="sm:col-span-2">
                <Textarea
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  placeholder="Договорённости, пожелания клиента, что проверить"
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* Итог держится в поле зрения при прокрутке длинной формы. */}
        <aside className="lg:sticky lg:top-[76px] lg:self-start">
          <Card title="Расчёт">
            <dl className="divide-y divide-[#eef1f5] px-4 py-1 text-[13.5px]">
              <Row label="Авто в рублях" value={money(totals.carPriceRub)} />
              <Row label="Себестоимость" value={money(totals.costRub)} />
              <Row label="Комиссия" value={money(totals.profitRub)} />
              <Row label="Итого клиенту" value={money(totals.totalRub)} strong />
              <Row label="Оплачено" value={money(parseMoney(form.paidAmount))} />
              <Row
                label="Остаток"
                value={money(totals.dueRub)}
                strong
                // Отрицательный остаток — переплата, её нужно заметить.
                tone={totals.dueRub < 0 ? "warn" : undefined}
              />
            </dl>

            {id ? (
              <div className="border-t border-[#eef1f5] p-4">
                <Field label="Этап">
                  <Select
                    value={form.stage}
                    onChange={(e) => set({ stage: e.target.value as Stage })}
                    disabled
                  >
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="mt-1.5 text-[12px] text-[#8a93a0]">
                  Этап меняется на доске или в карточке — так он всегда попадает в историю.
                </p>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>

      <CustomsCalculator
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        year={Number(form.carYear) || undefined}
        onApply={({ dutyRub, utilFeeRub, clearanceFeeRub }) => {
          set({
            customsDuty: String(Math.round(dutyRub)),
            utilFee: String(Math.round(utilFeeRub)),
            // Сбор за оформление кладём в «прочие»: отдельного поля под него
            // нет намеренно — иначе форма разрастается ради одной строки.
            otherCost: String(Math.round(parseMoney(form.otherCost) + clearanceFeeRub)),
          });
          setCalcOpen(false);
          toast("Суммы перенесены в сделку");
        }}
      />
    </form>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0"
        className="tnum"
      />
    </Field>
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
      <dt className="text-[#6b7480]">{label}</dt>
      <dd
        className={`tnum ${strong ? "text-[15px] font-bold" : "font-semibold"} ${
          tone === "warn" ? "text-[#b42318]" : "text-[#111827]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
