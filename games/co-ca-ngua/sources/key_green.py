"""Key the flat green background out of an Antigravity picture (JPG, no alpha) and save a
trimmed WebP: python3 sources/key_green.py <in.jpg> <out.webp> <max side>."""
import sys

import numpy as np
from PIL import Image, ImageFilter

source, target, side = sys.argv[1], sys.argv[2], int(sys.argv[3])
rgb = np.asarray(Image.open(source).convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
# How much greener than the other channels: the background is far greener than anything else.
spill = g - np.maximum(r, b)
alpha = np.clip(1.0 - (spill - 25.0) / 45.0, 0.0, 1.0)
# Pull the green spill out of the edge pixels.
g2 = np.where(spill > 0, np.maximum(r, b) + np.clip(spill, 0, None) * 0.15, g)
out = np.dstack([r, g2, b, alpha * 255.0]).astype(np.uint8)
picture = Image.fromarray(out, 'RGBA')
mask = picture.getchannel('A').filter(ImageFilter.MinFilter(3))
picture.putalpha(mask)
picture = picture.crop(picture.getbbox())
picture.thumbnail((side, side), Image.LANCZOS)
picture.save(target, quality=88, method=6)
print(target, picture.size)
