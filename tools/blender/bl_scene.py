"""Builds the NOIRVAL studio scene in Blender (Cycles) and saves it as a .blend.

Usage:  python bl_scene.py <work_dir>   (expects <work_dir>/assets/ferrari_raw.glb)
Scene: dark studio, wet concrete floor, overhead key light, red hero car flanked
by two gloss-black cars with their LED lights on.
"""
import bpy, sys, math, os, mathutils

SP = sys.argv[-1]
ASSETS = os.path.join(SP, 'assets')
OUT_BLEND = os.path.join(SP, 'blender', 'studio.blend')
os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------------------------------------------------------------- helpers
def principled(name, **kw):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for k, v in kw.items():
        sock = bsdf.inputs.get(k)
        if sock is None:
            print('!! missing socket', k)
            continue
        sock.default_value = v
    return mat, nt, bsdf


def add_bump(nt, bsdf, scale=300.0, strength=0.08, detail=2.0, kind='noise', socket='Normal'):
    coord = nt.nodes.new('ShaderNodeTexCoord')
    if kind == 'voronoi':
        tex = nt.nodes.new('ShaderNodeTexVoronoi')
        tex.inputs['Scale'].default_value = scale
        out = tex.outputs['Distance']
    else:
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = scale
        tex.inputs['Detail'].default_value = detail
        out = tex.outputs['Fac']
    nt.links.new(coord.outputs['Object'], tex.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    nt.links.new(out, bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs[socket])
    return bump


def thin_glass(name, tint=(0.3, 0.32, 0.33, 1), rough=0.0, ior_fac=0.06):
    """Fast 'thin' glass: transparent + glossy mixed by fresnel (no refraction noise)."""
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    mix = nt.nodes.new('ShaderNodeMixShader')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    tr.inputs['Color'].default_value = tint
    gl = nt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Roughness'].default_value = rough
    gl.inputs['Color'].default_value = (1, 1, 1, 1)
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.12
    # fresnel-ish: more reflection at grazing angles, minimum base reflection
    mth = nt.nodes.new('ShaderNodeMath')
    mth.operation = 'MULTIPLY_ADD'
    mth.inputs[1].default_value = 0.9
    mth.inputs[2].default_value = ior_fac
    nt.links.new(lw.outputs['Fresnel'], mth.inputs[0])
    nt.links.new(mth.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return mat


def emission(name, color, strength):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = color
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return mat


# ---------------------------------------------------------------- materials
M = {}

# Car paints (clear-coated solid paints)
def paint(name, rgb, rough=0.32, metallic=0.0, flake=False):
    mat, nt, b = principled(name, **{
        'Base Color': (*rgb, 1), 'Metallic': metallic, 'Roughness': rough,
        'Coat Weight': 1.0, 'Coat Roughness': 0.025, 'Coat IOR': 1.5,
        'Specular IOR Level': 0.5,
    })
    if flake:
        add_bump(nt, b, scale=2200.0, strength=0.05, detail=0.0)
    return mat

M['paint_red'] = paint('paint_red', (0.42, 0.0015, 0.0012), rough=0.3)
M['paint_black'] = paint('paint_black', (0.006, 0.006, 0.007), rough=0.28)

M['glass'] = thin_glass('glass_tint', tint=(0.2, 0.21, 0.22, 1), ior_fac=0.035)
M['lens'] = thin_glass('lens_clear', tint=(0.92, 0.92, 0.92, 1), ior_fac=0.04)
M['led'] = emission('led_white', (0.85, 0.92, 1.0, 1), 32.0)

# Taillight: red glass with faint glow
mat, nt, b = principled('taillight', **{
    'Base Color': (0.5, 0.0, 0.0, 1), 'Roughness': 0.08, 'Transmission Weight': 0.0,
    'Emission Color': (1.0, 0.02, 0.01, 1), 'Emission Strength': 1.2,
    'Coat Weight': 1.0, 'Coat Roughness': 0.02,
})
M['taillight'] = mat

M['tire'], nt, b = principled('tire', **{'Base Color': (0.012, 0.012, 0.012, 1), 'Roughness': 0.62, 'Specular IOR Level': 0.3})
add_bump(nt, b, scale=900, strength=0.05)
M['rim'], _, _ = principled('rim_gunmetal', **{'Base Color': (0.11, 0.11, 0.115, 1), 'Metallic': 1.0, 'Roughness': 0.22})
M['chrome'], _, _ = principled('chrome', **{'Base Color': (0.85, 0.85, 0.86, 1), 'Metallic': 1.0, 'Roughness': 0.06})
M['plastic'], nt, b = principled('plastic', **{'Base Color': (0.018, 0.018, 0.019, 1), 'Roughness': 0.45})

# Carbon fibre: woven checker + clearcoat
mat, nt, b = principled('carbon', **{'Base Color': (0.02, 0.02, 0.022, 1), 'Roughness': 0.28,
                                      'Coat Weight': 1.0, 'Coat Roughness': 0.02, 'Metallic': 0.3})
coord = nt.nodes.new('ShaderNodeTexCoord')
chk = nt.nodes.new('ShaderNodeTexChecker')
chk.inputs['Scale'].default_value = 260.0
chk.inputs['Color1'].default_value = (0.012, 0.012, 0.013, 1)
chk.inputs['Color2'].default_value = (0.05, 0.05, 0.055, 1)
nt.links.new(coord.outputs['Object'], chk.inputs['Vector'])
nt.links.new(chk.outputs['Color'], b.inputs['Base Color'])
M['carbon'] = mat

# Leathers
M['leather'], nt, b = principled('leather_black', **{'Base Color': (0.02, 0.019, 0.019, 1), 'Roughness': 0.52,
                                                     'Sheen Weight': 0.15, 'Specular IOR Level': 0.45})
add_bump(nt, b, scale=420, strength=0.12, kind='voronoi')
M['leather_red'], nt, b = principled('leather_red', **{'Base Color': (0.42, 0.012, 0.01, 1), 'Roughness': 0.48,
                                                       'Sheen Weight': 0.1})
add_bump(nt, b, scale=420, strength=0.1, kind='voronoi')
M['int_dark'], _, _ = principled('interior_dark', **{'Base Color': (0.012, 0.012, 0.013, 1), 'Roughness': 0.55})
M['int_light'], _, _ = principled('interior_light', **{'Base Color': (0.035, 0.034, 0.034, 1), 'Roughness': 0.5})
M['carpet'], _, _ = principled('carpet', **{'Base Color': (0.015, 0.015, 0.015, 1), 'Roughness': 0.95})
M['badge'], _, _ = principled('badge_dark', **{'Base Color': (0.03, 0.03, 0.03, 1), 'Metallic': 1.0, 'Roughness': 0.3})

MAT_MAP = {
    'Body_Color': 'paint_red', 'Glass_Gray': 'glass', 'Projector_Glass': 'lens',
    'Turn_Signal_LED': 'led', 'Taillight_Glass': 'taillight', 'Tires': 'tire',
    'metal_gray': 'rim', 'metal_chrome': 'chrome', 'plastic_gray': 'plastic',
    'Carbon_Fiber': 'carbon', 'Leather': 'leather', 'Leather_red': 'leather_red',
    'Interior_dark': 'int_dark', 'Interior_light': 'int_light', 'Carpet': 'carpet',
    'Ferrari_Yellow': 'badge', '_0098_DodgerBlue': 'badge',
}

# ---------------------------------------------------------------- import car
bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, 'ferrari_raw.glb'))
car_objs = list(bpy.context.selected_objects)
root = next(o for o in car_objs if o.parent is None)
root.name = 'CAR_HERO'
for o in car_objs:
    if o.type == 'MESH':
        for s in o.material_slots:
            if s.material and s.material.name in MAT_MAP:
                s.material = M[MAT_MAP[s.material.name]]
        # smooth shading is preserved from normals; ensure ray visibility ok

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from debadge import debadge
print('debadged', len(debadge('CAR_HERO')))

