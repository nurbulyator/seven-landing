"use client";

import { useEffect, useRef } from "react";

/**
 * Звёздное небо за глобусом (тёмная тема): мелкие звёзды разной яркости в три слоя — слои
 * медленно плывут и смещаются за курсором с разной глубиной, звёзды мерцают, изредка
 * пролетает падающая звезда. Свой холст под холстом глобуса; фон слоя остаётся из вёрстки.
 */

const vertex = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fragment = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uPar;  // смещение курсора от центра экрана, −1..1

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// один слой звёзд: в каждой клетке не больше одной звезды, случайное место, яркость и мерцание
float starLayer(vec2 fc, float cell, float chance, float bright, float glow, float seed) {
  vec2 id = floor(fc / cell);
  vec2 f = fc - id * cell;
  float h = hash(id + seed);
  if (h > chance) return 0.0;
  vec2 pos = (0.15 + 0.7 * vec2(hash(id + seed + 11.3), hash(id + seed + 27.1))) * cell;
  float b = bright * pow(hash(id + seed + 5.7), 2.2);
  b *= 0.6 + 0.4 * sin(uTime * (0.6 + 1.8 * hash(id + seed + 3.1)) + h * 40.0);
  float d = length(f - pos) / uDpr;
  float r = 0.55 + 0.6 * b;
  return b * (exp(-d * d / (r * r)) + glow * exp(-d / 3.2) * 0.35);
}

float stars(vec2 fc) {
  vec2 drift = vec2(uTime * 2.2, -uTime * 0.8) * uDpr;
  float s = 0.0;
  s += starLayer(fc + drift * 0.4 + uPar * 6.0 * uDpr, 30.0 * uDpr, 0.55, 0.7, 0.0, 1.0);
  s += starLayer(fc + drift * 0.8 + uPar * 14.0 * uDpr, 62.0 * uDpr, 0.6, 1.0, 0.5, 17.0);
  s += starLayer(fc + drift * 1.3 + uPar * 26.0 * uDpr, 130.0 * uDpr, 0.6, 1.25, 1.0, 43.0);
  // изредка — падающая звезда: короткий росчерк по диагонали, раз в несколько секунд
  float P = 6.5;
  float k = floor(uTime / P);
  float tt = uTime - k * P;
  if (tt < 0.9) {
    vec2 start = vec2(0.25 + 0.7 * hash(vec2(k, 1.0)), 0.05 + 0.35 * hash(vec2(k, 2.0))) * uRes;
    vec2 dir = normalize(vec2(-1.0, 0.42));
    float len = 0.35 * uRes.y;
    vec2 head = start + dir * len * (tt / 0.9);
    vec2 tail = head - dir * 0.18 * uRes.y * min(1.0, tt / 0.25);
    vec2 pa = fc - tail, ba = head - tail;
    float hseg = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
    float d = length(pa - ba * hseg) / uDpr;
    float fade = sin(3.14159 * tt / 0.9);
    s += hseg * hseg * fade * exp(-d * d / 0.9) * 0.9;
  }
  return s;
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float st = clamp(stars(fc), 0.0, 1.0);
  vec3 tint = mix(vec3(1.0), vec3(0.75, 0.95, 1.0), step(0.7, hash(floor(fc / (130.0 * uDpr)))));
  outColor = vec4(tint * st, st);
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

export function StarField() {
  const ref = useRef<HTMLCanvasElement>(null);

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
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uDpr = gl.getUniformLocation(prog, "uDpr");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uPar = gl.getUniformLocation(prog, "uPar");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 1;
    let h = 1;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const par = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      par.tx = (e.clientX / window.innerWidth) * 2 - 1;
      par.ty = (e.clientY / window.innerHeight) * 2 - 1;
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
      par.x += (par.tx - par.x) * Math.min(1, dt * 2.5);
      par.y += (par.ty - par.y) * Math.min(1, dt * 2.5);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uTime, reduce ? 0 : (now - t0) / 1000);
      gl.uniform2f(uPar, reduce ? 0 : par.x, reduce ? 0 : par.y);
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
