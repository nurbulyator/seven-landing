"""
Покадровый рендер знака «7» для первого экрана (проигрывается прокруткой, как на страницах Apple).

  blender -b -P blender/render_seven.py -- <папка> [--frames 1,40,80] [--size 1200] [--samples 160]
  blender -b -P blender/render_seven.py -- <папка> --turn 61   # для /v2: знак поворачивается за курсором

Фон прозрачный, без тени: кадры подходят и для светлой, и для тёмной темы (тень рисует вёрстка).
Геометрия — из логотипа (_assets/seven-hills-logo-*.svg): внешняя рамка и малая «7».
Анимация (кадры 1–120): фас → поворот → знак разбирается на две части → собирается и встаёт в 3/4.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
FRAMES = None
SIZE = 1200
SAMPLES = 160
TURN = 0  # >0: вместо анимации — N кадров поворота от −40° до +40° (кадр выбирается по положению курсора)
for i, a in enumerate(argv):
    if a == "--turn":
        TURN = int(argv[i + 1])
    if a == "--frames":
        FRAMES = [int(x) for x in argv[i + 1].split(",")]
    if a == "--size":
        SIZE = int(argv[i + 1])
    if a == "--samples":
        SAMPLES = int(argv[i + 1])

K = 10.0 / 285.92
FRAME = [(0, 56.81), (0, 0), (203.3, 0), (203.3, 61.3), (201.09, 66.08), (73.82, 285.92),
         (59.27, 285.92), (190.01, 60.25), (190.78, 58.56), (190.78, 12.52), (12.52, 12.52), (12.52, 56.81)]
INNER = [(58.64, 168.83), (114.62, 69.32), (58.64, 69.32), (58.64, 56.8), (135.78, 56.8), (72.92, 168.82)]
CX, CY = 101.65, 142.96  # центр знака в координатах SVG


def lin(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def prism(name, pts, depth):
    """Знак стоит вертикально (Z вверх), лицом к −Y, центр — в начале координат."""
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    vs = [bm.verts.new(((x - CX) * K, 0, (CY - y) * K)) for x, y in pts]
    f = bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=[f])
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    mv = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=mv, vec=(0, depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    for v in me.vertices:
        v.co.y -= depth / 2
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    # «алмазная» фаска: узкая плоская грань, которая ловит блик, как у корпусов Apple
    m = ob.modifiers.new("Chamfer", "BEVEL")
    m.width = 0.045
    m.segments = 1
    m.limit_method = "ANGLE"
    m.harden_normals = True
    m2 = ob.modifiers.new("Soft", "BEVEL")
    m2.width = 0.012
    m2.segments = 3
    m2.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth()
    ob.select_set(False)
    return ob


def metal(name, color, rough, aniso=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    b.inputs["Anisotropic"].default_value = aniso
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.08
    return m


def area(name, loc, target, size, energy, color=(1, 1, 1), size_y=None):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = energy
    d.color = color
    d.shape = "RECTANGLE"
    d.size = size
    d.size_y = size_y or size
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def key(ob, frame, loc=None, rot=None):
    if loc is not None:
        ob.location = loc
        ob.keyframe_insert("location", frame=frame)
    if rot is not None:
        ob.rotation_euler = Euler([math.radians(a) for a in rot])
        ob.keyframe_insert("rotation_euler", frame=frame)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = True
sc.cycles.device = "GPU"
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
sc.frame_start, sc.frame_end = 1, 120
sc.render.fps = 30

world = bpy.data.worlds.new("W")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.5, 0.52, 0.53, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.25

# Знак: пустышка-родитель вращает весь знак, части разъезжаются относительно неё
rig = bpy.data.objects.new("Rig", None)
sc.collection.objects.link(rig)
frame = prism("Frame", FRAME, 1.15)
inner = prism("Inner", INNER, 1.15)
frame.parent = rig
inner.parent = rig
frame.data.materials.append(metal("Anodized", lin("#00bbc4"), 0.3, aniso=0.6, coat=0.25))
inner.data.materials.append(metal("Polished", lin("#f2ede4"), 0.1, coat=0.5))

# Анимация
ease = "BEZIER"
key(rig, 1, rot=(0, 0, 0), loc=(0, 0, 0))
key(rig, 28, rot=(4, 0, -38), loc=(0, 0, 0.1))
key(rig, 62, rot=(8, 0, -62), loc=(0, 0, 0.2))
key(rig, 92, rot=(4, 0, -24), loc=(0, 0, 0.1))
key(rig, 120, rot=(0, 0, -16), loc=(0, 0, 0))
key(frame, 1, loc=(0, 0, 0))
key(inner, 1, loc=(0, 0, 0), rot=(0, 0, 0))
key(frame, 34, loc=(0, 0, 0))
key(inner, 34, loc=(0, 0, 0), rot=(0, 0, 0))
key(frame, 66, loc=(0.6, 3.6, 0.3))
key(inner, 66, loc=(-0.9, -4.2, 0.4), rot=(0, 0, 22))
key(frame, 96, loc=(0, 0, 0))
key(inner, 96, loc=(0, 0, 0), rot=(0, 0, 0))
key(frame, 120, loc=(0, 0, 0))
key(inner, 120, loc=(0, 0, 0), rot=(0, 0, 0))
for ob in (rig, frame, inner):
    for fc in ob.animation_data.action.fcurves if hasattr(ob.animation_data.action, "fcurves") else []:
        for kp in fc.keyframe_points:
            kp.interpolation = ease
            kp.easing = "AUTO"

# Студийный свет: большой софтбокс сверху, вертикальные полосы по бокам — длинные блики на гранях
area("Top", (0, -2, 14), (0, 0, 0), 10, 2400, size_y=6)
area("StripL", (-9, -5, 1), (0, 0, 0), 1.0, 1400, size_y=14)
area("StripR", (9, -4, 2), (0, 0, 0), 1.0, 1100, (1.0, 0.92, 0.82), size_y=14)
area("Front", (0, -16, 2), (0, 0, 0), 8, 260, size_y=8)
area("Rim", (2, 10, 6), (0, 0, 0), 6, 1600, (0.85, 0.96, 1.0))

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 85
cam = bpy.data.objects.new("Cam", cam_data)
sc.collection.objects.link(cam)
cam.location = (0, -42, 1.2)
cam.rotation_euler = (Vector((0, 0, 0)) - Vector(cam.location)).to_track_quat("-Z", "Y").to_euler()
sc.camera = cam

if TURN:
    # Без разборки: знак стоит целиком и плавно поворачивается вокруг вертикали
    for ob in (rig, frame, inner):
        ob.animation_data_clear()
    frame.location = inner.location = (0, 0, 0)
    inner.rotation_euler = (0, 0, 0)
    sc.frame_start, sc.frame_end = 1, TURN
    for f in range(1, TURN + 1):
        t = (f - 1) / (TURN - 1)
        key(rig, f, rot=(5, 0, -40 + 80 * t), loc=(0, 0, 0))
    for fc in rig.animation_data.action.fcurves if hasattr(rig.animation_data.action, "fcurves") else []:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"

os.makedirs(OUT, exist_ok=True)
frames = FRAMES or list(range(1, (TURN or 120) + 1))
for f in frames:
    sc.frame_set(f)
    sc.render.filepath = os.path.join(OUT, f"{f:03d}.png")
    bpy.ops.render.render(write_still=True)
print("DONE", len(frames))
