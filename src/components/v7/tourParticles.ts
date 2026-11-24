import * as THREE from "three";

import { SEVEN_PATH, WORDMARK_PATHS } from "@/components/Logo";

/**
 * Частицы сцены глобуса /v7: те же облака точек продуктов, что в «Своих продуктах» (public/v5/products.bin,
 * у всех семи форм одинаковое число точек, i-я точка одной формы переходит в i-ю точку другой).
 * Вход — продукт вырастает из карты: вокруг точки кольцом загораются точки земли, затем по спирали
 * поднимаются и собираются в форму. Смена продукта — как в «Своих продуктах»: точки срываются
 * потоком, закручиваются и собираются в следующую форму, а сама форма перелетает над картой
 * к следующей точке. Финал: форма тает, по границе Казахстана бежит огонёк — с запада
 * через юг, восток и север; за ним точки контура одна за другой срываются и дугой летят в логотип
 * Seven Hills of Kazakhstan, и он выстраивается слева направо (точки сняты с SVG логотипа).
 */

export const SHAPES = 7;
/** Окно логотипа в единицах SVG (как у Logo/LogoReveal). */
export const LOGO_BOX = { x: -40, y: -60, w: 1190, h: 400 } as const;
/** Надпись в SVG логотипа сдвинута по Y (см. Logo.tsx). */
export const WORDMARK_SHIFT = -43.12;

