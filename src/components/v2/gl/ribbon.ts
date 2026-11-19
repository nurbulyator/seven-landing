import * as THREE from "three";

/**
 * Лента — объёмная трубка, которая «ползёт» по странице за прокруткой, как змейка:
 * голова идёт по маршруту, хвост тянется следом. Маршрут задаётся шагами, привязанными
 * к элементам с data-ribbon="ключ", поэтому он подстраивается под любую ширину экрана.
 *
 * У каждого участка маршрута свой слой:
 *  - поверх страницы (по умолчанию);
 *  - «под полотном» — элемент [data-sheet] закрывает трубку, а поверхность полотна облегает её:
 *    по нему ползёт бугорок со светом, тенью и складками;
 *  - «за карточками» — элементы с data-occlude закрывают трубку, она видна в просветах.
 *
 * Координаты: x = pageX − vw/2, y = vh/2 − pageY (ось Y вверх), z — глубина: z > 0 перед
 * карточками WebGL, z < 0 — за ними (так лента «обвивает» карточку).
 */

type Layer = "under" | "behind";

export type RibbonStep =
  /**
   * точка внутри/около элемента: x, y — доли его ширины/высоты (можно < 0 и > 1);
   * layer — слой участка от этой точки до следующей. Внутри паузы голова проходит точки,
   * пока сцена стоит; when: "enter" — точку проходят ещё на подъезде к паузе, "leave" — уже
   * после неё, когда сцена уезжает вверх.
   */
  | { at: string; x: number; y: number; z?: number; id?: string; layer?: Layer; when?: "enter" | "leave" }
  /** петля-«лассо» вокруг элемента: задняя половина уходит за карточку */
  | { loop: string; pad?: number; turns?: number; from?: number; dir?: 1 | -1; squash?: number }
  /**
   * контур знака «7» по месту объёмного знака (элемент — квадрат с кадром Blender).
   * lead — стартовый знак: голова выписывает его, пока прокрутка идёт от 0 до lead·vh,
   * а сам знак растворяется следом. Без lead — финальный: лента дописывает знак и остаётся в нём.
   */
  | { seven: string; lead?: number };

/**
 * Осевая линия внешней бирюзовой «7» на фронтальном кадре Blender (кадр 31), в долях кадра
 * (x — слева, y — сверху), как если бы знак писали одним движением: от низа левого «крючка»
 * вверх, по верхней планке, вниз и по диагонали к острию.
 */
export const SEVEN_FRAME_STROKE: [number, number][] = [
  [0.308, 0.332], [0.308, 0.23], [0.69, 0.23], [0.69, 0.337], [0.432, 0.775],
];

/** Прокрутка (доля vh), за которую стартовый знак поворачивается лицом к зрителю, прежде чем начать растворяться. */
export const SEVEN_TURN = 0.06;

const LAYER_CODE = { under: 1, behind: 2 } as const;

/**
 * Пауза: секция [data-pin], первый ребёнок которой — sticky-«сцена» высотой в экран. Пока сцена
 * закреплена, лента замирает на экране вместе с ней, а прокрутка двигает только её сюжет.
 * start — прокрутка, на которой сцена закрепляется, len — сколько прокрутки она стоит,
 * shift — сколько прокрутки «съели» паузы выше (на столько лента отстаёт от страницы).
 */
type Pin = { el: HTMLElement; stage: HTMLElement; start: number; len: number; bottom: number; shift: number };

function pinsOf(): Pin[] {
  const pins: Pin[] = [];
  document.querySelectorAll<HTMLElement>("[data-pin]").forEach((el) => {
    const stage = el.firstElementChild as HTMLElement | null;
    if (!stage) return;
    const len = el.offsetHeight - stage.offsetHeight;
    const start = el.getBoundingClientRect().top + window.scrollY;
    if (len > 0) pins.push({ el, stage, start, len, bottom: start + el.offsetHeight, shift: 0 });
  });
  pins.sort((a, b) => a.start - b.start);
  let shift = 0;
  for (const p of pins) {
    p.shift = shift;
    shift += p.len;
  }
  return pins;
}

