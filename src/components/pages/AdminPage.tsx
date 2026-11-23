import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  LogOut,
  Save,
  X,
} from "lucide-react";
import { useCars } from "@/lib/carsStore";
import { type Car, type CarStatus, formatPrice } from "@/data/cars";
import { countries, type CountryCode } from "@/lib/site";
import { Flag } from "@/components/icons/Flag";
import { displayPrice } from "@/lib/price";

// Пароль задаётся только через переменную окружения. Без неё веб-админка
// закрыта — управление каталогом перенесено в Telegram-бота (по подписи).
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS as string | undefined;
const AUTH_KEY = "diauto:admin";

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

export function AdminPage() {
  const [authed, setAuthed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(AUTH_KEY) === "1",
  );
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);

  // Без заданного пароля веб-админка закрыта: управление — в Telegram-боте.
  if (!ADMIN_PASS) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-graphite px-6 pt-20">
        <div className="glass w-full max-w-sm rounded-card p-7 text-center text-white">
          <h1 className="text-[22px] font-extrabold uppercase">Админка в боте</h1>
          <p className="mb-5 mt-2 text-[13px] text-[#9AA4B2]">
            Управление каталогом, настройками и заявками перенесено в
            Telegram-бота (вход по вашему аккаунту, без паролей).
          </p>
          <a href="https://t.me/DI_AVTO_69_BOT" className="btn btn-primary w-full">
            Открыть бота
          </a>
          <Link
            to="/"
            className="mt-4 block text-center text-[13px] text-chrome hover:text-white"
          >
            ← На сайт
          </Link>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-graphite px-6 pt-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pass === ADMIN_PASS) {
              window.sessionStorage.setItem(AUTH_KEY, "1");
              setAuthed(true);
            } else setErr(true);
          }}
          className="glass w-full max-w-sm rounded-card p-7 text-white"
        >
          <h1 className="text-[24px] font-extrabold uppercase">Админ-панель</h1>
          <p className="mb-5 mt-1 text-[13px] text-[#9AA4B2]">
            Введите пароль для доступа к управлению каталогом.
          </p>
          <input
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setErr(false);
            }}
            placeholder="Пароль"
            className="field-dark"
            autoFocus
          />
          {err ? (
            <p className="mt-2 text-[13px] text-bordeaux-bright">Неверный пароль</p>
          ) : null}
          <button type="submit" className="btn btn-primary mt-4 w-full">
            Войти
          </button>
          <Link
            to="/"
            className="mt-4 block text-center text-[13px] text-chrome hover:text-white"
          >
            ← На сайт
          </Link>
        </form>
      </main>
    );
  }

  return <AdminPanel onLogout={() => {
    window.sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  }} />;
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const { cars, upsert, remove, reset, setAll, isCustom } = useCars();
  const [editing, setEditing] = useState<Car | null>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(cars, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cars.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Car[];
        if (Array.isArray(data)) setAll(data);
      } catch {
        alert("Не удалось прочитать JSON");
      }
    };
    reader.readAsText(file);
  }

  return (
    <main className="min-h-screen bg-paper pb-24 pt-[100px]">
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.16em] text-bordeaux">
              <span className="slash" aria-hidden /> Админ · каталог
            </div>
            <h1 className="text-[clamp(28px,4vw,44px)] text-ink">
              Управление наличием
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(emptyCar())} className="btn btn-primary">
              <Plus className="h-[18px] w-[18px]" /> Добавить авто
            </button>
            <button onClick={exportJson} className="btn btn-ghost btn-ghost-light">
              <Download className="h-[18px] w-[18px]" /> Экспорт
            </button>
            <label className="btn btn-ghost btn-ghost-light cursor-pointer">
              <Upload className="h-[18px] w-[18px]" /> Импорт
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && importJson(e.target.files[0])
                }
              />
            </label>
            <button
              onClick={() => {
                if (confirm("Сбросить каталог к стандартному?")) reset();
              }}
              className="btn btn-ghost btn-ghost-light"
            >
              <RotateCcw className="h-[18px] w-[18px]" /> Сброс
            </button>
            <button onClick={onLogout} className="btn btn-ghost btn-ghost-light">
              <LogOut className="h-[18px] w-[18px]" /> Выйти
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-card border border-bordeaux/20 bg-bordeaux/[0.05] p-4 text-[13.5px] text-ink-2">
          <b className="text-ink">Как это работает:</b> сайт статический, поэтому
          изменения сохраняются <b>в этом браузере</b> и сразу видны на главной и
          в каталоге.{" "}
          {isCustom ? (
            <span className="font-semibold text-bordeaux">
              Каталог изменён (локально).
            </span>
          ) : (
            "Сейчас показан стандартный каталог."
          )}{" "}
          Чтобы опубликовать для всех — «Экспорт» → передайте файл
          разработчику (или подключим CMS/бэкенд).
        </div>

        {editing ? (
          <CarEditor
            key={editing.id || "new"}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={(car) => {
              upsert(car);
              setEditing(null);
            }}
          />
        ) : null}

        {/* Список */}
        <div className="mt-6 space-y-3">
          {cars.map((car) => (
            <div
              key={car.id}
              className="flex items-center gap-4 rounded-card border border-line bg-white p-3"
            >
              <div className="h-16 w-24 flex-none overflow-hidden rounded-[10px] bg-graphite">
                {car.images[0] ? (
                  // eslint-disable-next-line
                  <img
                    src={car.images[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <Flag code={car.country} className="h-3.5 w-5" />
                  <span className="truncate">{car.model}</span>
                </div>
                <div className="text-[13px] text-ink-2">
                  {car.year} · {car.trim || "—"} · {car.engine}
                </div>
                <div className="font-num text-[15px] font-bold text-bordeaux">
                  {formatPrice(displayPrice(car))} ₽
                </div>
              </div>
              <button
                onClick={() => setEditing(car)}
                aria-label="Редактировать"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-2 transition-colors hover:border-graphite hover:text-ink"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Удалить «${car.model}»?`)) remove(car.id);
                }}
                aria-label="Удалить"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-2 transition-colors hover:border-bordeaux hover:text-bordeaux"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {cars.length === 0 ? (
            <p className="rounded-card border border-line bg-white px-6 py-10 text-center text-ink-2">
              Каталог пуст. Нажмите «Добавить авто».
            </p>
          ) : null}
        </div>
      </div>
    </main>
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = f.id || slug(f.model);
    /*
     * Общая цена повторяет московскую: сайт показывает именно её, а
     * priceRub остаётся запасным путём для машин, у которых московской
     * цены нет. Раньше сюда копировалась тверская — с тех пор как показ
     * переехал на Москву, это давало расхождение между админкой и сайтом.
     */
    const priceMsk = f.priceMoscowRub || f.priceRub || 0;
    onSave({ ...f, id, priceRub: priceMsk, priceMoscowRub: priceMsk });
  }

  const inp =
    "w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none focus:border-bordeaux";
  const lab = "block text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2 mb-1.5";

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-card border-2 border-bordeaux/30 bg-white p-5 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-extrabold uppercase text-ink">
          {initial.id ? "Редактирование" : "Новое авто"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-2 hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={lab}>Модель</span>
          <input
            className={inp}
            value={f.model}
            onChange={(e) => set("model", e.target.value)}
            required
          />
        </label>
        <label>
          <span className={lab}>Год</span>
          <input
            type="number"
            className={inp}
            value={f.year}
            onChange={(e) => set("year", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Страна</span>
          <select
            className={inp}
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
            className={inp}
            value={f.engine}
            onChange={(e) => set("engine", e.target.value)}
            placeholder="1.5 л · 115 л.с."
          />
        </label>
        <label>
          <span className={lab}>Комплектация</span>
          <input
            className={inp}
            value={f.trim}
            onChange={(e) => set("trim", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Тип кузова</span>
          <input
            className={inp}
            value={f.bodyType ?? ""}
            onChange={(e) => set("bodyType", e.target.value)}
            placeholder="Кроссовер / Седан…"
          />
        </label>
        <label>
          <span className={lab}>Тип топлива</span>
          <select
            className={inp}
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
            className={inp}
            value={f.engineCc ?? 0}
            onChange={(e) => set("engineCc", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Мощность, л.с.</span>
          <input
            type="number"
            className={inp}
            value={f.powerHp ?? 0}
            onChange={(e) => set("powerHp", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Цвет</span>
          <input
            className={inp}
            value={f.color ?? ""}
            onChange={(e) => set("color", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Пробег (текст)</span>
          <input
            className={inp}
            value={f.mileage}
            onChange={(e) => set("mileage", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Пробег, км (число)</span>
          <input
            type="number"
            className={inp}
            value={f.mileageKm ?? 0}
            onChange={(e) => set("mileageKm", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Коробка</span>
          <input
            className={inp}
            value={f.gearbox}
            onChange={(e) => set("gearbox", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Привод</span>
          <input
            className={inp}
            value={f.drive}
            onChange={(e) => set("drive", e.target.value)}
          />
        </label>
        <label>
          <span className={lab}>Статус</span>
          <select
            className={inp}
            value={f.status}
            onChange={(e) => set("status", e.target.value as CarStatus)}
          >
            <option value="in_stock">В наличии</option>
            <option value="in_transit">В пути</option>
            <option value="on_order">Под заказ</option>
          </select>
        </label>
        <label>
          <span className={lab}>Цена до Москвы, ₽ — её показывает сайт</span>
          <input
            type="number"
            className={inp}
            value={f.priceMoscowRub || 0}
            onChange={(e) => set("priceMoscowRub", Number(e.target.value))}
          />
        </label>
        <label>
          <span className={lab}>Цена до Твери, ₽ — не показывается, для расчётов</span>
          <input
            type="number"
            className={inp}
            value={f.priceTverRub || 0}
            onChange={(e) => set("priceTverRub", Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={!!f.isNew}
            onChange={(e) => set("isNew", e.target.checked)}
            className="h-4 w-4 accent-bordeaux"
          />
          <span className="text-[14px] font-semibold text-ink">
            Новинка (бейдж на карточке)
          </span>
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Фото (по одной ссылке в строке)</span>
          <textarea
            className={`${inp} min-h-[90px] font-mono text-[12.5px]`}
            value={f.images.join("\n")}
            onChange={(e) =>
              set(
                "images",
                e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              )
            }
            placeholder="/avto_korea/cars/.../1.jpg"
          />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Описание (по пункту в строке)</span>
          <textarea
            className={`${inp} min-h-[90px]`}
            value={f.highlights.join("\n")}
            onChange={(e) =>
              set(
                "highlights",
                e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              )
            }
          />
        </label>
      </div>

      <div className="mt-5 flex gap-3">
        <button type="submit" className="btn btn-primary">
          <Save className="h-[18px] w-[18px]" /> Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost btn-ghost-light"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
