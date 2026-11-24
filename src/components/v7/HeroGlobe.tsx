"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { SEVEN_PATH, WORDMARK_PATHS } from "@/components/Logo";
import { StarField } from "@/components/v3/StarField";
import {
  createTourMaterial,
  LOGO_BOX,
  loadTourGeometry,
  setBorder,
  SHAPES,
  WORDMARK_SHIFT,
} from "@/components/v7/tourParticles";
import { productsV4 } from "@/content/v4";
import { tourV7 } from "@/content/v7";
import { clamp01 } from "@/lib/scroll";

/**
 * Первый экран /v7, вариант «Глобус» — фон карточки первого экрана под его надписями.
 * Играет по времени, когда первый экран на виду:
 * 1) из темноты проявляется наш глобус из точек и доворачивается к Казахстану, по границе страны
 *    пробегает свечение; 2) камера опускается к самой карте — Казахстан покрывается сеткой точек,
 *    над горизонтом видно свечение атмосферы; 3) сверху слева влетает лента из частиц и собирается
 *    в первый продукт (те же облака точек, что в «Своих продуктах»); дальше форма срывается лентой,
 *    дугой летит над картой к следующей точке и собирается в следующий продукт — так все семь;
 *    4) камера отходит, Казахстан целиком, лента из последнего продукта собирается в логотип
 *    Seven Hills of Kazakhstan.
 * Плашка справа вверху — какой продукт сейчас: наведение ставит облёт на паузу (можно дочитать),
 * стрелки и отрезки шкалы листают назад и вперёд (лента перелетает в нужную сторону). «Пропустить» —
 * сразу к логотипу, «Собрать заново» — с начала.
 */

const DEG = Math.PI / 180;
const ease = (t: number) => t * t * (3 - 2 * t);
const smooth = (a: number, b: number, v: number) => ease(clamp01((v - a) / (b - a)));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Таймлайн, секунды. */
const INTRO = 3.6;
/** Вход первой формы лентой из угла и перетекание формы в следующую (с переездом камеры). */
const ENTER = 1.9;
const MORPH = 1.5;
const HOLD = 1.8;
const STEP = MORPH + HOLD;
const N = SHAPES;
const OUTRO = INTRO + N * STEP;
/** Когда логотип собран и проявляется чётким SVG. */
const LOGO_SHARP = OUTRO + 3.5;
const END = OUTRO + 4.2;
/** Начало перехода к продукту k. */
const stageStart = (k: number) => INTRO + k * STEP;
/** Номер продукта в момент t: −1 — вступление, N — финал. */
const indexAt = (t: number) => (t < INTRO ? -1 : t < OUTRO ? Math.floor((t - INTRO) / STEP) : N);

/** Форма продукта: размер (мир на единицу облака) и высота центра над картой. */
const FORM_SIZE = 0.024;
const FORM_LIFT = 0.03;

function toVec(lat: number, lon: number, r = 1) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}
const Y = new THREE.Vector3(0, 1, 0);
/** Местный север и восток в точке сферы с нормалью n. */
function frameAt(n: THREE.Vector3) {
  const north = Y.clone().addScaledVector(n, -n.y).normalize();
  const east = new THREE.Vector3().crossVectors(north, n).normalize();
  return { north, east };
}

type Pose = { pos: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3 };
/**
 * Камера над картой: южнее точки и выше, смотрит на север — над формой виден горизонт.
 * lift — подъём на перелёте между точками: камера отходит выше и дальше, видно кусок страны.
 */
function surfacePose(n: THREE.Vector3, lift = 0): Pose {
  const { north } = frameAt(n);
  return {
    pos: n.clone().multiplyScalar(1.15 + lift * 0.5).addScaledVector(north, -0.24 - lift * 0.45),
    target: n.clone().multiplyScalar(1.025).addScaledVector(north, 0.05),
    up: n.clone(),
  };
}
function lerpPose(a: Pose, b: Pose, t: number, out: Pose) {
  out.pos.lerpVectors(a.pos, b.pos, t);
  out.target.lerpVectors(a.target, b.target, t);
  out.up.lerpVectors(a.up, b.up, t).normalize();
  return out;
}

