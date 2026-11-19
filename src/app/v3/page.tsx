import type { Metadata } from "next";

import { Contact } from "@/components/sections/Contact";
import { NumbersV3 } from "@/components/v3/sections/NumbersV3";
import { PageGL } from "@/components/v3/gl/PageGL";
import { HeaderV3 } from "@/components/v3/HeaderV3";
import { HeroV3 } from "@/components/v3/hero/HeroV3";
import { ribbonRoute } from "@/components/v3/ribbonRoute";
import { DirectionsV3 } from "@/components/v3/sections/DirectionsV3";
import { FactsV3 } from "@/components/v3/sections/FactsV3";
import { IntroV3 } from "@/components/v3/sections/IntroV3";
import { OutroV3 } from "@/components/v3/sections/OutroV3";
import { ReelV3 } from "@/components/v3/sections/ReelV3";
import { WorkV3 } from "@/components/v3/sections/WorkV3";
import { WorldV3 } from "@/components/v3/sections/WorldV3";

export const metadata: Metadata = {
  title: "Seven Hills of Kazakhstan — версия 3",
  robots: { index: false },
};

export default function V3Page() {
  return (
    <PageGL ribbon={ribbonRoute}>
      <HeaderV3 />
      <main>
        <HeroV3 />
        <IntroV3 />
        <ReelV3 />
        <NumbersV3 sheet />
        <WorkV3 />
        <DirectionsV3 />
        <FactsV3 />
        <WorldV3 />
        <OutroV3 />
        <Contact />
      </main>
    </PageGL>
  );
}
