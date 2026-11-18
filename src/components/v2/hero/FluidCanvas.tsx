"use client";

import { useEffect, useRef } from "react";

/**
 * Версия B первого экрана — «Поток». Симуляция жидкости на WebGL2 (метод Стэма:
 * адвекция → завихрённость → давление → вычитание градиента). Курсор размешивает
 * светящиеся бирюзовые и янтарные чернила. Пока курсора нет, поток размешивается сам.
 */

const baseVertex = `#version 300 es
in vec2 aPos;
out vec2 vUv, vL, vR, vT, vB;
uniform vec2 uTexel;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const head = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 o;
`;

const shaders = {
  splat: `${head}
uniform sampler2D uTarget; uniform float uAspect; uniform vec3 uColor; uniform vec2 uPoint; uniform float uRadius;
void main() {
  vec2 p = vUv - uPoint; p.x *= uAspect;
  o = vec4(texture(uTarget, vUv).xyz + exp(-dot(p, p) / uRadius) * uColor, 1.0);
}`,
  advect: `${head}
uniform sampler2D uVelocity, uSource; uniform vec2 uTexel; uniform float uDt, uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  o = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}`,
  divergence: `${head}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  curl: `${head}
uniform sampler2D uVelocity;
void main() {
  o = vec4(0.5 * (texture(uVelocity, vR).y - texture(uVelocity, vL).y - texture(uVelocity, vT).x + texture(uVelocity, vB).x), 0.0, 0.0, 1.0);
}`,
  vorticity: `${head}
uniform sampler2D uVelocity, uCurl; uniform float uCurlK, uDt;
void main() {
  float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 0.0001; f *= uCurlK * C; f.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + f * uDt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`,
  pressure: `${head}
uniform sampler2D uPressure, uDivergence;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradient: `${head}
uniform sampler2D uPressure, uVelocity;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
}`,
  clear: `${head}
uniform sampler2D uTex; uniform float uValue;
void main() { o = uValue * texture(uTex, vUv); }`,
  display: `${head}
uniform sampler2D uTex; uniform vec3 uBg; uniform vec2 uTexel;
void main() {
  vec3 c = texture(uTex, vUv).rgb;
  // объём: подсветка по градиенту яркости, как у густых чернил
  float dx = length(texture(uTex, vR).rgb) - length(texture(uTex, vL).rgb);
  float dy = length(texture(uTex, vT).rgb) - length(texture(uTex, vB).rgb);
  vec3 n = normalize(vec3(dx, dy, length(uTexel)));
  float light = clamp(dot(n, normalize(vec3(-0.4, 0.6, 1.0))) + 0.65, 0.6, 1.4);
  vec3 ink = (1.0 - exp(-c * 1.6)) * light;
  o = vec4(uBg + ink * (1.0 - uBg), 1.0);
}`,
} as const;

type FBO = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };
type DoubleFBO = { read: FBO; write: FBO; swap(): void };

