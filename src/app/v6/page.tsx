import type { Metadata } from "next";

import { Contact } from "@/components/sections/Contact";
import { PageGL } from "@/components/v3/gl/PageGL";
import { HeroV3 } from "@/components/v3/hero/HeroV3";
import { DirectionsV3 } from "@/components/v3/sections/DirectionsV3";
import { FactsV3 } from "@/components/v3/sections/FactsV3";
import { NumbersV3 } from "@/components/v3/sections/NumbersV3";
import { OutroV3 } from "@/components/v3/sections/OutroV3";
import { ReelV3 } from "@/components/v3/sections/ReelV3";
import { ProductsV4 } from "@/components/v4/ProductsV4";
import { HeaderV6 } from "@/components/v6/HeaderV6";
import { IntroV6 } from "@/components/v6/IntroV6";
import { ribbonRoute } from "@/components/v6/ribbonRoute";
import { WorldV6 } from "@/components/v6/WorldV6";

export const metadata: Metadata = {
  title: "Seven Hills of Kazakhstan — версия 6",
  robots: { index: false },
};

/**
 * /v6 — основа /v5, но глобус всегда в космосе, в любой теме: перед ним «взлёт» (небо темнеет
 * с высотой, зажигаются звёзды), после — «посадка» в Астану и обратно на светлую страницу к знаку «7».
 */
export default function V6Page() {
  return (
    <PageGL ribbon={ribbonRoute}>
      <HeaderV6 />
      <main>
        <HeroV3 />
        <IntroV6 />
        <ReelV3 />
        <NumbersV3 sheet />
        <ProductsV4 form="points" />
        <DirectionsV3 />
        <FactsV3 />
        <WorldV6 />
        <OutroV3 />
        <Contact />
      </main>
    </PageGL>
  );
}