car_col = bpy.data.collections.new('car_hero')
scene.collection.children.link(car_col)
for o in car_objs:
    for c in list(o.users_collection):
        c.objects.unlink(o)
    car_col.objects.link(o)


def clone_car(name, location, rot_z_deg, body_mat):
    """Linked-data duplicate of the hero car with an object-level body paint."""
    mapping = {}
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    for o in car_objs:
        c = o.copy()  # shares mesh data
        mapping[o] = c
        col.objects.link(c)
    for o, c in mapping.items():
        if o.parent:
            c.parent = mapping[o.parent]
            c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    r = mapping[root]
    r.name = name
    r.location = location
    r.rotation_mode = 'XYZ'
    r.rotation_euler = (0, 0, math.radians(rot_z_deg))
    for o, c in mapping.items():
        if c.type == 'MESH':
            for i, s in enumerate(c.material_slots):
                if o.material_slots[i].material == M['paint_red']:
                    s.link = 'OBJECT'
                    s.material = body_mat
    return r

# hero car faces +Y (toward camera).  Side cars sit a little closer to camera and angle inward.
clone_car('CAR_LEFT', (-3.15, 0.9, 0), -9, M['paint_black'])
clone_car('CAR_RIGHT', (3.15, 0.9, 0), 9, M['paint_black'])

