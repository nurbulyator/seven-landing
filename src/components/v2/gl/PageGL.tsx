"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import { buildRibbon, type Ribbon, type RibbonStep } from "@/components/v2/gl/ribbon";

/**
 * Единый WebGL-слой /v2 поверх страницы (фиксированный холст, камера в пикселях экрана).
 * На нём живут:
 *  - лента, ползущая за прокруткой (ribbon.ts);
 *  - знак «7» из кадров Blender, который поворачивается за курсором;
 *  - карточка-«морф»: маленькая карточка, которую лента заливает цветом, а затем
 *    вытягивает в большой ролик — углы летят с разной задержкой, края выгибаются.
 * Плюс DOM-эффекты: строки с data-shift съезжают по горизонтали, слова с data-push
 * отталкиваются от ленты.
 * Без WebGL или при «уменьшить движение» остаются обычные <img>/<video> из вёрстки.
 */

export type SeqEntry = { el: HTMLElement; frames: HTMLImageElement[]; initial: number };
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
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uTex, vUv);
    if (c.a < 0.35) discard; // прозрачные места не пишут глубину — лента за знаком видна
    gl_FragColor = vec4(c.rgb, 1.0) * uOpacity;
  }
`;

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

    const rebuildRibbon = () => {
      if (ribbon) {
        ribbonGroup.remove(ribbon.mesh);
        ribbon.dispose();
      }
      ribbon = buildRibbon(steps, vw, vh, vw < 700 ? 8 : 13);
      if (ribbon) ribbonGroup.add(ribbon.mesh);
    };
    let rebuildTimer = 0;
    const scheduleRebuild = () => {
      clearTimeout(rebuildTimer);
      rebuildTimer = window.setTimeout(rebuildRibbon, 120);
    };

    const resize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(vw, vh, false);
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
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.ShaderMaterial({
            vertexShader: seqVertex,
            fragmentShader: seqFragment,
            transparent: true,
            uniforms: { uTex: { value: tex }, uOpacity: { value: 0 } },
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
      }
      const t = clock.getElapsedTime();
      const scroll = window.scrollY;

      // ── лента ──
      let head = 0;
      let tail = 0;
      if (ribbon) {
        head = ribbon.headAt(scroll);
        tail = ribbon.tailFor(head, vh);
        const u = ribbon.mesh.material.uniforms;
        u.uHead.value = head;
        u.uTail.value = tail;
        u.uTime.value = t;
        ribbonGroup.position.y = scroll;
      }

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
            const py = vh / 2 - s[i + 1] - scroll;
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
        const target = idle ? 0.5 + Math.sin(t * 0.35) * 0.32 : pointer.x;
        s.cur += (target * (n - 1) - s.cur) * 0.08;
        const idx = Math.max(0, Math.min(n - 1, Math.round(s.cur)));
        const img = s.entry.frames[idx];
        if (idx !== s.shown && img.complete && img.naturalWidth) {
          s.tex.image = img;
          s.tex.needsUpdate = true;
          s.shown = idx;
        }
        const bob = Math.sin(t * 1.1) * r.height * 0.012;
        s.mesh.position.set(r.left + r.width / 2 - vw / 2, vh / 2 - (r.top + r.height / 2) + bob, 0);
        s.mesh.scale.set(r.width, r.height, 1);
        const u = s.mesh.material.uniforms;
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
        u.uFill.value = dip === undefined ? 1 : Math.max(clamp01((head - dip) / 420), p > 0 ? 1 : 0);
        if (dip !== undefined && ribbon) {
          // точка касания ленты в координатах карточки
          const s = ribbon.samples;
          const i = Math.min(s.length / 3 - 1, Math.round((dip / (s[s.length - 1] || 1)) * (s.length / 3 - 1)));
          tmp.set((s[i * 3] + vw / 2 - ra.left) / ra.width, 1 - (vh / 2 - s[i * 3 + 1] - scroll - ra.top) / ra.height);
          u.uOrigin.value.copy(tmp);
        }
        const v = m.entry.video;
        if (v.videoWidth) u.uTexSize.value.set(v.videoWidth, v.videoHeight);
        if (v.paused && v.readyState >= 2) v.play().catch(() => {});
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
