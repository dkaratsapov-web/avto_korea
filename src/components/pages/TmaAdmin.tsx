import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Car as CarIcon,
  Bot,
  Inbox,
  Users,
  Loader2,
  Star,
  Bell,
  Megaphone,
  BarChart3,
  FileStack,
  Upload,
} from "lucide-react";
import { useCars } from "@/lib/carsStore";
import { type Car, type CarStatus, formatPrice } from "@/data/cars";
import { countries, type CountryCode } from "@/lib/site";
import { Flag } from "@/components/icons/Flag";
import { showToast } from "@/lib/toast";
import {
  adminCall,
  API_BASE,
  type AdminRole,
  type BotSettings,
  type Lead,
  type AdminsMap,
  type Review,
  type Subscription,
  type Stats,
  type Draft,
} from "@/lib/api";
import { haptic, type TG } from "@/lib/telegram";

type Tab =
  | "catalog"
  | "drafts"
  | "bot"
  | "leads"
  | "reviews"
  | "subs"
  | "stats"
  | "broadcast"
  | "admins";

const emptyCar = (): Car => ({
  id: "",
  model: "",
  year: new Date().getFullYear(),
  country: "kr",
  engine: "",
  trim: "",
  mileage: "Новый, 0 км",
  gearbox: "АКПП",
  drive: "Передний",
  bodyType: "Кроссовер",
  fuelType: "Бензин",
  engineCc: 1500,
  powerHp: 150,
  mileageKm: 0,
  color: "",
  priceRub: 0,
  priceMoscowRub: 0,
  priceTverRub: 0,
  status: "in_stock",
  isNew: true,
  images: [],
  highlights: [],
});

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9а-я]+/gi, "-")
      .replace(/^-+|-+$/g, "") || `car-${Date.now()}`
  );
}

function carFromDraft(d: Draft): Car {
  const p = d.parsed;
  const price = p.price || 0;
  const base = emptyCar();
  const mileageKm = p.mileageKm ?? 0;
  return {
    ...base,
    id: "",
    model: p.model || "Авто из канала",
    year: p.year || new Date().getFullYear(),
    engineCc: p.engineCc || base.engineCc,
    powerHp: p.powerHp || base.powerHp,
    gearbox: p.gearbox || base.gearbox,
    drive: p.drive || base.drive,
    bodyType: p.bodyType || base.bodyType,
    fuelType: p.fuelType || base.fuelType,
    color: p.color || base.color,
    trim: p.trim || base.trim,
    mileageKm,
    mileage: mileageKm > 0 ? `${mileageKm.toLocaleString("ru-RU")} км` : base.mileage,
    isNew: !(mileageKm > 0),
    priceRub: price,
    priceTverRub: p.priceTver || price,
    priceMoscowRub: p.priceMoscow || price,
    images: d.fileIds.map(
      (fid) => `${API_BASE}/api/tgphoto?id=${encodeURIComponent(fid)}`,
    ),
    highlights: p.highlights || [],
  };
}

