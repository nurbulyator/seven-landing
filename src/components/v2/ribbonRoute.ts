import type { RibbonStep } from "@/components/v2/gl/ribbon";

/**
 * Маршрут ленты по /v2. Ключи — значения data-ribbon у элементов страницы,
 * x/y — доли ширины/высоты элемента. Лента: обвивает знак «7» → проходит сквозь заголовок
 * вступления → «капает» в карточку и заливает её → обвивает и утягивает карточку в ролик →
 * петляет вдоль цифр → обвивает заголовок продуктов → идёт через направления и факты →
 * в конце складывается в знак «7».
 */
export const ribbonRoute: RibbonStep[] = [
  { at: "hero", x: -0.08, y: 0.22, z: 30 },
  { at: "hero", x: 0.3, y: 0.12, z: 30 },
  { loop: "seven-hero", pad: 34, turns: 1.15, from: Math.PI * 1.05, squash: 0.42 },
  { at: "hero", x: 0.96, y: 0.86, z: 30 },
  { at: "hero", x: 0.62, y: 1.08, z: 30 },
  { at: "intro-title", x: 0.04, y: -0.15 },
  { at: "intro-title", x: 0.3, y: 0.42 },
  { at: "intro-title", x: 0.62, y: 0.55 },
  { at: "intro-title", x: 1.02, y: 0.3 },
  { at: "intro-card", x: 0.95, y: -0.55 },
  { at: "intro-card", x: 0.55, y: 0.06, z: 6, id: "dip" },
  { loop: "intro-card", pad: 44, turns: 1.2, from: -Math.PI * 0.45, squash: 0.62 },
  { at: "reel-card", x: 1.03, y: 0.08 },
  { at: "reel-card", x: 0.82, y: 1.06 },
  { at: "reel", x: 0.3, y: 1.1 },
  { at: "numbers", x: 0.06, y: 0.06 },
  { at: "numbers", x: 0.94, y: 0.28 },
  { at: "numbers", x: 0.05, y: 0.52 },
  { at: "numbers", x: 0.95, y: 0.76 },
  { at: "numbers", x: 0.4, y: 0.98 },
  { at: "products-title", x: -0.04, y: 0.2 },
  { loop: "products-title", pad: 30, turns: 1, from: Math.PI, squash: 0.9 },
  // по правому краю, между рядами карточек и по левому краю — не закрывая интерфейсы
  { at: "products", x: 1.03, y: 0.05 },
  { at: "products", x: 1.03, y: 0.44 },
  { at: "products", x: 0.55, y: 0.5 },
  { at: "products", x: -0.03, y: 0.53 },
  { at: "products", x: -0.03, y: 1.0 },
  { at: "directions", x: 0.99, y: 0.05 },
  { at: "directions", x: 0.96, y: 0.5 },
  { at: "directions", x: 1.0, y: 0.95 },
  { at: "facts", x: 1.03, y: 0.08 },
  { at: "facts", x: 1.03, y: 0.62 },
  { at: "facts", x: 0.5, y: 0.8 },
  { at: "facts", x: -0.03, y: 0.98 },
  // глобус — отдельная тёмная сцена, лента идёт «за» неё и выходит в финал
  { at: "outro", x: 0.08, y: 0.08 },
  { seven: "outro-seven" },
];
