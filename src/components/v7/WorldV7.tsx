"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useTheme } from "@/components/ThemeToggle";
import { createBand } from "@/components/v6/globeRibbon";
import { worldV7 } from "@/content/v7";

/**
 * «Международное присутствие» /v7 — вместо закреплённой сцены глобуса /v6 обычный статичный блок:
 * слева тексты с сайта компании (три команды — Казахстан, ОАЭ, Чехия), справа — большой глобус из
 * точек без рамки, прямо на фоне страницы (тело шара — цвета страницы, в обеих темах): центр шара
 * чуть выше края блока, и он выглядывает верхней частью из-за серой полосы «Контактов» — секция
 * обрезает его по низу. Шар наклонён к зрителю так, что страна в фокусе стоит посередине видимой
 * над полосой части, а по умолчанию по центру — Казахстан. Шар можно крутить
 * мышью или пальцем (с инерцией) — отпустил, и он плавно возвращается к стране в фокусе. Когда блок
 * впервые на виду, глобус доворачивается с востока, а точки суши проступают волной от Казахстана.
 * Казахстан — 20 огоньков, по одному на область (разбегаются из Астаны, мерцают), дуг нет.
 * ОАЭ или Чехия — огоньки областей по очереди стекаются в Астану и цепочкой летят по дуге к городу,
 * сами её прорисовывая; долетев, гаснут, по готовой дуге дальше бежит один огонёк. Обратно к
 * Казахстану — летят назад по дуге (она сматывается за последним) и снова разбегаются по областям.
 * Между ОАЭ и Чехией прежняя дуга сматывается к своему городу, новая вылетает из Астаны.
 * Страны листаются сами, по времени (STEP_MS, только пока блок на экране); по клику на команду
 * глобус поворачивается к её стране, отсчёт начинается заново. Лента страницы до блока не доходит.
 */

const STEP_MS = 3800;
const DEG = Math.PI / 180;
const FOV = 32;
/** Длительность волны проявления, с. */
const REVEAL_S = 2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => v * v * (3 - 2 * v);

/** Огоньки областей: задержка между соседними, сбор в Астану, полёт по дуге, обратно, разбег, с. */
const STAGGER = 0.026;
const GATHER_S = 0.5;
const FLY_S = 0.9;
const BACK_S = 0.8;
const SPREAD_S = 0.7;
/** Центры 20 областей Казахстана (17 областей и Астана, Алматы, Шымкент): lat, lon. */
const REGIONS: [number, number][] = [
  [51.17, 71.45], // Астана
  [43.24, 76.89], // Алматы
  [42.32, 69.59], // Шымкент
  [53.28, 69.39], // Акмолинская — Кокшетау
  [50.28, 57.21], // Актюбинская — Актобе
  [43.87, 77.07], // Алматинская — Конаев
  [47.11, 51.92], // Атырауская — Атырау
  [49.95, 82.61], // Восточно-Казахстанская — Усть-Каменогорск
  [42.9, 71.37], // Жамбылская — Тараз
  [51.23, 51.37], // Западно-Казахстанская — Уральск
  [49.8, 73.1], // Карагандинская — Караганда
  [53.21, 63.62], // Костанайская — Костанай
  [44.85, 65.51], // Кызылординская — Кызылорда
  [43.65, 51.2], // Мангистауская — Актау
  [52.29, 76.97], // Павлодарская — Павлодар
  [54.87, 69.15], // Северо-Казахстанская — Петропавловск
  [43.3, 68.25], // Туркестанская — Туркестан
  [50.41, 80.23], // Абай — Семей
  [45.02, 78.37], // Жетысу — Талдыкорган
  [47.8, 67.71], // Улытау — Жезказган
];

const sites = worldV7.sites;

function toVec(lat: number, lon: number, r = 1) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

/** Повороты группы, при которых точка (lat, lon) смотрит прямо в камеру. */
function facing(lat: number, lon: number) {
  return { x: lat * DEG, y: -lon * DEG - Math.PI / 2 };
}

