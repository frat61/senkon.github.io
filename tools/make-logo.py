# Makes the web logo and favicon from the source PNG. Usage: python tools/make-logo.py
from PIL import Image
import os
src = Image.open('assets/senkon-logo-source.png').convert('RGBA')
os.makedirs('assets/senkon', exist_ok=True)
w = 600
logo = src.resize((w, round(src.height * w / src.width)), Image.LANCZOS)
logo.save('assets/senkon/logo.png', optimize=True)
fav = src.resize((64, 64), Image.LANCZOS)
fav.save('assets/senkon/favicon.png', optimize=True)
print('logo', logo.size, os.path.getsize('assets/senkon/logo.png'), 'bytes; favicon', fav.size)
