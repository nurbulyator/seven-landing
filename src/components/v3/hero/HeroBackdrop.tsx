"use client";

import { useEffect, useRef } from "react";

/**
 * Живой фон первого экрана /v3 — «семь холмов». Рельеф из семи мягких холмов (главный — за знаком «7»)
 * медленно дышит и плывёт; курсор продавливает его и тянет за собой волну. Один и тот же рельеф
 * в двух подачах: изолинии (как топокарта) и поле точек.
 * Рисует только линии/точки с прозрачностью — фон карточки остаётся из вёрстки.
 */

export type BackdropStyle = "contours" | "dots";

const vertex = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fragment = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;      // размер холста, px
uniform float uDpr;
uniform float uTime;
uniform vec2 uMouse;    // курсор в единицах высоты карточки (0..aspect, 0..1), y вниз
uniform float uPress;   // насколько курсор продавил рельеф (0..1, растёт при движении)
uniform float uWave;    // энергия волны от движения курсора
uniform vec3 uHill[7];  // x, y (в единицах высоты), радиус
uniform float uAmp[7];
uniform int uStyle;     // 0 — изолинии, 1 — точки
uniform float uDark;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

float height(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 c = uHill[i].xy + 0.03 * vec2(sin(uTime * 0.13 + fi * 1.7), cos(uTime * 0.11 + fi * 2.3));
    float r = uHill[i].z * (1.0 + 0.06 * sin(uTime * 0.21 + fi));
    vec2 d = p - c;
    h += uAmp[i] * exp(-dot(d, d) / (r * r));
  }
  vec2 q = p * 2.3 + vec2(uTime * 0.025, -uTime * 0.018);
  h += 0.09 * (noise(q) + 0.5 * noise(q * 2.1 + 3.7));
  vec2 m = p - uMouse;
  float md = dot(m, m);
  h -= 0.2 * uPress * exp(-md / 0.012);                               // курсор продавливает
  h += 0.035 * uWave * sin(sqrt(md) * 42.0 - uTime * 6.0) * exp(-sqrt(md) * 5.5); // и гонит волну
  return h;
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = fc / uRes.y;
  vec2 uv = fc / uRes;
  vec3 ink = mix(vec3(0.0, 0.47, 0.5), vec3(0.5, 0.89, 0.91), uDark);
  // внизу слева — заголовок: там фон тише, чтобы текст читался
  float quiet = mix(0.22, 1.0, smoothstep(0.7, 1.25, length((uv - vec2(0.3, 0.74)) / vec2(0.4, 0.34))));
  float near = exp(-dot(p - uMouse, p - uMouse) / 0.03) * uPress;
  vec4 col = vec4(0.0);

  if (uStyle == 0) {
    float h = height(p);
    float v = h * 15.0;
    float f = fract(v);
    float w = fwidth(v);
    float major = step(4.5, mod(floor(v + 0.5), 5.0)); // каждая пятая линия — потолще
    float px = (min(f, 1.0 - f)) / max(w, 1e-4);
    float line = 1.0 - smoothstep(0.35 + major * 0.5, 1.1 + major * 0.6, px / uDpr);
    float a = line * (0.2 + 0.14 * major + 0.35 * near) * quiet;
    col = vec4(ink * a, a);
  } else {
    float s = 15.0 * uDpr;
    vec2 cell = (floor(fc / s) + 0.5) * s;
    vec2 cp = cell / uRes.y;
    float e = 0.004;
    float h = height(cp);
    vec2 g = vec2(height(cp + vec2(e, 0.0)) - h, height(cp + vec2(0.0, e)) - h) / e;
    float r = s * (0.09 + 0.2 * clamp(h, 0.0, 1.0));
    // точки съезжают со склонов, но не дальше своей клетки (иначе обрезаются её краем)
    vec2 off = -g * s * 0.3;
    float maxOff = max(0.0, s * 0.5 - r - uDpr);
    if (length(off) > maxOff) off = normalize(off) * maxOff;
    vec2 c = cell + off;
    float d = length(fc - c) - r;
    float dot1 = 1.0 - smoothstep(-uDpr * 0.6, uDpr * 0.6, d);
    float a = dot1 * (0.1 + 0.32 * clamp(h, 0.0, 1.0) + 0.35 * near) * quiet;
    col = vec4(ink * a, a);
  }
  outColor = col;
}
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

