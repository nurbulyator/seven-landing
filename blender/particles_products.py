"""
Облака точек для 3D-форм продуктов на /v5: каждая модель собирается скриптом, с неё берутся точки
поверхности и острых рёбер, и все семь облаков пишутся одним бинарным файлом.

  blender -b -P blender/particles_products.py -- public/v5/products.bin [--count 30000] [--preview <папка>]

Точки во всех облаках упорядочены одинаково (по поясам высоты и по кругу), чтобы при смене формы
каждая точка перелетала в соседнее место. Формат файла (little-endian): uint32 N (точек в облаке), uint32 S (облаков), затем S блоков по N точек,
каждая — int16 x, y, z, a: координаты в долях ±1.5 (ось Y вверх, Z — к зрителю), a — 0 или 32767
(бирюзовый акцент: линия графика, галочка, связи, волны, индикаторы).
Порядок облаков — как в списке продуктов: ERP.Бюджет, Консолидация, Smart Batyr, SmartCommand,
RFID Control, SH300, Серверы SH. Модели смотрят фасадом в −Y (вид спереди Blender).

--preview рендерит каждую модель простым светом в PNG — посмотреть форму до экспорта.
"""
import math
import os
import random
import struct
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0]) if argv else os.path.abspath("products.bin")
COUNT = 30000
PREVIEW = None
for i, a in enumerate(argv):
    if a == "--count":
        COUNT = int(argv[i + 1])
    if a == "--preview":
        PREVIEW = os.path.abspath(argv[i + 1])

EDGE_SHARE = 0.42  # доля точек на острых рёбрах — от них силуэт читается чётко
RADIUS = 1.25  # радиус описанной сферы после нормализации
QUANT = 1.5  # координата делится на это перед упаковкой в int16


from product_models import ACCENT_WEIGHT, MODELS, clear  # noqa: E402  (модуль лежит рядом)


# ── выборка точек ────────────────────────────────────────────────────────────────────────────────

def gather():
    """Треугольники и острые рёбра всех объектов сцены (с модификаторами) в мировых координатах."""
    dg = bpy.context.evaluated_depsgraph_get()
    tris, edges = [], []
    for o in bpy.context.scene.objects:
        if o.type not in {"MESH", "CURVE"}:
            continue
        acc = o.get("accent", 0)
        # своя плотность у детали (o["w"]) — иначе акценты гуще остальных в ACCENT_WEIGHT раз
        w = o.get("w", ACCENT_WEIGHT if acc else 1.0)
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.transform(o.matrix_world)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bm.normal_update()
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(28):
                a, b = e.verts[0].co.copy(), e.verts[1].co.copy()
                edges.append((a, b, (b - a).length * w, acc))
        for f in bm.faces:
            v = [x.co.copy() for x in f.verts]
            tris.append((v[0], v[1], v[2], f.calc_area() * w, acc))
        bm.free()
        ev.to_mesh_clear()
    return tris, edges


def sample(tris, edges, n, rnd):
    pts = []
    n_edge = int(n * EDGE_SHARE) if edges else 0
    if n_edge:
        for a, b, _, acc in rnd.choices(edges, weights=[e[2] for e in edges], k=n_edge):
            pts.append((a.lerp(b, rnd.random()), acc))
    for a, b, c, _, acc in rnd.choices(tris, weights=[t[3] for t in tris], k=n - n_edge):
        u, v = rnd.random(), rnd.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        pts.append((a + (b - a) * u + (c - a) * v, acc))
    rnd.shuffle(pts)
    return pts


def normalize(pts):
    lo = Vector((min(p.x for p, _ in pts), min(p.y for p, _ in pts), min(p.z for p, _ in pts)))
    hi = Vector((max(p.x for p, _ in pts), max(p.y for p, _ in pts), max(p.z for p, _ in pts)))
    c = (lo + hi) / 2
    r = max((p - c).length for p, _ in pts)
    k = RADIUS / r
    # Blender: Z вверх, фасад смотрит в −Y → страница: Y вверх, Z к зрителю
    return [((p.x - c.x) * k, (p.z - c.z) * k, -(p.y - c.y) * k, acc) for p, acc in pts]


def order(cloud):
    """Одинаковый порядок точек во всех облаках: по поясам высоты, внутри пояса — по кругу.
    Тогда i-я точка одной формы и i-я точка следующей лежат примерно в одном месте, и при смене
    продукта форма перетекает, а не сбивается в ком (как было бы при случайных парах)."""
    bands = 24
    return sorted(cloud, key=lambda p: (min(bands - 1, int((p[1] + RADIUS) / (2 * RADIUS) * bands)), math.atan2(p[2], p[0])))


def preview(path):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.film_transparent = True
    scene.render.filepath = path
    bpy.ops.object.camera_add(location=(2.6, -5.2, 2.2))
    cam = bpy.context.active_object
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    scene.camera = cam
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 5), rotation=(0.6, 0.2, 0.4))
    bpy.context.active_object.data.energy = 4
    bpy.ops.render.render(write_still=True)


def main():
    rnd = random.Random(2005)
    clouds = []
    for idx, build in enumerate(MODELS):
        clear()
        build()
        if PREVIEW:
            os.makedirs(PREVIEW, exist_ok=True)
            preview(os.path.join(PREVIEW, f"{idx}-{build.__name__}.png"))
            for o in list(bpy.data.objects):
                if o.type in {"CAMERA", "LIGHT"}:
                    bpy.data.objects.remove(o, do_unlink=True)
        tris, edges = gather()
        clouds.append(order(normalize(sample(tris, edges, COUNT, rnd))))
        acc = sum(1 for p in clouds[-1] if p[3])
        print(f"{build.__name__}: {len(tris)} треугольников, {len(edges)} рёбер, акцентных точек {acc}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    q = lambda v: max(-32767, min(32767, round(v / QUANT * 32767)))
    with open(OUT, "wb") as f:
        f.write(struct.pack("<II", COUNT, len(clouds)))
        for cloud in clouds:
            f.write(b"".join(struct.pack("<hhhh", q(x), q(y), q(z), 32767 if a else 0) for x, y, z, a in cloud))
    print("записано", OUT, os.path.getsize(OUT), "байт")


main()