export function TmaAdmin({
  tg,
  initData,
  role,
  onExit,
}: {
  tg: TG | null;
  initData: string;
  role: AdminRole;
  onExit: () => void;
}) {
  const [tab, setTab] = useState<Tab>("catalog");
  const tabs: { id: Tab; label: string; icon: typeof CarIcon; min: number }[] = [
    { id: "catalog", label: "Каталог", icon: CarIcon, min: 1 },
    { id: "drafts", label: "Черновики", icon: FileStack, min: 2 },
    { id: "bot", label: "Бот", icon: Bot, min: 1 },
    { id: "leads", label: "Заявки", icon: Inbox, min: 2 },
    { id: "reviews", label: "Отзывы", icon: Star, min: 1 },
    { id: "subs", label: "Подписки", icon: Bell, min: 2 },
    { id: "stats", label: "Статистика", icon: BarChart3, min: 2 },
    { id: "broadcast", label: "Рассылка", icon: Megaphone, min: 3 },
    { id: "admins", label: "Админы", icon: Users, min: 3 },
  ];
  const rank = role === "owner" ? 3 : role === "manager" ? 2 : 1;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => {
            haptic(tg);
            onExit();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[18px] font-extrabold uppercase">Админка</h1>
        <span className="ml-auto rounded-full border border-line-dark px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-chrome">
          {role}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs
          .filter((t) => rank >= t.min)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => {
                haptic(tg);
                setTab(t.id);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${
                tab === t.id
                  ? "border-bordeaux-bright bg-bordeaux text-white"
                  : "border-line-dark text-chrome"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
      </div>

      {tab === "catalog" ? (
        <CatalogTab tg={tg} initData={initData} canEdit={rank >= 2} />
      ) : null}
      {tab === "drafts" && rank >= 2 ? (
        <DraftsTab tg={tg} initData={initData} />
      ) : null}
      {tab === "bot" ? (
        <BotTab tg={tg} initData={initData} canEdit={rank >= 2} />
      ) : null}
      {tab === "leads" && rank >= 2 ? <LeadsTab initData={initData} /> : null}
      {tab === "reviews" ? (
        <ReviewsTab tg={tg} initData={initData} canEdit={rank >= 2} />
      ) : null}
      {tab === "subs" && rank >= 2 ? <SubsTab initData={initData} /> : null}
      {tab === "stats" && rank >= 2 ? <StatsTab initData={initData} /> : null}
      {tab === "broadcast" && rank >= 3 ? (
        <BroadcastTab tg={tg} initData={initData} />
      ) : null}
      {tab === "admins" && rank >= 3 ? <AdminsTab initData={initData} /> : null}
    </div>
  );
}

/* ---------- Черновики из канала ---------- */
function DraftsTab({ tg, initData }: { tg: TG | null; initData: string }) {
  const { cars, setAll } = useCars();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [editing, setEditing] = useState<{ car: Car; draftId: string } | null>(null);

  useEffect(() => {
    adminCall<{ drafts: Draft[] }>(initData, "drafts.list").then((r) =>
      setDrafts(r.ok ? r.drafts : []),
    );
  }, [initData]);

  async function publish(car: Car, draftId: string) {
    const id = car.id || slug(car.model);
    const price = car.priceTverRub || car.priceRub || 0;
    const full = { ...car, id, priceRub: price, priceTverRub: price };
    const next = cars.some((c) => c.id === id)
      ? cars.map((c) => (c.id === id ? full : c))
      : [...cars, full];
    setAll(next);
    const r = await adminCall(initData, "catalog.save", next);
    await adminCall(initData, "drafts.remove", { id: draftId });
    setEditing(null);
    setDrafts((p) => (p ? p.filter((d) => d.id !== draftId) : p));
    if (r.ok) {
      haptic(tg, "medium");
      showToast("Опубликовано в каталог");
    } else showToast("Ошибка сохранения", "error");
  }

  async function remove(id: string) {
    const r = await adminCall<{ drafts: Draft[] }>(initData, "drafts.remove", { id });
    if (r.ok) setDrafts(r.drafts);
  }

  if (editing)
    return (
      <CarEditor
        initial={editing.car}
        onCancel={() => setEditing(null)}
        onSave={(car) => publish(car, editing.draftId)}
      />
    );
  if (drafts === null) return <Spinner />;
  if (drafts.length === 0)
    return (
      <div className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center">
        <FileStack className="mx-auto h-8 w-8 text-chrome" />
        <p className="mt-2 font-bold">Черновиков нет</p>
        <p className="mt-1 text-[13px] text-[#9AA4B2]">
          Добавьте бота администратором в ваш канал — новые посты с фото будут
          падать сюда на проверку, и вы публикуете их в каталог одной кнопкой.
        </p>
      </div>
    );
  return (
    <div className="space-y-2.5">
      {drafts.map((d) => (
        <div key={d.id} className="rounded-[16px] border border-line-dark bg-graphite-2 p-2.5">
          <div className="flex gap-3">
            <div className="h-[64px] w-[88px] flex-none overflow-hidden rounded-[10px] bg-black">
              {d.fileIds[0] ? (
                // eslint-disable-next-line
                <img
                  src={`${API_BASE}/api/tgphoto?id=${encodeURIComponent(d.fileIds[0])}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{d.parsed.model || "—"}</div>
              <div className="text-[12px] text-[#9AA4B2]">
                {d.parsed.year} ·{" "}
                {d.parsed.price ? formatPrice(d.parsed.price) + " ₽" : "цена не распознана"}
              </div>
              <div className="text-[11px] text-[#8C97A1]">{d.fileIds.length} фото</div>
            </div>
          </div>
          {d.fileIds.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.fileIds.map((fid, i) => (
                <div
                  key={fid + i}
                  className="h-14 w-14 flex-none overflow-hidden rounded-[8px] bg-black"
                >
                  {/* eslint-disable-next-line */}
                  <img
                    src={`${API_BASE}/api/tgphoto?id=${encodeURIComponent(fid)}`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setEditing({ car: carFromDraft(d), draftId: d.id })}
              className="btn btn-primary flex-1 !py-2"
            >
              <Upload className="h-4 w-4" /> Оформить и опубликовать
            </button>
            <button
              onClick={() => remove(d.id)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line-dark text-bordeaux-bright"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Отзывы ---------- */
function ReviewsTab({
  tg,
  initData,
  canEdit,
}: {
  tg: TG | null;
  initData: string;
  canEdit: boolean;
}) {
  const [list, setList] = useState<Review[] | null>(null);
  const [editing, setEditing] = useState<Review | null>(null);
  const lab = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]";

  function load() {
    adminCall<{ reviews: Review[] }>(initData, "reviews.list").then((r) =>
      setList(r.ok ? r.reviews : []),
    );
  }
  useEffect(load, [initData]);

  async function save(rev: Review) {
    const r = await adminCall<{ reviews: Review[] }>(initData, "reviews.save", rev);
    if (r.ok) {
      setList(r.reviews);
      setEditing(null);
      haptic(tg, "medium");
      showToast("Отзыв сохранён");
    } else showToast("Ошибка: " + (r.error || ""), "error");
  }
  async function remove(id: string) {
    const r = await adminCall<{ reviews: Review[] }>(initData, "reviews.remove", { id });
    if (r.ok) setList(r.reviews);
  }

  if (editing) {
    const e = editing;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold uppercase">
            {e.id ? "Редактирование" : "Новый отзыв"}
          </h2>
          <button
            onClick={() => setEditing(null)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <label>
          <span className={lab}>Имя клиента</span>
          <input
            className="field-dark"
            value={e.name}
            onChange={(ev) => setEditing({ ...e, name: ev.target.value })}
          />
        </label>
        <label>
          <span className={lab}>Авто (необязательно)</span>
          <input
            className="field-dark"
            value={e.car ?? ""}
            onChange={(ev) => setEditing({ ...e, car: ev.target.value })}
          />
        </label>
        <div>
          <span className={lab}>Оценка</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setEditing({ ...e, rating: n })}
                className="p-0.5"
              >
                <Star
                  className={`h-7 w-7 ${n <= e.rating ? "fill-bordeaux-bright text-bordeaux-bright" : "text-[#3a424c]"}`}
                />
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className={lab}>Текст отзыва</span>
          <textarea
            className="field-dark min-h-[110px]"
            value={e.text}
            onChange={(ev) => setEditing({ ...e, text: ev.target.value })}
          />
        </label>
        <button onClick={() => save(e)} className="btn btn-primary w-full">
          <Save className="h-[18px] w-[18px]" /> Сохранить
        </button>
      </div>
    );
  }

  if (list === null) return <Spinner />;

  return (
    <>
      {canEdit ? (
        <button
          onClick={() =>
            setEditing({ id: "", name: "", text: "", car: "", rating: 5, ts: Date.now() })
          }
          className="btn btn-primary mb-3 w-full"
        >
          <Plus className="h-[18px] w-[18px]" /> Добавить отзыв
        </button>
      ) : null}
      <div className="space-y-2.5">
        {list.length === 0 ? (
          <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
            Отзывов пока нет.
          </p>
        ) : (
          list.map((r) => (
            <div key={r.id} className="rounded-[16px] border border-line-dark bg-graphite-2 p-3">
              <div className="flex items-center gap-2">
                <span className="font-bold">{r.name}</span>
                <span className="flex">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-bordeaux-bright text-bordeaux-bright" />
                  ))}
                </span>
                {canEdit ? (
                  <span className="ml-auto flex gap-1.5">
                    <button
                      onClick={() => setEditing(r)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-line-dark text-chrome"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-line-dark text-bordeaux-bright"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] text-[#C7CFD6]">{r.text}</p>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ---------- Подписки ---------- */
function SubsTab({ initData }: { initData: string }) {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  useEffect(() => {
    adminCall<{ subs: Subscription[] }>(initData, "subs.list").then((r) =>
      setSubs(r.ok ? r.subs : []),
    );
  }, [initData]);
  if (subs === null) return <Spinner />;
  if (subs.length === 0)
    return (
      <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
        Подписок пока нет.
      </p>
    );
  return (
    <div className="space-y-2.5">
      {subs.map((s, i) => (
        <div key={i} className="rounded-[16px] border border-line-dark bg-graphite-2 p-3">
          <div className="flex items-center justify-between">
            <span className="font-bold">{s.name || "—"}</span>
            <span className="font-num text-[11px] text-[#8C97A1]">#{s.userId}</span>
          </div>
          <div className="mt-1 text-[12.5px] text-[#C7CFD6]">
            🌍 {s.params.country || "любая"} · 🚙 {s.params.body || "любой"} · 💰{" "}
            {s.params.budget ? `до ${formatPrice(s.params.budget)} ₽` : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Статистика ---------- */
function StatsTab({ initData }: { initData: string }) {
  const { cars } = useCars();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    adminCall<{ stats: Stats }>(initData, "stats.get").then((r) =>
      r.ok ? setStats(r.stats) : null,
    );
  }, [initData]);
  if (!stats) return <Spinner />;
  const cells: [string, number][] = [
    ["Заявок всего", stats.leads],
    ["Заявок сегодня", stats.leadsToday ?? 0],
    ["Заявок за 7 дней", stats.leads7d ?? 0],
    ["Пользователей", stats.users],
    ["Новых за 7 дней", stats.usersNew7d ?? 0],
    ["Подписок", stats.subs],
    ["Отзывов", stats.reviews],
    ["Черновиков", stats.drafts ?? 0],
    ["Просмотров", stats.totalViews],
  ];
  const top = Object.entries(stats.views || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const nameOf = (id: string) => cars.find((c) => c.id === id)?.model || id;
  const sources = Object.entries(stats.bySource || {}).sort((a, b) => b[1] - a[1]);

  // Сводка по каталогу (из общих данных)
  const prices = cars.map((c) => c.priceTverRub ?? c.priceRub).filter(Boolean);
  const byStatus = {
    in_stock: cars.filter((c) => c.status === "in_stock").length,
    in_transit: cars.filter((c) => c.status === "in_transit").length,
    on_order: cars.filter((c) => c.status === "on_order").length,
  };
  const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

  const topFav = Object.entries(stats.favs || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const daily = stats.daily || [];
  const dailyMax = Math.max(1, ...daily.map((d) => d.count));
  const convView = stats.totalViews ? (stats.leads / stats.totalViews) * 100 : 0;
  const convUser = stats.users ? stats.leads / stats.users : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        {cells.map(([label, v]) => (
          <div key={label} className="rounded-[16px] border border-line-dark bg-graphite-2 p-3.5">
            <div className="font-num text-[26px] font-extrabold text-bordeaux-bright">{v}</div>
            <div className="text-[12px] text-[#9AA4B2]">{label}</div>
          </div>
        ))}
      </div>

      {/* Конверсии */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[16px] border border-line-dark bg-graphite-2 p-3.5">
          <div className="font-num text-[22px] font-extrabold text-success">
            {convView.toFixed(1)}%
          </div>
          <div className="text-[12px] text-[#9AA4B2]">Просмотр → заявка</div>
        </div>
        <div className="rounded-[16px] border border-line-dark bg-graphite-2 p-3.5">
          <div className="font-num text-[22px] font-extrabold text-success">
            {convUser.toFixed(2)}
          </div>
          <div className="text-[12px] text-[#9AA4B2]">Заявок на пользователя</div>
        </div>
      </div>

      {/* График заявок по дням */}
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
          Заявки за 14 дней
        </div>
        <div className="flex h-24 items-end gap-1 rounded-[16px] border border-line-dark bg-graphite-2 p-3">
          {daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-bordeaux-bright"
                  style={{ height: `${Math.max(4, (d.count / dailyMax) * 100)}%` }}
                  title={`${d.date}: ${d.count}`}
                />
              </div>
              <span className="text-[8px] text-[#8C97A1]">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      {stats.lastLeadTs ? (
        <div className="rounded-[14px] border border-line-dark bg-graphite-2 px-3.5 py-2.5 text-[12.5px] text-[#C7CFD6]">
          🕓 Последняя заявка:{" "}
          {new Date(stats.lastLeadTs).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      ) : null}

      {sources.length ? (
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
            Источники заявок
          </div>
          <div className="space-y-2">
            {sources.map(([src, v]) => (
              <div
                key={src}
                className="flex items-center justify-between rounded-[14px] border border-line-dark bg-graphite-2 px-3.5 py-2.5"
              >
                <span className="truncate text-[13.5px]">{src}</span>
                <span className="font-num text-[13px] text-bordeaux-bright">{v}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
          Каталог
        </div>
        <div className="rounded-[16px] border border-line-dark bg-graphite-2 p-3.5 text-[13px] text-[#C7CFD6]">
          <div className="flex justify-between py-0.5">
            <span>Всего авто</span>
            <span className="font-num text-white">{cars.length}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>В наличии / в пути / под заказ</span>
            <span className="font-num text-white">
              {byStatus.in_stock} / {byStatus.in_transit} / {byStatus.on_order}
            </span>
          </div>
          {prices.length ? (
            <div className="flex justify-between py-0.5">
              <span>Цены, ₽</span>
              <span className="font-num text-white">
                {fmt(Math.min(...prices))} – {fmt(Math.max(...prices))}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
          Топ просматриваемых
        </div>
        {top.length === 0 ? (
          <p className="text-[13px] text-[#8C97A1]">Пока нет данных.</p>
        ) : (
          <div className="space-y-2">
            {top.map(([id, v]) => (
              <div
                key={id}
                className="flex items-center justify-between rounded-[14px] border border-line-dark bg-graphite-2 px-3.5 py-2.5"
              >
                <span className="truncate text-[13.5px] font-semibold">{nameOf(id)}</span>
                <span className="font-num text-[13px] text-bordeaux-bright">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8C97A1]">
          Топ по избранному
        </div>
        {topFav.length === 0 ? (
          <p className="text-[13px] text-[#8C97A1]">Пока нет данных.</p>
        ) : (
          <div className="space-y-2">
            {topFav.map(([id, v]) => (
              <div
                key={id}
                className="flex items-center justify-between rounded-[14px] border border-line-dark bg-graphite-2 px-3.5 py-2.5"
              >
                <span className="truncate text-[13.5px] font-semibold">
                  ♥ {nameOf(id)}
                </span>
                <span className="font-num text-[13px] text-bordeaux-bright">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Рассылка ---------- */
function BroadcastTab({ tg, initData }: { tg: TG | null; initData: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (text.trim().length < 2) return;
    if (!confirm("Отправить сообщение всем пользователям бота?")) return;
    setSending(true);
    const r = await adminCall<{ sent: number; total: number }>(
      initData,
      "broadcast.send",
      { text: text.trim() },
    );
    setSending(false);
    if (r.ok) {
      haptic(tg, "medium");
      showToast(`Отправлено: ${r.sent} из ${r.total}`);
      setText("");
    } else showToast("Ошибка: " + (r.error || ""), "error");
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[#9AA4B2]">
        Сообщение получат все, кто писал боту или открывал мини-апп.
      </p>
      <textarea
        className="field-dark min-h-[140px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Текст рассылки…"
      />
      <button onClick={send} className="btn btn-primary w-full">
        {sending ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : (
          <Megaphone className="h-[18px] w-[18px]" />
        )}
        Отправить всем
      </button>
    </div>
  );
}

/* ---------- Каталог ---------- */
function CatalogTab({
  tg,
  initData,
  canEdit,
}: {
  tg: TG | null;
  initData: string;
  canEdit: boolean;
}) {
  const { cars, setAll } = useCars();
  const [editing, setEditing] = useState<Car | null>(null);
  const [saving, setSaving] = useState(false);

  async function persist(next: Car[]) {
    setAll(next);
    setSaving(true);
    const r = await adminCall(initData, "catalog.save", next);
    setSaving(false);
    if (r.ok) {
      haptic(tg, "medium");
      showToast("Каталог сохранён — виден всем");
    } else {
      showToast("Не удалось сохранить: " + (r.error || ""), "error");
    }
  }

  function onSave(car: Car) {
    const id = car.id || slug(car.model);
    const price = car.priceTverRub || car.priceRub || 0;
    const full = { ...car, id, priceRub: price, priceTverRub: price };
    const next = cars.some((c) => c.id === id)
      ? cars.map((c) => (c.id === id ? full : c))
      : [...cars, full];
    setEditing(null);
    persist(next);
  }

  if (editing) {
    return (
      <CarEditor
        initial={editing}
        onCancel={() => setEditing(null)}
        onSave={onSave}
      />
    );
  }

  return (
    <>
      {canEdit ? (
        <button
          onClick={() => setEditing(emptyCar())}
          className="btn btn-primary mb-3 w-full"
        >
          <Plus className="h-[18px] w-[18px]" /> Добавить авто
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        </button>
      ) : null}
      <div className="space-y-2.5">
        {cars.map((car) => (
          <div
            key={car.id}
            className="flex items-center gap-3 rounded-[16px] border border-line-dark bg-graphite-2 p-2.5"
          >
            <div className="h-[52px] w-[74px] flex-none overflow-hidden rounded-[10px] bg-black">
              {car.images[0] ? (
                // eslint-disable-next-line
                <img src={car.images[0]} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Flag code={car.country} className="h-3 w-4" />
                <span className="truncate font-bold">{car.model}</span>
              </div>
              <div className="font-num text-[14px] font-bold text-bordeaux-bright">
                {formatPrice(car.priceTverRub ?? car.priceRub)} ₽
              </div>
            </div>
            {canEdit ? (
              <>
                <button
                  onClick={() => setEditing(car)}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line-dark text-chrome"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Удалить «${car.model}»?`))
                      persist(cars.filter((c) => c.id !== car.id));
                  }}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line-dark text-bordeaux-bright"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        ))}
        {cars.length === 0 ? (
          <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
            Каталог пуст.
          </p>
        ) : null}
      </div>
    </>
  );
}

function CarEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Car;
  onSave: (car: Car) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Car>(initial);
  const set = <K extends keyof Car>(k: K, v: Car[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const lab = "block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1] mb-1";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(f);
      }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold uppercase">
          {initial.id ? "Редактирование" : "Новое авто"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-chrome"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <label>
        <span className={lab}>Модель</span>
        <input
          className="field-dark"
          value={f.model}
          onChange={(e) => set("model", e.target.value)}
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={lab}>Год</span>
          <input
            type="number"
            inputMode="numeric"
            className="field-dark"
            value={f.year}
            onChange={(e) => set("year", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Страна</span>
          <select
            className="field-dark"
            value={f.country}
            onChange={(e) => set("country", e.target.value as CountryCode)}
          >
            {Object.entries(countries).map(([code, c]) => (
              <option key={code} value={code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={lab}>Двигатель</span>
          <input
            className="field-dark"
            value={f.engine}
            onChange={(e) => set("engine", e.target.value)}
            placeholder="1.5 л · 115 л.с."
          />
        </label>
        <label>
          <span className={lab}>Комплектация</span>
          <input
            className="field-dark"
            value={f.trim}
            onChange={(e) => set("trim", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Тип кузова</span>
          <input
            className="field-dark"
            value={f.bodyType ?? ""}
            onChange={(e) => set("bodyType", e.target.value)}
            placeholder="Кроссовер / Седан"
          />
        </label>
        <label>
          <span className={lab}>Топливо</span>
          <select
            className="field-dark"
            value={f.fuelType ?? "Бензин"}
            onChange={(e) => set("fuelType", e.target.value)}
          >
            <option>Бензин</option>
            <option>Дизель</option>
            <option>Гибрид</option>
            <option>Электро</option>
          </select>
        </label>
        <label>
          <span className={lab}>Объём, см³</span>
          <input
            type="number"
            inputMode="numeric"
            className="field-dark"
            value={f.engineCc ?? 0}
            onChange={(e) => set("engineCc", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Мощность, л.с.</span>
          <input
            type="number"
            inputMode="numeric"
            className="field-dark"
            value={f.powerHp ?? 0}
            onChange={(e) => set("powerHp", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Цвет</span>
          <input
            className="field-dark"
            value={f.color ?? ""}
            onChange={(e) => set("color", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Пробег, км</span>
          <input
            type="number"
            inputMode="numeric"
            className="field-dark"
            value={f.mileageKm ?? 0}
            onChange={(e) => set("mileageKm", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Коробка</span>
          <input
            className="field-dark"
            value={f.gearbox}
            onChange={(e) => set("gearbox", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Привод</span>
          <input
            className="field-dark"
            value={f.drive}
            onChange={(e) => set("drive", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Цена до Твери, ₽</span>
          <input
            type="number"
            inputMode="numeric"
            className="field-dark"
            value={f.priceTverRub || 0}
            onChange={(e) => set("priceTverRub", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Цена до Москвы, ₽</span>
          <input
            type="number"
            inputMode="numeric"
            className="field-dark"
            value={f.priceMoscowRub || 0}
            onChange={(e) => set("priceMoscowRub", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Пробег</span>
          <input
            className="field-dark"
            value={f.mileage}
            onChange={(e) => set("mileage", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Статус</span>
          <select
            className="field-dark"
            value={f.status}
            onChange={(e) => set("status", e.target.value as CarStatus)}
          >
            <option value="in_stock">В наличии</option>
            <option value="in_transit">В пути</option>
            <option value="on_order">Под заказ</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!f.isNew}
          onChange={(e) => set("isNew", e.target.checked)}
          className="h-4 w-4 accent-bordeaux"
        />
        <span className="text-[14px] font-semibold">Новинка (бейдж)</span>
      </label>
      <label>
        <span className={lab}>Фото (по ссылке в строке)</span>
        <textarea
          className="field-dark min-h-[80px] font-mono text-[12px]"
          value={f.images.join("\n")}
          onChange={(e) =>
            set("images", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))
          }
          placeholder="/cars/.../1.webp"
        />
      </label>
      <label>
        <span className={lab}>Описание (по пункту в строке)</span>
        <textarea
          className="field-dark min-h-[80px]"
          value={f.highlights.join("\n")}
          onChange={(e) =>
            set("highlights", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))
          }
        />
      </label>
      <button type="submit" className="btn btn-primary w-full">
        <Save className="h-[18px] w-[18px]" /> Сохранить
      </button>
    </form>
  );
}

/* ---------- Настройки бота ---------- */
function BotTab({
  tg,
  initData,
  canEdit,
}: {
  tg: TG | null;
  initData: string;
  canEdit: boolean;
}) {
  const [s, setS] = useState<BotSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const lab = "block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1] mb-1";

  useEffect(() => {
    adminCall<{ settings: BotSettings }>(initData, "settings.get").then((r) => {
      if (r.ok) setS(r.settings);
    });
  }, [initData]);

  if (!s) return <Spinner />;
  const set = (k: keyof BotSettings, v: string) =>
    setS((p) => (p ? { ...p, [k]: v } : p));

  async function save() {
    setSaving(true);
    const r = await adminCall<{ settings: BotSettings }>(
      initData,
      "settings.save",
      s,
    );
    setSaving(false);
    if (r.ok) {
      haptic(tg, "medium");
      showToast("Настройки бота сохранены");
    } else showToast("Ошибка: " + (r.error || ""), "error");
  }

  return (
    <div className="space-y-3">
      <label>
        <span className={lab}>Приветствие (Markdown)</span>
        <textarea
          disabled={!canEdit}
          className="field-dark min-h-[120px]"
          value={s.welcomeText}
          onChange={(e) => set("welcomeText", e.target.value)}
        />
      </label>
      <label>
        <span className={lab}>Текст кнопки «Каталог»</span>
        <input
          disabled={!canEdit}
          className="field-dark"
          value={s.catalogButtonText}
          onChange={(e) => set("catalogButtonText", e.target.value)}
        />
      </label>
      <label>
        <span className={lab}>Текст кнопки «Калькулятор»</span>
        <input
          disabled={!canEdit}
          className="field-dark"
          value={s.calcButtonText}
          onChange={(e) => set("calcButtonText", e.target.value)}
        />
      </label>
      <label>
        <span className={lab}>Текст кнопки «Квиз/подбор»</span>
        <input
          disabled={!canEdit}
          className="field-dark"
          value={s.quizButtonText ?? ""}
          onChange={(e) => set("quizButtonText", e.target.value)}
        />
      </label>
      <label>
        <span className={lab}>Текст кнопки «Менеджер»</span>
        <input
          disabled={!canEdit}
          className="field-dark"
          value={s.managerButtonText}
          onChange={(e) => set("managerButtonText", e.target.value)}
        />
      </label>
      <label>
        <span className={lab}>Ссылка на менеджера</span>
        <input
          disabled={!canEdit}
          className="field-dark"
          value={s.managerUrl}
          onChange={(e) => set("managerUrl", e.target.value)}
          placeholder="https://t.me/..."
        />
      </label>
      <label>
        <span className={lab}>Текст кнопки «Как проехать»</span>
        <input
          disabled={!canEdit}
          className="field-dark"
          value={s.mapButtonText ?? ""}
          onChange={(e) => set("mapButtonText", e.target.value)}
        />
      </label>
      <label>
        <span className={lab}>Ссылка на Яндекс.Карты (как проехать)</span>
        <input
          disabled={!canEdit}
          className="field-dark"
          value={s.mapUrl ?? ""}
          onChange={(e) => set("mapUrl", e.target.value)}
          placeholder="https://yandex.ru/maps/..."
        />
      </label>
      <p className="text-[11px] text-[#8C97A1]">
        Кнопка «Как проехать» появится в боте только когда заполнена ссылка.
      </p>
      <label>
        <span className={lab}>URL мини-аппа</span>
        <input
          disabled={!canEdit}
          className="field-dark"
          value={s.miniAppUrl || ""}
          onChange={(e) => set("miniAppUrl", e.target.value)}
          placeholder="https://avto-korea.pages.dev/tma"
        />
      </label>
      {canEdit ? (
        <button onClick={save} className="btn btn-primary w-full">
          {saving ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <Save className="h-[18px] w-[18px]" />
          )}{" "}
          Сохранить
        </button>
      ) : null}
    </div>
  );
}

/* ---------- Заявки ---------- */
function LeadsTab({ initData }: { initData: string }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  useEffect(() => {
    adminCall<{ leads: Lead[] }>(initData, "leads.list").then((r) => {
      if (r.ok) setLeads(r.leads);
      else setLeads([]);
    });
  }, [initData]);
  if (!leads) return <Spinner />;
  if (leads.length === 0)
    return (
      <p className="rounded-[16px] border border-line-dark bg-graphite-2 p-6 text-center text-[#9AA4B2]">
        Заявок пока нет.
      </p>
    );
  return (
    <div className="space-y-2.5">
      {leads.map((l, i) => (
        <div
          key={i}
          className="rounded-[16px] border border-line-dark bg-graphite-2 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold">{l.name || "—"}</span>
            <span className="text-[11px] text-[#8C97A1]">
              {new Date(l.ts).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <a
            href={`tel:${l.phone.replace(/\D/g, "")}`}
            className="font-num text-[15px] font-bold text-bordeaux-bright"
          >
            {l.phone}
          </a>
          {l.car ? (
            <div className="text-[13px] text-[#C7CFD6]">🔎 {l.car}</div>
          ) : null}
          <div className="text-[12px] text-[#8C97A1]">📍 {l.source}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Админы ---------- */
function AdminsTab({ initData }: { initData: string }) {
  const [admins, setAdmins] = useState<AdminsMap | null>(null);
  const [owners, setOwners] = useState<string[]>([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [r, setR] = useState<"manager" | "viewer">("manager");
  const lab = "block text-[11px] font-bold uppercase tracking-wide text-[#8C97A1] mb-1";

  function load() {
    adminCall<{ admins: AdminsMap; owners: string[] }>(
      initData,
      "admins.list",
    ).then((res) => {
      if (res.ok) {
        setAdmins(res.admins);
        setOwners(res.owners);
      } else setAdmins({});
    });
  }
  useEffect(load, [initData]);

  async function add() {
    if (!/^\d+$/.test(id.trim())) {
      showToast("ID — только цифры (узнать через @userinfobot)", "error");
      return;
    }
    const res = await adminCall<{ admins: AdminsMap }>(initData, "admins.set", {
      id: id.trim(),
      role: r,
      name,
    });
    if (res.ok) {
      setAdmins(res.admins);
      setId("");
      setName("");
      showToast("Админ добавлен");
    } else showToast("Ошибка: " + (res.error || ""), "error");
  }

  async function remove(uid: string) {
    const res = await adminCall<{ admins: AdminsMap }>(
      initData,
      "admins.remove",
      { id: uid },
    );
    if (res.ok) setAdmins(res.admins);
  }

  if (!admins) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-line-dark bg-graphite-2 p-3.5">
        <div className={lab}>Добавить админа</div>
        <div className="space-y-2.5">
          <input
            className="field-dark"
            inputMode="numeric"
            value={id}
            onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
            placeholder="Telegram ID (цифры)"
          />
          <input
            className="field-dark"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя (для себя)"
          />
          <div className="flex gap-2">
            {(["manager", "viewer"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setR(opt)}
                className={`flex-1 rounded-full border px-3 py-2 text-[13px] font-bold ${
                  r === opt
                    ? "border-bordeaux-bright bg-bordeaux text-white"
                    : "border-line-dark text-chrome"
                }`}
              >
                {opt === "manager" ? "Менеджер" : "Наблюдатель"}
              </button>
            ))}
          </div>
          <button onClick={add} className="btn btn-primary w-full">
            <Plus className="h-[18px] w-[18px]" /> Добавить
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#8C97A1]">
          Менеджер — правит каталог и тексты бота. Наблюдатель — видит заявки.
        </p>
      </div>

      <div>
        <div className={lab}>Владельцы (из настроек воркера)</div>
        <div className="space-y-2">
          {owners.length === 0 ? (
            <p className="text-[13px] text-[#8C97A1]">
              Не заданы. Добавьте ADMIN_IDS в переменные воркера.
            </p>
          ) : (
            owners.map((o) => (
              <div
                key={o}
                className="flex items-center justify-between rounded-[14px] border border-line-dark bg-graphite-2 px-3.5 py-2.5"
              >
                <span className="font-num">{o}</span>
                <span className="rounded-full border border-line-dark px-2 py-0.5 text-[11px] font-bold uppercase text-chrome">
                  owner
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className={lab}>Добавленные админы</div>
        <div className="space-y-2">
          {Object.keys(admins).length === 0 ? (
            <p className="text-[13px] text-[#8C97A1]">Пока никого.</p>
          ) : (
            Object.entries(admins).map(([uid, a]) => (
              <div
                key={uid}
                className="flex items-center gap-2 rounded-[14px] border border-line-dark bg-graphite-2 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">
                    {a.name || "—"}{" "}
                    <span className="font-num text-[12px] text-[#8C97A1]">
                      #{uid}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold uppercase text-chrome">
                    {a.role === "manager" ? "менеджер" : "наблюдатель"}
                  </span>
                </div>
                <button
                  onClick={() => remove(uid)}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line-dark text-bordeaux-bright"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10 text-chrome">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
