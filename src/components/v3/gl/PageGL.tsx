"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import {
  buildRibbon,
  SEVEN_FRAME_STROKE,
  SEVEN_TURN,
  type Ribbon,
  type RibbonStep,
} from "@/components/v3/gl/ribbon";

/**
 * Единый WebGL-слой /v3 поверх страницы (фиксированный холст, камера в пикселях экрана).
 * На нём живут:
 *  - лента, ползущая за прокруткой (ribbon.ts);
 *  - знаки «7» из кадров Blender: поворачиваются за курсором, а на краях маршрута «переливаются»
 *    в ленту — стартовый растворяется вдоль линии письма следом за головой ленты, финальный
 *    проступает поверх ленты, которая его только что выписала, лента под ним сходит на нет,
 *    а затем выходит из-под крючка и уползает назад вверх;
 *  - карточка-«морф»: маленькая карточка, которую лента заливает цветом, а затем
 *    вытягивает в большой ролик — углы летят с разной задержкой, края выгибаются.
 * Плюс DOM-эффекты: строки с data-shift съезжают по горизонтали, слова с data-push
 * отталкиваются от ленты.
 * Без WebGL или при «уменьшить движение» остаются обычные <img>/<video> из вёрстки.
 */

// birth — кадры «рождения» финального знака (плоская «7» выдавливается в объём), если есть
export type SeqEntry = { el: HTMLElement; frames: HTMLImageElement[]; initial: number; birth?: HTMLImageElement[] };
export type MorphEntry = { a: HTMLElement; b: HTMLElement; video: HTMLVideoElement; dip: string };

type Registry = {
  seq(entry: SeqEntry): () => void;
  morph(entry: MorphEntry): () => void;
};

const Ctx = createContext<Registry | null>(null);
export const usePageGL = () => useContext(Ctx);

const seqVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const seqFragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uOpacity;
  uniform vec2 uP[5];   // осевая линия «7» в UV кадра
  uniform float uQ[5];  // доля длины линии у каждой её точки
  uniform float uLo;    // всё, что раньше uLo по линии письма, уже стало лентой (растворилось)
  uniform float uHi;    // всё, что дальше uHi, ещё не проявилось из ленты
  uniform float uTime;
  uniform float uAlpha; // общая прозрачность: финальный знак проступает поверх ленты
  varying vec2 vUv;
  // Знак V3. Кадр загружен с предумноженной прозрачностью (без тёмной каймы на краях),
  // силуэт — плавный по альфе кадра (без «лесенки» жёсткого среза). Цвет чуть размыт внутри
  // силуэта (резкие светлые полоски на гранях мягче), блики сжаты, контраст и насыщенность
  // ниже. Всё серое — маленькая «7» и белые блики — переведено в бирюзу, как в логотипе.
  vec3 tealRamp(float l) {
    vec3 c = mix(vec3(0.0, 0.22, 0.25), vec3(0.0, 0.44, 0.48), smoothstep(0.05, 0.55, l));
    return mix(c, vec3(0.42, 0.82, 0.85), smoothstep(0.6, 1.0, l));
  }
  vec4 softSample(vec2 uv) {
    vec2 o = vec2(1.6 / 1200.0);
    vec4 c = texture2D(uTex, uv) * 0.36;
    c += texture2D(uTex, uv + vec2(o.x, 0.0)) * 0.16;
    c += texture2D(uTex, uv - vec2(o.x, 0.0)) * 0.16;
    c += texture2D(uTex, uv + vec2(0.0, o.y)) * 0.16;
    c += texture2D(uTex, uv - vec2(0.0, o.y)) * 0.16;
    float a = texture2D(uTex, uv).a;
    vec3 un = c.rgb / max(c.a, 0.001);
    float sat = max(un.r, max(un.g, un.b)) - min(un.r, min(un.g, un.b));
    float l = dot(un, vec3(0.299, 0.587, 0.114));
    un = mix(un, tealRamp(l), 1.0 - smoothstep(0.08, 0.22, sat));
    l = dot(un, vec3(0.299, 0.587, 0.114));
    float lc = l / (l + 1.3) * 2.3;
    un *= lc / max(l, 0.001);
    un = mix(vec3(dot(un, vec3(0.299, 0.587, 0.114))), un, 0.72);
    un = mix(vec3(0.45), un, 0.9);
    return vec4(clamp(un, 0.0, 1.0), a);
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec2 uv = vUv;
    if (uAlpha < 0.005) discard;
    if (uLo > 0.0 || uHi < 1.5) {
      // ближайшая точка осевой линии и её место по ходу письма
      float best = 1e9, q = 0.0;
      vec2 near = uv;
      for (int i = 0; i < 4; i++) {
        vec2 a = uP[i], ab = uP[i + 1] - a;
        float t = clamp(dot(uv - a, ab) / dot(ab, ab), 0.0, 1.0);
        vec2 c = a + ab * t;
        float d = distance(uv, c);
        if (d < best) { best = d; q = mix(uQ[i], uQ[i + 1], t); near = c; }
      }
      vec4 c0 = softSample(uv);
      if (c0.a < 0.004) discard;
      // внутренняя серебряная «7» (всё, что дальше грани от оси внешней) не режется
      // по линии письма, а тает целиком: исчезает в начале перехода, проявляется в конце
      if (best > 0.035) {
        float vis = (uLo > 0.0 ? 1.0 - smoothstep(0.0, 0.35, uLo) : 1.0) * (uHi < 1.5 ? smoothstep(0.55, 0.95, uHi) : 1.0);
        if (vis < 0.01) discard;
        gl_FragColor = vec4(c0.rgb * c0.a, c0.a) * uOpacity * vis;
        return;
      }
      // внешняя «7» уходит ровно под голову ленты: тонкий рваный край и светлая кромка,
      // будто знак «перетекает» в трубку, а не рассыпается
      float n = (noise(uv * 26.0 + uTime * 0.6) - 0.5) * 0.025;
      float e = min(q + n - best * 0.35 - uLo, uHi - (q + n + best * 0.35));
      if (e < 0.0) discard;
      float melt = 1.0 - smoothstep(0.0, 0.05, e);
      uv = mix(uv, near, melt * 0.15);
      vec4 c = softSample(uv);
      if (c.a < 0.004) discard;
      vec3 col = c.rgb + vec3(0.55, 0.9, 0.95) * melt * 0.55;
      gl_FragColor = vec4(col * c.a, c.a) * uOpacity;
      return;
    }
    vec4 c = softSample(uv);
    if (c.a < 0.004) discard;
    // предумноженный цвет; глубину знак не пишет — лента за ним видна и сквозь мягкий край
    gl_FragColor = vec4(c.rgb * c.a, c.a) * uOpacity * uAlpha;
  }
