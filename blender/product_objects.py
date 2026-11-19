"""
Второй набор форм продуктов для /v6 — «один предмет на продукт», как объекты у Red Collar:
не сценка из нескольких вещей, а один цельный предмет, который намекает на суть продукта.
Фасад смотрит в −Y. Метки объектов — как в product_models.py (accent, mat).
Пока наброски: шлем батыра, монета ₸, пропуск, серверный юнит и два варианта консолидации.
"""
import math

import bmesh
import bpy

from product_models import box, cyl, prism, sphere, tag, torus, tube


def shell(name, rings, segs=64, keep=None):
    """Поверхность вращения по профилю rings = [(радиус, высота)…]; keep(a) — какие доли круга оставить."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    grid = []
    for r, z in rings:
        row = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            row.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        grid.append(row)
    for i in range(len(grid) - 1):
        for k in range(segs):
            a = 2 * math.pi * (k + 0.5) / segs
            if keep and not keep(a):
                continue
            k2 = (k + 1) % segs
            bm.faces.new((grid[i][k], grid[i][k2], grid[i + 1][k2], grid[i + 1][k]))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    sol = o.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.035
    o.modifiers.new("smooth", "SUBSURF").levels = 1
    return tag(o)


def o_helmet():
    """Smart Batyr — шлем батыра (дулыға): купол со шпилем, обруч, наносник, бармица."""
    prof = [(1.0, 0.0), (0.99, 0.2), (0.94, 0.45), (0.82, 0.7), (0.62, 0.92), (0.36, 1.1), (0.14, 1.22), (0.02, 1.26)]
    shell("dome", prof)
    cyl(0.07, 0.5, (0, 0, 1.45), bevel=0.0)
    bpy.context.active_object.modifiers.clear()
    bpy.ops.mesh.primitive_cone_add(radius1=0.1, radius2=0.0, depth=0.55, location=(0, 0, 1.5))
    tag(bpy.context.active_object)
    sphere(0.11, (0, 0, 1.25))
    torus(1.01, 0.06, (0, 0, 0.03))
    torus(1.0, 0.025, (0, 0, 0.2), accent=True)
    box((0.1, 0.06, 0.62), (0, -1.04, -0.22), 0.025)
    # бармица — кольчужная занавесь сзади и по бокам, с вертикальными складками
    skirt = []
    for j in range(7):
        t = j / 6
        skirt.append((1.02 + 0.16 * t, -0.04 - 0.72 * t))
    shell("aventail", skirt, segs=96, keep=lambda a: not (-2.2 < a - 2 * math.pi < -1.0 or -2.2 < a < -1.0))
    # бирюзовая бляха над наносником
    prism([(0, 0.16), (0.12, 0.0), (0, -0.16), (-0.12, 0.0)], 0.05, -1.0, 0.01, accent=True).location.z = 0.42


def o_coin():
    """ERP.Бюджет — большая монета со знаком ₸ на ребре и стопка монет рядом."""
    big = cyl(0.85, 0.14, (0, 0, 0.2), rot=(math.pi / 2, 0, 0), bevel=0.03, verts=96)
    torus(0.76, 0.035, (0, -0.075, 0.2), rot=(math.pi / 2, 0, 0))
    y = -0.09
    box((0.62, 0.06, 0.09), (0, y, 0.55), 0.02, accent=True)
    box((0.62, 0.06, 0.09), (0, y, 0.38), 0.02, accent=True)
    box((0.1, 0.06, 0.62), (0, y, 0.03), 0.02, accent=True)
    for k in range(5):
        cyl(0.5, 0.1, (1.05, 0.25, -0.62 + k * 0.105), bevel=0.02, verts=72).rotation_euler.z = k * 0.4
    big.rotation_euler = (math.pi / 2, 0, 0)


def o_badge():
    """RFID Control — пропуск на шнурке: карта с чипом и витками антенны, клипса, лента."""
    box((0.86, 0.035, 1.2), (0, 0, -0.2), 0.06)
    box((0.22, 0.04, 0.05), (0, 0, 0.37), 0.015)
    box((0.3, 0.025, 0.36), (-0.18, -0.02, 0.0), 0.02)
    for k in range(3):
        box((0.26, 0.02, 0.03), (0.2, -0.02, 0.1 - k * 0.07), 0.008)
    box((0.16, 0.02, 0.12), (-0.2, -0.025, -0.4), 0.01)
    for R in (0.2, 0.15, 0.1):
        torus(R, 0.012, (0.16, -0.025, -0.45), rot=(math.pi / 2, 0, 0), accent=True)
    box((0.08, 0.06, 0.2), (0, 0, 0.5), 0.02)
    tube([(0, 0, 0.6), (-0.25, 0.05, 0.95), (-0.35, 0.15, 1.3), (0, 0.25, 1.55), (0.35, 0.15, 1.3), (0.25, 0.05, 0.95), (0, 0, 0.6)],
         0.035, accent=True)


def o_server():
    """Серверы SH — один серверный юнит 1U: передняя панель с дисками, ушки, индикаторы, решётка."""
    box((1.7, 1.2, 0.2), (0, 0.4, 0), 0.03)
    for k in range(8):
        box((0.16, 0.03, 0.12), (-0.62 + k * 0.18, -0.21, 0), 0.012)
        sphere(0.014, (-0.58 + k * 0.18, -0.235, 0.035), accent=True)
    for x in (-0.92, 0.92):
        box((0.14, 0.04, 0.26), (x, -0.2, 0), 0.02)
    for k in range(10):
        box((0.04, 0.6, 0.01), (-0.6 + k * 0.13, 0.5, 0.105), 0.004)
    box((0.06, 1.1, 0.03), (-0.88, 0.45, -0.12), 0.01)
    box((0.06, 1.1, 0.03), (0.88, 0.45, -0.12), 0.01)


def o_folder():
    """Консолидация, вариант А — папка-регистратор: всё собрано в одну папку."""
    box((0.34, 1.0, 1.4), (0, 0, 0), 0.04)
    box((0.22, 0.03, 0.42), (0, -0.505, 0.35), 0.015, accent=True)
    torus(0.07, 0.02, (0, -0.51, -0.35), rot=(math.pi / 2, 0, 0))
    for k in range(6):
        box((0.02, 0.96, 1.34), (0.19 + k * 0.025, 0.0, 0.0), 0.005)
    box((0.04, 1.0, 1.4), (0.36, 0, 0), 0.02)


def o_puzzle():
    """Консолидация, вариант Б — кубик 2×2×2: последняя (бирюзовая) деталь встаёт на место."""
    s = 0.48
    for x in (-1, 1):
        for y in (-1, 1):
            for z in (-1, 1):
                last = x == 1 and y == -1 and z == 1
                off = (0.28, -0.28, 0.32) if last else (0, 0, 0)
                box((s, s, s), (x * 0.26 + off[0], y * 0.26 + off[1], z * 0.26 + off[2]), 0.05, accent=last)


OBJECTS = [o_helmet, o_coin, o_badge, o_server, o_folder, o_puzzle]


# ── третий заход набросков ───────────────────────────────────────────────────────────────────────

def o_usb():
    """RFID Control — флешка с RFID-меткой на кольце: носитель информации под контролем."""
    body = box((0.36, 0.16, 1.05), (0, 0, 0), 0.06)
    plug = box((0.24, 0.1, 0.32), (0, 0, 0.66), 0.015)
    plug["mat"] = "screen"
    hole = torus(0.07, 0.025, (0, 0, -0.45), rot=(math.pi / 2, 0, 0))
    ring = torus(0.2, 0.025, (0.0, 0.0, -0.7), rot=(0, math.pi / 2, 0))
    tag_disc = cyl(0.3, 0.05, (0.0, -0.02, -1.12), rot=(math.pi / 2, 0, 0), bevel=0.015, verts=72)
    coils = [torus(R, 0.012, (0, -0.05, -1.12), rot=(math.pi / 2, 0, 0), accent=True) for R in (0.22, 0.17, 0.12)]
    chip = box((0.08, 0.02, 0.08), (0, -0.05, -1.12), 0.01, accent=True)
    for o in [body, plug, hole, ring, tag_disc, chip, *coils]:
        o.rotation_euler.y += 0.0
    # вся связка наклонена — так флешка читается живее
    for o in bpy.context.scene.objects:
        if o.type in {"MESH", "CURVE"}:
            x, z = o.location.x, o.location.z
            a = 0.42
            o.location.x, o.location.z = x * math.cos(a) - z * math.sin(a), x * math.sin(a) + z * math.cos(a)
            o.rotation_euler.y -= a


def o_clipstack():
    """Консолидация, вариант В — стопка документов, скреплённая большим бирюзовым зажимом."""
    for k in range(7):
        b = box((1.05, 0.012, 1.4), (k * 0.012 - 0.04, k * 0.035, k * 0.008), 0.006)
        b.rotation_euler.y = (k % 3 - 1) * 0.025
    for k in range(5):
        box((0.62 - (k == 4) * 0.25, 0.008, 0.035), (-0.12, -0.012, 0.1 - k * 0.14), 0.004)
    # зажим: корпус-клин на верхнем крае и две проволочные ручки
    prism([(-0.36, 0.0), (0.36, 0.0), (0.3, -0.34), (-0.3, -0.34)], 0.34, 0.1, 0.03, accent=True).location.z = 0.84
    for x in (-0.24, 0.24):
        tube([(x, -0.17, 0.82), (x, -0.24, 1.0), (x * 0.9, -0.22, 1.2), (x * 0.9, -0.12, 1.24)], 0.022)
    tube([(-0.216, -0.12, 1.24), (0.216, -0.12, 1.24)], 0.022)


def o_funnel():
    """Консолидация, вариант Г — воронка: сверху много листов, снизу выходит один свод."""
    from product_objects import shell  # noqa: F401 (та же функция)
    prof = [(0.12, -0.55), (0.12, -0.2), (0.2, -0.05), (0.5, 0.25), (0.85, 0.55), (0.95, 0.62)]
    shell("funnel", prof, segs=96)
    for k, (x, z, a) in enumerate([(-0.35, 0.95, 0.4), (0.15, 1.1, -0.3), (0.45, 0.85, 0.7), (-0.05, 0.78, -0.9)]):
        b = box((0.26, 0.01, 0.34), (x, 0.05 * k, z), 0.004)
        b.rotation_euler = (0.3 * k, a, 0.2)
    box((0.5, 0.02, 0.36), (0.0, 0.0, -0.85), 0.01, accent=True)


def o_dish():
    """SmartCommand — тарелка радара на опоре: наблюдение, мониторинг."""
    prof = [(0.02, 0.0), (0.2, 0.014), (0.4, 0.056), (0.6, 0.126), (0.8, 0.224), (0.95, 0.316)]
    dish = shell("dish", prof, segs=96)
    for a in (0, 2.1, 4.2):
        tube([(math.cos(a) * 0.9, math.sin(a) * 0.9, 0.3), (0, 0, 0.75)], 0.02)
    sphere(0.07, (0, 0, 0.78), accent=True)
    for R in (0.3, 0.6):
        torus(R, 0.012, (0, 0, R * R * 0.35 + 0.01), accent=True)
    parts = [o for o in bpy.context.scene.objects if o.type in {"MESH", "CURVE"}]
    pivot = bpy.data.objects.new("dishpivot", None)
    bpy.context.collection.objects.link(pivot)
    for o in parts:
        o.parent = pivot
    pivot.location.z = 0.35
    pivot.rotation_euler = (math.radians(58), 0, math.radians(-20))
    cyl(0.07, 0.6, (0, 0.05, -0.15), bevel=0.01)
    box((0.5, 0.12, 0.08), (0, 0.05, 0.12), 0.02)
    cyl(0.42, 0.1, (0, 0.05, -0.5), bevel=0.03, verts=72)
    dish.name = "dish"


def o_tower():
    """SH300 — системный блок: передняя панель, кнопка, решётка, бирюзовая полоса."""
    box((0.5, 1.05, 1.15), (0, 0, 0), 0.05)
    box((0.42, 0.03, 1.05), (0, -0.53, 0), 0.03)
    box((0.03, 0.035, 0.75), (0.14, -0.55, 0.0), 0.012, accent=True)
    torus(0.05, 0.014, (-0.08, -0.555, 0.38), rot=(math.pi / 2, 0, 0))
    for k in range(7):
        box((0.22, 0.02, 0.018), (-0.06, -0.55, -0.12 - k * 0.055), 0.006)
    for k in range(2):
        box((0.26, 0.02, 0.05), (-0.05, -0.55, 0.22 - k * 0.08), 0.01)


def o_rack():
    """Серверы SH — стоящая стойка (из первых набросков, понравилась)."""
    from product_models import m_rack
    m_rack()


def o_coin_keep():
    from product_objects import o_coin as f
    f()


DRAFT3 = [o_coin_keep, o_clipstack, o_funnel, o_dish, o_usb, o_tower, o_rack]


# ── второе направление: интерфейс продукта на парящем экране ─────────────────────────────────────

UI_IMAGE = None  # путь к PNG интерфейса; задаёт render_products.py (--ui)


def o_screen():
    """Консолидация — парящий экран (тонкая панель в гипсе) с интерфейсом сводного отчёта."""
    w, h = 2.0, 1.25
    box((w + 0.1, 0.07, h + 0.1), (0, 0, 0), 0.06)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.037, 0), rotation=(math.pi / 2, 0, 0))
    disp = bpy.context.active_object
    disp.scale = (w, h, 1)
    bpy.ops.object.transform_apply(scale=True)
    tag(disp)
    disp["mat"] = "ui"
    # экран разворачиваем к камере (она справа спереди), иначе интерфейс читается в сильном ракурсе
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            x, y = o.location.x, o.location.y
            a = math.radians(24)
            o.location.x, o.location.y = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
            o.rotation_euler.z += a


SCREEN = [o_screen]