const dotsVertex = /* glsl */ `
  attribute float aKind;
  uniform float uSize;
  uniform float uMax;
  uniform float uGlow;  // свечение точек Казахстана
  uniform float uAlpha;
  uniform float uKz;    // 0 — точки Казахстана спрятаны (на карте вместо них плотная сетка)
  varying vec3 vColor;
  varying float vA;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(wp.xyz);
    float front = smoothstep(0.0, 0.35, dot(n, normalize(cameraPosition - wp.xyz)));
    float kz = aKind == 1.0 ? 1.0 : 0.0;
    vColor = mix(vec3(0.55, 0.66, 0.68), vec3(0.0, 0.8, 0.84), kz * uGlow);
    // ОАЭ и Чехия (2, 3) в данных засеяны плотнее — здесь они не нужны, иначе светятся пятнами
    vA = front * mix(0.42, 1.0, kz * uGlow) * uAlpha * mix(1.0, uKz, kz) * step(aKind, 1.5);
    vec4 mv = viewMatrix * wp;
    gl_PointSize = min(uSize / -mv.z, uMax);
    gl_Position = projectionMatrix * mv;
  }
`;
const dotsFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = vA * smoothstep(0.5, 0.2, d);
    gl_FragColor = vec4(vColor * a, a);
  }
`;

/** Сетка точек по территории Казахстана — видна, когда камера у самой карты. */
const gridVertex = /* glsl */ `
  attribute float aR;
  uniform float uPx;
  uniform float uAlpha;
  uniform float uTime;
  uniform vec3 uFocus;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float near = 1.0 - smoothstep(0.05, 0.4, distance(position, uFocus));
    vA = uAlpha * (0.35 + 0.45 * near) * (0.75 + 0.25 * sin(uTime * 2.0 + aR * 30.0));
    gl_PointSize = min(uPx * 0.3 / -mv.z, uPx * 2.5) * (0.8 + 0.4 * aR);
    gl_Position = projectionMatrix * mv;
  }
`;
const gridFragment = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = vA * smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(vec3(0.35, 0.9, 0.93) * a, a);
  }
`;

/**
 * Граница Казахстана — трубка постоянной толщины на экране (радиус пересчитывается от глубины),
 * рисуется по длине (uDraw) и по ней бежит блик.
 */
const lineVertex = /* glsl */ `
  uniform float uR;     // радиус, с которым построена трубка
  uniform float uK;     // радиус в мире на единицу глубины (пиксели → мир)
  varying float vU;
  void main() {
    vU = uv.x;
    vec3 c = position - normal * uR;
    vec4 mvc = modelViewMatrix * vec4(c, 1.0);
    vec3 p = c + normal * uK * -mvc.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const lineFragment = /* glsl */ `
  uniform float uDraw;
  uniform float uAlpha;
  uniform float uTime;
  uniform vec3 uColor;
  varying float vU;
  void main() {
    if (vU > uDraw) discard;
    float head = smoothstep(uDraw - 0.08, uDraw, vU) * step(uDraw, 0.999);
    float run = pow(max(0.0, sin((vU - uTime * 0.05) * 6.2832 * 2.0)), 24.0);
    vec3 c = mix(uColor, vec3(0.85, 1.0, 1.0), clamp(head + run * 0.6, 0.0, 1.0));
    float a = uAlpha * (1.0 + head);
    gl_FragColor = vec4(c * a, a);
  }
`;

/** Платформа под формой — неподвижная: мягкое свечение и одно тонкое кольцо. */
const baseVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const baseFragment = /* glsl */ `
  uniform float uOn;
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float aa = fwidth(r) * 1.5;
    float ring = 1.0 - smoothstep(0.0, aa, abs(r - 0.62));
    float glow = exp(-r * r * 4.5) * 0.32;
    float i = (ring * 0.7 + glow) * uOn * smoothstep(1.0, 0.85, r);
    gl_FragColor = vec4(vec3(0.25, 0.88, 0.92) * i, i);
  }