`;


// Бугорок под полотном, второй проход: по карте высоты (её рисует полоса ленты, см. ribbon.ts)
// считаем наклон поверхности в каждом пикселе и даём свет, тень и лёгкую бирюзу по гребню.
// Слой лежит за всем остальным (глубина у дальней плоскости) и обрезан по полотну.
// лёгкое размытие карты высоты (по одной оси за проход): убирает мелкую рябь там, где
// куски полосы на изгибах чуть накладываются, — поверхность остаётся гладкой
const blurVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const blurFragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uDir; // шаг в долях текстуры
  varying vec2 vUv;
  void main() {
    float w[5];
    w[0] = 0.227; w[1] = 0.194; w[2] = 0.121; w[3] = 0.054; w[4] = 0.016;
    float h = texture2D(uTex, vUv).r * w[0];
    for (int i = 1; i < 5; i++) {
      h += texture2D(uTex, vUv + uDir * float(i)).r * w[i];
      h += texture2D(uTex, vUv - uDir * float(i)).r * w[i];
    }
    gl_FragColor = vec4(h, 0.0, 0.0, 1.0);
  }
`;

const reliefVertex = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const reliefFragment = /* glsl */ `
  uniform sampler2D uHeight;
  uniform vec2 uBuf;     // размер буфера, px
  uniform float uH;      // высота рельефа, px буфера
  uniform float uDark;
  uniform vec4 uSheet;
  uniform float uSheetR;
  float sdBox(vec2 p, vec4 r, float rad) {
    vec2 q = abs(p - (r.xy + r.zw) * 0.5) - (r.zw - r.xy) * 0.5 + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
  }
  float hAt(vec2 px) { return texture2D(uHeight, px / uBuf).r; }
  void main() {
    vec2 px = gl_FragCoord.xy;
    if (sdBox(px, uSheet, uSheetR) > 0.0) discard;
    float h = hAt(px);
    // наклон — фильтром Собеля по окрестности: он замывает мелкую рябь карты высоты
    float d = 3.0;
    float tl = hAt(px + vec2(-d, d)), t = hAt(px + vec2(0.0, d)), tr = hAt(px + vec2(d, d));
    float l = hAt(px + vec2(-d, 0.0)), r = hAt(px + vec2(d, 0.0));
    float bl = hAt(px + vec2(-d, -d)), b = hAt(px + vec2(0.0, -d)), br = hAt(px + vec2(d, -d));
    float dx = ((tr + 2.0 * r + br) - (tl + 2.0 * l + bl)) / (8.0 * d) * uH;
    float dy = ((tl + 2.0 * t + tr) - (bl + 2.0 * b + br)) / (8.0 * d) * uH;
    if (h < 0.002 && abs(dx) + abs(dy) < 0.002) discard;
    vec3 n = normalize(vec3(-dx, -dy, 1.0));
    vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
    float lit = dot(n, L) - L.z;
    // матовая поверхность: мягкий широкий отблеск вместо резкого блика
    vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
    float sheen = max(pow(max(dot(n, Hv), 0.0), 14.0) - pow(Hv.z, 14.0), 0.0);
    // в тёмной теме белые блики и чёрные тени выглядят как дым, а там, где лента петлёй подходит
    // к самой себе, блик ложится на ложбину между прядями серой дымкой. Поэтому в тёмной теме бликов нет:
    // рельеф держится на мягкой тени и бирюзе, которая просвечивает только по самому гребню ленты
    float hi = max(lit, 0.0) * mix(1.25, 0.0, uDark) + sheen * mix(0.45, 0.05, uDark);
    float sh = max(-lit, 0.0) * mix(0.65, 0.45, uDark);
    float glow = smoothstep(mix(0.45, 0.55, uDark), 1.0, h) * mix(0.06, 0.4, uDark);
    float a = clamp(hi + sh + glow, 0.0, 0.9);
    if (a < 0.003) discard;
    // тень не чёрная, а в тон фона: на светлом — серо-бирюзовая
    vec3 shade = mix(vec3(0.16, 0.22, 0.23), vec3(0.0), uDark);
    vec3 light = mix(vec3(1.0), vec3(0.62, 0.9, 0.93), uDark);
    vec3 col = (light * hi + shade * sh + vec3(0.0, 0.733, 0.769) * glow) / a;
    gl_FragColor = vec4(col, a);
  }
`;