/**
 * Прямоугольник элемента: y — в координатах ленты (паузы выше вычтены), realY — настоящий
 * pageY в тот момент, когда до элемента доходит прокрутка (для расписания головы).
 * Внутри паузы меряем так, будто сцена стоит в начале секции, — от текущей прокрутки не зависит.
 */
function rectOf(key: string, pins: Pin[]) {
  const el = document.querySelector<HTMLElement>(`[data-ribbon="${key}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const x = r.left + window.scrollX;
  const pinIdx = pins.findIndex((p) => p.el.contains(el) && p.el !== el);
  if (pinIdx >= 0) {
    const p = pins[pinIdx];
    const realY = p.start + (r.top - p.stage.getBoundingClientRect().top);
    return { x, y: realY - p.shift, realY, w: r.width, h: r.height, pin: pinIdx };
  }
  const realY = r.top + window.scrollY;
  const shift = pins.reduce((acc, p) => (p.bottom <= realY + 1 ? acc + p.len : acc), 0);
  return { x, y: realY - shift, realY, w: r.width, h: r.height, pin: -1 };
}

type Resolved = {
  p: THREE.Vector3;
  /** настоящий pageY точки (для расписания головы) */
  realY: number;
  pin: number;
  layer: 0 | 1 | 2;
  when?: "enter" | "leave";
  id?: string;
  seven?: string;
  lead?: number;
};

function resolve(steps: RibbonStep[], vw: number, vh: number, pins: Pin[]): Resolved[] {
  const out: Resolved[] = [];
  const toGL = (px: number, py: number, z: number) => new THREE.Vector3(px - vw / 2, vh / 2 - py, z);
  for (const step of steps) {
    if ("at" in step) {
      const r = rectOf(step.at, pins);
      if (!r) continue;
      const y = r.h * step.y;
      out.push({
        p: toGL(r.x + r.w * step.x, r.y + y, step.z ?? 24),
        realY: r.realY + y,
        pin: r.pin,
        layer: step.layer ? LAYER_CODE[step.layer] : 0,
        when: step.when,
        id: step.id,
      });
    } else if ("loop" in step) {
      const r = rectOf(step.loop, pins);
      if (!r) continue;
      const pad = step.pad ?? 40;
      const cx = r.x + r.w / 2;
      const cy = r.h / 2;
      const rx = r.w / 2 + pad;
      const ry = (r.h / 2) * (step.squash ?? 0.8) + pad * 0.4;
      const turns = step.turns ?? 1.1;
      const n = Math.ceil(14 * turns);
      const dir = step.dir ?? 1;
      for (let i = 0; i <= n; i++) {
        const a = (step.from ?? Math.PI) + dir * (i / n) * turns * Math.PI * 2;
        // нижняя дуга — перед карточкой, верхняя — за ней
        const z = Math.sin(a) * 46;
        const y = cy + Math.sin(a) * ry;
        out.push({ p: toGL(cx + Math.cos(a) * rx, r.y + y, z), realY: r.realY + y, pin: r.pin, layer: 0 });
      }
    } else {
      const r = rectOf(step.seven, pins);
      if (!r) continue;
      const pts = SEVEN_FRAME_STROKE;
      const mark = { seven: step.seven, lead: step.lead, pin: r.pin, layer: 0 as const };
      const at = (fx: number, fy: number) => ({ p: toGL(r.x + fx * r.w, r.y + fy * r.h, 30), realY: r.realY + fy * r.h, ...mark });
      // у каждого угла две близкие точки — сплайн проходит угол туго, а не «срезает» его
      out.push(at(pts[0][0], pts[0][1]));
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        for (const f of [0.08, 0.92]) out.push(at(ax + (bx - ax) * f, ay + (by - ay) * f));
      }
      const [ex, ey] = pts[pts.length - 1];
      out.push(at(ex, ey));
    }
  }
  return out;
}

/**
 * Толщина трубки в финальном знаке, пока он проявляется (1 — полная, 0 — трубки нет).
 * Фронт истончения идёт чуть позади фронта проявления знака (uReveal), поэтому трубка
 * перекрывает место, где знак только появляется, — без разрыва между ними.
 */
const REVEAL_TAPER = /* glsl */ `
  float revealTaper(float s, vec2 fade, float reveal) {
    if (reveal <= 0.0) return 1.0;
    float q = (s - fade.x) / max(fade.y - fade.x, 1.0);
    if (q < 0.0 || q > 1.0) return 1.0;
    float r = reveal * 1.2;
    return smoothstep(r - 0.16, r - 0.02, q);
  }
`;
const revealTaper = (s: number, fade: THREE.Vector2, reveal: number) => {
  if (reveal <= 0) return 1;
  const q = (s - fade.x) / Math.max(fade.y - fade.x, 1);
  if (q < 0 || q > 1) return 1;
  const r = reveal * 1.2;
  const t = Math.min(1, Math.max(0, (q - (r - 0.16)) / 0.14));
  return t * t * (3 - 2 * t);
};

/** «Дыхание» ленты — то же смещение, что в шейдере, чтобы торцы и бугорок шли вместе с трубкой. */
const BREATH = /* glsl */ `
  vec2 breath(float s, float t) { return vec2(sin(s * 0.004 + t * 0.9), cos(s * 0.0033 + t * 0.7)) * 3.5; }
`;
const breath = (s: number, t: number) => [Math.sin(s * 0.004 + t * 0.9) * 3.5, Math.cos(s * 0.0033 + t * 0.7) * 3.5];

const vertex = /* glsl */ `
  attribute float aS;
  attribute float aL;
  attribute vec3 aCenter;
  uniform float uTime;
  uniform vec2 uFade;
  uniform float uReveal;
  varying vec3 vN;
  varying float vS;
  varying float vL;
  ${BREATH}
  ${REVEAL_TAPER}
  void main() {
    vec3 off = position - aCenter;
    // в финальном знаке трубка истончается и «втекает» в проявляющийся объёмный знак
    vec3 p = aCenter + off * revealTaper(aS, uFade, uReveal);
    p.xy += breath(aS, uTime);
    vN = normalize(normalMatrix * normalize(off));
    vS = aS;
    vL = aL;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// торец — сфера на голове или хвосте: края трубки срезаны ровно, сфера их закрывает
const capVertex = /* glsl */ `
  uniform vec3 uCapC;
  uniform float uCapR;
  uniform float uCapS;
  uniform float uCapL;
  varying vec3 vN;
  varying float vS;
  varying float vL;
  void main() {
    vN = normalize(normalMatrix * normal);
    vS = uCapS;
    vL = uCapL;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(uCapC + position * uCapR, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uHead;
  uniform float uTail;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec2 uFade;   // участок дуги финального знака «7»
  uniform float uReveal; // доля этого участка, которую уже заменил объёмный знак
  uniform vec4 uOcc[16]; // карточки, за которыми идёт лента: прямоугольники в пикселях буфера
  uniform float uOccN;
  uniform float uOccR;
  uniform vec4 uSheet;   // полотно, под которым идёт лента (пиксели буфера)
  uniform float uSheetR;
  varying vec3 vN;
  varying float vS;
  varying float vL;
  float sdBox(vec2 p, vec4 r, float rad) {
    vec2 q = abs(p - (r.xy + r.zw) * 0.5) - (r.zw - r.xy) * 0.5 + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
  }
  ${REVEAL_TAPER}
  void main() {
    if (vS > uHead || vS < uTail) discard;
    // под полотном: край полотна срезает трубку — видно, как она под него заезжает
    if (vL > 0.5 && vL < 1.5 && sdBox(gl_FragCoord.xy, uSheet, uSheetR) < 0.0) discard;
    if (vL > 1.5) {
      vec2 fc = gl_FragCoord.xy;
      for (int i = 0; i < 16; i++) {
        if (float(i) >= uOccN) break;
        vec4 r = uOcc[i];
        vec2 q = abs(fc - (r.xy + r.zw) * 0.5) - (r.zw - r.xy) * 0.5 + uOccR;
        if (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uOccR < 0.0) discard;
      }
    }
    float q = (vS - uFade.x) / max(uFade.y - uFade.x, 1.0);
    if (revealTaper(vS, uFade, uReveal) < 0.02) discard;
    vec3 n = normalize(vN);
    vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 48.0);
    float rim = pow(1.0 - max(n.z, 0.0), 2.5);
    vec3 base = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vS * 0.0012));
    vec3 col = base * (0.42 + 0.7 * diff) + vec3(spec) * 0.75 + base * rim * 0.35;
    // там, где трубка вот-вот перейдёт в знак, — светлая кромка
    if (uReveal > 0.0 && q >= 0.0 && q <= 1.0) col += vec3(0.35, 0.6, 0.6) * (1.0 - revealTaper(vS, uFade, uReveal));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// огибающая бугорка вдоль ленты: у головы купол, к хвосту сходит на нет
const RIDGE_ENV = /* glsl */ `
  float envAt(float s, float head, float tail, float w) {
    return smoothstep(head + w * 0.2, head - w * 2.2, s) * smoothstep(tail, tail + w * 5.0, s);
  }
`;

// Бугорок под полотном рисуется в два прохода. Здесь — первый: полоса вдоль ленты пишет
// в отдельную карту только высоту поверхности, смешивая по максимуму, поэтому на крутых
// изгибах, где полоса накладывается сама на себя, рельеф остаётся одним гладким полем.
// Второй проход (PageGL) считает по карте свет и тень для каждого пикселя.
const ridgeVertex = /* glsl */ `
  attribute float aS;
  attribute float aV;
  attribute float aE;
  uniform float uTime;
  varying float vS;
  varying float vV;
  varying float vE;
  ${BREATH}
  void main() {
    vS = aS;
    vV = aV;
    vE = aE;
    vec3 p = position;
    p.xy += breath(aS, uTime);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const ridgeFragment = /* glsl */ `
  uniform float uHead;
  uniform float uTail;
  uniform float uW;
  varying float vS;
  varying float vV;
  varying float vE;
  ${RIDGE_ENV}
  void main() {
    // На внутренней стороне крутого изгиба треугольники полосы выворачиваются (меняют обход)
    // и тянут в карту высоту с чужого места ленты — даёт штриховку. Обычные треугольники
    // полосы в этой камере повёрнуты к нам «изнанкой», вывернутые — «лицом»: их отбрасываем.
    if (gl_FrontFacing) discard;
    float env = envAt(vS, uHead, uTail, uW) * vE;
    // верх облегает трубку, по бокам поверхность мягко спадает; к краю полосы — в ноль
    float v = vV;
    float h = (0.6 * exp(-v * v * 46.0) + 0.4 * exp(-v * v * 8.7)) * env * (1.0 - smoothstep(0.75, 1.0, abs(v)));
    if (h < 0.0005) discard;
    gl_FragColor = vec4(h, 0.0, 0.0, 1.0);
  }
`;

/**
 * Знак «7» на маршруте: участок дуги [start, end], стартовый ли он, и прокрутки сюжета:
 * doneAt — голова дописала контур; revealEnd — объёмный знак проявился целиком;
 * [cutStart, cutEnd] — кусок ленты, что ведёт в знак, обрезается (только у финального).
 */
export type SevenInfo = {
  start: number;
  end: number;
  lead: boolean;
  doneAt: number;
  revealEnd: number;
  cutStart: number;
  cutEnd: number;
};

export type Ribbon = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** голова ленты (длина дуги, px) для заданной прокрутки */
  headAt(scroll: number): number;
  tailFor(head: number, vh: number): number;
  /** выставить голову, хвост и время: трубка, торцы и бугорок (uReveal выставляется до вызова) */
  update(head: number, tail: number, time: number): void;
  /** полоса бугорка для прохода карты высоты (null — участков под полотном нет) и его высота, px */
  ridge: THREE.Mesh | null;
  ridgeHeight: number;
  /** длина дуги у отмеченной точки маршрута (шаг с id) */
  marks: Map<string, number>;
  /** точки ленты каждые ~16px: x, y (GL-координаты страницы), s */
  samples: Float32Array;
  /** знаки «7» на маршруте по ключу data-ribbon */
  sevens: Map<string, SevenInfo>;
  /** прокрутка, под которую нарисована лента: во время пауз она стоит на месте */
  view(scroll: number): number;
  /** точка ленты на длине дуги s (GL-координаты страницы) */
  pointAt(s: number, out: THREE.Vector3): THREE.Vector3;
  dispose(): void;
};

/** Шаг плотной выборки маршрута при сглаживании, px. */
const DS = 10;

export function buildRibbon(steps: RibbonStep[], vw: number, vh: number, radius: number): Ribbon | null {
  const pins = pinsOf();
  const pts = resolve(steps, vw, vh, pins);
  if (pts.length < 4) return null;

  // ── сглаживание: исходный сплайн → плотные точки → «размазываем» изломы ──
  // Точки знаков «7» не трогаем: у них нарочно тугие углы.
  const raw = new THREE.CatmullRomCurve3(pts.map((r) => r.p), false, "centripetal");
  raw.arcLengthDivisions = (pts.length - 1) * 16;
  const rawLen = raw.getLengths();
  const rawTotal = rawLen[rawLen.length - 1];
  const S0 = pts.map((_, i) => rawLen[i * 16]);
  const K = Math.max(8, Math.ceil(rawTotal / DS));
  const dense: THREE.Vector3[] = [];
  const fixed = new Uint8Array(K + 1);
  const denseLayer = new Uint8Array(K + 1);
  let seg = 0;
  for (let k = 0; k <= K; k++) {
    const s = (k / K) * rawTotal;
    dense.push(raw.getPointAt(k / K));
    while (seg < pts.length - 2 && S0[seg + 1] <= s) seg++;
    denseLayer[k] = pts[seg].layer;
    if (pts[seg].seven && pts[seg + 1]?.seven === pts[seg].seven) fixed[k] = 1;
  }
  fixed[0] = 1;
  fixed[K] = 1;
  const tmp = dense.map((p) => p.clone());
  for (let it = 0; it < 60; it++) {
    for (let k = 1; k < K; k++) {
      if (fixed[k]) continue;
      const a = dense[k - 1];
      const b = dense[k + 1];
      const p = dense[k];
      tmp[k].set(p.x + ((a.x + b.x) / 2 - p.x) * 0.5, p.y + ((a.y + b.y) / 2 - p.y) * 0.5, p.z + ((a.z + b.z) / 2 - p.z) * 0.5);
    }
    for (let k = 1; k < K; k++) if (!fixed[k]) dense[k].copy(tmp[k]);
  }

  const curve = new THREE.CatmullRomCurve3(dense, false, "centripetal");
  curve.arcLengthDivisions = K * 2;
  const lengths = curve.getLengths();
  const total = lengths[lengths.length - 1];
  const denseS = Array.from({ length: K + 1 }, (_, k) => lengths[k * 2]);
  const S = S0.map((s) => denseS[Math.round((s / rawTotal) * K)]);

  // участки «под простынёй» и «за карточками» в длине дуги новой кривой
  const ranges: { a: number; b: number; layer: number }[] = [];
  for (let k = 0; k < K; k++) {
    const l = denseLayer[k];
    const last = ranges[ranges.length - 1];
    if (last && last.layer === l) last.b = denseS[k + 1];
    else ranges.push({ a: denseS[k], b: denseS[k + 1], layer: l });
  }
  const under = ranges.filter((r) => r.layer === 1);
  const layerAt = (s: number) => ranges.find((r) => s >= r.a && s <= r.b)?.layer ?? 0;

  const sevens = new Map<string, SevenInfo & { i0: number; i1: number; pin: number }>();
  pts.forEach((r, i) => {
    if (!r.seven) return;
    const g = sevens.get(r.seven);
    if (g) {
      g.end = S[i];
      g.i1 = i;
    } else {
      const lead = r.lead !== undefined;
      sevens.set(r.seven, { start: S[i], end: S[i], lead, doneAt: 0, revealEnd: 0, cutStart: Infinity, cutEnd: Infinity, i0: i, i1: i, pin: r.pin });
    }
  });

  // Расписание головы. Обычная точка: голова доходит до неё, когда точка на 62% высоты экрана.
  // На петлях даём немного прокрутки на виток, но отставание не копим. Знаки «7» голова проходит
  // равномерно по длине в своём окне прокрутки: стартовый — с первого движения колеса
  // (от SEVEN_TURN·vh до lead·vh), финальный — пока его сцена закреплена (контур → проявление
  // объёмного знака → обрезка ленты → тишина) или, без паузы, пока знак в середине экрана.
  // Точки внутри паузы без знака голова проходит равномерно, пока сцена стоит.
  const T: number[] = [];
  const windows = new Map<string, [number, number]>();
  const pinSpan = new Map<number, [number, number]>();
  pts.forEach((r, i) => {
    if (r.pin < 0 || r.when) return;
    const span = pinSpan.get(r.pin);
    if (span) span[1] = i;
    else pinSpan.set(r.pin, [i, i]);
  });
  const pinHasSeven = new Set([...sevens.values()].map((g) => g.pin));
  pts.forEach((r, i) => {
    const prev = i > 0 ? T[i - 1] : -Infinity;
    const g = r.seven ? sevens.get(r.seven) : undefined;
    if (g && r.seven) {
      let w = windows.get(r.seven);
      if (!w) {
        const pin = pins[g.pin];
        if (r.lead !== undefined) w = [vh * SEVEN_TURN, vh * r.lead];
        else if (pin) w = [Math.max(pin.start, prev + 1), pin.start + pin.len * 0.3];
        else {
          const center = (pts[g.i0].realY + pts[g.i1].realY) / 2;
          const done = center - vh * 0.56;
          w = [Math.max(prev + 1, Math.min(r.realY - vh * 0.62, done - vh * 0.3)), done];
          w[1] = Math.max(w[1], w[0] + vh * 0.1);
        }
        windows.set(r.seven, w);
      }
      const f = (S[i] - g.start) / (g.end - g.start || 1);
      T.push(w[0] + (w[1] - w[0]) * f);
      return;
    }
    const pin = pins[r.pin];
    const span = pinSpan.get(r.pin);
    if (pin && r.when) {
      // на подъезде к паузе — как обычная точка; после неё — как если бы паузы не было,
      // только позже на её длину
      const natural = r.realY - vh * 0.62 + (r.when === "leave" ? pin.len : 0);
      T.push(Math.max(natural, prev + 1));
      return;
    }
    if (pin && span && !pinHasSeven.has(r.pin)) {
      const f = (S[i] - S[span[0]]) / (S[span[1]] - S[span[0]] || 1);
      T.push(Math.max(prev + 1, pin.start + pin.len * (0.04 + 0.88 * f)));
      return;
    }
    const natural = r.realY - vh * 0.62;
    T.push(i === 0 ? natural : Math.max(natural, prev + Math.min(vh * 0.08, (S[i] - S[i - 1]) * 0.12)));
  });
  for (const g of sevens.values()) {
    g.doneAt = T[g.i1];
    if (g.lead) continue;
    const pin = pins[g.pin];
    if (pin) {
      g.revealEnd = pin.start + pin.len * 0.55;
      g.cutStart = pin.start + pin.len * 0.62;
      g.cutEnd = pin.start + pin.len * 0.86;
    } else g.revealEnd = g.doneAt + vh * 0.22;
  }
  const marks = new Map<string, number>();
  pts.forEach((r, i) => r.id && marks.set(r.id, S[i]));
  // финальный знак: дойдя до него, хвост останавливается
  const hold = [...sevens.values()].find((g) => !g.lead);
  const sevenStart = hold ? hold.start : null;

  // ── трубка ──
  const segments = Math.min(9000, Math.max(64, Math.round(total / 6)));
  const radial = 14;
  const tube = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const count = tube.attributes.position.count;
  const aS = new Float32Array(count);
  const aL = new Float32Array(count);
  const aCenter = new Float32Array(count * 3);
  const c = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const s = (i / segments) * total;
    const l = layerAt(s);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      aS[k] = s;
      aL[k] = l;
      aCenter.set([c.x, c.y, c.z], k * 3);
    }
  }
  tube.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
  tube.setAttribute("aL", new THREE.BufferAttribute(aL, 1));
  tube.setAttribute("aCenter", new THREE.BufferAttribute(aCenter, 3));

  const occ = Array.from({ length: 16 }, () => new THREE.Vector4());
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uHead: { value: 0 },
      uTail: { value: 0 },
      uTime: { value: 0 },
      uFade: { value: new THREE.Vector2(hold ? hold.start : -1, hold ? hold.end : -1) },
      uReveal: { value: 0 },
      uOcc: { value: occ },
      uOccN: { value: 0 },
      uOccR: { value: 24 },
      uSheet: { value: new THREE.Vector4(0, 0, 0, 0) },
      uSheetR: { value: 32 },
      uColorA: { value: new THREE.Color() },
      uColorB: { value: new THREE.Color() },
    },
  });
  // цвета передаём «как есть»: рендер без преобразования цветового пространства
  (material.uniforms.uColorA.value as THREE.Color).setRGB(0, 0.733, 0.769);
  (material.uniforms.uColorB.value as THREE.Color).setRGB(0.247, 0.827, 0.859);
  const mesh = new THREE.Mesh(tube, material);
  mesh.frustumCulled = false;

  // ── торцы ──
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const makeCap = () => {
    const m = new THREE.Mesh(
      sphere,
      new THREE.ShaderMaterial({
        vertexShader: capVertex,
        fragmentShader: fragment,
        // общие объекты uniform с трубкой — значения меняются вместе
        uniforms: {
          ...material.uniforms,
          uCapC: { value: new THREE.Vector3() },
          uCapR: { value: radius },
          uCapS: { value: 0 },
          uCapL: { value: 0 },
        },
      }),
    );
    m.frustumCulled = false;
    mesh.add(m);
    return m;
  };
  const caps = [makeCap(), makeCap()];

  // ── бугорок под полотном ──
  const W = radius * 8;
  const ridgeGeo = new THREE.BufferGeometry();
  {
    const pos: number[] = [];
    const rs: number[] = [];
    const rv: number[] = [];
    const re: number[] = [];
    const idx: number[] = [];
    const tan = new THREE.Vector3();
    for (const r of under) {
      const n = Math.max(2, Math.ceil((r.b - r.a) / 5));
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const s = r.a + ((r.b - r.a) * i) / n;
        curve.getPointAt(s / total, c);
        curve.getTangentAt(s / total, tan);
        const tl = Math.hypot(tan.x, tan.y) || 1;
        const tx = tan.x / tl;
        const ty = tan.y / tl;
        const edge = Math.min(1, Math.min(s - r.a, r.b - s) / W);
        for (const v of [-1, 1]) {
          pos.push(c.x - ty * W * v, c.y + tx * W * v, 0);
          rs.push(s);
          rv.push(v);
          re.push(edge * edge * (3 - 2 * edge));
        }
        if (i < n) {
          const a = base + i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    ridgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    ridgeGeo.setAttribute("aS", new THREE.Float32BufferAttribute(rs, 1));
    ridgeGeo.setAttribute("aV", new THREE.Float32BufferAttribute(rv, 1));
    ridgeGeo.setAttribute("aE", new THREE.Float32BufferAttribute(re, 1));
    ridgeGeo.setIndex(idx);
  }
  const ridgeMat = new THREE.ShaderMaterial({
    vertexShader: ridgeVertex,
    fragmentShader: ridgeFragment,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: {
      uHead: material.uniforms.uHead,
      uTail: material.uniforms.uTail,
      uTime: material.uniforms.uTime,
      uW: { value: W },
    },
  });
  const ridge = under.length ? new THREE.Mesh(ridgeGeo, ridgeMat) : null;
  if (ridge) ridge.frustumCulled = false;

  const nSamples = Math.ceil(total / 16);
  const samples = new Float32Array((nSamples + 1) * 3);
  for (let i = 0; i <= nSamples; i++) {
    curve.getPointAt(i / nSamples, c);
    samples.set([c.x, c.y, (i / nSamples) * total], i * 3);
  }

  const capPos = new THREE.Vector3();
  return {
    mesh,
    ridge,
    ridgeHeight: W * 0.26,
    marks,
    samples,
    sevens: new Map(
      [...sevens].map(([k, g]) => [
        k,
        { start: g.start, end: g.end, lead: g.lead, doneAt: g.doneAt, revealEnd: g.revealEnd, cutStart: g.cutStart, cutEnd: g.cutEnd },
      ]),
    ),
    view(scroll) {
      let v = scroll;
      for (const p of pins) {
        if (scroll >= p.start + p.len) v -= p.len;
        else if (scroll > p.start) v -= scroll - p.start;
      }
      return v;
    },
    pointAt(s, out) {
      return curve.getPointAt(Math.min(1, Math.max(0, s / total)), out);
    },
    headAt(scroll) {
      if (scroll <= T[0]) return S[0];
      for (let i = 1; i < T.length; i++) {
        if (scroll <= T[i]) return S[i - 1] + ((scroll - T[i - 1]) / (T[i] - T[i - 1] || 1)) * (S[i] - S[i - 1]);
      }
      return total;
    },
    tailFor(head, h) {
      let tail = head - h * 1.7;
      // дойдя до «7», хвост останавливается — знак остаётся нарисованным целиком
      if (sevenStart !== null && head > sevenStart) tail = Math.min(tail, sevenStart - h * 0.25);
      return tail;
    },
    update(head, tail, time) {
      const u = material.uniforms;
      u.uHead.value = head;
      u.uTail.value = tail;
      u.uTime.value = time;
      // видимый кусок трубки; торцы растут вместе с ним, у пустой ленты их нет
      const lo = Math.max(0, tail);
      const hi = Math.min(total, head);
      const grow = Math.min(1, Math.max(0, (hi - lo) / (radius * 2)));
      const ends = [hi, lo];
      caps.forEach((cap, i) => {
        const s = ends[i];
        const w = grow * revealTaper(s, u.uFade.value as THREE.Vector2, u.uReveal.value as number);
        cap.visible = w > 0.05;
        if (!cap.visible) return;
        curve.getPointAt(s / total, capPos);
        const [bx, by] = breath(s, time);
        const cu = cap.material.uniforms;
        (cu.uCapC.value as THREE.Vector3).set(capPos.x + bx, capPos.y + by, capPos.z);
        cu.uCapR.value = radius * w;
        // чуть внутрь отрезка, чтобы сфера не отсекалась проверкой [tail, head]
        cu.uCapS.value = i === 0 ? hi - 0.01 : lo + 0.01;
        cu.uCapL.value = layerAt(s);
      });
    },
    dispose() {
      tube.dispose();
      material.dispose();
      sphere.dispose();
      caps.forEach((cap) => cap.material.dispose());
      ridgeGeo.dispose();
      ridgeMat.dispose();
    },
  };
}