/** Холмы в долях карточки: x — доля ширины, y — доля высоты, r и амплитуда. Первый — за знаком. */
const HILLS: [number, number, number, number][] = [
  [0.0, 0.0, 0.34, 0.95],
  [0.1, 0.18, 0.2, 0.55],
  [0.34, 0.1, 0.17, 0.42],
  [0.5, 0.42, 0.22, 0.5],
  [0.2, 0.62, 0.24, 0.35],
  [0.96, 0.92, 0.2, 0.6],
  [0.6, 0.9, 0.18, 0.4],
];

export function HeroBackdrop({ styleKey, dark }: { styleKey: BackdropStyle; dark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ styleKey, dark });
  useEffect(() => {
    opts.current = { styleKey, dark };
  }, [styleKey, dark]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, vertex);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = {
      res: U("uRes"),
      dpr: U("uDpr"),
      time: U("uTime"),
      mouse: U("uMouse"),
      press: U("uPress"),
      wave: U("uWave"),
      hill: U("uHill"),
      amp: U("uAmp"),
      style: U("uStyle"),
      dark: U("uDark"),
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      // главный холм — под знаком «7» (он справа, на телефоне — сверху по центру)
      const seven = document.querySelector<HTMLElement>('[data-ribbon="seven-hero"]')?.getBoundingClientRect();
      const aspect = r.width / r.height;
      const hills = new Float32Array(21);
      const amps = new Float32Array(7);
      HILLS.forEach(([x, y, rad, a], i) => {
        let hx = x * aspect;
        let hy = y;
        if (i === 0) {
          hx = seven ? (seven.left + seven.width / 2 - r.left) / r.height : 0.75 * aspect;
          hy = seven ? (seven.top + seven.height / 2 - r.top) / r.height : 0.45;
        }
        hills.set([hx, hy, rad * Math.max(1, aspect * 0.6)], i * 3);
        amps[i] = a;
      });
      gl.uniform3fv(u.hill, hills);
      gl.uniform1fv(u.amp, amps);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const mouse = { x: -10, y: -10, tx: -10, ty: -10, press: 0, wave: 0, last: 0 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) return;
      const nx = (e.clientX - r.left) / r.height;
      const ny = (e.clientY - r.top) / r.height;
      if (mouse.tx < -5) {
        mouse.x = nx;
        mouse.y = ny;
      }
      mouse.wave = Math.min(1, mouse.wave + Math.hypot(nx - mouse.tx, ny - mouse.ty) * 4);
      mouse.tx = nx;
      mouse.ty = ny;
      mouse.last = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);

    let raf = 0;
    const t0 = performance.now();
    let prev = t0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const active = now - mouse.last < 1200;
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 7);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 7);
      mouse.press += ((active ? 1 : 0) - mouse.press) * Math.min(1, dt * (active ? 4 : 1.2));
      mouse.wave *= Math.exp(-dt * 1.6);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.dpr, dpr);
      gl.uniform1f(u.time, reduce ? 0 : (now - t0) / 1000);
      gl.uniform2f(u.mouse, mouse.x, mouse.y);
      gl.uniform1f(u.press, reduce ? 0 : mouse.press);
      gl.uniform1f(u.wave, reduce ? 0 : mouse.wave);
      const { styleKey: st, dark: dk } = opts.current;
      gl.uniform1i(u.style, st === "contours" ? 0 : 1);
      gl.uniform1f(u.dark, dk ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      // контекст не теряем: в разработке React запускает эффект повторно на том же холсте
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
