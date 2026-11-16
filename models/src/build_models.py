# build_models.py — builds the three card models from code.
# Run inside Blender (Scripting tab, or: blender --background --python build_models.py).
# Output: models/*.glb for ar.html, models/top/*.png for 2d.html, models/src/cards.blend.
#
# Rules (see docs/3d-models-plan.md): real size in metres, one mesh and one unlit
# material per model, no textures, colour and soft shading stored in the vertices.

import bpy, bmesh, os, math, json, struct
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
ROOT = globals().get("MODELS_DIR") or os.path.dirname(HERE)   # the models/ folder
CM = 0.01
TOP_PX = 256


def srgb(hex_colour):
    """'#rrggbb' -> linear RGB, which is what vertex colours and glTF store."""
    h = hex_colour.lstrip('#')
    def lin(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(h[0:2]), lin(h[2:4]), lin(h[4:6]))


class Builder:
    """Collects boxes and cylinders into one mesh, remembering a colour per face."""

    def __init__(self):
        self.bm = bmesh.new()
        self.tint = self.bm.faces.layers.int.new("tint")
        self.colours = []

    def _paint(self, geom, colour):
        self.colours.append(srgb(colour))
        idx = len(self.colours) - 1
        for f in {f for v in geom for f in v.link_faces}:
            f[self.tint] = idx

    def box(self, centre, size, colour, top_scale=None):
        """size in cm. top_scale=(sx, sy) narrows the top face (car cabin)."""
        made = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        for v in made:
            if top_scale and v.co.z > 0:
                v.co.x *= top_scale[0]; v.co.y *= top_scale[1]
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) * CM \
                   + Vector(centre) * CM
        self._paint(made, colour)

    def cylinder(self, centre, radius, length, axis, colour, sides=16):
        made = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=sides,
                                     radius1=radius * CM, radius2=radius * CM,
                                     depth=length * CM)["verts"]
        turn = {'Z': Matrix.Identity(4),
                'Y': Matrix.Rotation(math.radians(-90), 4, 'X'),
                'X': Matrix.Rotation(math.radians(90), 4, 'Y')}[axis]
        for v in made:
            v.co = turn @ v.co + Vector(centre) * CM
        self._paint(made, colour)

    def finish(self, name, material):
        bm = self.bm
        # Nothing ever sees the underside: remove faces lying flat on the card.
        under = [f for f in bm.faces if f.normal.z < -0.99 and f.calc_center_median().z < 0.0005]
        bmesh.ops.delete(bm, geom=under, context='FACES')
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.normal_update()
        col = bm.loops.layers.float_color.new("Col")
        for f in bm.faces:
            base = self.colours[f[self.tint]]
            n = f.normal
            light = 0.70 + 0.26 * n.z + 0.05 * n.x - 0.04 * n.y   # soft light from above
            for loop in f.loops:
                ground = 0.82 + 0.18 * min(1.0, loop.vert.co.z / (0.6 * CM))  # darker near the card
                k = max(0.0, light * ground)
                loop[col] = (base[0] * k, base[1] * k, base[2] * k, 1.0)
        bm.faces.layers.int.remove(self.tint)
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh); bm.free()
        mesh.color_attributes.active_color = mesh.color_attributes["Col"]
        mesh.color_attributes.render_color_index = 0
        mesh.materials.append(material)
        return bpy.data.objects.new(name, mesh)


