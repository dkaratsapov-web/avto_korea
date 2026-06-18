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
} from "lucide-react";
import { useCars } from "@/lib/carsStore";
import { type Car, type CarStatus, formatPrice } from "@/data/cars";
import { countries, type CountryCode } from "@/lib/site";
import { Flag } from "@/components/icons/Flag";
import { showToast } from "@/lib/toast";
import {
  adminCall,
  type AdminRole,
  type BotSettings,
  type Lead,
  type AdminsMap,
} from "@/lib/api";
import { haptic, type TG } from "@/lib/telegram";

type Tab = "catalog" | "bot" | "leads" | "admins";

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
    { id: "bot", label: "Бот", icon: Bot, min: 1 },
    { id: "leads", label: "Заявки", icon: Inbox, min: 0 },
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

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs
          .filter((t) => (t.id === "admins" ? rank >= 3 : true))
          .map((t) => (
            <button
              key={t.id}
              onClick={() => {
                haptic(tg);
                setTab(t.id);
              }}
              className={`flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold ${
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
      {tab === "bot" ? (
        <BotTab tg={tg} initData={initData} canEdit={rank >= 2} />
      ) : null}
      {tab === "leads" ? <LeadsTab initData={initData} /> : null}
      {tab === "admins" && rank >= 3 ? <AdminsTab initData={initData} /> : null}
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
