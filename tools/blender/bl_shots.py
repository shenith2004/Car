"""Render a batch of stills from studio.blend.   python bl_shots.py <SP> <shots.json> [only_name,...]

Each shot: {name, out, cam:[x,y,z], tgt:[x,y,z], lens, w, h, samples,
            hide_sides:bool, paint:[r,g,b], rim:[r,g,b], rim_rough, mode:'clay'|'wire',
            exposure, fstop, focus, key:<energy>, rim_lights:<mult>}
"""
import bpy, sys, json, os, time, math, mathutils

SP = sys.argv[-2] if not sys.argv[-1].endswith('.json') and len(sys.argv) > 3 and sys.argv[-2].endswith('.json') else None
args = [a for a in sys.argv if a.endswith('.json') or os.path.isdir(a)]
SP = args[0]
SHOTS = json.load(open(args[1]))
ONLY = None
if not sys.argv[-1].endswith('.json'):
    ONLY = set(sys.argv[-1].split(','))

bpy.ops.wm.open_mainfile(filepath=SP + '/blender/studio.blend')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from debadge import debadge
print('debadged', len(debadge('CAR_HERO')))
scene = bpy.context.scene
cam = scene.camera
tgt = bpy.data.objects['CAM_TARGET']
paint = bpy.data.materials['paint_red']
pb = next(n for n in paint.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
rim = bpy.data.materials['rim_gunmetal']
rb = next(n for n in rim.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
orig_paint = tuple(pb.inputs['Base Color'].default_value)
orig_rim = tuple(rb.inputs['Base Color'].default_value)
orig_rim_rough = rb.inputs['Roughness'].default_value
lights = {o.name: o for o in scene.objects if o.type == 'LIGHT'}
orig_energy = {n: o.data.energy for n, o in lights.items()}

hero_root = bpy.data.objects['CAR_HERO']
hero_meshes = [o for o in hero_root.children_recursive if o.type == 'MESH']
side_objs = []
for n in ('CAR_LEFT', 'CAR_RIGHT'):
    r = bpy.data.objects[n]
    side_objs += [r] + list(r.children_recursive)

# ---- override materials
def make_clay():
    m = bpy.data.materials.new('clay')
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.62, 0.6, 0.57, 1)
    b.inputs['Roughness'].default_value = 0.6
    b.inputs['Specular IOR Level'].default_value = 0.35
    return m

def make_wire():
    m = bpy.data.materials.new('wire')
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    wf = nt.nodes.new('ShaderNodeWireframe')
    wf.use_pixel_size = True
    wf.inputs['Size'].default_value = 0.9
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.85, 0.9, 1.0, 1)
    em.inputs['Strength'].default_value = 1.6
    base = nt.nodes.new('ShaderNodeBsdfPrincipled')
    base.inputs['Base Color'].default_value = (0.004, 0.004, 0.005, 1)
    base.inputs['Roughness'].default_value = 0.2
    base.inputs['Coat Weight'].default_value = 1.0
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(wf.outputs['Fac'], mix.inputs['Fac'])
    nt.links.new(base.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m

CLAY = make_clay()
WIRE = make_wire()
orig_slots = {o.name: [s.material for s in o.material_slots] for o in hero_meshes}

def set_override(mode):
    for o in hero_meshes:
        for i, s in enumerate(o.material_slots):
            if mode is None:
                s.material = orig_slots[o.name][i]
            else:
                s.material = CLAY if mode == 'clay' else WIRE

for shot in SHOTS:
    if ONLY and shot['name'] not in ONLY:
        continue
    cam.location = shot['cam']
    tgt.location = shot['tgt']
    cam.data.lens = shot.get('lens', 50)
    scene.render.resolution_x = shot['w']
    scene.render.resolution_y = shot['h']
    scene.cycles.samples = shot.get('samples', 40)
    scene.view_settings.exposure = shot.get('exposure', 0.0)
    for o in side_objs:
        o.hide_render = bool(shot.get('hide_sides', False))
    pb.inputs['Base Color'].default_value = (*shot['paint'], 1) if 'paint' in shot else orig_paint
    rb.inputs['Base Color'].default_value = (*shot['rim'], 1) if 'rim' in shot else orig_rim
    rb.inputs['Roughness'].default_value = shot.get('rim_rough', orig_rim_rough)
    for n, o in lights.items():
        e = orig_energy[n]
        if n == 'KEY_TOP' and 'key' in shot:
            e = shot['key']
        if n.startswith('RIM_') and 'rim_lights' in shot:
            e *= shot['rim_lights']
        if n == 'FILL_FRONT' and 'fill' in shot:
            e = shot['fill']
        if n == 'CABIN' and 'cabin' in shot:
            e = shot['cabin']
        if n.startswith('HEAD_') and 'heads' in shot:
            e *= shot['heads']
        o.data.energy = e
    set_override(shot.get('mode'))
    # optional extra 'kick' light aimed at the target (wheels, sills)
    kick = bpy.data.objects.get('KICK')
    if kick:
        bpy.data.objects.remove(kick, do_unlink=True)
    if 'kick' in shot:
        kx, ky, kz, ke, ks = shot['kick']
        ld = bpy.data.lights.new('KICK', 'AREA')
        ld.shape = 'RECTANGLE'
        ld.size = ks
        ld.size_y = ks * 0.5
        ld.energy = ke
        ld.color = (0.92, 0.95, 1.0)
        kick = bpy.data.objects.new('KICK', ld)
        scene.collection.objects.link(kick)
        kick.location = (kx, ky, kz)
        d = mathutils.Vector(shot['tgt']) - mathutils.Vector((kx, ky, kz))
        kick.rotation_mode = 'QUATERNION'
        kick.rotation_quaternion = mathutils.Vector((0, 0, -1)).rotation_difference(d.normalized())
        kick.visible_camera = False
    if 'fstop' in shot:
        cam.data.dof.use_dof = True
        cam.data.dof.aperture_fstop = shot['fstop']
        cam.data.dof.focus_distance = shot.get('focus') or (mathutils.Vector(shot['tgt']) - mathutils.Vector(shot['cam'])).length
    else:
        cam.data.dof.use_dof = False
    out = os.path.join(SP, 'renders', 'stills', shot['out'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    scene.render.filepath = out
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print('SHOT %-14s %.1fs' % (shot['name'], time.time() - t), flush=True)
print('ALL_DONE')
