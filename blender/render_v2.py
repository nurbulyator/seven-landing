"""
Медиа для /v2: видео-петля серверного коридора ЦОД.

  blender -b -P blender/render_v2.py -- corridor <папка> [--frames 1,48] [--samples 64] [--w 1600] [--h 900]

Коридор: камера проходит ровно 4 шага стоек за 96 кадров, рисунок огней повторяется каждые 4 стойки —
петля бесшовная. Кадры → видео: ffmpeg (см. README).
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
MODE, OUT = argv[0], os.path.abspath(argv[1])
OPTS = {argv[i][2:]: argv[i + 1] for i in range(2, len(argv) - 1) if argv[i].startswith("--")}
SAMPLES = int(OPTS.get("samples", 64 if MODE == "corridor" else 256))


def lin(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


TEAL, AMBER, CREAM = lin("#00bbc4"), lin("#ffb541"), lin("#f2ede4")


def setup(w, h):
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
    sc.cycles.max_bounces = 8
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    return sc, world


def mat(name, color, rough=0.4, metal=0.0, coat=0.0, emit=None, strength=0.0, aniso=0.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.06
    b.inputs["Anisotropic"].default_value = aniso
    b.inputs["Transmission Weight"].default_value = transmission
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def box(name, size, loc, material, bevel=0.0, segs=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        m = ob.modifiers.new("Bevel", "BEVEL")
        m.width = bevel
        m.segments = segs
        m.limit_method = "ANGLE"
        bpy.ops.object.shade_smooth()
    ob.data.materials.append(material)
    return ob


class Batch:
    """Копит кубы в один меш на материал — в тысячи раз быстрее bpy.ops для сцен с тысячами деталей."""

    def __init__(self):
        self.bms = {}

    def box(self, size, loc, material):
        bm = self.bms.get(material.name)
        if bm is None:
            bm = self.bms[material.name] = (bmesh.new(), material)
        bm = bm[0]
        r = bmesh.ops.create_cube(bm, size=1.0)
        sx, sy, sz = size
        for v in r["verts"]:
            v.co.x = v.co.x * sx + loc[0]
            v.co.y = v.co.y * sy + loc[1]
            v.co.z = v.co.z * sz + loc[2]

    def finish(self, bevel=0.0):
        for name, (bm, material) in self.bms.items():
            me = bpy.data.meshes.new(name)
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new(name, me)
            bpy.context.scene.collection.objects.link(ob)
            me.materials.append(material)
            if bevel:
                m = ob.modifiers.new("Bevel", "BEVEL")
                m.width = bevel
                m.segments = 1
                m.limit_method = "ANGLE"
        self.bms = {}


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


def camera(loc, target, lens):
    cd = bpy.data.cameras.new("Cam")
    cd.lens = lens
    cam = bpy.data.objects.new("Cam", cd)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    cam["target"] = target
    return cam


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ───────────────────────────── Коридор ЦОД ─────────────────────────────
def blink_led(name, color, rnd):
    """Огонёк мигает с периодом 24/48/96 кадров — петля в 96 кадров остаётся бесшовной."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.cycles.emission_sampling = "NONE"  # тысячи огоньков не считаем источниками света — рендер в разы быстрее
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    for n in list(nodes):
        nodes.remove(n)
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    t = nodes.new("ShaderNodeValue")
    fc = t.outputs[0].driver_add("default_value")
    fc.driver.expression = "frame"
    period = random.Random(rnd).choice([24, 48, 96])
    phase = random.Random(rnd + 1).random()
    div = nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = period
    links.new(t.outputs[0], div.inputs[0])
    add = nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    add.inputs[1].default_value = phase
    links.new(div.outputs[0], add.inputs[0])
    fr = nodes.new("ShaderNodeMath")
    fr.operation = "FRACT"
    links.new(add.outputs[0], fr.inputs[0])
    gt = nodes.new("ShaderNodeMath")
    gt.operation = "GREATER_THAN"
    gt.inputs[1].default_value = 0.35
    links.new(fr.outputs[0], gt.inputs[0])
    mp = nodes.new("ShaderNodeMapRange")
    mp.inputs["To Min"].default_value = 1.5
    mp.inputs["To Max"].default_value = 18.0
    links.new(gt.outputs[0], mp.inputs["Value"])
    links.new(mp.outputs[0], em.inputs["Strength"])
    links.new(em.outputs[0], out.inputs["Surface"])
    return m