`;

const pad = (n: number) => String(n).padStart(2, "0");

export function HeroGlobe() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  /** Управление таймлайном из интерфейса — заполняет эффект сцены. */
  const ctl = useRef<{ restart: () => void; skip: () => void; to: (k: number) => void } | null>(null);
  const hoverRef = useRef(false);
  const [index, setIndex] = useState(-1);
  const [ended, setEnded] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 30);
    const globe = new THREE.Group();
    scene.add(globe);

    // тело Земли закрывает обратную сторону; по краю (и над горизонтом у карты) — бирюзовая атмосфера
    const bodyMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uAlpha; varying vec3 vN; void main(){ float rim = pow(1.0 - max(vN.z, 0.0), 6.0); gl_FragColor = vec4(mix(vec3(0.01,0.024,0.03), vec3(0.0,0.62,0.66), rim * 0.75) * uAlpha, uAlpha); }`,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.995, 96, 96), bodyMat);
    body.renderOrder = -1;
    globe.add(body);
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uAlpha; varying vec3 vN; void main(){ float i = pow(smoothstep(0.0, 0.55, abs(vN.z)), 2.0) * 0.55 * uAlpha; gl_FragColor = vec4(vec3(0.0,0.73,0.77) * i, i); }`,
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.18, 64, 64), haloMat);
    scene.add(halo);

    const dotsMat = new THREE.ShaderMaterial({
      vertexShader: dotsVertex,
      fragmentShader: dotsFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uSize: { value: 9 }, uMax: { value: 6 }, uGlow: { value: 0 }, uAlpha: { value: 0 }, uKz: { value: 1 } },
    });
    const gridMat = new THREE.ShaderMaterial({
      vertexShader: gridVertex,
      fragmentShader: gridFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uPx: { value: 2 }, uAlpha: { value: 0 }, uTime: { value: 0 }, uFocus: { value: new THREE.Vector3() } },
    });
    const lineMat = (r: number, color: number, alpha: number) =>
      new THREE.ShaderMaterial({
        vertexShader: lineVertex,
        fragmentShader: lineFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: {
          uR: { value: r },
          uK: { value: 0.001 },
          uDraw: { value: 0 },
          uAlpha: { value: alpha },
          uBase: { value: alpha },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
        },
      });
    const coreMat = lineMat(0.002, 0x2fd6de, 1);
    const glowMat = lineMat(0.006, 0x00bbc4, 0.22);

    // контур страны и частицы грузятся отдельно — точки на границу раскладываем, когда есть оба
    let borderRing: THREE.Vector3[] | null = null;
    let tourGeo: THREE.BufferGeometry | null = null;
    const linkBorder = () => {
      if (borderRing && tourGeo) setBorder(tourGeo, borderRing);
    };
    let kzWest: THREE.Vector3 | null = null;
    let kzEast: THREE.Vector3 | null = null;
    let westLon = 180;
    let eastLon = -180;
    const title = root.parentElement?.querySelector("h1") ?? null;
    const titleRange = document.createRange();
    const abort = new AbortController();
    fetch("/v2/globe.json", { signal: abort.signal })
      .then((r) => r.json() as Promise<{ points: number[]; outlines: Record<string, number[][]> }>)
      .then(({ points: data, outlines }) => {
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

        // граница Казахстана (контур "1") и сетка точек внутри неё
        const ring = outlines["1"]?.[0];
        if (!ring) return;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < ring.length; i += 2) pts.push(toVec(ring[i], ring[i + 1], 1.004));
        // крайние точки страны с запада и востока — по ним Казахстан центрируется в финале
        pts.forEach((v, i) => {
          if (ring[i * 2 + 1] < westLon) [westLon, kzWest] = [ring[i * 2 + 1], v];
          if (ring[i * 2 + 1] > eastLon) [eastLon, kzEast] = [ring[i * 2 + 1], v];
        });
        borderRing = pts;
        linkBorder();
        const path = new THREE.CatmullRomCurve3(pts, true);
        globe.add(new THREE.Mesh(new THREE.TubeGeometry(path, 2400, 0.006, 5, true), glowMat));
        globe.add(new THREE.Mesh(new THREE.TubeGeometry(path, 2400, 0.002, 5, true), coreMat));
        const poly: [number, number][] = [];
        for (let i = 0; i < ring.length; i += 2) poly.push([ring[i], ring[i + 1]]);
        const inside = (lat: number, lon: number) => {
          let ins = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [ai, oi] = poly[i];
            const [aj, oj] = poly[j];
            if (ai > lat !== aj > lat && lon < ((oj - oi) * (lat - ai)) / (aj - ai) + oi) ins = !ins;
          }
          return ins;
        };
        const grid: number[] = [];
        const rnd: number[] = [];
        const STEP_DEG = 0.32;
        for (let lat = 40.4; lat < 55.6; lat += STEP_DEG) {
          const dl = STEP_DEG / Math.cos(lat * DEG);
          for (let lon = 46.4; lon < 87.5; lon += dl) {
            if (!inside(lat, lon)) continue;
            const v = toVec(lat, lon, 1.003);
            grid.push(v.x, v.y, v.z);
            rnd.push(Math.random());
          }
        }
        const gg = new THREE.BufferGeometry();
        gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(grid), 3));
        gg.setAttribute("aR", new THREE.BufferAttribute(new Float32Array(rnd), 1));
        globe.add(new THREE.Points(gg, gridMat));
      })
      .catch(() => {});

    // частицы продуктов (в мировых координатах — глобус после вступления не повёрнут)
    const tourMat = createTourMaterial();
    tourMat.uniforms.uGround.value = (1.003 - (1 + FORM_LIFT)) / FORM_SIZE;
    loadTourGeometry(abort.signal)
      .then((g) => {
        const tour = new THREE.Points(g, tourMat);
        tour.frustumCulled = false;
        tour.renderOrder = 5;
        scene.add(tour);
        tourGeo = g;
        linkBorder();
      })
      .catch(() => {});

    // точки облёта, кольца-пульсы на карте
    const sites = tourV7.sites.map((s) => toVec(s.lat, s.lon));
    const rings = sites.map((n) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.013, 0.0148, 64),
        new THREE.MeshBasicMaterial({ color: 0x3fd3db, transparent: true, depthWrite: false, opacity: 0 }),
      );
      const v = n.clone().multiplyScalar(1.0045);
      m.position.copy(v);
      m.lookAt(v.clone().multiplyScalar(2));
      globe.add(m);
      return m;
    });
    // платформа под формой
    const baseMat = new THREE.ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: baseFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uOn: { value: 0 } },
    });
    const base = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), baseMat);
    base.renderOrder = 3;
    scene.add(base);
    const kz = toVec(48.4, 67.6);
    const kzFrame = frameAt(kz);
    const orbit: Pose = { pos: kz.clone().multiplyScalar(3.5), target: new THREE.Vector3(0, 0, 0), up: Y.clone() };
    const finale: Pose = {
      // крупный Казахстан на уровне заголовка первого экрана, логотип над ним; по горизонтали
      // камера доводится в tick — страна встаёт посередине между концом заголовка и правым краем
      pos: kz.clone().multiplyScalar(1.95).addScaledVector(kzFrame.north, -0.3),
      target: kz.clone().addScaledVector(kzFrame.north, 0.1),
      up: kzFrame.north.clone().addScaledVector(kz, 0.4).normalize(),
    };
    const surf = sites.map((n) => surfacePose(n));
    const basis = sites.map((n) => {
      const { north, east } = frameAt(n);
      return new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeBasis(east, n, north.clone().negate())).multiplyScalar(FORM_SIZE);
    });

    let W = 1;
    let H = 1;
    let dpr = 1;
    let wide = true;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      wide = camera.aspect > 1.1;
      // на широком экране сцена смещена вправо и вверх — внизу слева надписи первого экрана
      if (wide) camera.setViewOffset(W, H, -W * 0.2, H * 0.07, W, H);
      // на телефоне текст внизу — сцена выше, между плашкой и текстом
      else camera.setViewOffset(W, H, 0, H * 0.12, W, H);
      camera.updateProjectionMatrix();
      dotsMat.uniforms.uSize.value = 9 * dpr * Math.min(1.4, Math.max(0.8, H / 900));
      dotsMat.uniforms.uMax.value = 5 * dpr;
      const px = Math.max(1.4 * dpr, H * dpr * 0.0024);
      tourMat.uniforms.uPx.value = px;
      gridMat.uniforms.uPx.value = px * 1.5;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // таймлайн: t идёт, пока блок на экране и курсор не на плашке; переходы по кнопкам — анимированно
    let t = 0;
    let started = false;
    let visible = false;
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !started) {
          started = true;
          // без анимации — сразу первый продукт, дальше листают стрелками
          if (reduce) t = stageStart(0) + ENTER;
        }
      },
      { threshold: 0.35 },
    );
    io.observe(root);
    /** Из какого продукта собирается логотип: после «Пропустить» — из текущего, иначе из последнего. */
    let outroFrom = N - 1;
    /**
     * Ручное листание: переход к продукту j — та же анимация, что при автоматической смене,
     * но из текущей формы (srcOverride) — так можно прыгнуть и через несколько продуктов.
     * forceUntil — переход доигрывает, даже если курсор на подписи (там стоит пауза).
     */
    let overrideStage = -1;
    let srcOverride = -1;
    let forceUntil = -1;
    const srcOf = (j: number) => (overrideStage === j ? srcOverride : j - 1);
    ctl.current = {
      restart: () => {
        started = true;
        overrideStage = -1;
        t = 0;
      },
      to: (j) => {
        const cur = indexAt(t);
        if (cur < 0 || cur >= N || j === cur) return;
        started = true;
        overrideStage = j;
        srcOverride = cur;
        t = stageStart(j) + (reduce ? MORPH : 0);
        forceUntil = stageStart(j) + MORPH;
      },
      skip: () => {
        started = true;
        overrideStage = -1;
        const i = indexAt(t);
        if (i >= N) return;
        // сразу к логотипу: из текущей формы, без прокрутки остальных продуктов;
        // во вступлении форм ещё нет — сразу собранный логотип
        if (i >= 0) {
          outroFrom = i;
          t = OUTRO;
        } else t = LOGO_SHARP;
      },
    };

    const pose: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3() };
    const pa: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3() };
    const nTmp = new THREE.Vector3();
    const aTmp = new THREE.Vector3();
    const bTmp = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const ray = new THREE.Vector3();
    const u = tourMat.uniforms;
    const wa = u.uWa.value as number[];
    const wb = u.uWb.value as number[];
    let shownIndex = -2;
    let shownEnded = false;
    let raf = 0;
    let prev = performance.now();
    const t0 = prev;

    /** Точка экрана (доли окна холста) → мир на глубине depth перед камерой. */
    const toWorld = (nx: number, ny: number, depth: number, out: THREE.Vector3) => {
      ray.set(nx * 2 - 1, 1 - ny * 2, 0.5).unproject(camera).sub(camera.position).normalize();
      return out.copy(camera.position).addScaledVector(ray, depth / ray.dot(fwd));
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!visible || document.hidden) return;
      if (started && !reduce && t < END && (!hoverRef.current || t < forceUntil)) t = Math.min(END, t + dt);
      const time = reduce ? 0 : (now - t0) / 1000;
      if (t < OUTRO) outroFrom = N - 1;
      if (overrideStage >= 0 && indexAt(t) !== overrideStage) overrideStage = -1;

      // 1. вступление: глобус проявляется и доворачивается, по границе пробегает свечение
      const appear = smooth(0.05, 0.9, t);
      globe.rotation.y = 1.3 * (1 - ease(clamp01(t / 1.7)));
      const dive = smooth(1.8, INTRO, t);
      const back = smooth(OUTRO, OUTRO + 1.9, t);
      const close = dive * (1 - back);
      bodyMat.uniforms.uAlpha.value = appear;
      haloMat.uniforms.uAlpha.value = appear * (1 - smooth(1.8, 2.7, t) * (1 - back));
      dotsMat.uniforms.uAlpha.value = appear * (1 - 0.55 * close);
      dotsMat.uniforms.uGlow.value = smooth(0.8, 1.6, t);
      dotsMat.uniforms.uKz.value = 1 - close;
      const draw = smooth(0.7, 1.9, t);
      const linePx = THREE.MathUtils.lerp(1.1, 1.8, close) + 0.6 * back;
      const k = (2 * Math.tan((camera.fov * DEG) / 2)) / (H * 1);
      for (const m of [coreMat, glowMat]) {
        m.uniforms.uDraw.value = draw;
        m.uniforms.uTime.value = time;
        m.uniforms.uK.value = k * (m === coreMat ? linePx : linePx * 4);
        m.uniforms.uAlpha.value = m.uniforms.uBase.value * appear;
      }
      gridMat.uniforms.uAlpha.value = smooth(2.2, 3.4, t);
      gridMat.uniforms.uTime.value = time;

      // 2. камера: орбита → карта (вступление) → от точки к точке → общий план (финал)
      const idx = indexAt(t);
      if (t < INTRO) {
        lerpPose(orbit, surf[0], dive, pose);
        nTmp.copy(sites[0]);
      } else if (idx < N) {
        // смена продукта: камера поднимается и летит к следующей точке, чуть отставая от формы
        const src = srcOf(idx);
        let lift = 0;
        if (src < 0) nTmp.copy(sites[idx]);
        else {
          const m = easeInOut(clamp01((t - stageStart(idx) - 0.2) / (MORPH - 0.2)));
          nTmp.lerpVectors(sites[src], sites[idx], m).normalize();
          lift = Math.sin(Math.PI * m) * (0.45 + 2.4 * sites[src].angleTo(sites[idx]));
        }
        const p = surfacePose(nTmp, lift);
        pose.pos.copy(p.pos);
        pose.target.copy(p.target);
        pose.up.copy(p.up);
      } else {
        lerpPose(surf[outroFrom], finale, back, pa);
        pose.pos.copy(pa.pos);
        pose.target.copy(pa.target);
        pose.up.copy(pa.up);
      }
      // на вертикальном экране отходим дальше, чтобы форма и Казахстан помещались
      const fit = wide ? 1 : Math.max(1, 0.9 / camera.aspect) * (0.7 + 0.3 * (1 - close));
      camera.position.copy(pose.pos).sub(pose.target).multiplyScalar(fit).add(pose.target);
      camera.up.copy(pose.up);
      camera.lookAt(pose.target);
      camera.updateMatrixWorld();
      // финал на широком экране: Казахстан и логотип — посередине между концом заголовка и правым краем
      const svg = logoRef.current;
      if (wide && back > 0 && kzWest && kzEast && title) {
        const cr = canvas.getBoundingClientRect();
        // конец заголовка — по самому тексту строк (у блочных строк рамка во всю ширину)
        let right = cr.left;
        title.querySelectorAll("span").forEach((line) => {
          if (!line.firstChild) return;
          titleRange.selectNodeContents(line.firstChild);
          right = Math.max(right, titleRange.getBoundingClientRect().right);
        });
        const cx = (right - cr.left + cr.width) / 2;
        const room = cr.width - (right - cr.left);
        camera.getWorldDirection(fwd);
        const halfW = Math.tan((camera.fov * DEG) / 2) * camera.aspect;
        let depth = aTmp.copy(kzWest).add(kzEast).multiplyScalar(0.5).sub(camera.position).dot(fwd);
        // не влезает в промежуток — камера отъезжает, пока страна не займёт ~84% его ширины
        const wide0 = ((bTmp.copy(kzEast).project(camera).x - aTmp.copy(kzWest).project(camera).x) / 2) * cr.width;
        const dolly = Math.max(0, depth * (wide0 / (room * 0.84) - 1));
        camera.position.addScaledVector(fwd, -dolly * back);
        camera.updateMatrixWorld();
        depth += dolly * back;
        const mid = (aTmp.copy(kzWest).project(camera).x + bTmp.copy(kzEast).project(camera).x) / 2;
        const shift = (mid - ((cx / cr.width) * 2 - 1)) * halfW * depth;
        camera.position.addScaledVector(bTmp.setFromMatrixColumn(camera.matrixWorld, 0), shift * back);
        camera.updateMatrixWorld();
        if (svg) {
          svg.style.left = `${cx}px`;
          svg.style.width = `${Math.min(34 * 16, 0.36 * cr.width, room * 0.8)}px`;
        }
      } else if (svg && svg.style.left) {
        svg.style.left = "";
        svg.style.width = "";
      }
      halo.position.copy(globe.position);
      gridMat.uniforms.uFocus.value.copy(pose.target);

      // 3. частицы: вход лентой из угла → форма перетекает в форму → в финале логотип
      const k3 = idx >= N ? outroFrom : Math.max(0, idx);
      const local = t - stageStart(Math.max(0, Math.min(N - 1, idx)));
      const src = idx >= 0 && idx < N ? srcOf(idx) : -1;
      const morphing = src >= 0;
      const from = morphing ? src : k3;
      const f = morphing ? ease(clamp01(local / MORPH)) : 0;
      wa.fill(0);
      wb.fill(0);
      wa[from] = 1;
      wb[k3] = 1;
      u.uF.value = f;
      // перелёт: форма взлетает, вихрем летит дугой над картой и садится в следующей точке
      const mf = morphing ? easeInOut(clamp01(local / (MORPH - 0.2))) : 1;
      const hop = sites[from].angleTo(sites[k3]);
      (u.uC.value as THREE.Vector3)
        .lerpVectors(sites[from], sites[k3], mf)
        .normalize()
        .multiplyScalar(1 + FORM_LIFT + Math.sin(Math.PI * mf) * (0.02 + 0.3 * hop));
      const ba = basis[from].elements;
      const bb = basis[k3].elements;
      const be = (u.uB.value as THREE.Matrix3).elements;
      for (let i = 0; i < 9; i++) be[i] = ba[i] + (bb[i] - ba[i]) * mf;
      u.uSpin.value = -0.45 + 0.35 * Math.sin(Math.PI * f) + 0.14 * Math.sin(time * 0.4);
      u.uTime.value = time;
      // вход: первый продукт вырастает из карты
      u.uEnter.value = t < INTRO ? 0 : idx === 0 && !morphing ? clamp01(local / ENTER) : 1;
      // финал: форма тает → огонёк бежит по границе с запада через юг, восток и север,
      // за ним точки по очереди летят в логотип (uRun до 1.5 — пока долетит последняя)
      u.uOut.value = clamp01((t - OUTRO - 0.1) / 0.7);
      const logoIn = clamp01((t - OUTRO - 0.5) / 2.6);
      u.uRun.value = logoIn * 1.5;
      const sharp = smooth(LOGO_SHARP - 0.5, LOGO_SHARP + 0.2, t);
      u.uAlpha.value = (t < INTRO ? 0 : 1) * (1 - sharp);
      // место логотипа — там, где на экране стоит SVG логотипа
      if (svg && logoIn > 0) {
        const lr = svg.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        camera.getWorldDirection(fwd);
        const depth = 0.6;
        const fx = (x: number) => (lr.left + x * lr.width - cr.left) / cr.width;
        const fy = (y: number) => (lr.top + y * lr.height - cr.top) / cr.height;
        const c = toWorld(fx(0.5), fy(0.5), depth, u.uLogoC.value as THREE.Vector3);
        toWorld(fx(1), fy(0.5), depth, u.uLogoR.value as THREE.Vector3).sub(c).multiplyScalar(2);
        toWorld(fx(0.5), fy(0), depth, u.uLogoU.value as THREE.Vector3).sub(c).multiplyScalar(2);
      }
      if (svg) svg.style.opacity = String(sharp);

      // кольца: текущая точка пульсирует, в финале — все
      // платформа: появляется вместе с формой, в перелёте тускнеет и едет под ней по карте
      baseMat.uniforms.uOn.value =
        t < INTRO
          ? 0
          : idx >= N
            ? 1 - (u.uOut.value as number)
            : morphing
              ? 1 - 0.65 * Math.sin(Math.PI * mf)
              : smooth(0.1, 0.55, u.uEnter.value as number);
      base.position.copy(u.uC.value as THREE.Vector3).setLength(1.0036);
      base.lookAt(aTmp.copy(base.position).multiplyScalar(2));
      base.scale.setScalar(0.12);
      // кольца на всех точках — в финале
      rings.forEach((r, i) => {
        const on = idx >= N ? back : 0;
        const ph = (time * 0.8 + i * 0.37) % 1;
        r.scale.setScalar((0.6 + ph * 1.4) * THREE.MathUtils.lerp(1.3, 1, close) * (1 - 0.45 * back));
        (r.material as THREE.MeshBasicMaterial).opacity = on * (1 - ph) * 0.9;
      });

      // шкала текущего продукта
      if (fillRef.current && idx >= 0 && idx < N) fillRef.current.style.transform = `scaleX(${clamp01(local / STEP)})`;
      if (idx !== shownIndex) {
        shownIndex = idx;
        setIndex(idx);
      }
      const isEnd = t >= LOGO_SHARP;
      if (isEnd !== shownEnded) {
        shownEnded = isEnd;
        setEnded(isEnd);
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      abort.abort();
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      ctl.current = null;
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  const goToProduct = useCallback((k: number) => {
    const c = ctl.current;
    if (!c) return;
    if (k >= N) c.skip();
    else c.to(Math.max(0, k));
  }, []);
  const step = (dir: 1 | -1) => goToProduct(Math.max(0, Math.min(N - 1, index < 0 ? 0 : index + dir)));
  const setHovered = (v: boolean) => {
    hoverRef.current = v;
    setHover(v);
  };

  // пока подпись гаснет (вступление, финал), в ней остаётся ближайший продукт, а не «08 / 07»
  const shown = Math.min(N - 1, Math.max(0, index));
  const item = productsV4.items[shown];
  const onTour = index >= 0 && index < N;
  const [frame, inner] = SEVEN_PATH.split(/(?=M58\.64)/);

  return (
    <div ref={rootRef} className="absolute inset-0 bg-[#030506] text-white">
      <StarField />
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      {/* затемнение под надписями первого экрана (они внизу слева) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(3,5,6,0.9)_0%,rgba(3,5,6,0.55)_38%,transparent_62%)] lg:bg-[linear-gradient(20deg,rgba(3,5,6,0.9)_0%,rgba(3,5,6,0.5)_35%,transparent_58%)]"
      />

      {/* логотип финала: частицы собираются ровно сюда, затем он проявляется чётким */}
      <svg
        ref={logoRef}
        viewBox={`${LOGO_BOX.x} ${LOGO_BOX.y} ${LOGO_BOX.w} ${LOGO_BOX.h}`}
        aria-hidden
        style={{ opacity: 0 }}
        className="pointer-events-none absolute top-[16%] left-1/2 w-[min(84vw,30rem)] -translate-x-1/2 lg:top-[21%] lg:left-[73%] lg:w-[min(36vw,34rem)]"
      >
        <path d={frame} fill="#00bbc4" />
        <path d={inner} fill="#00bbc4" />
        <g fill="#f3f5f5" transform={`translate(0 ${WORDMARK_SHIFT})`}>
          {WORDMARK_PATHS.map((d) => (
            <path key={d.slice(0, 24)} d={d} />
          ))}
        </g>
      </svg>

      {/* подпись продукта (без рамки): наведение — пауза, стрелки и шкала — листать */}
      <div
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        className={`absolute top-[4.25rem] right-5 z-20 w-[min(21rem,calc(100%-2.5rem))] text-right transition-[opacity,transform] duration-500 sm:right-10 lg:top-[5rem] lg:right-14 ${
          onTour ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <p className="flex items-center justify-end gap-2.5 text-[0.78rem] font-medium tracking-[0.16em] text-white/40 tabular-nums">
          {hover && (
            <span className="flex items-center gap-1.5 tracking-normal text-white/60">
              <svg aria-hidden viewBox="0 0 10 10" className="size-2 fill-current">
                <rect x="1.5" y="1" width="2.4" height="8" rx="0.6" />
                <rect x="6.1" y="1" width="2.4" height="8" rx="0.6" />
              </svg>
              {tourV7.paused}
            </span>
          )}
          <span>
            <span className="text-[#7fe3e8]">{pad(shown + 1)}</span> / {pad(N)}
          </span>
        </p>
        <div key={shown} className="animate-[tour-card-in_0.6s_ease-out]" aria-live="polite">
          <h3 className="mt-2 text-[clamp(1.6rem,2.3vw,2.3rem)] leading-[1.05] font-semibold tracking-[-0.03em]">{item.name}</h3>
          <p className="mt-2 ml-auto max-w-[19rem] text-[0.95rem] leading-snug text-white/55">{item.text}</p>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            aria-label={tourV7.prev}
            onClick={() => step(-1)}
            disabled={index <= 0}
            className="grid size-6 cursor-pointer place-items-center text-[1.1rem] leading-none text-white/45 transition-colors hover:text-white disabled:cursor-default disabled:opacity-20"
          >
            ‹
          </button>
          <div className="flex w-[9.5rem] gap-1">
            {productsV4.items.map((p, i) => (
              <button
                key={p.name}
                type="button"
                aria-label={p.name}
                aria-current={i === index}
                onClick={() => goToProduct(i)}
                className="group/seg relative h-4 flex-1 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 overflow-hidden rounded-full bg-white/15 transition-colors group-hover/seg:bg-white/35">
                  {i < index && <span className="absolute inset-0 bg-white/50" />}
                  {i === index && <span ref={fillRef} className="absolute inset-0 origin-left scale-x-0 bg-[#7fe3e8]" />}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={tourV7.next}
            onClick={() => (index >= N - 1 ? goToProduct(N) : step(1))}
            className="grid size-6 cursor-pointer place-items-center text-[1.1rem] leading-none text-white/45 transition-colors hover:text-white"
          >
            ›
          </button>
        </div>
      </div>

      {/* низ справа: пропустить облёт / собрать заново */}
      <button
        type="button"
        onClick={() => (ended ? ctl.current?.restart() : ctl.current?.skip())}
        className="absolute right-6 bottom-6 z-20 cursor-pointer rounded-full border border-white/20 px-4 py-2 text-[0.85rem] whitespace-nowrap text-white/85 transition-colors hover:border-[#5fd9df] hover:text-white sm:right-10 sm:bottom-8 max-lg:hidden"
      >
        {ended ? tourV7.replay : tourV7.skip}
      </button>

      <ul className="sr-only">
        {productsV4.items.map((p) => (
          <li key={p.name}>
            {p.name} — {p.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
