"use client";

import { useEffect, useRef, type RefObject } from "react";

import { formPlacement } from "@/components/v4/MorphCanvas";

/**
 * 3D-формы продуктов из частиц (/v5). Облака точек сняты с моделей Blender
 * (blender/particles_products.py → public/v5/products.bin): у всех семи форм одинаковое число точек,
 * и i-я точка одной формы при смене продукта летит в i-ю точку следующей. На лету точки
 * срываются с места, закручиваются потоком и собираются в новую форму. Бирюзовые акценты
 * (линия графика, галочка, связи, волны, индикаторы) мерцают волной от центра.
 * Вход и выход — лентой, как основная лента страницы: перед первым продуктом слева прилетает лента
 * из точек и рассыпается в форму; после последнего форма вытягивается в ленту и уезжает влево.
 * Место и размер формы — как у MorphCanvas (/v4).
 */

const SHAPES = 7;

const vertex = `#version 300 es
in vec4 aP0; in vec4 aP1; in vec4 aP2; in vec4 aP3; in vec4 aP4; in vec4 aP5; in vec4 aP6;
in vec2 aRnd;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uScale;
uniform float uW[${SHAPES}];
uniform float uF;       // доля текущего перехода 0…1 (поток сильнее всего посередине)
uniform float uM;       // номер продукта с дробной частью — для покачивания
uniform float uTime;
uniform vec2 uLook;
uniform float uEnter;   // 0 — точки ещё лентой за левым краем, 1 — собраны в форму
uniform float uSize;
uniform float uExit;    // 0…1 — точки струёй утекают с формы за левый край
out float vAcc;
out float vExit;
out float vDepth;
out float vPhase;

const float Q = 1.5;
const float CAM = 6.0;
const float FOCAL = 1.6;

void main() {
  vec4 p = aP0 * uW[0] + aP1 * uW[1] + aP2 * uW[2] + aP3 * uW[3] + aP4 * uW[4] + aP5 * uW[5] + aP6 * uW[6];
  vec3 pos = p.xyz * Q;
  vAcc = p.w;

  // переход: точку срывает потоком и закручивает вокруг вертикали, к концу она садится на место
  float flow = sin(3.14159 * uF) * (0.5 + 0.9 * aRnd.x);
  vec3 q = pos * 1.3 + vec3(0.0, uTime * 0.4, 0.0);
  vec3 curl = vec3(sin(q.y * 2.1 + uTime + aRnd.y * 6.0), sin(q.z * 1.7 + uTime * 1.3), sin(q.x * 1.9 - uTime * 0.8));
  pos += curl * 0.38 * flow;
  float sw = flow * 1.1 * (aRnd.y - 0.35);
  pos.xz = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * pos.xz;
  // в покое — чуть заметное дыхание
  pos += 0.0025 * vec3(sin(uTime * 1.7 + aRnd.x * 40.0), sin(uTime * 1.3 + aRnd.y * 40.0), 0.0);


  // три четверти сверху, покачивание между продуктами, курсор
  float yaw = -0.45 + 0.35 * sin(3.14159 * uM) + 0.1 * sin(uTime * 0.4) + uLook.x;
  float pitch = 0.3 + 0.04 * sin(uTime * 0.31) + uLook.y;
  pos.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * pos.xz;
  pos.yz = mat2(cos(pitch), -sin(pitch), sin(pitch), cos(pitch)) * pos.yz;

  float persp = FOCAL / (CAM - pos.z);
  vec2 uv = pos.xy * persp * uScale + uCenter;
  // струя: точки по очереди срываются с формы и плавной дугой утекают за левый край (выход),
  // или прилетают оттуда же и рассыпаются по форме (вход). Путь — кривая Безье P0 → P1 → P2,
  // aRnd.x — место точки в струе (0 — голова, 1 — хвост), поперёк — узкая лента с лёгкой закруткой.
  float halfW = 0.5 * uRes.x / min(uRes.x, uRes.y);
  const float L = 0.55;
  float sIn = aRnd.x;
  float t = 0.0;
  float onPath = 0.0;
  vec2 P0 = uCenter, P1 = uCenter, P2 = uCenter;
  if (uExit > 0.0) {
    P1 = vec2(uCenter.x - 0.55, uCenter.y - 0.3);
    P2 = vec2(-halfW - 0.35, -0.2);
    t = clamp(uExit * (1.0 + L) - sIn * L, 0.0, 1.0);
    onPath = smoothstep(0.0, 0.18, t);
  } else if (uEnter < 1.0) {
    // прилетает сверху слева — оттуда, где над заголовком ушла основная лента
    P0 = vec2(-halfW - 0.35, 0.46);
    P1 = vec2(uCenter.x - 0.75, 0.4);
    t = clamp(uEnter * (1.0 + L) - sIn * L, 0.0, 1.0);
    onPath = 1.0 - smoothstep(0.8, 1.0, t);
  }
  if (onPath > 0.0) {
    float it = 1.0 - t;
    vec2 b = it * it * P0 + 2.0 * it * t * P1 + t * t * P2;
    vec2 d = normalize(2.0 * it * (P1 - P0) + 2.0 * t * (P2 - P1) + 1e-5);
    vec2 n = vec2(-d.y, d.x);
    float taper = pow(sin(3.14159 * clamp(sIn, 0.02, 0.98)), 0.5);
    float twist = 0.3 + abs(sin(t * 9.0 + uTime * 0.7));
    b += n * (aRnd.y - 0.5) * 0.06 * twist * taper;
    uv = mix(uv, b, onPath);
  }
  vExit = onPath;
  vec2 pix = 0.5 * uRes + uv * min(uRes.x, uRes.y);
  gl_Position = vec4(pix / uRes * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = uSize * persp * CAM / FOCAL * (1.0 + vAcc * 0.35) * mix(1.0, 1.25, flow);
  vDepth = pos.z;
  vPhase = length(p.xyz) * 7.0 + aRnd.x * 0.8;
}
`;