/** Цвета по теме: тело шара — цвет страницы, точки суши — как у глобуса /v6. */
const PALETTE = {
  light: {
    body: new THREE.Color("#fbfbfa"),
    dots: new THREE.Vector3(0.32, 0.4, 0.42),
    dotsAlpha: 0.5,
    kz: new THREE.Color("#00a3ab"),
    other: new THREE.Color("#3cc4cc"),
    rim: 0.3,
    halo: 0.32,
  },
  dark: {
    body: new THREE.Color("#050708"),
    dots: new THREE.Vector3(0.55, 0.66, 0.68),
    dotsAlpha: 0.42,
    kz: new THREE.Color("#00bbc4"),
    other: new THREE.Color("#8fe8ed"),
    rim: 0.5,
    halo: 0.55,
  },
} as const;

/** Точки суши; страны (aKind 1–3) подсвечиваются по uGlow; uReveal — фронт волны (угол от Казахстана). */
const dotsVertex = /* glsl */ `
  attribute float aKind;
  uniform float uSize;
  uniform vec3 uGlow; // яркость Казахстана, ОАЭ, Чехии
  uniform vec3 uBase;
  uniform float uBaseAlpha;
  uniform vec3 uKz;
  uniform vec3 uOther;
  uniform vec3 uOrigin; // Казахстан, единичный вектор в координатах глобуса
  uniform float uReveal;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * position);
    float front = smoothstep(-0.15, 0.55, n.z);
    float g = aKind == 1.0 ? uGlow.x : aKind == 2.0 ? uGlow.y : aKind == 3.0 ? uGlow.z : 0.0;
    // страны видны всегда (слегка), при фокусе — ярко
    g = aKind > 0.5 ? max(g, 0.3) : 0.0;
    // волна: точка проявляется, когда фронт проходит её угол от Казахстана; на фронте — вспышка
    float ang = acos(clamp(dot(normalize(position), uOrigin), -1.0, 1.0));
    float shown = smoothstep(uReveal, uReveal - 0.35, ang);
    float crest = smoothstep(0.3, 0.0, abs(ang - uReveal + 0.12)) * step(uReveal, 3.6);
    vColor = mix(mix(uBase, aKind == 1.0 ? uKz : uOther, g), uKz, crest * 0.8);
    vAlpha = front * shown * min(1.0, mix(uBaseAlpha, 1.0, g) + crest * 0.6);
    gl_PointSize = uSize * (aKind > 0.5 ? 0.9 + g * 0.35 : 1.0) * (1.0 + crest * 0.5) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const dotsFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.2, d);
    gl_FragColor = vec4(vColor * a, a);
  }
`;

/** Огоньки на дугах: мягкое бирюзовое пятно со светлой серединой. */
const sparkVertex = /* glsl */ `
  attribute float aAlpha;
  uniform float uSize;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vAlpha = aAlpha;
    gl_PointSize = uSize / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const sparkFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = vAlpha * pow(smoothstep(0.5, 0.0, d), 1.6);
    vec3 c = mix(vec3(0.0, 0.73, 0.77), vec3(0.85, 1.0, 1.0), smoothstep(0.18, 0.0, d));
    gl_FragColor = vec4(c * a, a);
  }
`;

/** Нормаль и направление на камеру в пространстве вида — для кромки шара и ореола. */
const FRESNEL_VERTEX = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

/** Дуга над поверхностью от a к b: по большому кругу, приподнята к середине. */
function arcPoints(a: THREE.Vector3, b: THREE.Vector3, n: number) {
  const ua = a.clone().normalize();
  const ub = b.clone().normalize();
  const angle = ua.angleTo(ub);
  const lift = 0.06 + angle * 0.32;
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3().crossVectors(ua, ub).normalize();
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    q.setFromAxisAngle(axis, angle * t);
    return ua
      .clone()
      .applyQuaternion(q)
      .multiplyScalar(1.01 + lift * Math.sin(Math.PI * t));
  });
}

/**
 * Дистанция камеры — постоянная: радиус шара на холсте тогда известен заранее и задаётся в CSS
 * (GLOBE_FILL — доля стороны квадратного холста; угловой радиус сферы — asin(1/z)).
 */
