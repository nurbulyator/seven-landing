"use client";

import type { ReactNode } from "react";

import { PageGL } from "@/components/v3/gl/PageGL";
import { useHeroVariant } from "@/components/v3/hero/HeroV3";
import { ribbonRouteV7Globe, ribbonRouteV7Seven } from "@/components/v7/ribbonRouteV7";

/** WebGL-слой /v7: у «Знака» лента рождается из «7», у «Глобуса» и «Глобуса 2» — выползает сбоку. */
export function PageGLV7({ children }: { children: ReactNode }) {
  const variant = useHeroVariant(true);
  return <PageGL ribbon={variant === "seven" ? ribbonRouteV7Seven : ribbonRouteV7Globe}>{children}</PageGL>;
}
