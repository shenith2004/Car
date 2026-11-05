"""Grade + export renders to WebP for the site.

python post.py hero  <seq_dir> <public_media_dir>
python post.py still <in.png> <out.webp> <max_w> [quality]
"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageFilter


def grade(img, bloom=0.32, contrast=0.06):
    a = np.asarray(img.convert('RGB')).astype(np.float32) / 255.0
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mask = np.clip((lum - 0.72) / 0.28, 0, 1)[..., None]
    hi = Image.fromarray((np.clip(a * mask, 0, 1) * 255).astype(np.uint8))
    w = img.width
    b1 = np.asarray(hi.filter(ImageFilter.GaussianBlur(w * 0.006))).astype(np.float32) / 255.0
    b2 = np.asarray(hi.filter(ImageFilter.GaussianBlur(w * 0.022))).astype(np.float32) / 255.0
    out = a + bloom * (0.65 * b1 + 0.55 * b2)
    # gentle S-curve for contrast, keeps blacks deep
    out = np.clip(out, 0, 1)
    out = out + contrast * (out - 0.5) * (1 - np.abs(out - 0.5) * 2) * 2
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))


def hero(seq_dir, media_dir):
    d_desk = os.path.join(media_dir, 'hero', 'desktop')
    d_mob = os.path.join(media_dir, 'hero', 'mobile')
    os.makedirs(d_desk, exist_ok=True)
    os.makedirs(d_mob, exist_ok=True)
    files = sorted(glob.glob(os.path.join(seq_dir, 'f_*.png')))
    for f in files:
        n = int(os.path.basename(f)[2:6])
        out_d = os.path.join(d_desk, 'f_%03d.webp' % n)
        out_m = os.path.join(d_mob, 'f_%03d.webp' % n)
        if os.path.exists(out_d) and os.path.getmtime(out_d) > os.path.getmtime(f):
            continue
        g = grade(Image.open(f))
        g.save(out_d, 'WEBP', quality=86, method=6)
        W, H = g.size
        cw = int(H * 0.8)  # 720x900 centre crop for portrait screens
        x0 = (W - cw) // 2
        g.crop((x0, 0, x0 + cw, H)).save(out_m, 'WEBP', quality=82, method=6)
        print('frame', n)


def still(src, dst, max_w, q=82):
    g = grade(Image.open(src))
    if g.width > max_w:
        g = g.resize((max_w, round(g.height * max_w / g.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    g.save(dst, 'WEBP', quality=q, method=6)
    print('still', dst, g.size, os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'hero':
        hero(sys.argv[2], sys.argv[3])
    else:
        still(sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]) if len(sys.argv) > 5 else 82)
