/**
 * Реквизиты компании. Раздел владельца.
 *
 * Подставляются в счёт и договор. Пустое поле там превращается в пробел
 * посреди документа, поэтому под формой видно, чего не хватает для печати.
 */

import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth";
import { missingRequisites } from "../lib/documents";
import type { Settings } from "../lib/types";
import { Button, Card, Field, Input, Spinner, useToast } from "../ui";
import { PageHead } from "./Layout";

export function SettingsPage() {
  const { isOwner } = useAuth();
  const toast = useToast();

  const [values, setValues] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    api
      .settings()
      .then(({ settings }) => setValues(settings))
      .catch((e) => toast(e instanceof ApiError ? e.message : "Не удалось загрузить", "error"));
  }, [isOwner, toast]);

  if (!isOwner) return <Navigate to="/crm" replace />;
  if (!values) return <Spinner />;

  const set = (patch: Partial<Settings>) => setValues((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.saveSettings(values);
      setValues(result.settings);
      toast("Реквизиты сохранены");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось сохранить", "error");
    } finally {
      setBusy(false);
    }
  };

  const missingInvoice = missingRequisites(values, "invoice");
  const missingContract = missingRequisites(values, "contract");

  return (
    <form onSubmit={save}>
      <PageHead
        title="Реквизиты"
        subtitle="Подставляются в счёт и договор"
        action={
          <Button type="submit" variant="primary" loading={busy}>
            Сохранить
          </Button>
        }
      />

      {missingInvoice.length || missingContract.length ? (
        <div className="mb-4 flex gap-3 rounded-xl border border-[#f3d99b] bg-[#fff8e6] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[#b45309]" />
          <div className="text-[13px] leading-relaxed text-[#8a6100]">
            {missingContract.length ? (
              <p>
                Для договора не хватает: <b>{missingContract.join(", ")}</b>.
              </p>
            ) : null}
            {missingInvoice.length ? (
              <p>
                Для счёта не хватает: <b>{missingInvoice.join(", ")}</b>.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Компания">
          <div className="grid gap-3.5 p-4 sm:grid-cols-2">
            <Field label="Форма">
              <Input value={values.legalForm} onChange={(e) => set({ legalForm: e.target.value })} placeholder="ИП" />
            </Field>
            <Field label="Наименование">
              <Input
                value={values.companyName}
                onChange={(e) => set({ companyName: e.target.value })}
                placeholder="Петренко Дмитрий Анатольевич"
              />
            </Field>
            <Field label="ИНН">
              <Input value={values.inn} onChange={(e) => set({ inn: e.target.value })} className="tnum" />
            </Field>
            <Field label="ОГРН / ОГРНИП">
              <Input value={values.ogrn} onChange={(e) => set({ ogrn: e.target.value })} className="tnum" />
            </Field>
            <Field label="Адрес" className="sm:col-span-2">
              <Input
                value={values.legalAddress}
                onChange={(e) => set({ legalAddress: e.target.value })}
                placeholder="г. Тверь, ул. ..."
              />
            </Field>
            <Field label="Телефон">
              <Input value={values.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Почта">
              <Input value={values.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Банк">
          <div className="grid gap-3.5 p-4 sm:grid-cols-2">
            <Field label="Банк" className="sm:col-span-2">
              <Input value={values.bankName} onChange={(e) => set({ bankName: e.target.value })} />
            </Field>
            <Field label="Расчётный счёт" className="sm:col-span-2">
              <Input
                value={values.bankAccount}
                onChange={(e) => set({ bankAccount: e.target.value })}
                className="tnum"
              />
            </Field>
            <Field label="Корр. счёт">
              <Input value={values.bankCorr} onChange={(e) => set({ bankCorr: e.target.value })} className="tnum" />
            </Field>
            <Field label="БИК">
              <Input value={values.bankBic} onChange={(e) => set({ bankBic: e.target.value })} className="tnum" />
            </Field>
          </div>
        </Card>

        <Card title="Подпись и условия">
          <div className="grid gap-3.5 p-4 sm:grid-cols-2">
            <Field label="Подписант">
              <Input
                value={values.signerName}
                onChange={(e) => set({ signerName: e.target.value })}
                placeholder="Петренко Д. А."
              />
            </Field>
            <Field label="Должность">
              <Input value={values.signerPosition} onChange={(e) => set({ signerPosition: e.target.value })} />
            </Field>
            <Field label="Срок поставки, дней">
              <Input
                type="number"
                min={1}
                max={365}
                value={values.deliveryDays}
                onChange={(e) => set({ deliveryDays: Number(e.target.value) })}
                className="tnum"
              />
            </Field>
            <Field label="Предоплата, %">
              <Input
                type="number"
                min={0}
                max={100}
                value={values.prepaymentPercent}
                onChange={(e) => set({ prepaymentPercent: Number(e.target.value) })}
                className="tnum"
              />
            </Field>
          </div>
        </Card>

        <Card title="О шаблоне договора">
          <p className="p-4 text-[13.5px] leading-relaxed text-[#5b6470]">
            Договор в CRM — рабочая заготовка: она подставляет реквизиты, предмет,
            сумму и сроки, чтобы не собирать документ вручную. Перед тем как
            подписывать его с клиентами, покажите шаблон юристу: ответственность
            сторон, порядок возврата предоплаты и условия при задержке поставки
            зависят от того, как вы договариваетесь на практике.
          </p>
        </Card>
      </div>
    </form>
  );
}
