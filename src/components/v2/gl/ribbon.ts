import * as THREE from "three";

/**
 * Лента — объёмная трубка, которая «ползёт» по странице за прокруткой, как змейка:
 * голова идёт по маршруту, хвост тянется следом. Маршрут задаётся шагами, привязанными
 * к элементам с data-ribbon="ключ", поэтому он подстраивается под любую ширину экрана.
 *
 * Координаты: x = pageX − vw/2, y = vh/2 − pageY (ось Y вверх), z — глубина: z > 0 перед
 * карточками WebGL, z < 0 — за ними (так лента «обвивает» карточку).
 */

export type RibbonStep =
  /** точка внутри/около элемента: x, y — доли его ширины/высоты (можно < 0 и > 1) */
  | { at: string; x: number; y: number; z?: number; id?: string }
  /** петля-«лассо» вокруг элемента: задняя половина уходит за карточку */
  | { loop: string; pad?: number; turns?: number; from?: number; dir?: 1 | -1; squash?: number }
  /** контур знака «7», вписанный в элемент */
  | { seven: string };

/** Осевая линия знака «7» (как если бы его писали одним движением) в координатах SVG логотипа (203.3 × 285.92). */
const SEVEN_STROKE: [number, number][] = [
  [6.3, 56.8], [6.3, 6.3], [197, 6.3], [197, 61], [66.5, 285.9],
];

type Resolved = { p: THREE.Vector3; id?: string; seven?: boolean };

function rectOf(key: string) {
  const el = document.querySelector<HTMLElement>(`[data-ribbon="${key}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}

function resolve(steps: RibbonStep[], vw: number, vh: number): Resolved[] {
  const out: Resolved[] = [];
  const toGL = (px: number, py: number, z: number) => new THREE.Vector3(px - vw / 2, vh / 2 - py, z);
  for (const step of steps) {
    if ("at" in step) {
      const r = rectOf(step.at);
      if (r) out.push({ p: toGL(r.x + r.w * step.x, r.y + r.h * step.y, step.z ?? 24), id: step.id });
    } else if ("loop" in step) {
      const r = rectOf(step.loop);
      if (!r) continue;
      const pad = step.pad ?? 40;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rx = r.w / 2 + pad;
      const ry = (r.h / 2) * (step.squash ?? 0.8) + pad * 0.4;
      const turns = step.turns ?? 1.1;
      const n = Math.ceil(14 * turns);
      const dir = step.dir ?? 1;
      for (let i = 0; i <= n; i++) {
        const a = (step.from ?? Math.PI) + dir * (i / n) * turns * Math.PI * 2;
        // нижняя дуга — перед карточкой, верхняя — за ней
        const z = Math.sin(a) * 46;
        out.push({ p: toGL(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z) });
      }
    } else {
      const r = rectOf(step.seven);
      if (!r) continue;
      const s = Math.min(r.w / 203.3, r.h / 285.92);
      const ox = r.x + (r.w - 203.3 * s) / 2;
      const oy = r.y + (r.h - 285.92 * s) / 2;
      const pts = SEVEN_STROKE;
      // у каждого угла две близкие точки — сплайн проходит угол туго, а не «срезает» его
      out.push({ p: toGL(ox + pts[0][0] * s, oy + pts[0][1] * s, 30), seven: true });
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        for (const f of [0.08, 0.92]) {
          out.push({ p: toGL(ox + (ax + (bx - ax) * f) * s, oy + (ay + (by - ay) * f) * s, 30), seven: true });
        }
      }
      const [ex, ey] = pts[pts.length - 1];
      out.push({ p: toGL(ox + ex * s, oy + ey * s, 30), seven: true });
    }
  }
  return out;
}

const vertex = /* glsl */ `
  attribute float aS;
  attribute vec3 aCenter;
  uniform float uHead;
  uniform float uTail;
  uniform float uRadius;
  uniform float uTime;
  varying vec3 vN;
  varying float vS;
  void main() {
    // круглые «торцы»: у головы и хвоста трубка сходится полусферой
    float toHead = (uHead - aS) / uRadius;
    float toTail = (aS - uTail) / uRadius;
    float cap = sqrt(clamp(1.0 - pow(1.0 - clamp(min(toHead, toTail), 0.0, 1.0), 2.0), 0.0, 1.0));
    vec3 off = position - aCenter;
    vec3 p = aCenter + off * cap;
    // лёгкое «дыхание», чтобы лента была живой и без прокрутки
    p.xy += vec2(sin(aS * 0.004 + uTime * 0.9), cos(aS * 0.0033 + uTime * 0.7)) * 3.5;
    vN = normalize(normalMatrix * normalize(off));
    vS = aS;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uHead;
  uniform float uTail;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTotal;
  varying vec3 vN;
  varying float vS;
  void main() {
    if (vS > uHead || vS < uTail) discard;
    vec3 n = normalize(vN);
    vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 48.0);
    float rim = pow(1.0 - max(n.z, 0.0), 2.5);
    vec3 base = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vS * 0.0012));
    vec3 col = base * (0.42 + 0.7 * diff) + vec3(spec) * 0.75 + base * rim * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export type Ribbon = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** голова ленты (длина дуги, px) для заданной прокрутки */
  headAt(scroll: number): number;
  tailFor(head: number, vh: number): number;
  /** длина дуги у отмеченной точки маршрута (шаг с id) */
  marks: Map<string, number>;
  /** точки ленты каждые ~16px: x, y (GL-координаты страницы), s */
  samples: Float32Array;
  dispose(): void;
};

