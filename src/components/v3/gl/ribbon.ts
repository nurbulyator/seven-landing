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
  /** половина толщины грани объёмного знака «7», px */
  bar?: number;
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
      // грань внешней бирюзовой «7» на кадре — 32 px из 1200
      const mark = { seven: step.seven, lead: step.lead, pin: r.pin, layer: 0 as const, bar: (16 / 1200) * r.w };
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
 * Толщина ленты в финальном знаке, пока поверх неё проступает объёмный знак (1 — полная,
 * 0 — ленты нет). Знак проявляется целиком (PageGL), и, когда он уже почти непрозрачный,
 * лента под ним сходит на нет — её края прячутся под гранями знака.
 */
const REVEAL_TAPER = /* glsl */ `
  float revealTaper(float s, vec2 fade, float reveal) {
    // в V3 лента целиком выстраивается в «7» и вся уходит под объёмный знак
    if (reveal <= 0.0 || s < fade.x || s > fade.y) return 1.0;
    return 1.0 - smoothstep(0.55, 1.0, reveal);
  }
`;
const revealTaper = (s: number, fade: THREE.Vector2, reveal: number) => {
  if (reveal <= 0 || s < fade.x || s > fade.y) return 1;
  const t = Math.min(1, Math.max(0, (reveal - 0.55) / 0.45));
  return 1 - t * t * (3 - 2 * t);
};

/** «Дыхание» ленты — то же смещение, что в шейдере, чтобы торцы и бугорок шли вместе с трубкой. */
const BREATH = /* glsl */ `
  vec2 breath(float s, float t) { return vec2(sin(s * 0.004 + t * 0.9), cos(s * 0.0033 + t * 0.7)) * 3.5; }
`;
const breath = (s: number, t: number) => [Math.sin(s * 0.004 + t * 0.9) * 3.5, Math.cos(s * 0.0033 + t * 0.7) * 3.5];

