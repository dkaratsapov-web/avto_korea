import type { CountryCode } from "@/lib/site";

export type CarStatus = "in_stock" | "in_transit" | "on_order";

export type Car = {
  id: string;
  model: string;
  year: number;
  country: CountryCode;
  engine: string;
  trim: string;
  mileage: string;
  gearbox: string;
  drive: string;
  /** Основная цена под ключ (до Твери), ₽. */
  priceRub: number;
  priceMoscowRub?: number;
  priceTverRub?: number;
  status: CarStatus;
  isNew?: boolean;
  images: string[];
  highlights: string[];
};

export const statusLabels: Record<CarStatus, string> = {
  in_stock: "В наличии",
  in_transit: "В пути",
  on_order: "Под заказ",
};

// Пути к фото с учётом base (GitHub Pages /avto_korea/).
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

export const cars: Car[] = [
  {
    id: "vw-tharu-xr",
    model: "VW Tharu XR",
    year: 2025,
    country: "cn",
    engine: "1.5 л · 110 л.с.",
    trim: "Sharp Edition",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Передний",
    priceRub: 2_070_000,
    priceMoscowRub: 2_050_000,
    priceTverRub: 2_070_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6].map((n) => asset(`cars/tharu/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 0 км",
      "Комплектация Sharp Edition",
      "Двигатель 1.5 л, 110 л.с., АКПП",
      "Цена до Москвы — 2 050 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 2 070 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
  {
    id: "kia-k3-2026",
    model: "Kia K3",
    year: 2026,
    country: "kr",
    engine: "1.5 л · 115 л.с.",
    trim: "Comfort Edition",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Передний",
    priceRub: 1_800_000,
    priceMoscowRub: 1_780_000,
    priceTverRub: 1_800_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6, 7].map((n) => asset(`cars/k3/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Комплектация Comfort Edition",
      "Двигатель 1.5 л, 115 л.с., АКПП",
      "Цена до Москвы — 1 780 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 1 800 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
];

/** «2 070 000» — формат с разрядами. */
export function formatPrice(rub: number): string {
  return new Intl.NumberFormat("ru-RU").format(rub);
}
