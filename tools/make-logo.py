# Makes assets/senkon/logo.png (160 px), favicon.png and apple-touch-icon.png from the original artwork, which lives outside the
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
small = src.resize((160, round(src.height * 160 / src.width)), Image.LANCZOS)
small.quantize(256, method=Image.Quantize.FASTOCTREE).save('assets/senkon/logo.png', optimize=True)
# square-padded copy so the icons are not squashed
side = max(src.size)
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(src, ((side - src.width) // 2, (side - src.height) // 2))
sq.resize((64, 64), Image.LANCZOS).save('assets/senkon/favicon.png', optimize=True)
touch = Image.new('RGB', (180, 180), 'white')
big = sq.resize((180, 180), Image.LANCZOS)
touch.paste(big, (0, 0), big.getchannel('A'))
touch.save('assets/senkon/apple-touch-icon.png', optimize=True)
print('logo', small.size, os.path.getsize('assets/senkon/logo.png'), 'bytes; favicon 64x64; apple-touch-icon 180x180')
