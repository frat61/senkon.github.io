# The Senkon logo as a vector, traced by hand from the original artwork (local/senkonlogo-source.png, 468x457;
# coordinates below are its pixels). Writes
#   assets/senkon/logo.svg          the full logo: mammoth and SENKON
#   assets/senkon/logo-lockup.svg   the header lockup: mammoth with SENKON / MÜHENDİSLİK beside it
# and inlines the lockup into index.html between <!-- logo-lockup --> and <!-- /logo-lockup -->, where
# assets/senkon/logo-sketch.js draws it. Letters come from tools/logo-letters.json (tools/make-logo-letters.py).
# The sketch look is generated: construction lines are outline edges extended past their ends plus the faint
# lines detected in the original, overshoots are a thin second pass past every corner, and the facets carry
# hatching. Seeds are fixed, so the output is deterministic. No dependencies:  python tools/make-logo-svg.py
import json, math, os, random, re

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'senkon')
INK, WORD, ORANGE, GREEN, GREY = '#2c4a5c', '#265866', '#c69a87', '#97b4a4', '#7f8a90'

# thick outline strokes, each a polyline, in the order the pen draws them: back, head, trunk, tusks, body, legs, ground
OUTLINE = {
 'back':      [(101,151),(204,86),(218,86)],
 'head':      [(218,86),(222,68),(254,50),(261,45),(282,52),(287,69),(298,97),(322,111),(331,155),(330,178)],
 'headleft':  [(218,86),(216,91),(211,104),(211,121)],
 'trunkOut':  [(299,176),(315,248),(337,259),(356,243)],
 'trunkIn':   [(330,178),(328,194),(324,231),(343,249),(356,243)],
 'orangeT':   [(170,110),(205,88)],
 'orangeL':   [(170,110),(225,216)],
 'orangeR':   [(211,121),(252,172),(225,216)],
 'rump':      [(101,151),(91,176)],
 'hind1':     [(91,176),(72,233),(63,293)],
 'hind1b':    [(93,176),(91,227),(75,276),(67,291)],
 'hind1c':    [(118,250),(98,278),(107,295)],
 'belly':     [(118,250),(132,236),(192,217)],
 'hind2top':  [(141,238),(170,238)],
 'hind2a':    [(135,237),(142,259),(147,293)],
 'hind2b':    [(172,239),(163,272),(179,296)],
 'front1':    [(193,221),(206,294),(242,293),(229,276),(230,239),(225,217)],
 'front2c':   [(283,155),(273,196)],
 'front2a':   [(283,155),(236,207),(250,224),(274,259)],
 'front2b':   [(273,196),(300,257),(280,294),(251,277),(274,259)],
 'ground1':   [(63,294),(132,294)],
 'ground2':   [(144,295),(179,295)],
 'ground3':   [(206,293),(234,293)],
 'ground4':   [(326,295),(392,295)],
}
TUSKS = {  # each tusk is a crescent: thick outer arc root->tip, thinner inner edge tip->root
 'tuskBigOut':   'M305,158 A50,50 0 1 0 401,131',
 'tuskBigIn':    'M401,131 C396,170 372,192 340,189 C330,188 320,184 312,178',
 'tuskSmallOut': 'M310,168 A37,37 0 1 0 370,128',
 'tuskSmallIn':  'M370,128 C372,152 360,174 342,180 C334,182 326,180 320,174',
}
INNER = [  # thinner facet lines
 [(240,63),(275,55)], [(279,53),(323,114)], [(205,88),(234,89)], [(211,113),(233,96)], [(251,106),(248,160)],
 [(281,109),(288,103)], [(199,165),(227,214)], [(229,222),(247,221)], [(234,239),(248,226)], [(252,223),(259,212)],
 [(230,218),(260,184)], [(272,197),(248,221)], [(283,155),(312,189)], [(167,229),(190,224)], [(170,238),(193,228)],
 [(89,266),(95,274)], [(90,198),(77,236)], [(88,214),(85,232)], [(212,118),(245,150)], [(272,254),(280,273)],
]
FILLS = {  # facet polygon, colour, hatching step
 'orange': ([(170,110),(205,88),(211,121),(252,172),(225,216)], ORANGE, 11),
 'green1': ([(283,155),(236,207),(250,224),(274,259),(300,257),(273,196)], GREEN, 9),
 'green2': ([(141,238),(170,238),(163,272),(142,260)], GREEN, 9),
}
MARKS = [  # ticks, rules and a big arc, as in the original
 [(40,80),(80,80)], [(60,58),(60,102)], [(275,30),(330,30)], [(295,18),(295,48)],
 [(40,307),(430,307)], [(150,420),(310,420)], [(40,296),(110,296)], [(215,308),(410,308)],
]
ARC = 'M292,14 A152,152 0 0 1 398,292'
CIRCLES = [(113,54,3.5),(255,25,2.5),(430,210,3.5)]
# faint straight lines detected in the original's grey scaffolding (x1, y1, x2, y2)
GREY_LINES = [(407, 308, 217, 308), (169, 73, 248, 30), (326, 76, 440, 133), (324, 295, 256, 295), (42, 308, 106, 308), (181, 295, 239, 295), (193, 85, 108, 82), (67, 208, 66, 118), (117, 72, 155, 50), (342, 58, 313, 88), (127, 185, 110, 221), (103, 149, 67, 167), (129, 215, 181, 184), (91, 187, 120, 249), (163, 107, 128, 108), (140, 171, 170, 150), (226, 224, 216, 258), (126, 222, 158, 222), (292, 143, 277, 114), (182, 186, 189, 217), (190, 215, 203, 187), (407, 98, 388, 75), (395, 87, 410, 113), (370, 267, 397, 249), (80, 287, 92, 260), (168, 106, 168, 53), (348, 244, 319, 244), (316, 272, 342, 280), (108, 222, 107, 194), (164, 118, 136, 168), (239, 85, 250, 60), (324, 75, 300, 63), (261, 85, 274, 61), (216, 264, 224, 290), (393, 226, 404, 202), (124, 219, 127, 193), (352, 226, 327, 226), (214, 257, 196, 235), (268, 125, 251, 142), (247, 29, 223, 30), (63, 295, 38, 295), (64, 196, 64, 219), (298, 58, 298, 34), (64, 236, 64, 259), (130, 95, 151, 84), (310, 111, 299, 91), (404, 296, 427, 296), (242, 109, 219, 109), (278, 51, 265, 33), (276, 61, 291, 77), (312, 139, 328, 155), (200, 82, 204, 60), (409, 227, 397, 246), (216, 217, 194, 220), (419, 143, 421, 164), (322, 31, 301, 31), (194, 223, 216, 223), (172, 150, 192, 159), (271, 270, 281, 288), (119, 257, 117, 277), (287, 223, 307, 223), (326, 155, 306, 155), (239, 84, 227, 68), (95, 84, 77, 92), (186, 140, 178, 122), (308, 91, 327, 93), (172, 307, 153, 307), (49, 235, 68, 234), (131, 270, 118, 284), (116, 253, 100, 244), (391, 184, 374, 192), (350, 281, 368, 276), (151, 136, 133, 132)]

