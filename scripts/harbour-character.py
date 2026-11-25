"""Makes a Bến character (`assets/AGENTS.md`, "Harbour art").

generate <prompt.txt> <raw.png> [reference.png ...]
    Runs `agy` with its default permissions: it only draws, then names the file it saved, which is
    copied to <raw.png>. The prompt asks for flat #00FF00 around the figure and an ID badge with a
    flat #FF00FF photo square over a blank white strip.
cutout <raw.png> <out.png> <out.webp> <Name> [photo.jpg | #hexcolour]
    Fills the photo square with the photo (or a solid colour until there is one), writes the name in
    the strip, keys the green to transparency, trims, and writes the Hub's 640 px wide WebP.
avatar <portrait.png> <avatar-id.webp>
    Keys a generated 1024 px head-and-shoulders portrait (framed like `avatar-harbour-raw.png`)
    onto the blue disc of `avatar-harbour` and writes the 256 px avatar.
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

FONT = '/usr/share/fonts/google-noto/NotoSans-Bold.ttf'
WIDTH = 640
PLACEHOLDER = '#5b6b80'


def generate(prompt_file, raw, *references):
    prompt = Path(prompt_file).read_text()
    work = Path(tempfile.mkdtemp(prefix='harbour-'))
    for index, reference in enumerate(references, 1):
        ref = work / f'reference-{index}.png'
        ref.write_bytes(Path(reference).read_bytes())
        prompt += f'\n\nReference image {index}: {ref}'
    prompt += (
        '\n\nDo not run any shell commands. When the image is generated, reply with only the'
        ' absolute path of the image file.'
    )
    result = subprocess.run(
        ['agy', '--add-dir', str(work), '--output-format', 'json', f'--print={prompt}'],
        cwd=work,
        capture_output=True,
        text=True,
        check=True,
    )
    reply = json.loads(result.stdout)['response']
    paths = [line.strip() for line in reply.splitlines() if line.strip().startswith('/')]
    if not paths:
        sys.exit(f'agy named no image:\n{reply}')
    Image.open(paths[-1]).convert('RGB').save(raw)
    print(raw)


def keyed(im):
    """`im` with its flat green made transparent and the green spill pulled off its edges."""
    a = np.asarray(im.convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)
    alpha = np.clip(1 - (spill - 40) / 90, 0, 1)
    g = np.where(spill > 0, np.maximum(r, b) + np.clip(spill, 0, None) * 0.15, g)
    rgba = np.dstack([r, g, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def avatar(portrait, out, size=256, disc=100):
    y, x = np.mgrid[0:size, 0:size].astype(float)
    t = np.clip(np.hypot(x - size / 2, y - 70) / 170, 0, 1)[..., None]
    rgb = np.array([68, 184, 243]) * (1 - t) + np.array([38, 140, 218]) * t
    img = Image.fromarray(np.dstack([rgb, np.full((size, size, 1), 255)]).astype(np.uint8), 'RGBA')
    face = keyed(Image.open(portrait))
    width = round(face.width * 0.335)
    img.alpha_composite(face.resize((width, width), Image.LANCZOS), (-44, 16))
    mask = Image.new('L', (size * 4, size * 4), 0)
    edge = (size / 2 - disc) * 4
    ImageDraw.Draw(mask).ellipse([edge, edge, size * 4 - edge, size * 4 - edge], fill=255)
    img.putalpha(mask.resize((size, size), Image.LANCZOS))
    img.save(out, 'WEBP', quality=90, method=6)
    print(out)


def cutout(raw, out_png, out_webp, name, photo=PLACEHOLDER):
    im = Image.open(raw).convert('RGB')
    a = np.asarray(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    mag = (r > 170) & (b > 170) & (g < 110)
    ys, xs = np.nonzero(mag)
    x0, x1, y0, y1 = xs.min() - 2, xs.max() + 2, ys.min() - 2, ys.max() + 2

    white = (r > 225) & (g > 225) & (b > 225)
    y = y1 + 1
    while y < a.shape[0] and white[y, x0 + 2 : x1 - 1].mean() < 0.9:
        y += 1
    s0 = y
    while y < a.shape[0] and white[y, x0 + 2 : x1 - 1].mean() >= 0.9:
        y += 1
    s1 = y - 1

    draw = ImageDraw.Draw(im)
    if photo.startswith('#'):
        draw.rectangle([x0, y0, x1, y1], fill=photo)
    else:
        face = ImageOps.fit(Image.open(photo).convert('RGB'), (x1 - x0 + 1, y1 - y0 + 1))
        im.paste(face, (x0, y0))
    size = max(8, int((s1 - s0 + 1) * 0.8))
    font = ImageFont.truetype(FONT, size)
    while font.getlength(name) > (x1 - x0) * 0.92 and size > 8:
        size -= 1
        font = ImageFont.truetype(FONT, size)
    draw.text(((x0 + x1) / 2, (s0 + s1) / 2), name, fill='#1b1f24', font=font, anchor='mm')

    cut = keyed(im)
    cut = cut.crop(cut.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
    cut.save(out_png)
    small = cut.resize((WIDTH, round(cut.height * WIDTH / cut.width)), Image.LANCZOS)
    small.save(out_webp, 'WEBP', quality=88, method=6)
    print(out_png, cut.size, out_webp, small.size)


if __name__ == '__main__':
    command, *args = sys.argv[1:]
    {'generate': generate, 'cutout': cutout, 'avatar': avatar}[command](*args)
