"""The finished steel hall as a still picture, for visitors without JavaScript or with reduced motion.

Usage: python tools/make-hall-still.py assets/senkon/hal.json assets/senkon/hal.webp
       python tools/make-hall-still.py --resize assets/senkon/hal.webp      only the phone sizes, from the still as it is

Beside the still it writes hal-640.webp and hal-960.webp, the sizes a phone (300 px wide on screen) and a
desktop (400 px) actually show it at, so the pages' srcset lets each screen download only what it needs.

Reads the format-2 hal.json written by tools/make-hall.js (members in metres, the camera and its framing),
projects every member with the camera the way assets/senkon/hal.js does (spec section 3), draws them in
depth order, far to near, with the stroke rules of hal.js: ink #3a3f44 whose alpha fades from 0.95 nearest
to 0.45 farthest, an ink stroke of width wpx + 1.5 under a white stroke of width wpx (white only from
2 px), widths clamped to 1.2…6 px. Rendered at 2× and downsampled. Rerun after regenerating hal.json, then
node tools/versions.js.
"""
import json, math, sys
from PIL import Image, ImageDraw

INK = (0x3a, 0x3f, 0x44)
A_NEAR, A_FAR = 0.95, 0.45
W_MIN, W_MAX = 1.2, 6.0
S = 2                                                     # supersampling

def sub(a, b): return [a[i] - b[i] for i in range(3)]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def norm(a):
    l = math.hypot(*a) or 1
    return [c / l for c in a]

SIZES = (640, 960)

def resize(out):
    """hal-640.webp and hal-960.webp beside the still, the same drawing scaled down."""
    im = Image.open(out)
    for w in SIZES:
        h = round(im.height * w / im.width)
        name = out[:-5] + f'-{w}.webp'
        im.resize((w, h), Image.LANCZOS).save(name, quality=90)
        print(f"{w}x{h} -> {name}")

if sys.argv[1] == '--resize':
    resize(sys.argv[2])
    sys.exit()

src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
if d.get('v') not in (2, 3):
    sys.exit('expected a format-2 or format-3 hal.json')
cam, W0, H0 = d['cam'], d['w'], d['h']
fwd = norm(sub(cam['at'], cam['eye'])); right = norm(cross(fwd, [0, 1, 0])); up = cross(right, fwd)

def project(p):
    v = sub(p, cam['eye']); depth = dot(v, fwd); f = cam['focal'] * W0 / 2 / depth
    return ((W0 / 2 + dot(v, right) * f) * cam['s'] + cam['dx'], (H0 / 2 - dot(v, up) * f) * cam['s'] + cam['dy'], depth)

rows = []
for m in d['members']:
    x1, y1, z1 = project(m[0:3]); x2, y2, z2 = project(m[3:6])
    depth = (z1 + z2) / 2
    rows.append((depth, x1, y1, x2, y2, m[6] * cam['focal'] * W0 / 2 / depth * cam['s']))
rows.sort(key=lambda r: -r[0])                            # far to near
d0, d1 = min(r[0] for r in rows), max(r[0] for r in rows)

W, H = W0 * S, H0 * S
im = Image.new('RGBA', (W, H), (255, 255, 255, 255))
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
dr = ImageDraw.Draw(layer)
for depth, x1, y1, x2, y2, wpx in rows:
    w = max(W_MIN, min(W_MAX, wpx))
    a = int(255 * (A_NEAR - (A_NEAR - A_FAR) * (depth - d0) / (d1 - d0)))
    pts = [(x1 * S, y1 * S), (x2 * S, y2 * S)]
    dr.line(pts, fill=INK + (a,), width=max(1, round((w + 1.5) * S)))
    if w >= 2:
        dr.line(pts, fill=(255, 255, 255, a), width=max(1, round(w * S)))
im.alpha_composite(layer)
im = im.convert('L').resize((W0, H0), Image.LANCZOS)
im.save(out, quality=90)
print(f"{W0}x{H0} -> {out}")
resize(out)