const vertex = /* glsl */ `
  attribute vec4 aP0; attribute vec4 aP1; attribute vec4 aP2; attribute vec4 aP3;
  attribute vec4 aP4; attribute vec4 aP5; attribute vec4 aP6;
  attribute vec2 aRnd;
  attribute vec3 aLogo; // x, y — место в логотипе (−0.5…0.5), z — 1 для знака «7», 0 для букв
  attribute vec4 aBorder; // xyz — точка на границе Казахстана (мир), w — место вдоль границы 0…1

  uniform float uWa[${SHAPES}]; // форма, из которой перетекаем
  uniform float uWb[${SHAPES}]; // форма, в которую перетекаем
  uniform float uF;      // 0…1 — доля перехода (поток сильнее всего посередине)
  uniform vec3 uC;       // центр формы в мире
  uniform mat3 uB;       // оси формы (восток, вверх, юг) × размер
  uniform float uSpin;
  uniform float uTime;
  uniform float uEnter;  // 0 — точки лежат на карте вокруг точки, 1 — собраны в форму
  uniform float uGround; // уровень карты в единицах облака (под центром формы)
  uniform float uOut;    // 0…1 — последняя форма тает
  uniform float uRun;    // 0…1.5 — огонёк по границе (0…1), за ним точки по очереди летят в логотип
  uniform vec3 uLogoC; uniform vec3 uLogoR; uniform vec3 uLogoU;
  uniform float uPx;     // размер точки в пикселях на расстоянии 0.3 от камеры

  varying float vAcc;
  varying float vStream;
  varying float vSign;
  varying float vLogo;
  varying float vPhase;
  varying float vVis;
  varying float vBorder;
  varying float vHead;

  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  void main() {
    vec4 pa = aP0 * uWa[0] + aP1 * uWa[1] + aP2 * uWa[2] + aP3 * uWa[3] + aP4 * uWa[4] + aP5 * uWa[5] + aP6 * uWa[6];
    vec4 pb = aP0 * uWb[0] + aP1 * uWb[1] + aP2 * uWb[2] + aP3 * uWb[3] + aP4 * uWb[4] + aP5 * uWb[5] + aP6 * uWb[6];
    vec4 p = mix(pa, pb, uF);
    vec3 q = p.xyz * 1.5;

    // переход: точку срывает потоком и закручивает вокруг вертикали, к концу она садится на место
    float flow = sin(3.14159 * uF) * (0.5 + 0.9 * aRnd.x);
    vec3 cq = q * 1.3 + vec3(0.0, uTime * 0.4, 0.0);
    vec3 curl = vec3(sin(cq.y * 2.1 + uTime + aRnd.y * 6.0), sin(cq.z * 1.7 + uTime * 1.3), sin(cq.x * 1.9 - uTime * 0.8));
    q += curl * 0.38 * flow;
    q.xz = rot(flow * 1.1 * (aRnd.y - 0.35)) * q.xz;
    q.xz = rot(uSpin) * q.xz;

    // вход: продукт вырастает из карты. Точки лежат на земле диском вокруг точки, загораются
    // расходящимся кольцом, затем — от края к центру — по спирали поднимаются в форму
    vStream = 0.0;
    float enterVis = 1.0;
    if (uEnter < 1.0) {
      float ang = fract(aRnd.x * 91.7 + aRnd.y * 13.1) * 6.28318;
      float rr = sqrt(fract(aRnd.y * 57.3 + aRnd.x * 3.7));
      vec3 g = vec3(cos(ang) * rr * 3.2, uGround, sin(ang) * rr * 3.2);
      enterVis = smoothstep(rr - 0.18, rr, uEnter * 2.4);
      float lt = clamp((uEnter - 0.3 - (1.0 - rr) * 0.3) / 0.4, 0.0, 1.0);
      float lk = lt * lt * (3.0 - 2.0 * lt);
      vec3 m = mix(g, q, lk);
      m.xz = rot((1.0 - lk) * 2.4 * (0.6 + aRnd.x)) * m.xz;
      m.y += sin(3.14159 * lk) * 0.6 * aRnd.y;
      q = mix(q, m, step(0.0001, 1.0 - lk));
      vStream = (1.0 - lk) * enterVis;
    }
    vec3 pos = uC + uB * q;

    // финал, шаг 1: форма тает и разлетается
    pos += (pos - uC) * uOut * 1.2;
    float formVis = 1.0 - smoothstep(0.0, 0.5, uOut);

    // шаг 2: огонёк бежит по границе страны — с запада через юг, восток и север (aBorder.w —
    // место точки на этом пути); за ним одна за другой загораются точки контура
    float s = aBorder.w;
    float lit = smoothstep(s, s + 0.03, uRun);
    float atB = step(0.0001, lit);
    pos = mix(pos, aBorder.xyz, atB);
    vVis = mix(formVis, lit, atB);
    vHead = atB * (1.0 - smoothstep(0.0, 0.06, uRun - s));

    // шаг 3: вскоре после того, как точка загорелась, она срывается с контура и дугой летит
    // в своё место в логотипе. Места в логотипе разложены слева направо в том же порядке,
    // что и путь по границе, — логотип выстраивается от знака «7» к последней букве
    float lt = clamp((uRun - s - 0.08) / 0.4, 0.0, 1.0);
    float lk = lt * lt * (3.0 - 2.0 * lt);
    vec3 logo = uLogoC + uLogoR * aLogo.x + uLogoU * aLogo.y;
    vec3 ctrl = mix(pos, logo, 0.45) + normalize(pos) * (0.1 + 0.12 * aRnd.y);
    float il = 1.0 - lk;
    pos = il * il * pos + 2.0 * il * lk * ctrl + lk * lk * logo;
    vLogo = smoothstep(0.75, 1.0, lk);
    vBorder = atB * (1.0 - vLogo);
    vHead *= 1.0 - lk;
    vSign = aLogo.z;
    vVis *= enterVis;

    // в покое — еле заметное дыхание
    pos += 0.00025 * vec3(sin(uTime * 1.7 + aRnd.x * 40.0), sin(uTime * 1.3 + aRnd.y * 40.0), 0.0) * (1.0 - lk);

    vAcc = p.w * (1.0 - atB);
    vPhase = length(p.xyz) * 7.0 + aRnd.x * 0.8;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uPx * 0.3 / max(-mv.z, 0.02) * (1.0 + vAcc * 0.35) * mix(1.0, 1.25, flow) * mix(1.0, 2.6, vBorder) * mix(1.0, 1.8, vHead) * mix(1.0, 0.8, vLogo);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uAlpha;
  varying float vAcc;
  varying float vStream;
  varying float vSign;
  varying float vLogo;
  varying float vPhase;
  varying float vVis;
  varying float vBorder;
  varying float vHead;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.3, d);
    if (disc <= 0.0) discard;
    vec3 base = vec3(0.74, 0.87, 0.89);
    vec3 acc = vec3(0.3, 0.92, 0.96);
    float pulse = 0.65 + 0.35 * sin(uTime * 3.0 - vPhase);
    vec3 col = mix(mix(base, acc, vAcc), acc, smoothstep(0.0, 0.4, vStream));
    float a = mix(0.55, 0.95 * pulse, vAcc);
    a = mix(a, 0.9, smoothstep(0.0, 0.4, vStream));
    // на контуре и в полёте — яркая бирюза
    col = mix(col, vec3(0.45, 0.95, 0.98), vBorder);
    a = mix(a, 0.95, vBorder);
    // голова огонька — почти белая
    col = mix(col, vec3(0.9, 1.0, 1.0), vHead);
    // логотип: знак — фирменная бирюза, буквы — белые
    col = mix(col, mix(vec3(0.95, 0.97, 0.97), vec3(0.0, 0.733, 0.769), vSign), vLogo);
    a = mix(a, 0.9, vLogo);
    a *= disc * uAlpha * vVis;
    gl_FragColor = vec4(col * a, a);
  }
`;

export function createTourMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uWa: { value: new Array<number>(SHAPES).fill(0) },
      uWb: { value: new Array<number>(SHAPES).fill(0) },
      uF: { value: 0 },
      uC: { value: new THREE.Vector3() },
      uB: { value: new THREE.Matrix3() },
      uSpin: { value: 0 },
      uTime: { value: 0 },
      uEnter: { value: 0 },
      uGround: { value: -1 },
      uOut: { value: 0 },
      uRun: { value: 0 },
      uLogoC: { value: new THREE.Vector3() },
      uLogoR: { value: new THREE.Vector3(1, 0, 0) },
      uLogoU: { value: new THREE.Vector3(0, 1, 0) },
      uPx: { value: 2 },
      uAlpha: { value: 0 },
    },
  });
}