// осевая линия «7» в UV кадра (ось y вверх) и доли её длины у каждой точки
const STROKE_UV = SEVEN_FRAME_STROKE.map(([x, y]) => new THREE.Vector2(x, 1 - y));
const STROKE_Q = (() => {
  const acc = [0];
  for (let i = 1; i < STROKE_UV.length; i++) acc.push(acc[i - 1] + STROKE_UV[i].distanceTo(STROKE_UV[i - 1]));
  return acc.map((v) => v / acc[acc.length - 1]);
})();

const morphVertex = /* glsl */ `
  uniform vec2 uC[4]; // углы в пикселях экрана (GL): лево-верх, право-верх, право-низ, лево-низ
  uniform float uBend;
  varying vec2 vUv;
  #define PI 3.14159265
  void main() {
    vUv = uv;
    vec2 top = mix(uC[0], uC[1], uv.x);
    vec2 bottom = mix(uC[3], uC[2], uv.x);
    vec2 p = mix(bottom, top, uv.y);
    // края выгибаются, пока карточка летит: середина отстаёт
    float w = length(uC[1] - uC[0]);
    p.y -= sin(uv.x * PI) * uBend * w * 0.07 * (1.2 - uv.y);
    p.x += sin(uv.y * PI) * uBend * w * 0.03;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  }
`;
const morphFragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uTexSize;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uFill;
  uniform vec2 uOrigin;
  uniform float uTint;
  uniform float uTime;
  varying vec2 vUv;
  float sdRound(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec2 px = (vUv - 0.5) * uSize;
    if (sdRound(px, uSize * 0.5, uRadius) > 0.0) discard;
    // заливка: капля из точки, где лента коснулась карточки, с рваным краем
    vec2 d = (vUv - uOrigin) * vec2(uSize.x / uSize.y, 1.0);
    float edge = length(d) + (noise(vUv * 6.0 + uTime * 0.4) - 0.5) * 0.22;
    float r = uFill * 1.9;
    if (edge > r) discard;
    float rim = smoothstep(r - 0.22, r, edge);
    vec2 uv = vUv - 0.5;
    float pa = uSize.x / uSize.y, ta = uTexSize.x / uTexSize.y;
    if (pa > ta) uv.y *= ta / pa; else uv.x *= pa / ta;
    uv = uv * (1.0 - 0.12 * uTint) + 0.5;
    vec3 col = texture2D(uTex, uv).rgb;
    vec3 teal = vec3(0.0, 0.733, 0.769);
    // пока карточка маленькая, кадр окрашен в бирюзу (как у ленты), к концу полёта — чистый
    vec3 tinted = mix(col, teal * (0.35 + dot(col, vec3(0.5, 0.9, 0.4))), uTint * 0.85);
    tinted = mix(tinted, teal, rim * 0.9);
    gl_FragColor = vec4(tinted, 1.0);
  }
