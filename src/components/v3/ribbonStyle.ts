"use client";

import { useSyncExternalStore } from "react";

/**
 * Вид ленты на /v3 — пока выбираем, какой лучше. Хранится в браузере зрителя
 * (localStorage), чтобы переживать перезагрузку; по умолчанию — плоская лента.
 */
export const ribbonStyles = [
  { key: "gloss", label: "Глянец" },
  { key: "metal", label: "Металл" },
  { key: "glass", label: "Стекло" },
  { key: "band", label: "Лента" },
] as const;
export type RibbonStyle = (typeof ribbonStyles)[number]["key"];

const KEY = "v3-ribbon-style";
const listeners = new Set<() => void>();
let current: RibbonStyle | null = null;

export function getRibbonStyle(): RibbonStyle {
  if (current) return current;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {}
  current = ribbonStyles.find((s) => s.key === saved)?.key ?? "band";
  return current;
}

export function setRibbonStyle(style: RibbonStyle) {
  current = style;
  try {
    localStorage.setItem(KEY, style);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRibbonStyle(): RibbonStyle {
  return useSyncExternalStore<RibbonStyle>(subscribe, getRibbonStyle, () => "band");
}