export function buildRibbon(steps: RibbonStep[], vw: number, vh: number, radius: number): Ribbon | null {
  const pts = resolve(steps, vw, vh);
  if (pts.length < 4) return null;
  const curve = new THREE.CatmullRomCurve3(
    pts.map((r) => r.p),
    false,
    "centripetal",
  );
  const DIV = 16;
  const lengths = curve.getLengths((pts.length - 1) * DIV);
  const total = lengths[lengths.length - 1];
  const S = pts.map((_, i) => lengths[i * DIV]);

  // Когда голова доходит до точки: когда точка на 62% высоты экрана. На петлях (где путь
  // идёт вверх) даём немного прокрутки на виток, но отставание не копим: следующая точка
  // снова привязана к своему месту на странице.
  const T: number[] = [];
  pts.forEach((r, i) => {
    const pageY = vh / 2 - r.p.y;
    const natural = pageY - vh * 0.62;
    T.push(i === 0 ? natural : Math.max(natural, T[i - 1] + Math.min(vh * 0.08, (S[i] - S[i - 1]) * 0.12)));
  });
  const marks = new Map<string, number>();
  pts.forEach((r, i) => r.id && marks.set(r.id, S[i]));
  const sevenIdx = pts.findIndex((r) => r.seven);
  const sevenStart = sevenIdx >= 0 ? S[sevenIdx] : null;

  const segments = Math.min(7000, Math.max(64, Math.round(total / 7)));
  const radial = 14;
  const tube = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const count = tube.attributes.position.count;
  const aS = new Float32Array(count);
  const aCenter = new Float32Array(count * 3);
  const c = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      aS[k] = (i / segments) * total;
      aCenter.set([c.x, c.y, c.z], k * 3);
    }
  }
  tube.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
  tube.setAttribute("aCenter", new THREE.BufferAttribute(aCenter, 3));

  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uHead: { value: 0 },
      uTail: { value: 0 },
      uRadius: { value: radius },
      uTime: { value: 0 },
      uTotal: { value: total },
      uColorA: { value: new THREE.Color("#00bbc4") },
      uColorB: { value: new THREE.Color("#3fd3db") },
    },
  });
  // цвета передаём «как есть»: рендер без преобразования цветового пространства
  (material.uniforms.uColorA.value as THREE.Color).setRGB(0, 0.733, 0.769);
  (material.uniforms.uColorB.value as THREE.Color).setRGB(0.247, 0.827, 0.859);
  const mesh = new THREE.Mesh(tube, material);
  mesh.frustumCulled = false;

  const nSamples = Math.ceil(total / 16);
  const samples = new Float32Array((nSamples + 1) * 3);
  for (let i = 0; i <= nSamples; i++) {
    curve.getPointAt(i / nSamples, c);
    samples.set([c.x, c.y, (i / nSamples) * total], i * 3);
  }

  return {
    mesh,
    marks,
    samples,
    headAt(scroll) {
      if (scroll <= T[0]) return S[0] - (T[0] - scroll) * 0.0;
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
    dispose() {
      tube.dispose();
      material.dispose();
    },
  };
}