def unlit_material():
    """Vertex colour straight to the screen. Exports as KHR_materials_unlit."""
    mat = bpy.data.materials.new("card_unlit")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    em = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(vc.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


def point(name, at_cm, parent, scene):
    """A named empty the page can look up (where the pulse starts, and so on)."""
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.2 * CM
    e.location = Vector(at_cm) * CM
    e.parent = parent
    scene.collection.objects.link(e)
    return e


# ---------------------------------------------------------------- the models

def build_sensor(mat, scene):
    """HC-SR04 style board standing upright; the two eyes face +Y (forward)."""
    b = Builder()
    b.box((0, 0, 1.0), (4.5, 0.16, 2.0), '#1c5fa8')                       # board
    for x in (-1.3, 1.3):
        b.cylinder((x, 0.68, 1.0), 0.80, 1.20, 'Y', '#c9ced6', sides=16)  # eye
        b.cylinder((x, 1.29, 1.0), 0.62, 0.04, 'Y', '#2a2f38', sides=12)  # mesh face
    b.box((0, 0.23, 1.62), (1.0, 0.30, 0.36), '#c9ced6')                  # crystal
    b.box((0, -0.21, 0.22), (1.1, 0.26, 0.26), '#20242b')                 # pin header
    for x in (-0.38, -0.127, 0.127, 0.38):
        b.box((x, -0.62, 0.22), (0.07, 0.56, 0.07), '#d8b24a')            # pins
    obj = b.finish("sensor", mat)
    scene.collection.objects.link(obj)
    point("tx", (-1.3, 1.31, 1.0), obj, scene)
    point("rx", (1.3, 1.31, 1.0), obj, scene)
    return obj


def build_car(mat, scene):
    """Toy car, length along X, front towards +X."""
    b = Builder()
    b.box((0, 0, 0.90), (6.0, 3.0, 1.0), '#d23b3b')                           # body
    b.box((-0.2, 0, 1.87), (3.4, 2.7, 0.94), '#2b3a4a', top_scale=(0.74, 0.88))  # cabin glass
    b.box((-0.2, 0, 2.40), (2.6, 2.44, 0.12), '#d23b3b')                      # roof
    for x in (-1.9, 1.9):
        for y in (-1.38, 1.38):
            b.cylinder((x, y, 0.55), 0.55, 0.42, 'Y', '#1d1f24', sides=10)    # wheel
    for y in (-1.0, 1.0):
        b.box((3.0, y, 1.0), (0.08, 0.55, 0.32), '#ffe9a3')                   # headlight
        b.box((-3.0, y, 1.0), (0.08, 0.55, 0.26), '#7a1414')                  # tail light
    obj = b.finish("car", mat)
    scene.collection.objects.link(obj)
    point("hit", (0, 0, 1.2), obj, scene)
    return obj


def build_buzzer(mat, scene):
    """Round buzzer, drawn about twice real size so it can be seen."""
    b = Builder()
    b.cylinder((0, 0, 0.85), 1.25, 1.30, 'Z', '#23262c', sides=16)   # body
    b.cylinder((0, 0, 1.51), 0.30, 0.03, 'Z', '#6b7280', sides=10)   # sound hole
    for x in (-0.38, 0.38):
        b.box((x, 0, 0.10), (0.08, 0.08, 0.20), '#c9ced6')           # pins
    obj = b.finish("buzzer", mat)
    scene.collection.objects.link(obj)
    point("cap", (0, 0, 1.52), obj, scene)
    return obj


# ---------------------------------------------------------------- output

def export_glb(obj, scene, path):
    for o in scene.objects:
        o.select_set(o == obj or o.parent == obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_yup=True, export_apply=True,
        export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True,
        export_normals=False, export_texcoords=False, export_tangents=False,
        export_animations=False, export_cameras=False, export_lights=False,
        export_skins=False, export_morph=False, export_extras=False,
    )


def make_unlit(path):
    """Rewrite the material inside the .glb as unlit vertex colour.
    Blender writes an emission material here, which three.js would draw white."""
    data = open(path, "rb").read()
    json_len = struct.unpack("<I", data[12:16])[0]
    doc = json.loads(data[20:20 + json_len])
    rest = data[20 + json_len:]
    doc["materials"] = [{
        "name": "card_unlit",
        "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 1},
        "extensions": {"KHR_materials_unlit": {}},
    }]
    doc["extensionsUsed"] = sorted(set(doc.get("extensionsUsed", []) + ["KHR_materials_unlit"]))
    text = json.dumps(doc, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    total = 12 + 8 + len(text) + len(rest)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(text), b"JSON"))
        f.write(text); f.write(rest)


def render_top(obj, scene, path):
    """Straight-down picture of one model for the 2D page. Image up = model forward (+Y)."""
    for o in scene.objects:
        if o.type == 'MESH':
            o.hide_render = (o != obj)
    cam = scene.camera
    d = obj.dimensions
    cam.data.ortho_scale = max(d.x, d.y) * 1.08
    bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    cx = (min(v.x for v in bb) + max(v.x for v in bb)) / 2
    cy = (min(v.y for v in bb) + max(v.y for v in bb)) / 2
    cam.location = (cx, cy, 1.0)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return cam.data.ortho_scale / CM          # picture width in cm


def main():
    scene = bpy.data.scenes.get("cards")
    if scene:
        for o in list(scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        scene = bpy.data.scenes.new("cards")
    bpy.context.window.scene = scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0

    mat = bpy.data.materials.get("card_unlit") or unlit_material()
    models = [build_sensor(mat, scene), build_car(mat, scene), build_buzzer(mat, scene)]
    bpy.context.view_layer.update()

    report = {}
    for obj in models:
        path = os.path.join(ROOT, obj.name + ".glb")
        export_glb(obj, scene, path)
        make_unlit(path)
        report[obj.name] = {"triangles": len(obj.data.polygons), "bytes": os.path.getsize(path)}

    # Top-down pictures: flat colour, no lights, transparent background.
    cam_data = bpy.data.cameras.new("top"); cam_data.type = 'ORTHO'
    cam_data.clip_start = 0.01; cam_data.clip_end = 5
    cam = bpy.data.objects.new("top", cam_data)
    scene.collection.objects.link(cam); scene.camera = cam
    r = scene.render
    r.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'FLAT'
    scene.display.shading.color_type = 'VERTEX'
    scene.display.render_aa = '8'
    r.film_transparent = True
    r.resolution_x = r.resolution_y = TOP_PX; r.resolution_percentage = 100
    r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'; r.image_settings.compression = 100
    scene.view_settings.view_transform = 'Standard'
    for obj in models:
        report[obj.name]["top_cm"] = round(render_top(obj, scene, os.path.join(ROOT, "top", obj.name + ".png")), 3)
    for o in scene.objects:
        o.hide_render = False

    # Lay the three out side by side so the saved file is easy to look at.
    for i, obj in enumerate(models):
        obj.location.x = (i - 1) * 8 * CM
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "src", "cards.blend"), copy=True)
    return report


REPORT = main()
print(REPORT)
