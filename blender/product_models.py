"""
Модели продуктов для /v5 (облака точек) и /v6 (рендеры): примитивы и семь сборок.
Модели смотрят фасадом в −Y (вид спереди Blender). У объекта: o["accent"] — бирюзовая деталь,
o["w"] — своя плотность точек (для облаков), o["mat"] = "screen" — тёмное стекло экрана (для рендера).
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector

ACCENT_WEIGHT = 3.0  # акцентные детали мелкие — в облаках точек им даём гуще точек


# ── сцена и примитивы ────────────────────────────────────────────────────────────────────────────

def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves):
        for d in list(coll):
            coll.remove(d)


def tag(obj, accent=False, bevel=0.0, segments=3):
    obj["accent"] = 1 if accent else 0
    if bevel > 0:
        m = obj.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = segments
        m.limit_method = "ANGLE"
    return obj


def box(size, loc, bevel=0.03, rot=(0, 0, 0), accent=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return tag(o, accent, bevel)


def cyl(r, depth, loc, rot=(0, 0, 0), bevel=0.01, accent=False, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    return tag(bpy.context.active_object, accent, bevel)


def sphere(r, loc, accent=False):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=8)
    return tag(bpy.context.active_object, accent)


def torus(R, r, loc, rot=(0, 0, 0), accent=False):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot,
                                     major_segments=72, minor_segments=10)
    return tag(bpy.context.active_object, accent)


def tube(points, r, accent=False):
    """Трубка по ломаной (сглаженная кривая) — линии графиков, связи, дуги волн."""
    cu = bpy.data.curves.new("tube", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points):
        p.co = (q[0], q[1], q[2], 1)
    o = bpy.data.objects.new("tube", cu)
    bpy.context.collection.objects.link(o)
    return tag(o, accent)


def arc(center, radius, a0, a1, r, plane="xz", accent=False, steps=40):
    pts = []
    for k in range(steps + 1):
        a = a0 + (a1 - a0) * k / steps
        c, s = math.cos(a) * radius, math.sin(a) * radius
        if plane == "xz":
            pts.append((center[0] + c, center[1], center[2] + s))
        else:  # xy — горизонтально
            pts.append((center[0] + c, center[1] + s, center[2]))
    return tube(pts, r, accent)


def prism(outline, depth, y, bevel=0.03, accent=False):
    """Плоская фигура по контуру (в плоскости XZ), выдавленная на depth вглубь (по Y)."""
    me = bpy.data.meshes.new("prism")
    bm = bmesh.new()
    verts = [bm.verts.new((x, y - depth / 2, z)) for x, z in outline]
    face = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, depth, 0), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("prism", me)
    bpy.context.collection.objects.link(o)
    return tag(o, accent, bevel)


# ── модели ───────────────────────────────────────────────────────────────────────────────────────

def m_dashboard():
    """ERP.Бюджет — монитор-дашборд: столбики, линия графика, кольцо, плитки показателей."""
    box((2.0, 0.08, 1.25), (0, 0, 0.25), 0.04)
    box((1.86, 0.02, 1.11), (0, -0.045, 0.25), 0.01)["mat"] = "screen"
    box((0.14, 0.08, 0.5), (0, 0.1, -0.55), 0.03)
    box((0.85, 0.45, 0.04), (0, 0.06, -0.8), 0.02)
    y = -0.07
    for k, h in enumerate([0.18, 0.3, 0.24, 0.42, 0.36, 0.5]):
        box((0.08, 0.03, h), (-0.82 + k * 0.12, y, -0.22 + h / 2), 0.012)
    line = [(-0.86, y, 0.38), (-0.66, y, 0.5), (-0.48, y, 0.44), (-0.28, y, 0.64), (-0.08, y, 0.56), (0.08, y, 0.74)]
    tube(line, 0.022, accent=True)
    torus(0.2, 0.055, (0.52, y, 0.5), rot=(math.pi / 2, 0, 0))
    arc((0.52, y - 0.02, 0.5), 0.2, -0.4, 1.9, 0.06, accent=True)
    for k in range(3):
        box((0.3, 0.03, 0.15), (0.2 + k * 0.34, y, -0.12), 0.015)
    box((0.98, 0.03, 0.05), (0.54, y, 0.1), 0.01)


def m_consolidation():
    """Консолидация: маленькие документы слетаются по пунктирным дорожкам в одну стопку."""
    for k in range(5):
        box((0.62, 0.012, 0.82), (k * 0.02, k * 0.07, k * 0.015), 0.006)
    for k in range(5):
        box((0.42 - (k == 4) * 0.16, 0.02, 0.025), (-0.04, -0.02, 0.28 - k * 0.12), 0.006)
    rnd = random.Random(7)
    for k in range(6):
        a = math.pi * (0.1 + k / 6 * 2)
        cx, cz = math.cos(a) * 1.05, math.sin(a) * 0.78
        cy = rnd.uniform(-0.35, 0.35)
        box((0.26, 0.01, 0.34), (cx, cy, cz), 0.004, rot=(rnd.uniform(-0.4, 0.4), rnd.uniform(-0.5, 0.5), rnd.uniform(-0.3, 0.3)))
        # пунктир к стопке
        for t in range(1, 7):
            f = t / 7
            p = Vector((cx, cy, cz)).lerp(Vector((0.04, 0.1, 0.03)), f * 0.78)
            sphere(0.022, tuple(p), accent=True)


def m_shield():
    """Smart Batyr — щит с ободом и галочкой."""
    right = [(0.0, 0.98), (0.42, 0.9), (0.82, 0.98), (0.84, 0.35), (0.76, -0.12), (0.56, -0.52), (0.3, -0.82), (0.0, -1.04)]
    outline = right + [(-x, z) for x, z in reversed(right[1:-1])]
    prism(outline, 0.22, 0.0, 0.05)
    inner = [(x * 0.8, z * 0.8 + 0.02) for x, z in outline]
    prism(inner, 0.06, -0.13, 0.025)
    tube([(-0.34, -0.2, 0.06), (-0.1, -0.2, -0.2), (0.36, -0.2, 0.36)], 0.07, accent=True)


def m_network():
    """SmartCommand — компьютеры в сети вокруг узла, связи и кольцо «радара»."""
    box((0.36, 0.36, 0.56), (0, 0, 0.0), 0.05)
    for k in range(3):
        box((0.26, 0.02, 0.03), (0, -0.19, 0.16 - k * 0.1), 0.008)
    n = 5
    for k in range(n):
        a = math.pi * 2 * k / n + 0.3
        x, y = math.cos(a) * 1.05, math.sin(a) * 0.75
        z = -0.15
        box((0.46, 0.04, 0.3), (x, y, z + 0.12), 0.02)
        box((0.4, 0.01, 0.24), (x, y - 0.025, z + 0.12), 0.005)["mat"] = "screen"
        box((0.05, 0.04, 0.12), (x, y + 0.01, z - 0.08), 0.01)
        box((0.22, 0.14, 0.02), (x, y + 0.01, z - 0.14), 0.008)
        tube([(0, 0, -0.05), (x * 0.5, y * 0.5, -0.12), (x * 0.92, y * 0.92, z - 0.05)], 0.014, accent=True)["w"] = 1.6
    for R in (0.5, 1.12):
        arc((0, 0, -0.32), R, 0, math.pi * 2, 0.008, plane="xy", accent=True, steps=96)["w"] = 0.7


def m_rfid():
    """RFID Control — карта с чипом и витками антенны, от неё расходятся радиоволны."""
    box((1.3, 0.035, 0.84), (-0.25, 0, 0), 0.05)
    box((0.22, 0.02, 0.17), (-0.66, -0.025, 0.12), 0.01)
    for k in range(3):
        box((0.22, 0.026, 0.012), (-0.66, -0.03, 0.08 + k * 0.04), 0.002)
    for R in (0.3, 0.24, 0.18):
        torus(R, 0.012, (0.05, -0.025, -0.05), rot=(math.pi / 2, 0, 0))
    for k, R in enumerate((0.32, 0.55, 0.78)):
        arc((0.42, 0.0, 0.0), R, -0.75, 0.75, 0.03 - k * 0.004, accent=True)["w"] = 1.3


def m_pc():
    """SH300 — монитор, системный блок и клавиатура."""
    box((1.3, 0.06, 0.8), (-0.35, 0, 0.3), 0.035)
    box((1.2, 0.015, 0.7), (-0.35, -0.035, 0.3), 0.006)["mat"] = "screen"
    box((0.1, 0.06, 0.36), (-0.35, 0.08, -0.25), 0.02)
    box((0.55, 0.32, 0.03), (-0.35, 0.08, -0.43), 0.012)
    box((0.95, 0.32, 0.04), (-0.35, -0.55, -0.42), 0.015)
    box((0.42, 0.95, 1.05), (0.85, 0.1, 0.06), 0.04)
    for k in range(2):
        box((0.3, 0.02, 0.06), (0.85, -0.38, 0.42 - k * 0.12), 0.008)
    for k in range(6):
        box((0.3, 0.015, 0.012), (0.85, -0.38, -0.05 - k * 0.05), 0.003)
    torus(0.045, 0.012, (0.85, -0.385, 0.2), rot=(math.pi / 2, 0, 0), accent=True)


def m_rack():
    """Серверы SH — стойка из юнитов с ручками, решётками и индикаторами."""
    for x in (-0.62, 0.62):
        box((0.06, 0.8, 1.6), (x, 0, 0), 0.015)
    for z in (-0.82, 0.82):
        box((1.3, 0.8, 0.05), (0, 0, z), 0.015)
    for k in range(8):
        z = -0.66 + k * 0.19
        box((1.12, 0.74, 0.15), (0, 0.02, z), 0.012)
        for v in range(5):
            box((0.05, 0.012, 0.1), (-0.38 + v * 0.08, -0.36, z), 0.003)
        box((0.025, 0.04, 0.1), (-0.5, -0.38, z), 0.006)
        box((0.025, 0.04, 0.1), (0.5, -0.38, z), 0.006)
        for d in range(2):
            sphere(0.022, (0.3 + d * 0.07, -0.37, z + 0.02), accent=True)["w"] = 16


MODELS = [m_dashboard, m_consolidation, m_shield, m_network, m_rfid, m_pc, m_rack]
