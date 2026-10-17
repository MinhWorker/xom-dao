"""Turn a magenta-background island video into an alpha animation for Godot.

python3 assets/sources/previews/key_island_video.py <video.mp4> [--island co] [--crop W:H:X:Y] [--start 1] [--fps 12] [--inset 0] [--install]
The original video is kept intact. Review files go to .blender/<island>-video/.
"""
import argparse
import importlib.util
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
SIZE = 512
FPS = 12
COUNT = 48
OVERLAP = 8
CROP = '720:720:240:0'


def keyed(image):
    pixels = np.asarray(image.convert('RGB'), dtype=np.float32)
    # Magenta's two strong channels distinguish it from green leaves, blue water and warm stone.
    chroma = np.minimum(pixels[:, :, 0], pixels[:, :, 2]) - pixels[:, :, 1]
    amount = np.clip((chroma - 12) / 88, 0, 1)
    alpha = 1 - amount * amount * (3 - 2 * amount)
    # Recover foreground colors at soft edges instead of retaining the pink backdrop there.
    backdrop = np.median(pixels[:30, :120].reshape(-1, 3), axis=0)
    rgb = np.clip((pixels - (1 - alpha[:, :, None]) * backdrop) / np.maximum(alpha[:, :, None], .025), 0, 255)
    rgba = np.dstack((rgb, alpha * 255)).astype(np.uint8)
    rgba[rgba[:, :, 3] < 5] = 0
    return Image.fromarray(rgba)


def blend_premultiplied(a, b, weight):
    a, b = np.asarray(a, dtype=np.float32) / 255, np.asarray(b, dtype=np.float32) / 255
    alpha = a[:, :, 3:] * (1 - weight) + b[:, :, 3:] * weight
    rgb = (a[:, :, :3] * a[:, :, 3:] * (1 - weight) + b[:, :, :3] * b[:, :, 3:] * weight)
    rgb /= np.maximum(alpha, .001)
    return Image.fromarray(np.clip(np.concatenate((rgb, alpha), axis=2) * 255, 0, 255).astype(np.uint8))


