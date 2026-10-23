"""Key the flat green (#00FF00) background out of a generated JPG and save a PNG with alpha.

Run from the repository root:
  python3 games/checkers/sources/key_green.py <in.jpg> games/checkers/sources/emblem.png
Antigravity's pictures are JPG without alpha, so objects are asked for on pure green. Green
fringe on the edges is pulled back towards the object's own colour (despill).
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
# How much greener than its other channels a pixel is: 0 on the object, high on the background.
green = g - np.maximum(r, b)
alpha = np.clip(1.0 - (green - 40.0) / 90.0, 0.0, 1.0)
mask = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
mask = mask.filter(ImageFilter.GaussianBlur(0.8))
# Despill: no channel of green may exceed the brighter of red and blue.
rgb[..., 1] = np.minimum(g, np.maximum(r, b) + 8.0)
image = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGBA')
image.putalpha(mask)
image = image.crop(image.getbbox())
image.save(out)
print(out, image.size)