const vertex = /* glsl */ `
  attribute float aS;
  attribute float aL;
  attribute float aW;   // толщина: в знаке «7» — как его грань, после — плавно до полной
  attribute float aK;   // «внутри знака»: 1 — в «7», плавно до 0 на подходе/выходе
  attribute vec3 aCenter;
  attribute vec3 aN;    // поперечные оси трубки (кадр Френе)
  attribute vec3 aB;
  attribute float aPsi; // угол перекрута, при котором лента в финальном «7» лежит плашмя
  uniform float uTime;
  uniform vec2 uFade;
  uniform float uReveal;
  uniform float uBand;  // 1 — плоская перекрученная лента вместо трубки
  uniform float uHead;
  uniform float uTail;
  uniform float uRadius;
  uniform float uFlatten; // финал: в «7» лента раскручивается и ложится плашмя (0 → 1)
  varying vec3 vN;
  varying float vS;
  varying float vL;
  varying float vFace;
  varying float vCs;    // поперёк ширины плоской ленты: −1…1
  varying float vHalfW; // полуширина плоской ленты здесь, px
  ${BREATH}
  ${REVEAL_TAPER}
  void main() {
    vec3 off = position - aCenter;
    float r = length(off);
    vec3 dir = off / max(r, 1e-5);
    // плоская лента: сечение — вытянутый эллипс, который плавно перекручивается вдоль пути
    float cs = dot(dir, aN);
    float sn = dot(dir, aB);
    float phi = aS * 0.0045;
    // в финальном знаке перекрут плавно доводится до угла, при котором лента лежит плашмя —
    // ровной плоской полосой точно по форме «7» (углы выровнены вдоль ленты, без скачков)
    float inSeven = smoothstep(uFade.x - 60.0, uFade.x, aS) * (1.0 - smoothstep(uFade.y, uFade.y + 60.0, aS));
    phi = mix(phi, aPsi, uFlatten * inSeven);
    vec3 n2 = cos(phi) * aN + sin(phi) * aB;
    vec3 b2 = -sin(phi) * aN + cos(phi) * aB;
    // в знаке плоская лента не шире его грани, вне знака — почти вдвое шире трубки
    float wide = mix(1.9, 1.0, aK);
    vec3 bandOff = r * (cs * wide * n2 + sn * 0.2 * b2);
    vec3 bandN = normalize(cs / wide * n2 + sn / 0.2 * b2);
    vec3 o = mix(off, bandOff, uBand);
    vec3 nrm = normalize(mix(dir, bandN, uBand));
    // в финальном знаке трубка истончается и «втекает» в проявляющийся объёмный знак
    vec3 p = aCenter + o * aW * revealTaper(aS, uFade, uReveal);
    p.xy += breath(aS, uTime);
    vN = normalize(normalMatrix * nrm);
    vS = aS;
    vL = aL;
    vFace = sn;
    vCs = cs;
    vHalfW = uRadius * wide * aW;
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
  varying float vFace;
  varying float vCs;
  varying float vHalfW;
  void main() {
    vN = normalize(normalMatrix * normal);
    vS = uCapS;
    vL = uCapL;
    vFace = 1.0;
    vCs = 0.0;
    vHalfW = 0.0;
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
  uniform float uStyle;  // 0 — глянец, 1 — металл, 2 — стекло, 3 — плоская лента
  uniform float uBand;
  varying vec3 vN;
  varying float vS;
  varying float vL;
  varying float vFace;
  varying float vCs;
  varying float vHalfW;
  float sdBox(vec2 p, vec4 r, float rad) {
    vec2 q = abs(p - (r.xy + r.zw) * 0.5) - (r.zw - r.xy) * 0.5 + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
  }
  // Та же подача, что у знака V3: одна бирюзовая гамма от тёмной к светлой (без серого
  // и белого), сжатые блики, чуть ниже контраст и насыщенность — атласная поверхность.
  vec3 tealRamp(float l) {
    vec3 c = mix(vec3(0.0, 0.22, 0.25), vec3(0.0, 0.44, 0.48), smoothstep(0.05, 0.55, l));
    return mix(c, vec3(0.42, 0.82, 0.85), smoothstep(0.6, 1.0, l));
  }
  vec3 satinGrade(vec3 c) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c *= (l / (l + 1.3) * 2.3) / max(l, 0.001);
    c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 0.72);
    return clamp(mix(vec3(0.45), c, 0.9), 0.0, 1.0);
  }
  ${REVEAL_TAPER}
  void main() {
    if (vS > uHead || vS < uTail) discard;
    if (uBand > 0.5) {
      // концы плоской ленты срезаны наискось, как ножницами: линия среза идёт через ширину
      float cut = vHalfW * 1.6;
      if (vS > uHead - cut * (0.5 - 0.5 * vCs)) discard;
      if (vS < max(uTail, 0.0) + cut * (0.5 + 0.5 * vCs)) discard;
    }
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
    // у плоской ленты видны обе стороны (на срезе — изнанка), нормаль изнанки разворачиваем
    if (!gl_FrontFacing) n = -n;
    vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 48.0);
    float rim = pow(1.0 - max(n.z, 0.0), 2.5);
    vec3 base = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vS * 0.0012));
    vec3 col;
    float alpha = 1.0;
    if (uStyle < 0.5) {
      // глянец: бирюзовый пластик с бликом
      col = base * (0.42 + 0.7 * diff) + vec3(spec) * 0.75 + base * rim * 0.35;
    } else if (uStyle < 1.5) {
      // металл — как объёмный знак: тёмная бирюза, отражает светлое «небо» и тёмный «пол»,
      // яркая полоса горизонта и боковой софтбокс, края уходят в серебро
      vec3 R = reflect(vec3(0.0, 0.0, -1.0), n);
      float sky = smoothstep(-0.35, 0.75, R.y);
      float strip = exp(-pow((R.y - 0.18) / 0.08, 2.0)) + 0.6 * exp(-pow((R.x + 0.4) / 0.1, 2.0)) * smoothstep(-0.2, 0.5, R.y);
      col = vec3(0.0, 0.5, 0.53) * (0.3 + 0.6 * sky) + vec3(0.85, 1.0, 1.0) * strip * 0.6 + vec3(spec);
      col = mix(col, vec3(0.8, 0.88, 0.9), rim * 0.5);
    } else if (uStyle < 2.5) {
      // стекло: прозрачная середина со светящейся сердцевиной, плотные бирюзовые края
      float core = pow(max(n.z, 0.0), 10.0);
      vec3 deep = vec3(0.0, 0.52, 0.57);
      vec3 pre = vec3(0.3, 0.95, 1.0) * core * 0.85 + vec3(spec) * 0.95 + deep * rim * 1.1 + base * 0.2;
      alpha = clamp(0.3 + rim * 0.75 + core * 0.55 + spec, 0.0, 1.0);
      col = pre / max(alpha, 0.05);
    } else {
      // плоская лента — как знак: обе стороны в бирюзовой гамме (изнанка чуть светлее),
      // вместо белого блика мягкий отсвет внутри той же гаммы
      float sheen = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 10.0);
      float l = 0.16 + 0.6 * diff + 0.28 * sheen;
      if (vFace < 0.0) l = l * 0.85 + 0.14;
      col = satinGrade(tealRamp(l));
    }
    if (uStyle < 2.5) {
      // остальные виды: лента — акцент, но не главный, цвет чуть приглушён и темнее
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum) * vec3(0.92, 1.0, 1.0), 0.3) * 0.93;
    }
    gl_FragColor = vec4(col, alpha);
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
  attribute float aF;
  attribute float aD;   // расстояние от оси ленты со знаком, px
  uniform float uTime;
  varying float vS;
  varying float vV;
  varying float vE;
  varying float vF;
  varying float vD;
  ${BREATH}
  void main() {
    vS = aS;
    vV = aV;
    vE = aE;
    vF = aF;
    vD = aD;
    vec3 p = position;
    p.xy += breath(aS, uTime);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const ridgeFragment = /* glsl */ `
  uniform float uHead;
  uniform float uTail;
  uniform float uW;
  uniform float uTwist; // 1 — под полотном плоская перекрученная лента
  uniform float uR;     // радиус трубки, px (полуширина плоской ленты — 1.9·uR)
  varying float vS;
  varying float vV;
  varying float vE;
  varying float vF;     // насколько лента здесь лежит плашмя (1) или стоит ребром (0)
  varying float vD;
  ${RIDGE_ENV}
  void main() {
    // На внутренней стороне крутого изгиба треугольники полосы выворачиваются (меняют обход)
    // и тянут в карту высоту с чужого места ленты — даёт штриховку. Обычные треугольники
    // полосы в этой камере повёрнуты к нам «изнанкой», вывернутые — «лицом»: их отбрасываем.
    if (gl_FrontFacing) discard;
    float env = envAt(vS, uHead, uTail, uW) * vE;
    // верх облегает трубку, по бокам поверхность мягко спадает; к краю полосы — в ноль
    float v = vV;
    // профиль — по настоящему расстоянию от оси (на внутренней стороне изгиба полоса уже)
    float d = abs(vD);
    float ve = d / uW;
    float tubeH = 0.6 * exp(-ve * ve * 46.0) + 0.4 * exp(-ve * ve * 8.7);
    // плоская лента: гребень ровно по её видимой ширине здесь (плашмя — во всю ширину,
    // ребром — тонкий), чтобы на краю полотна бугорок переходил в ленту той же ширины;
    // по бокам — мягкий спуск ткани
    // ребром гребень не сжимается в нитку (иначе на этих местах видны заломы)
    float hw = uR * (1.3 * vF + 0.75);
    float crest = exp(-pow(d / hw, 2.6));
    float skirt = exp(-pow(d / (hw + uW * 0.3), 2.0) * 2.0);
    float bandH = (0.62 * crest + 0.38 * skirt) * mix(1.1, 0.8, vF);
    float fade = env * (1.0 - smoothstep(0.75, 1.0, abs(v)));
    float h = mix(tubeH, bandH, uTwist) * fade;
    if (h < 0.0005) discard;
    // второй канал — маска самой ленты ровно её видимой ширины (плашмя — во всю ширину, ребром —
    // узкая): по ней под тканью просвечивает бирюза, и на краю полотна ширина совпадает с лентой
    float hb = mix(uR, uR * mix(0.45, 1.9, vF), uTwist);
    float band = (1.0 - smoothstep(hb * 0.85, hb * 1.05, d)) * fade;
    gl_FragColor = vec4(h, band, 0.0, 1.0);
  }
