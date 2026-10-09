# Makes assets/senkon/logo.png and favicon.png from the original artwork, which lives outside the
# repository at local/senkonlogo-source.png (gitignored; also in git history before commit 4844674).
# White becomes transparent so the mark works on dark backgrounds. Usage: python tools/make-logo.py
from PIL import Image
import os
src = Image.open('local/senkonlogo-source.png').convert('RGBA')
px = src.load()
w, h = src.size
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        lum = min(r, g, b)
        if lum >= 250: px[x, y] = (r, g, b, 0)
        elif lum >= 200: px[x, y] = (r, g, b, int(a * (250 - lum) / 50))
os.makedirs('assets/senkon', exist_ok=True)
src.save('assets/senkon/logo.png', optimize=True)
src.resize((64, 64), Image.LANCZOS).save('assets/senkon/favicon.png', optimize=True)
print('logo', src.size, os.path.getsize('assets/senkon/logo.png'), 'bytes; favicon 64x64')
