import bpy, bmesh, mathutils

def debadge(root_name='CAR_HERO', dry=False):
    """Delete small emblem islands (front grille + rear panel) from the chrome mesh and the yellow shields."""
    root = bpy.data.objects[root_name]
    removed = []
    for o in root.children_recursive:
        if o.type != 'MESH':
            continue
        base = o.name.split('.')[0]
        if base == 'yellow_trim':
            if not dry:
                o.hide_render = True
                o.hide_viewport = True
            removed.append((o.name, 'all'))
            continue
        if base != 'chrome':
            continue
        mw = o.matrix_world
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.faces.ensure_lookup_table()
        seen = set()
        kill = []
        for f in bm.faces:
            if f.index in seen:
                continue
            # flood fill island
            stack = [f]; island = []
            seen.add(f.index)
            while stack:
                cur = stack.pop(); island.append(cur)
                for e in cur.edges:
                    for nf in e.link_faces:
                        if nf.index not in seen:
                            seen.add(nf.index); stack.append(nf)
            pts = [mw @ v.co for ff in island for v in ff.verts]
            mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
            mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
            c = (mn + mx) / 2
            size = max(mx - mn)
            front = c.y > 2.0 and 0.2 < c.z < 0.66
            rear = c.y < -2.0 and 0.58 < c.z < 1.02
            if size < 0.16 and abs(c.x) < 0.12 and (front or rear):
                kill += island
                removed.append((o.name, len(island), tuple(round(v, 3) for v in c), round(size, 3)))
        if kill and not dry:
            bmesh.ops.delete(bm, geom=list(set(kill)), context='FACES')
            bm.to_mesh(o.data)
        bm.free()
    return removed

if __name__ == '__main__':
    import sys
    SP = sys.argv[-1]
    bpy.ops.wm.open_mainfile(filepath=SP + '/blender/studio.blend')
    for r in debadge(dry=True):
        print('BADGE', r)
