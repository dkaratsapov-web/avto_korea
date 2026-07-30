import type { Car } from "@/data/cars";

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Латиница, цифры и дефисы — пригодно для адреса страницы. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Адрес карточки авто. Хвост из id гарантирует уникальность: у двух машин
 * одной модели и года совпали бы модель, год и комплектация.
 */
export function carSlug(car: Car): string {
  const base = slugify(
    [car.model, car.year, car.trim].filter(Boolean).join(" "),
  );
  const tail = slugify(car.id).slice(-6) || "auto";
  return `${base || "avto"}-${tail}`;
}

export function carPath(car: Car): string {
  return `/catalog/${carSlug(car)}`;
}

export function findCarBySlug(cars: Car[], slug: string): Car | undefined {
  return cars.find((c) => carSlug(c) === slug);
}
