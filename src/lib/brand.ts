/**
 * Марка автомобиля из названия модели.
 *
 * Названия приходят из постов канала, где их пишут руками, поэтому одна и та же
 * марка встречается в нескольких видах: «KIA» и «Kia», «Mercedes», «Mercedes-Benz»
 * и «Mercedes-benz», «Hyunday» вместо «Hyundai». Иногда марка слипается с моделью:
 * «AudiQ5», «Mazda-Cx5», «VWT-Roc».
 *
 * Раньше маркой считалось первое слово названия как есть — и в фильтре каталога
 * появлялись «Audi», «AudiQ5» и «AudiQ7» тремя разными пунктами. Выбрав «Audi»,
 * покупатель терял половину машин этой марки и не мог понять почему.
 *
 * Здесь название сверяется со справочником: сравнение идёт без учёта регистра,
 * пробелов и дефисов, и по самому длинному совпадению — иначе «Lincoln» опознался
 * бы как «Linc», а «Mercedes-Benz» как «Mercedes».
 *
 * Незнакомая марка возвращается как есть: лучше показать её отдельным пунктом,
 * чем приписать чужому бренду.
 */

/**
 * Справочник марок. Ключ — как показываем, значения — как встречалось в постах.
 *
 * Каноническое написание выбрано по тому, как марку пишет сам владелец: «VW»,
 * а не «Volkswagen», потому что именно так подписаны карточки в канале.
 */
const BRANDS: Record<string, string[]> = {
  Audi: [],
  BMW: [],
  Changan: [],
  Chery: ["cherry"],
  Chevrolet: [],
  Citroen: ["citroën"],
  Exeed: [],
  Ford: [],
  GAC: [],
  Geely: [],
  Genesis: [],
  Haval: [],
  Honda: [],
  Hongqi: [],
  // Опечатка встречается в постах регулярно.
  Hyundai: ["hyunday", "hyndai"],
  Infiniti: ["infinity"],
  Jaecoo: [],
  Jeep: [],
  Jetour: [],
  // «VJetta» — слипшееся «VW Jetta»: отдельной марки с таким именем не бывает.
  Jetta: ["vjetta"],
  Kia: [],
  "Land Rover": ["landrover"],
  Lexus: [],
  // «Linc» — усечённое написание, отдельной марки «Linc» не существует.
  Lincoln: ["linc"],
  "Li Auto": ["liauto", "lixiang"],
  "Lynk & Co": ["lynkco", "lynk"],
  Mazda: [],
  // Одна марка, три написания в постах.
  "Mercedes-Benz": ["mercedes", "mercedesbenz"],
  Mini: [],
  Mitsubishi: [],
  Nissan: [],
  Omoda: [],
  Peugeot: [],
  Porsche: [],
  Renault: [],
  Skoda: ["škoda"],
  Subaru: [],
  Suzuki: [],
  Tank: [],
  Tesla: [],
  Toyota: [],
  Volvo: [],
  Voyah: [],
  VW: ["volkswagen"],
  Xpeng: [],
  Zeekr: [],
};

/**
 * Русские буквы, неотличимые на глаз от латинских. Посты набирают на русской
 * раскладке, и «НYUNDAI» с русской «Н» для программы — другая марка: в фильтре
 * каталога Hyundai стоял тремя пунктами.
 */
const HOMOGLYPHS: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p",
  с: "c", т: "t", у: "y", х: "x", і: "i",
};

/** Латиница вместо русских двойников — только в словах, где есть латиница. */
function delatinize(word: string): string {
  if (!/[a-z]/i.test(word)) return word;
  return word.replace(/[авеёкмнорстухі]/gi, (ch) => {
    const lat = HOMOGLYPHS[ch.toLowerCase()];
    return ch === ch.toLowerCase() ? lat : lat.toUpperCase();
  });
}

/** Сравнимый вид: без регистра, пробелов, дефисов и точек. */
function key(value: string): string {
  return delatinize(value).toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
}

/**
 * Таблица «ключ → каноническое имя», отсортированная от длинных ключей
 * к коротким. Порядок важен: по короткому ключу «linc» совпал бы и Lincoln.
 */
const LOOKUP: [string, string][] = Object.entries(BRANDS)
  .flatMap(([canonical, aliases]) =>
    [canonical, ...aliases].map((name) => [key(name), canonical] as [string, string]),
  )
  .sort((a, b) => b[0].length - a[0].length);

/** Марка по названию модели. */
export function brandOf(model: string): string {
  const raw = String(model ?? "").trim();
  if (raw === "") {
    return "";
  }

  const flat = key(raw);
  for (const [alias, canonical] of LOOKUP) {
    if (flat.startsWith(alias)) {
      return canonical;
    }
  }

  // Незнакомая марка: первое слово, но в одном написании — иначе «ZEEKR» и
  // «Zeekr» стали бы двумя пунктами фильтра. Короткие (BYD, GMC) — заглавными.
  const word = delatinize(raw.split(/\s+/)[0]);
  if (word.length <= 3) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
