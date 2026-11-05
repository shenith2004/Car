"""Macro shot: padded black leather with red double top-stitching and a needle.

python bl_stitch.py <SP> <out.png> <w> <h> <samples>
"""
import bpy, bmesh, sys, math, mathutils, time

SP, OUT, W, H, SAMPLES = sys.argv[-5], sys.argv[-4], int(sys.argv[-3]), int(sys.argv[-2]), int(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
V = mathutils.Vector

# seam runs diagonally across the frame
S = V((1.0, 0.62, 0.0)).normalized()          # seam direction
N = V((-S.y, S.x, 0.0))                       # across the seam
CUSH = 0.0105                                 # cushion half-width (m)


def height(x, y):
    p = V((x, y, 0))
    d = p.dot(N)
    a = abs(d)
    # two rounded cushions meeting in a valley at the seam
    t = min(a / (2 * CUSH), 1.0)
    bump = math.sin(t * math.pi) ** 0.7 * 0.0042
    valley = -0.0016 * math.exp(-(a / 0.0011) ** 2)
    # gentle large-scale roll-off so the frame has depth
    along = p.dot(S)
    roll = -0.9 * (d * 0.35) ** 2 - 0.25 * (along * 0.18) ** 2
    return bump + valley + roll


# ------------------------------------------------------------------ leather
bpy.ops.mesh.primitive_grid_add(x_subdivisions=520, y_subdivisions=360, size=1)
leather = bpy.context.active_object
leather.name = 'LEATHER'
leather.scale = (0.2, 0.14, 1)
bpy.ops.object.transform_apply(scale=True)
me = leather.data
for v in me.vertices:
    v.co.z = height(v.co.x, v.co.y)
for p in me.polygons:
    p.use_smooth = True

lm = bpy.data.materials.new('leather')
try:
    lm.use_nodes = True
except Exception:
    pass
nt = lm.node_tree
b = nt.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.010, 0.009, 0.009, 1)
b.inputs['Roughness'].default_value = 0.42
b.inputs['Specular IOR Level'].default_value = 0.55
b.inputs['Sheen Weight'].default_value = 0.25
b.inputs['Sheen Roughness'].default_value = 0.4
coord = nt.nodes.new('ShaderNodeTexCoord')
vor = nt.nodes.new('ShaderNodeTexVoronoi')
vor.feature = 'SMOOTH_F1'
vor.inputs['Scale'].default_value = 1150.0
vor.inputs['Randomness'].default_value = 0.9
nt.links.new(coord.outputs['Object'], vor.inputs['Vector'])
noise = nt.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 260.0
noise.inputs['Detail'].default_value = 6
nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
mix = nt.nodes.new('ShaderNodeMath')
mix.operation = 'MULTIPLY_ADD'
mix.inputs[1].default_value = 0.35
nt.links.new(noise.outputs['Fac'], mix.inputs[0])
nt.links.new(vor.outputs['Distance'], mix.inputs[2])
bump = nt.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.55
bump.inputs['Distance'].default_value = 0.0004
nt.links.new(mix.outputs[0], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
# roughness variation: pebble tops are slightly glossier
rr = nt.nodes.new('ShaderNodeMapRange')
rr.inputs['To Min'].default_value = 0.3
rr.inputs['To Max'].default_value = 0.55
nt.links.new(vor.outputs['Distance'], rr.inputs['Value'])
nt.links.new(rr.outputs['Result'], b.inputs['Roughness'])
leather.data.materials.append(lm)

# ------------------------------------------------------------------ thread
tm = bpy.data.materials.new('thread')
try:
    tm.use_nodes = True
except Exception:
    pass
nt = tm.node_tree
b = nt.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.8, 0.018, 0.012, 1)
b.inputs['Roughness'].default_value = 0.36
b.inputs['Sheen Weight'].default_value = 0.6
b.inputs['Sheen Tint'].default_value = (1.0, 0.4, 0.4, 1)
b.inputs['Subsurface Weight'].default_value = 0.15
coord = nt.nodes.new('ShaderNodeTexCoord')
wave = nt.nodes.new('ShaderNodeTexWave')
wave.wave_type = 'BANDS'
wave.bands_direction = 'DIAGONAL'
wave.inputs['Scale'].default_value = 3.2
wave.inputs['Distortion'].default_value = 1.5
wave.inputs['Detail'].default_value = 2
nt.links.new(coord.outputs['UV'], wave.inputs['Vector'])
bump = nt.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.6
nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])

stitch_len = 0.0042
gap = 0.0016
offset = 0.0034  # distance of each stitch row from the seam
stitch_r = 0.00066
pitch = stitch_len + gap


def make_stitch(center, direction):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1)
    o = bpy.context.active_object
    o.scale = (stitch_len / 2, stitch_r, stitch_r * 0.85)
    ang = math.atan2(direction.y, direction.x)
    o.rotation_euler = (0, 0, ang)
    o.location = center
    o.data.materials.append(tm)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


stitches = []
for side in (-1, 1):
    k = -16
    kmax = -1 if side == 1 else 16
    while k <= kmax:
        c2 = S * (k * pitch) + N * (side * offset)
        z = height(c2.x, c2.y) + stitch_r * 0.25
        stitches.append(make_stitch(V((c2.x, c2.y, z)), S))
        # stitch hole dimples at both ends are implied by the sunk ends
        k += 1
# join stitches for speed
bpy.ops.object.select_all(action='DESELECT')
for o in stitches:
    o.select_set(True)