def write_scene(sheets, fps):
    ext = '\n'.join(f'[ext_resource type="Texture2D" path="res://hub/genres/{name}" id="sheet_{i}"]' for i,name in enumerate(sheets))
    atlases = []
    for i in range(COUNT):
        cell = i % 16
        atlases.append(f'[sub_resource type="AtlasTexture" id="frame_{i}"]\natlas = ExtResource("sheet_{i // 16}")\nregion = Rect2({cell % 4 * SIZE}, {cell // 4 * SIZE}, {SIZE}, {SIZE})\n')
    frames = ', '.join(f'{{"duration": 1.0, "texture": SubResource("frame_{i}")}}' for i in range(COUNT))
    return (f'[gd_scene load_steps={len(sheets) + COUNT + 2} format=3]\n\n{ext}\n\n' + '\n'.join(atlases)
            + f'\n[sub_resource type="SpriteFrames" id="loop"]\nanimations = [{{"frames": [{frames}], "loop": true, "name": &"default", "speed": {fps}.0}}]\n\n'
            + '[node name="Island" type="Node2D"]\n\n[node name="Loop" type="AnimatedSprite2D" parent="."]\nsprite_frames = SubResource("loop")\nautoplay = "default"\ncentered = false\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path)
    parser.add_argument('--island', choices=['bai', 'co', 'su-kien', 'hanh-dong', 'sap-co'], default='bai')
    parser.add_argument('--crop', default=CROP, help='Source crop, ffmpeg W:H:X:Y syntax; aspect ratio is preserved')
    parser.add_argument('--start', type=float, default=1)
    parser.add_argument('--fps', type=int, default=FPS)
    parser.add_argument('--inset', type=int, default=0, help='Empty padding inside the 512px output canvas')
    parser.add_argument('--matte-padding', type=int, default=0, help='Limit alpha to the first-frame silhouette expanded by this many pixels; zero disables')
    parser.add_argument('--install', action='store_true')
    args = parser.parse_args()
    out = ROOT / '.blender' / f'{args.island}-video'
    fps, crop = args.fps, args.crop
    if fps <= 0 or args.start < 0 or not 0 <= args.inset < SIZE // 2:
        parser.error('fps must be positive, start nonnegative, and inset between 0 and 255')
    if not 0 <= args.matte_padding <= 64:
        parser.error('matte-padding must be between 0 and 64')
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(args.video)], text=True))
    if duration < args.start + (COUNT + OVERLAP) / fps:
        parser.error('The source clip is too short for this start, frame count and fps')
    out.mkdir(parents=True, exist_ok=True)
    raw = out / 'raw'
    raw.mkdir(exist_ok=True)
    # Crops are chosen per source to exclude pillarboxing/watermarks and preserve the island.
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(args.video),'-an',
                    '-vf',f'crop={crop}','-c:v','libx264','-crf','18','-preset','fast',str(out/'cropped.mp4')], check=True)
    side = SIZE - args.inset * 2
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(args.start),'-i',str(args.video),
                    '-vf',f'crop={crop},fps={fps},scale={side}:{side}:force_original_aspect_ratio=decrease:flags=lanczos,pad={SIZE}:{SIZE}:(ow-iw)/2:(oh-ih)/2:color=0xff00ff',
                    '-frames:v',str(COUNT + OVERLAP),str(raw/'%03d.png')], check=True)
    original = [keyed(Image.open(raw/f'{i+1:03}.png')) for i in range(COUNT + OVERLAP)]
    if args.matte_padding:
        # Fixed-camera clips can invent detached background particles after the first frame.
        support = original[0].getchannel('A').point(lambda value: 255 if value > 96 else 0)
        support = support.filter(ImageFilter.MaxFilter(args.matte_padding * 2 + 1))
        support_array = np.asarray(support, dtype=np.float32) / 255
        for frame in original:
            alpha = np.asarray(frame.getchannel('A'), dtype=np.float32) * support_array
            frame.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    frames = original[OVERLAP:COUNT]
    for i in range(OVERLAP):
        t=(i+1)/OVERLAP
        t=t*t*(3-2*t)
        frames.append(blend_premultiplied(original[COUNT+i], original[i], t))
    for i,frame in enumerate(frames):
        frame.save(out/f'alpha-{i:03}.png')
    spec = importlib.util.spec_from_file_location('review_sky',Path(__file__).with_name('pack_bai_diorama.py'))
    pack = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pack)
    backdrop = pack.sky((SIZE,SIZE))
    review = [Image.alpha_composite(backdrop,im).convert('RGB') for im in frames]
    palette_sheet = Image.new('RGB',(SIZE*4,SIZE*2))
    for i in range(8):
        palette_sheet.paste(review[i*6],(i%4*SIZE,i//4*SIZE))
    palette = palette_sheet.quantize(colors=256)
    indexed = [im.quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG) for im in review]
    durations = [round((i+1)*100/fps)*10-round(i*100/fps)*10 for i in range(COUNT)]
    indexed[0].save(out/f'{args.island}-video-review.gif',save_all=True,append_images=indexed[1:],duration=durations,loop=0,optimize=False)
    review[0].save(out/f'{args.island}-video-review.png')
    # Two contrasting backgrounds make residual magenta and missing foam easy to inspect.
    check = Image.new('RGB',(SIZE*2,SIZE))
    for i,color in enumerate(['#142338','#F3DDB0']):
        bg=Image.new('RGBA',(SIZE,SIZE),color)
        check.paste(Image.alpha_composite(bg,frames[0]).convert('RGB'),(i*SIZE,0))
    check.save(out/'edge-check.png')
    target = ROOT/'apps/client/hub/genres' if args.install else out
    sheets=[]
    for page in range(math.ceil(COUNT/16)):
        sheet=Image.new('RGBA',(SIZE*4,SIZE*4))
        for i,frame in enumerate(frames[page*16:(page+1)*16]):
            sheet.paste(frame,(i%4*SIZE,i//4*SIZE))
        name=f'{args.island}-video-{page}.webp'
        sheet.save(target/name,quality=90,method=6,exact=True)
        sheets.append(name)
    (target/f'{args.island}.tscn').write_text(write_scene(sheets, fps))
    (out/'recipe.json').write_text(json.dumps({'source':str(args.video),'island':args.island,'crop':crop,'start_seconds':args.start,'fps':fps,
        'frames':COUNT,'overlap_frames':OVERLAP,'cell_size':SIZE,'inset':args.inset,'matte_padding':args.matte_padding,'installed':args.install},indent=2)+'\n')
    print(f'{COUNT} alpha frames; {fps} fps; {COUNT / fps:g}-second loop; {len(sheets)} atlases; {target}')


if __name__ == '__main__':
    main()
