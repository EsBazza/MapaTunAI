"""Cut the Columbus bridge deck into 3 animatable pieces + an inpainted base.

Outputs (into out_dir):
  bridge-base.jpg     the photo with the deck section removed (gap inpainted)
  bridge-piece-N.png  RGBA cut-outs of each deck piece (N = 1..3)
  pieces.json         each piece's box in source-image pixels
Usage: python make_pieces.py <src.jpg> <out_dir> [preview.png]
"""
import json
import os
import sys

import cv2
import numpy as np

src, out_dir = sys.argv[1], sys.argv[2]
img = cv2.imread(src)
H, W = img.shape[:2]
rng = np.random.default_rng(1940)  # reproducible fracture lines


def top(x):  # just above the railing
    return 1120 + 0.03 * (x - 210)


def bottom(x):  # just below the white slab
    return 1306 + 0.105 * (x - 300)


# Fracture lines: jagged polylines shared by neighbouring pieces, so they fit exactly.
CUTS = [262, 398, 532, 662]
fractures = []
for x in CUTS:
    ys = np.linspace(top(x) - 6, bottom(x) + 6, 11)
    pts = [(x + rng.uniform(-14, 14), y) for y in ys]
    fractures.append(pts)

masks = []
for i in range(3):
    left, right = fractures[i], fractures[i + 1]
    poly = np.array(left + right[::-1], np.int32)
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [poly], 255, lineType=cv2.LINE_AA)
    masks.append(m)

union = np.maximum.reduce(masks)

# Base: rebuild what is behind the missing section from real surrounding pixels:
# sky mirrored down from above the railing, ground mirrored up from below the slab.
hole = cv2.dilate(union, np.ones((9, 9), np.uint8))
fill = img.copy()
sky = np.median(img[1000:1090, 420:700].reshape(-1, 3), axis=0)
grain = rng.normal(0, 2.5, img.shape)
ys, xs = np.nonzero(hole)
for y, x in zip(ys, xs):
    t, b_ = top(x) - 10, bottom(x) + 10
    split = t + (b_ - t) * 0.5
    if y < split:
        fill[y, x] = np.clip(sky + grain[y, x], 0, 255)
    else:
        fill[y, x] = img[min(int(round(2 * b_ - y)), H - 1), x]
# Soften the mirror seam and blend the patch in.
blurred = cv2.GaussianBlur(fill, (0, 0), 2.2)
alpha = cv2.GaussianBlur(hole.astype(np.float32) / 255, (0, 0), 3)[..., None]
base = (img.astype(np.float32) * (1 - alpha) + blurred.astype(np.float32) * alpha).astype(np.uint8)
# Darken the scar slightly so the gap reads as empty space at night.
scar = cv2.GaussianBlur(union.astype(np.float32) / 255, (0, 0), 6)[..., None]
base = (base.astype(np.float32) * (1 - 0.0 * scar)).clip(0, 255).astype(np.uint8)

os.makedirs(out_dir, exist_ok=True)
cv2.imwrite(os.path.join(out_dir, 'bridge-base.jpg'), base, [cv2.IMWRITE_JPEG_QUALITY, 84, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])

boxes = []
for i, m in enumerate(masks, start=1):
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = m[y0:y1, x0:x1]
    cv2.imwrite(os.path.join(out_dir, f'bridge-piece-{i}.png'), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    boxes.append({'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)})

outlines = [[[round(float(x)), round(float(y))] for x, y in fractures[i] + fractures[i + 1][::-1]] for i in range(3)]
meta = {'width': W, 'height': H, 'pieces': boxes, 'outlines': outlines, 'joints': [round(float(np.mean([p[0] for p in f])), 1) for f in fractures]}
with open(os.path.join(out_dir, 'pieces.json'), 'w') as f:
    json.dump(meta, f)
print(json.dumps(meta))

if len(sys.argv) > 3:
    crop = base[1000:1450, 100:900]
    cv2.imwrite(sys.argv[3], crop)
