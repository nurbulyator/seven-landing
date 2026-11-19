"""
Рендер 3D-форм продуктов для /v6: белый матовый «гипс» (как объекты у Red Collar), экраны — тёмное
стекло, детали-акценты — бирюза с лёгким свечением. Фон прозрачный, без тени.
Для каждого продукта — кадры поворота от −30° до +30° (на странице кадр выбирается по курсору).

  blender -b -P blender/render_products.py -- <папка> [--frames 13] [--size 800] [--samples 96] [--only 0,2] [--still]
      [--set scenes|objects]   # scenes — сценки (product_models), objects — один предмет на продукт (product_objects)

Кадры пишутся в <папка>/<номер продукта>/<кадр>.png (номер с 0, кадр с 01), --still — только средний кадр.
Модели — общие с облаками точек /v5 (blender/product_models.py).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from product_models import MODELS, clear  # noqa: E402  (модули лежат рядом)
import product_objects  # noqa: E402
from product_objects import DRAFT3, OBJECTS, SCREEN  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
FRAMES, SIZE, SAMPLES, ONLY, STILL, SET = 13, 800, 96, None, False, "scenes"
for i, a in enumerate(argv):
    if a == "--frames":
        FRAMES = int(argv[i + 1])
    if a == "--size":
        SIZE = int(argv[i + 1])
    if a == "--samples":
        SAMPLES = int(argv[i + 1])
    if a == "--only":
        ONLY = [int(x) for x in argv[i + 1].split(",")]
    if a == "--still":
        STILL = True
    if a == "--set":
        SET = argv[i + 1]
    if a == "--ui":
        product_objects.UI_IMAGE = os.path.abspath(argv[i + 1])

RADIUS = 1.25
TURN = math.radians(30)


def lin(hexstr):
    """sRGB-цвет #rrggbb → линейный, как ждёт Blender."""
    c = [int(hexstr[k:k + 2], 16) / 255 for k in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, color, rough, emit=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.06
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def area(name, loc, size, energy):
    d = bpy.data.lights.new(name, "AREA")
    d.size = size
    d.energy = energy
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def setup_render():
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
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0


def stage():
    """Камера в три четверти сверху справа, мягкий студийный свет, серый мир."""
    sc = bpy.context.scene
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector((0.45, -0.85, 0.36)).normalized() * 4.4
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    area("key", (-3.2, -4.0, 5.0), 5.0, 1400)
    area("fill", (4.2, -3.0, 1.2), 4.0, 420)
    area("rim", (0.5, 4.5, 3.2), 3.5, 700)
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.5, 0.52, 0.53, 1)
    bg.inputs["Strength"].default_value = 0.35


def ui_material(path):
    """Экран с картинкой интерфейса: светится сам (как настоящий дисплей) и чуть бликует."""
    m = bpy.data.materials.new("ui")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path)
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.15
    b.inputs["Coat Weight"].default_value = 1.0
    return m


def fit_and_dress():
    """Центр и размер модели — как у облаков точек (описанная сфера RADIUS); материалы; ось поворота."""
    objs = [o for o in bpy.context.scene.objects if o.type in {"MESH", "CURVE"}]
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        pts += [o.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    k = RADIUS / max((p - c).length for p in pts)

    clay = material("clay", lin("#eeeeec"), 0.55)
    screen = material("screen", lin("#0f1719"), 0.12, coat=1.0)
    teal = material("teal", lin("#00bbc4"), 0.3, emit=0.6)
    pivot = bpy.data.objects.new("pivot", None)
    bpy.context.collection.objects.link(pivot)
    for o in objs:
        o.location = (o.location - c) * k
        o.scale = o.scale * k
        if o.get("mat") == "ui" and product_objects.UI_IMAGE:
            mat = ui_material(product_objects.UI_IMAGE)
        else:
            mat = teal if o.get("accent") else screen if o.get("mat") == "screen" else clay
        o.data.materials.clear()
        o.data.materials.append(mat)
        o.parent = pivot
    return pivot


def main():
    setup_render()
    sc = bpy.context.scene
    sets = {"scenes": MODELS, "objects": OBJECTS, "draft3": DRAFT3, "screen": SCREEN}
    for idx, build in enumerate(sets[SET]):
        if ONLY is not None and idx not in ONLY:
            continue
        clear()
        for coll in (bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
            for d in list(coll):
                coll.remove(d)
        build()
        pivot = fit_and_dress()
        stage()
        folder = os.path.join(OUT, str(idx))
        os.makedirs(folder, exist_ok=True)
        frames = [FRAMES // 2] if STILL else range(FRAMES)
        for f in frames:
            pivot.rotation_euler.z = -TURN + 2 * TURN * f / (FRAMES - 1)
            sc.render.filepath = os.path.join(folder, f"{f + 1:02d}.png")
            bpy.ops.render.render(write_still=True)
        print(f"{build.__name__}: {len(list(frames))} кадров → {folder}")


main()