const VIEW_Z = 4.4;
export const GLOBE_FILL = 0.5 / (Math.sqrt(VIEW_Z * VIEW_Z - 1) * Math.tan((FOV / 2) * DEG));
/**
 * Широта, которая видна посередине части шара над полосой (центр шара — на 0,1 радиуса выше края
 * секции, верх — на 1,1 радиуса): наклон к зрителю = широта фокуса − VIEW_LAT.
 */
const VIEW_LAT = 27 * DEG;
/** Середина Казахстана (не Астана — она на севере) — по ней ставим страну по центру. */
const KZ_MID = { lat: 48, lon: 67 };

/** Глобус без рамки; active — страна в фокусе (индекс в worldV7.sites), play — блок на экране. */
function Globe({ active, play }: { active: number; play: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<(HTMLDivElement | null)[]>([]);
  const activeRef = useRef(active);
  const playRef = useRef(play);
  const dark = useTheme() === "dark";
  const darkRef = useRef(dark);
  /** перетаскивание: смещение поворота от ракурса страны, скорость и состояние жеста */
  const dragRef = useRef({ on: false, id: -1, x: 0, y: 0, offX: 0, offY: 0, vx: 0, vy: 0, t: 0 });
  useEffect(() => {
    activeRef.current = active;
    playRef.current = play;
    darkRef.current = dark;
  }, [active, play, dark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
    camera.position.set(0, 0, VIEW_Z);
    const globe = new THREE.Group();
    scene.add(globe);

    // тело шара — цвета страницы (закрывает точки обратной стороны), по краю — бирюзовая кромка
    const bodyMat = new THREE.ShaderMaterial({
      uniforms: { uBody: { value: new THREE.Color() }, uRim: { value: 0 } },
      vertexShader: FRESNEL_VERTEX,
      fragmentShader: `uniform vec3 uBody; uniform float uRim; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.0); gl_FragColor = vec4(mix(uBody, vec3(0.0,0.6,0.64), rim * uRim), 1.0); }`,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 64), bodyMat);
    body.renderOrder = -1;
    globe.add(body);
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uHalo: { value: 0 } },
      vertexShader: FRESNEL_VERTEX,
      // свечение у края глобуса, к внешнему краю ореола сходит на нет — по направлению взгляда,
      // иначе в перспективе на силуэте ореола остаётся тонкое кольцо
      fragmentShader: `uniform float uHalo; varying vec3 vN; varying vec3 vV; void main(){ float c = abs(dot(normalize(vN), normalize(vV))); float i = pow(smoothstep(0.0, 0.5, c), 2.0) * uHalo; gl_FragColor = vec4(vec3(0.0,0.73,0.77) * i, i); }`,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.18, 64, 64), haloMat));

    const [kz, ae, cz] = sites;
    const kzVec = toVec(kz.lat, kz.lon, 1.015);
    const dotsMat = new THREE.ShaderMaterial({
      vertexShader: dotsVertex,
      fragmentShader: dotsFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uSize: { value: 9 },
        uGlow: { value: new THREE.Vector3() },
        uBase: { value: new THREE.Vector3() },
        uBaseAlpha: { value: 0.5 },
        uKz: { value: new THREE.Color() },
        uOther: { value: new THREE.Color() },
        uOrigin: { value: kzVec.clone().normalize() },
        uReveal: { value: 0 },
      },
    });
    let cancelled = false;
    const outlineMats: THREE.MeshBasicMaterial[] = [];
    fetch("/v2/globe.json")
      .then((r) => r.json() as Promise<{ points: number[]; outlines: Record<string, number[][]> }>)
      .then(({ points: data, outlines }) => {
        if (cancelled) return;
        const n = data.length / 3;
        const pos = new Float32Array(n * 3);
        const kind = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const v = toVec(data[i * 3], data[i * 3 + 1], 1.002);
          pos.set([v.x, v.y, v.z], i * 3);
          kind[i] = data[i * 3 + 2];
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
        globe.add(new THREE.Points(g, dotsMat));
        // контуры трёх стран — тонкие трубки по границе
        for (const [mark, rings] of Object.entries(outlines)) {
          const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
          outlineMats[Number(mark) - 1] = mat;
          for (const ring of rings) {
            const pts: THREE.Vector3[] = [];
            for (let i = 0; i < ring.length; i += 2) pts.push(toVec(ring[i], ring[i + 1], 1.004));
            if (pts.length < 4) continue;
            const path = new THREE.CatmullRomCurve3(pts, true);
            globe.add(new THREE.Mesh(new THREE.TubeGeometry(path, Math.min(1200, pts.length * 2), 0.0022, 4, true), mat));
          }
        }
      })
      .catch(() => {});

    // дуги Астана → Дубай и Астана → Прага: плоская бирюзовая лента, лицом наружу
    const ARC_N = 160;
    const ARC_HW = 0.0065;
    const radial = new THREE.Vector3();
    const arcs = [ae, cz].map((s) => {
      const pts = arcPoints(kzVec, toVec(s.lat, s.lon, 1.015), ARC_N);
      const band = createBand(ARC_N);
      const len = band.set(
        pts,
        (i, T) => {
          radial.copy(pts[i]).normalize();
          const w = new THREE.Vector3().crossVectors(T, radial).normalize();
          return { w, n: new THREE.Vector3().crossVectors(w, T).normalize() };
        },
        (i) => ARC_HW * Math.min(1, i / 10, (ARC_N - 1 - i) / 10),
      );
      band.mesh.material.uniforms.uTail.value = 0;
      globe.add(band.mesh);
      const cumul: number[] = [];
      pts.forEach((v, i) => cumul.push(i ? cumul[i - 1] + v.distanceTo(pts[i - 1]) : 0));
      return { pts, cumul, len, band, head: 0, tail: 0 };
    });
    /** точка дуги на длине s */
    const pointAt = (arc: (typeof arcs)[number], s: number, out: THREE.Vector3) => {
      let i = 1;
      while (i < arc.cumul.length - 1 && arc.cumul[i] < s) i++;
      const a = arc.cumul[i - 1];
      const t = (s - a) / Math.max(1e-6, arc.cumul[i] - a);
      return out.lerpVectors(arc.pts[i - 1], arc.pts[i], Math.min(1, Math.max(0, t)));
    };

    // огоньки: по одному на дугу, бегут из Астаны к городу
    const sparkPos = new Float32Array(arcs.length * 3);
    const sparkAlpha = new Float32Array(arcs.length);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute("aAlpha", new THREE.BufferAttribute(sparkAlpha, 1));
    const sparkMat = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uSize: { value: 60 } },
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;
    globe.add(sparks);

    // огоньки областей: те же пятна, мельче; cur — где каждый сейчас, start — где был при смене страны
    const REG_N = REGIONS.length;
    const regionAt = REGIONS.map(([la, lo]) => toVec(la, lo, 1.012));
    const astana = toVec(kz.lat, kz.lon, 1.012);
    const regPos = new Float32Array(REG_N * 3);
    const regAlpha = new Float32Array(REG_N);
    const regGeo = new THREE.BufferGeometry();
    regGeo.setAttribute("position", new THREE.BufferAttribute(regPos, 3));
    regGeo.setAttribute("aAlpha", new THREE.BufferAttribute(regAlpha, 1));
    const regMat = sparkMat.clone();
    const regs = new THREE.Points(regGeo, regMat);
    regs.frustumCulled = false;
    globe.add(regs);
    const cur = regionAt.map(() => astana.clone());
    const curA = new Array<number>(REG_N).fill(0);
    const start = regionAt.map(() => astana.clone());
    const startA = new Array<number>(REG_N).fill(0);
    /** страна, под которую сейчас стоят огоньки (−1 — ещё никакая), предыдущая и время с перехода */
    let mode = -1;
    let prevMode = -1;
    let modeT = 0;

    // метки городов: кольцо-пульс
    const rings = sites.map((p) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.018, 0.026, 48),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      const v = toVec(p.lat, p.lon, 1.006);
      m.position.copy(v);
      m.lookAt(v.clone().multiplyScalar(2));
      globe.add(m);
      return m;
    });

    let fit = 1;
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      // холст большой (шар выглядывает из-за полосы лишь частью) — плотность пикселей ограничиваем
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // холст квадратный; если вдруг уже, чем выше, — отходим, чтобы шар помещался по ширине
      fit = Math.max(1, 1 / camera.aspect);
      dotsMat.uniforms.uSize.value = 9 * dpr * Math.min(1.4, Math.max(0.8, h / 900));
      sparkMat.uniforms.uSize.value = 60 * dpr * Math.min(1.4, Math.max(0.8, h / 900));
      regMat.uniforms.uSize.value = 38 * dpr * Math.min(1.4, Math.max(0.8, h / 900));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ракурсы: Казахстан — по центру видимой части; ОАЭ и Чехия — между ними и Астаной, чтобы была
    // видна дуга. Наклон к зрителю — чтобы фокус стоял посередине над полосой (VIEW_LAT)
    const t = sites.map((s) => facing(s.lat, s.lon));
    const mid = facing(KZ_MID.lat, KZ_MID.lon);
    const pitch = (x: number) => Math.max(4 * DEG, x - VIEW_LAT);
    const views = [
      { x: pitch(mid.x), y: mid.y },
      { x: pitch((t[0].x + t[1].x) / 2), y: (t[0].y + t[1].y) / 2 },
      { x: pitch((t[0].x + t[2].x) / 2), y: (t[1].y + t[2].y) / 2 + 0.2 },
    ];
    // старт — глобус довёрнут к Казахстану с востока, точек ещё нет; всё начинается, когда блок на виду
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rx = reduced ? views[0].x : views[0].x + 0.3;
    let ry = reduced ? views[0].y : views[0].y + 1.6;
    let reveal = reduced ? REVEAL_S : 0;
    let started = reduced;
    let time = 0;
    const glow = [0, 0, 0];
    const tmp = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, clock.getDelta());
      const r = canvas.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      if (!started) {
        // до первого появления холст пустой: цвета темы ещё не выставлены
        if (!playRef.current) return;
        started = true;
      }
      time += dt;
      const pal = PALETTE[darkRef.current ? "dark" : "light"];
      const a = activeRef.current;
      const k = 1 - Math.exp(-dt * 3);

      // волна проявления и вход: кромка, ореол и контуры проявляются вместе с ней
      reveal = Math.min(REVEAL_S, reveal + dt);
      const intro = reveal / REVEAL_S;
      const v = views[a];
      const kRot = 1 - Math.exp(-dt * (intro < 1 ? 2.2 : 3));
      rx += (v.x - rx) * kRot;
      ry += (v.y + Math.sin(time * 0.25) * 0.06 - ry) * kRot;
      // перетаскивание: пока держат — смещение от ракурса; отпустили — докручивается по инерции
      // и через полсекунды покоя пружиной возвращается к стране (кратчайшим путём)
      const drag = dragRef.current;
      if (!drag.on) {
        drag.offY += drag.vy * dt;
        drag.offX += drag.vx * dt;
        const fr = Math.exp(-dt * 2.5);
        drag.vy *= fr;
        drag.vx *= fr;
        if (Math.abs(drag.vy) + Math.abs(drag.vx) < 0.25) {
          drag.offY = Math.atan2(Math.sin(drag.offY), Math.cos(drag.offY));
          const kBack = 1 - Math.exp(-dt * 1.4);
          drag.offY -= drag.offY * kBack;
          drag.offX -= drag.offX * kBack;
        }
      }
      drag.offX = Math.max(-0.6, Math.min(0.6, drag.offX));
      globe.rotation.set(rx + drag.offX, ry + drag.offY, 0);
      camera.position.z = VIEW_Z * fit;

      bodyMat.uniforms.uBody.value.copy(pal.body);
      bodyMat.uniforms.uRim.value = pal.rim * intro;
      haloMat.uniforms.uHalo.value = pal.halo * intro;
      const du = dotsMat.uniforms;
      du.uReveal.value = intro * 3.7;
      (du.uBase.value as THREE.Vector3).copy(pal.dots);
      du.uBaseAlpha.value = pal.dotsAlpha;
      (du.uKz.value as THREE.Color).copy(pal.kz);
      (du.uOther.value as THREE.Color).copy(pal.other);

      // фокус приходит после волны
      for (let i = 0; i < 3; i++) glow[i] += ((i === a && intro > 0.6 ? 1 : 0) - glow[i]) * k;
      (du.uGlow.value as THREE.Vector3).set(glow[0], glow[1], glow[2]);
      outlineMats.forEach((m, i) => {
        if (!m) return;
        m.color.copy(i === 0 ? pal.kz : pal.other);
        m.opacity = (0.35 + 0.65 * glow[i]) * intro;
      });
      rings.forEach((ring, i) => {
        const on = (0.4 + 0.6 * glow[i]) * intro;
        const ph = (time * 0.8 + i * 0.3) % 1;
        ring.scale.setScalar(Math.max(0.001, on) * (1 + ph * 1.6));
        const m = ring.material as THREE.MeshBasicMaterial;
        m.color.copy(i === 0 ? pal.kz : pal.other);
        m.opacity = on * (1 - ph * 0.8);
      });

      // огоньки областей: смена страны (после волны) — запоминаем, где они, и начинаем переход
      const want = intro > 0.6 ? a : -1;
      if (want !== mode) {
        prevMode = mode;
        mode = want;
        modeT = 0;
        cur.forEach((p, i) => {
          start[i].copy(p);
          startA[i] = curA[i];
        });
      }
      modeT += dt;
      const fromArc = prevMode === 1 || prevMode === 2 ? arcs[prevMode - 1] : null;
      for (let i = 0; i < REG_N; i++) {
        const d = i * STAGGER;
        const p = cur[i];
        let alpha = 0;
        if (mode === 0) {
          // Казахстан: с дуги — сначала назад по ней в Астану, затем разбег по своим областям
          let tSpread = modeT - d;
          if (fromArc) {
            const u = clamp01((modeT - d) / BACK_S);
            pointAt(fromArc, fromArc.len * (1 - ease(u)), p);
            alpha = 1;
            tSpread -= BACK_S;
          }
          if (tSpread >= 0) {
            const v = ease(clamp01(tSpread / SPREAD_S));
            // перескок из Астаны в область — низкой дугой над картой
            p.lerpVectors(astana, regionAt[i], v).setLength(1.012 + 0.035 * Math.sin(Math.PI * v));
            alpha = Math.min(1, v * 3) * (0.78 + 0.22 * Math.sin(time * 2.4 + i * 1.7));
          } else if (!fromArc) {
            p.copy(astana);
          }
        } else if (mode > 0) {
          // ОАЭ/Чехия: по очереди в Астану, оттуда цепочкой по дуге; долетев — гаснут
          const arc = arcs[mode - 1];
          const seen = startA[i] > 0.1;
          const from = seen ? start[i] : astana;
          const u = clamp01((modeT - d - GATHER_S) / FLY_S);
          if (u <= 0) {
            const g = ease(clamp01((modeT - d) / GATHER_S));
            p.lerpVectors(from, astana, g).setLength(1.012);
            alpha = seen ? 1 : g;
          } else {
            pointAt(arc, arc.len * ease(u), p);
            alpha = 1 - clamp01((u - 0.85) / 0.15);
          }
        }
        curA[i] = alpha;
        p.toArray(regPos, i * 3);
        regAlpha[i] = alpha * intro;
      }
      regGeo.attributes.position.needsUpdate = true;
      regGeo.attributes.aAlpha.needsUpdate = true;

      // дуги рисуют сами огоньки: голова — за первым из них; к Казахстану сматывается за последним;
      // между ОАЭ и Чехией прежняя сматывается к своему городу
      const kArc = 1 - Math.exp(-dt * 12);
      const flown = (REG_N - 1) * STAGGER + GATHER_S + FLY_S;
      arcs.forEach((arc, j) => {
        let head = 0;
        let tail = 0;
        if (mode === j + 1) {
          head = arc.len * ease(clamp01((modeT - GATHER_S) / FLY_S));
        } else if (prevMode === j + 1 && mode === 0) {
          head = arc.len * (1 - ease(clamp01((modeT - (REG_N - 1) * STAGGER) / BACK_S)));
        } else if (prevMode === j + 1) {
          head = arc.len;
          tail = arc.len * ease(clamp01(modeT / 0.7));
        }
        arc.head += (head - arc.head) * kArc;
        arc.tail += (tail - arc.tail) * kArc;
        const u = arc.band.mesh.material.uniforms;
        u.uHead.value = arc.head;
        u.uTail.value = arc.tail;
        // по готовой дуге бежит один огонёк
        const ph = (time * 0.45 + j * 0.5) % 1;
        const s = ph * arc.len;
        const ready = mode === j + 1 ? clamp01((modeT - flown) / 0.6) : 0;
        pointAt(arc, s, tmp).toArray(sparkPos, j * 3);
        sparkAlpha[j] = Math.sin(Math.PI * ph) * ready;
      });
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.aAlpha.needsUpdate = true;

      // подпись страны в фокусе привязана к её точке на глобусе
      globe.updateMatrixWorld();
      toCam.copy(camera.position).normalize();
      // правая часть холста может уходить за край экрана — подпись не должна туда уезжать
      const visW = Math.min(canvas.clientWidth, window.innerWidth - r.left - 16);
      sites.forEach((site, i) => {
        const el = labelsRef.current[i];
        if (!el) return;
        tmp.copy(toVec(site.lat, site.lon, 1.01)).applyMatrix4(globe.matrixWorld);
        const facingCam = tmp.clone().normalize().dot(toCam);
        tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-tmp.y * 0.5 + 0.5) * canvas.clientHeight;
        // Казахстан — справа от точки, ОАЭ и Чехия — слева (дуга приходит к ним справа, из Астаны);
        // на другую сторону — только если не влезает
        const w = el.offsetWidth + 48;
        const flip = i === 0 ? x + w > visW : x - w > 0;
        el.style.transform = `translate(${x}px, ${y}px)${flip ? " translateX(-100%) translateX(-3rem)" : ""}`;
        el.style.opacity = String(glow[i] * Math.min(1, Math.max(0, facingCam * 4)));
      });
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  // крутить шар: горизонталь — вокруг оси, вертикаль — немного наклоняет; скорость — для инерции
  /** точка над шаром (а не над пустыми углами холста) */
  const onDisk = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return Math.hypot(dx, dy) < r.height * GLOBE_FILL;
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (d.on || !onDisk(e)) return;
    Object.assign(d, { on: true, id: e.pointerId, x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now() });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d.on) {
      e.currentTarget.style.cursor = onDisk(e) ? "grab" : "";
      return;
    }
    if (e.pointerId !== d.id) return;
    e.currentTarget.style.cursor = "grabbing";
    const now = performance.now();
    const dtS = Math.max(0.008, (now - d.t) / 1000);
    const size = e.currentTarget.clientHeight * GLOBE_FILL * 2;
    const dy = ((e.clientX - d.x) / size) * Math.PI;
    const dx = ((e.clientY - d.y) / size) * Math.PI;
    d.offY += dy;
    d.offX += dx;
    d.vy = d.vy * 0.6 + (dy / dtS) * 0.4;
    d.vx = d.vx * 0.6 + (dx / dtS) * 0.4;
    Object.assign(d, { x: e.clientX, y: e.clientY, t: now });
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (e.pointerId !== d.id) return;
    d.on = false;
    e.currentTarget.style.cursor = "grab";
    // отпустили, не двигая — инерции нет
    if (performance.now() - d.t > 80) d.vx = d.vy = 0;
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="absolute inset-0 h-full w-full touch-pan-y"
      />
      {sites.map((site, i) => (
        <div
          key={site.key}
          ref={(el) => {
            labelsRef.current[i] = el;
          }}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 opacity-0"
        >
          <div className="ml-6 -translate-y-1/2 rounded-2xl border border-line bg-[var(--glass)] px-5 py-3.5 shadow-[0_12px_40px_-16px_var(--shadow)] backdrop-blur-md">
            <p className={`text-[clamp(1.3rem,2vw,1.8rem)] leading-none font-semibold tracking-[-0.02em] ${i === 0 ? "text-accent-ink" : "text-fg"}`}>
              {site.country}
            </p>
            <p className="mt-1.5 max-w-[16rem] text-[0.92rem] leading-snug text-fg/60">{"note" in site ? site.note : site.city}</p>
          </div>
        </div>
      ))}
    </>
  );
}

