import type { Metadata } from "next";

import { Contact } from "@/components/sections/Contact";
import { PageGL } from "@/components/v3/gl/PageGL";
import { HeaderV3 } from "@/components/v3/HeaderV3";
import { HeroV3 } from "@/components/v3/hero/HeroV3";
import { DirectionsV3 } from "@/components/v3/sections/DirectionsV3";
import { FactsV3 } from "@/components/v3/sections/FactsV3";
import { IntroV3 } from "@/components/v3/sections/IntroV3";
import { NumbersV3 } from "@/components/v3/sections/NumbersV3";
import { OutroV3 } from "@/components/v3/sections/OutroV3";
import { ReelV3 } from "@/components/v3/sections/ReelV3";
import { WorldV3 } from "@/components/v3/sections/WorldV3";
import { ProductsV4 } from "@/components/v4/ProductsV4";
import { ribbonRoute } from "@/components/v4/ribbonRoute";

export const metadata: Metadata = {
  title: "Seven Hills of Kazakhstan — версия 5",
  robots: { index: false },
};

/** /v5 — это /v4, но форма за списком продуктов собрана из частиц (облака точек с моделей Blender). */
export default function V5Page() {
  return (
    <PageGL ribbon={ribbonRoute}>
      <HeaderV3 />
      <main>
        <HeroV3 />
        <IntroV3 />
        <ReelV3 />
        <NumbersV3 sheet />
        <ProductsV4 form="points" />
        <DirectionsV3 />
        <FactsV3 />
        <WorldV3 />
        <OutroV3 />
        <Contact />
      </main>
    </PageGL>
  );
}