/** Геометрия частиц: облака семи продуктов из products.bin + место каждой точки в логотипе. */
export async function loadTourGeometry(signal: AbortSignal) {
  const res = await fetch("/v5/products.bin", { signal });
  if (!res.ok) throw new Error(`products.bin: ${res.status}`);
  const data = await res.arrayBuffer();
  const [n, s] = new Uint32Array(data, 0, 2);
  if (s < SHAPES) throw new Error(`products.bin: облаков ${s}, нужно ${SHAPES}`);
  const g = new THREE.BufferGeometry();
  for (let k = 0; k < SHAPES; k++) {
    g.setAttribute(`aP${k}`, new THREE.BufferAttribute(new Int16Array(data, 8 + k * n * 8, n * 4), 4, true));
  }
  const rnd = new Float32Array(n * 2);
  for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
  g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 2));
  g.setAttribute("aLogo", new THREE.BufferAttribute(sampleLogo(n), 3));
  // точки на границе страны заполняет сцена, когда загрузит контур (setBorder)
  g.setAttribute("aBorder", new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  // позиции считает шейдер; position нужен three.js только для числа вершин
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return g;
}

/**
 * n точек по заливке логотипа: SVG-контуры рисуются на холсте, точки берутся из закрашенных пикселей
 * (знак «7» отдельно от букв — у них свой цвет). Плотность везде одинаковая — по площади.
 */
function sampleLogo(n: number) {
  const W = LOGO_BOX.w;
  const H = LOGO_BOX.h;
  const out = new Float32Array(n * 3);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return out;
  const mask = (draw: () => void) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(-LOGO_BOX.x, -LOGO_BOX.y);
    ctx.fillStyle = "#fff";
    draw();
    const px = ctx.getImageData(0, 0, W, H).data;
    const idx: number[] = [];
    for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] > 127) idx.push(i);
    return idx;
  };
  const sign = mask(() => ctx.fill(new Path2D(SEVEN_PATH)));
  const letters = mask(() => {
    ctx.translate(0, WORDMARK_SHIFT);
    WORDMARK_PATHS.forEach((d) => ctx.fill(new Path2D(d)));
  });
  const total = sign.length + letters.length;
  if (!total) return out;
  const pts: { x: number; y: number; sign: number; key: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(Math.random() * total);
    const isSign = r < sign.length;
    const p = isSign ? sign[r] : letters[r - sign.length];
    const x = (p % W) + Math.random();
    const y = Math.floor(p / W) + Math.random();
    pts.push({ x: x / W - 0.5, y: 0.5 - y / H, sign: isSign ? 1 : 0, key: x / W + (Math.random() - 0.5) * 0.04 });
  }
  // слева направо (с лёгким разбросом, чтобы фронт сборки был живым): i-я точка контура
  // в порядке пути по границе садится в i-е место — логотип растёт от «7» к последней букве
  pts.sort((a, b) => a.key - b.key);
  pts.forEach((p, i) => out.set([p.x, p.y, p.sign], i * 3));
  return out;
}

/**
 * Раскладывает точки частиц равномерно вдоль контура страны (замкнутая ломаная в мире):
 * у i-й точки — место на границе и доля пути вдоль неё (по ней идут волны финала).
 */
export function setBorder(g: THREE.BufferGeometry, ringIn: THREE.Vector3[]) {
  const attr = g.getAttribute("aBorder") as THREE.BufferAttribute;
  const n = attr.count;
  // путь по границе: от самой западной точки, сначала на юг (дальше — восток и север)
  const lon = (v: THREE.Vector3) => Math.atan2(-v.z, v.x);
  let w = 0;
  ringIn.forEach((v, i) => {
    if (lon(v) < lon(ringIn[w])) w = i;
  });
  const m = ringIn.length;
  const goesSouth = ringIn[(w + 5) % m].y < ringIn[(w - 5 + m) % m].y;
  const ring = Array.from({ length: m }, (_, i) => ringIn[(w + (goesSouth ? i : -i) + m * 2) % m]);
  const cum = [0];
  for (let i = 1; i <= m; i++) cum.push(cum[i - 1] + ring[i % m].distanceTo(ring[i - 1]));
  const total = cum[m];
  const out = attr.array as Float32Array;
  const v = new THREE.Vector3();
  let seg = 0;
  // точки идут вдоль границы по порядку, с лёгким разбросом поперёк — линия выглядит живой
  for (let i = 0; i < n; i++) {
    const s = (i / n) * total;
    while (seg < m - 1 && cum[seg + 1] < s) seg++;
    const a = ring[seg];
    const b = ring[(seg + 1) % m];
    v.lerpVectors(a, b, (s - cum[seg]) / (cum[seg + 1] - cum[seg] || 1));
    v.x += (Math.random() - 0.5) * 0.003;
    v.y += (Math.random() - 0.5) * 0.003;
    v.z += (Math.random() - 0.5) * 0.003;
    v.setLength(1.006);
    out.set([v.x, v.y, v.z, s / total], i * 4);
  }
  attr.needsUpdate = true;
}
