import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { Advantages } from "@/components/sections/Advantages";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Catalog } from "@/components/sections/Catalog";
import { Calculator } from "@/components/sections/Calculator";
import { Geography } from "@/components/sections/Geography";
import { Reviews } from "@/components/sections/Reviews";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/sections/Footer";
import { FloatingTelegram } from "@/components/FloatingTelegram";
import { Toaster } from "@/components/ui/Toaster";
import { site } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  name: site.name,
  description: site.description,
  url: site.url,
  telephone: site.phoneHref.replace("tel:", ""),
  areaServed: "RU",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Тверь",
    addressCountry: "RU",
  },
  sameAs: [site.telegramHref],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main>
        <Hero />
        <Advantages />
        <HowItWorks />
        <Catalog />
        <Calculator />
        <Geography />
        <Reviews />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <FloatingTelegram />
      <Toaster />
    </>
  );
}