def P(pts): return ' '.join(f'{x},{y}' for x, y in pts)

def construction():
    """Outline edges extended past their ends, deterministic."""
    rnd = random.Random(7)
    edges = [(p[i], p[i+1]) for p in OUTLINE.values() for i in range(len(p)-1)]
    edges = [e for e in edges if math.hypot(e[1][0]-e[0][0], e[1][1]-e[0][1]) >= 28]
    rnd.shuffle(edges)
    out = []
    for a, b in edges[:44]:
        ux, uy = b[0]-a[0], b[1]-a[1]; L = math.hypot(ux, uy); ux /= L; uy /= L
        e0, e1 = rnd.uniform(30, 150), rnd.uniform(30, 150)
        if rnd.random() < 0.35: e0 = 0
        cl = lambda p: (min(max(p[0], 8), 460), min(max(p[1], 8), 312))
        out.append([cl((a[0]-ux*e0, a[1]-uy*e0)), cl((b[0]+ux*e1, b[1]+uy*e1))])
    return out

def overshoots():
    """A thin second pass past both ends of every outline edge, like a hand that does not stop at the corner."""
    rnd = random.Random(11); out = []
    for pts in OUTLINE.values():
        for i in range(len(pts)-1):
            a, b = pts[i], pts[i+1]; ux, uy = b[0]-a[0], b[1]-a[1]; L = math.hypot(ux, uy)
            if L < 14: continue
            ux /= L; uy /= L; e0, e1 = rnd.uniform(3, 9), rnd.uniform(3, 9); n = rnd.uniform(-1.6, 1.6)
            out.append(((a[0]-ux*e0-uy*n, a[1]-uy*e0+ux*n), (b[0]+ux*e1-uy*n, b[1]+uy*e1+ux*n)))
    return out