# ---------------------------------------------------------------- floor (wet concrete)
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = 'FLOOR'
mat, nt, b = principled('wet_concrete', **{'Base Color': (0.02, 0.02, 0.021, 1), 'Roughness': 0.75,
                                           'Coat Weight': 1.0, 'Coat Roughness': 0.04, 'Coat IOR': 1.33,
                                           'Specular IOR Level': 0.4})
coord = nt.nodes.new('ShaderNodeTexCoord')
# puddle mask
nz = nt.nodes.new('ShaderNodeTexNoise')
nz.inputs['Scale'].default_value = 0.55
nz.inputs['Detail'].default_value = 6.0
nz.inputs['Roughness'].default_value = 0.6
nt.links.new(coord.outputs['Object'], nz.inputs['Vector'])
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.36
ramp.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1)
ramp.color_ramp.elements[1].position = 0.56
ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], b.inputs['Coat Weight'])
# coat roughness: wetter -> smoother
inv = nt.nodes.new('ShaderNodeMapRange')
inv.inputs['From Min'].default_value = 0.0
inv.inputs['From Max'].default_value = 1.0
inv.inputs['To Min'].default_value = 0.14
inv.inputs['To Max'].default_value = 0.025
nt.links.new(ramp.outputs['Color'], inv.inputs['Value'])
nt.links.new(inv.outputs['Result'], b.inputs['Coat Roughness'])
# base colour variation (concrete)
nz2 = nt.nodes.new('ShaderNodeTexNoise')
nz2.inputs['Scale'].default_value = 6.0
nz2.inputs['Detail'].default_value = 8.0
nt.links.new(coord.outputs['Object'], nz2.inputs['Vector'])
ramp2 = nt.nodes.new('ShaderNodeValToRGB')
ramp2.color_ramp.elements[0].color = (0.003, 0.003, 0.0035, 1)
ramp2.color_ramp.elements[1].color = (0.016, 0.016, 0.017, 1)
nt.links.new(nz2.outputs['Fac'], ramp2.inputs['Fac'])
nt.links.new(ramp2.outputs['Color'], b.inputs['Base Color'])
# micro bump on the base (concrete grain) and gentle ripples on the water coat
nz3 = nt.nodes.new('ShaderNodeTexNoise')
nz3.inputs['Scale'].default_value = 140.0
nz3.inputs['Detail'].default_value = 4.0
nt.links.new(coord.outputs['Object'], nz3.inputs['Vector'])
bump = nt.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.35
bump.inputs['Distance'].default_value = 0.02
nt.links.new(nz3.outputs['Fac'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
# elongated ripple on the coat -> vertical streak reflections
mapping = nt.nodes.new('ShaderNodeMapping')
mapping.inputs['Scale'].default_value = (14.0, 1.6, 1.0)
nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])
nz4 = nt.nodes.new('ShaderNodeTexNoise')
nz4.inputs['Scale'].default_value = 2.0
nz4.inputs['Detail'].default_value = 3.0
nt.links.new(mapping.outputs['Vector'], nz4.inputs['Vector'])
bump2 = nt.nodes.new('ShaderNodeBump')
bump2.inputs['Strength'].default_value = 0.06
nt.links.new(nz4.outputs['Fac'], bump2.inputs['Height'])
nt.links.new(bump2.outputs['Normal'], b.inputs['Coat Normal'])
floor.data.materials.append(mat)

# ---------------------------------------------------------------- back glow (soft light curtain behind the cars)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -9.0, 4.0), rotation=(math.radians(90), 0, 0))
glow = bpy.context.active_object
glow.name = 'BACK_GLOW'
glow.scale = (9.0, 9.0, 1)
gm = bpy.data.materials.new('back_glow')
try:
    gm.use_nodes = True
except Exception:
    pass
nt = gm.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new('ShaderNodeOutputMaterial')
em = nt.nodes.new('ShaderNodeEmission')
coord = nt.nodes.new('ShaderNodeTexCoord')
grad = nt.nodes.new('ShaderNodeTexGradient')
grad.gradient_type = 'SPHERICAL'
mp = nt.nodes.new('ShaderNodeMapping')
mp.inputs['Location'].default_value = (0.0, 0.0, 0)
mp.inputs['Scale'].default_value = (3.2, 1.25, 1)
nt.links.new(coord.outputs['Object'], mp.inputs['Vector'])
nt.links.new(mp.outputs['Vector'], grad.inputs['Vector'])
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.0
ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
ramp.color_ramp.elements[1].position = 1.0
ramp.color_ramp.elements[1].color = (0.62, 0.62, 0.6, 1)
nt.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
em.inputs['Strength'].default_value = 0.55
tp = nt.nodes.new('ShaderNodeBsdfTransparent')
mix = nt.nodes.new('ShaderNodeAddShader')
nt.links.new(em.outputs[0], out.inputs['Surface'])
glow.data.materials.append(gm)
glow.visible_shadow = False
glow.hide_render = True  # light shaft is done in CSS on the site
try:
    glow.visible_diffuse = False  # do not light the scene, only be seen / reflected
