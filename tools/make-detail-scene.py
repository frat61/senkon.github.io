"""Scene 04 of the Tasarım story ("Birleşim detayları") drawn from the sample sheet's own detail, so the story
picture and the Örnek pafta show the same joint. Reads tools/pafta/detail.svg, renders only its line work (the
main view in the scale(0.1) group and the section A–A: members, plates, bolts, welds, centre lines, hatching;
no text, no dimensions, no leaders) and writes a 1536×1152 PNG, the size ChatGPT gives the other scenes.
Then convert it like the others:
    python tools/make-detail-scene.py local/tasarim-surec-src/04.png
    python tools/make-surec.py --dir assets/senkon/tasarim-surec local/tasarim-surec-src/04.png 4
Needs Pillow. The renderer understands the SVG subset the fragment uses: g/path/rect/circle with translate,
scale and rotate transforms, stroke-width, stroke-dasharray, fill="#000" / "#fff" / the hatch pattern."""
import math
import os
import re
import sys
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'tools', 'pafta', 'detail.svg')
W, H, SS = 1536, 1152, 3                 # output size and supersampling
INK = 1.35                               # line weights a little heavier than on the sheet: it is read as a picture

# ---- affine transforms as 3×3 matrices (a, b, c, d, e, f) like SVG
def mul(m, n):
    a, b, c, d, e, f = m
    g, h, i, j, k, l = n
    return (a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f)

def apply(m, x, y):
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)

def parse_transform(s):
    m = (1, 0, 0, 1, 0, 0)
    for name, args in re.findall(r'(\w+)\(([^)]*)\)', s or ''):
        v = [float(t) for t in re.split(r'[\s,]+', args.strip()) if t]
        if name == 'translate': t = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == 'scale': t = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif name == 'rotate':
            r = math.radians(v[0]); cs, sn = math.cos(r), math.sin(r)
            t = (cs, sn, -sn, cs, 0, 0)
            if len(v) == 3: t = mul(mul((1, 0, 0, 1, v[1], v[2]), t), (1, 0, 0, 1, -v[1], -v[2]))
        else: raise ValueError('transform ' + name)
        m = mul(m, t)
    return m

def scale_of(m):
    a, b, c, d, e, f = m
    return math.sqrt(abs(a * d - b * c))

# ---- path data: M L H V Z and their relative forms, into a list of polylines (closed flag)
def parse_path(d):
    toks = re.findall(r'[MLHVZmlhvz]|-?\d*\.?\d+(?:e-?\d+)?', d)
    polys, cur, pos, start, cmd, i = [], [], (0, 0), (0, 0), None, 0
    def num(): nonlocal i; i += 1; return float(toks[i - 1])
    while i < len(toks):
        t = toks[i]
        if t.isalpha(): cmd = t; i += 1
        if cmd in 'Zz':
            if cur: polys.append((cur, True)); cur = []
            pos = start; continue
        if cmd in 'Mm':
            x, y = num(), num()
            if cmd == 'm': x, y = pos[0] + x, pos[1] + y
            if cur: polys.append((cur, False))
            cur = [(x, y)]; pos = start = (x, y); cmd = 'L' if cmd == 'M' else 'l'; continue
        if cmd in 'Ll':
            x, y = num(), num()
            if cmd == 'l': x, y = pos[0] + x, pos[1] + y
        elif cmd in 'Hh':
            x = num(); x = pos[0] + x if cmd == 'h' else x; y = pos[1]
        elif cmd in 'Vv':
            y = num(); y = pos[1] + y if cmd == 'v' else y; x = pos[0]
        else: raise ValueError('path command ' + str(cmd))
        cur.append((x, y)); pos = (x, y)
    if cur: polys.append((cur, False))
    return polys

# ---- the drawing
class Sheet:
    """Draws in sheet millimetres onto a supersampled canvas; px = origin + mm × k."""
    def __init__(self, k, ox, oy):
        self.img = Image.new('L', (W * SS, H * SS), 255)
        self.d = ImageDraw.Draw(self.img)
        self.k, self.ox, self.oy = k * SS, ox * SS, oy * SS
    def px(self, p): return (self.ox + p[0] * self.k, self.oy + p[1] * self.k)
    def width(self, w_mm): return max(1, round(w_mm * INK * self.k))
    def line(self, pts, w_mm, dash=None):
        if dash:
            pts = self.dashed(pts, dash)
            for seg in pts: self.d.line([self.px(seg[0]), self.px(seg[1])], fill=0, width=self.width(w_mm))
            return
        self.d.line([self.px(p) for p in pts], fill=0, width=self.width(w_mm), joint='curve')
    def dashed(self, pts, dash):
        out, pat, pi, left, on = [], dash, 0, dash[0], True
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            L = math.hypot(x1 - x0, y1 - y0)
            if L == 0: continue
            ux, uy, t = (x1 - x0) / L, (y1 - y0) / L, 0.0
            while t < L:
                step = min(left, L - t)
                if on: out.append(((x0 + ux * t, y0 + uy * t), (x0 + ux * (t + step), y0 + uy * (t + step))))
                t += step; left -= step
                if left <= 1e-9: pi = (pi + 1) % len(pat); left = pat[pi]; on = not on
        return out
    def fill(self, pts, grey):
        self.d.polygon([self.px(p) for p in pts], fill=grey)
    def hatch(self, polys, spacing_mm, w_mm):
        mask = Image.new('L', self.img.size, 0); md = ImageDraw.Draw(mask)
        for pts in polys: md.polygon([self.px(p) for p in pts], fill=255)
        layer = Image.new('L', self.img.size, 255); ld = ImageDraw.Draw(layer)
        box = mask.getbbox()
        if not box: return
        x0, y0, x1, y1 = box; s = spacing_mm * self.k; n = int((x1 - x0 + y1 - y0) / s) + 2
        for i in range(-n, n):            # 45° lines, down-right to up-left as the pattern rotates them
            c = x0 + i * s * math.sqrt(2)
            ld.line([(c, y0), (c + (y1 - y0), y1)], fill=0, width=self.width(w_mm))
        self.img.paste(layer, (0, 0), mask)

