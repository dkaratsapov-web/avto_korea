import type { CountryCode } from "@/lib/site";

export type CarStatus = "in_stock" | "in_transit" | "on_order";

export type Car = {
  id: string;
  model: string;
  year: number;
  country: CountryCode;
  engine: string;
  mileage: string;
  gearbox: string;
  drive: string;
  /** Цена под ключ в рублях. Форматируется как «4 290 000 ₽». */
  priceRub: number;
  status: CarStatus;
  /** Фото авто; если нет — рисуем SVG-силуэт. TODO: заменить на реальные фото заказчика. */
  image?: string;
};

export const statusLabels: Record<CarStatus, string> = {
  in_stock: "В наличии",
  in_transit: "В пути",
  on_order: "Под заказ",
};

/**
 * Демо-витрина (из макета diauto69_site.html).
 * TODO: заменить на актуальную базу авто заказчика / вынести в CMS.
 */
export const cars: Car[] = [
  {
    id: "hyundai-palisade-2022",
    model: "Hyundai Palisade",
    year: 2022,
    country: "kr",
    engine: "3.8 V6 · бензин",
    mileage: "42 000 км",
    gearbox: "АКПП",
    drive: "4WD",
    priceRub: 4_290_000,
    status: "in_stock",
  },
  {
    id: "kia-sorento-2023",
    model: "Kia Sorento",
    year: 2023,
    country: "kr",
    engine: "2.5T · бензин",
    mileage: "28 000 км",
    gearbox: "АКПП",
    drive: "4WD",
    priceRub: 3_750_000,
    status: "in_stock",
  },
  {
    id: "zeekr-001-2023",
    model: "Zeekr 001",
    year: 2023,
    country: "cn",
    engine: "Электро · 100 кВт·ч",
    mileage: "19 000 км",
    gearbox: "1-ст.",
    drive: "AWD",
    priceRub: 4_950_000,
    status: "in_transit",
  },
  {
    id: "li-auto-l7-2023",
    model: "Li Auto L7",
    year: 2023,
    country: "cn",
    engine: "Гибрид · 1.5T",
    mileage: "24 000 км",
    gearbox: "АКПП",
    drive: "AWD",
    priceRub: 5_350_000,
    status: "in_transit",
  },
  {
    id: "toyota-lc-prado-2021",
    model: "Toyota LC Prado",
    year: 2021,
    country: "jp",
    engine: "2.8 TD · дизель",
    mileage: "61 000 км",
    gearbox: "АКПП",
    drive: "4WD",
    priceRub: 5_690_000,
    status: "in_stock",
  },
  {
    id: "bmw-x5-xdrive40i-2022",
    model: "BMW X5 xDrive40i",
    year: 2022,
    country: "eu",
    engine: "3.0 · бензин",
    mileage: "38 000 км",
    gearbox: "АКПП",
    drive: "AWD",
    priceRub: 7_250_000,
    status: "on_order",
  },
  {
    id: "genesis-gv80-2023",
    model: "Genesis GV80",
    year: 2023,
    country: "kr",
    engine: "3.5T V6 · бензин",
    mileage: "21 000 км",
    gearbox: "АКПП",
    drive: "AWD",
    priceRub: 6_150_000,
    status: "in_transit",
  },
  {
    id: "byd-tang-2023",
    model: "BYD Tang",
    year: 2023,
    country: "cn",
    engine: "Электро · 108 кВт·ч",
    mileage: "15 000 км",
    gearbox: "1-ст.",
    drive: "AWD",
    priceRub: 4_350_000,
    status: "on_order",
  },
  {
    id: "lexus-rx350-2022",
    model: "Lexus RX 350",
    year: 2022,
    country: "jp",
    engine: "2.4T · бензин",
    mileage: "33 000 км",
    gearbox: "АКПП",
    drive: "AWD",
    priceRub: 6_490_000,
    status: "in_stock",
  },
];

/** «4 290 000 ₽» — неразрывные пробелы между разрядами. */
export function formatPrice(rub: number): string {
  return new Intl.NumberFormat("ru-RU").format(rub).replace(/\s/g, " ");
}