except Exception:
    pass

# ---------------------------------------------------------------- lights
def area(name, loc, rot_deg, size, size_y, energy, color=(1, 1, 1), spread=180.0, shape='RECTANGLE'):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = shape
    ld.size = size
    ld.size_y = size_y
    ld.energy = energy
    ld.color = color
    try:
        ld.spread = math.radians(spread)
    except Exception:
        pass
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    ob.visible_camera = False
    return ob

# overhead key above hero car (long softbox along the car)
area('KEY_TOP', (0, -0.2, 4.2), (0, 0, 0), 1.6, 5.2, 250, (1.0, 0.97, 0.93), spread=55)
# soft frontal fill (low) to reveal the fascia
area('FILL_FRONT', (0, 7.5, 2.2), (-72, 0, 0), 4.0, 1.2, 140, (0.9, 0.93, 1.0), spread=90)
# rim strips behind the side cars
area('RIM_L', (-4.4, -3.5, 2.0), (70, 0, -150), 0.35, 5.0, 260, (0.92, 0.95, 1.0), spread=100)
area('RIM_R', (4.4, -3.5, 2.0), (70, 0, 150), 0.35, 5.0, 260, (0.92, 0.95, 1.0), spread=100)
# side-car top kiss lights
area('TOP_L', (-3.2, 0.6, 3.6), (0, 0, -9), 1.0, 4.0, 60, (0.9, 0.93, 1.0), spread=60)
area('TOP_R', (3.2, 0.6, 3.6), (0, 0, 9), 1.0, 4.0, 60, (0.9, 0.93, 1.0), spread=60)
# subtle interior light (helps the cabin read during the fly-through)
area('CABIN', (0, -0.1, 1.13), (0, 0, 0), 0.9, 0.9, 1.6, (1.0, 0.86, 0.8), spread=150)

# headlight throw: small spot lights in front of each car so the wet floor catches beams
def spot(name, loc, rot_deg, energy, size_deg=55, blend=0.6, color=(0.9, 0.95, 1.0)):
    ld = bpy.data.lights.new(name, 'SPOT')
    ld.energy = energy
    ld.spot_size = math.radians(size_deg)
    ld.spot_blend = blend
    ld.color = color
    ld.shadow_soft_size = 0.05
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    return ob

for side, (x, yoff, rz) in {'C': (0.0, 0.0, 0), 'L': (-3.15, 0.9, -9), 'R': (3.15, 0.9, 9)}.items():
    for hx in (-0.62, 0.62):
        # rotate headlight offset with the car
        a = math.radians(rz)
        px = x + hx * math.cos(a) - 2.05 * math.sin(a)
        py = yoff + hx * math.sin(a) + 2.05 * math.cos(a)
        spot(f'HEAD_{side}_{hx}', (px, py, 0.68), (-80, 0, rz), 55)

# ---------------------------------------------------------------- world
world = bpy.data.worlds.new('World')
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0, 0, 0, 1)
bg.inputs['Strength'].default_value = 0.0

# ---------------------------------------------------------------- camera
cam_data = bpy.data.cameras.new('CAM')
cam_data.lens = 40
cam_data.sensor_width = 36
cam_data.clip_start = 0.02
cam = bpy.data.objects.new('CAM', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0, 9.0, 1.05)
target = bpy.data.objects.new('CAM_TARGET', None)
scene.collection.objects.link(target)
target.location = (0, 0, 0.62)
con = cam.constraints.new('TRACK_TO')
con.target = target
con.track_axis = 'TRACK_NEGATIVE_Z'
con.up_axis = 'UP_Y'

# ---------------------------------------------------------------- render settings
scene.render.engine = 'CYCLES'
cy = scene.cycles
cy.device = 'CPU'
cy.samples = 32
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.05
cy.adaptive_min_samples = 8
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    cy.denoising_prefilter = 'ACCURATE'
except Exception as e:
    print('denoise opts', e)
cy.max_bounces = 10
cy.diffuse_bounces = 2
cy.glossy_bounces = 3
cy.transmission_bounces = 6
cy.transparent_max_bounces = 10
cy.caustics_reflective = False
cy.caustics_refractive = False
cy.blur_glossy = 0.8
cy.sample_clamp_indirect = 6.0
cy.sample_clamp_direct = 0.0
scene.render.use_persistent_data = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'

vs = scene.view_settings
vs.view_transform = 'Khronos PBR Neutral'
for look in ('None',):
    try:
        vs.look = look
        break
    except Exception:
        continue
vs.exposure = 0.0
vs.gamma = 1.0
print('view', vs.view_transform, 'look', vs.look)

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print('saved', OUT_BLEND)
