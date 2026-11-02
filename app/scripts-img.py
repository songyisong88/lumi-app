"""Build responsive WebP images: assets-src/img/*.jpg -> public/img/<name>.webp (≤800w) + <name>-400.webp. Avatars -> one 160px webp."""
import glob, os
from PIL import Image
SRC, OUT = 'assets-src/img', 'public/img'
tot_in = tot_out = 0
for f in sorted(glob.glob(f'{SRC}/*.jpg')):
    n = os.path.basename(f)[:-4]; im = Image.open(f).convert('RGB'); tot_in += os.path.getsize(f)
    sizes = [(None, 160)] if n.startswith('av_') else [(None, 800), ('400', 400)]
    for suf, w in sizes:
        x = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        p = f'{OUT}/{n}{"-" + suf if suf else ""}.webp'; x.save(p, 'WEBP', quality=66 if w > 400 else 68, method=6); tot_out += os.path.getsize(p)
print('jpg in KB', tot_in // 1024, 'webp out KB', tot_out // 1024)
