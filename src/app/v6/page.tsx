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
import { ReelV6 } from "@/components/v6/ReelV6";
import { ribbonRoute } from "@/components/v6/ribbonRoute";
import { SmoothScroll } from "@/components/v6/SmoothScroll";
import { WorldV6 } from "@/components/v6/WorldV6";

export const metadata: Metadata = {
  title: "Seven Hills of Kazakhstan — версия 6",
  robots: { index: false },
};

/**
 * /v6 — основа /v5, но глобус всегда в космосе, в любой теме: перед ним «взлёт» (небо темнеет
 * с высотой, зажигаются звёзды), после — «посадка» в Астану, сборка логотипа и обратно на светлую страницу.
 * Вступление и ролик — как у lusion: лента за заголовком, плавная прокрутка с «захватом» раскрытия
 * ролика, SEVEN «7» HILLS сходятся, как PLAY ▶ REEL.
 */
export default function V6Page() {
  return (
    <PageGL ribbon={ribbonRoute}>
      <HeaderV6 />
      <SmoothScroll />
      <main>
        <HeroV3 />
        <IntroV6 />
        <ReelV6 />
        <NumbersV3 sheet />
        <ProductsV4 form="points" />
        <DirectionsV3 />
        <FactsV3 />
        <WorldV6 />
        <Contact />
      </main>
    </PageGL>
  );
}
