import type { RibbonStep } from "@/components/v3/gl/ribbon";
import { ribbonRoute } from "@/components/v6/ribbonRoute";

/**
 * Маршрут ленты по /v7: от карточки вступления и дальше — как в /v6, другой только участок над
 * карточкой (заголовка вступления в /v7 нет). x/y — доли ширины/высоты элемента.
 */
const indexOf = (key: string) => ribbonRoute.findIndex((s) => "at" in s && s.at === key);

const fromCard = ribbonRoute.slice(indexOf("intro-card"));

/** Из-за левого края экрана (x — доли ширины вступления, оно во всю ширину) лента полого уходит вниз за карточку. */
const intoCard: RibbonStep[] = [{ at: "intro-card", x: -0.15, y: 0.2, z: -40 }, ...fromCard];

/**
 * «Знак»: лента рождается из объёмной «7», широкой дугой над карточкой уходит за левый край экрана,
 * разворачивается там (на виду только плавная дуга) и возвращается за карточку.
 */
export const ribbonRouteV7Seven: RibbonStep[] = [
  { seven: "seven-hero", lead: 0.45 },
  // из острия «7» — по продолжению её диагонали, чтобы на стыке не было излома
  { at: "seven-hero", x: 0.3, y: 0.99, z: 30 },
  { at: "intro-card", x: 0.95, y: -0.36 },
  { at: "intro-card", x: 0.1, y: -0.34 },
  { at: "intro", x: -0.04, y: 0.08 },
  ...intoCard,
];

/**
 * «Глобус»: знака нет — лента выползает из-за левого края сразу под первым экраном уже с первого
 * движения колеса (t — прокрутка в долях экрана), дальше её доводит захват ролика (SmoothScroll).
 */
export const ribbonRouteV7Globe: RibbonStep[] = [
  { at: "intro", x: -0.04, y: 0.02, t: 0.03 },
  { at: "intro", x: 0.08, y: 0.1, t: 0.13 },
  ...intoCard,
];
