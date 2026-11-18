/**
 * Точки суши для глобуса на /v2 → public/v2/globe.json.
 *   node scripts/build-globe.mjs
 *
 * Контур суши — world-atlas 110m (для точек на глобусе хватает), страны — 50m.
 * Сфера равномерно засеивается точками (спираль Фибоначчи), остаются только точки на суше.
 * Каждая точка: [широта, долгота, метка], метка 1 — Казахстан, 2 — ОАЭ, 3 — Чехия, 0 — остальной мир.
 * Три выделенные страны засеиваются отдельно — плотной сеткой, чтобы читались чётче,
 * и для них же сохраняются контуры границ (outlines: метка → кольца [широта, долгота, …]).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

import { geoBounds, geoContains } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const countries = JSON.parse(readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));
const land = JSON.parse(readFileSync(require.resolve("world-atlas/land-110m.json"), "utf8"));

const landFeature = feature(land, land.objects.land);
const all = feature(countries, countries.objects.countries).features;
const marked = [
  [1, all.find((f) => f.id === "398")], // Казахстан
  [2, all.find((f) => f.id === "784")], // ОАЭ
  [3, all.find((f) => f.id === "203")], // Чехия
];
if (marked.some(([, f]) => !f)) throw new Error("не нашёл страну в world-atlas");
// Рамки стран — чтобы не проверять полигон для каждой точки суши
const boxes = marked.map(([m, f]) => [m, f, geoBounds(f)]);
const inBox = ([lon, lat], [[w, s], [e, n]]) => lon >= w && lon <= e && lat >= s && lat <= n;

const N = 52000;
const golden = Math.PI * (3 - Math.sqrt(5));
const out = [];
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const theta = golden * i;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lon = ((((theta * 180) / Math.PI) % 360) + 540) % 360 - 180;
  if (lat < -60) continue; // Антарктиду не показываем
  const p = [lon, lat];
  if (!geoContains(landFeature, p)) continue;
  if (boxes.some(([, f, b]) => inBox(p, b) && geoContains(f, p))) continue; // страны засеем отдельно
  out.push(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100, 0);
}

// Плотная сетка внутри выделенных стран: шаг подобран под размер страны
const step = { 1: 0.42, 2: 0.11, 3: 0.14 };
for (const [m, f, [[w, so], [e, n]]] of boxes) {
  const d = step[m];
  for (let lat = so; lat <= n; lat += d) {
    // по долготе шаг растёт к полюсу, чтобы точки на сфере стояли равномерно
    const dl = d / Math.cos((lat * Math.PI) / 180);
    for (let lon = w; lon <= e; lon += dl) {
      if (geoContains(f, [lon, lat])) out.push(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100, m);
    }
  }
}

// Контуры трёх стран
const outlines = {};
for (const [m, f] of boxes) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  outlines[m] = polys
    .map((poly) => poly[0])
    .filter((ring) => ring.length > 12)
    .map((ring) => ring.flatMap(([lon, lat]) => [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100]));
}

mkdirSync("public/v2", { recursive: true });
writeFileSync("public/v2/globe.json", JSON.stringify({ points: out, outlines }));
const count = (m) => out.filter((v, i) => i % 3 === 2 && v === m).length;
console.log(`точек: ${out.length / 3}, КЗ ${count(1)}, ОАЭ ${count(2)}, Чехия ${count(3)}`);