bpy.context.view_layer.objects.active = stitches[0]
bpy.ops.object.join()
st = bpy.context.active_object
st.name = 'STITCHES'
# conform: tilt each stitch to the surface roughly by shrinkwrap-like z offset
for v in st.data.vertices:
    w = st.matrix_world @ v.co
    base = height(w.x, w.y)
    # ends dive into the leather
    local_along = (w - V((0, 0, 0))).dot(S)
    v.co = st.matrix_world.inverted() @ V((w.x, w.y, max(w.z, base - 0.0004)))

# ------------------------------------------------------------------ needle + loose thread
needle_tip = S * (0.55 * pitch) + N * (offset * 1) + V((0, 0, 0.0))
needle_tip.z = height(needle_tip.x, needle_tip.y) + 0.0006
needle_dir = (S * 0.8 - N * 0.32 + V((0, 0, 0.5))).normalized()
nl = 0.048
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.0005, radius2=0.0005, depth=nl)
nd = bpy.context.active_object
nd.name = 'NEEDLE'
# taper the tip
for v in nd.data.vertices:
    if v.co.z < 0:
        v.co.x *= 0.05
        v.co.y *= 0.05
for p in nd.data.polygons:
    p.use_smooth = True
nd.location = needle_tip + needle_dir * (nl / 2)
nd.rotation_mode = 'QUATERNION'
nd.rotation_quaternion = V((0, 0, 1)).rotation_difference(needle_dir)
cm = bpy.data.materials.new('needle')
try:
    cm.use_nodes = True
except Exception:
    pass
b = cm.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.75, 0.75, 0.78, 1)
b.inputs['Metallic'].default_value = 1.0
b.inputs['Roughness'].default_value = 0.22
b.inputs['Anisotropic'].default_value = 0.6
nd.data.materials.append(cm)

# loose thread: from the last stitch end, up through the needle eye and out of frame
start = S * (-1 * pitch + stitch_len / 2) + N * offset
start.z = height(start.x, start.y)
eye = needle_tip + needle_dir * (nl * 0.93)
pts = [
    start,
    start + V((0, 0, 0.0015)) + S * 0.0012,
    needle_tip + needle_dir * 0.012 + N * 0.0035 + V((0, 0, 0.002)),
    eye + N * 0.0015,
    eye + needle_dir * 0.01 + N * 0.006 + S * 0.004,
    eye + needle_dir * 0.03 + N * 0.022 + S * 0.012,
]
cd = bpy.data.curves.new('loose', 'CURVE')
cd.dimensions = '3D'
cd.bevel_depth = stitch_r * 0.78
cd.bevel_resolution = 6
sp = cd.splines.new('NURBS')
sp.points.add(len(pts) - 1)
for i, p in enumerate(pts):
    sp.points[i].co = (p.x, p.y, p.z, 1)
sp.use_endpoint_u = True
sp.order_u = 4
sp.resolution_u = 24
co = bpy.data.objects.new('LOOSE_THREAD', cd)
scene.collection.objects.link(co)
cd.materials.append(tm)

# ------------------------------------------------------------------ lights
def area(name, loc, look_at, size, energy, color=(1, 1, 1), size_y=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size = size
    ld.size_y = size_y or size
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    d = (V(look_at) - V(loc)).normalized()
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = V((0, 0, -1)).rotation_difference(d)
    ob.visible_camera = False
    return ob

area('KEY', (0.1, 0.1, 0.06), (0.0, 0.0, 0.0), 0.06, 0.26, (1.0, 0.95, 0.9), 0.012)
area('RIM', (-0.05, 0.16, 0.035), (0.01, 0.0, 0.0), 0.05, 0.12, (0.9, 0.93, 1.0), 0.01)
area('FILL', (-0.12, -0.08, 0.12), (0.0, 0.0, 0.0), 0.15, 0.004, (0.9, 0.92, 1.0))

area('TOPBOX', (0.02, 0.0, 0.25), (0.02, 0.0, 0.0), 0.3, 0.05, (1.0, 0.97, 0.94))
world = bpy.data.worlds.new('W')
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0

# ------------------------------------------------------------------ camera
cam_d = bpy.data.cameras.new('CAM')
cam_d.lens = 100
cam_d.sensor_width = 36
cam_d.clip_start = 0.001
cam = bpy.data.objects.new('CAM', cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
focus = S * (2.0 * pitch) + N * 0.0
focus.z = height(focus.x, focus.y)
cam.location = focus + V((-0.06, -0.135, 0.13))
direction = (focus - cam.location).normalized()
cam.rotation_mode = 'QUATERNION'
cam.rotation_quaternion = direction.to_track_quat('-Z', 'Y')
# roll the camera so the seam runs bottom-centre to top-right
cam.rotation_mode = 'XYZ'
cam_d.dof.use_dof = True
cam_d.dof.focus_distance = (focus - cam.location).length
cam_d.dof.aperture_fstop = 5.6
cam_d.shift_x = 0.0

# ------------------------------------------------------------------ render
scene.render.engine = 'CYCLES'
cy = scene.cycles
cy.device = 'CPU'
cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.03
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
except Exception:
    pass
cy.max_bounces = 6
cy.diffuse_bounces = 2
cy.glossy_bounces = 3
cy.caustics_reflective = False
cy.caustics_refractive = False
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Khronos PBR Neutral'
scene.render.filepath = OUT
t = time.time()
bpy.ops.render.render(write_still=True)
print('RENDER_TIME %.1fs' % (time.time() - t), OUT)
