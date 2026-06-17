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
  {
    id: "vw-teramont-pro",
    model: "VW Teramont Pro 450TSI",
    year: 2026,
    country: "cn",
    engine: "2.0T · 272 л.с.",
    trim: "Максимальная",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Полный",
    priceRub: 5_430_000,
    priceMoscowRub: 5_400_000,
    priceTverRub: 5_430_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => asset(`cars/teramont/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Максимальная комплектация · 450TSI",
      "Двигатель 2.0T, 272 л.с., АКПП, полный привод",
      "Цена до Москвы — 5 400 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 5 430 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
  {
    id: "kia-k3-luxury",
    model: "Kia K3",
    year: 2026,
    country: "kr",
    engine: "1.5 л · 115 л.с.",
    trim: "Luxury Smart",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Передний",
    priceRub: 1_970_000,
    priceMoscowRub: 1_950_000,
    priceTverRub: 1_970_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => asset(`cars/kia-k3-luxury/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Максимальная комплектация Luxury Smart",
      "Цвета: чёрный / серый",
      "Двигатель 1.5 л, 115 л.с., АКПП",
      "Цена до Москвы — 1 950 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 1 970 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
  {
    id: "jetta-vs7",
    model: "Jetta VS7",
    year: 2026,
    country: "cn",
    engine: "1.4T · 150 л.с.",
    trim: "Glory Edition",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Передний",
    priceRub: 2_100_000,
    priceMoscowRub: 2_080_000,
    priceTverRub: 2_100_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6].map((n) => asset(`cars/jetta-vs7/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Комплектация Glory Edition",
      "Двигатель 1.4T, 150 л.с., АКПП",
      "Цена до Москвы — 2 080 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 2 100 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
  {
    id: "geely-emgrand",
    model: "Geely Emgrand",
    year: 2026,
    country: "cn",
    engine: "1.5 л · 120 л.с.",
    trim: "Luxury",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Передний",
    priceRub: 1_740_000,
    priceMoscowRub: 1_720_000,
    priceTverRub: 1_740_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6, 7].map((n) => asset(`cars/geely-emgrand/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Комплектация Luxury",
      "Двигатель 1.5 л, 120 л.с., АКПП",
      "Цена до Москвы — 1 720 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 1 740 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
  {
    id: "hyundai-elantra",
    model: "Hyundai Elantra",
    year: 2026,
    country: "kr",
    engine: "1.5 л · 115 л.с.",
    trim: "Premium",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Передний",
    priceRub: 1_970_000,
    priceMoscowRub: 1_950_000,
    priceTverRub: 1_970_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6, 7].map((n) => asset(`cars/hyundai-elantra/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Комплектация Premium",
      "Двигатель 1.5 л, 115 л.с., АКПП",
      "Цена до Москвы — 1 950 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 1 970 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
  {
    id: "jetta-vs5",
    model: "Jetta VS5",
    year: 2026,
    country: "cn",
    engine: "1.4T · 150 л.с.",
    trim: "Comfort",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Передний",
    priceRub: 1_960_000,
    priceMoscowRub: 1_940_000,
    priceTverRub: 1_960_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6].map((n) => asset(`cars/jetta-vs5/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Двигатель 1.4T, 150 л.с., АКПП",
      "Цена до Москвы — 1 940 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 1 960 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
  {
    id: "jetta-vs5-pioneer",
    model: "Jetta VS5",
    year: 2026,
    country: "cn",
    engine: "1.4T · 150 л.с.",
    trim: "Pioneer Edition",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Передний",
    priceRub: 1_820_000,
    priceMoscowRub: 1_800_000,
    priceTverRub: 1_820_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6].map((n) => asset(`cars/jetta-vs5-pioner/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Комплектация Pioneer Edition",
      "Двигатель 1.4T, 150 л.с., АКПП",
      "Цена до Москвы — 1 800 000 ₽ (с утильсбором и ЭПТС)",
      "Цена до Твери — 1 820 000 ₽ (с утильсбором и ЭПТС)",
    ],
  },
  {
    id: "toyota-rav4",
    model: "Toyota RAV4",
    year: 2026,
    country: "jp",
    engine: "2.0T · 171 л.с.",
    trim: "Deluxe Edition",
    mileage: "Новый, 0 км",
    gearbox: "АКПП",
    drive: "Полный",
    priceRub: 3_990_000,
    priceMoscowRub: 3_970_000,
    priceTverRub: 3_990_000,
    status: "in_stock",
    isNew: true,
    images: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => asset(`cars/toyota-rav4/${n}.jpg`)),
    highlights: [
      "Новый автомобиль, 2026 года, 0 км",
      "Максимальная комплектация Deluxe Edition",
      "Двигатель 2.0T, 171 л.с., АКПП, полный привод",
      "Быстрая доставка 15–20 дней",
      "Цена до Москвы — 3 970 000 ₽ (с коммерческим утильсбором и ЭПТС)",
      "Цена до Твери — 3 990 000 ₽ (с коммерческим утильсбором и ЭПТС)",
    ],
  },
];

/** «2 070 000» — формат с разрядами. */
export function formatPrice(rub: number): string {
  return new Intl.NumberFormat("ru-RU").format(rub);
}
