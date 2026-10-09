"""Re-space the buildings of a skyline drawing with a uniform gap, and optionally insert extra
single-building drawings, then write a new picture of the same size.

Usage: python tools/compose-skyline.py <in.webp> <out.webp> [--gap 40] [--margin 24]
         [--insert index:file.png:height_px ...] [--split x1,x2] [--drop i,j,...]
       python tools/compose-skyline.py --blank WxH <out.webp> --insert 0:file.png:height_px [--margin 24]

The source is black ink on white with one ground line. Buildings are found the same way as in
measure-skyline.py (ink columns above the ground line, split by white gaps; --split forces a cut).
Each building is cut out above the ground line and pasted back at a new x with the given gap; if the
row does not fit, every cut-out is scaled down to fit. --drop leaves out buildings by their 0-based
index in the source (counted before any insert). --insert places another drawing (alone on
white, any size) before building <index> (0-based), scaled to <height_px> above the ground line.
--blank starts from an empty canvas of that size with a ground line 30 px above the bottom, for a
picture made only of inserted drawings. Empty sky above the tallest building is trimmed, so the output can be shorter than the input;
update the width/height attributes of the <img> in index.html to the printed size.
Run measure-skyline.py on the result to write skyline.json.
"""
import sys
from PIL import Image, ImageDraw

DARK, GAP, MIN_W, BASE, PAD = 232, 6, 12, 24, 5

def columns(im, splits=()):
    w, h = im.size; px = im.load()
    rows = [sum(1 for x in range(w) if px[x, y] < DARK) for y in range(h)]
    ground = max(range(h * 2 // 3, h), key=lambda y: rows[y])
    top = [None] * w
    for x in range(w):
        for y in range(0, ground - BASE):
            if px[x, y] < DARK: top[x] = y; break
    for x in splits: top[x] = None
    runs, x = [], 0
    while x < w:
        if top[x] is None: x += 1; continue
        x0, x1 = x, x
        while x < w:
            if top[x] is not None: x1 = x; x += 1
            else:
                nxt = x
                while nxt < w and top[nxt] is None: nxt += 1
                if nxt - x > GAP or any(x <= s < nxt for s in splits): break
                x = nxt
        if x1 - x0 + 1 >= MIN_W: runs.append((x0, x1))
        x = max(x, x1 + 1)
    return ground, runs

def crop_ink(im):
    """Bounding box of the ink in a stand-alone drawing (white background)."""
    g = im.convert('L').point(lambda v: 0 if v < 235 else 255)
    box = g.point(lambda v: 255 - v).getbbox()
    return im.crop(box) if box else im

args = sys.argv[1:]
def opt(name, default):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
gap = int(opt('--gap', 40)); margin = int(opt('--margin', 24))
splits = {int(v) for v in opt('--split', '').split(',') if v}
drops = {int(v) for v in opt('--drop', '').split(',') if v}
inserts = []
while '--insert' in args:
    i = args.index('--insert'); idx, f, hpx = args[i + 1].split(':'); del args[i:i + 2]
    inserts.append((int(idx), f, int(hpx)))
blank = opt('--blank', '')
if blank:
    out = args[0]; w, h = (int(v) for v in blank.lower().split('x')); ground, pieces = h - 30, []
else:
    src, out = args[0], args[1]
    im = Image.open(src).convert('L')
    w, h = im.size
    ground, runs = columns(im, splits)
    pieces = [im.crop((max(0, x0 - PAD), 0, min(w, x1 + 1 + PAD), ground)) for i, (x0, x1) in enumerate(runs) if i not in drops]   # above the ground line
for idx, f, hpx in sorted(inserts, reverse=True):
    extra = crop_ink(Image.open(f).convert('L'))
    scale = hpx / extra.height
    extra = extra.resize((max(1, round(extra.width * scale)), hpx), Image.LANCZOS)
    pieces.insert(idx, extra)

total = sum(p.width for p in pieces) + gap * (len(pieces) - 1) + 2 * margin
f = min(1.0, (w - 2 * margin - gap * (len(pieces) - 1)) / sum(p.width for p in pieces))
if f < 1: pieces = [p.resize((max(1, round(p.width * f)), max(1, round(p.height * f))), Image.LANCZOS) for p in pieces]

canvas = Image.new('L', (w, h), 255)
x = margin
for p in pieces:
    canvas.paste(p, (x, ground - p.height))
    x += p.width + gap
d = ImageDraw.Draw(canvas)
d.line([(margin // 2, ground), (w - margin // 2, ground)], fill=0, width=3 if blank else 2)
sky = ground - max(p.height for p in pieces) - 16          # trim empty sky so the band keeps its height
if sky > 0: canvas = canvas.crop((0, sky, w, h)); ground -= sky
canvas.save(out, quality=92)
print(f'{len(pieces)} buildings, gap {gap}px, scale {f:.3f}, size {canvas.width}x{canvas.height}, ground {ground} -> {out}')
