"""Measure the building columns of a skyline drawing (black ink on white).

Usage: python tools/measure-skyline.py <image> <out.json> [names.txt] [--split x1,x2,...]

--split forces a boundary at the given x pixels, for neighbours that touch.

Finds the ground line (the row with the most ink), then splits the columns
above it into separate buildings wherever a horizontal gap of white wider
than GAP pixels appears. Writes image size, ground line and one record per
building (x0, x1, top, optional name) in image pixels. Re-run whenever the
picture changes; assets/senkon/skyline.js reads the result.
"""
import json, sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')   # Turkish names on a Windows console

DARK = 232      # gray level below which a pixel counts as ink (light hatching included)
PAD = 5         # pixels added on each side of a building so faint edges are not trimmed
GAP = 6         # white columns needed to separate two buildings
MIN_W = 12      # narrower runs are noise (stray hatching)
BASE = 24       # pixels above the ground line ignored when splitting (base clutter, plinths)

args = sys.argv[1:]
splits = set()
if '--split' in args:
    i = args.index('--split'); splits = {int(v) for v in args[i + 1].split(',')}; del args[i:i + 2]
src, out = args[0], args[1]
names = [l.strip() for l in open(args[2], encoding='utf-8')] if len(args) > 2 else []
im = Image.open(src).convert('L')
w, h = im.size
px = im.load()

rows = [sum(1 for x in range(w) if px[x, y] < DARK) for y in range(h)]
ground = max(range(h * 2 // 3, h), key=lambda y: rows[y])   # ground line sits in the lower third

top = [None] * w
for x in range(w):
    for y in range(0, ground - BASE):
        if px[x, y] < DARK:
            top[x] = y
            break
for x in splits: top[x] = None   # forced boundary

runs, x = [], 0
while x < w:
    if top[x] is None:
        x += 1; continue
    x0, x1 = x, x
    while x < w:
        if top[x] is not None:
            x1 = x; x += 1
        else:
            nxt = x
            while nxt < w and top[nxt] is None: nxt += 1
            if nxt - x > GAP or any(x <= s0 < nxt for s0 in splits): break
            x = nxt
    if x1 - x0 + 1 >= MIN_W:
        runs.append({'x0': x0, 'x1': x1, 'top': min(t for t in top[x0:x1 + 1] if t is not None)})
    x = max(x, x1 + 1)

for i, r in enumerate(runs):
    lo = runs[i - 1]['x1'] + 1 if i else 0
    hi = runs[i + 1]['x0'] - 1 if i + 1 < len(runs) else w - 1
    r['x0'] = max(lo, r['x0'] - PAD); r['x1'] = min(hi, r['x1'] + PAD)
    if i < len(names): r['name'] = names[i]
json.dump({'w': w, 'h': h, 'ground': ground, 'cols': runs}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{w}x{h} ground={ground} buildings={len(runs)}')
for r in runs: print(f"  {r.get('name','?'):28s} x {r['x0']:4d}-{r['x1']:4d}  top {r['top']}")
