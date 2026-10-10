# Letter outlines for the logo and the header lockup, as SVG path data in tools/logo-letters.json, which
# tools/make-logo-svg.py reads. Set from the site's own Work Sans variable font (assets/senkon/fonts) so the
# vector carries no font dependency: SENKON at weight 700 condensed into the letter boxes of the original
# artwork (local/senkonlogo-source.png: caps 69 px tall on a baseline at y=392), and for the lockup the same
# SENKON smaller with MÜHENDİSLİK under it at weight 600, tracked so both lines are the same width.
# Needs fonttools and brotli (pip install fonttools brotli). Rerun only when the lettering changes:
#   python tools/make-logo-letters.py
import json, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.join(os.path.dirname(__file__), '..')
FONTS = os.path.join(ROOT, 'assets', 'senkon', 'fonts')
FILES = ('work-sans-latin-1dd49afc.woff2', 'work-sans-latin-ext-2aa17fc7.woff2')   # Ü is in the first, İ in the second
BOXES = [(43, 91), (102, 146), (159, 212), (228, 284), (285, 351), (364, 418)]     # x extent of S E N K O N in the original
CAP0, BASE0 = 69.0, 392                                                            # the original's cap height and baseline

fonts = {}
def glyph(ch, weight):
    for file in FILES:
        key = (file, weight)
        if key not in fonts: fonts[key] = instantiateVariableFont(TTFont(os.path.join(FONTS, file)), {'wght': weight})
        f = fonts[key]; gid = f.getBestCmap().get(ord(ch))
        if gid: return f, f.getGlyphSet()[gid]
    raise KeyError(ch)

def bounds(f, g):
    bp = BoundsPen(f.getGlyphSet()); g.draw(bp); return bp.bounds[0], bp.bounds[2]

def path(f, g, kx, ky, x, base):
    pen = SVGPathPen(f.getGlyphSet(), ntos=lambda v: f'{v:.1f}')
    g.draw(TransformPen(pen, (kx, 0, 0, -ky, x, base))); return pen.getCommands()

def senkon(x0, cap, base):
    """SENKON at a cap height, left edge x0, each letter condensed into its box from the original."""
    k = cap / CAP0; out = []
    for i, ch in enumerate(('S', 'E', 'N', 'K', 'O', 'N')):
        f, g = glyph(ch, 700); xmin, xmax = bounds(f, g); b0, b1 = BOXES[i]
        kx = (b1 - b0 + 1) * k / (xmax - xmin)
        out.append([f'L{i}', path(f, g, kx, cap / f['OS/2'].sCapHeight, x0 + (b0 - BOXES[0][0]) * k - xmin * kx, base)])
    return out, (BOXES[-1][1] - BOXES[0][0] + 1) * k

def line2(text, x0, cap, base, width):
    """A tracked line of caps at weight 600, letters spread so the line is exactly `width` wide."""
    gl = [glyph(ch, 600) for ch in text]
    k = cap / gl[0][0]['OS/2'].sCapHeight
    ext = [tuple(v * k for v in bounds(f, g)) for f, g in gl]
    track = (width - sum(b - a for a, b in ext)) / (len(text) - 1)
    out, x = [], x0
    for i, ((f, g), (a, b)) in enumerate(zip(gl, ext)):
        out.append([f'M{i}', path(f, g, k, k, x - a, base)]); x += (b - a) + track
    return out

word, _ = senkon(BOXES[0][0], CAP0, BASE0)
X0, CAP1, GAP, CAP2, CY = 500, 78, 18, 40, 172        # lockup text block: left edge, cap heights, line gap, vertical centre
# optical alignment: the round S starts a little before the straight M below it, and the K's diagonal tips reach a little
# past the N's straight stem above them, so the two lines look flush although their ink boxes are not
HANG_L, HANG_R = 0.045 * CAP1, 0.03 * CAP1
base1 = CY - (CAP1 + GAP + CAP2) / 2 + CAP1
top, width = senkon(X0, CAP1, base1)
lockup = top + line2('MÜHENDİSLİK', X0 + HANG_L, CAP2, base1 + GAP + CAP2, width - HANG_L + HANG_R)
json.dump({'wordmark': word, 'lockup': lockup, 'lockup_right': round(X0 + width + HANG_R)},
          open(os.path.join(ROOT, 'tools', 'logo-letters.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False)
print('wordmark', len(word), 'letters; lockup', len(lockup), 'letters, right edge', round(X0 + width))
