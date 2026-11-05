"""Render the hero fly-through.  python bl_render_seq.py <work_dir> <frame_start> <frame_step> <threads>"""
import bpy, sys, os, time
SP, f0, step, threads = sys.argv[-4], int(sys.argv[-3]), int(sys.argv[-2]), int(sys.argv[-1])
N = 100
bpy.ops.wm.open_mainfile(filepath=SP + '/blender/studio.blend')
scene = bpy.context.scene
cam = scene.camera
tgt = bpy.data.objects['CAM_TARGET']

# (t, cam_y, cam_z, tgt_y, tgt_z, lens)
P = [
    (0.00, 9.00, 1.05,  0.00, 0.62, 40),
    (0.24, 6.10, 1.06,  0.25, 0.64, 40),
    (0.44, 4.00, 1.15,  0.40, 0.78, 38),
    (0.59, 2.65, 1.24,  0.20, 0.92, 36),
    (0.71, 1.60, 1.15, -0.10, 0.96, 34),
    (0.80, 0.98, 1.05, -0.40, 0.92, 32),
    (0.89, 0.50, 1.00, -0.70, 0.86, 30),
    (1.00, -0.15, 0.95, -1.40, 0.80, 28),
]

def hermite(t):
    n = len(P)
    if t <= P[0][0]: return P[0][1:]
    if t >= P[-1][0]: return P[-1][1:]
    i = max(k for k in range(n - 1) if P[k][0] <= t)
    def tangent(k):
        a = P[max(k - 1, 0)]; b = P[min(k + 1, n - 1)]
        dt = b[0] - a[0]
        return [(bb - aa) / dt for aa, bb in zip(a[1:], b[1:])]
    t0, t1 = P[i][0], P[i + 1][0]
    h = t1 - t0
    s = (t - t0) / h
    h00 = 2*s**3 - 3*s**2 + 1; h10 = s**3 - 2*s**2 + s; h01 = -2*s**3 + 3*s**2; h11 = s**3 - s**2
    m0, m1 = tangent(i), tangent(i + 1)
    return [h00*p0 + h10*h*a + h01*p1 + h11*h*b for p0, p1, a, b in zip(P[i][1:], P[i+1][1:], m0, m1)]

for f in range(1, N + 1):
    t = (f - 1) / (N - 1)
    cy_, cz, ty, tz, lens = hermite(t)
    cam.location = (0.0, cy_, cz)
    tgt.location = (0.0, ty, tz)
    cam.data.lens = lens
    cam.keyframe_insert('location', frame=f)
    tgt.keyframe_insert('location', frame=f)
    cam.data.keyframe_insert('lens', frame=f)

scene.frame_start = f0
scene.frame_end = N
scene.frame_step = step
scene.render.threads_mode = 'FIXED'
scene.render.threads = threads
scene.render.use_persistent_data = True
os.makedirs(SP + '/renders/seq', exist_ok=True)
scene.render.filepath = SP + '/renders/seq/f_####'
t = time.time()
bpy.ops.render.render(animation=True)
print('SEQ_DONE %.1fs' % (time.time() - t))
