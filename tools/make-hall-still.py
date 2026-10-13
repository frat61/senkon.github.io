"""The finished steel hall as a still picture, for visitors without JavaScript or with reduced motion.

Usage: python tools/make-hall-still.py assets/senkon/hal.json assets/senkon/hal.webp

Draws every member of hal.json (written by tools/make-hall.js) in depth order, far to near, with the
stroke rules of assets/senkon/hal.js: ink #3a3f44 whose alpha fades from 0.95 nearest to 0.45
farthest, an ink stroke of width wpx + 1.5 under a white stroke of width wpx, widths clamped to
1.2…6 px. Rendered at 2× and downsampled. Rerun after regenerating hal.json, then node tools/versions.py.
"""
import json, sys
from PIL import Image, ImageDraw

INK = (0x3a, 0x3f, 0x44)
A_NEAR, A_FAR = 0.95, 0.45
W_MIN, W_MAX = 1.2, 6.0
S = 2                                                     # supersampling

src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
W, H = d['w'] * S, d['h'] * S
depths = [m[5] for m in d['members']]
d0, d1 = min(depths), max(depths)
im = Image.new('RGBA', (W, H), (255, 255, 255, 255))
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
dr = ImageDraw.Draw(layer)
for i in d['depthOrder']:
    x1, y1, x2, y2, wpx, depth = d['members'][i]
    w = max(W_MIN, min(W_MAX, wpx))
    a = int(255 * (A_NEAR - (A_NEAR - A_FAR) * (depth - d0) / (d1 - d0)))
    pts = [(x1 * S, y1 * S), (x2 * S, y2 * S)]
    dr.line(pts, fill=INK + (a,), width=max(1, round((w + 1.5) * S)))
    if w >= 2:
        dr.line(pts, fill=(255, 255, 255, a), width=max(1, round(w * S)))
im.alpha_composite(layer)
im = im.convert('L').resize((d['w'], d['h']), Image.LANCZOS)
im.save(out, quality=90)
print(f"{d['w']}x{d['h']} -> {out}")
