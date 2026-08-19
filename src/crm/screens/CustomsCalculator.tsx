/**
 * Предварительный расчёт таможенных платежей.
 *
 * Показывает не только цифры, но и формулу: менеджер должен понимать, откуда
 * взялась сумма, чтобы объяснить её клиенту. По кнопке значения переносятся
 * в поля сделки.
 *
 * Ставки лежат в lib/customs-rates.ts одним файлом и помечены датой сбора.
 * Это оценка для разговора с клиентом, а не расчёт для декларации.
 */

import { useMemo, useState } from "react";
import { calcCustoms, ageGroupFromYear } from "../lib/customs";
import {
  AGE_GROUP_LABELS,
  ENGINE_TYPE_LABELS,
  RATES_UPDATED_AT,
  type AgeGroup,
  type EngineType,
} from "../lib/customs-rates";
import { money } from "../lib/money";
import { Button, Field, Input, Modal, Select } from "../ui";

export function CustomsCalculator({
  open,
  onClose,
  year,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** Год выпуска из формы сделки — подставляем возрастную группу сразу. */
  year?: number;
  onApply: (result: { dutyRub: number; utilFeeRub: number; clearanceFeeRub: number }) => void;
}) {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(() =>
    year ? ageGroupFromYear(year) : "FROM_3_TO_5",
  );
  const [engineType, setEngineType] = useState<EngineType>("PETROL");
  const [engineCc, setEngineCc] = useState("2000");
  const [priceEur, setPriceEur] = useState("20000");
  const [eurRate, setEurRate] = useState("100");
  const [commercial, setCommercial] = useState(false);

  const result = useMemo(
    () =>
      calcCustoms({
        ageGroup,
        engineType,
        engineCc: Number(engineCc) || 0,
        priceEur: Number(priceEur) || 0,
        eurRate: Number(eurRate) || 0,
        commercial,
      }),
    [ageGroup, engineType, engineCc, priceEur, eurRate, commercial],
  );

  return (
    <Modal open={open} onClose={onClose} title="Расчёт таможенных платежей" wide>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Возраст авто">
          <Select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}>
            {(Object.keys(AGE_GROUP_LABELS) as AgeGroup[]).map((key) => (
              <option key={key} value={key}>
                {AGE_GROUP_LABELS[key]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Двигатель">
          <Select value={engineType} onChange={(e) => setEngineType(e.target.value as EngineType)}>
            {(Object.keys(ENGINE_TYPE_LABELS) as EngineType[]).map((key) => (
              <option key={key} value={key}>
                {ENGINE_TYPE_LABELS[key]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Объём, см³" hint={engineType === "ELECTRIC" ? "Для электромобиля не используется" : undefined}>
          <Input
            value={engineCc}
            onChange={(e) => setEngineCc(e.target.value)}
            inputMode="numeric"
            disabled={engineType === "ELECTRIC"}
            className="tnum"
          />
        </Field>

        <Field label="Таможенная стоимость, €">
          <Input value={priceEur} onChange={(e) => setPriceEur(e.target.value)} inputMode="decimal" className="tnum" />
        </Field>

        <Field label="Курс евро к рублю">
          <Input value={eurRate} onChange={(e) => setEurRate(e.target.value)} inputMode="decimal" className="tnum" />
        </Field>

        <Field label="Кто ввозит">
          <Select value={commercial ? "1" : "0"} onChange={(e) => setCommercial(e.target.value === "1")}>
            <option value="0">Физлицо для себя</option>
            <option value="1">Юрлицо или на продажу</option>
          </Select>
        </Field>
      </div>

      <div className="mt-4 rounded-lg border border-[#e3e8ee] bg-[#fafbfc] p-4">
        <p className="text-[12.5px] leading-relaxed text-[#6b7480]">{result.explanation}</p>

        <dl className="mt-3 divide-y divide-[#e8ecf1] text-[13.5px]">
          <Line label={`Пошлина (${result.dutyEur.toLocaleString("ru-RU")} €)`} value={money(result.dutyRub)} />
          <Line label="Утильсбор" value={money(result.utilFeeRub)} />
          <Line label="Сбор за оформление" value={money(result.clearanceFeeRub)} />
          <Line label="Итого платежей" value={money(result.totalRub)} strong />
        </dl>
      </div>

      <p className="mt-3 rounded-lg bg-[#fff8e6] px-3 py-2.5 text-[12px] leading-relaxed text-[#8a6100]">
        Ставки в расчёте собраны на {RATES_UPDATED_AT} и с тех пор могли измениться.
        Это предварительная оценка для разговора с клиентом — перед подписанием
        договора сверьте суммы с действующими ставками.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Закрыть</Button>
        <Button
          variant="primary"
          onClick={() =>
            onApply({
              dutyRub: result.dutyRub,
              utilFeeRub: result.utilFeeRub,
              clearanceFeeRub: result.clearanceFeeRub,
            })
          }
        >
          Перенести в сделку
        </Button>
      </div>
    </Modal>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-[#6b7480]">{label}</dt>
      <dd className={`tnum ${strong ? "text-[15px] font-bold" : "font-semibold"} text-[#111827]`}>
        {value}
      </dd>
    </div>
  );
}