def corridor():
    W, H = int(OPTS.get("w", 1600)), int(OPTS.get("h", 900))
    sc, world = setup(W, H)
    sc.frame_start, sc.frame_end = 1, 96
    sc.render.fps = 24
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.004, 0.008, 0.01, 1)
    bg.inputs["Strength"].default_value = 1.0

    PITCH = 0.64  # шаг стоек по Y
    N = 40  # стоек в ряду
    AISLE = 0.75  # половина ширины прохода
    RACK_W, RACK_D, RACK_H = 0.6, 1.1, 2.3
    cabinet = mat("Cabinet", lin("#0b1012"), rough=0.32, metal=0.85, aniso=0.4)
    rail = mat("Rail", lin("#2a3235"), rough=0.25, metal=1.0)
    unit_dark = mat("Unit", lin("#121a1d"), rough=0.45, metal=0.6)
    unit_face = mat("UnitFace", lin("#1d2629"), rough=0.3, metal=0.8, aniso=0.6)
    floor = mat("Floor", lin("#0e1315"), rough=0.12, metal=0.3, coat=0.6)
    seam = mat("Seam", lin("#05080a"), rough=0.6)
    leds = [blink_led(f"LedT{i}", TEAL, i) for i in range(6)] + \
           [blink_led(f"LedA{i}", AMBER, 100 + i) for i in range(3)] + \
           [blink_led(f"LedW{i}", (0.85, 0.95, 1.0), 200 + i) for i in range(2)]

    def build_rack(side, idx):
        y = idx * PITCH
        x = side * (AISLE + RACK_D / 2)
        B.box((RACK_D, RACK_W - 0.02, RACK_H), (x, y, RACK_H / 2), cabinet)
        fx = side * (AISLE + 0.012)  # фронт стойки смотрит в проход
        B.box((0.02, RACK_W - 0.04, 0.04), (fx, y, RACK_H - 0.06), rail)
        rnd = random.Random(idx % 4 * 7 + (side > 0))  # рисунок повторяется каждые 4 стойки
        z = 0.18
        while z < RACK_H - 0.2:
            u = rnd.choice([1, 1, 2, 2, 3, 4])
            hgt = u * 0.0445 - 0.004
            if rnd.random() < 0.12:  # пустое место
                z += hgt + 0.004
                continue
            B.box((0.03, RACK_W - 0.08, hgt), (fx, y, z + hgt / 2), unit_face if u > 1 else unit_dark)
            for k in range(rnd.choice([1, 2, 3, 4])):
                led = rnd.choice(leds)
                ly = y - (RACK_W / 2 - 0.08) + k * 0.035
                B.box((0.012, 0.012, 0.006), (fx - side * 0.018, ly, z + hgt / 2), led)
            if u >= 2 and rnd.random() < 0.6:  # полоса подсветки на передней панели
                led = rnd.choice(leds[:6])
                B.box((0.006, RACK_W * 0.42, 0.004), (fx - side * 0.018, y + 0.08, z + hgt * 0.3), led)
            z += hgt + 0.004

    B = Batch()
    for side in (-1, 1):
        for i in range(-6, N):
            build_rack(side, i)

    # Пол: плитки фальшпола с тёмными швами, глянец отражает огни
    B.box((8, N * PITCH + 20, 0.02), (0, N * PITCH / 2, -0.01), floor)
    for i in range(-10, int((N * PITCH + 10) / 0.6)):
        B.box((2 * AISLE, 0.008, 0.002), (0, i * 0.6, 0.001), seam)
    B.box((0.008, N * PITCH + 20, 0.002), (0, N * PITCH / 2, 0.001), seam)

    # Потолок: кабельные лотки и линии света
    ceil = mat("Ceil", lin("#07090a"), rough=0.8)
    B.box((8, N * PITCH + 20, 0.05), (0, N * PITCH / 2, 3.1), ceil)
    tray = mat("Tray", lin("#3a4448"), rough=0.35, metal=1.0)
    for sx in (-1, 1):
        B.box((0.3, N * PITCH + 20, 0.06), (sx * (AISLE + 0.35), N * PITCH / 2, 2.62), tray)
    strip = mat("Strip", (0, 0, 0), emit=(0.82, 0.96, 1.0), strength=7.0)
    for i in range(-10, N):
        if i % 2 == 0:
            B.box((0.06, PITCH * 1.6, 0.02), (0, i * PITCH, 3.06), strip)

    B.finish(bevel=0.003)

    # «Свет в конце коридора» едет вместе с камерой, чтобы петля не прыгала
    cam = camera((0, 0, 1.32), (0, 10, 1.2), 22)
    glow = mat("Glow", (0, 0, 0), emit=lin("#9ff3f6"), strength=5.0)
    end = box("End", (3, 0.05, 3.2), (0, 26, 1.55), glow)
    end.parent = cam
    end.matrix_parent_inverse = cam.matrix_world.inverted()

    # Камера проходит ровно 4 шага за 96 кадров (кадр 97 = кадр 1)
    cam.location = (0, 0, 1.32)
    cam.keyframe_insert("location", frame=1)
    cam.location = (0, 4 * PITCH, 1.32)
    cam.keyframe_insert("location", frame=97)
    for fc in cam.animation_data.action.fcurves if hasattr(cam.animation_data.action, "fcurves") else []:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    try:
        for layer in cam.animation_data.action.layers:
            for strip_ in layer.strips:
                for bag in strip_.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = "LINEAR"
    except AttributeError:
        pass

    os.makedirs(OUT, exist_ok=True)
    frames = [int(x) for x in OPTS["frames"].split(",")] if "frames" in OPTS else list(range(1, 97))
    for f in frames:
        sc.frame_set(f)
        render(os.path.join(OUT, f"{f:03d}.png"))


if MODE == "corridor":
    corridor()
print("DONE")