`;

/**
 * Знак «7» на маршруте: участок дуги [start, end], стартовый ли он, и прокрутки сюжета:
 * doneAt — голова дописала контур; revealEnd — объёмный знак проступил поверх ленты целиком;
 * [retractStart, retractEnd] — лента выходит из-под крючка и уползает назад вверх (финальный).
 */
export type SevenInfo = {
  start: number;
  end: number;
  lead: boolean;
  doneAt: number;
  revealEnd: number;
  retractStart: number;
  retractEnd: number;
};

export type RibbonStyle = "gloss" | "metal" | "glass" | "band";

export type Ribbon = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** голова ленты (длина дуги, px) для заданной прокрутки */
  headAt(scroll: number): number;
  tailFor(head: number, vh: number): number;
  /** выставить голову, хвост и время: трубка, торцы и бугорок (uReveal выставляется до вызова) */
  update(head: number, tail: number, time: number): void;
  /** вид ленты (на /v3 всегда плоская лента — "band") */
  setStyle(style: RibbonStyle): void;
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

  const sevens = new Map<string, SevenInfo & { i0: number; i1: number; pin: number; bar: number }>();
  pts.forEach((r, i) => {
    if (!r.seven) return;
    const g = sevens.get(r.seven);
    if (g) {
      g.end = S[i];
      g.i1 = i;
    } else {
      const lead = r.lead !== undefined;
      sevens.set(r.seven, {
        start: S[i],
        end: S[i],
        lead,
        doneAt: 0,
        revealEnd: 0,
        retractStart: Infinity,
        retractEnd: Infinity,
        i0: i,
        i1: i,
        pin: r.pin,
        bar: r.bar ?? radius,
      });
    }
  });

  // Расписание головы. Обычная точка: голова доходит до неё, когда точка на 62% высоты экрана.
  // На петлях даём немного прокрутки на виток, но отставание не копим. Знаки «7» голова проходит
  // равномерно по длине в своём окне прокрутки: стартовый — с первого движения колеса
  // (от SEVEN_TURN·vh до lead·vh), финальный — пока его сцена закреплена (контур → объёмный
  // знак проступает поверх ленты → лента уползает назад вверх) или, без паузы, пока знак
  // в середине экрана.
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
        // финальный знак выписывает анимация (PageGL), как только сцена встала: прокрутка
        // доводит голову только до начала знака
        else if (pin) w = [Math.max(pin.start, prev + 1), Math.max(pin.start, prev + 1) + 2];
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
      g.revealEnd = pin.start + pin.len * 0.6;
      g.retractStart = pin.start + pin.len * 0.62;
      g.retractEnd = pin.start + pin.len * 0.92;
    } else g.revealEnd = g.doneAt + vh * 0.22;
  }
  const marks = new Map<string, number>();
  pts.forEach((r, i) => r.id && marks.set(r.id, S[i]));
  // финальный знак: дойдя до него, хвост останавливается
  const hold = [...sevens.values()].find((g) => !g.lead);
  const sevenStart = hold ? hold.start : null;

  // Толщина ленты: в знаке «7» — ровно как его грань, чтобы трубка ложилась на знак
  // и казалась им самим; дальше по ходу (у финального — до него) плавно до полной.
  const RAMP = 280;
  const sevenWidths = [...sevens.values()].map((g) => ({ a: g.start, b: g.end, lead: g.lead, w: Math.min(1, Math.max(0.3, g.bar / radius)) }));
  const smoothT = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  };
  // «внутри знака»: 1 — в «7», плавно до 0 на выходе (стартовый) или на подходе (финальный)
  const sevenAt = (s: number) => {
    let k = 0;
    for (const g of sevenWidths) {
      if (s >= g.a && s <= g.b) k = 1;
      else if (g.lead && s > g.b) k = Math.max(k, 1 - smoothT((s - g.b) / RAMP));
      else if (!g.lead && s < g.a) k = Math.max(k, 1 - smoothT((g.a - s) / RAMP));
    }
    return k;
  };
  const widthAt = (s: number) => {
    let w = 1;
    for (const g of sevenWidths) {
      let k = 1;
      if (s >= g.a && s <= g.b) k = g.w;
      else if (g.lead && s > g.b) k = g.w + (1 - g.w) * smoothT((s - g.b) / RAMP);
      else if (!g.lead && s < g.a) k = g.w + (1 - g.w) * smoothT((g.a - s) / RAMP);
      w = Math.min(w, k);
    }
    return w;
  };

  // ── трубка ──
  const segments = Math.min(9000, Math.max(64, Math.round(total / 6)));
  const radial = 14;
  const tube = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const count = tube.attributes.position.count;
  const aS = new Float32Array(count);
  const aL = new Float32Array(count);
  const aW = new Float32Array(count);
  const aK = new Float32Array(count);
  const aCenter = new Float32Array(count * 3);
  const aN = new Float32Array(count * 3);
  const aB = new Float32Array(count * 3);
  // угол «плашмя» для финального знака: ширина ленты в плоскости экрана. Считаем по кольцам
  // трубки, разворачиваем без скачков вдоль ленты и сдвигаем на целое число полуоборотов так,
  // чтобы у начала знака он был ближе всего к обычному перекруту.
  const psi = new Float32Array(segments + 1);
  {
    const lo = hold ? hold.start - 80 : Infinity;
    const hi = hold ? hold.end + 80 : -Infinity;
    let prev: number | null = null;
    let first = -1;
    for (let i = 0; i <= segments; i++) {
      const s = (i / segments) * total;
      psi[i] = s * 0.0045;
      if (s < lo || s > hi) continue;
      const t = tube.tangents[i];
      const fx = -t.y;
      const fy = t.x;
      const fl = Math.hypot(fx, fy) || 1;
      const nn = tube.normals[i];
      const bb = tube.binormals[i];
      let a = Math.atan2((fx * bb.x + fy * bb.y) / fl, (fx * nn.x + fy * nn.y) / fl);
      if (prev !== null) {
        while (a - prev > Math.PI) a -= Math.PI * 2;
        while (a - prev < -Math.PI) a += Math.PI * 2;
      } else first = i;
      prev = a;
      psi[i] = a;
    }
    if (first >= 0) {
      const k = Math.round(((first / segments) * total * 0.0045 - psi[first]) / Math.PI);
      for (let i = first; i <= segments; i++) {
        const s = (i / segments) * total;
        if (s > hi) break;
        psi[i] += k * Math.PI;
      }
    }
  }
  const aPsi = new Float32Array(count);
  const c = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const s = (i / segments) * total;
    const l = layerAt(s);
    const w = widthAt(s);
    const k7 = sevenAt(s);
    const nn = tube.normals[i];
    const bb = tube.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      aS[k] = s;
      aL[k] = l;
      aW[k] = w;
      aK[k] = k7;
      aCenter.set([c.x, c.y, c.z], k * 3);
      aN.set([nn.x, nn.y, nn.z], k * 3);
      aB.set([bb.x, bb.y, bb.z], k * 3);
      aPsi[k] = psi[i];
    }
  }
  tube.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
  tube.setAttribute("aL", new THREE.BufferAttribute(aL, 1));
  tube.setAttribute("aW", new THREE.BufferAttribute(aW, 1));
  tube.setAttribute("aK", new THREE.BufferAttribute(aK, 1));
  tube.setAttribute("aCenter", new THREE.BufferAttribute(aCenter, 3));
  tube.setAttribute("aN", new THREE.BufferAttribute(aN, 3));
  tube.setAttribute("aB", new THREE.BufferAttribute(aB, 3));
  tube.setAttribute("aPsi", new THREE.BufferAttribute(aPsi, 1));

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
      uStyle: { value: 0 },
      uBand: { value: 0 },
      uRadius: { value: radius },
      uFlatten: { value: 0 },
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
    const rf: number[] = [];
    const rd: number[] = [];
    const tan = new THREE.Vector3();
    const ta = new THREE.Vector3();
    const tb = new THREE.Vector3();
    for (const r of under) {
      const n = Math.max(2, Math.ceil((r.b - r.a) / 5));
      const base = pos.length / 3;
      // С внутренней стороны изгиба полоса не шире радиуса поворота: иначе её соседние куски
      // накладываются и рельеф штрихуется. Кривизна — по широкому окну и сглажена вдоль ленты.
      const kk: number[] = [];
      for (let i = 0; i <= n; i++) {
        const s = r.a + ((r.b - r.a) * i) / n;
        const dd = 30;
        curve.getTangentAt(Math.max(0, s - dd) / total, ta);
        curve.getTangentAt(Math.min(total, s + dd) / total, tb);
        kk.push(Math.atan2(ta.x * tb.y - ta.y * tb.x, ta.x * tb.x + ta.y * tb.y) / (2 * dd));
      }
      const ks = kk.map((_, i) => {
        let sum = 0;
        let cnt = 0;
        for (let j = Math.max(0, i - 16); j <= Math.min(n, i + 16); j++) {
          sum += kk[j];
          cnt++;
        }
        return sum / cnt;
      });
      // как развёрнута плоская лента (тот же перекрут, что в шейдере трубки): доля её ширины
      // в плоскости экрана; сглажено вдоль ленты, чтобы ширина гребня менялась плавно
      const fl: number[] = [];
      for (let i = 0; i <= n; i++) {
        const s = r.a + ((r.b - r.a) * i) / n;
        const seg = Math.min(segments, Math.max(0, Math.round((s / total) * segments)));
        const phi = s * 0.0045;
        const nn = tube.normals[seg];
        const bb = tube.binormals[seg];
        fl.push(Math.min(1, Math.hypot(Math.cos(phi) * nn.x + Math.sin(phi) * bb.x, Math.cos(phi) * nn.y + Math.sin(phi) * bb.y)));
      }
      const fs = fl.map((_, i) => {
        let sum = 0;
        let cnt = 0;
        for (let j = Math.max(0, i - 20); j <= Math.min(n, i + 20); j++) {
          sum += fl[j];
          cnt++;
        }
        return sum / cnt;
      });
      for (let i = 0; i <= n; i++) {
        const s = r.a + ((r.b - r.a) * i) / n;
        curve.getPointAt(s / total, c);
        curve.getTangentAt(s / total, tan);
        const tl = Math.hypot(tan.x, tan.y) || 1;
        const tx = tan.x / tl;
        const ty = tan.y / tl;
        const edge = Math.min(1, Math.min(s - r.a, r.b - s) / W);
        const flat = fs[i];
        const k = ks[i];
        for (const v of [-1, 1]) {
          const inner = Math.sign(k) === v;
          const w = inner ? Math.min(W, Math.max(W * 0.45, 0.9 / Math.max(Math.abs(k), 1e-6))) : W;
          pos.push(c.x - ty * w * v, c.y + tx * w * v, 0);
          rs.push(s);
          rv.push(v);
          re.push(edge * edge * (3 - 2 * edge));
          rf.push(flat);
          rd.push(w * v);
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
    ridgeGeo.setAttribute("aF", new THREE.Float32BufferAttribute(rf, 1));
    ridgeGeo.setAttribute("aD", new THREE.Float32BufferAttribute(rd, 1));
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
      uTwist: { value: 0 },
      uR: { value: radius },
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
        {
          start: g.start,
          end: g.end,
          lead: g.lead,
          doneAt: g.doneAt,
          revealEnd: g.revealEnd,
          retractStart: g.retractStart,
          retractEnd: g.retractEnd,
        },
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
        const w = grow * widthAt(s) * revealTaper(s, u.uFade.value as THREE.Vector2, u.uReveal.value as number);
        // у плоской ленты торцы срезаны ровно — шары на концах ей не нужны
        cap.visible = w > 0.05 && u.uBand.value < 0.5;
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
    setStyle(style) {
      const code = { gloss: 0, metal: 1, glass: 2, band: 3 }[style];
      const glass = style === "glass";
      for (const m of [material, ...caps.map((cap) => cap.material)]) {
        m.uniforms.uStyle.value = code;
        if (m.transparent !== glass) {
          m.transparent = glass;
          m.needsUpdate = true;
        }
      }
      const band = style === "band";
      material.uniforms.uBand.value = band ? 1 : 0;
      ridgeMat.uniforms.uTwist.value = band ? 1 : 0;
      const side = band ? THREE.DoubleSide : THREE.FrontSide;
      if (material.side !== side) {
        material.side = side;
        material.needsUpdate = true;
      }
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