def mark():
    """The mammoth: every group the sketch script draws, in drawing order."""
    o = [f'<g id="cons" fill="none" stroke="{GREY}" stroke-width="0.9" stroke-linecap="round" opacity="0.5">']
    for a, b in construction() + [[(s[0], s[1]), (s[2], s[3])] for s in GREY_LINES] + MARKS:
        o.append(f'<line x1="{a[0]:.0f}" y1="{a[1]:.0f}" x2="{b[0]:.0f}" y2="{b[1]:.0f}"/>')
    o.append(f'<path d="{ARC}"/>')
    for cx, cy, r in CIRCLES: o.append(f'<circle cx="{cx}" cy="{cy}" r="{r}"/>')
    o.append('</g>')
    o.append('<g id="fills" stroke="none" opacity="0.9">')
    for k, (pts, col, _) in FILLS.items(): o.append(f'<polygon id="{k}" points="{P(pts)}" fill="{col}"/>')
    o.append('</g>')
    o.append(f'<g id="inner" fill="none" stroke="{INK}" stroke-width="1.4" stroke-linecap="round" opacity="0.85">')
    for a, b in INNER: o.append(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}"/>')
    o.append('</g>')
    o.append(f'<g id="over" fill="none" stroke="{INK}" stroke-width="0.8" stroke-linecap="round" opacity="0.5">')
    for a, b in overshoots(): o.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}"/>')
    o.append('</g>')
    o.append(f'<g id="hatch" fill="none" stroke="{INK}" stroke-width="0.7" stroke-linecap="round" opacity="0.45">')
    for k, (pts, _, step) in FILLS.items():                     # diagonal strokes clipped to the facet
        o.append(f'<clipPath id="clip-{k}"><polygon points="{P(pts)}"/></clipPath>')
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        for c in range(int(x0 + y0) - 40, int(x1 + y1) + 40, step):
            o.append(f'<line clip-path="url(#clip-{k})" x1="{c - y0 + 20}" y1="{y0 - 20}" x2="{c - y1 - 20}" y2="{y1 + 20}"/>')
    o.append('</g>')
    o.append(f'<g id="ink" fill="none" stroke="{INK}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">')
    for k, pts in OUTLINE.items(): o.append(f'<polyline id="{k}" points="{P(pts)}"/>')
    for k, d in TUSKS.items(): o.append(f'<path id="{k}" d="{d}"' + (' stroke-width="1.8"' if k.endswith('In') else '') + '/>')
    o.append('</g>')
    return o

def word(letters):
    return [f'<g id="word" fill="{WORD}">'] + [f'<path id="{i}" d="{d}"/>' for i, d in letters] + ['</g>']

def svg(viewbox, body, attrs=''):
    return '\n'.join([f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}"{attrs}>'] + body + ['</svg>']) + '\n'

if __name__ == '__main__':
    letters = json.load(open(os.path.join(ROOT, 'tools', 'logo-letters.json'), encoding='utf-8'))
    full = svg('0 0 468 457', mark() + word(letters['wordmark']), ' width="468" height="457"')
    lockup_box = f'8 8 {letters["lockup_right"]} 304'
    lockup = svg(lockup_box, mark() + word(letters['lockup']))
    with open(os.path.join(OUT, 'logo.svg'), 'w', encoding='utf-8', newline='\n') as f: f.write(full)
    with open(os.path.join(OUT, 'logo-lockup.svg'), 'w', encoding='utf-8', newline='\n') as f: f.write(lockup)

    # inline the lockup into the home page header; the class and aria attributes are what the sketch script and the link expect
    page = os.path.join(ROOT, 'index.html')
    html = open(page, encoding='utf-8', newline='').read()
    inline = lockup.replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg class="logo-sketch" aria-hidden="true" focusable="false"', 1).rstrip('\n')
    new, n = re.subn(r'<!-- logo-lockup -->.*?<!-- /logo-lockup -->', lambda m: '<!-- logo-lockup -->\n' + inline + '\n<!-- /logo-lockup -->', html, count=1, flags=re.S)
    if not n: raise SystemExit('index.html has no <!-- logo-lockup --> markers')
    if new != html: open(page, 'w', encoding='utf-8', newline='').write(new)
    print(f'logo.svg {len(full)} bytes, logo-lockup.svg {len(lockup)} bytes (viewBox {lockup_box}), inlined into index.html')
