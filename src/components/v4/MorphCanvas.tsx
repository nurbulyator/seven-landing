"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Одна матовая «глиняная» форма за списком продуктов: при прокрутке перетекает из продукта
 * в продукт (столбцы отчётности → стопка листов → замок → сеть → RFID-карта → системный блок →
 * серверная стойка). Рисуется лучом по полям расстояний (SDF) во фрагментном шейдере:
 * переход — смешивание двух полей, поэтому формы перетекают друг в друга, а не сменяются.
 * Фон прозрачный: в светлой теме форма белая и растворяется в фоне, в тёмной — графитовая
 * с бирюзовой каймой. Поворачивается за курсором.
 */

const vertex = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fragment = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform vec2 uCenter;   // центр формы на холсте, в долях меньшей стороны
uniform float uScale;   // во сколько раз форма меньше/больше базового размера
uniform float uMorph;   // номер продукта с дробной частью: 2.5 — середина перехода 2 → 3
uniform float uTime;
uniform vec2 uLook;     // поворот за курсором: рыскание, тангаж
uniform float uDark;

const float BOUND = 1.5;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float sdBox2(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float sdTorusXY(vec3 p, float R, float r) { return length(vec2(length(p.xy) - R, p.z)) - r; }
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// 0 — ERP.Бюджет: три столбца отчётности на плите
float sBars(vec3 p) {
  float d = sdBox(p - vec3(0.0, -0.74, 0.0), vec3(0.98, 0.07, 0.44), 0.05);
  float h0 = 0.55, h1 = 0.95, h2 = 1.42;
  d = smin(d, sdBox(p - vec3(-0.56, -0.67 + h0 * 0.5, 0.0), vec3(0.2, h0 * 0.5, 0.2), 0.06), 0.04);
  d = smin(d, sdBox(p - vec3(0.0, -0.67 + h1 * 0.5, 0.0), vec3(0.2, h1 * 0.5, 0.2), 0.06), 0.04);
  d = smin(d, sdBox(p - vec3(0.56, -0.67 + h2 * 0.5, 0.0), vec3(0.2, h2 * 0.5, 0.2), 0.06), 0.04);
  return d;
}

// 1 — Консолидация: листы сходятся в одну стопку
float sStack(vec3 p) {
  float d = 1e9;
  for (int i = 0; i < 4; i++) {
    float k = float(i) - 1.5;
    vec3 q = p - vec3(k * 0.07, k * 0.3, 0.0);
    q.xz = rot(k * 0.3) * q.xz;
    d = min(d, sdBox(q, vec3(0.82, 0.045, 0.58), 0.04));
  }
  return d;
}

// 2 — Smart Batyr: замок
float sLock(vec3 p) {
  float body = sdBox(p - vec3(0.0, -0.34, 0.0), vec3(0.64, 0.5, 0.3), 0.13);
  vec2 kp = p.xy - vec2(0.0, -0.26);
  float hole2 = min(length(kp) - 0.09, sdBox2(kp - vec2(0.0, -0.16), vec2(0.04, 0.13)));
  body = max(body, -max(hole2, 0.16 - p.z));
  vec3 q = p - vec3(0.0, 0.16, 0.0);
  float arc = max(sdTorusXY(q, 0.4, 0.1), -q.y);
  float legs = min(sdCapsule(p, vec3(0.4, 0.16, 0.0), vec3(0.4, -0.1, 0.0), 0.1),
                   sdCapsule(p, vec3(-0.4, 0.16, 0.0), vec3(-0.4, -0.1, 0.0), 0.1));
  return min(body, min(arc, legs));
}

// 3 — SmartCommand: центр и подключённые к нему машины
float sNet(vec3 p) {
  float d = sdBox(p, vec3(0.27), 0.09);
  vec3 n0 = vec3(0.86, 0.56, 0.1), n1 = vec3(-0.86, 0.5, -0.15), n2 = vec3(0.7, -0.66, -0.2), n3 = vec3(-0.62, -0.7, 0.25);
  d = smin(d, sdCapsule(p, vec3(0.0), n0, 0.045), 0.06);
  d = smin(d, sdCapsule(p, vec3(0.0), n1, 0.045), 0.06);
  d = smin(d, sdCapsule(p, vec3(0.0), n2, 0.045), 0.06);
  d = smin(d, sdCapsule(p, vec3(0.0), n3, 0.045), 0.06);
  d = smin(d, sdBox(p - n0, vec3(0.15), 0.06), 0.05);
  d = smin(d, sdBox(p - n1, vec3(0.15), 0.06), 0.05);
  d = smin(d, sdBox(p - n2, vec3(0.15), 0.06), 0.05);
  d = smin(d, sdBox(p - n3, vec3(0.15), 0.06), 0.05);
  return d;
}

// 4 — RFID Control: карта с чипом и витками антенны
float sCard(vec3 p) {
  p.yz = rot(-0.18) * p.yz;
  float d = sdBox(p, vec3(0.98, 0.62, 0.045), 0.05);
  d = min(d, sdBox(p - vec3(-0.52, 0.18, 0.05), vec3(0.15, 0.12, 0.03), 0.025));
  vec3 c = p - vec3(0.3, -0.06, 0.05);
  d = min(d, sdTorusXY(c, 0.36, 0.024));
  d = min(d, sdTorusXY(c, 0.25, 0.024));
  return d;
}

// 5 — SH300: системный блок с прорезями и кнопкой
float sTower(vec3 p) {
  float d = sdBox(p, vec3(0.42, 0.84, 0.7), 0.07);
  for (int i = 0; i < 3; i++) {
    d = max(d, -sdBox(p - vec3(0.0, 0.5 - float(i) * 0.12, 0.7), vec3(0.28, 0.018, 0.05), 0.01));
  }
  vec3 b = p - vec3(0.0, -0.52, 0.7);
  d = max(d, -(length(vec2(length(b.xy) - 0.085, b.z)) - 0.02));
  return d;
}

// 6 — серверы SH: стойка из юнитов между стоек-направляющих
float sRack(vec3 p) {
  float d = 1e9;
  for (int i = 0; i < 5; i++) {
    d = min(d, sdBox(p - vec3(0.0, -0.62 + float(i) * 0.31, 0.0), vec3(0.78, 0.115, 0.6), 0.035));
  }
  d = min(d, sdBox(p - vec3(0.84, 0.0, 0.54), vec3(0.06, 0.86, 0.07), 0.03));
  d = min(d, sdBox(p - vec3(-0.84, 0.0, 0.54), vec3(0.06, 0.86, 0.07), 0.03));
  return d;
}

float shape(int id, vec3 p) {
  switch (id) {
    case 0: return sBars(p);
    case 1: return sStack(p);
    case 2: return sLock(p);
    case 3: return sNet(p);
    case 4: return sCard(p);
    case 5: return sTower(p);
    default: return sRack(p);
  }
}

int gA, gB;
float gF;
mat3 gRot;

float map(vec3 p) {
  p = gRot * p;
  // посреди перехода форма чуть «вдыхает» — так перетекание читается мягче
  float swell = sin(3.14159 * gF) * 0.06;
  float d = mix(shape(gA, p), shape(gB, p), gF) - swell;
  return d;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0015;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, w = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.02 + 0.13 * float(i) / 4.0;
    occ += (h - map(p + n * h)) * w;
    w *= 0.82;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

void main() {
  float m = clamp(uMorph, 0.0, 6.0);
  gA = int(floor(m));
  gB = min(gA + 1, 6);
  gF = smoothstep(0.28, 0.72, m - floor(m));

  // три четверти сверху + покачивание от прокрутки (между продуктами форма «перекладывается»
  // с боку на бок) + курсор
  float yaw = -0.5 + 0.55 * sin(3.14159 * m) + 0.12 * sin(uTime * 0.4) + uLook.x;
  float pitch = 0.32 + 0.05 * sin(uTime * 0.31) + uLook.y;
  float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
  gRot = ry * rx;

  float minSide = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / minSide - uCenter;
  uv /= uScale;
  const float FOCAL = 1.6;
  vec3 ro = vec3(0.0, 0.0, 6.0);
  vec3 rd = normalize(vec3(uv, -FOCAL));

  // луч считаем только внутри сферы, где живёт форма — остальной холст пустой и дешёвый
  float b = dot(ro, rd);
  float h = b * b - (dot(ro, ro) - BOUND * BOUND);
  if (h < 0.0) { outColor = vec4(0.0); return; }
  h = sqrt(h);
  float t = -b - h, tEnd = -b + h;

  float px = 1.5 / (minSide * uScale * FOCAL);  // угловой размер пикселя — для мягкого края
  float minR = 1e9, tClose = t;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.0006 * t) { hit = true; break; }
    float r = d / t;
    if (r < minR) { minR = r; tClose = t; }
    t += d * 0.8;
    if (t > tEnd) break;
  }
  float alpha = hit ? 1.0 : 1.0 - smoothstep(0.0, px, minR);
  if (alpha <= 0.0) { outColor = vec4(0.0); return; }
  vec3 pos = ro + rd * (hit ? t : tClose);

  vec3 n = calcNormal(pos);
  float ao = calcAO(pos, n);
  vec3 key = normalize(vec3(-0.55, 0.85, 0.55));
  vec3 fill = normalize(vec3(0.8, 0.1, 0.45));
  float dif = clamp((dot(n, key) + 0.25) / 1.25, 0.0, 1.0);
  float fil = clamp(dot(n, fill), 0.0, 1.0);
  float sky = 0.5 + 0.5 * n.y;
  float spec = pow(clamp(dot(reflect(rd, n), key), 0.0, 1.0), 28.0);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
  float shade = (0.62 * dif + 0.28 * sky + 0.12 * fil) * mix(0.45, 1.0, ao);
  vec3 teal = vec3(0.0, 0.733, 0.769);

  vec3 light = vec3(0.6, 0.625, 0.635) + vec3(0.39, 0.37, 0.36) * shade + 0.05 * spec;
  light = min(light, vec3(0.984, 0.984, 0.98));  // самые светлые грани уходят в фон, как гипс на белом
  light = mix(light, teal, fres * 0.1 * ao);
  vec3 dark = vec3(0.045, 0.055, 0.06) + vec3(0.2, 0.215, 0.22) * shade + 0.12 * spec;
  dark += teal * fres * 0.55 * ao;

  vec3 col = mix(light, dark, uDark);
  outColor = vec4(col * alpha, alpha);
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

/**
 * Где на холсте стоит форма: смещение центра в долях меньшей стороны (ось Y вверх) и масштаб.
 * На широком экране — в правой трети: названия и описания занимают левую часть;
 * на узком — под названием и описанием, чтобы не мешать читать.
 */
export function formPlacement(width: number, height: number, far = false) {
  const wide = width / height > 1.1;
  // far — частицы /v5: правее, ближе к краю (названия теперь стоят у самого левого края)
  const [cap, margin] = far ? [0.42, 0.36] : [0.32, 0.42];
  return {
    x: wide ? Math.min(cap, (width / height) * 0.5 - margin) : 0,
    y: wide ? -0.02 : -0.58,
    scale: wide ? 1 : 0.78,
  };
}

/** Центр формы в координатах экрана — отсюда растёт заливка при наведении. */
export function formCenterOnScreen(canvas: HTMLElement, far = false) {
  const r = canvas.getBoundingClientRect();
  const place = formPlacement(r.width, r.height, far);
  const side = Math.min(r.width, r.height);
  return { x: r.left + r.width / 2 + place.x * side, y: r.top + r.height / 2 - place.y * side };
}

type Props = {
  /** Цель перехода: номер продукта с дробной частью; пишет секция по прокрутке. */
  morph: RefObject<number>;
  /** 1 — экран залит цветом продукта: форма плавно уходит в тёмный вариант. */
  dark: RefObject<number>;
  /** Сколько всего форм — чтобы не уехать за последнюю. */
  count: number;
};

export function MorphCanvas({ morph, dark, count }: Props) {
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
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {
      res: gl.getUniformLocation(prog, "uRes"),
      center: gl.getUniformLocation(prog, "uCenter"),
      scale: gl.getUniformLocation(prog, "uScale"),
      morph: gl.getUniformLocation(prog, "uMorph"),
      time: gl.getUniformLocation(prog, "uTime"),
      look: gl.getUniformLocation(prog, "uLook"),
      dark: gl.getUniformLocation(prog, "uDark"),
    };
    canvas.dataset.ready = "";

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 1;
    let h = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      // на больших экранах шейдер тяжелее — плотность пикселей ниже
      const dpr = Math.min(window.devicePixelRatio || 1, r.width > 1600 ? 1.25 : 1.5);
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

    let shown = morph.current;
    let darkShown = 0;
    let raf = 0;
    const t0 = performance.now();
    let prev = t0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!visible || document.hidden) return;
      const target = Math.min(count - 1, Math.max(0, morph.current));
      // без анимации — сразу ближайшая форма, без перетекания
      if (reduce) shown = Math.round(target);
      else shown += (target - shown) * Math.min(1, dt * 5);
      const darkTarget = Math.max(dark.current, document.documentElement.dataset.theme === "dark" ? 1 : 0);
      darkShown = reduce ? darkTarget : darkShown + (darkTarget - darkShown) * Math.min(1, dt * 6);
      look.x += (look.tx - look.x) * Math.min(1, dt * 3);
      look.y += (look.ty - look.y) * Math.min(1, dt * 3);

      const place = formPlacement(w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform2f(u.center, place.x, place.y);
      gl.uniform1f(u.scale, place.scale);
      gl.uniform1f(u.morph, shown);
      gl.uniform1f(u.time, reduce ? 0 : (now - t0) / 1000);
      gl.uniform2f(u.look, look.x, -look.y);
      gl.uniform1f(u.dark, darkShown);
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
      delete canvas.dataset.ready;
      // контекст не теряем: в разработке React запускает эффект повторно на том же холсте
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [morph, dark, count]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
