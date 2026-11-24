import type { Metadata } from "next";

import { Contact } from "@/components/sections/Contact";
import { PageGL } from "@/components/v3/gl/PageGL";
import { HeroV3 } from "@/components/v3/hero/HeroV3";
import { DirectionsV3 } from "@/components/v3/sections/DirectionsV3";
import { FactsV3 } from "@/components/v3/sections/FactsV3";
import { NumbersV3 } from "@/components/v3/sections/NumbersV3";
import { ProductsV4 } from "@/components/v4/ProductsV4";
import { HeaderV6 } from "@/components/v6/HeaderV6";
import { IntroV6 } from "@/components/v6/IntroV6";
import { PartnersLoop } from "@/components/v6/PartnersLoop";
import { ReelV6 } from "@/components/v6/ReelV6";
import { ribbonRoute } from "@/components/v6/ribbonRoute";
import { SmoothScroll } from "@/components/v6/SmoothScroll";
import { WorldV6 } from "@/components/v6/WorldV6";

export const metadata: Metadata = {
  title: "Seven Hills of Kazakhstan — версия 7",
  robots: { index: false },
};

/**
 * /v7 — копия /v6, другой только первый экран: в переключателе «Знак» и «Глобус» (облёт Казахстана:
 * лента из частиц собирается в продукты, в финале — в логотип). У знака фон по умолчанию — Floating Lines.
 */
export default function V7Page() {
  return (
    <PageGL ribbon={ribbonRoute}>
      <HeaderV6 />
      <SmoothScroll />
      <main>
        <HeroV3 globe storageKey="v7-hero-bg" defaultBackdrop="floatingLines" />
        <IntroV6 />
        <ReelV6 />
        <NumbersV3 sheet />
        <ProductsV4 form="points" />
        <DirectionsV3 />
        <FactsV3 vendors={<PartnersLoop />} />
        <WorldV6 />
        <Contact />
      </main>
    </PageGL>
  );
}