const fragment = `#version 300 es
precision highp float;
in float vAcc;
in float vDepth;
in float vPhase;
in float vExit;
out vec4 outColor;
uniform float uDark;
uniform float uTime;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float disc = smoothstep(0.5, 0.32, d);
  if (disc <= 0.0) discard;
  // дальние точки бледнее — так облако читается объёмом
  float depthK = 0.5 + 0.5 * smoothstep(-1.4, 1.1, vDepth);
  vec3 teal = vec3(0.0, 0.733, 0.769);
  vec3 base = mix(vec3(0.07, 0.1, 0.11), vec3(0.74, 0.87, 0.89), uDark);
  vec3 acc = mix(vec3(0.0, 0.62, 0.66), vec3(0.3, 0.92, 0.96), uDark);
  float pulse = 0.65 + 0.35 * sin(uTime * 3.0 - vPhase);
  vec3 col = mix(mix(base, acc, vAcc), acc, smoothstep(0.0, 0.4, vExit));
  float a = mix(mix(0.62, 0.5, uDark), 0.95 * pulse, vAcc) * depthK * disc;
  a = mix(a, 0.85 * disc, smoothstep(0.0, 0.4, vExit));
  outColor = vec4(col * a, a);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

type Props = {
  /** Цель перехода: номер продукта с дробной частью; пишет секция по прокрутке и наведению. */
  morph: RefObject<number>;
  /** 1 — экран залит цветом продукта: точки светлеют, как в тёмной теме. */
  dark: RefObject<number>;
  /** 0…1 — список пролистан за последний продукт: форма вытягивается в ленту и уходит вбок. */
  exit?: RefObject<number>;
  /** 0…1 — первый продукт подходит к середине экрана: лента прилетает и рассыпается в форму. */
  enter?: RefObject<number>;
  /** Сколько всего форм — чтобы не уехать за последнюю. */
  count: number;
};

export function MorphPoints({ morph, dark, exit, enter, count }: Props) {
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
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);
    const uni = (name: string) => gl.getUniformLocation(prog, name);
    const u = {
      res: uni("uRes"),
      center: uni("uCenter"),
      scale: uni("uScale"),
      w: uni("uW"),
      f: uni("uF"),
      m: uni("uM"),
      time: uni("uTime"),
      look: uni("uLook"),
      enter: uni("uEnter"),
      size: uni("uSize"),
      exit: uni("uExit"),
      dark: uni("uDark"),
    };
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const buffers: WebGLBuffer[] = [];
    let points = 0;
    let cancelled = false;
    fetch("/v5/products.bin")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`products.bin: ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        const [n, s] = new Uint32Array(data, 0, 2);
        if (s < SHAPES) throw new Error(`products.bin: облаков ${s}, нужно ${SHAPES}`);
        for (let k = 0; k < SHAPES; k++) {
          const buf = gl.createBuffer();
          buffers.push(buf);
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(data, 8 + k * n * 8, n * 4), gl.STATIC_DRAW);
          const loc = gl.getAttribLocation(prog, `aP${k}`);
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 4, gl.SHORT, true, 0, 0);
        }
        const rnd = new Float32Array(n * 2);
        for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
        const rb = gl.createBuffer();
        buffers.push(rb);
        gl.bindBuffer(gl.ARRAY_BUFFER, rb);
        gl.bufferData(gl.ARRAY_BUFFER, rnd, gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "aRnd");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        points = n;
        canvas.dataset.ready = "";
      })
      .catch((e: unknown) => console.error(e));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 1;
    let h = 1;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      look.tx = ((e.clientX / window.innerWidth) * 2 - 1) * 0.35;
      look.ty = ((e.clientY / window.innerHeight) * 2 - 1) * 0.18;
    };
    if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });

    let visible = false;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);

    const weights = new Float32Array(SHAPES);
    let shown = morph.current;
    let darkShown = 0;
    let exitShown = 0;
    let enterShown = enter ? 0 : 1;
    let raf = 0;
    const t0 = performance.now();
    let prev = t0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!visible || document.hidden || !points) return;
      const target = Math.min(count - 1, Math.max(0, morph.current));
      if (reduce) shown = Math.round(target);
      else shown += (target - shown) * Math.min(1, dt * 4);
      const darkTarget = Math.max(dark.current, document.documentElement.dataset.theme === "dark" ? 1 : 0);
      darkShown = reduce ? darkTarget : darkShown + (darkTarget - darkShown) * Math.min(1, dt * 6);
      const exitTarget = exit?.current ?? 0;
      exitShown = reduce ? exitTarget : exitShown + (exitTarget - exitShown) * Math.min(1, dt * 6);
      const enterTarget = enter?.current ?? 1;
      enterShown = reduce ? enterTarget : enterShown + (enterTarget - enterShown) * Math.min(1, dt * 6);
      // сглаживание не доходит ровно до края — прижимаем, иначе шейдер считает, что выход ещё идёт
      if (exitShown < 1e-3) exitShown = 0;
      if (enterShown > 1 - 1e-3) enterShown = 1;
      look.x += (look.tx - look.x) * Math.min(1, dt * 3);
      look.y += (look.ty - look.y) * Math.min(1, dt * 3);

      const a = Math.min(SHAPES - 1, Math.floor(shown));
      const b = Math.min(SHAPES - 1, a + 1);
      const frac = shown - a;
      const t = Math.min(1, Math.max(0, (frac - 0.2) / 0.6));
      const f = t * t * (3 - 2 * t);
      weights.fill(0);
      weights[a] += 1 - f;
      weights[b] += f;

      const place = formPlacement(w, h, true);
      gl.uniform2f(u.res, w, h);
      gl.uniform2f(u.center, place.x, place.y);
      gl.uniform1f(u.scale, place.scale);
      gl.uniform1fv(u.w, weights);
      gl.uniform1f(u.f, a === b ? 0 : f);
      gl.uniform1f(u.m, shown);
      gl.uniform1f(u.time, reduce ? 0 : (now - t0) / 1000);
      gl.uniform2f(u.look, look.x, -look.y);
      gl.uniform1f(u.enter, enterShown);
      // размер точки — от высоты холста, чтобы плотность формы не зависела от экрана
      gl.uniform1f(u.size, Math.max(1.3 * dpr, Math.min(w, h) * 0.0024));
      gl.uniform1f(u.dark, darkShown);
      gl.uniform1f(u.exit, exitShown);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, points);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      delete canvas.dataset.ready;
      // контекст не теряем: в разработке React запускает эффект повторно на том же холсте
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [morph, dark, exit, enter, count]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