`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function PageGL({ ribbon: steps, children }: { ribbon: RibbonStep[]; children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state] = useState(() => ({ seq: new Set<SeqEntry>(), morph: new Set<MorphEntry>(), version: 0 }));
  const [registry] = useState<Registry>(() => ({
    seq(e) {
      state.seq.add(e);
      state.version++;
      return () => {
        state.seq.delete(e);
        state.version++;
      };
    },
    morph(e) {
      state.morph.add(e);
      state.version++;
      return () => {
        state.morph.delete(e);
        state.version++;
      };
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
    } catch {
      return;
    }
    const root = document.documentElement;
    root.dataset.gl = "on";
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    camera.position.z = 1000;

    let vw = 0;
    let vh = 0;
    let ribbon: Ribbon | null = null;
    const ribbonGroup = new THREE.Group();
    scene.add(ribbonGroup);

    let appliedStyle: string | null = null;
    // финал — не прокруткой, а сам: как только сцена финала встала на место, анимация
    // дописывает «7» лентой, проявляет поверх объёмный знак и уводит ленту вверх
    // (0 → 1 за FINALE_SEC; прокрутка назад выше этой точки — та же анимация обратно)
    const FINALE_SEC = 2.0;
    let finale = 0;
    let lastT = 0;
    // запуск финала: голова/длина ленты в момент запуска и прокрутка, на которой он случился
    let finOn = false;
    let trigHead = 0;
    let trigLen = 0;
    let trigScroll = 0;
    const tailPos = new THREE.Vector3();
    // карта высоты бугорка под полотном: своя сцена и текстура, по которой считается рельеф
    const heightScene = new THREE.Scene();
    const heightGroup = new THREE.Group();
    heightScene.add(heightGroup);
    const heightTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    const relief = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: reliefVertex,
        fragmentShader: reliefFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uHeight: { value: heightTarget.texture },
          uBuf: { value: new THREE.Vector2(1, 1) },
          uH: { value: 1 },
          uDark: { value: 0 },
          uSheet: { value: new THREE.Vector4() },
          uSheetR: { value: 32 },
        },
      }),
    );
    relief.frustumCulled = false;
    relief.renderOrder = -1;
    relief.visible = false;
    scene.add(relief);
    const blurTarget = heightTarget.clone();
    const blurMat = new THREE.ShaderMaterial({
      vertexShader: blurVertex,
      fragmentShader: blurFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: { uTex: { value: heightTarget.texture }, uDir: { value: new THREE.Vector2() } },
    });
    const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
    blurQuad.frustumCulled = false;
    const blurScene = new THREE.Scene();
    blurScene.add(blurQuad);

    const rebuildRibbon = () => {
      if (ribbon) {
        ribbonGroup.remove(ribbon.mesh);
        if (ribbon.ridge) heightGroup.remove(ribbon.ridge);
        ribbon.dispose();
      }
      ribbon = buildRibbon(steps, vw, vh, vw < 700 ? 8 : 13);
      appliedStyle = null;
      if (ribbon) ribbonGroup.add(ribbon.mesh);
      if (ribbon?.ridge) heightGroup.add(ribbon.ridge);
    };
    let rebuildTimer = 0;
    const scheduleRebuild = () => {
      clearTimeout(rebuildTimer);
      rebuildTimer = window.setTimeout(rebuildRibbon, 120);
    };

    const resize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      // плотнее экрана (×1.5, но не больше 2): тонкие края плоской ленты не дробятся на пиксели
      renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1) * 1.5, 2));
      renderer.setSize(vw, vh, false);
      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      // карта высоты гладкая — хватает половины разрешения (и вчетверо меньше видеопамяти)
      heightTarget.setSize(Math.ceil(buf.x / 2), Math.ceil(buf.y / 2));
      blurTarget.setSize(Math.ceil(buf.x / 2), Math.ceil(buf.y / 2));
      relief.material.uniforms.uBuf.value.copy(buf);
      Object.assign(camera, { left: -vw / 2, right: vw / 2, top: vh / 2, bottom: -vh / 2 });
      camera.updateProjectionMatrix();
      scheduleRebuild();
    };
    resize();
    window.addEventListener("resize", resize);
    // высота страницы меняется (шрифты, картинки) — маршрут ленты пересчитываем
    const ro = new ResizeObserver(scheduleRebuild);
    ro.observe(document.body);

    // ── знак «7» ──
    type SeqState = { entry: SeqEntry; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; tex: THREE.Texture; cur: number; shown: number };
    const seqs = new Map<SeqEntry, SeqState>();
    const pointer = { x: 0.5, y: 0.5, moved: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX / vw;
      pointer.y = e.clientY / vh;
      pointer.moved = performance.now();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // ── карточка-морф ──
    type MorphState = { entry: MorphEntry; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; tex: THREE.VideoTexture };
    const morphs = new Map<MorphEntry, MorphState>();
    const sync = () => {
      for (const e of state.seq) {
        if (seqs.has(e)) continue;
        const tex = new THREE.Texture(e.frames[e.initial]);
        tex.colorSpace = THREE.NoColorSpace;
        tex.premultiplyAlpha = true;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.ShaderMaterial({
            vertexShader: seqVertex,
            fragmentShader: seqFragment,
            transparent: true,
            premultipliedAlpha: true,
            depthWrite: false,
            uniforms: {
              uTex: { value: tex },
              uOpacity: { value: 0 },
              uP: { value: STROKE_UV },
              uQ: { value: STROKE_Q },
              uLo: { value: -1 },
              uHi: { value: 2 },
              uTime: { value: 0 },
              uAlpha: { value: 1 },
            },
          }),
        );
        scene.add(mesh);
        seqs.set(e, { entry: e, mesh, tex, cur: e.initial, shown: -1 });
      }
      for (const [e, s] of seqs) {
        if (state.seq.has(e)) continue;
        scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        s.tex.dispose();
        seqs.delete(e);
      }
      for (const e of state.morph) {
        if (morphs.has(e)) continue;
        const tex = new THREE.VideoTexture(e.video);
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1, 40, 28),
          new THREE.ShaderMaterial({
            vertexShader: morphVertex,
            fragmentShader: morphFragment,
            uniforms: {
              uC: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
              uBend: { value: 0 },
              uTex: { value: tex },
              uTexSize: { value: new THREE.Vector2(16, 9) },
              uSize: { value: new THREE.Vector2(1, 1) },
              uRadius: { value: 24 },
              uFill: { value: 0 },
              uOrigin: { value: new THREE.Vector2(0.5, 1) },
              uTint: { value: 1 },
              uTime: { value: 0 },
            },
          }),
        );
        mesh.frustumCulled = false;
        scene.add(mesh);
        morphs.set(e, { entry: e, mesh, tex });
      }
      for (const [e, m] of morphs) {
        if (state.morph.has(e)) continue;
        scene.remove(m.mesh);
        m.mesh.geometry.dispose();
        m.mesh.material.dispose();
        m.tex.dispose();
        morphs.delete(e);
      }
    };
    let version = -1;

    const toGL = (x: number, y: number, out: THREE.Vector2) => out.set(x - vw / 2, vh / 2 - y);
    const pushState = new WeakMap<HTMLElement, { x: number; y: number }>();
    const clock = new THREE.Clock();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (version !== state.version) {
        version = state.version;
        sync();
        // знак появился или пропал (смена версии первого экрана) — маршрут ленты другой
        if (vw) scheduleRebuild();
      }
      const t = clock.getElapsedTime();
      const scroll = window.scrollY;
      // прокрутка, под которую нарисована лента: во время паузы она стоит вместе со сценой
      const view = ribbon ? ribbon.view(scroll) : scroll;

      // финал: сцена встала — дальше анимация сама. Лента конечная (она вышла из «7» первого
      // экрана) и подлетает длиной ровно в «7»: голова дописывает знак, хвост идёт следом
      // и заходит в низ крючка (0–0.45); затем поверх проступает объёмный знак (0.45–0.8)
      const dt = Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      const smooth = (x: number) => x * x * (3 - 2 * x);
      // голова быстро влетает в знак и мягко тормозит; лента раскручивается и ложится
      // плашмя; затем — «бах»: объёмный знак быстро проступает с лёгким толчком
      const finTraceOf = (f: number) => 1 - Math.pow(1 - clamp01(f / 0.45), 3);
      const finFlatten = smooth(clamp01((finale - 0.18) / 0.37));
      const finReveal = smooth(clamp01((finale - 0.56) / 0.14));
      const finPop = clamp01((finale - 0.56) / 0.3);

      // ── лента ──
      let head = 0;
      let tail = 0;
      if (ribbon) {
        head = ribbon.headAt(scroll);
        const hold = [...ribbon.sevens.values()].find((g) => !g.lead);
        if (hold) head = Math.min(head, hold.start);
        tail = ribbon.tailFor(head, vh);
        // Лента конечная: на подлёте к финалу она плавно укорачивается до длины «7» (оба конца
        // видны на экране).
        if (hold) {
          const len7 = hold.end - hold.start;
          const near = vh * 0.9;
          const k = smooth(clamp01((head - (hold.start - near)) / near));
          if (k > 0) tail = head - (vh * 1.7 + (len7 - vh * 1.7) * k);
          // Запуск финала: как только лента целиком вышла из-под блока с глобусом (хвост ниже
          // его нижнего края) — или прокрутка уже дошла до финала — дальше всё делает анимация,
          // а страница сама докручивается до финального блока.
          if (!finOn) {
            const world = document.getElementById("world")?.getBoundingClientRect();
            ribbon.pointAt(tail, tailPos);
            const tailY = vh / 2 - tailPos.y - view;
            const emerged = !!world && head > hold.start - vh * 1.6 && tailY > world.bottom + 6;
            if (emerged || scroll >= hold.doneAt - 2) {
              finOn = true;
              trigHead = head;
              trigLen = head - tail;
              trigScroll = scroll;
              if (scroll < hold.doneAt) window.scrollTo({ top: hold.doneAt + 4, behavior: "smooth" });
            }
          } else if (scroll < trigScroll - 80) finOn = false;
          finale = clamp01(finale + ((finOn ? 1 : -1) * dt) / FINALE_SEC);
          // Финал: голова долетает до крючка и выписывает «7», хвост идёт следом, длина ленты
          // доходит ровно до длины знака — в конце вся лента и есть «7».
          if (finale > 0) {
            head = trigHead + (hold.end - trigHead) * finTraceOf(finale);
            tail = head - (trigLen + (len7 - trigLen) * finTraceOf(finale));
          }
        }
        if (appliedStyle !== "band") {
          ribbon.setStyle("band");
          appliedStyle = "band";
        }
        const u = ribbon.mesh.material.uniforms;
        u.uReveal.value = hold ? finReveal : 0;
        u.uFlatten.value = hold ? finFlatten : 0;
        ribbon.update(head, tail, t);
        // карточки, за которыми проходит лента: прямоугольники в пикселях буфера (ось Y вверх)
        const dpr = renderer.getPixelRatio();
        const occ = u.uOcc.value as THREE.Vector4[];
        let n = 0;
        document.querySelectorAll<HTMLElement>("[data-occlude]").forEach((el) => {
          if (n >= occ.length) return;
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
          occ[n++].set(r.left * dpr, (vh - r.bottom) * dpr, r.right * dpr, (vh - r.top) * dpr);
        });
        u.uOccN.value = n;
        u.uOccR.value = 24 * dpr;
        // полотно, под которое заезжает лента
        const sheet = document.querySelector<HTMLElement>("[data-sheet]");
        const sr = sheet?.getBoundingClientRect();
        (u.uSheet.value as THREE.Vector4).set(
          sr ? sr.left * dpr : 0,
          sr ? (vh - sr.bottom) * dpr : 0,
          sr ? sr.right * dpr : 0,
          sr ? (vh - sr.top) * dpr : 0,
        );
        u.uSheetR.value = 32 * dpr;
        ribbonGroup.position.y = view;
        heightGroup.position.y = view;
        const ru = relief.material.uniforms;
        (ru.uSheet.value as THREE.Vector4).copy(u.uSheet.value as THREE.Vector4);
        ru.uSheetR.value = 32 * dpr;
        ru.uH.value = ribbon.ridgeHeight * dpr;
        ru.uDark.value = root.dataset.theme === "dark" ? 1 : 0;
      }
      // рельеф считаем, только пока полотно на экране и под ним есть лента
      const sheetEl = document.querySelector<HTMLElement>("[data-sheet]");
      const sheetRect = sheetEl?.getBoundingClientRect();
      relief.visible = !!(ribbon?.ridge && sheetRect && sheetRect.bottom > 0 && sheetRect.top < vh);

      // ── строки, которые съезжают вбок (как заголовки у lusion) ──
      document.querySelectorAll<HTMLElement>("[data-shift]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) return;
        const k = parseFloat(el.dataset.shift ?? "0");
        el.style.transform = `translate3d(${((r.top + r.height / 2 - vh / 2) / vh) * k * vw}px,0,0)`;
      });

      // ── слова, которые лента расталкивает ──
      if (ribbon) {
        const s = ribbon.samples;
        document.querySelectorAll<HTMLElement>("[data-push]").forEach((el) => {
          const prev = pushState.get(el) ?? { x: 0, y: 0 };
          const r = el.getBoundingClientRect();
          if (r.bottom < -50 || r.top > vh + 50) return;
          const cx = r.left + r.width / 2 - prev.x;
          const cy = r.top + r.height / 2 - prev.y;
          let best = 1e9;
          let bx = 0;
          let by = 0;
          for (let i = 0; i < s.length; i += 3) {
            if (s[i + 2] < tail || s[i + 2] > head) continue;
            const px = s[i] + vw / 2;
            const py = vh / 2 - s[i + 1] - view;
            const d = (px - cx) ** 2 + (py - cy) ** 2;
            if (d < best) {
              best = d;
              bx = px;
              by = py;
            }
          }
          const R = Math.max(110, r.height * 1.4);
          const d = Math.sqrt(best);
          let tx = 0;
          let ty = 0;
          if (d < R) {
            // толкаем в основном вбок, чтобы строки не наезжали друг на друга
            const f = (1 - d / R) ** 2 * 18;
            tx = ((cx - bx) / (d || 1)) * f;
            ty = ((cy - by) / (d || 1)) * f * 0.25;
          }
          const nx = prev.x + (tx - prev.x) * 0.15;
          const ny = prev.y + (ty - prev.y) * 0.15;
          pushState.set(el, { x: nx, y: ny });
          el.style.transform = `translate3d(${nx}px,${ny}px,0)`;
        });
      }

      // ── знак «7» ──
      const idle = performance.now() - pointer.moved > 2500;
      for (const s of seqs.values()) {
        const r = s.entry.el.getBoundingClientRect();
        const visible = r.bottom > 0 && r.top < vh && r.width > 0;
        s.mesh.visible = visible;
        if (!visible) continue;
        const n = s.entry.frames.length;
        const u = s.mesh.material.uniforms;
        // связь с лентой: lo/hi — какая часть знака по ходу письма видна, lock — насколько знак
        // развёрнут лицом к зрителю (контур ленты совпадает только с фронтальным кадром)
        const g = ribbon?.sevens.get(s.entry.el.dataset.ribbon ?? "");
        let lo = -1;
        const hi = 2; // проявление по линии письма больше не используется: финальный знак проступает целиком
        let lock = 0;
        if (g?.lead) {
          const p = clamp01((head - g.start) / (g.end - g.start || 1));
          lo = p <= 0 ? -1 : p >= 1 ? 2 : p;
          lock = clamp01(scroll / (vh * SEVEN_TURN * 0.8));
        }
        // финальный знак проступает поверх ленты целиком; лента остаётся пристёгнутой
        // к крючку, поэтому знак всё время смотрит прямо
        let alpha = 1;
        if (g && !g.lead) {
          const rv = clamp01(finReveal / 0.7);
          alpha = rv * rv * (3 - 2 * rv);
          lock = 1;
        }
        u.uAlpha.value = alpha;
        u.uLo.value = lo;
        u.uHi.value = hi;
        u.uTime.value = t;
        const cursor = idle ? 0.5 + Math.sin(t * 0.35) * 0.32 : pointer.x;
        const target = cursor + (0.5 - cursor) * lock;
        s.cur += (target * (n - 1) - s.cur) * (0.08 + 0.3 * lock);
        // пока знак переходит в ленту, кадр строго фронтальный — иначе контуры разойдутся
        if (lo > 0 || (g && !g.lead)) s.cur = s.entry.initial;
        let idx = Math.max(0, Math.min(n - 1, Math.round(s.cur)));
        let img = s.entry.frames[idx];
        // финальный знак: ролик из Blender по времени финала — первый кадр совпадает с лёгшей
        // плашмя лентой, дальше «7» выдавливается в объём с перелётом и встаёт в фас
        const birth = g && !g.lead ? s.entry.birth : undefined;
        const birthOn = !!birth && birth.every((b) => b.complete && b.naturalWidth);
        if (birth && birthOn) {
          const b = Math.round(clamp01((finale - 0.6) / 0.4) * (birth.length - 1));
          img = birth[b];
          idx = n + b;
        }
        if (idx !== s.shown && img.complete && img.naturalWidth) {
          s.tex.image = img;
          s.tex.needsUpdate = true;
          s.shown = idx;
        }
        const bob = Math.sin(t * 1.1) * r.height * 0.012 * (1 - lock);
        // финальный знак — перед лентой (она его выписала и уходит под него)
        s.mesh.position.set(r.left + r.width / 2 - vw / 2, vh / 2 - (r.top + r.height / 2) + bob, g && !g.lead ? 60 : 0);
        // финальный знак появляется с лёгким толчком: чуть больше и мягко на место
        const pop = g && !g.lead && !birthOn ? 1 + 0.045 * Math.sin(Math.PI * finPop) * (1 - finPop * 0.4) : 1;
        s.mesh.scale.set(r.width * pop, r.height * pop, 1);
        u.uOpacity.value += ((s.shown >= 0 ? 1 : 0) - u.uOpacity.value) * 0.08;
      }

      // ── карточка-морф ──
      const tmp = new THREE.Vector2();
      for (const m of morphs.values()) {
        const ra = m.entry.a.getBoundingClientRect();
        const rb = m.entry.b.getBoundingClientRect();
        const u = m.mesh.material.uniforms;
        // полёт: начинается, когда большая карточка входит снизу, кончается у верха экрана
        const p = clamp01((vh * 0.98 - rb.top) / (vh * 0.86));
        const visible = (ra.bottom > -40 && ra.top < vh + 40) || (rb.bottom > -40 && rb.top < vh + 40) || (p > 0 && p < 1);
        m.mesh.visible = visible;
        if (!visible) continue;
        const delays = [0.18, 0, 0.1, 0.28]; // правый верхний угол «тянет» лента
        const ca = [
          [ra.left, ra.top],
          [ra.right, ra.top],
          [ra.right, ra.bottom],
          [ra.left, ra.bottom],
        ];
        const cb = [
          [rb.left, rb.top],
          [rb.right, rb.top],
          [rb.right, rb.bottom],
          [rb.left, rb.bottom],
        ];
        (u.uC.value as THREE.Vector2[]).forEach((v, i) => {
          const k = ease(clamp01((p - delays[i]) / (1 - 0.28)));
          toGL(ca[i][0] + (cb[i][0] - ca[i][0]) * k, ca[i][1] + (cb[i][1] - ca[i][1]) * k, v);
        });
        u.uBend.value = Math.sin(p * Math.PI) * 1.0;
        const w = ra.width + (rb.width - ra.width) * ease(p);
        const h = ra.height + (rb.height - ra.height) * ease(p);
        u.uSize.value.set(w, h);
        u.uRadius.value = 24 + (28 - 24) * p;
        u.uTint.value = 1 - ease(clamp01((p - 0.2) / 0.6));
        u.uTime.value = t;
        const dip = ribbon?.marks.get(m.entry.dip);
        // заливка идёт строго за прокруткой (за головой ленты), без скачка, когда начинается полёт
        u.uFill.value = dip === undefined ? 1 : Math.max(clamp01((head - dip) / 420), clamp01(p / 0.3));
        if (dip !== undefined && ribbon) {
          // точка касания ленты в координатах карточки
          const s = ribbon.samples;
          const i = Math.min(s.length / 3 - 1, Math.round((dip / (s[s.length - 1] || 1)) * (s.length / 3 - 1)));
          tmp.set((s[i * 3] + vw / 2 - ra.left) / ra.width, 1 - (vh / 2 - s[i * 3 + 1] - view - ra.top) / ra.height);
          u.uOrigin.value.copy(tmp);
        }
        const v = m.entry.video;
        if (v.videoWidth) u.uTexSize.value.set(v.videoWidth, v.videoHeight);
        if (v.paused && v.readyState >= 2) v.play().catch(() => {});
      }

      if (relief.visible) {
        renderer.setRenderTarget(heightTarget);
        renderer.render(heightScene, camera);
        // размытие: по горизонтали в blurTarget, по вертикали обратно в heightTarget
        const bu = blurMat.uniforms;
        bu.uTex.value = heightTarget.texture;
        (bu.uDir.value as THREE.Vector2).set(1 / heightTarget.width, 0);
        renderer.setRenderTarget(blurTarget);
        renderer.render(blurScene, camera);
        bu.uTex.value = blurTarget.texture;
        (bu.uDir.value as THREE.Vector2).set(0, 1 / heightTarget.height);
        renderer.setRenderTarget(heightTarget);
        renderer.render(blurScene, camera);
        renderer.setRenderTarget(null);
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(rebuildTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      ro.disconnect();
      ribbon?.dispose();
      relief.geometry.dispose();
      relief.material.dispose();
      heightTarget.dispose();
      blurTarget.dispose();
      blurQuad.geometry.dispose();
      blurMat.dispose();
      for (const s of seqs.values()) {
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        s.tex.dispose();
      }
      for (const m of morphs.values()) {
        m.mesh.geometry.dispose();
        m.mesh.material.dispose();
        m.tex.dispose();
      }
      renderer.dispose();
      delete root.dataset.gl;
    };
  }, [state, steps]);

  return (
    <Ctx.Provider value={registry}>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[5] h-full w-full" />
      {children}
    </Ctx.Provider>
  );
}