export function WorldV7() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);

  // листаем, только пока блок на экране — чтобы первым показался Казахстан
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!inView) return;
    const id = window.setTimeout(() => {
      if (!document.hidden) setActive((a) => (a + 1) % sites.length);
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [active, inView]);

  return (
    <section
      id="world"
      data-ribbon="world"
      ref={sectionRef}
      aria-labelledby="world-title"
      className="relative overflow-hidden px-5 pt-24 pb-[calc(var(--r)*1.04+2rem)] [--r:46vw] sm:px-8 lg:px-[6vw] sm:[--r:min(42vw,22rem)] lg:pt-28 lg:pb-20 lg:[--r:min(36vw,40rem)]"
      style={{ ["--fill" as string]: GLOBE_FILL }}
    >
      {/* глобус без рамки: квадратный холст, радиус шара — var(--r); центр чуть выше края секции,
          она обрезает шар по низу — дальше начинается серая полоса «Контактов» */}
      <div
        className="absolute top-[calc(100%-var(--r)*0.1)] left-1/2 aspect-square w-[calc(var(--r)/var(--fill))] -translate-x-1/2 -translate-y-1/2 lg:left-[76%]"
      >
        <Globe active={active} play={inView} />
      </div>
      <div className="pointer-events-none relative z-10">
        <div className="pointer-events-auto max-w-[40rem] lg:w-[38%]">
          <p className="text-[0.95rem] font-semibold text-accent-ink dark:text-accent">{worldV7.eyebrow}</p>
          <h2 id="world-title" className="mt-5 text-[clamp(2.4rem,4.6vw,4.4rem)] leading-[1] font-semibold tracking-[-0.045em]">
            {worldV7.title[0]}
            <br />
            <span className="text-fg/45">{worldV7.title[1]}</span>
          </h2>
          <p className="mt-6 max-w-[30rem] text-[1.1rem] leading-relaxed text-fg/70">{worldV7.lead}</p>

          <ul className="mt-10 border-t border-line">
            {sites.map((site, i) => {
              const on = i === active;
              return (
                <li key={site.key} className="border-b border-line">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setActive(i)}
                    className="relative block w-full cursor-pointer py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex items-baseline justify-between gap-4">
                      <span className={`text-[1.35rem] font-semibold tracking-[-0.02em] transition-colors duration-500 ${on ? "text-fg" : "text-fg/45"}`}>
                        {site.name}
                      </span>
                      <span className={`shrink-0 text-[0.9rem] transition-colors duration-500 ${on ? "text-accent-ink dark:text-accent" : "text-fg/40"}`}>
                        {site.city} · {site.country}
                      </span>
                    </span>
                    <span
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <span className="overflow-hidden">
                        <span className="block pt-2 leading-relaxed text-fg/70">{site.text}</span>
                      </span>
                    </span>
                    {/* время до следующей страны */}
                    {on && (
                      <span
                        key={`${active}-${inView}`}
                        aria-hidden
                        className="absolute inset-x-0 -bottom-px block h-[2px] origin-left bg-accent"
                        style={{ animation: `dir-progress ${STEP_MS}ms linear both`, animationPlayState: inView ? "running" : "paused" }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
