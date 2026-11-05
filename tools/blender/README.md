# Render pipeline (Blender Cycles)

All imagery on the site — the hero fly-through, the cursor-trail details, the builds,
the process stages and the leather macro — is path-traced with Blender's Cycles engine
from the same 3D model that powers the real-time studio.

```bash
# 1. Blender as a Python module (CPU rendering, OpenImageDenoise included)
python3 -m venv .venv && .venv/bin/pip install bpy==5.2.3

# 2. Work folder + an uncompressed copy of the model (Blender's importer has no Draco)
mkdir -p work/assets
npx @gltf-transform/cli copy public/models/car.glb work/assets/ferrari_raw.glb

# 3. Build the studio scene  ->  work/blender/studio.blend
.venv/bin/python tools/blender/bl_scene.py work

# 4. Hero fly-through (100 frames). Two processes in parallel: odd / even frames
.venv/bin/python tools/blender/bl_render_seq.py work 1 2 2 &
.venv/bin/python tools/blender/bl_render_seq.py work 2 2 2 &

# 5. Stills (trail, builds, process) and the leather macro
.venv/bin/python tools/blender/bl_shots.py work tools/blender/shots.json
.venv/bin/python tools/blender/bl_stitch.py work work/renders/final/stitch.png 2000 1125 56

# 6. Grade (bloom + contrast) and export WebP into /public/media
python3 tools/blender/post.py hero work/renders/seq public/media
python3 tools/blender/post.py still work/renders/stills/builds/rosso.png public/media/builds/rosso.webp 1600
```

Scene notes: wet concrete floor (clear-coat "water" layer with a puddle mask), overhead
softbox, rim strips, headlight spot throws, clear-coated paints, and `debadge.py` removes
the factory emblems so every build reads as unbranded.
