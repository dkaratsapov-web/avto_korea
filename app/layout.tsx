import type { Metadata, Viewport } from "next";
import { Saira_Condensed, Saira, Manrope } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const sairaCondensed = Saira_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const saira = Saira({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-num",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  keywords: [
    "авто из Кореи",
    "авто из Китая",
    "авто из Японии",
    "импорт авто под ключ",
    "автоподбор",
    "растаможка авто",
    "ДиАвто69",
    "Тверь",
  ],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#11151A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      className={`${sairaCondensed.variable} ${saira.variable} ${manrope.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
