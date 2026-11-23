import * as THREE from "three";

/**
 * Плоская бирюзовая лента для сцены глобуса /v6 (как лента страницы, но в 3D-сцене глобуса):
 * полоса из пар вершин вдоль осевой линии, у каждой точки — направление ширины и нормаль.
 * Видна только часть [uTail, uHead] по длине (aS — длина дуги от начала), uAlpha — общая прозрачность.
 */

const vertex = /* glsl */ `
  attribute float aS;
  attribute vec3 aN;
  varying float vS;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vS = aS;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * aN);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform float uHead;
  uniform float uTail;
  uniform float uAlpha;
  uniform float uFlat; // 1 — ровный фирменный цвет знака (#00bbc4), чтобы незаметно передать рамку SVG-знаку
  varying float vS;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    if (vS > uHead || vS < uTail || uAlpha < 0.01) discard;
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(vView);
    vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(n, normalize(L + v)), 0.0), 40.0);
    // атлас в бирюзе: тень — глубокая бирюза, свет — светлая, блик почти белый
    vec3 c = mix(vec3(0.0, 0.36, 0.40), vec3(0.16, 0.78, 0.82), diff);
    c += vec3(0.75, 0.97, 0.98) * spec * 0.55;
    c = mix(c, vec3(0.0, 0.733, 0.769), uFlat);
    gl_FragColor = vec4(c * uAlpha, uAlpha);
  }
`;

export type Band = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** перестроить полосу по точкам; side(i) — направление ширины и нормаль в точке i; width(i) — полуширина */
  set(points: THREE.Vector3[], frame: (i: number, tangent: THREE.Vector3, s: number) => { w: THREE.Vector3; n: THREE.Vector3 }, width: (i: number) => number): number;
};

/** Лента на n точек осевой линии (число точек фиксировано, точки можно менять каждый кадр). */
export function createBand(n: number): Band {
  const pos = new Float32Array(n * 2 * 3);
  const nrm = new Float32Array(n * 2 * 3);
  const s = new Float32Array(n * 2);
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aN", new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute("aS", new THREE.BufferAttribute(s, 1));
  geo.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uHead: { value: 0 }, uTail: { value: -1 }, uAlpha: { value: 1 }, uFlat: { value: 0 } },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const t = new THREE.Vector3();

  return {
    mesh,
    set(points, frame, width) {
      let len = 0;
      for (let i = 0; i < n; i++) {
        const p = points[i];
        if (i > 0) len += p.distanceTo(points[i - 1]);
        const a = points[Math.max(0, i - 1)];
        const b = points[Math.min(n - 1, i + 1)];
        t.subVectors(b, a).normalize();
        const { w, n: nn } = frame(i, t, len);
        const hw = width(i);
        for (let k = 0; k < 2; k++) {
          const j = (i * 2 + k) * 3;
          const sg = k === 0 ? -hw : hw;
          pos[j] = p.x + w.x * sg;
          pos[j + 1] = p.y + w.y * sg;
          pos[j + 2] = p.z + w.z * sg;
          nrm[j] = nn.x;
          nrm[j + 1] = nn.y;
          nrm[j + 2] = nn.z;
          s[i * 2 + k] = len;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aN.needsUpdate = true;
      geo.attributes.aS.needsUpdate = true;
      return len;
    },
  };
}

/**
 * Осевая линия рамки знака «7» логотипа в единицах SVG логотипа (как в Logo.tsx): лента входит снизу,
 * в остриё диагонали, поднимается по диагонали, идёт по верхней планке справа налево и спускается
 * по левому крючку. У углов — дополнительные точки, чтобы сплайн не скруглял их сильно.
 */
export const SEVEN_STROKE: [number, number][] = [
  [66.5, 285.9],
  [190.5, 73.5],
  [196.65, 62.5],
  [196.65, 18],
  [194, 8.5],
  [185, 6.26],
  [18, 6.26],
  [8.5, 8.5],
  [6.26, 18],
  [6.26, 56.8],
];
/** Полуширина штриха рамки «7» в единицах SVG логотипа. */
export const SEVEN_HALF = 6.26;