export function FluidCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return;
    gl.getExtension("OES_texture_float_linear");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, baseVertex);
    type Prog = { use(): void; u(name: string): WebGLUniformLocation | null };
    const program = (src: string): Prog => {
      const p = gl.createProgram()!;
      gl.attachShader(p, vs);
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
      gl.bindAttribLocation(p, 0, "aPos");
      gl.linkProgram(p);
      const cache = new Map<string, WebGLUniformLocation | null>();
      return {
        use: () => gl.useProgram(p),
        u: (name) => {
          if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
          return cache.get(name)!;
        },
      };
    };
    let progs: Record<keyof typeof shaders, Prog>;
    try {
      progs = Object.fromEntries(Object.entries(shaders).map(([k, src]) => [k, program(src)])) as Record<
        keyof typeof shaders,
        Prog
      >;
    } catch {
      return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const fbo = (w: number, h: number, internal: number, format: number): FBO => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb, w, h };
    };
    const double = (w: number, h: number, internal: number, format: number): DoubleFBO => {
      const d = {
        read: fbo(w, h, internal, format),
        write: fbo(w, h, internal, format),
        swap() {
          [d.read, d.write] = [d.write, d.read];
        },
      };
      return d;
    };
    const size = (res: number) => {
      const aspect = canvas.width / canvas.height || 1;
      return aspect > 1 ? [Math.round(res * aspect), res] : [res, Math.round(res / aspect)];
    };

    let velocity: DoubleFBO, dye: DoubleFBO, pressure: DoubleFBO, divergence: FBO, curl: FBO;
    const init = () => {
      const [sw, sh] = size(128);
      const [dw, dh] = size(Math.min(720, canvas.height));
      velocity = double(sw, sh, gl.RG16F, gl.RG);
      pressure = double(sw, sh, gl.R16F, gl.RED);
      divergence = fbo(sw, sh, gl.R16F, gl.RED);
      curl = fbo(sw, sh, gl.R16F, gl.RED);
      dye = double(dw, dh, gl.RGBA16F, gl.RGBA);
    };

    const blit = (target: FBO | null) => {
      if (target) {
        gl.viewport(0, 0, target.w, target.h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      } else {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const bind = (p: Prog, name: string, tex: WebGLTexture, unit: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(p.u(name), unit);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w === canvas.width && h === canvas.height && velocity) return;
      canvas.width = w;
      canvas.height = h;
      init();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const palette: [number, number, number][] = [
      [0.0, 0.73, 0.77], // бирюза
      [1.0, 0.71, 0.25], // янтарь
      [0.1, 0.55, 0.62],
      [1.0, 0.6, 0.35],
    ];
    let colorIdx = 0;
    const splat = (x: number, y: number, dx: number, dy: number, color: [number, number, number], radius = 0.0022) => {
      const aspect = canvas.width / canvas.height;
      progs.splat.use();
      gl.uniform1f(progs.splat.u("uAspect"), aspect);
      gl.uniform2f(progs.splat.u("uPoint"), x, y);
      gl.uniform1f(progs.splat.u("uRadius"), radius);
      bind(progs.splat, "uTarget", velocity.read.tex, 0);
      gl.uniform3f(progs.splat.u("uColor"), dx, dy, 0);
      blit(velocity.write);
      velocity.swap();
      bind(progs.splat, "uTarget", dye.read.tex, 0);
      gl.uniform3f(progs.splat.u("uColor"), ...color);
      blit(dye.write);
      dye.swap();
    };

    const pointer = { x: 0, y: 0, px: 0, py: 0, moved: false, active: false };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = (e.clientX - r.left) / r.width;
      pointer.y = 1 - (e.clientY - r.top) / r.height;
      if (!pointer.active) {
        pointer.px = pointer.x;
        pointer.py = pointer.y;
        pointer.active = true;
      }
      pointer.moved = true;
    };
    const onLeave = () => (pointer.active = false);
    const onDown = () => {
      colorIdx++;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        splat(pointer.x, pointer.y, Math.cos(a) * 900, Math.sin(a) * 900, palette[(colorIdx + k) % 4].map((v) => v * 0.6) as [number, number, number], 0.0012);
      }
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const bgVec: [number, number, number] = [0.027, 0.047, 0.055];
    let last = performance.now();
    let auto = 0;
    let raf = 0;
    const step = (dt: number) => {
      const [sw, sh] = [velocity.read.w, velocity.read.h];
      const texel = [1 / sw, 1 / sh] as const;
      for (const p of Object.values(progs)) {
        p.use();
        gl.uniform2f(p.u("uTexel"), ...texel);
      }
      progs.curl.use();
      bind(progs.curl, "uVelocity", velocity.read.tex, 0);
      blit(curl);
      progs.vorticity.use();
      bind(progs.vorticity, "uVelocity", velocity.read.tex, 0);
      bind(progs.vorticity, "uCurl", curl.tex, 1);
      gl.uniform1f(progs.vorticity.u("uCurlK"), 12);
      gl.uniform1f(progs.vorticity.u("uDt"), dt);
      blit(velocity.write);
      velocity.swap();
      progs.divergence.use();
      bind(progs.divergence, "uVelocity", velocity.read.tex, 0);
      blit(divergence);
      progs.clear.use();
      bind(progs.clear, "uTex", pressure.read.tex, 0);
      gl.uniform1f(progs.clear.u("uValue"), 0.8);
      blit(pressure.write);
      pressure.swap();
      progs.pressure.use();
      bind(progs.pressure, "uDivergence", divergence.tex, 1);
      for (let i = 0; i < 20; i++) {
        bind(progs.pressure, "uPressure", pressure.read.tex, 0);
        blit(pressure.write);
        pressure.swap();
      }
      progs.gradient.use();
      bind(progs.gradient, "uPressure", pressure.read.tex, 0);
      bind(progs.gradient, "uVelocity", velocity.read.tex, 1);
      blit(velocity.write);
      velocity.swap();
      progs.advect.use();
      gl.uniform1f(progs.advect.u("uDt"), dt);
      bind(progs.advect, "uVelocity", velocity.read.tex, 0);
      bind(progs.advect, "uSource", velocity.read.tex, 1);
      gl.uniform1f(progs.advect.u("uDissipation"), 0.2);
      blit(velocity.write);
      velocity.swap();
      gl.uniform2f(progs.advect.u("uTexel"), 1 / sw, 1 / sh);
      bind(progs.advect, "uVelocity", velocity.read.tex, 0);
      bind(progs.advect, "uSource", dye.read.tex, 1);
      gl.uniform1f(progs.advect.u("uDissipation"), 0.55);
      blit(dye.write);
      dye.swap();
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (pointer.moved) {
        pointer.moved = false;
        const dx = (pointer.x - pointer.px) * 6000;
        const dy = (pointer.y - pointer.py) * 6000;
        const c = palette[Math.floor(now / 1400) % 4];
        splat(pointer.x, pointer.y, dx, dy, [c[0] * 0.18, c[1] * 0.18, c[2] * 0.18]);
      }
      // сам себя размешивает: два «пера» ходят по восьмёрке
      auto += dt;
      if (!pointer.active && !reduce) {
        for (let k = 0; k < 2; k++) {
          const t = auto * 0.45 + k * Math.PI;
          const x = 0.62 + 0.24 * Math.sin(t);
          const y = 0.5 + 0.28 * Math.sin(t * 2) * 0.8;
          const vx = 0.24 * Math.cos(t) * 0.45 * 2600;
          const vy = 0.28 * 0.8 * 2 * Math.cos(t * 2) * 0.45 * 2600;
          const c = palette[k === 0 ? 0 : 1];
          splat(x, y, vx, vy, [c[0] * 0.05, c[1] * 0.05, c[2] * 0.05], 0.0016);
        }
      }
      if (!reduce || pointer.active) step(dt);
      progs.display.use();
      gl.uniform3f(progs.display.u("uBg"), ...bgVec);
      gl.uniform2f(progs.display.u("uTexel"), 1 / dye.read.w, 1 / dye.read.h);
      bind(progs.display, "uTex", dye.read.tex, 0);
      blit(null);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      // контекст не теряем намеренно: у холста он один, и повторный запуск эффекта (StrictMode) получил бы мёртвый
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full touch-pan-y bg-[#070c0e]" aria-hidden />;
}
