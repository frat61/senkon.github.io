"""Write one of the six "Nasıl çalışıyoruz" story pictures (assets/senkon/surec/0n.webp, 1200x900,
greyscale WebP quality 80) that surec.js plays on the Deprem performans page.

Usage: python tools/make-surec.py [--dir <folder>] <in.png> <n>      converts a ChatGPT drawing (prompts in local/surec-prompts.md)
       python tools/make-surec.py [--dir <folder>] --placeholder <n>  writes a white card with the number, until the drawing exists
n is 1..6. --dir is a folder relative to the repo root (default assets/senkon/surec; the Tasarım page
uses assets/senkon/tasarim-surec). Needs Pillow (pip install pillow).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DIR = os.path.join(ROOT, 'assets', 'senkon', 'surec')
W, H = 1200, 900
QUALITY = 80


def out(n):
    os.makedirs(DIR, exist_ok=True)
    return os.path.join(DIR, '%02d.webp' % n)


def convert(src, n):
    im = ImageOps.fit(Image.open(src).convert('L'), (W, H))
    im.save(out(n), 'WEBP', quality=QUALITY)


def placeholder(n):
    im = Image.new('L', (W, H), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], outline=0, width=4)
    try:
        font = ImageFont.load_default(size=240)
    except TypeError:                                   # Pillow < 10 has no size argument
        font = ImageFont.load_default()
    d.text((W / 2, H / 2), '%02d' % n, fill=0, font=font, anchor='mm')
    im.save(out(n), 'WEBP', quality=QUALITY)


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == '--dir':
        DIR = os.path.join(ROOT, a[1])
        a = a[2:]
    if len(a) == 2 and a[0] == '--placeholder':
        placeholder(int(a[1]))
    elif len(a) == 2:
        convert(a[0], int(a[1]))
    else:
        sys.exit(__doc__)
    print(out(int(a[1])), os.path.getsize(out(int(a[1]))), 'bytes')
