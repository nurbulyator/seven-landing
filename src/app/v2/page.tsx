import type { Metadata } from "next";

import { Contact } from "@/components/sections/Contact";
import { Numbers } from "@/components/sections/Numbers";
import { PageGL } from "@/components/v2/gl/PageGL";
import { HeaderV2 } from "@/components/v2/HeaderV2";
import { HeroV2 } from "@/components/v2/hero/HeroV2";
import { ribbonRoute } from "@/components/v2/ribbonRoute";
import { DirectionsV2 } from "@/components/v2/sections/DirectionsV2";
import { FactsV2 } from "@/components/v2/sections/FactsV2";
import { IntroV2 } from "@/components/v2/sections/IntroV2";
import { OutroV2 } from "@/components/v2/sections/OutroV2";
import { ReelV2 } from "@/components/v2/sections/ReelV2";
import { WorkV2 } from "@/components/v2/sections/WorkV2";
import { WorldV2 } from "@/components/v2/sections/WorldV2";

export const metadata: Metadata = {
  title: "Seven Hills of Kazakhstan — версия 2",
  robots: { index: false },
};

export default function V2Page() {
  return (
    <PageGL ribbon={ribbonRoute}>
      <HeaderV2 />
      <main>
        <HeroV2 />
        <IntroV2 />
        <ReelV2 />
        <Numbers />
        <WorkV2 />
        <DirectionsV2 />
        <FactsV2 />
        <WorldV2 />
        <OutroV2 />
        <Contact />
      </main>
    </PageGL>
  );
}
