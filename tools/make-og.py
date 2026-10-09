"""Write the Open Graph picture (1200x630) shown when the home page is shared: the firm's name and
line in the page's own fonts above the skyline drawing, on white.

Usage: python tools/make-og.py            writes assets/senkon/og.png
Needs Pillow and fontTools with brotli (pip install pillow fonttools brotli): the site's fonts are
woff2 subsets, which Pillow cannot read, so each is decompressed to a TTF in a temp folder first.
Google Fonts splits a face into a latin and a latin-ext file; text is drawn run by run with
whichever file has the glyph (ğ, ş and İ live in latin-ext, ü and ı in latin).
"""
import glob
import os
import tempfile
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FONTS = os.path.join(ROOT, 'assets', 'senkon', 'fonts')
OUT = os.path.join(ROOT, 'assets', 'senkon', 'og.png')
W, H = 1200, 630
INK, MUTED = (29, 43, 51), (91, 106, 115)            # --ink, --muted in site.css
TITLE = 'Senkon Mühendislik'
LINE = 'Taşıyıcı sistem tasarımı ve deprem performans değerlendirmesi'
TAG = 'senkonmuhendislik.com · İstanbul'

tmp = tempfile.mkdtemp()
_ttf = {}

def subsets(stem):
    """[(characters, ttf path)] for every woff2 of a family, decompressed once."""
    if stem not in _ttf:
        _ttf[stem] = []
        for f in sorted(glob.glob(os.path.join(FONTS, stem + '*.woff2'))):
            tt = TTFont(f); tt.flavor = None
            ttf = os.path.join(tmp, os.path.basename(f) + '.ttf'); tt.save(ttf)
            _ttf[stem].append((set(tt.getBestCmap()), ttf))
        if not _ttf[stem]: raise SystemExit('no ' + stem + '*.woff2 in ' + FONTS)
    return _ttf[stem]

class Face:
    """One family at one size: the subset fonts that make it up, each with its character map."""
    def __init__(self, stem, size):
        self.parts = [(cmap, ImageFont.truetype(ttf, size)) for cmap, ttf in subsets(stem)]
    def runs(self, text):
        out = []
        for ch in text:
            font = next((f for cmap, f in self.parts if ord(ch) in cmap), self.parts[0][1])
            if out and out[-1][0] is font: out[-1][1] += ch
            else: out.append([font, ch])
        return out
    def width(self, text):
        return sum(f.getlength(s) for f, s in self.runs(text))
    def draw(self, d, xy, text, fill):
        x, y = xy
        for f, s in self.runs(text):
            d.text((x, y), s, font=f, fill=fill); x += f.getlength(s)

def wrap(face, text, max_w):
    lines, cur = [], ''
    for word in text.split():
        probe = (cur + ' ' + word).strip()
        if cur and face.width(probe) > max_w: lines.append(cur); cur = word
        else: cur = probe
    return lines + [cur]

serif = Face('fraunces', 76)
sans = Face('work-sans', 30)
small = Face('work-sans', 24)

im = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(im)
m = 72                                                 # side margin

# skyline along the bottom, bottom-aligned, scaled to the width inside the margins
sky = Image.open(os.path.join(ROOT, 'assets', 'senkon', 'skyline.webp')).convert('RGB')
sw = W - 2 * m; sh = round(sky.height * sw / sky.width)
sky = sky.resize((sw, sh), Image.LANCZOS)
im.paste(sky, (m, H - sh - 28))

# logo and name, then the line and the address, in the page's measure
logo = Image.open(os.path.join(ROOT, 'assets', 'senkon', 'logo.png')).convert('RGBA')
lh = 64; lw = round(logo.width * lh / logo.height); logo = logo.resize((lw, lh), Image.LANCZOS)
y = 64
im.paste(logo, (m, y), logo)
serif.draw(d, (m + lw + 20, y - 18), TITLE, INK)
y += lh + 40
for ln in wrap(sans, LINE, W - 2 * m):
    sans.draw(d, (m, y), ln, INK); y += 42
small.draw(d, (m, y + 6), TAG, MUTED)

im.save(OUT, optimize=True)
print(f'{W}x{H} -> {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) // 1024} KB)')