def walk(el, m, sheet, inside):
    """inside: within one of the scale(0.1) view groups (the only line work we keep)."""
    tag = el.tag.split('}')[-1]
    if tag in ('text', 'defs'): return
    m = mul(m, parse_transform(MOVE.get(el.get('transform'), el.get('transform'))))
    if tag == 'g' and 'scale(0.1)' in (el.get('transform') or ''): inside = True
    if not inside:
        for ch in el: walk(ch, m, sheet, inside)
        return
    sw = float(el.get('stroke-width', el.attrib.get('data-sw', '5'))) if el.get('stroke-width') else None
    if sw is None:                       # inherit: look up the ancestors we passed through
        sw = inherited.get('sw', 5)
    fill = el.get('fill', inherited.get('fill', 'none'))
    dash = el.get('stroke-dasharray')
    k_local = scale_of(m)                # user units of this element → sheet mm
    w_mm = sw * k_local
    dash_mm = [float(t) * k_local for t in dash.split()] if dash else None
    if tag == 'g':
        saved = dict(inherited); inherited['sw'] = sw; inherited['fill'] = fill
        for ch in el: walk(ch, m, sheet, inside)
        inherited.clear(); inherited.update(saved); return
    shapes = []
    if tag == 'path': shapes = parse_path(el.get('d'))
    elif tag == 'rect':
        x, y, w, h = (float(el.get(a, '0')) for a in ('x', 'y', 'width', 'height'))
        shapes = [([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], True)]
    elif tag == 'circle':
        cx, cy, r = (float(el.get(a, '0')) for a in ('cx', 'cy', 'r'))
        shapes = [([(cx + r * math.cos(a), cy + r * math.sin(a)) for a in [i * math.pi / 18 for i in range(36)]], True)]
    else: raise ValueError('element ' + tag)
    polys = [([apply(m, *p) for p in pts], closed) for pts, closed in shapes]
    if fill.startswith('url('):
        sheet.hatch([pts for pts, c in polys], 1.5, 0.18); fill = 'none'
    if fill == '#fff':
        for pts, c in polys: sheet.fill(pts, 255)
    elif fill == '#000':
        for pts, c in polys: sheet.fill(pts, 0)
    if el.get('stroke', inherited.get('stroke', '#000')) != 'none' and fill != '#000':
        for pts, closed in polys:
            sheet.line(pts + ([pts[0]] if closed else []), w_mm, dash_mm)

inherited = {}
# the section A–A sits under the frame on the sheet; in the picture it stands beside the elevation, centred on it
MOVE = {'translate(-199 57)': 'translate(-180 -20)'}

def bounds(el, m, acc, inside):
    tag = el.tag.split('}')[-1]
    if tag in ('text', 'defs'): return
    m = mul(m, parse_transform(MOVE.get(el.get('transform'), el.get('transform'))))
    if tag == 'g' and 'scale(0.1)' in (el.get('transform') or ''): inside = True
    if tag == 'g' or not inside:
        for ch in el: bounds(ch, m, acc, inside)
        return
    pts = []
    if tag == 'path':
        for p, c in parse_path(el.get('d')): pts += p
    elif tag == 'rect':
        x, y, w, h = (float(el.get(a, '0')) for a in ('x', 'y', 'width', 'height')); pts = [(x, y), (x + w, y + h)]
    elif tag == 'circle':
        cx, cy, r = (float(el.get(a, '0')) for a in ('cx', 'cy', 'r')); pts = [(cx - r, cy - r), (cx + r, cy + r)]
    if el.get('fill') == '#fff': return          # masks do not count
    for x, y in pts:
        X, Y = apply(m, x, y); acc[0] = min(acc[0], X); acc[1] = min(acc[1], Y); acc[2] = max(acc[2], X); acc[3] = max(acc[3], Y)

def main(out):
    svg = '<svg xmlns="http://www.w3.org/2000/svg">' + open(SRC, encoding='utf-8').read() + '</svg>'
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S)
    root = ET.fromstring(svg)
    acc = [1e9, 1e9, -1e9, -1e9]
    for ch in root: bounds(ch, (1, 0, 0, 1, 0, 0), acc, False)
    x0, y0, x1, y1 = acc
    margin = 14                                                   # sheet mm of white around the drawing
    k = min(W / (x1 - x0 + 2 * margin), H / (y1 - y0 + 2 * margin))
    ox = (W - (x1 - x0) * k) / 2 - x0 * k; oy = (H - (y1 - y0) * k) / 2 - y0 * k
    sheet = Sheet(k, ox, oy)
    for ch in root: walk(ch, (1, 0, 0, 1, 0, 0), sheet, False)
    img = sheet.img.resize((W, H), Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    img.save(out)
    print(out, W, 'x', H, 'drawing %.0f x %.0f sheet mm at %.2f px/mm' % (x1 - x0, y1 - y0, k))

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'local', 'tasarim-surec-src', '04.png'))
